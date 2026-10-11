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

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const supabaseAdmin = createAdminClient();

    let verified = false;

    // 1. verify_otp_code stored procedure ile doğrula (SHA-256 hash kontrolü)
    const { data, error } = await supabaseAdmin.rpc('verify_otp_code', {
      p_email: cleanEmail,
      p_code: cleanCode,
      p_purpose: purpose,
    });

    if (!error && data?.success) {
      verified = true;
    }

    // 2. Özel kod eşleşmediyse Supabase Auth native OTP doğrulamayı dene (Yedek kanal)
    if (!verified && purpose === 'email_verification') {
      try {
        const { data: sbData, error: sbErr } = await supabaseAdmin.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'signup',
        });

        if (!sbErr && sbData?.user) {
          verified = true;
        }
      } catch (e) {
        // İkinci doğrulama hatası
      }
    }

    if (!verified) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || 'Onay kodu geçersiz veya süresi dolmuş.',
          remaining_attempts: data?.remaining_attempts,
        },
        { status: 400 }
      );
    }

    // 3. Kullanıcıyı sistemde 'email_verified = true' olarak onayla
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (profile?.id) {
      await supabaseAdmin
        .from('profiles')
        .update({ email_verified: true, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      // Supabase Auth seviyesinde de e-postayı onayla
      try {
        await supabaseAdmin.auth.admin.updateUserById(profile.id, {
          email_confirm: true,
        });
      } catch (authErr) {
        console.warn('[verify-otp] Could not update auth.users email_confirm:', authErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'E-posta adresiniz başarıyla doğrulandı.',
    });
  } catch (err: any) {
    console.error('[verify-otp] Server error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
