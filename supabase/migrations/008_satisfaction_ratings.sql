-- ==============================================================================
-- İDARİ360 - MIGRATION 008: MEMNUNİYET VE DEĞERLENDİRME TABLOSU (SATISFACTION RATINGS)
-- ==============================================================================

-- 1. Memnuniyet Değerlendirmeleri Tablosu
CREATE TABLE IF NOT EXISTS public.satisfaction_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    module VARCHAR(50) NOT NULL, -- yemekhane, servis, temizlik, guvenlik (filo kaldırıldı · migration 023)
    score NUMERIC(2,1) NOT NULL CHECK (score >= 1.0 AND score <= 5.0),
    comment TEXT,
    period DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_satisfaction_company ON public.satisfaction_ratings(company_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_facility ON public.satisfaction_ratings(facility_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_module ON public.satisfaction_ratings(module);
CREATE INDEX IF NOT EXISTS idx_satisfaction_created_at ON public.satisfaction_ratings(created_at);

-- 2. Row Level Security (RLS) Aç
ALTER TABLE public.satisfaction_ratings ENABLE ROW LEVEL SECURITY;

-- Politikalar
DROP POLICY IF EXISTS "satisfaction_ratings_super_admin_all" ON public.satisfaction_ratings;
DROP POLICY IF EXISTS "satisfaction_ratings_company_admin_select" ON public.satisfaction_ratings;
DROP POLICY IF EXISTS "satisfaction_ratings_facility_manage_select" ON public.satisfaction_ratings;
DROP POLICY IF EXISTS "satisfaction_ratings_employee_insert" ON public.satisfaction_ratings;
DROP POLICY IF EXISTS "satisfaction_ratings_employee_select_own" ON public.satisfaction_ratings;

CREATE POLICY "satisfaction_ratings_super_admin_all"
    ON public.satisfaction_ratings
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "satisfaction_ratings_company_admin_select"
    ON public.satisfaction_ratings
    FOR SELECT
    TO authenticated
    USING (
        company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    );

CREATE POLICY "satisfaction_ratings_facility_manage_select"
    ON public.satisfaction_ratings
    FOR SELECT
    TO authenticated
    USING (
        company_id = public.get_user_company_id()
        AND facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    );

CREATE POLICY "satisfaction_ratings_employee_insert"
    ON public.satisfaction_ratings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = public.get_user_company_id()
        AND (facility_id = public.get_user_facility_id() OR public.get_user_facility_id() IS NULL)
        AND user_id = auth.uid()
    );

CREATE POLICY "satisfaction_ratings_employee_select_own"
    ON public.satisfaction_ratings
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        AND company_id = public.get_user_company_id()
    );

-- 3. Firma İzolasyonu Tetikleyicisi
DROP TRIGGER IF EXISTS trg_enforce_company_isolation ON public.satisfaction_ratings;
CREATE TRIGGER trg_enforce_company_isolation
    BEFORE INSERT OR UPDATE ON public.satisfaction_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_company_isolation();
