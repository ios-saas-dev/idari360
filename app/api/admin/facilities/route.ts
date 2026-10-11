import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['super_admin', 'company_admin', 'facility_manager'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from('facilities')
      .select('*, companies(name)')
      .order('created_at', { ascending: false });

    if (callerProfile.role !== 'super_admin') {
      query = query.eq('company_id', callerProfile.company_id);
    }

    const { data: facilities, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ facilities });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Hata oluştu.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['super_admin', 'company_admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Tesis tanımlama yetkisi sadece şirket yöneticilerine aittir.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, city, region, address, companyId } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Tesis adı ve kodu zorunludur.' }, { status: 400 });
    }

    const targetCompanyId = callerProfile.role === 'super_admin' && companyId ? companyId : callerProfile.company_id;

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Bağlı şirket bulunamadı.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: newFacility, error } = await adminClient
      .from('facilities')
      .insert({
        company_id: targetCompanyId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city || 'İstanbul',
        region: region || 'Marmara',
        address: address || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, facility: newFacility });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Hata oluştu.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['super_admin', 'company_admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Tesis güncelleme yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    const { facilityId, isActive } = await request.json();

    const adminClient = createAdminClient();
    let query = adminClient
      .from('facilities')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', facilityId);

    if (callerProfile.role !== 'super_admin') {
      query = query.eq('company_id', callerProfile.company_id);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Tesis durumu güncellendi.' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Hata oluştu.' }, { status: 500 });
  }
}
