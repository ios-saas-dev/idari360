import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendOtpEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, phone, password } = body;

    if (!fullName || !fullName.trim()) {
      return NextResponse.json(
        { success: false, message: 'Ad ve soyad alanı zorunludur.' },
        { status: 400 }
      );
    }

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Geçerli bir e-posta adresi giriniz.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, message: 'Şifreniz en az 8 karakter olmalıdır.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const domain = cleanEmail.split('@')[1];
    const supabaseAdmin = createAdminClient();

    // 1. Domain ve Şirket Kontrolü (Seçenek B: Kayıtsız Şirketleri Engelleme)
    const isSuperAdmin = cleanEmail === 'murat.krgzz35@gmail.com';
    if (!isSuperAdmin) {
      const { data: matchedDomain, error: domainErr } = await supabaseAdmin
        .from('email_domains')
        .select('company_id, company:companies(name, is_active)')
        .eq('domain', domain)
        .maybeSingle();

      const companyData = Array.isArray(matchedDomain?.company)
        ? matchedDomain?.company[0]
        : matchedDomain?.company;

      if (domainErr || !matchedDomain || !companyData || !companyData.is_active) {
        return NextResponse.json(
          {
            success: false,
            message: `Şirketiniz (@${domain}) henüz sistemde tanımlı veya aktif değildir. Lütfen şirket yöneticiniz ile iletişime geçiniz.`,
          },
          { status: 400 }
        );
      }
    }

    // 2. Kullanıcı mevcut mu kontrolü (auth.users tablosu)
    const { data: existingUserList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUserList?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );

    let userId: string;

    if (existingUser) {
      // Eğer kullanıcı daha önce onaylanmışsa tekrar kayıt olamaz, giriş yapmalıdır
      if (existingUser.email_confirmed_at) {
        return NextResponse.json(
          {
            success: false,
            alreadyRegistered: true,
            message: 'Bu e-posta adresi ile zaten kayıtlı bir hesap bulunmaktadır. Lütfen giriş yapınız.',
          },
          { status: 409 }
        );
      }

      // Henüz onaylanmamış kullanıcı: Şifresini ve meta verisini güncelle
      userId = existingUser.id;
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          full_name: fullName.trim(),
          phone: phone ? phone.trim() : null,
        },
      });

      if (updateErr) {
        return NextResponse.json(
          { success: false, message: updateErr.message },
          { status: 500 }
        );
      }
    } else {
      // Yeni kullanıcı oluşturma (admin.createUser, Supabase'in varsayılan onay linki e-postasını GÖNDERMEZ!)
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: false,
        user_metadata: {
          full_name: fullName.trim(),
          phone: phone ? phone.trim() : null,
        },
      });

      if (createErr || !created?.user) {
        return NextResponse.json(
          { success: false, message: createErr?.message || 'Kullanıcı hesabı oluşturulamadı.' },
          { status: 500 }
        );
      }

      userId = created.user.id;
    }

    // 3. Güvenli 6 haneli OTP kodu üretimi (DB'deki generate_otp_code stored procedure)
    const { data: otpData, error: otpErr } = await supabaseAdmin.rpc('generate_otp_code', {
      p_email: cleanEmail,
      p_purpose: 'email_verification',
      p_expiry_minutes: 10,
    });

    if (otpErr || !otpData?.success) {
      console.error('[auth/register] OTP generation error:', otpErr || otpData);
      return NextResponse.json(
        { success: false, message: otpData?.message || 'Doğrulama kodu oluşturulamadı.' },
        { status: 500 }
      );
    }

    const rawCode = otpData.code;

    // 4. Resend ile kurumsal 6 haneli OTP e-postası gönderimi (bildirim@idari360.com)
    const emailResult = await sendOtpEmail({
      to: cleanEmail,
      code: rawCode,
      purpose: 'email_verification',
    });

    console.log(
      `[auth/register] OTP sent to ${cleanEmail} via ${emailResult.provider} (Success: ${emailResult.success})`
    );

    if (!emailResult.success) {
      console.warn('[auth/register] Resend email failed:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Hesabınız oluşturuldu. 6 haneli güvenlik doğrulama kodu e-posta adresinize gönderildi.',
      email: cleanEmail,
      userId,
    });
  } catch (error: any) {
    console.error('[auth/register] Unexpected error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Beklenmeyen bir sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
