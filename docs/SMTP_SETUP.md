# 📧 İdari360 — Kurumsal E-Posta (SMTP) & OTP Entegrasyon Rehberi

İdari360 platformunda kullanıcı kayıtlarında (Sign-up) ve şifre sıfırlamalarda gönderilen 6 haneli OTP onay kodlarının spam klasörüne düşmemesi ve yüksek teslimat oranı (%99+) sağlanması için harici kurumsal bir SMTP sağlayıcısı entegre edilmelidir.

---

## 🚀 1. Önerilen SMTP Sağlayıcıları

1. **Resend (Şiddetle Tavsiye Edilir):**
   - Ayda 3.000 e-posta ücretsiz.
   - Kolay DNS doğrulama (DKIM, SPF, DMARC).
   - Web: [resend.com](https://resend.com)
2. **SendGrid (Twilio):**
   - Günde 100 e-posta ücretsiz.
   - Kurumsal altyapı desteği.
3. **Amazon SES (AWS):**
   - 10.000 e-posta ~0.10$.
   - Yüksek hacimli kurumsal SaaS için ideal.

---

## ⚙️ 2. Supabase Dashboard Üzerinde SMTP Yapılandırması

1. [Supabase Dashboard](https://supabase.com/dashboard/project/tfxglvosqhiidyjhfyav) adresine giriş yapın.
2. Sol menüden **Project Settings** > **Authentication** > **SMTP Settings** sekmesine gidin.
3. **Enable Custom SMTP** seçeneğini aktif edin:
   - **Sender Email:** `noreply@idari360.com` veya şirket alan adınız
   - **Sender Name:** `idari360 Doğrulama Merkezi`
   - **Host:** Örneğin Resend için `smtp.resend.com`
   - **Port:** `465` (SSL) veya `587` (TLS)
   - **User:** `resend` (veya SMTP kullanıcı adınız)
   - **Password:** `re_123456...` (SMTP API anahtarınız)
4. Değişiklikleri kaydedin ve **Send Test Email** butonuna basarak `murat.krgzz35@gmail.com` adresinize test iletisi gönderin.

---

## ✉️ 3. OTP E-Posta Şablonu (HTML Şablonu)

**Authentication** > **Email Templates** > **Confirmation** bölümüne aşağıdaki şablonu yerleştirebilirsiniz:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>idari360 Doğrulama Kodu</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 40px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #0f172a; font-size: 24px; margin: 0; font-weight: 700;">idari360</h1>
      <p style="color: #64748b; font-size: 14px; margin-top: 6px;">Akıllı İdari İşlemler Yönetim Platformu</p>
    </div>

    <p style="color: #334155; font-size: 15px; line-height: 1.6;">Merhaba,</p>
    <p style="color: #334155; font-size: 15px; line-height: 1.6;">idari360 hesabınızı doğrulamak ve oturum açma işlemini tamamlamak için aşağıdaki 6 haneli güvenlik kodunu kullanın:</p>

    <div style="text-align: center; margin: 32px 0;">
      <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 14px 28px; border-radius: 8px; border: 1px dashed #bfdbfe;">
        {{ .Token }}
      </span>
    </div>

    <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
      ⚠️ Bu kod <strong>10 dakika</strong> boyunca geçerlidir. Kodunuzu kimseyle paylaşmayınız. 5 hatalı denemede hesabınız güvenlik sebebiyle kilitlenecektir.
    </p>

    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
      Bu işlemi siz başlatmadıysanız lütfen bu iletiyi dikkate almayınız.<br>
      © 2026 idari360. Tüm hakları saklıdır.
    </p>
  </div>
</body>
</html>
```

---

## 🔒 4. Sıfır-Bilgi Güvenlik Notu

İdari360 veritabanı `006_security_enhancements.sql` güncellemesi ile **sıfır-bilgi (zero-knowledge)** modeline geçirilmiştir. Kullanıcının e-posta adresine gönderilen 6 haneli kod, veritabanına **asla düz metin olarak yazılmaz**. Yalnızca 64 karakterlik kriptografik SHA-256 hash'i saklanır. Böylece veritabanı kopyalansa veya sızdırılsa dahi hiç kimse onay kodlarını okuyamaz.
