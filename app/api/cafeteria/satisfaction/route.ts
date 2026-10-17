import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/* ============================================================================
   GÜNLÜK YEMEKHANE MEMNUNİYET ANKETİ (1-5)
   - Her kullanıcı günde BİR kez değerlendirme yapabilir (DB'de partial unique
     index ile korunur: user_id + period, module='yemekhane')
   - Kullanıcı aynı gün içinde puan/yorumunu güncelleyebilir
   - Özet (ortalama + adet) herkese; dağılım ve yorumlar yalnızca müdür/uzman+
============================================================================ */

const MANAGER_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];

function todayIstanbul(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

function isValidMonth(m: string): boolean {
  return /^\d{4}-\d{2}$/.test(m);
}

/* Ayın ilk ve son günü (YYYY-MM-DD) */
function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map((p) => parseInt(p, 10));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.company_id) return NextResponse.json({ error: 'Profile incomplete' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || todayIstanbul().slice(0, 7);
  if (!isValidMonth(month)) return NextResponse.json({ error: 'Geçersiz ay (YYYY-MM).' }, { status: 400 });

  const today = todayIstanbul();
  const { start, end } = monthRange(month);
  const isManager = MANAGER_ROLES.includes(profile.role);
  const canSeeDetails = isManager;

  // 1) Kendi değerlendirmem (bugün)
  const { data: mine } = await supabase
    .from('satisfaction_ratings')
    .select('id, score, comment, period, created_at')
    .eq('user_id', user.id)
    .eq('module', 'yemekhane')
    .is('request_id', null)
    .eq('period', today)
    .maybeSingle();

  // 2) Aylık özet (admin istemcisi: toplamlar görünürlükten bağımsız hesaplanır)
  const admin = createAdminClient();
  const facilityScoped = ['facility_manager', 'facility_officer'].includes(profile.role) && profile.facility_id;

  // Ortak kapsam: şirket + (tesis bazlı roller için) tesis filtresi
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseQuery = (select: string): any => {
    let q = admin
      .from('satisfaction_ratings')
      .select(select)
      .eq('module', 'yemekhane')
      .is('request_id', null)
      .gte('period', start)
      .lte('period', end)
      .eq('company_id', profile.company_id as string);
    if (facilityScoped) q = q.eq('facility_id', profile.facility_id as string);
    return q;
  };

  const { data: monthRows, error: monthErr } = await baseQuery('score').limit(5000);

  if (monthErr) return NextResponse.json({ error: monthErr.message }, { status: 500 });

  const count = monthRows?.length || 0;
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let sum = 0;
  for (const r of monthRows || []) {
    const s = Math.round(Number(r.score));
    if (s >= 1 && s <= 5) distribution[String(s)] += 1;
    sum += Number(r.score) || 0;
  }
  const score_avg = count > 0 ? Math.round((sum / count) * 100) / 100 : null;

  // 3) Son yorumlar (yalnızca müdür/uzman+)
  let recent: Array<{ score: number; comment: string; period: string; user_name: string | null }> | null = null;
  if (canSeeDetails) {
    const { data: comments } = await baseQuery(
      'score, comment, period, profiles!satisfaction_ratings_user_id_fkey(full_name)'
    )
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    recent = (comments || []).map(
      (c: { score: unknown; comment: string; period: string; profiles: { full_name?: string } | null }) => ({
        score: Number(c.score),
        comment: c.comment,
        period: c.period,
        user_name: c.profiles?.full_name || null,
      })
    );
  }

  return NextResponse.json({
    data: {
      month,
      today,
      mine: mine
        ? { id: mine.id, score: Number(mine.score), comment: mine.comment, period: mine.period }
        : null,
      score_avg,
      count,
      distribution: canSeeDetails ? distribution : null,
      recent,
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.company_id) return NextResponse.json({ error: 'Profile incomplete' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const score = Number(body?.score);
  const commentRaw = typeof body?.comment === 'string' ? body.comment.trim() : '';

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: 'Puan 1 ile 5 arasında tam sayı olmalıdır.' }, { status: 400 });
  }
  if (commentRaw.length > 1000) {
    return NextResponse.json({ error: 'Yorum en fazla 1000 karakter olabilir.' }, { status: 400 });
  }

  const today = todayIstanbul();

  // Aynı gün kayıt varsa güncelle, yoksa oluştur
  const { data: existing } = await supabase
    .from('satisfaction_ratings')
    .select('id')
    .eq('user_id', user.id)
    .eq('module', 'yemekhane')
    .is('request_id', null)
    .eq('period', today)
    .maybeSingle();

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from('satisfaction_ratings')
      .update({ score, comment: commentRaw || null })
      .eq('id', existing.id)
      .select('id, score, comment, period')
      .single();
    if (updErr) {
      console.error('[cafeteria satisfaction update error]', updErr);
      return NextResponse.json({ error: 'Değerlendirme güncellenemedi. Lütfen tekrar deneyin.' }, { status: 500 });
    }
    return NextResponse.json({ data: { ...updated, score: Number(updated.score) }, updated: true });
  }

  const { data: inserted, error: insErr } = await supabase
    .from('satisfaction_ratings')
    .insert({
      company_id: profile.company_id,
      facility_id: profile.facility_id,
      user_id: user.id,
      module: 'yemekhane',
      score,
      comment: commentRaw || null,
      period: today,
      request_id: null,
    })
    .select('id, score, comment, period')
    .single();

  if (insErr) {
    console.error('[cafeteria satisfaction insert error]', insErr);
    return NextResponse.json({ error: 'Değerlendirme kaydedilemedi. Lütfen tekrar deneyin.' }, { status: 500 });
  }

  return NextResponse.json({ data: { ...inserted, score: Number(inserted.score) }, updated: false });
}
