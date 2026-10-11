-- ==============================================================================
-- İDARİ360 - MIGRATION 010: TESİS KİLİTLEME VE ÇAPRAZ TESİS İZOLASYONU
-- ==============================================================================

-- 1. Tesis Değişikliğini Kilitleyen ve Doğrulayan Tetikleyici Fonksiyon
CREATE OR REPLACE FUNCTION public.validate_facility_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_role app_role;
    v_caller_company_id uuid;
    v_facility_company_id uuid;
    v_facility_is_active boolean;
BEGIN
    -- Arka plan/sistem işlemleri (auth.uid() yoksa) izin ver
    IF v_caller_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Tesis değişmediyse veya atanmadıysa devam et
    IF OLD.facility_id IS NOT DISTINCT FROM NEW.facility_id THEN
        RETURN NEW;
    END IF;

    -- Çağıran kullanıcının rolünü al
    SELECT role, company_id INTO v_caller_role, v_caller_company_id
    FROM public.profiles
    WHERE id = v_caller_id;

    -- 1.1 Kural: İlk Tesis Seçimi (OLD.facility_id IS NULL -> NEW.facility_id IS NOT NULL)
    IF OLD.facility_id IS NULL AND NEW.facility_id IS NOT NULL THEN
        -- Hedef tesisin bu şirkete ait ve aktif olduğunu doğrula
        SELECT company_id, is_active INTO v_facility_company_id, v_facility_is_active
        FROM public.facilities
        WHERE id = NEW.facility_id;

        IF v_facility_company_id IS NULL OR v_facility_is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Güvenlik İhlali: Seçilen tesis bulunamadı veya aktif değildir.';
        END IF;

        IF v_caller_role <> 'super_admin' AND v_facility_company_id <> NEW.company_id THEN
            RAISE EXCEPTION 'Güvenlik İhlali: Seçilen tesis şirketinize ait değildir.';
        END IF;

        -- İlk seçim onaylandı, devam et
        RETURN NEW;
    END IF;

    -- 1.2 Kural: Tesis Zaten Atanmışken Değiştirme Girişimi (OLD.facility_id IS NOT NULL)
    IF OLD.facility_id IS NOT NULL AND NEW.facility_id IS DISTINCT FROM OLD.facility_id THEN
        -- Kullanıcı kendi tesisini DEĞİŞTİREMEZ (Kilitlidir)
        IF NEW.id = v_caller_id THEN
            IF v_caller_role <> 'super_admin' AND v_caller_role <> 'company_admin' THEN
                RAISE EXCEPTION 'Güvenlik İhlali: Tesis seçiminiz tamamlanmıştır ve kilitlenmiştir. Tesis değiştirme yetkiniz bulunmamaktadır. Değişiklik için şirket yöneticinize başvurunuz.';
            END IF;
        ELSE
            -- Bir yönetici başka kullanıcının tesisini değiştiriyorsa, o kullanıcıyı yönetme yetkisi olmalıdır
            IF NOT public.can_manage_user(NEW.id) THEN
                RAISE EXCEPTION 'Güvenlik İhlali: Bu kullanıcının tesisini değiştirme yetkiniz bulunmamaktadır.';
            END IF;
        END IF;

        -- Yeni tesisin hedef kullanıcının şirketine ait olduğunu kontrol et
        SELECT company_id, is_active INTO v_facility_company_id, v_facility_is_active
        FROM public.facilities
        WHERE id = NEW.facility_id;

        IF v_caller_role <> 'super_admin' AND v_facility_company_id <> NEW.company_id THEN
            RAISE EXCEPTION 'Güvenlik İhlali: Atanmak istenen tesis kullanıcının şirketine ait değildir.';
        END IF;

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
            NEW.company_id,
            v_caller_id,
            'FACILITY_CHANGE',
            'profiles',
            NEW.id,
            jsonb_build_object(
                'target_user_id', NEW.id,
                'old_facility_id', OLD.facility_id,
                'new_facility_id', NEW.facility_id,
                'changed_by', v_caller_id
            ),
            clock_timestamp()
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Tetikleyiciyi profiles üzerine bağla
DROP TRIGGER IF EXISTS trg_validate_facility_change ON public.profiles;
CREATE TRIGGER trg_validate_facility_change
    BEFORE UPDATE OF facility_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_facility_change();


-- 2. Çapraz Tesis Veri İzolasyonunu Zorunlu Kılan Tetikleyici Fonksiyon
CREATE OR REPLACE FUNCTION public.enforce_facility_isolation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_role app_role;
    v_user_facility_id uuid;
BEGIN
    -- Arka plan/sistem işlemleri
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    v_user_role := public.get_user_role();
    v_user_facility_id := public.get_user_facility_id();

    -- Süper admin ve şirket yöneticisi tüm şirket tesislerinde işlem yapabilir
    IF v_user_role IN ('super_admin', 'company_admin') THEN
        RETURN NEW;
    END IF;

    -- Tesis sorumlusu, idari işler yöneticisi ve çalışanlar SADECE kendi tesislerinde işlem yapabilir
    IF NEW.facility_id IS DISTINCT FROM v_user_facility_id THEN
        RAISE EXCEPTION 'Güvenlik İhlali: Farklı bir tesise ait veri ekleyemez veya güncelleyemezsiniz. (Yetkili Tesis: %, Hedef Tesis: %)',
            v_user_facility_id, NEW.facility_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Tesis bazlı tablolara çapraz-tesis koruma tetikleyicilerini bağla
DROP TRIGGER IF EXISTS trg_facility_isolation_requests ON public.requests;
CREATE TRIGGER trg_facility_isolation_requests
    BEFORE INSERT OR UPDATE ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_facility_isolation();

DROP TRIGGER IF EXISTS trg_facility_isolation_actions ON public.actions;
CREATE TRIGGER trg_facility_isolation_actions
    BEFORE INSERT OR UPDATE ON public.actions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_facility_isolation();

DROP TRIGGER IF EXISTS trg_facility_isolation_audits ON public.audits;
CREATE TRIGGER trg_facility_isolation_audits
    BEFORE INSERT OR UPDATE ON public.audits
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_facility_isolation();

DROP TRIGGER IF EXISTS trg_facility_isolation_assets ON public.assets;
CREATE TRIGGER trg_facility_isolation_assets
    BEFORE INSERT OR UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_facility_isolation();

DROP TRIGGER IF EXISTS trg_facility_isolation_satisfaction ON public.satisfaction_ratings;
CREATE TRIGGER trg_facility_isolation_satisfaction
    BEFORE INSERT OR UPDATE ON public.satisfaction_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_facility_isolation();


-- 3. RLS Sertleştirmesi: Kullanıcılar yalnızca kendi tesislerini listeleyebilir
DROP POLICY IF EXISTS "facilities_user_own_facility_select" ON public.facilities;
CREATE POLICY "facilities_user_own_facility_select"
    ON public.facilities
    FOR SELECT
    TO authenticated
    USING (
        company_id = public.get_user_company_id()
        AND (
            id = public.get_user_facility_id()
            OR public.get_user_facility_id() IS NULL -- Henüz seçim yapmamış kullanıcılar ilk seçimde kendi şirket tesislerini görür
            OR public.has_role_or_higher('company_admin') -- Yöneticiler tüm şirket tesislerini görebilir
        )
    );
