import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/* ============================================================================
   TALEP MEMNUNİYET ANKETİ (1-5)
   - Yalnızca talebi açan kişi, yalnızca kapanmış (çözümlendi) talebi puanlar
   - Talep başına tek değerlendirme (DB'de partial unique index ile korunur)
   - Düşük puanlarda (<= 2) sorumlu ve yöneticilere sistem bildirimi gider
============================================================================ */

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, company_id, facility_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const score = Number(body?.score);
  const commentRaw = typeof body?.comment === 'string' ? body.comment.trim() : '';

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: 'Puan 1 ile 5 arasında tam sayı olmalıdır.' }, { status: 400 });
  }
  if (commentRaw.length > 1000) {
    return NextResponse.json({ error: 'Yorum en fazla 1000 karakter olabilir.' }, { status: 400 });
  }

  const { data: req, error: reqError } = await supabase
    .from('requests')
    .select('id, request_number, title, status, created_by, company_id, facility_id, category, assigned_to')
    .eq('id', id)
    .single();

  if (reqError || !req) return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 });

  // KURAL: Yalnızca talebi açan kişi değerlendirme yapabilir
  if (req.created_by !== user.id) {
    return NextResponse.json({ error: 'Yalnızca talebi açan kişi memnuniyet değerlendirmesi yapabilir.' }, { status: 403 });
  }

  // KURAL: Talep kapanmadan değerlendirme yapılamaz
  if (!['cozumlendi', 'tamamlandi'].includes(req.status)) {
    return NextResponse.json({ error: 'Memnuniyet değerlendirmesi yalnızca çözümlenen talepler için yapılabilir.' }, { status: 400 });
  }

  // KURAL: Talep başına tek değerlendirme
  const { data: existing } = await supabase
    .from('satisfaction_ratings')
    .select('id, score, comment, created_at')
    .eq('request_id', id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Bu talep için değerlendirmeniz zaten alınmıştır.' }, { status: 409 });
  }

  // İstanbul tarihine göre dönem (YYYY-MM-DD)
  const period = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

  const { data: inserted, error: insertError } = await supabase
    .from('satisfaction_ratings')
    .insert({
      company_id: req.company_id,
      facility_id: req.facility_id,
      user_id: user.id,
      module: req.category || 'diger',
      score,
      comment: commentRaw || null,
      period,
      request_id: id,
    })
    .select('id, score, comment, created_at, request_id')
    .single();

  if (insertError) {
    console.error('[satisfaction insert error]', insertError);
    return NextResponse.json({ error: 'Değerlendirme kaydedilemedi. Lütfen tekrar deneyin.' }, { status: 500 });
  }

  // Düşük puanlarda (<= 2) sorumlu ve yöneticilere bildirim gönder (sistem fan-out: admin istemcisi)
  if (score <= 2) {
    try {
      const admin = createAdminClient();
      const { data: managers } = await admin
        .from('profiles')
        .select('id, role, facility_id')
        .eq('company_id', req.company_id)
        .in('role', ['super_admin', 'company_admin', 'facility_manager'])
        .eq('is_active', true);

      const recipientIds = new Set<string>();
      if (req.assigned_to) recipientIds.add(req.assigned_to);
      (managers || [])
        .filter((m) => m.role === 'super_admin' || m.role === 'company_admin' || m.facility_id === req.facility_id)
        .forEach((m) => recipientIds.add(m.id));
      recipientIds.delete(user.id);

      const message = `${req.request_number || 'Talep'} numaralı talep için memnuniyet puanı ${score}/5 alındı.${
        commentRaw ? ` Yorum: "${commentRaw.slice(0, 200)}"` : ''
      }`;

      const rows = Array.from(recipientIds).map((uid) => ({
        company_id: req.company_id,
        user_id: uid,
        title: `Düşük Memnuniyet Puanı (${score}/5)`,
        message,
        type: 'uyari',
        related_type: 'request',
        related_id: id,
      }));

      if (rows.length > 0) {
        await admin.from('notifications').insert(rows);
      }
    } catch (e) {
      console.error('[satisfaction notify error]', e);
    }
  }

  return NextResponse.json({ data: inserted });
}
