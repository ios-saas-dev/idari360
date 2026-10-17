import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendCleaningPlanNotificationEmail } from '@/lib/email';

// ─── ATS — Planlı Temizlik API'si ──────────────────────────────────────────
// Excel akışı: "Temizlik firması ATS üzerinden tarih önerir → şube yöneticisine
// bildirim gider → şube Onayla / Yeni Tarih Öner → plan kesinleşir →
// temizlik fotoğraf ve onay akışıyla tamamlanır."
//
// Bu uç: plan listesi (GET) ve yeni tarih önerisi (POST).

const MANAGE_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD → "17 Ekim 2026" (e-posta ve bildirim metinleri için) */
function formatDateTR(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00+03:00`);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = supabase
    .from('cleaning_plans')
    .select(`
      *,
      facility:facilities(id, name),
      creator:profiles!cleaning_plans_created_by_fkey(full_name),
      approver:profiles!cleaning_plans_approved_by_fkey(full_name),
      completer:profiles!cleaning_plans_completed_by_fkey(full_name)
    `)
    .eq('company_id', profile.company_id)
    .order('planned_date', { ascending: false });

  if (!['super_admin', 'company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, role: profile.role });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role, full_name')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!MANAGE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Temizlik planı önerme yetkiniz yok.' }, { status: 403 });
  }

  const body = await req.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const area = typeof body.area === 'string' ? body.area.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const plannedDate = typeof body.planned_date === 'string' ? body.planned_date : '';

  if (!title) return NextResponse.json({ error: 'Temizlik konusu zorunludur.' }, { status: 400 });
  if (!DATE_RE.test(plannedDate)) {
    return NextResponse.json({ error: 'Geçerli bir tarih seçilmelidir.' }, { status: 400 });
  }

  // Tesis: yönetici/şef kendi tesisine önerir; üst yönetim seçebilir.
  const facilityId = (typeof body.facility_id === 'string' && body.facility_id) || profile.facility_id;
  if (!facilityId) {
    return NextResponse.json({ error: 'Tesis bilgisi bulunamadı.' }, { status: 400 });
  }

  const { data: facility } = await supabase
    .from('facilities')
    .select('id, name, company_id')
    .eq('id', facilityId)
    .single();
  if (!facility || facility.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Tesis bulunamadı veya yetkiniz yok.' }, { status: 404 });
  }

  const { data: plan, error } = await supabase
    .from('cleaning_plans')
    .insert({
      company_id: profile.company_id,
      facility_id: facilityId,
      title,
      area: area || null,
      planned_date: plannedDate,
      notes: notes || null,
      status: 'oneri',
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Akış tarihçesi
  await supabase.from('cleaning_plan_history').insert({
    plan_id: plan.id,
    action: 'oneri',
    actor_id: user.id,
    note: notes || `Tarih önerildi: ${formatDateTR(plannedDate)}`,
  });

  // ─── Şube yöneticisine bildirim ("Şube yöneticisine bildirim gider") ───
  const admin = createAdminClient();
  const orParts = ['facility_id.is.null', 'role.eq.company_admin'];
  orParts.unshift(`facility_id.eq.${facilityId}`);
  const { data: authorities } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('company_id', profile.company_id)
    .eq('is_active', true)
    .in('role', ['company_admin', 'facility_manager'])
    .or(orParts.join(','));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';
  const planUrl = `${baseUrl}/dashboard/cleaning?plan=${plan.id}`;
  const dateLabel = formatDateTR(plannedDate);

  for (const authority of authorities || []) {
    if (authority.id === user.id) continue;

    const { error: notifErr } = await admin.from('notifications').insert({
      company_id: profile.company_id,
      user_id: authority.id,
      title: '[ONAY BEKLİYOR] Planlı Temizlik',
      message: `${facility.name} — "${title}" için ${dateLabel} tarihli planlı temizlik önerildi. Onayınız bekleniyor. (Öneren: ${profile.full_name || 'Kullanıcı'})`,
      type: 'bildirim',
      related_type: 'cleaning_plan',
      related_id: plan.id,
    });
    if (notifErr) {
      console.error('[Cleaning plan notify] Bildirim eklenemedi:', notifErr.message, '| alıcı:', authority.id);
    }

    if (authority.email) {
      try {
        await sendCleaningPlanNotificationEmail({
          to: authority.email,
          recipientName: authority.full_name,
          event: 'oneri',
          planTitle: title,
          facilityName: facility.name,
          plannedDate: dateLabel,
          actorName: profile.full_name || undefined,
          note: notes || undefined,
          planUrl,
        });
      } catch (mailErr) {
        console.error('[sendCleaningPlanNotificationEmail error]', mailErr);
      }
    }
  }

  return NextResponse.json({ data: plan }, { status: 201 });
}
