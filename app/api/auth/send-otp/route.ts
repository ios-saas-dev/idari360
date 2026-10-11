import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendOtpEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email, purpose = 'email_verification' } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'E-posta adresi gereklidir.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseAdmin = createAdminClient();

    // 1. Stored procedure ile güvenli OTP oluştur (DB rate-limit ve hash korumalı)
    const { data, error } = await supabaseAdmin.rpc('generate_otp_code', {
      p_email: cleanEmail,
      p_purpose: purpose,
      p_expiry_minutes: 10,
    });

    if (error) {
      console.error('[send-otp] RPC error:', error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || 'Kod oluşturulamadı.',
          retry_after_seconds: data?.retry_after_seconds,
        },
        { status: 429 }
      );
    }

    const rawCode = data.code;

    // 2. E-posta Gönderimi (Resend veya SMTP)
    const emailResult = await sendOtpEmail({
      to: cleanEmail,
      code: rawCode,
      purpose,
    });

    // 3. Supabase Auth native yedek kanal: Yalnızca e-posta servisi (Resend/SMTP) tanımlı DEĞİLSE
    // ve kesinlikle sihirli link olmadan yönlendirme
    if (!emailResult.success && purpose === 'email_verification') {
      try {
        await supabaseAdmin.auth.resend({
          type: 'signup',
          email: cleanEmail,
        });
      } catch (sbErr) {
        // Sessiz hata
      }
    }

    console.log(`[İdari360 OTP Service] E-posta: ${cleanEmail} -> Gönderim: ${emailResult.provider} (Başarı: ${emailResult.success})`);

    // Geliştirme / Test kolaylığı için: SMTP yapılandırılmamışsa bildirimde dev_code desteği
    const isDevOrTest = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true';

    return NextResponse.json({
      success: true,
      message: 'Onay kodu e-posta adresinize gönderildi.',
      provider: emailResult.provider,
      expires_at: data.expires_at,
      ...(isDevOrTest && !emailResult.success ? { dev_code: rawCode } : {}),
    });
  } catch (err: any) {
    console.error('[send-otp] Server error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
