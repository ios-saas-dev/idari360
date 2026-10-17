import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendRequestNotificationEmail } from '@/lib/email';

// Ek URL listelerini temizle: yalnızca http(s) bağlantıları, en fazla 20 adet
function cleanUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
    .slice(0, 20);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  const { data, error } = await supabase
    .from('requests')
    .select(`
      *,
      creator:profiles!requests_created_by_fkey(id, full_name, email, avatar_url),
      assignee:profiles!requests_assigned_to_fkey(id, full_name, email, avatar_url),
      approver:profiles!requests_approved_by_fkey(id, full_name, email, avatar_url),
      facility:facilities(id, name, city),
      request_comments(id, comment, created_at, user_id, user:profiles(id, full_name, avatar_url)),
      request_history(id, old_status, new_status, note, attachment_urls, created_at, changed_by, changer:profiles(id, full_name)),
      satisfaction:satisfaction_ratings(id, score, comment, created_at, user_id)
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Profil görünürlüğü zenginleştirmesi: RLS profil kısıtı nedeniyle personel/çalışan
  // görünümünde başka kullanıcıların adları boş dönebilir (ör. "İşlem Yapan: Sistem").
  // İsimler sistem istemcisiyle tamamlanır — yalnızca görüntü amaçlı ad/avatar bilgisi.
  const d: any = data;
  const profileIds = new Set<string>();
  if (d.created_by) profileIds.add(d.created_by);
  if (d.assigned_to) profileIds.add(d.assigned_to);
  if (d.approved_by) profileIds.add(d.approved_by);
  (d.request_comments || []).forEach((c: any) => { if (c.user_id) profileIds.add(c.user_id); });
  (d.request_history || []).forEach((h: any) => { if (h.changed_by) profileIds.add(h.changed_by); });

  if (profileIds.size > 0) {
    const admin = createAdminClient();
    const { data: profileRows } = await admin
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', Array.from(profileIds));

    const byId = new Map<string, any>((profileRows || []).map((p: any) => [p.id, p]));
    if (!d.creator && d.created_by) d.creator = byId.get(d.created_by) || null;
    if (!d.assignee && d.assigned_to) d.assignee = byId.get(d.assigned_to) || null;
    if (!d.approver && d.approved_by) d.approver = byId.get(d.approved_by) || null;
    (d.request_comments || []).forEach((c: any) => {
      if (!c.user && c.user_id) c.user = byId.get(c.user_id) || null;
    });
    (d.request_history || []).forEach((h: any) => {
      if (!h.changer && h.changed_by) h.changer = byId.get(h.changed_by) || null;
    });
  }

  // İş Kuralı: Açılan talepler karşılandığında talep hakkında olan yorum ve konuşmalar
  // yalnızca sorumlular arasında görünür olsun. Talebi açan kişi bu konuşmaları göremesin.
  const isResponsible =
    ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'].includes(profile?.role || '') ||
    data.assigned_to === user.id;

  const isFulfilled = data.status !== 'yeni';

  if (isFulfilled && !isResponsible) {
    data.request_comments = [];
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { id } = await params;
  const { data: profile } = await supabase.from('profiles').select('id, full_name, company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const body = await request.json();
  const { status, action, assigned_to, note, title, description, priority, resolution_photos } = body;

  // Get current request
  const { data: currentReq } = await supabase
    .from('requests')
    .select('id, status, created_by, company_id, facility_id, request_number, title, created_at, assigned_to, assigned_at')
    .eq('id', id)
    .single();

  if (!currentReq) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });
  if (currentReq.company_id !== profile.company_id && profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  // Facility-level isolation for facility roles (Tesis Sorumlusu & Müdürü kendi tesisini yönetir)
  if (['facility_manager', 'facility_officer'].includes(profile.role)) {
    if (profile.facility_id && currentReq.facility_id !== profile.facility_id) {
      return NextResponse.json({ error: 'Bu tesise ait talepleri yönetme yetkiniz bulunmamaktadır.' }, { status: 403 });
    }
  }

  const isMgr = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'].includes(profile.role);
  const isCreator = currentReq.created_by === user.id;

  // Eylem adı verildiyse hedef statü eylemden türetilir (eski istemciler status de gönderse eylem kazanır)
  const actionStatusMap: Record<string, string> = {
    take_over: 'atandi',
    approve: 'onaylandi',
    start: 'islemde',
    resolve: 'cozumlendi',
    reject: 'reddedildi',
  };
  const targetStatus = action && actionStatusMap[action] ? actionStatusMap[action] : status;

  // Employee can only cancel/reject their own 'yeni' request
  if (profile.role === 'employee' && !(isCreator && currentReq.status === 'yeni' && targetStatus === 'reddedildi')) {
    return NextResponse.json({ error: 'Durum değiştirme yetkiniz yok' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (title && isMgr) updates.title = title;
  if (description && isMgr) updates.description = description;
  if (priority && isMgr) updates.priority = priority;
  if (assigned_to !== undefined && isMgr) updates.assigned_to = assigned_to;

  let historyNote = note || null;
  let historyPhotos: string[] = [];

  // =========================================================================
  // İŞ AKIŞI ADIMLARI VE KURALLARI
  // =========================================================================

  // Adım 2 (T2): Talebi Üzerine Alma → Statü: Atandı (Yönetici Onayı Bekliyor)
  if (action === 'take_over' || (targetStatus === 'atandi' && currentReq.status === 'yeni')) {
    if (!isMgr) {
      return NextResponse.json({ error: 'Talebi üzerinize alma yetkiniz yok.' }, { status: 403 });
    }
    if (currentReq.status !== 'yeni') {
      return NextResponse.json({ error: 'Bu talep zaten karşılanmıştır. Akış üzerinden ilerleyiniz.' }, { status: 400 });
    }
    updates.status = 'atandi';
    updates.assigned_to = user.id;
    updates.assigned_at = new Date().toISOString();
    historyNote = historyNote || `Talep ${profile.full_name || 'yetkili'} tarafından karşılanmak üzere üzerine alındı — yönetici onayı bekleniyor (T2: Karşılama)`;

    // Talebi açan kişiye bildirim gönder (Notifications)
    if (currentReq.created_by && currentReq.created_by !== user.id) {
      await supabase.from('notifications').insert({
        company_id: profile.company_id,
        user_id: currentReq.created_by,
        title: 'Talebiniz Sorumluya Atandı',
        message: `Talebiniz (${currentReq.request_number || 'Talep'}) ${profile.full_name || 'yetkili'} tarafından karşılanmak üzere üzerine alınmıştır. Yönetici onay süreci başlamıştır.`,
        type: 'bildirim',
        related_type: 'request',
        related_id: id,
      });
    }

    // Onay verebilecek yöneticilere sistem bildirimi (admin istemcisi: RLS görünürlüğünden bağımsız)
    const admin = createAdminClient();
    const { data: approverProfiles } = await admin
      .from('profiles')
      .select('id, role, facility_id')
      .eq('company_id', currentReq.company_id)
      .in('role', ['super_admin', 'company_admin', 'facility_manager'])
      .eq('is_active', true);

    const approverIds = (approverProfiles || [])
      .filter((p) => p.role === 'super_admin' || p.role === 'company_admin' || p.facility_id === currentReq.facility_id)
      .map((p) => p.id)
      .filter((uid) => uid !== user.id && uid !== currentReq.created_by);

    if (approverIds.length > 0) {
      await admin.from('notifications').insert(
        approverIds.map((uid) => ({
          company_id: currentReq.company_id,
          user_id: uid,
          title: 'Talep Onayı Bekleniyor',
          message: `${currentReq.request_number || 'Talep'} numaralı talep (${currentReq.title}) üzerine alındı; onayınız bekleniyor.`,
          type: 'uyari',
          related_type: 'request',
          related_id: id,
        }))
      );
    }
  }
  // Adım 3 (T3): Yönetici Onayı → Statü: Onaylandı
  else if (action === 'approve' || (targetStatus === 'onaylandi' && currentReq.status === 'atandi')) {
    if (!['super_admin', 'company_admin', 'facility_manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Talep onaylama yetkisi Tesis Müdürü, Şirket Yöneticisi ve Süper Yöneticiye aittir.' }, { status: 403 });
    }
    if (currentReq.status !== 'atandi') {
      return NextResponse.json({ error: 'Yalnızca sorumluya atanmış (onay bekleyen) talepler onaylanabilir.' }, { status: 400 });
    }
    updates.status = 'onaylandi';
    updates.approved_by = user.id;
    updates.approved_at = new Date().toISOString();
    historyNote = historyNote || `Talep ${profile.full_name || 'yönetici'} tarafından onaylandı — işleme başlanabilir (T3: Onay)`;

    // Talebi açan kişiye bildirim gönder (Notifications)
    if (currentReq.created_by && currentReq.created_by !== user.id) {
      await supabase.from('notifications').insert({
        company_id: profile.company_id,
        user_id: currentReq.created_by,
        title: 'Talebiniz Onaylandı',
        message: `Talebiniz (${currentReq.request_number || 'Talep'}) yönetici tarafından onaylanmıştır; işleme alınacaktır.`,
        type: 'bildirim',
        related_type: 'request',
        related_id: id,
      });
    }

    // Üzerine alan sorumluya bildirim (kendisi onaylamadıysa)
    if (currentReq.assigned_to && currentReq.assigned_to !== user.id) {
      await supabase.from('notifications').insert({
        company_id: profile.company_id,
        user_id: currentReq.assigned_to,
        title: 'Üzerinize Aldığınız Talep Onaylandı',
        message: `${currentReq.request_number} numaralı talep onaylandı. İşleme başlayabilirsiniz.`,
        type: 'bildirim',
        related_type: 'request',
        related_id: id,
      });
    }
  }
  // Adım 4 (T4): İşleme Başlama → Statü: İşlemde
  else if (action === 'start' || (targetStatus === 'islemde' && currentReq.status === 'onaylandi')) {
    const isAssignee = currentReq.assigned_to === user.id;
    const canStart = isAssignee || ['super_admin', 'company_admin', 'facility_manager'].includes(profile.role);
    if (!isMgr || !canStart) {
      return NextResponse.json({ error: 'Talebi işleme alma yetkiniz yok.' }, { status: 403 });
    }
    if (currentReq.status !== 'onaylandi') {
      return NextResponse.json({ error: 'Talep işleme başlanmadan önce yönetici onayından geçmelidir.' }, { status: 400 });
    }
    updates.status = 'islemde';
    updates.started_at = new Date().toISOString();
    historyNote = historyNote || `Talep ${profile.full_name || 'sorumlu'} tarafından işleme alındı (T4: İşlem)`;

    // Talebi açan kişiye bildirim gönder (Notifications)
    if (currentReq.created_by && currentReq.created_by !== user.id) {
      await supabase.from('notifications').insert({
        company_id: profile.company_id,
        user_id: currentReq.created_by,
        title: 'Talebiniz İşleme Alındı',
        message: `Talebiniz (${currentReq.request_number || 'Talep'}) ${profile.full_name || 'sorumlu'} tarafından işleme alınmıştır.`,
        type: 'bildirim',
        related_type: 'request',
        related_id: id,
      });
    }
  }
  // Adım 5 (T5): Sonuçlandırma — Çözüm veya Red (Statü: Çözümlendi veya Reddedildi)
  else if (targetStatus === 'cozumlendi' || targetStatus === 'reddedildi') {
    // KURAL: Kim üstüne alırsa akış onun üzerinden ilerler (Üst yönetici override edebilir)
    const isAssignee = currentReq.assigned_to === user.id;
    const isTopAdmin = ['super_admin', 'company_admin'].includes(profile.role);
    if (currentReq.assigned_to && !isAssignee && !isTopAdmin) {
      return NextResponse.json({
        error: 'Bu talep başka bir yetkili tarafından üzerine alınmıştır. Yalnızca talebi üzerine alan sorumlu veya şirket yöneticisi sonuçlandırabilir.',
      }, { status: 403 });
    }

    // AKIŞ KURALI: Çözüm yalnızca işleme başlanmış talepte; red onay/işlem aşamalarında yapılabilir
    if (targetStatus === 'cozumlendi' && currentReq.status !== 'islemde') {
      return NextResponse.json({
        error: 'Talep çözüldü olarak kapatılmadan önce işleme başlanmalıdır (Sorumlu → Onay → İşlem → Kapanış).',
      }, { status: 400 });
    }
    if (targetStatus === 'reddedildi' && !['yeni', 'atandi', 'onaylandi', 'islemde'].includes(currentReq.status)) {
      return NextResponse.json({ error: 'Bu talep zaten kapatılmıştır.' }, { status: 400 });
    }

    // KRİTİK KURAL: Açıklama / Not Zorunlu Alan!
    if (!note || !note.trim()) {
      return NextResponse.json({ 
        error: targetStatus === 'cozumlendi' 
          ? 'Çözüm ile ilgili açıklama/not girilmesi zorunludur.' 
          : 'Red sebebi ile ilgili açıklama/not girilmesi zorunludur.' 
      }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    updates.status = targetStatus;
    updates.closed_at = nowIso;
    updates.resolution_note = note.trim();
    if (resolution_photos && Array.isArray(resolution_photos)) {
      const cleanPhotos = cleanUrlList(resolution_photos);
      updates.resolution_photos = cleanPhotos;
      historyPhotos = cleanPhotos;
    }
    historyNote = note.trim();

    // Talebi açan kişiye bildirim gönder (Notifications)
    if (currentReq.created_by && currentReq.created_by !== user.id) {
      const isResolved = targetStatus === 'cozumlendi';
      await supabase.from('notifications').insert({
        company_id: profile.company_id,
        user_id: currentReq.created_by,
        title: isResolved ? 'Talebiniz Çözümlendi' : 'Talebiniz Reddedildi',
        message: isResolved 
          ? `Talebiniz (${currentReq.request_number || 'Talep'}) çözüme kavuşturuldu. Not: ${note.trim()}`
          : `Talebiniz (${currentReq.request_number || 'Talep'}) reddedildi. Sebep: ${note.trim()}`,
        type: isResolved ? 'bildirim' : 'uyari',
        related_type: 'request',
        related_id: id,
      });
    }
  } else if (targetStatus) {
    updates.status = targetStatus;
  }

  const { data: updated, error } = await supabase
    .from('requests')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      creator:profiles!requests_created_by_fkey(id, full_name, email, avatar_url),
      assignee:profiles!requests_assigned_to_fkey(id, full_name, email, avatar_url),
      approver:profiles!requests_approved_by_fkey(id, full_name, email, avatar_url),
      facility:facilities(id, name, city)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to request_history
  if (targetStatus && targetStatus !== currentReq.status) {
    const { error: histErr } = await supabase.from('request_history').insert({
      request_id: id,
      old_status: currentReq.status,
      new_status: targetStatus,
      changed_by: user.id,
      note: historyNote,
      attachment_urls: historyPhotos,
    });
    if (histErr) console.error('[request_history insert error]', histErr.message);

    // E-posta Bildirimi Gönder (Resend Email)
    if (updated?.creator?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';
      sendRequestNotificationEmail({
        to: updated.creator.email,
        recipientName: updated.creator.full_name,
        requestNumber: updated.request_number,
        title: updated.title,
        status: targetStatus,
        category: updated.category,
        facilityName: updated.facility?.name,
        note: historyNote,
        changerName: profile.full_name,
        actionUrl: `${baseUrl}/dashboard/requests/${id}`,
      }).catch((e) => console.error('[sendRequestNotificationEmail error]', e));
    }
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { id } = await params;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  const { data: req } = await supabase.from('requests').select('created_by, status').eq('id', id).single();
  if (!req) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

  const isAdmin = ['super_admin', 'company_admin'].includes(profile?.role || '');
  const isCreatorAndNew = req.created_by === user.id && req.status === 'yeni';
  if (!isAdmin && !isCreatorAndNew) return NextResponse.json({ error: 'Silme yetkiniz yok' }, { status: 403 });

  const { error } = await supabase.from('requests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
