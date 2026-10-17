-- =============================================================================
-- 019: PLANLI DENETİMLER + AKSİYON KAPATMA ONAY AKIŞI (Paket 2)
-- =============================================================================
-- A) Planlı denetimler: audits.planned_date
--    - Doluysa denetim "planlı" kabul edilir; planlanan tarihe 7/3/1 gün kala ve
--      tarih geçince /api/cron/daily (audit-reminders) otomatik hatırlatma üretir.
--    - Tekrar gönderim audit_reminder_log kaydıyla engellenir.
-- B) Aksiyon kapatma onay akışı (Excel: "Firma tamamladı → onayınız bekleniyor"):
--    acik/devam_ediyor → onay_bekliyor (sorumlu çözümü bildirdi)
--    → kapali (yönetici onayladı) | devam_ediyor + rejection_note (yönetici reddetti)
-- =============================================================================

-- 1) PLANLI DENETİM TARİHİ
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS planned_date date;

COMMENT ON COLUMN public.audits.planned_date IS 'Denetimin yapılması planlanan tarih (planlı denetim hatırlatmaları için)';

CREATE INDEX IF NOT EXISTS idx_audits_planned_pending
  ON public.audits (planned_date)
  WHERE status IN ('draft', 'in_progress');

-- 2) AKSİYON ONAY AKIŞI: yeni durum + izleme kolonları
ALTER TYPE public.action_status ADD VALUE IF NOT EXISTS 'onay_bekliyor';

ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejection_note text;

COMMENT ON COLUMN public.actions.submitted_at IS 'Aksiyonun onaya gönderildiği zaman (kapatma onay akışı)';
COMMENT ON COLUMN public.actions.submitted_by IS 'Aksiyonu onaya gönderen kullanıcı';
COMMENT ON COLUMN public.actions.approved_by IS 'Kapatmayı onaylayan yönetici';
COMMENT ON COLUMN public.actions.approved_at IS 'Kapatma onayının verildiği zaman';
COMMENT ON COLUMN public.actions.rejection_note IS 'Onay reddinin gerekçesi (son red)';

-- 3) DENETİM HATIRLATMA KAYDI (7/3/1 gün + gecikme; tekrar gönderimi önler)
CREATE TABLE IF NOT EXISTS public.audit_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  kind text NOT NULL, -- upcoming_7 | upcoming_3 | upcoming_1 | overdue
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_reminder_log_audit_kind_key UNIQUE (audit_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_audit_reminder_log_audit ON public.audit_reminder_log (audit_id);

-- Yalnızca sunucu (service role) erişir; RLS açık, policy tanımsız.
ALTER TABLE public.audit_reminder_log ENABLE ROW LEVEL SECURITY;
