-- ==============================================================================
-- İDARİ360 - MIGRATION 021: TALEP ONAY ADIMI + MEMNUNİYET ANKETİ
-- ==============================================================================
-- 1. Talep akışı Excel'e göre: Talep → Sorumlu → Onay → İşlem → Tamamlandı
--    requests.approved_at: yönetici onayı anı (T3)
--    requests.started_at : işleme başlama anı (T4)
-- 2. Memnuniyet anketi: talep kapanışında 1-5 puan (satisfaction_ratings.request_id)
--    - Talep başına tek değerlendirme (partial unique index)
-- ==============================================================================

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE public.satisfaction_ratings
    ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_satisfaction_request_id
    ON public.satisfaction_ratings(request_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_satisfaction_request_id
    ON public.satisfaction_ratings(request_id)
    WHERE request_id IS NOT NULL;

COMMENT ON COLUMN public.requests.approved_at IS 'Talebin yönetici tarafından onaylandığı an (T3: Onay)';
COMMENT ON COLUMN public.requests.started_at IS 'Talebin işleme alındığı an (T4: İşlem)';
COMMENT ON COLUMN public.satisfaction_ratings.request_id IS 'Memnuniyet değerlendirmesinin bağlı olduğu talep (kapanış anketi; talep başına tek kayıt)';
