-- ============================================================================
-- 018_action_overdue_reminder.sql
-- Aksiyon gecikme bildirimi (Excel kuralı: "Gecikti ise bildirim gelmeli")
-- ----------------------------------------------------------------------------
-- Termin tarihi geçen aksiyonlar için cron (api/cron/action-overdue) sorumluya
-- e-posta + uygulama içi bildirim gönderir. Aynı aksiyon için bildirimin her
-- cron çalışmasında tekrar tekrar gitmesini önlemek üzere son bildirim zamanı
-- damgalanır.
-- ============================================================================

ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS overdue_notified_at timestamp with time zone;

COMMENT ON COLUMN public.actions.overdue_notified_at IS
  'Gecikme bildiriminin gönderildiği zaman. NULL ise henüz gecikme bildirimi gönderilmedi (cron: /api/cron/action-overdue).';

-- Gecikmiş ve henüz bildirilmemiş aksiyonların hızlı bulunması için kısmi indeks
CREATE INDEX IF NOT EXISTS idx_actions_overdue_pending
  ON public.actions (due_date)
  WHERE status <> 'kapali' AND overdue_notified_at IS NULL;
