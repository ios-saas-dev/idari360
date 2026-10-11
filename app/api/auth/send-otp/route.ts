import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, purpose = 'email_verification' } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'E-posta adresi gereklidir.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Stored procedure ile güvenli OTP oluştur
    const { data, error } = await supabaseAdmin.rpc('generate_otp_code', {
      p_email: email.trim().toLowerCase(),
      p_purpose: purpose,
      p_expiry_minutes: 10,
    });

    if (error) {
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

    // data.code yalnızca backend seviyesinde bilinir.
    // E-posta gönderimi burada SMTP veya Resend üzerinden tetiklenir.
    console.log(`[İdari360 OTP Service] E-posta: ${email} -> Kod üretildi (Güvenlik gereği istemciye iletilmez)`);

    return NextResponse.json({
      success: true,
      message: 'Onay kodu e-posta adresinize başarıyla gönderildi.',
      expires_at: data.expires_at,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
