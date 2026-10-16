-- ============================================================================
-- 015 - protect_primary_super_admin Trigger Hatası Düzeltmesi
--
-- SORUN: 004 migration'ında oluşturulan protect_primary_super_admin() fonksiyonu
-- DELETE işlemlerinde de 'RETURN NEW' döndürüyordu. PostgreSQL'de DELETE
-- trigger'larında NEW kaydı NULL'dur ve NULL döndürmek satır silmeyi SESSİZCE
-- iptal eder. Bu nedenle:
--   * Hiçbir profil satırı silinemiyordu (auth kullanıcısı silinse bile profil
--     yetim kalıyordu — CASCADE silme de bu trigger tarafından iptal ediliyordu).
--   * Admin paneli üzerinden kullanıcı silme işlemleri profil tarafında
--     başarısız oluyordu.
--
-- ÇÖZÜM: DELETE için OLD, UPDATE/INSERT için NEW döndürülür. Birincil süper
-- admin koruması aynen korunur.
-- ============================================================================

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
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF LOWER(OLD.email) = LOWER(v_primary) THEN
            RAISE EXCEPTION 'Kritik Güvenlik Kuralı: Birincil Süper Admin hesabı silinemez.';
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
