import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Resend client initialization
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

interface BaseEmailResponse {
  success: boolean;
  provider: 'resend' | 'smtp' | 'none';
  messageId?: string;
  message?: string;
  error?: string;
}

/**
 * Core unified email dispatcher
 * Prioritizes Resend API, with SMTP fallback
 */
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<BaseEmailResponse> {
  const recipientList = Array.isArray(to) ? to : [to];
  const fromEmail = process.env.EMAIL_FROM || 'İdari360 <bildirim@idari360.com>';

  // 1. Primary: Resend API
  const resend = getResendClient();
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipientList,
        subject,
        html,
      });

      if (error) {
        console.error('[Resend Error]', error);
        throw new Error(error.message || 'Resend gönderim hatası');
      }

      console.log(`[Resend Success] Email sent to: ${recipientList.join(', ')} (ID: ${data?.id})`);
      return {
        success: true,
        provider: 'resend',
        messageId: data?.id,
        message: 'E-posta Resend ile başarıyla gönderildi.',
      };
    } catch (err: any) {
      console.warn('[Resend Exception, trying SMTP fallback if available]', err?.message);
      if (!process.env.SMTP_HOST) {
        return {
          success: false,
          provider: 'resend',
          error: err?.message,
          message: err?.message || 'Resend ile e-posta gönderilemedi.',
        };
      }
    }
  }

  // 2. Secondary: SMTP Fallback (Nodemailer)
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

      const info = await transporter.sendMail({
        from: fromEmail,
        to: recipientList,
        subject,
        html,
      });

      console.log(`[SMTP Success] Email sent to: ${recipientList.join(', ')} (ID: ${info.messageId})`);
      return {
        success: true,
        provider: 'smtp',
        messageId: info.messageId,
        message: 'E-posta SMTP ile başarıyla iletildi.',
      };
    } catch (err: any) {
      console.error('[SMTP Exception]', err);
      return {
        success: false,
        provider: 'smtp',
        error: err?.message,
        message: err?.message || 'SMTP ile e-posta gönderilemedi.',
      };
    }
  }

  // 3. Fallback: No credentials
  console.warn(`[Email Service] Gönderim sağlayıcısı yapılandırılmamış. Alıcı: ${recipientList.join(', ')}`);
  return {
    success: false,
    provider: 'none',
    message: 'Resend API anahtarı veya SMTP yapılandırılmamış.',
  };
}

/**
 * Ortak kurumsal e-posta şablon iskeleti
 */
function renderBaseTemplate({
  headerTitle,
  contentHtml,
  badgeText,
  badgeColor = '#3b82f6',
}: {
  headerTitle: string;
  contentHtml: string;
  badgeText?: string;
  badgeColor?: string;
}) {
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 28, 46, 0.06); border: 1px solid #e2e8f0;">
    <!-- Logo & Header -->
    <div style="background: #0f1c2e; padding: 28px 24px; text-align: center;">
      <div style="display: inline-block;">
        <span style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">İdari</span><span style="color: #38bdf8; font-size: 24px; font-weight: 800;">360</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0; font-weight: 500;">Akıllı İdari İşlemler Yönetim Platformu</p>
    </div>

    <!-- Body Container -->
    <div style="padding: 32px 28px;">
      ${badgeText ? `
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; background-color: ${badgeColor}15; color: ${badgeColor}; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; border: 1px solid ${badgeColor}30;">
          ${badgeText}
        </span>
      </div>` : ''}

      ${contentHtml}

      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
          Bu bilgilendirme mesajı İdari360 sisteminiz tarafından otomatik olarak oluşturulmuştur.<br>
          © ${new Date().getFullYear()} İdari360 Platformu. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/* ============================================================================
   1. KULLANICI KAYDI & GİRİŞ: OTP DOĞRULAMA E-POSTASI
============================================================================ */
export async function sendOtpEmail({
  to,
  code,
  purpose = 'email_verification',
}: {
  to: string;
  code: string;
  purpose?: string;
}): Promise<BaseEmailResponse> {
  const isReset = purpose === 'password_reset';
  const subject = isReset
    ? `İdari360 — Şifre Sıfırlama Kodunuz: ${code}`
    : `İdari360 — Güvenlik Doğrulama Kodunuz: ${code}`;

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 10px 0;">
      ${isReset ? 'Şifre Sıfırlama Talebi' : 'E-posta Doğrulama Kodu'}
    </h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
      ${isReset
        ? 'İdari360 hesabınızın şifresini yenilemek için aşağıdaki tek kullanımlık güvenlik kodunu kullanınız:'
        : 'İdari360 hesabınızı aktive etmek veya girişinizi onaylamak için 6 haneli güvenlik kodunuz:'
      }
    </p>

    <!-- OTP Code Box -->
    <div style="text-align: center; margin: 28px 0;">
      <div style="display: inline-block; background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; padding: 18px 36px;">
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #1d4ed8; font-family: monospace;">
          ${code}
        </span>
      </div>
    </div>

    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px;">
      <p style="color: #92400e; font-size: 12.5px; line-height: 1.5; margin: 0;">
        ⚠️ Bu kod <strong>10 dakika</strong> süreyle geçerlidir. Güvenliğiniz için bu kodu kimseyle paylaşmayınız.
      </p>
    </div>
  `;

  const html = renderBaseTemplate({
    headerTitle: subject,
    badgeText: isReset ? 'ŞİFRE GÜNCELLEME' : 'GÜVENLİK ONAYI',
    badgeColor: isReset ? '#f59e0b' : '#2563eb',
    contentHtml,
  });

  return sendEmail({ to, subject, html });
}

/* ============================================================================
   2. ŞİFRE SIFIRLAMA BAĞLANTISI / BİLDİRİMİ
============================================================================ */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
  code,
}: {
  to: string;
  resetUrl?: string;
  code?: string;
}): Promise<BaseEmailResponse> {
  const subject = 'İdari360 — Şifre Sıfırlama Bağlantısı';

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 10px 0;">Yeni Şifre Belirleme</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      İdari360 hesabınız için şifre sıfırlama talebinde bulunuldu. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz:
    </p>

    ${resetUrl ? `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 28px; border-radius: 10px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);">
        Şifremi Sıfırla
      </a>
    </div>` : ''}

    ${code ? `
    <p style="color: #64748b; font-size: 13px; text-align: center;">
      Doğrulama Kodunuz: <strong style="color: #1e293b; font-family: monospace; font-size: 16px;">${code}</strong>
    </p>` : ''}

    <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-top: 20px;">
      Bu talebi siz yapmadıysanız hesabınız güvendedir, lütfen bu e-postayı dikkate almayınız.
    </p>
  `;

  const html = renderBaseTemplate({
    headerTitle: subject,
    badgeText: 'ŞİFRE SIFIRLAMA',
    badgeColor: '#f59e0b',
    contentHtml,
  });

  return sendEmail({ to, subject, html });
}

/* ============================================================================
   3. TALEP DURUM BİLDİRİMLERİ (Yeni, Üzerime Alındı, Çözüldü, Reddedildi)
============================================================================ */
export async function sendRequestNotificationEmail({
  to,
  recipientName,
  requestNumber,
  title,
  status,
  category,
  facilityName,
  actionUrl,
  note,
  changerName,
}: {
  to: string;
  recipientName?: string;
  requestNumber: string;
  title: string;
  status: 'yeni' | 'islemde' | 'cozumlendi' | 'reddedildi' | string;
  category?: string;
  facilityName?: string;
  actionUrl?: string;
  note?: string;
  changerName?: string;
}): Promise<BaseEmailResponse> {
  const STATUS_CONFIG: Record<string, { label: string; color: string; badge: string; desc: string }> = {
    yeni: {
      label: 'Yeni Talep Oluşturuldu',
      color: '#2563eb',
      badge: 'YENİ TALEP',
      desc: 'Tesisiniz için yeni bir talep kaydı açılmıştır.',
    },
    islemde: {
      label: 'Talep İşleme Alındı',
      color: '#d97706',
      badge: 'İŞLEMDE (T2)',
      desc: `${changerName ? changerName + ' isimli tesis sorumlusu' : 'Tesis sorumlusu'} talebinizi işleme aldı.`,
    },
    cozumlendi: {
      label: 'Talep Çözümlendi Olarak Kapatıldı',
      color: '#16a34a',
      badge: 'ÇÖZÜMLENDİ (T3)',
      desc: 'Talebiniz başarıyla çözümlenmiş ve kapatılmıştır.',
    },
    reddedildi: {
      label: 'Talep Reddedildi',
      color: '#dc2626',
      badge: 'REDDEDİLDİ (T3)',
      desc: 'Talebiniz incelenmiş ve reddedilmiştir.',
    },
  };

  const currentCfg = STATUS_CONFIG[status] || {
    label: 'Talep Güncellendi',
    color: '#64748b',
    badge: 'GÜNCELLEME',
    desc: 'Talebinizin durumunda değişiklik yapıldı.',
  };

  const subject = `[${requestNumber}] ${currentCfg.label}: ${title}`;

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 19px; font-weight: 700; margin: 0 0 8px 0;">
      ${recipientName ? `Merhaba ${recipientName},` : 'Merhaba,'}
    </h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      ${currentCfg.desc}
    </p>

    <!-- Request Details Table -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="color: #64748b; padding: 6px 0; width: 130px;">Talep No:</td>
          <td style="color: #0f172a; font-weight: 700; font-family: monospace;">${requestNumber}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Başlık:</td>
          <td style="color: #0f172a; font-weight: 600;">${title}</td>
        </tr>
        ${category ? `
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Kategori:</td>
          <td style="color: #334155;">${category.toUpperCase()}</td>
        </tr>` : ''}
        ${facilityName ? `
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Tesis / Lokasyon:</td>
          <td style="color: #334155;">${facilityName}</td>
        </tr>` : ''}
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Güncel Durum:</td>
          <td>
            <span style="display: inline-block; background-color: ${currentCfg.color}15; color: ${currentCfg.color}; font-size: 11.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
              ${currentCfg.label}
            </span>
          </td>
        </tr>
      </table>

      ${note ? `
      <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
        <p style="color: #64748b; font-size: 12px; font-weight: 600; margin: 0 0 4px 0;">Açıklama / Çözüm Notu:</p>
        <p style="color: #1e293b; font-size: 13px; line-height: 1.5; margin: 0; background: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          ${note}
        </p>
      </div>` : ''}
    </div>

    ${actionUrl ? `
    <div style="text-align: center; margin: 24px 0 10px 0;">
      <a href="${actionUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 12px 24px; border-radius: 10px;">
        Talebi Görüntüle
      </a>
    </div>` : ''}
  `;

  const html = renderBaseTemplate({
    headerTitle: subject,
    badgeText: currentCfg.badge,
    badgeColor: currentCfg.color,
    contentHtml,
  });

  return sendEmail({ to, subject, html });
}

/* ============================================================================
   3b. 24 SAAT ESKALASYON BİLDİRİMLERİ (SLA Uyarıları)
============================================================================ */

/**
 * 24 Saattir Karşılanmayan (Üzerine Alınmayan) Talep Bildirimi
 * Tesisin tüm yetkililerine (Tesis Müdürü, Tesis Sorumlusu, Şirket Yöneticisi) gönderilir.
 */
export async function sendUnassignedRequestEscalationEmail({
  to,
  recipientName,
  requestNumber,
  title,
  category,
  facilityName,
  waitingHours,
  actionUrl,
}: {
  to: string | string[];
  recipientName?: string;
  requestNumber: string;
  title: string;
  category?: string;
  facilityName?: string;
  waitingHours: number;
  actionUrl?: string;
}): Promise<BaseEmailResponse> {
  const subject = `[ACİL] Karşılanmayan Talep Uyarısı (${waitingHours} saattir beklemede): ${requestNumber}`;

  const contentHtml = `
    <h2 style="color: #b91c1c; font-size: 19px; font-weight: 700; margin: 0 0 8px 0;">
      ${recipientName ? `Sayın ${recipientName},` : 'Sayın Tesis Yetkilisi,'}
    </h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      Aşağıda detayları belirtilen talep <strong>${waitingHours} saattir</strong> hiçbir tesis sorumlusu tarafından üzerine alınmamıştır. Karşılama süresi (T2 - T1) doğrudan <strong>tesisinizin performans karnesine</strong> olumsuz yansımaktadır. Lütfen ivedilikle talebi üzerinize alınız.
    </p>

    <!-- Request Details Table -->
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="color: #991b1b; padding: 6px 0; width: 140px; font-weight: 600;">Talep No:</td>
          <td style="color: #0f172a; font-weight: 700; font-family: monospace;">${requestNumber}</td>
        </tr>
        <tr>
          <td style="color: #991b1b; padding: 6px 0; font-weight: 600;">Başlık:</td>
          <td style="color: #0f172a; font-weight: 600;">${title}</td>
        </tr>
        ${category ? `
        <tr>
          <td style="color: #991b1b; padding: 6px 0; font-weight: 600;">Kategori:</td>
          <td style="color: #334155;">${category.toUpperCase()}</td>
        </tr>` : ''}
        ${facilityName ? `
        <tr>
          <td style="color: #991b1b; padding: 6px 0; font-weight: 600;">Tesis / Lokasyon:</td>
          <td style="color: #334155; font-weight: 600;">${facilityName}</td>
        </tr>` : ''}
        <tr>
          <td style="color: #991b1b; padding: 6px 0; font-weight: 600;">Bekleme Süresi:</td>
          <td style="color: #dc2626; font-weight: 700;">${waitingHours} Saat</td>
        </tr>
        <tr>
          <td style="color: #991b1b; padding: 6px 0; font-weight: 600;">Durum:</td>
          <td>
            <span style="display: inline-block; background-color: #fee2e2; color: #dc2626; font-size: 11.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
              AÇIK / KARŞILANMADI (T1)
            </span>
          </td>
        </tr>
      </table>
    </div>

    ${actionUrl ? `
    <div style="text-align: center; margin: 24px 0 10px 0;">
      <a href="${actionUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 26px; border-radius: 10px; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.25);">
        Talebi Şimdi Üzerine Al
      </a>
    </div>` : ''}
  `;

  const html = renderBaseTemplate({
    headerTitle: 'ACİL: KARŞILANMAYAN TALEP ESKALASYONU',
    badgeText: '24+ SAAT BEKLEMEDE',
    badgeColor: '#dc2626',
    contentHtml,
  });

  return sendEmail({ to, subject, html });
}

/**
 * 24 Saattir Kapatılmayan (Çözümlenmeyen) Talep Bildirimi
 * Talebi üzerine alan kişiye (assigned_to) gönderilir.
 */
export async function sendInProgressRequestReminderEmail({
  to,
  recipientName,
  requestNumber,
  title,
  category,
  facilityName,
  inProgressHours,
  actionUrl,
}: {
  to: string;
  recipientName?: string;
  requestNumber: string;
  title: string;
  category?: string;
  facilityName?: string;
  inProgressHours: number;
  actionUrl?: string;
}): Promise<BaseEmailResponse> {
  const subject = `[HATIRLATMA] Çözüm Bekleyen Talep (${inProgressHours} saattir işlemde): ${requestNumber}`;

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 19px; font-weight: 700; margin: 0 0 8px 0;">
      ${recipientName ? `Merhaba ${recipientName},` : 'Merhaba,'}
    </h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      Üzerinize almış olduğunuz aşağıdaki talep <strong>${inProgressHours} saattir</strong> işlemde beklemektedir ve henüz kapatılmamıştır. Çözüm işlem süresi (T3 - T2) doğrudan <strong>bireysel performans karnenize</strong> yazılmaktadır. Lütfen süreci tamamlayıp talebi "Çözüldü" veya "Reddet" olarak sonuçlandırınız.
    </p>

    <!-- Request Details Table -->
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="color: #92400e; padding: 6px 0; width: 140px; font-weight: 600;">Talep No:</td>
          <td style="color: #0f172a; font-weight: 700; font-family: monospace;">${requestNumber}</td>
        </tr>
        <tr>
          <td style="color: #92400e; padding: 6px 0; font-weight: 600;">Başlık:</td>
          <td style="color: #0f172a; font-weight: 600;">${title}</td>
        </tr>
        ${category ? `
        <tr>
          <td style="color: #92400e; padding: 6px 0; font-weight: 600;">Kategori:</td>
          <td style="color: #334155;">${category.toUpperCase()}</td>
        </tr>` : ''}
        ${facilityName ? `
        <tr>
          <td style="color: #92400e; padding: 6px 0; font-weight: 600;">Tesis / Lokasyon:</td>
          <td style="color: #334155;">${facilityName}</td>
        </tr>` : ''}
        <tr>
          <td style="color: #92400e; padding: 6px 0; font-weight: 600;">İşlemdeki Süre:</td>
          <td style="color: #b45309; font-weight: 700;">${inProgressHours} Saat</td>
        </tr>
        <tr>
          <td style="color: #92400e; padding: 6px 0; font-weight: 600;">Durum:</td>
          <td>
            <span style="display: inline-block; background-color: #fef3c7; color: #b45309; font-size: 11.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
              İŞLEMDE (T2 ÜZERİME ALINDI)
            </span>
          </td>
        </tr>
      </table>
    </div>

    ${actionUrl ? `
    <div style="text-align: center; margin: 24px 0 10px 0;">
      <a href="${actionUrl}" style="display: inline-block; background-color: #d97706; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 26px; border-radius: 10px; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.25);">
        Talebi Sonuçlandır (Kapat)
      </a>
    </div>` : ''}
  `;

  const html = renderBaseTemplate({
    headerTitle: 'ÇÖZÜM BEKLEYEN TALEP HATIRLATMASI',
    badgeText: '24+ SAAT İŞLEMDE',
    badgeColor: '#d97706',
    contentHtml,
  });

  return sendEmail({ to, subject, html });
}

/* ============================================================================
   4. AKSİYON BİLDİRİMLERİ (Yeni Atama veya Gecikme Uyarısı)
============================================================================ */
export async function sendActionNotificationEmail({
  to,
  recipientName,
  actionNumber,
  title,
  priority,
  dueDate,
  facilityName,
  isOverdue = false,
  actionUrl,
}: {
  to: string;
  recipientName?: string;
  actionNumber: string;
  title: string;
  priority?: string;
  dueDate?: string;
  facilityName?: string;
  isOverdue?: boolean;
  actionUrl?: string;
}): Promise<BaseEmailResponse> {
  const subject = isOverdue
    ? `⚠️ [GECİKME UYARISI] ${actionNumber}: ${title}`
    : `📋 [YENİ AKSİYON ATANDI] ${actionNumber}: ${title}`;

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 19px; font-weight: 700; margin: 0 0 8px 0;">
      ${recipientName ? `Sn. ${recipientName},` : 'Merhaba,'}
    </h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      ${isOverdue
        ? 'Sorumlusu olduğunuz aşağıdaki aksiyonun termin tarihi geçmiş ve henüz tamamlanmamıştır. Lütfen ivedilikle aksiyon durumunu güncelleyiniz.'
        : 'İdari operasyonlar kapsamında size yeni bir aksiyon ve düzeltici faaliyet atanmıştır.'
      }
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="color: #64748b; padding: 5px 0; width: 120px;">Aksiyon No:</td>
          <td style="color: #0f172a; font-weight: 700; font-family: monospace;">${actionNumber}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Başlık:</td>
          <td style="color: #0f172a; font-weight: 600;">${title}</td>
        </tr>
        ${facilityName ? `
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Tesis / Lokasyon:</td>
          <td style="color: #334155;">${facilityName}</td>
        </tr>` : ''}
        ${priority ? `
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Öncelik:</td>
          <td style="color: ${priority === 'kritik' ? '#dc2626' : '#2563eb'}; font-weight: 600;">${priority.toUpperCase()}</td>
        </tr>` : ''}
        ${dueDate ? `
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Termin Tarihi:</td>
          <td style="color: ${isOverdue ? '#dc2626' : '#0f172a'}; font-weight: 700;">${dueDate}</td>
        </tr>` : ''}
      </table>
    </div>

    ${actionUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <a href="${actionUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 12px 24px; border-radius: 10px;">
        Aksiyonu İncele & Kapat
      </a>
    </div>` : ''}
  `;

  const html = renderBaseTemplate({
    headerTitle: subject,
    badgeText: isOverdue ? 'GECİKME UYARISI' : 'AKSİYON ATAMASI',
    badgeColor: isOverdue ? '#dc2626' : '#2563eb',
    contentHtml,
  });

  return sendEmail({ to, subject, html });
}

/* ============================================================================
   5. DENETİM TAMAMLAMA VE KARNE BİLDİRİMİ
============================================================================ */
export async function sendAuditCompletedEmail({
  to,
  recipientName,
  auditTitle,
  facilityName,
  module,
  score,
  percentage,
  actionCount = 0,
  auditUrl,
}: {
  to: string;
  recipientName?: string;
  auditTitle: string;
  facilityName: string;
  module: string;
  score: number;
  percentage: number;
  actionCount?: number;
  auditUrl?: string;
}): Promise<BaseEmailResponse> {
  const subject = `🛡️ [Denetim Raporu] ${facilityName} — %${percentage} (${auditTitle})`;

  const isSuccess = percentage >= 80;
  const isWarning = percentage >= 60 && percentage < 80;

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 19px; font-weight: 700; margin: 0 0 8px 0;">
      ${recipientName ? `Sn. ${recipientName},` : 'Merhaba,'}
    </h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      <strong>${facilityName}</strong> lokasyonunda gerçekleştirilen <strong>${auditTitle}</strong> dijital denetimi tamamlanmış ve puanlanmıştır.
    </p>

    <!-- Score Card -->
    <div style="text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px 20px; margin-bottom: 24px;">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 6px 0; font-weight: 600;">DENETİM BAŞARI PUANI</p>
      <div style="font-size: 42px; font-weight: 800; color: ${isSuccess ? '#16a34a' : isWarning ? '#d97706' : '#dc2626'};">
        %${percentage}
      </div>
      <p style="color: #475569; font-size: 12.5px; margin: 6px 0 0 0;">
        Alınan Puan: <strong>${score}</strong> / 100 — Durum: <strong>${isSuccess ? 'UYGUN' : isWarning ? 'TAKİP GEREKİYOR' : 'KRİTİK UYGUNSUZLUK'}</strong>
      </p>

      ${actionCount > 0 ? `
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
        <span style="display: inline-block; background-color: #fee2e2; color: #dc2626; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">
          ⚠️ ${actionCount} adet uygunsuzluk aksiyona dönüştürüldü
        </span>
      </div>` : ''}
    </div>

    ${auditUrl ? `
    <div style="text-align: center; margin: 20px 0;">
      <a href="${auditUrl}" style="display: inline-block; background-color: #0f1c2e; color: #ffffff; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 12px 24px; border-radius: 10px;">
        Denetim Karnesini Görüntüle
      </a>
    </div>` : ''}
  `;

  const html = renderBaseTemplate({
    headerTitle: subject,
    badgeText: 'DENETİM SONUCU',
    badgeColor: isSuccess ? '#16a34a' : '#dc2626',
    contentHtml,
  });

  return sendEmail({ to, subject, html });
}

/* ============================================================================
   6. YÖNETİCİ HAFTALIK / AYLIK PERFORMANS VE SLA ÖZETİ
============================================================================ */
export async function sendReportDigestEmail({
  to,
  recipientName,
  period,
  totalRequests,
  resolvedRequests,
  rejectedRequests,
  avgResponseTime,
  avgResolutionTime,
  reportUrl,
}: {
  to: string;
  recipientName?: string;
  period: string;
  totalRequests: number;
  resolvedRequests: number;
  rejectedRequests: number;
  avgResponseTime: string;
  avgResolutionTime: string;
  reportUrl?: string;
}): Promise<BaseEmailResponse> {
  const subject = `📊 [İdari360 Rapor] ${period} Yönetici Performans Özeti`;

  const contentHtml = `
    <h2 style="color: #0f172a; font-size: 19px; font-weight: 700; margin: 0 0 8px 0;">
      ${recipientName ? `Sn. ${recipientName},` : 'Merhaba,'}
    </h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      İdari360 operasyonlarında <strong>${period}</strong> dönemine ait konsolide talep, SLA ve performans metrikleri aşağıda özetlenmiştir.
    </p>

    <!-- KPI Grid -->
    <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 20px;">
      <tr>
        <td style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; width: 33%;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Toplam Talep</div>
          <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;">${totalRequests}</div>
        </td>
        <td style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; text-align: center; width: 33%;">
          <div style="font-size: 11px; color: #16a34a; font-weight: 600; text-transform: uppercase;">Çözülen</div>
          <div style="font-size: 22px; font-weight: 800; color: #16a34a; margin-top: 4px;">${resolvedRequests}</div>
        </td>
        <td style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; text-align: center; width: 33%;">
          <div style="font-size: 11px; color: #dc2626; font-weight: 600; text-transform: uppercase;">Reddedilen</div>
          <div style="font-size: 22px; font-weight: 800; color: #dc2626; margin-top: 4px;">${rejectedRequests}</div>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
          <span style="color: #64748b; font-size: 12px;">Ort. Karşılama (Müdahale) Süresi:</span>
          <strong style="color: #0f172a; float: right; font-size: 13px;">${avgResponseTime}</strong>
        </td>
        <td style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
          <span style="color: #64748b; font-size: 12px;">Ort. Çözüm:</span>
          <strong style="color: #0f172a; float: right; font-size: 13px;">${avgResolutionTime}</strong>
        </td>
      </tr>
    </table>

    ${reportUrl ? `
    <div style="text-align: center; margin: 24px 0 10px 0;">
      <a href="${reportUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13.5px; font-weight: 600; padding: 12px 24px; border-radius: 10px;">
        Canlı Dashboard'a Git
      </a>
    </div>` : ''}
  `;

  const html = renderBaseTemplate({
    headerTitle: subject,
    badgeText: 'YÖNETİCİ RAPORU',
    badgeColor: '#6366f1',
    contentHtml,
  });

  return sendEmail({ to, subject, html });
}
