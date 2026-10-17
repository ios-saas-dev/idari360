import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendActionApprovalRequestEmail, sendActionApprovalResultEmail } from '@/lib/email';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  // Fetch action with all related data including audit context
  const { data, error } = await supabase
    .from('actions')
    .select(`
      *,
      responsible:profiles!actions_responsible_user_id_fkey(id, full_name, email, avatar_url),
      creator:profiles!actions_created_by_fkey(id, full_name, email),
      facility:facilities(id, name, city),
      action_history(id, old_status, new_status, note, created_at, changer:profiles(id, full_name)),
      action_photos(id, photo_url, created_at, uploader:profiles(id, full_name))
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // If action has audit_id, fetch audit context separately
  let auditContext = null;
  if (data.audit_id) {
    const { data: audit } = await supabase
      .from('audits')
      .select(`
        id, title, audit_date, total_score, max_possible_score, percentage, status,
        audit_type:audit_types(id, name, module),
        service_vehicle:service_vehicles(id, plate_number, route_name, brand, model)
      `)
      .eq('id', data.audit_id)
      .single();
    auditContext = audit;
  }

  // If action has audit_answer_id, fetch the linked answer with question
  let auditAnswerContext = null;
  if (data.audit_answer_id) {
    const { data: answer } = await supabase
      .from('audit_answers')
      .select(`
        id, answer, note, photo_url, due_date,
        question:audit_questions(id, question_text)
      `)
      .eq('id', data.audit_answer_id)
      .single();
    auditAnswerContext = answer;
  } else if (data.audit_question_id) {
    // Fallback: fetch question text from audit_question_id
    const { data: question } = await supabase
      .from('audit_questions')
      .select('id, question_text')
      .eq('id', data.audit_question_id)
      .single();
    auditAnswerContext = { question };
  }

  return NextResponse.json({
    data: {
      ...data,
      audit: auditContext,
      audit_answer: auditAnswerContext,
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role, full_name').eq('id', user.id).single();
  const { id } = await params;
  const body = await request.json();
  const { intent, status, note, rejection_note, ...rest } = body;

  const { data: current } = await supabase
    .from('actions')
    .select(`
      *,
      responsible:profiles!actions_responsible_user_id_fkey(id, email, full_name),
      facility:facilities(id, name)
    `)
    .eq('id', id)
    .single();
  if (!current || current.company_id !== profile!.company_id) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';
  const actionUrl = `${baseUrl}/dashboard/actions/${id}`;
  const facilityName = (current.facility as { name?: string } | null)?.name || 'Tesis';

  // Sistem bildirimleri + alıcı sorguları: çağıran kullanıcının RLS görünürlüğünden
  // bağımsız çalışması gerektiği için admin (service role) istemcisi kullanılır.
  const admin = createAdminClient();

  // ─────────────────── ONAY AKIŞI: ÇÖZÜMÜ ONAYA GÖNDER ───────────────────
  // Excel akışı: "Firma tamamladı → onayınız bekleniyor"
  if (intent === 'submit') {
    const STAFF_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];
    if (!STAFF_ROLES.includes(profile!.role) && current.responsible_user_id !== user.id) {
      return NextResponse.json({ error: 'Bu aksiyonu onaya gönderme yetkiniz yok.' }, { status: 403 });
    }
    if (!['acik', 'devam_ediyor', 'gecikti'].includes(current.status)) {
      return NextResponse.json({ error: 'Bu aksiyon şu anda onaya gönderilemez durumda.' }, { status: 400 });
    }

    const evidence =
      (typeof body.evidence_note === 'string' && body.evidence_note.trim()) ||
      (current.evidence_note || '').trim();
    if (!evidence) {
      return NextResponse.json(
        { error: 'Onaya göndermeden önce "Çözüm Açıklaması" alanını doldurup kaydedin.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('actions')
      .update({
        status: 'onay_bekliyor',
        evidence_note: evidence,
        submitted_at: now,
        submitted_by: user.id,
        rejection_note: null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('action_history').insert({
      action_id: id,
      old_status: current.status,
      new_status: 'onay_bekliyor',
      changed_by: user.id,
      note: note || 'Çözüm tamamlandı — onaya gönderildi',
    });

    // Onaylayıcı yöneticilere bildirim + e-posta ("Onayınız bekleniyor")
    const orParts = ['facility_id.is.null', 'role.eq.company_admin'];
    if (current.facility_id) orParts.unshift(`facility_id.eq.${current.facility_id}`);
    const { data: authorities } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('company_id', current.company_id)
      .eq('is_active', true)
      .in('role', ['company_admin', 'facility_manager'])
      .or(orParts.join(','));

    for (const authority of authorities || []) {
      if (authority.id === user.id) continue;

      const { error: notifErr } = await admin.from('notifications').insert({
        company_id: current.company_id,
        user_id: authority.id,
        title: `[ONAY BEKLİYOR] ${current.action_number || 'Aksiyon'}`,
        message: `${facilityName} — "${current.title}" aksiyonu için çözüm tamamlandı olarak işaretlendi. Onayınız bekleniyor. (Gönderen: ${profile!.full_name || 'Kullanıcı'})`,
        type: 'bildirim',
        related_type: 'action',
        related_id: id,
      });
      if (notifErr) {
        console.error('[Action submit] Bildirim eklenemedi:', notifErr.message, '| alıcı:', authority.id);
      }

      if (authority.email) {
        try {
          await sendActionApprovalRequestEmail({
            to: authority.email,
            recipientName: authority.full_name,
            actionNumber: current.action_number || 'Aksiyon',
            title: current.title,
            facilityName,
            submittedByName: profile!.full_name || undefined,
            evidenceNote: evidence,
            actionUrl,
          });
        } catch (mailErr) {
          console.error('[sendActionApprovalRequestEmail error]', mailErr);
        }
      }
    }

    return NextResponse.json({ data });
  }

  // ─────────────────── ONAY AKIŞI: YÖNETİCİ ONAY / RED ───────────────────
  if (intent === 'approve' || intent === 'reject') {
    if (!['super_admin', 'company_admin', 'facility_manager'].includes(profile!.role)) {
      return NextResponse.json({ error: 'Onaylama yetkiniz yok.' }, { status: 403 });
    }
    if (current.status !== 'onay_bekliyor') {
      return NextResponse.json({ error: 'Bu aksiyon onay beklemiyor.' }, { status: 400 });
    }

    if (intent === 'approve') {
      const { data, error } = await supabase
        .from('actions')
        .update({
          status: 'kapali',
          closed_at: now,
          approved_by: user.id,
          approved_at: now,
          rejection_note: null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from('action_history').insert({
        action_id: id,
        old_status: 'onay_bekliyor',
        new_status: 'kapali',
        changed_by: user.id,
        note: note || 'Çözüm yönetici tarafından onaylandı — aksiyon kapatıldı',
      });

      await notifyApprovalResult(admin, current, user.id, {
        approved: true,
        facilityName,
        actionUrl,
        targetUserId: current.submitted_by || current.responsible_user_id,
      });

      return NextResponse.json({ data });
    }

    // intent === 'reject'
    const reason = String(rejection_note ?? note ?? '').trim();
    if (!reason) {
      return NextResponse.json({ error: 'Reddetmek için gerekçe zorunludur.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('actions')
      .update({
        status: 'devam_ediyor',
        rejection_note: reason,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('action_history').insert({
      action_id: id,
      old_status: 'onay_bekliyor',
      new_status: 'devam_ediyor',
      changed_by: user.id,
      note: `Reddedildi: ${reason}`,
    });

    await notifyApprovalResult(admin, current, user.id, {
      approved: false,
      rejectionNote: reason,
      facilityName,
      actionUrl,
      targetUserId: current.submitted_by || current.responsible_user_id,
    });

    return NextResponse.json({ data });
  }

  // ─────────────────── GENEL GÜNCELLEME (geri uyumlu) ───────────────────
  // Serbest durum geçişleri yalnızca "açık" ve "devam ediyor"dur; kapatma ve
  // onay akışı yukarıdaki intent geçişleriyle yürütülür.
  if (status && !['acik', 'devam_ediyor'].includes(status)) {
    return NextResponse.json(
      { error: 'Bu duruma geçiş için onay akışı butonlarını kullanın.' },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { ...rest };
  if (status) updates.status = status;

  const { data, error } = await supabase.from('actions').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status && status !== current.status) {
    await supabase.from('action_history').insert({ action_id: id, old_status: current.status, new_status: status, changed_by: user.id, note: note || null });
  }
  return NextResponse.json({ data });
}

/**
 * Onay/red sonucunu sorumluya (gönderene) bildirir: uygulama içi bildirim + e-posta.
 */
async function notifyApprovalResult(
  adminClient: ReturnType<typeof createAdminClient>,
  action: { id: string; action_number?: string | null; title: string; company_id: string },
  actorId: string,
  opts: {
    approved: boolean;
    facilityName: string;
    actionUrl: string;
    targetUserId?: string | null;
    rejectionNote?: string;
  }
) {
  const targetId = opts.targetUserId;
  if (!targetId || targetId === actorId) return; // kendine bildirim gönderme

  const { error: notifErr } = await adminClient.from('notifications').insert({
    company_id: action.company_id,
    user_id: targetId,
    title: opts.approved
      ? `[ONAYLANDI] ${action.action_number || 'Aksiyon'} kapatıldı`
      : `[REDDEDİLDİ] ${action.action_number || 'Aksiyon'} yeniden açıldı`,
    message: opts.approved
      ? `"${action.title}" aksiyonu için gönderdiğiniz çözüm onaylandı ve aksiyon kapatıldı.`
      : `"${action.title}" aksiyonu için gönderdiğiniz çözüm reddedildi. Gerekçe: ${opts.rejectionNote}`,
    type: opts.approved ? 'bildirim' : 'uyari',
    related_type: 'action',
    related_id: action.id,
  });
  if (notifErr) {
    console.error('[Action approval] Bildirim eklenemedi:', notifErr.message, '| alıcı:', targetId);
  }

  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('email, full_name')
    .eq('id', targetId)
    .single();

  if (targetProfile?.email) {
    try {
      await sendActionApprovalResultEmail({
        to: targetProfile.email,
        recipientName: targetProfile.full_name,
        actionNumber: action.action_number || 'Aksiyon',
        title: action.title,
        facilityName: opts.facilityName,
        result: opts.approved ? 'approved' : 'rejected',
        rejectionNote: opts.rejectionNote,
        actionUrl: opts.actionUrl,
      });
    } catch (mailErr) {
      console.error('[sendActionApprovalResultEmail error]', mailErr);
    }
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const { error } = await supabase.from('actions').delete().eq('id', id).eq('company_id', profile!.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
