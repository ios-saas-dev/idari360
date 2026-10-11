-- ==============================================================================
-- İDARİ360 - MIGRATION 006: GELİŞMİŞ GÜVENLİK, KRİPTOGRAFİK OTP VE RATE LIMITING
-- ==============================================================================

-- 1. Pgcrypto uzantısının extensions şemasında var olduğundan emin ol
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. OTP tablosunu sıfır-bilgi (zero-knowledge) modeline geçir
ALTER TABLE public.otp_codes ALTER COLUMN code DROP NOT NULL;
ALTER TABLE public.otp_codes ALTER COLUMN code SET DEFAULT NULL;

-- 3. RATE LIMITING TABLOSU VE İNDEKSİ
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash TEXT NOT NULL,
    action TEXT NOT NULL,
    request_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_rate_limits_key_action UNIQUE (key_hash, action)
);

-- RLS Aç (Sadece service_role ve yetkili güvenlik fonksiyonları erişebilir)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rate_limits_service_role_only" ON public.rate_limits;
CREATE POLICY "rate_limits_service_role_only"
    ON public.rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits (expires_at);

-- 4. RATE LIMITING KONTROL FONKSİYONU
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key text,
    p_action text,
    p_max_requests int,
    p_window_seconds int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_key text := LOWER(TRIM(p_key));
    v_clean_action text := LOWER(TRIM(p_action));
    v_now timestamptz := clock_timestamp();
    v_record record;
    v_remaining int;
    v_retry_after int;
BEGIN
    -- Mevcut kaydı oku (satır kilitleme FOR UPDATE ile yarış koşullarını önle)
    SELECT * INTO v_record
    FROM public.rate_limits
    WHERE key_hash = v_clean_key AND action = v_clean_action
    FOR UPDATE;

    IF v_record IS NULL THEN
        -- İlk istek: Yeni sayaç penceresi başlat
        INSERT INTO public.rate_limits (key_hash, action, request_count, window_start, expires_at)
        VALUES (v_clean_key, v_clean_action, 1, v_now, v_now + (p_window_seconds || ' seconds')::interval);

        RETURN jsonb_build_object(
            'allowed', true,
            'remaining', p_max_requests - 1,
            'retry_after_seconds', 0
        );
    ELSIF v_record.expires_at < v_now THEN
        -- Süresi dolmuş pencere: Sıfırla
        UPDATE public.rate_limits
        SET request_count = 1,
            window_start = v_now,
            expires_at = v_now + (p_window_seconds || ' seconds')::interval
        WHERE id = v_record.id;

        RETURN jsonb_build_object(
            'allowed', true,
            'remaining', p_max_requests - 1,
            'retry_after_seconds', 0
        );
    ELSIF v_record.request_count >= p_max_requests THEN
        -- Limit aşıldı! İstek engellendi
        v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_record.expires_at - v_now)))::int;
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retry_after_seconds', GREATEST(v_retry_after, 1)
        );
    ELSE
        -- Limit dahilinde: Sayacı artır
        UPDATE public.rate_limits
        SET request_count = request_count + 1
        WHERE id = v_record.id;

        v_remaining := p_max_requests - (v_record.request_count + 1);
        RETURN jsonb_build_object(
            'allowed', true,
            'remaining', GREATEST(v_remaining, 0),
            'retry_after_seconds', 0
        );
    END IF;
END;
$$;

-- 5. KRİPTOGRAFİK GÜVENLİ OTP OLUŞTURMA FONKSİYONU
CREATE OR REPLACE FUNCTION public.generate_otp_code(
    p_email text,
    p_purpose otp_purpose DEFAULT 'email_verification',
    p_expiry_minutes int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_email text := LOWER(TRIM(p_email));
    v_rate_res jsonb;
    v_raw_code text;
    v_hash text;
    v_now timestamptz := clock_timestamp();
    v_expires_at timestamptz := v_now + (p_expiry_minutes || ' minutes')::interval;
BEGIN
    -- E-posta boş olamaz
    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Geçerli bir e-posta adresi belirtilmelidir.');
    END IF;

    -- Rate limit kontrolü: Aynı e-posta için 10 dakikada maksimum 3 OTP kodu
    v_rate_res := public.check_rate_limit(
        v_clean_email,
        'otp_request_' || p_purpose::text,
        3,
        600
    );

    IF (v_rate_res->>'allowed')::boolean = false THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', format('Çok sık kod talep ettiniz. Lütfen %s saniye sonra tekrar deneyin.', v_rate_res->>'retry_after_seconds'),
            'retry_after_seconds', (v_rate_res->>'retry_after_seconds')::int
        );
    END IF;

    -- 6 haneli kriptografik rastgele kod üret: 100000..999999
    v_raw_code := LPAD((100000 + FLOOR(random() * 900000))::int::text, 6, '0');
    -- SHA-256 hash'ini hesapla
    v_hash := encode(digest(v_raw_code, 'sha256'), 'hex');

    -- Eski aktif kodları geçersiz kıl
    UPDATE public.otp_codes
    SET is_used = true,
        used_at = v_now
    WHERE LOWER(email) = v_clean_email
      AND purpose = p_purpose
      AND is_used = false;

    -- Yeni kaydı SADECE HASH OLARAK ekle (Düz metin kod veritabanına YAZILMAZ!)
    INSERT INTO public.otp_codes (
        email,
        code,
        code_hash,
        purpose,
        expires_at,
        is_used,
        attempts,
        max_attempts,
        is_blocked,
        created_at
    ) VALUES (
        v_clean_email,
        NULL,
        v_hash,
        p_purpose,
        v_expires_at,
        false,
        0,
        5,
        false,
        v_now
    );

    -- Ham kod yalnızca e-posta gönderecek backend/servise tek seferlik döndürülür
    RETURN jsonb_build_object(
        'success', true,
        'email', v_clean_email,
        'code', v_raw_code,
        'expires_at', v_expires_at,
        'message', 'Onay kodu güvenli olarak üretildi.'
    );
END;
$$;

-- 6. GÜÇLENDİRİLMİŞ OTP DOĞRULAMA (HASH KONTROLLÜ)
CREATE OR REPLACE FUNCTION public.verify_otp_code(
    p_email text,
    p_code text,
    p_purpose otp_purpose
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_record record;
    v_clean_email text := LOWER(TRIM(p_email));
    v_clean_code text := TRIM(p_code);
    v_input_hash text;
    v_is_match boolean := false;
BEGIN
    -- Girdi kontrolü
    IF v_clean_email IS NULL OR v_clean_code IS NULL OR length(v_clean_code) < 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'E-posta ve onay kodu eksiksiz girilmelidir.'
        );
    END IF;

    -- SHA-256 Hash'i hesapla
    v_input_hash := encode(digest(v_clean_code, 'sha256'), 'hex');

    -- En son aktif OTP kaydını çek
    SELECT * INTO v_record
    FROM public.otp_codes
    WHERE LOWER(email) = v_clean_email
      AND purpose = p_purpose
      AND is_used = false
    ORDER BY created_at DESC
    LIMIT 1;

    -- Kayıt bulunamadı
    IF v_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Geçerli bir onay kodu bulunamadı. Lütfen yeni bir kod talep edin.'
        );
    END IF;

    -- Kod bloke edilmiş mi?
    IF v_record.is_blocked THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Çok fazla hatalı deneme yapıldığı için bu kod bloke edilmiştir. Lütfen yeni bir kod isteyin.'
        );
    END IF;

    -- Kodun süresi dolmuş mu?
    IF v_record.expires_at < clock_timestamp() THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Onay kodunun süresi dolmuştur. Lütfen yeni bir kod talep edin.'
        );
    END IF;

    -- Hash eşleşmesi (ve geriye dönük düz kod eşleşmesi desteği)
    IF v_record.code_hash IS NOT NULL AND v_record.code_hash = v_input_hash THEN
        v_is_match := true;
    ELSIF v_record.code IS NOT NULL AND v_record.code = v_clean_code THEN
        v_is_match := true;
    END IF;

    IF v_is_match THEN
        -- Başarılı: Kodu kullanıldı olarak işaretle
        UPDATE public.otp_codes
        SET is_used = true,
            used_at = clock_timestamp()
        WHERE id = v_record.id;

        -- E-posta doğrulama ise profiles tablosunu güncelle
        UPDATE public.profiles
        SET email_verified = true,
            updated_at = clock_timestamp()
        WHERE LOWER(email) = v_clean_email;

        -- Aktivite loguna işle (Güvenlik kaydı)
        INSERT INTO public.activity_logs (
            company_id,
            action,
            entity_type,
            details
        ) VALUES (
            (SELECT company_id FROM public.profiles WHERE LOWER(email) = v_clean_email LIMIT 1),
            'otp_verified_success',
            'otp_codes',
            jsonb_build_object('email', v_clean_email, 'purpose', p_purpose)
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Doğrulama başarılı.'
        );
    ELSE
        -- Hatalı deneme: Sayacı artır ve 5 denemede bloke et
        UPDATE public.otp_codes
        SET attempts = attempts + 1,
            is_blocked = CASE WHEN (attempts + 1) >= max_attempts THEN true ELSE false END
        WHERE id = v_record.id;

        IF (v_record.attempts + 1) >= v_record.max_attempts THEN
            -- Aktivite loguna güvenlik uyarısı kaydet
            INSERT INTO public.activity_logs (
                company_id,
                action,
                entity_type,
                details
            ) VALUES (
                (SELECT company_id FROM public.profiles WHERE LOWER(email) = v_clean_email LIMIT 1),
                'otp_blocked_bruteforce',
                'otp_codes',
                jsonb_build_object('email', v_clean_email, 'purpose', p_purpose, 'attempts', v_record.max_attempts)
            );

            RETURN jsonb_build_object(
                'success', false,
                'message', '5 hatalı deneme sınırına ulaşıldı. Kod bloke edildi. Lütfen yeni kod isteyin.'
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'message', format('Hatalı kod girdiniz. Kalan hakkınız: %s', (v_record.max_attempts - (v_record.attempts + 1)))
            );
        END IF;
    END IF;
END;
$$;

-- 7. OTOMATİK VERİ TEMİZLEME BAKIM FONKSİYONU
CREATE OR REPLACE FUNCTION public.security_cleanup_expired_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted_otps int;
    v_deleted_rate_limits int;
BEGIN
    -- 3 günden eski veya kullanılmış ve 1 günü geçmiş OTP kayıtlarını temizle
    DELETE FROM public.otp_codes
    WHERE (expires_at < clock_timestamp() - INTERVAL '3 days')
       OR (is_used = true AND used_at < clock_timestamp() - INTERVAL '1 day');
    GET DIAGNOSTICS v_deleted_otps = ROW_COUNT;

    -- Süresi dolmuş rate limit sayaçlarını temizle
    DELETE FROM public.rate_limits
    WHERE expires_at < clock_timestamp() - INTERVAL '1 day';
    GET DIAGNOSTICS v_deleted_rate_limits = ROW_COUNT;

    RETURN jsonb_build_object(
        'deleted_otp_codes', v_deleted_otps,
        'deleted_rate_limits', v_deleted_rate_limits,
        'cleaned_at', clock_timestamp()
    );
END;
$$;
