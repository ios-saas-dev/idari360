import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendCleaningPlanNotificationEmail } from '@/lib/email';

// ─── ATS — Planlı Temizlik Detay / Akış Aksiyonları ────────────────────────
// Sunucu-otoriter durum makinesi:
//   oneri    → onayla (yönetici) · yeni_tarih (yönetici) · iptal (yönetici)
//   onaylandi→ tamamla (personel+, en az 1 fotoğraf) · iptal (yönetici)
//   tamamlandi / iptal → işlem kapalı
//
// Yetkiler:  onayla / yeni_tarih / iptal: müdür+
//            tamamla:                     vardiya şefi dahil personel+

const MANAGER_ROLES = ['super_admin', 'company_admin', 'facility_manager'];
const STAFF_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PHOTOS = 10;

/** YYYY-MM-DD → "17 Ekim 2026" */
function formatDateTR(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00+03:00`);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await supabase
    .from('cleaning_plans')
    .select(`
      *,
      facility:facilities(id, name),
      creator:profiles!cleaning_plans_created_by_fkey(full_name),
      approver:profiles!cleaning_plans_approved_by_fkey(full_name),
      completer:profiles!cleaning_plans_completed_by_fkey(full_name),
      history:cleaning_plan_history(id, action, note, created_at, actor:profiles(full_name))
    `)
    .eq('id', id)
    .order('created_at', { referencedTable: 'cleaning_plan_history', ascending: false })
    .single();
  if (error) return NextResponse.json({ error: 'Plan bulunamadı veya yetkiniz yok.' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, full_name')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const intent = body.intent as string;
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  const { data: plan, error: fetchError } = await supabase
    .from('cleaning_plans')
    .select('*, facility:facilities(id, name)')
    .eq('id', id)
    .single();
  if (fetchError || !plan) {
    return NextResponse.json({ error: 'Plan bulunamadı veya yetkiniz yok.' }, { status: 404 });
  }

  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';
  const planUrl = `${baseUrl}/dashboard/cleaning?plan=${plan.id}`;
  const facilityName = (plan.facility as { name?: string } | null)?.name || 'Tesis';
  const dateLabel = formatDateTR(plan.planned_date as string);

  /** Öneri sahibine (firmaya) bildirim + e-posta */
  const notifyCreator = async (event: 'onay' | 'yeni_tarih' | 'tamamlandi', message: string, mailDate?: string) => {
    if (!plan.created_by) return;
    const { data: creator } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', plan.created_by)
      .maybeSingle();
    if (!creator || creator.id === user.id) return;

    const { error: notifErr } = await admin.from('notifications').insert({
      company_id: plan.company_id,
      user_id: creator.id,
      title:
        event === 'onay'
          ? '[ONAYLANDI] Planlı Temizlik'
          : event === 'yeni_tarih'
            ? '[YENİ TARİH ÖNERİLDİ] Planlı Temizlik'
            : '[TAMAMLANDI] Planlı Temizlik',
      message,
      type: event === 'tamamlandi' ? 'bildirim' : 'uyari',
      related_type: 'cleaning_plan',
      related_id: plan.id,
    });
    if (notifErr) console.error('[Cleaning plan notify creator]', notifErr.message);

    if (creator.email) {
      try {
        await sendCleaningPlanNotificationEmail({
          to: creator.email,
          recipientName: creator.full_name,
          event,
          planTitle: plan.title,
          facilityName,
          plannedDate: mailDate || dateLabel,
          actorName: profile.full_name || undefined,
          note: note || undefined,
          planUrl,
        });
      } catch (mailErr) {
        console.error('[sendCleaningPlanNotificationEmail error]', mailErr);
      }
    }
  };

  // ───────────────────────────── ONAYLA ─────────────────────────────
  if (intent === 'onayla') {
    if (!MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Plan onaylama yetkiniz yok.' }, { status: 403 });
    }
    if (plan.status !== 'oneri') {
      return NextResponse.json({ error: 'Yalnızca onay bekleyen planlar onaylanabilir.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('cleaning_plans')
      .update({ status: 'onaylandi', approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('cleaning_plan_history').insert({
      plan_id: id,
      action: 'onay',
      actor_id: user.id,
      note: note || `Plan kesinleşti: ${dateLabel}`,
    });

    await notifyCreator(
      'onay',
      `${facilityName} — "${plan.title}" (${dateLabel}) planınız onaylandı ve kesinleşti.`
    );
    return NextResponse.json({ data, status: 'onaylandi' });
  }

  // ─────────────────────── YENİ TARİH ÖNERİSİ ───────────────────────
  if (intent === 'yeni_tarih') {
    if (!MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Yeni tarih önerme yetkiniz yok.' }, { status: 403 });
    }
    if (plan.status !== 'oneri') {
      return NextResponse.json({ error: 'Yeni tarih yalnızca onay bekleyen planlar için önerilebilir.' }, { status: 400 });
    }
    const newDate = typeof body.planned_date === 'string' ? body.planned_date : '';
    if (!DATE_RE.test(newDate)) {
      return NextResponse.json({ error: 'Geçerli bir tarih seçilmelidir.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('cleaning_plans')
      .update({ planned_date: newDate })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const newDateLabel = formatDateTR(newDate);
    await supabase.from('cleaning_plan_history').insert({
      plan_id: id,
      action: 'yeni_tarih',
      actor_id: user.id,
      note: note ? `Yeni tarih: ${newDateLabel} — ${note}` : `Yeni tarih önerildi: ${newDateLabel}`,
    });

    await notifyCreator(
      'yeni_tarih',
      `${facilityName} — "${plan.title}" için yönetici yeni tarih önerdi: ${newDateLabel}. Onay için tekrar değerlendirilecek.`,
      newDateLabel
    );
    return NextResponse.json({ data, status: 'oneri' });
  }

  // ─────────────────────────── TAMAMLA ───────────────────────────
  if (intent === 'tamamla') {
    if (!STAFF_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Planı tamamlama yetkiniz yok.' }, { status: 403 });
    }
    if (plan.status !== 'onaylandi') {
      return NextResponse.json({ error: 'Yalnızca onaylanmış planlar tamamlanabilir.' }, { status: 400 });
    }

    const photos = Array.isArray(body.photo_urls)
      ? (body.photo_urls as unknown[]).filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
      : [];
    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'Temizliği tamamlamak için en az bir fotoğraf yüklenmelidir.' },
        { status: 400 }
      );
    }
    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `En fazla ${MAX_PHOTOS} fotoğraf eklenebilir.` }, { status: 400 });
    }

    const completionNote = typeof body.completion_note === 'string' ? body.completion_note.trim() : '';

    const { data, error } = await supabase
      .from('cleaning_plans')
      .update({
        status: 'tamamlandi',
        completed_by: user.id,
        completed_at: new Date().toISOString(),
        completion_note: completionNote || null,
        photo_urls: photos,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('cleaning_plan_history').insert({
      plan_id: id,
      action: 'tamamla',
      actor_id: user.id,
      note: completionNote
        ? `Temizlik tamamlandı (${photos.length} fotoğraf) — ${completionNote}`
        : `Temizlik tamamlandı (${photos.length} fotoğraf)`,
    });

    await notifyCreator(
      'tamamlandi',
      `${facilityName} — "${plan.title}" (${dateLabel}) planlı temizliği tamamlandı olarak işaretlendi.`
    );

    // Şube yöneticilerine bilgilendirme (in-app)
    const orParts = ['facility_id.is.null', 'role.eq.company_admin'];
    orParts.unshift(`facility_id.eq.${plan.facility_id}`);
    const { data: authorities } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', plan.company_id)
      .eq('is_active', true)
      .in('role', ['company_admin', 'facility_manager'])
      .or(orParts.join(','));
    for (const authority of authorities || []) {
      if (authority.id === user.id || authority.id === plan.created_by) continue;
      await admin.from('notifications').insert({
        company_id: plan.company_id,
        user_id: authority.id,
        title: '[TAMAMLANDI] Planlı Temizlik',
        message: `${facilityName} — "${plan.title}" (${dateLabel}) planlı temizliği fotoğraflarla tamamlandı.`,
        type: 'bildirim',
        related_type: 'cleaning_plan',
        related_id: id,
      });
    }

    return NextResponse.json({ data, status: 'tamamlandi' });
  }

  // ──────────────────────────── İPTAL ────────────────────────────
  if (intent === 'iptal') {
    if (!MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Plan iptal etme yetkiniz yok.' }, { status: 403 });
    }
    if (!['oneri', 'onaylandi'].includes(plan.status)) {
      return NextResponse.json({ error: 'Bu plan artık iptal edilemez.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('cleaning_plans')
      .update({ status: 'iptal' })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('cleaning_plan_history').insert({
      plan_id: id,
      action: 'iptal',
      actor_id: user.id,
      note: note || 'Plan iptal edildi',
    });

    if (plan.created_by && plan.created_by !== user.id) {
      await admin.from('notifications').insert({
        company_id: plan.company_id,
        user_id: plan.created_by,
        title: '[İPTAL] Planlı Temizlik',
        message: `${facilityName} — "${plan.title}" (${dateLabel}) planlı temizlik planı iptal edildi.${note ? ` Not: ${note}` : ''}`,
        type: 'uyari',
        related_type: 'cleaning_plan',
        related_id: id,
      });
    }

    return NextResponse.json({ data, status: 'iptal' });
  }

  return NextResponse.json({ error: 'Geçersiz işlem. (onayla, yeni_tarih, tamamla, iptal)' }, { status: 400 });
}
