import nodemailer from 'nodemailer';

interface SendOtpOptions {
  to: string;
  code: string;
  purpose?: string;
}

export async function sendOtpEmail({ to, code, purpose = 'email_verification' }: SendOtpOptions): Promise<{
  success: boolean;
  provider: string;
  message?: string;
  error?: string;
}> {
  const subject = purpose === 'password_reset'
    ? `İdari360 — Şifre Sıfırlama Kodunuz: ${code}`
    : `İdari360 — Güvenlik Onay Kodunuz: ${code}`;

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 16px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 36px 28px; box-shadow: 0 4px 16px rgba(15, 28, 46, 0.06); border: 1px solid #e2e8f0;">
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="display: inline-block; background: #0f1c2e; padding: 10px 18px; border-radius: 10px;">
        <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">İdari</span><span style="color: #38bdf8; font-size: 20px; font-weight: 800;">360</span>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-top: 8px; margin-bottom: 0;">Akıllı İdari İşlemler Yönetim Platformu</p>
    </div>

    <div style="margin-bottom: 24px;">
      <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">Doğrulama Kodunuz</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
        İdari360 hesabınız için talep edilen 6 haneli tek kullanımlık güvenlik kodunuz aşağıdadır:
      </p>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <div style="display: inline-block; background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; padding: 16px 32px;">
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; font-family: monospace;">
          ${code}
        </span>
      </div>
    </div>

    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
      <p style="color: #92400e; font-size: 12.5px; line-height: 1.5; margin: 0;">
        ⚠️ Bu kod <strong>10 dakika</strong> süreyle geçerlidir. Hesabınızın güvenliği için bu kodu kimseyle paylaşmayınız.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 11.5px; text-align: center; line-height: 1.5; margin: 0;">
      Bu işlemi siz başlatmadıysanız lütfen bu iletiyi dikkate almayınız.<br>
      © 2026 İdari360. Tüm hakları saklıdır.
    </p>
  </div>
</body>
</html>
  `.trim();

  // 1. Resend API kontrolü (Varsa doğrudan HTTP ile gönder)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || 'İdari360 <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Resend API error');
      }

      console.log(`[Email Service: Resend] E-posta başarıyla iletildi: ${to}`);
      return { success: true, provider: 'resend', message: 'E-posta Resend ile iletildi.' };
    } catch (err: any) {
      console.error('[Email Service: Resend Error]', err);
      // SMTP yoksa doğrudan Resend hata mesajını dön
      if (!process.env.SMTP_HOST) {
        return {
          success: false,
          provider: 'resend',
          error: err?.message,
          message: err?.message || 'Resend üzerinden e-posta gönderilemedi.',
        };
      }
    }
  }

  // 2. Özel SMTP Kontrolü (Nodemailer)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const fromAddress = process.env.EMAIL_FROM || `"İdari360 Güvenlik" <${smtpUser}>`;

      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });

      console.log(`[Email Service: SMTP] E-posta başarıyla iletildi: ${to}`);
      return { success: true, provider: 'smtp', message: 'E-posta SMTP ile iletildi.' };
    } catch (err: any) {
      console.error('[Email Service: SMTP Error]', err);
      return { success: false, provider: 'smtp', error: err?.message };
    }
  }

  // 3. Sağlayıcı bulunamadı (Yerel / Test ortamı fallback)
  console.warn(`[Email Service] SMTP veya Resend yapılandırılmamış. Kod: ${code} (Alıcı: ${to})`);
  return {
    success: false,
    provider: 'none',
    message: 'SMTP veya Resend ortam değişkenleri tanımlı değil.',
  };
}
