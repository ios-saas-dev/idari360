-- =============================================================================
-- 020: NOTIFICATIONS INSERT POLİTİKASI (kritik düzeltme)
-- =============================================================================
-- Sorun: notifications tablosunda INSERT politikası tanımlı değildi; yalnızca
-- super_admin (ALL) geçebiliyordu. Kullanıcı oturumuyla çalışan API rotaları
-- (talep oluşturma/durum, denetim sonucu, aksiyon bildirimleri) in-app
-- bildirim eklerken RLS'e sessizce takılıyordu.
-- Çözüm: Kullanıcılar yalnızca kendi şirketleri adına bildirim ekleyebilir.
-- =============================================================================

DROP POLICY IF EXISTS "notifications_company_insert" ON public.notifications;

CREATE POLICY "notifications_company_insert"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
  );
