-- ============================================================================
-- 026 — Tedarikçi karne otomatik besleme
-- Puan kaydında hangi kriterlerin hangi veri kaynağından (kaç kayıttan)
-- otomatik doldurulduğunu saklar. Örnek: {"audit_results": 12, "timeliness": 8}
-- ============================================================================
ALTER TABLE supplier_scores
    ADD COLUMN IF NOT EXISTS auto_sources JSONB;

COMMENT ON COLUMN supplier_scores.auto_sources IS
    'Otomatik doldurulan kriterler ve kaynak kayıt sayıları (örn. {"audit_results": 12})';

-- ============================================================================
-- RLS düzeltmesi: tedarikçi düzenleme/silme tesis müdürüne (facility_manager)
-- de açılır. API rotaları müdür+ yetkisiyle çalışıyor; DB politikaları eski
-- kurulumdan yalnız company_admin'e izin veriyordu (tutarsızlık).
-- ============================================================================
DROP POLICY IF EXISTS suppliers_company_admin_all ON suppliers;
DROP POLICY IF EXISTS suppliers_manager_all ON suppliers;
CREATE POLICY suppliers_manager_all ON suppliers
    FOR ALL TO authenticated
    USING ((company_id = get_user_company_id()) AND has_role_or_higher('facility_manager'::app_role))
    WITH CHECK ((company_id = get_user_company_id()) AND has_role_or_higher('facility_manager'::app_role));

DROP POLICY IF EXISTS supplier_scores_company_admin_all ON supplier_scores;
DROP POLICY IF EXISTS supplier_scores_manager_all ON supplier_scores;
CREATE POLICY supplier_scores_manager_all ON supplier_scores
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = supplier_scores.supplier_id
              AND s.company_id = get_user_company_id()
              AND has_role_or_higher('facility_manager'::app_role)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = supplier_scores.supplier_id
              AND s.company_id = get_user_company_id()
              AND has_role_or_higher('facility_manager'::app_role)
        )
    );

