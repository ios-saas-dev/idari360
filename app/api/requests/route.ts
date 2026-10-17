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

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const priority = searchParams.get('priority');
  const search = searchParams.get('search');
  const paramFacilityId = searchParams.get('facility_id');
  const paramCompanyId = searchParams.get('company_id');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('requests')
    .select(`
      *,
      creator:profiles!requests_created_by_fkey(id, full_name, email, avatar_url),
      assignee:profiles!requests_assigned_to_fkey(id, full_name, email, avatar_url),
      approver:profiles!requests_approved_by_fkey(id, full_name, email, avatar_url),
      facility:facilities(id, name, city)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Tenant / Company Isolation
  if (profile.role !== 'super_admin') {
    if (profile.company_id) {
      query = query.eq('company_id', profile.company_id);
    }
    // Facility-level isolation for lower roles
    if (!['company_admin'].includes(profile.role) && profile.facility_id) {
      query = query.eq('facility_id', profile.facility_id);
    }
    if (profile.role === 'employee') {
      query = query.eq('created_by', user.id);
    }
  } else {
    // Super admin can optionally filter by company or facility
    const effectiveCompanyId = paramCompanyId || profile.company_id;
    if (effectiveCompanyId) {
      query = query.eq('company_id', effectiveCompanyId);
    }
    if (paramFacilityId && paramFacilityId !== 'all') {
      query = query.eq('facility_id', paramFacilityId);
    }
  }

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (priority) query = query.eq('priority', priority);
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,request_number.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, totalPages: Math.ceil((count || 0) / limit) });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 });

  const body = await request.json();
  const { title, description, category, priority, assigned_to, attachment_urls, facility_id, company_id } = body;

  if (!description || !category) {
    return NextResponse.json({ error: 'Lütfen açıklama ve kategori alanlarını doldurunuz.' }, { status: 400 });
  }

  // Otomatik başlık üretimi (kullanıcıdan başlık istenmediği durumlarda)
  const categoryLabels: Record<string, string> = {
    yemekhane: 'Yemekhane',
    servis: 'Servis',
    temizlik: 'Temizlik',
    filo: 'Filo',
    varlik: 'Varlık',
    teknik: 'Teknik',
    diger: 'Diğer',
  };
  const catLabel = categoryLabels[category] || category;
  const descSnippet = description.trim().split('\n')[0].slice(0, 60);
  const effectiveTitle = title?.trim() || `${catLabel} - ${descSnippet}`;

  // Determine target facility and company
  let targetFacilityId = facility_id || profile.facility_id;
  let targetCompanyId = company_id || profile.company_id;

  // If facility is given, ensure we get its company
  if (targetFacilityId && !targetCompanyId) {
    const { data: fac } = await supabase
      .from('facilities')
      .select('id, company_id')
      .eq('id', targetFacilityId)
      .maybeSingle();

    if (fac) {
      targetCompanyId = fac.company_id;
    }
  }

  // If super_admin or user without facility_id, find default facility
  if (!targetFacilityId) {
    let facQuery = supabase.from('facilities').select('id, company_id').eq('is_active', true);
    if (targetCompanyId) facQuery = facQuery.eq('company_id', targetCompanyId);
    const { data: defaultFac } = await facQuery.limit(1).maybeSingle();

    if (defaultFac) {
      targetFacilityId = defaultFac.id;
      if (!targetCompanyId) targetCompanyId = defaultFac.company_id;
    }
  }

  if (!targetFacilityId || !targetCompanyId) {
    return NextResponse.json({
      error: 'Talep için tesis veya şirket bilgisi belirlenemedi. Lütfen bir lokasyon seçiniz.'
    }, { status: 400 });
  }

  // Generate request number: REQ-YYYY-00001 per company
  const year = new Date().getFullYear();
  const { data: lastReq } = await supabase
    .from('requests')
    .select('request_number')
    .eq('company_id', targetCompanyId)
    .like('request_number', `REQ-${year}-%`)
    .order('request_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = 1;
  if (lastReq?.request_number) {
    const parts = lastReq.request_number.split('-');
    nextSeq = (parseInt(parts[2] || '0') || 0) + 1;
  }
  const request_number = `REQ-${year}-${String(nextSeq).padStart(5, '0')}`;

  const { data: newReq, error } = await supabase
    .from('requests')
    .insert({
      company_id: targetCompanyId,
      facility_id: targetFacilityId,
      request_number,
      title: effectiveTitle,
      description: description.trim(),
      category,
      priority: priority || 'orta',
      status: 'yeni',
      assigned_to: null,
      attachment_urls: cleanUrlList(attachment_urls),
      created_by: user.id,
    })
    .select(`
      *,
      facility:facilities(id, name, city)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to request_history
  await supabase.from('request_history').insert({
    request_id: newReq.id,
    new_status: 'yeni',
    changed_by: user.id,
    note: 'Talep oluşturuldu (T1: Açılış)',
    attachment_urls: cleanUrlList(attachment_urls),
  });

  // Tesis Yetkililerini Bul ve Bilgilendir (Tesis Müdürü, Tesis Sorumlusu, Şirket Yöneticisi)
  try {
    const { data: authorities } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('company_id', targetCompanyId)
      .eq('is_active', true)
      .in('role', ['company_admin', 'facility_manager', 'facility_officer'])
      .or(`facility_id.eq.${targetFacilityId},facility_id.is.null,role.eq.company_admin`);

    if (authorities && authorities.length > 0) {
      const facilityName = (newReq.facility as { name?: string })?.name || 'Tesis';
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';
      const actionUrl = `${baseUrl}/dashboard/requests/${newReq.id}`;

      // 1. Sistem İçi Bildirimler (In-app Notifications)
      const notifRows = authorities.map((auth) => ({
        company_id: targetCompanyId,
        user_id: auth.id,
        title: 'Yeni Talep Havuzda (Karşılama Bekliyor)',
        message: `${facilityName} tesisinde yeni bir talep (${newReq.request_number}) açıldı. Lütfen üzerinize alınız.`,
        type: 'bildirim' as const,
        related_type: 'request',
        related_id: newReq.id,
      }));
      await supabase.from('notifications').insert(notifRows);

      // 2. E-posta Bildirimleri (Resend Email)
      await Promise.allSettled(
        authorities
          .filter((auth) => auth.email && auth.id !== user.id)
          .map((auth) =>
            sendRequestNotificationEmail({
              to: auth.email,
              recipientName: auth.full_name,
              requestNumber: newReq.request_number,
              title: newReq.title,
              status: 'yeni',
              category: newReq.category,
              facilityName,
              actionUrl,
              changerName: profile.full_name || 'Kullanıcı',
              note: 'Talep havuza düştü, lütfen üzerinize alınız.',
            })
          )
      );
    }
  } catch (notifErr) {
    console.error('Yetkililere bildirim gönderilirken hata:', notifErr);
  }

  return NextResponse.json({ data: newReq }, { status: 201 });
}
