-- ==============================================================================
-- İDARİ360 - MIGRATION 007: RPC GÜVENLİĞİ VE FONKSİYON YETKİLERİNİN SERTLEŞTİRİLMESİ
-- ==============================================================================

-- 1. security_cleanup_expired_records: Sadece service_role tarafından çalıştırılabilir
REVOKE EXECUTE ON FUNCTION public.security_cleanup_expired_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_cleanup_expired_records() TO service_role;

-- 2. generate_otp_code: SADECE BACKEND / service_role ÇAĞIRABİLİR!
-- Anonim kullanıcılar PostgREST üzerinden doğrudan çağırıp onay kodunu HTTP yanıtında göremez.
-- Kod yalnızca Next.js backend API üzerinden e-posta gönderme amacıyla üretilir.
REVOKE EXECUTE ON FUNCTION public.generate_otp_code(text, otp_purpose, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_otp_code(text, otp_purpose, integer) TO service_role;

-- 3. check_rate_limit: Anonim erişim kapatıldı, authenticated ve service_role yetkili
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO authenticated, service_role;

-- 4. Dahili Güvenlik Fonksiyonları: Anonim RPC çağrıları kapatıldı
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_facility_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_facility_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role_or_higher(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role_or_higher(app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_manage_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.role_level(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_level(app_role) TO authenticated, service_role;

-- 5. verify_otp_code: Hem anonim hem authenticated kullanıcılar doğrulama yapabilir
-- (Kullanıcı e-postasındaki kodu doğrulamak için çağırır, brute-force korumalıdır)
GRANT EXECUTE ON FUNCTION public.verify_otp_code(text, text, otp_purpose) TO anon, authenticated, service_role;
