import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendPasswordResetEmail } from '@/lib/email';

/**
 * Şifre sıfırlama talebi — Özel Resend kanalı (Supabase native e-posta yerine)
 *
 * Akış:
 *  1) Rate limit  : 10 dakikada maksimum 3 talep / e-posta (DB stored procedure)
 *  2) Token üretim: Supabase admin generateLink(type=recovery) → hashed_token
 *  3) E-posta     : Markalı idari360 şablonu Resend üzerinden gönderilir (SMTP yedekli)
 *
 * Güvenlik: Kayıtlı olmayan e-postalar için de genel başarı mesajı döner
 * (hesap varlığı bilgisi sızdırılmaz).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Geçerli bir e-posta adresi giriniz.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseAdmin = createAdminClient();

    // 1. Rate limit kontrolü (10 dakikada maksimum 3 talep / e-posta)
    const { data: rateRes } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: cleanEmail,
      p_action: 'password_reset_request',
      p_max_requests: 3,
      p_window_seconds: 600,
    });

    if (rateRes && rateRes.allowed === false) {
      return NextResponse.json(
        {
          success: false,
          message: `Çok sık şifre sıfırlama talebinde bulundunuz. Lütfen ${rateRes.retry_after_seconds} saniye sonra tekrar deneyin.`,
          retry_after_seconds: rateRes.retry_after_seconds,
        },
        { status: 429 }
      );
    }

    // 2. Güvenli recovery token üretimi (bu adım e-posta göndermez, yalnızca link üretir)
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      // Kullanıcı bulunamadıysa hesap varlığını sızdırma: genel mesaj dön
      console.warn('[forgot-password] Link üretilemedi:', linkErr?.message || 'hashed_token yok');
      return NextResponse.json({
        success: true,
        message: 'Eğer bu e-posta adresi sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderilmiştir.',
        emailSent: false,
      });
    }

    // 3. Markalı e-posta gönderimi — token_hash doğrudan uygulama sayfasına gömülür
    // (Supabase dashboard redirect allow-list bağımlılığı olmadan çalışır)
    const origin = request.headers.get('origin') || new URL(request.url).origin;
    const resetUrl = `${origin}/auth/reset-password?token_hash=${linkData.properties.hashed_token}&type=recovery`;

    const emailResult = await sendPasswordResetEmail({
      to: cleanEmail,
      resetUrl,
    });

    console.log(
      `[forgot-password] E-posta: ${cleanEmail} -> Gönderim: ${emailResult.provider} (Başarı: ${emailResult.success})`
    );

    if (!emailResult.success) {
      console.warn('[forgot-password] E-posta gönderilemedi:', emailResult.error);
      return NextResponse.json(
        {
          success: false,
          message: 'Şifre sıfırlama e-postası gönderilemedi. Lütfen kısa süre sonra tekrar deneyin.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderilmiştir.',
      emailSent: true,
    });
  } catch (err: any) {
    console.error('[forgot-password] Server error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
