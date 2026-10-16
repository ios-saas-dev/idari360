-- ============================================================================
-- 014 - Servis Araçları: facility_manager RLS Politikası
--
-- Sorun: API rotaları (POST /api/shuttle/vehicles ve Excel içe aktarma)
-- 'facility_manager' rolünü yetkili kabul ediyor; ancak mevcut RLS politikası
-- yalnızca 'company_admin' ve üzerine (rol seviyesi >= 80) yazma izni veriyordu.
-- Bu nedenle facility_manager manuel araç eklerken
-- "new row violates row-level security policy" hatası alıyordu.
--
-- Çözüm: facility_manager'ın YALNIZCA kendi tesisindeki araçlar üzerinde
-- tam yetkili olmasını sağlayan ek politika. Politikalar OR ile birleştiği
-- için company_admin/super_admin davranışı değişmez.
-- ============================================================================

DROP POLICY IF EXISTS "service_vehicles_facility_manager_all" ON public.service_vehicles;

CREATE POLICY "service_vehicles_facility_manager_all"
  ON public.service_vehicles
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('facility_manager')
    AND facility_id = public.get_user_facility_id()
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('facility_manager')
    AND facility_id = public.get_user_facility_id()
  );
