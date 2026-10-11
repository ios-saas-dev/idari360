import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { registered: false, message: 'Geçerli bir e-posta adresi gereklidir.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const domain = cleanEmail.split('@')[1];

    if (!domain) {
      return NextResponse.json(
        { registered: false, message: 'Geçersiz e-posta formatı.' },
        { status: 400 }
      );
    }

    // Süper admin istisnası
    if (cleanEmail === 'murat.krgzz35@gmail.com') {
      return NextResponse.json({
        registered: true,
        isSuperAdmin: true,
        companyName: 'İdari360 Platform Yönetimi',
      });
    }

    // Genel posta servisleri kontrolü (gmail, hotmail vb.)
    const publicDomains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'yandex.com', 'mail.com'];
    if (publicDomains.includes(domain)) {
      return NextResponse.json({
        registered: false,
        isPublicDomain: true,
        message: 'Bireysel e-posta adresleri ile kayıt olunamaz. Lütfen kurumsal şirket e-postanızı kullanın.',
      });
    }

    const supabaseAdmin = createAdminClient();

    const { data: matchedDomain, error } = await supabaseAdmin
      .from('email_domains')
      .select('company_id, companies!inner(id, name, is_active)')
      .eq('domain', domain)
      .eq('companies.is_active', true)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { registered: false, message: error.message },
        { status: 500 }
      );
    }

    if (!matchedDomain) {
      return NextResponse.json({
        registered: false,
        domain,
        message: `Şirketiniz (@${domain}) henüz sistemde tanımlı veya aktif değildir. Lütfen şirket yöneticiniz veya platform desteği ile iletişime geçiniz.`,
      });
    }

    const company = (matchedDomain as any).companies;

    return NextResponse.json({
      registered: true,
      domain,
      companyName: company?.name || 'Kayıtlı Şirket',
    });
  } catch (err: any) {
    return NextResponse.json(
      { registered: false, message: err?.message || 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
