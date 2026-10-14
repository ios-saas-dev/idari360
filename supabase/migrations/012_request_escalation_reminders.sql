-- ============================================================================
-- 012: TALEP 24 SAAT ESKALASYON VE BİLDİRİM ZAMAN DAMGALARI
-- ============================================================================
-- 1. Talep karşılanmazsa (yeni statüsünde kalırsa):
--    24 saatte bir tesisin tüm yetkililerine (facility_manager, facility_officer, company_admin) mail gönderilir.
--    last_unassigned_reminder_at sütununda son mail gönderim zamanı tutulur.
-- 2. Talep karşılandıktan sonra (islemde statüsünde):
--    24 saat içinde kapatılmazsa (çözümlenmez veya reddedilmezse) karşılayan kişiye (assigned_to) mail gönderilir.
--    last_in_progress_reminder_at sütununda son hatırlatma zamanı tutulur.
-- ============================================================================

ALTER TABLE requests ADD COLUMN IF NOT EXISTS last_unassigned_reminder_at TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS last_in_progress_reminder_at TIMESTAMPTZ;

-- Hızlı sorgulama için kısmi indeksler (Partial Indexes)
CREATE INDEX IF NOT EXISTS idx_requests_unassigned_escalation 
ON requests (status, created_at, last_unassigned_reminder_at) 
WHERE status = 'yeni';

CREATE INDEX IF NOT EXISTS idx_requests_in_progress_escalation 
ON requests (status, assigned_at, last_in_progress_reminder_at) 
WHERE status = 'islemde';
