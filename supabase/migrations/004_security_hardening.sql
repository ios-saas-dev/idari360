-- ==============================================================================
-- İdari360 - Güvenlik Sertleştirme ve Pentest İyileştirme Paketi
-- Migration: 004_security_hardening.sql
-- ==============================================================================
-- Kapsanan Güvenlik Maddeleri:
--   1. Genel E-Posta Domainleri Kara Listesi (Public Domain Blacklist)
--   2. Güvenli Profil Oluşturma Tetikleyicisi (auth.users -> profiles)
--      - murat.krgzz35@gmail.com hesabı için otomatik super_admin ataması
--      - Kurumsal domain eşleştirmesi ile şirket otomatik bağlama
--      - İstemciden mass-assignment / role escalation engelleme
--   3. Güçlendirilmiş OTP Tablosu ve Brute-Force Korumalı Doğrulama Fonksiyonu
--   4. Supabase Storage Bucket'ları ve Storage RLS Politikaları
--   5. Süper Admin Hesap Dokunulmazlığı ve Güvenlik Denetim Kuralları
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GENEL E-POSTA DOMAINLERİ KARA LİSTESİ (PUBLIC DOMAIN BLACKLIST)
-- ------------------------------------------------------------------------------
-- Kurumsal olmayan ücretsiz e-posta sağlayıcılarının email_domains tablosuna
-- eklenmesini engelleyerek tüm firmanın verilerinin yabancılara açılmasını önler.

ALTER TABLE public.email_domains
DROP CONSTRAINT IF EXISTS chk_no_public_email_domains;

ALTER TABLE public.email_domains
ADD CONSTRAINT chk_no_public_email_domains
CHECK (
    LOWER(domain) NOT IN (
        'gmail.com', 'googlemail.com',
        'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
        'yahoo.com', 'ymail.com',
        'icloud.com', 'me.com', 'mac.com',
        'yandex.com', 'yandex.ru',
        'mail.ru', 'inbox.ru', 'bk.ru', 'list.ru',
        'proton.me', 'protonmail.com',
        'zoho.com', 'aol.com', 'gmx.com', 'gmx.net',
        'fastmail.com', 'tutanota.com'
    )
);

-- ------------------------------------------------------------------------------
-- 2. GÜVENLİ KULLANICI KAYDI & PROFİL PROVISIONING (AUTH.USERS TRIGGER)
-- ------------------------------------------------------------------------------
-- Kullanıcı kaydı doğrudan istemciden profiles tablosuna INSERT yapılarak değil,
-- auth.users olayı tetiklenerek güvenli arka uç ortamında gerçekleşir.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_email text;
    v_domain text;
    v_matched_company_id uuid;
    v_role app_role;
    v_is_active boolean;
    v_full_name text;
    v_primary_super_admin text := 'murat.krgzz35@gmail.com';
BEGIN
    v_user_email := LOWER(NEW.email);
    v_domain := LOWER(SPLIT_PART(v_user_email, '@', 2));
    
    -- Kullanıcı adı / meta veriden isim alma
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        INITCAP(SPLIT_PART(v_user_email, '@', 1))
    );

    -- 2.1 Süper Admin Kontrolü
    IF v_user_email = LOWER(v_primary_super_admin) THEN
        v_role := 'super_admin';
        v_matched_company_id := NULL;
        v_is_active := true;
    ELSE
        -- 2.2 Kurumsal E-posta Domain Eşleştirmesi
        SELECT company_id INTO v_matched_company_id
        FROM public.email_domains
        WHERE LOWER(domain) = v_domain
        LIMIT 1;

        -- Standart rol daima 'employee' olarak başlar (Güvenlik Kuralı: No Initial Privilege)
        v_role := 'employee';

        -- Eğer şirket domaini eşleştiyse aktif et, eşleşmediyse beklemede bırak
        IF v_matched_company_id IS NOT NULL THEN
            v_is_active := true;
        ELSE
            v_is_active := false; -- Şirketsiz kullanıcı onay bekler
        END IF;
    END IF;

    -- 2.3 Profil Kaydı Oluşturma
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        company_id,
        facility_id,
        is_active,
        email_verified,
        last_login_at,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_user_email,
        v_full_name,
        v_role,
        v_matched_company_id,
        NULL,
        v_is_active,
        (NEW.email_confirmed_at IS NOT NULL),
        clock_timestamp(),
        clock_timestamp(),
        clock_timestamp()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = CASE 
            WHEN LOWER(EXCLUDED.email) = LOWER(v_primary_super_admin) THEN 'super_admin'
            ELSE profiles.role 
        END,
        email_verified = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = clock_timestamp();

    -- Aktivite günlüğüne yaz
    INSERT INTO public.activity_logs (
        company_id,
        user_id,
        action,
        entity_type,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_matched_company_id,
        NEW.id,
        'USER_REGISTERED',
        'profiles',
        NEW.id,
        jsonb_build_object(
            'email', v_user_email,
            'assigned_role', v_role,
            'company_matched', (v_matched_company_id IS NOT NULL),
            'is_active', v_is_active
        ),
        clock_timestamp()
    );

    RETURN NEW;
END;
$$;

-- auth.users üzerine tetikleyiciyi bağla
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- profiles tablosuna doğrudan hileli INSERT yapılmasını önleyen güvenlik tetikleyicisi
CREATE OR REPLACE FUNCTION public.enforce_profile_insert_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_role app_role;
BEGIN
    -- Sistem / auth trigger çağrıları (auth.uid null iken) serbesttir
    IF v_caller_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    -- Süper admin dışındaki hiçbir kullanıcı doğrudan privileged rol atayamaz
    IF NEW.role IN ('super_admin', 'company_admin') AND (v_caller_role IS NULL OR v_caller_role <> 'super_admin') THEN
        RAISE EXCEPTION 'Güvenlik İhlali: Süper admin ve şirket yöneticisi rolleri doğrudan istemciden atanamaz.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_insert_security ON public.profiles;
CREATE TRIGGER trg_enforce_profile_insert_security
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_profile_insert_security();

-- ------------------------------------------------------------------------------
-- 3. GÜÇLENDİRİLMİŞ OTP VE BRUTE-FORCE KORUMASI (HARDENED OTP)
-- ------------------------------------------------------------------------------

ALTER TABLE public.otp_codes
ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS code_hash TEXT;

-- Güvenli OTP Doğrulama Fonksiyonu (Stored Procedure)
CREATE OR REPLACE FUNCTION public.verify_otp_code(
    p_email text,
    p_code text,
    p_purpose otp_purpose
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record record;
    v_clean_email text := LOWER(TRIM(p_email));
    v_clean_code text := TRIM(p_code);
BEGIN
    -- Aktif en son OTP kaydını çek
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
            'message', 'Onay kodunun süresi dolmuştur.'
        );
    END IF;

    -- Kod eşleşmesi kontrolü
    IF v_record.code = v_clean_code THEN
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

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Doğrulama başarılı.'
        );
    ELSE
        -- Hatalı deneme: Sayacı artır ve gerekiyorsa bloke et
        UPDATE public.otp_codes
        SET attempts = attempts + 1,
            is_blocked = CASE WHEN (attempts + 1) >= max_attempts THEN true ELSE false END
        WHERE id = v_record.id;

        IF (v_record.attempts + 1) >= v_record.max_attempts THEN
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

-- ------------------------------------------------------------------------------
-- 4. SUPABASE STORAGE BUCKETLARI VE STORAGE RLS POLİTİKALARI
-- ------------------------------------------------------------------------------

-- 4.1 İdari360 Dosya Depolama Alanları (Buckets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('audit-photos', 'audit-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('action-evidence', 'action-evidence', false, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]),
    ('request-attachments', 'request-attachments', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]),
    ('company-assets', 'company-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4.2 Storage Nesneleri İçin RLS Politikaları
-- Dosya yolları 'company_id/...' formatında organize edilir.

DROP POLICY IF EXISTS "storage_company_assets_public_read" ON storage.objects;
CREATE POLICY "storage_company_assets_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');

DROP POLICY IF EXISTS "storage_tenant_read_access" ON storage.objects;
CREATE POLICY "storage_tenant_read_access"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id IN ('audit-photos', 'action-evidence', 'request-attachments')
    AND (
        public.is_super_admin()
        OR (storage.foldername(name))[1] = (public.get_user_company_id())::text
    )
);

DROP POLICY IF EXISTS "storage_tenant_insert_access" ON storage.objects;
CREATE POLICY "storage_tenant_insert_access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IN ('audit-photos', 'action-evidence', 'request-attachments', 'company-assets')
    AND (
        public.is_super_admin()
        OR (storage.foldername(name))[1] = (public.get_user_company_id())::text
    )
);

DROP POLICY IF EXISTS "storage_tenant_delete_access" ON storage.objects;
CREATE POLICY "storage_tenant_delete_access"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id IN ('audit-photos', 'action-evidence', 'request-attachments', 'company-assets')
    AND (
        public.is_super_admin()
        OR (
            (storage.foldername(name))[1] = (public.get_user_company_id())::text
            AND public.has_role_or_higher('facility_manager')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 5. SÜPER ADMİN HESAP DOKUNULMAZLIĞI (SUPER ADMIN IMMUTABILITY)
-- ------------------------------------------------------------------------------
-- murat.krgzz35@gmail.com kullanıcısının rolünün düşürülmesini veya silinmesini önler.

CREATE OR REPLACE FUNCTION public.protect_primary_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_primary text := 'murat.krgzz35@gmail.com';
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF LOWER(OLD.email) = LOWER(v_primary) AND NEW.role <> 'super_admin' THEN
            RAISE EXCEPTION 'Kritik Güvenlik Kuralı: Birincil Süper Admin rolü düşürülemez.';
        END IF;
        IF LOWER(OLD.email) = LOWER(v_primary) AND NEW.is_active = false THEN
            RAISE EXCEPTION 'Kritik Güvenlik Kuralı: Birincil Süper Admin hesabı pasife alınamaz.';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF LOWER(OLD.email) = LOWER(v_primary) THEN
            RAISE EXCEPTION 'Kritik Güvenlik Kuralı: Birincil Süper Admin hesabı silinemez.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_primary_super_admin ON public.profiles;
CREATE TRIGGER trg_protect_primary_super_admin
    BEFORE UPDATE OR DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_primary_super_admin();

-- ==============================================================================
-- BİTİŞ: 004_security_hardening.sql başarıyla hazırlandı.
-- ==============================================================================
