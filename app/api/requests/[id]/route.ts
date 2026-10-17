import { createServerSupabaseClient } from '@/lib/supabase/server';
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
      request_comments(id, comment, created_at, user:profiles(id, full_name, avatar_url)),
      request_history(id, old_status, new_status, note, attachment_urls, created_at, changer:profiles(id, full_name))
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

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
  const { status, action, assigned_to, approved_by, note, title, description, priority, resolution_photos } = body;

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

  const targetStatus = status || (action === 'take_over' ? 'islemde' : action === 'resolve' ? 'cozumlendi' : action === 'reject' ? 'reddedildi' : undefined);

  // Employee can only cancel/reject their own 'yeni' request
  if (profile.role === 'employee' && !(isCreator && currentReq.status === 'yeni' && targetStatus === 'reddedildi')) {
    return NextResponse.json({ error: 'Durum değiştirme yetkiniz yok' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (title && isMgr) updates.title = title;
  if (description && isMgr) updates.description = description;
  if (priority && isMgr) updates.priority = priority;
  if (assigned_to !== undefined && isMgr) updates.assigned_to = assigned_to;
  if (approved_by !== undefined && isMgr) updates.approved_by = approved_by;

  let historyNote = note || null;
  let historyPhotos: string[] = [];

  // =========================================================================
  // İŞ AKIŞI ADIMLARI VE KURALLARI
  // =========================================================================

  // Adım 2: Talebi Üzerine Alma (Statü: İşlemde / Üzerime Alındı)
  if (action === 'take_over' || (targetStatus === 'islemde' && currentReq.status === 'yeni')) {
    if (!isMgr) {
      return NextResponse.json({ error: 'Talebi üzerinize alma yetkiniz yok.' }, { status: 403 });
    }
    updates.status = 'islemde';
    updates.assigned_to = user.id;
    const nowIso = new Date().toISOString();
    updates.assigned_at = nowIso;
    historyNote = historyNote || `Talep Tesis Sorumlusu ${profile.full_name || 'yetkili'} tarafından üzerine alındı (T2: Karşılama)`;

    // Talebi açan kişiye bildirim gönder (Notifications)
    if (currentReq.created_by && currentReq.created_by !== user.id) {
      await supabase.from('notifications').insert({
        company_id: profile.company_id,
        user_id: currentReq.created_by,
        title: 'Talebiniz İşleme Alındı',
        message: `Talebiniz (${currentReq.request_number || 'Talep'}) Tesis Sorumlusu ${profile.full_name || ''} tarafından işleme alınmıştır.`,
        type: 'bildirim',
        related_type: 'request',
        related_id: id,
      });
    }
  }
  // Adım 3: Sonuçlandırma - Çözüm veya Red (Statü: Çözümlendi veya Reddedildi)
  else if (targetStatus === 'cozumlendi' || targetStatus === 'reddedildi') {
    // KURAL: Kim üstüne alırsa akış onun üzerinden ilerler (Üst yönetici override edebilir)
    const isAssignee = currentReq.assigned_to === user.id;
    const isTopAdmin = ['super_admin', 'company_admin'].includes(profile.role);
    if (currentReq.assigned_to && !isAssignee && !isTopAdmin) {
      return NextResponse.json({
        error: 'Bu talep başka bir yetkili tarafından üzerine alınmıştır. Yalnızca talebi üzerine alan sorumlu veya şirket yöneticisi sonuçlandırabilir.',
      }, { status: 403 });
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
    await supabase.from('request_history').insert({
      request_id: id,
      old_status: currentReq.status,
      new_status: targetStatus,
      changed_by: user.id,
      note: historyNote,
      attachment_urls: historyPhotos,
    });

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
