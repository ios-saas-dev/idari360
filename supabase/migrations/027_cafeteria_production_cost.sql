-- ============================================================================
-- 027: Yemekhane üretim/tüketim/maliyet alanları + günlük memnuniyet anketi
-- ============================================================================

-- 1) cafeteria_menus: üretim (kg), tüketim (kg), fire (kg), porsiyon maliyeti (TL)
ALTER TABLE public.cafeteria_menus
  ADD COLUMN IF NOT EXISTS produced_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS consumed_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS waste_kg    numeric(10,2),
  ADD COLUMN IF NOT EXISTS unit_cost   numeric(10,2);

COMMENT ON COLUMN public.cafeteria_menus.produced_kg IS 'Üretilen yemek miktarı (kg) — üretim/sevkiyat kaydı';
COMMENT ON COLUMN public.cafeteria_menus.consumed_kg IS 'Tüketilen yemek miktarı (kg)';
COMMENT ON COLUMN public.cafeteria_menus.waste_kg    IS 'Fire / zayiat miktarı (kg)';
COMMENT ON COLUMN public.cafeteria_menus.unit_cost   IS 'Porsiyon başı maliyet (TL)';

-- 2) Günlük yemekhane değerlendirmesi: kullanıcı + gün başına tek kayıt
--    (talep memnuniyetleri request_id ile ayrışır, bu index onları kapsamaz)
CREATE UNIQUE INDEX IF NOT EXISTS uq_satisfaction_cafeteria_daily
  ON public.satisfaction_ratings (user_id, period)
  WHERE (module = 'yemekhane' AND request_id IS NULL);

-- 3) Çalışan kendi GÜNLÜK YEMEKHANE değerlendirmesini aynı gün güncelleyebilsin
--    (talep anketleri bu politikadan etkilenmez: module = 'yemekhane' şartı var)
DROP POLICY IF EXISTS satisfaction_ratings_employee_update_own ON public.satisfaction_ratings;
CREATE POLICY satisfaction_ratings_employee_update_own ON public.satisfaction_ratings
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) AND (module = 'yemekhane') AND (company_id = get_user_company_id()))
  WITH CHECK ((user_id = auth.uid()) AND (module = 'yemekhane') AND (company_id = get_user_company_id()));
