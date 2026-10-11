-- ==============================================================================
-- İDARİ360 - MIGRATION 009: ŞİRKETİ KAYITLI OLMAYAN KULLANICILARIN KAYDINI ENGELLEME
-- ==============================================================================

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

    -- 1. Süper Admin Kontrolü
    IF v_user_email = LOWER(v_primary_super_admin) THEN
        v_role := 'super_admin';
        v_matched_company_id := NULL;
        v_is_active := true;
    ELSE
        -- 2. Kurumsal E-posta Domain Eşleştirmesi (Şirketin aktif olması zorunludur)
        SELECT ed.company_id INTO v_matched_company_id
        FROM public.email_domains ed
        JOIN public.companies c ON c.id = ed.company_id
        WHERE LOWER(ed.domain) = v_domain
          AND c.is_active = true
        LIMIT 1;

        -- SEÇENEK B KURALI: Şirket eşleşmesi yoksa kayıt KESİNLİKLE ENGELLENİR!
        IF v_matched_company_id IS NULL THEN
            RAISE EXCEPTION 'Şirketiniz (@%) henüz sistemde tanımlı veya aktif değildir. Lütfen şirket yöneticiniz veya platform desteği ile iletişime geçiniz.', v_domain;
        END IF;

        -- Standart rol daima 'employee' olarak başlar
        v_role := 'employee';
        v_is_active := true;
    END IF;

    -- 3. Profil Kaydı Oluşturma
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
        company_id = CASE
            WHEN profiles.company_id IS NULL THEN v_matched_company_id
            ELSE profiles.company_id
        END,
        email_verified = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = clock_timestamp();

    -- 4. Aktivite günlüğüne yaz
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
