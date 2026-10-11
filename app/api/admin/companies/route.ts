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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Bu alana sadece Süper Admin erişebilir.' }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { data: companies, error } = await adminClient
      .from('companies')
      .select('*, email_domains(*), facilities(count), profiles(count)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ companies });
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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Şirket tanımlama yetkisi yalnızca Süper Admin rolüne aittir.' }, { status: 403 });
    }

    const { name, slug, domain, subscriptionPlan = 'enterprise' } = await request.json();

    if (!name || !domain) {
      return NextResponse.json({ error: 'Şirket adı ve kurumsal e-posta domaini zorunludur.' }, { status: 400 });
    }

    const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).replace(/-+/g, '-');
    const cleanDomain = domain.trim().toLowerCase().replace(/^@/, '');

    const adminClient = createAdminClient();

    // 1. Şirketi oluştur
    const { data: company, error: compError } = await adminClient
      .from('companies')
      .insert({
        name: name.trim(),
        slug: cleanSlug,
        email_domain: cleanDomain,
        subscription_plan: subscriptionPlan,
        is_active: true,
      })
      .select()
      .single();

    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 500 });
    }

    // 2. Domain eşleştirme tablosuna ekle
    await adminClient.from('email_domains').insert({
      company_id: company.id,
      domain: cleanDomain,
      is_primary: true,
    });

    // 3. Şirkete varsayılan bir merkez tesis ekle
    await adminClient.from('facilities').insert({
      company_id: company.id,
      name: `${name.trim()} Genel Merkez`,
      code: 'HQ-01',
      city: 'İstanbul',
      region: 'Marmara',
      is_active: true,
    });

    return NextResponse.json({ success: true, company });
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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Şirket durumunu yalnızca Süper Admin değiştirebilir.' }, { status: 403 });
    }

    const { companyId, isActive } = await request.json();

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('companies')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', companyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Şirket durumu ${isActive ? 'Aktif' : 'Pasif'} yapıldı.` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Hata oluştu.' }, { status: 500 });
  }
}
