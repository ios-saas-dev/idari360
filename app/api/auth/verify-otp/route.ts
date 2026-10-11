import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, code, purpose = 'email_verification' } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: 'E-posta ve onay kodu gereklidir.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // verify_otp_code stored procedure ile doğrula
    const { data, error } = await supabaseAdmin.rpc('verify_otp_code', {
      p_email: email.trim().toLowerCase(),
      p_code: code.trim(),
      p_purpose: purpose,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, message: data?.message || 'Kod doğrulanamadı.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: data.message || 'Onay kodu başarıyla doğrulandı.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
