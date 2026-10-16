-- ============================================================================
-- 016 - SERVİS DENETİMİ: ARAÇ BAZLI DENETİM AKIŞI
--
-- Denetimlerin bir servis aracına bağlanabilmesi için:
--   * audits.service_vehicle_id  → Denetim hangi araç için yapıldı
--   * actions.service_vehicle_id → Denetimden doğan aksiyonlar hangi araca ait
--
-- Araç silinirse denetim/aksiyon kayıtları korunur (SET NULL).
-- ============================================================================

ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS service_vehicle_id UUID REFERENCES public.service_vehicles(id) ON DELETE SET NULL;

ALTER TABLE public.actions
ADD COLUMN IF NOT EXISTS service_vehicle_id UUID REFERENCES public.service_vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audits_service_vehicle_id ON public.audits(service_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_actions_service_vehicle_id ON public.actions(service_vehicle_id);
