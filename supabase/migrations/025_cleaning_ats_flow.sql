-- ============================================================================
-- 025 · Temizlik modülü derinleştirme (Paket 6 / Temizlik)
--
-- 1) cleaning_staff.supervisor_id → organizasyon şeması (bağlı olduğu kişi)
-- 2) cleaning_plans + cleaning_plan_history → ATS akışı:
--    "Temizlik firması tarih önerir → şube yöneticisine bildirim gider →
--     şube Onayla / Yeni Tarih Öner → plan kesinleşir →
--     temizlik fotoğraf ve not ile tamamlanır"
-- ============================================================================

-- 1. Organizasyon şeması: personel hiyerarşisi
ALTER TABLE cleaning_staff
    ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES cleaning_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cleaning_staff_supervisor_id ON cleaning_staff(supervisor_id);

-- ----------------------------------------------------------------------------
-- 2. ATS — Planlı temizlik akışı
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cleaning_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    area VARCHAR(255),
    planned_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'oneri'
        CHECK (status IN ('oneri', 'onaylandi', 'tamamlandi', 'iptal')),
    notes TEXT,
    completion_note TEXT,
    photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS cleaning_plan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES cleaning_plans(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL
        CHECK (action IN ('oneri', 'onay', 'yeni_tarih', 'tamamla', 'iptal')),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_plans_company_id ON cleaning_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_plans_facility_id ON cleaning_plans(facility_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_plans_status ON cleaning_plans(status);
CREATE INDEX IF NOT EXISTS idx_cleaning_plans_planned_date ON cleaning_plans(planned_date);
CREATE INDEX IF NOT EXISTS idx_cleaning_plan_history_plan_id ON cleaning_plan_history(plan_id);

DROP TRIGGER IF EXISTS trg_cleaning_plans_updated_at ON cleaning_plans;
CREATE TRIGGER trg_cleaning_plans_updated_at
    BEFORE UPDATE ON cleaning_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS — cleaning_staff/cleaning_equipment deseniyle birebir
-- ----------------------------------------------------------------------------
ALTER TABLE cleaning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_plan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cleaning_plans_super_admin_all" ON cleaning_plans;
DROP POLICY IF EXISTS "cleaning_plans_company_admin_all" ON cleaning_plans;
DROP POLICY IF EXISTS "cleaning_plans_facility_manage" ON cleaning_plans;
DROP POLICY IF EXISTS "cleaning_plans_member_select" ON cleaning_plans;

CREATE POLICY "cleaning_plans_super_admin_all"
  ON cleaning_plans
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "cleaning_plans_company_admin_all"
  ON cleaning_plans
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "cleaning_plans_facility_manage"
  ON cleaning_plans
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "cleaning_plans_member_select"
  ON cleaning_plans
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role_or_higher('company_admin')
      OR facility_id = public.get_user_facility_id()
    )
  );

DROP POLICY IF EXISTS "cleaning_plan_history_super_admin_all" ON cleaning_plan_history;
DROP POLICY IF EXISTS "cleaning_plan_history_company_admin_all" ON cleaning_plan_history;
DROP POLICY IF EXISTS "cleaning_plan_history_facility_manage" ON cleaning_plan_history;
DROP POLICY IF EXISTS "cleaning_plan_history_member_select" ON cleaning_plan_history;

CREATE POLICY "cleaning_plan_history_super_admin_all"
  ON cleaning_plan_history
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "cleaning_plan_history_company_admin_all"
  ON cleaning_plan_history
  FOR ALL
  TO authenticated
  USING (
    public.has_role_or_higher('company_admin')
    AND EXISTS (
      SELECT 1 FROM cleaning_plans p
      WHERE p.id = plan_id AND p.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    public.has_role_or_higher('company_admin')
    AND EXISTS (
      SELECT 1 FROM cleaning_plans p
      WHERE p.id = plan_id AND p.company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "cleaning_plan_history_facility_manage"
  ON cleaning_plan_history
  FOR ALL
  TO authenticated
  USING (
    public.has_role_or_higher('facility_officer')
    AND EXISTS (
      SELECT 1 FROM cleaning_plans p
      WHERE p.id = plan_id
        AND p.company_id = public.get_user_company_id()
        AND p.facility_id = public.get_user_facility_id()
    )
  )
  WITH CHECK (
    public.has_role_or_higher('facility_officer')
    AND EXISTS (
      SELECT 1 FROM cleaning_plans p
      WHERE p.id = plan_id
        AND p.company_id = public.get_user_company_id()
        AND p.facility_id = public.get_user_facility_id()
    )
  );

CREATE POLICY "cleaning_plan_history_member_select"
  ON cleaning_plan_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cleaning_plans p
      WHERE p.id = plan_id
        AND p.company_id = public.get_user_company_id()
        AND (
          public.has_role_or_higher('company_admin')
          OR p.facility_id = public.get_user_facility_id()
        )
    )
  );
