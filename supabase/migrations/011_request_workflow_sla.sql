-- ============================================================================
-- 011: TALEP İŞ AKIŞI VE SLA METRİKLERİ (Request Workflow & SLA Metrics)
-- ============================================================================
-- Yeni iş akışı:
--   Açık (yeni) → Üzerime Alındı (islemde) → Çözümlendi (cozumlendi) / Reddedildi (reddedildi)
-- Zaman damgaları:
--   T1 = created_at (talep açılış zamanı)
--   T2 = assigned_at (üzerine alma zamanı)
--   T3 = closed_at  (kapanış zamanı)
-- SLA Metrikleri:
--   Karşılama Süresi = T2 - T1
--   Çözüm İşlem Süresi = T3 - T2
--   Toplam Süre = T3 - T1
-- ============================================================================

-- 1. Yeni enum değeri ekle: 'cozumlendi'
DO $$ BEGIN
    ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'cozumlendi' AFTER 'tamamlandi';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. requests tablosuna yeni sütunlar ekle
ALTER TABLE requests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS resolution_photos TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 3. SLA hesaplama: interval sütunları (denormalize, raporlama için hızlı erişim)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sla_response_minutes NUMERIC(10,2);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sla_resolution_minutes NUMERIC(10,2);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sla_total_minutes NUMERIC(10,2);

-- 4. Mevcut 'tamamlandi' olan talepleri 'cozumlendi' olarak güncelle (eski veri uyumluluğu)
UPDATE requests SET status = 'cozumlendi' WHERE status = 'tamamlandi';

-- 5. Mevcut 'atandi' veya 'onaylandi' olan talepleri 'islemde' olarak güncelle
UPDATE requests 
SET status = 'islemde', 
    assigned_at = COALESCE(assigned_at, updated_at)
WHERE status IN ('atandi', 'onaylandi');

-- 6. assigned_at backfill: Eğer assigned_to varsa ve assigned_at null ise
UPDATE requests 
SET assigned_at = updated_at
WHERE assigned_to IS NOT NULL AND assigned_at IS NULL AND status = 'islemde';

-- 7. closed_at backfill: Kapanmış talepler
UPDATE requests 
SET closed_at = updated_at
WHERE status IN ('cozumlendi', 'reddedildi') AND closed_at IS NULL;

-- 8. SLA backfill
UPDATE requests 
SET sla_response_minutes = EXTRACT(EPOCH FROM (assigned_at - created_at)) / 60.0
WHERE assigned_at IS NOT NULL AND sla_response_minutes IS NULL;

UPDATE requests 
SET sla_resolution_minutes = EXTRACT(EPOCH FROM (closed_at - assigned_at)) / 60.0
WHERE closed_at IS NOT NULL AND assigned_at IS NOT NULL AND sla_resolution_minutes IS NULL;

UPDATE requests 
SET sla_total_minutes = EXTRACT(EPOCH FROM (closed_at - created_at)) / 60.0
WHERE closed_at IS NOT NULL AND sla_total_minutes IS NULL;

-- 9. Trigger: Otomatik SLA hesaplama
CREATE OR REPLACE FUNCTION calculate_request_sla()
RETURNS TRIGGER AS $$
BEGIN
    -- T2: assigned_at - "Üzerime Al" basıldığında
    IF NEW.status = 'islemde' AND OLD.status = 'yeni' AND NEW.assigned_at IS NULL THEN
        NEW.assigned_at := clock_timestamp();
    END IF;
    
    -- T3: closed_at - "Çözüldü" veya "Reddedildi" basıldığında
    IF NEW.status IN ('cozumlendi', 'reddedildi') AND OLD.status NOT IN ('cozumlendi', 'reddedildi') AND NEW.closed_at IS NULL THEN
        NEW.closed_at := clock_timestamp();
    END IF;
    
    -- SLA hesapları
    IF NEW.assigned_at IS NOT NULL THEN
        NEW.sla_response_minutes := EXTRACT(EPOCH FROM (NEW.assigned_at - NEW.created_at)) / 60.0;
    END IF;
    
    IF NEW.closed_at IS NOT NULL AND NEW.assigned_at IS NOT NULL THEN
        NEW.sla_resolution_minutes := EXTRACT(EPOCH FROM (NEW.closed_at - NEW.assigned_at)) / 60.0;
    END IF;
    
    IF NEW.closed_at IS NOT NULL THEN
        NEW.sla_total_minutes := EXTRACT(EPOCH FROM (NEW.closed_at - NEW.created_at)) / 60.0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_request_sla ON requests;
CREATE TRIGGER trg_calculate_request_sla
    BEFORE UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION calculate_request_sla();

-- 10. İndeksler
CREATE INDEX IF NOT EXISTS idx_requests_assigned_at ON requests(assigned_at) WHERE assigned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_closed_at ON requests(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_status_company ON requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_category_company ON requests(company_id, category);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to) WHERE assigned_to IS NOT NULL;

-- 11. request_history tablosuna ek sütunlar (görsel ve çözüm notu)
ALTER TABLE request_history ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT ARRAY[]::TEXT[];
