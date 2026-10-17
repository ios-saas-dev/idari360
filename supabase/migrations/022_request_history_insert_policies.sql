-- ==============================================================================
-- İDARİ360 - MIGRATION 022: REQUEST_HISTORY INSERT POLİTİKALARI (kritik düzeltme)
-- ==============================================================================
-- Sorun: request_history tablosunda yalnızca super_admin ve company_admin için
-- ALL politikası; tesis rolleri (facility_manager/facility_officer) ve çalışanlar
-- için yalnızca SELECT politikaları vardı. Bu roller iş akışı geçişlerinde
-- tarihçe kaydı eklerken RLS'e sessizce takılıyordu (tarihçe boş kalıyordu).
-- Çözüm: Tesis rolleri kendi tesislerindeki talep için, çalışanlar da kendi
-- açtıkları talep için changed_by = auth.uid() koşuluyla ekleme yapabilir.
-- ==============================================================================

DROP POLICY IF EXISTS "request_history_facility_roles_insert" ON public.request_history;
CREATE POLICY "request_history_facility_roles_insert"
    ON public.request_history
    FOR INSERT
    TO authenticated
    WITH CHECK (
        changed_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.requests r
            WHERE r.id = request_history.request_id
              AND r.company_id = public.get_user_company_id()
              AND (r.facility_id = public.get_user_facility_id() OR public.get_user_facility_id() IS NULL)
              AND public.has_role_or_higher('facility_officer')
        )
    );

DROP POLICY IF EXISTS "request_history_employee_insert" ON public.request_history;
CREATE POLICY "request_history_employee_insert"
    ON public.request_history
    FOR INSERT
    TO authenticated
    WITH CHECK (
        changed_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.requests r
            WHERE r.id = request_history.request_id
              AND r.company_id = public.get_user_company_id()
              AND r.created_by = auth.uid()
        )
    );
