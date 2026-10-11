import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';

// 1. Kullanıcıları Listele (GET)
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    // Çağıranın profilini ve rolünü al
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['super_admin', 'company_admin', 'facility_manager'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Bu alana erişim yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from('profiles')
      .select('id, email, full_name, role, is_active, facility_id, company_id, last_login_at, created_at, companies(name), facilities(name)')
      .order('created_at', { ascending: false });

    // Şirket yöneticisi sadece kendi şirketini görür
    if (callerProfile.role === 'company_admin') {
      query = query.eq('company_id', callerProfile.company_id);
    } else if (callerProfile.role === 'facility_manager') {
      query = query.eq('company_id', callerProfile.company_id);
    }

    const { data: users, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users, callerRole: callerProfile.role });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Sunucu hatası oluştu.' }, { status: 500 });
  }
}

// 2. Kullanıcı Rolü, Tesisi veya Durumunu Güncelle (PATCH)
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const { targetUserId, newRole, newFacilityId, isActive } = await request.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'Hedef kullanıcı ID belirtilmelidir.' }, { status: 400 });
    }

    // Çağıranın profilini kontrol et
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['super_admin', 'company_admin', 'facility_manager'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Yönetici yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    // Kendi rolünü değiştiremez
    if (targetUserId === callerProfile.id && newRole && newRole !== callerProfile.role) {
      return NextResponse.json({ error: 'Kendi rolünüzü değiştiremezsiniz.' }, { status: 400 });
    }

    // Hedef kullanıcının profilini al
    const adminClient = createAdminClient();
    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('id, role, company_id, facility_id')
      .eq('id', targetUserId)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 });
    }

    // Firma izolasyonu kontrolü
    if (callerProfile.role !== 'super_admin' && callerProfile.company_id !== targetProfile.company_id) {
      return NextResponse.json({ error: 'Farklı bir şirketin kullanıcısını yönetemezsiniz.' }, { status: 403 });
    }

    // Rol hiyerarşisi kontrolü (caller rolü hedef rolden yüksek olmalı)
    const roleRanks: Record<string, number> = {
      super_admin: 100,
      company_admin: 80,
      facility_manager: 60,
      facility_officer: 40,
      employee: 20,
    };

    if (newRole) {
      if (callerProfile.role !== 'super_admin' && roleRanks[newRole] >= roleRanks[callerProfile.role]) {
        return NextResponse.json({
          error: `Kendi rol seviyenize eşit veya üstünde bir rol (${newRole}) atayamazsınız.`
        }, { status: 403 });
      }

      if (callerProfile.role !== 'super_admin' && roleRanks[targetProfile.role] >= roleRanks[callerProfile.role]) {
        return NextResponse.json({
          error: 'Kendi rol seviyenize eşit veya üstündeki bir kullanıcının yetkilerini değiştiremezsiniz.'
        }, { status: 403 });
      }
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (newRole) updates.role = newRole;
    if (newFacilityId !== undefined) updates.facility_id = newFacilityId;
    if (isActive !== undefined) updates.is_active = isActive;

    const { error: updateError } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', targetUserId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Activity log
    await adminClient.from('activity_logs').insert({
      company_id: targetProfile.company_id,
      user_id: callerProfile.id,
      action: 'ADMIN_USER_UPDATE',
      entity_type: 'profiles',
      entity_id: targetUserId,
      details: { updates, target_user: targetUserId, caller_role: callerProfile.role },
    });

    return NextResponse.json({ success: true, message: 'Kullanıcı başarıyla güncellendi.' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'İşlem başarısız oldu.' }, { status: 500 });
  }
}
