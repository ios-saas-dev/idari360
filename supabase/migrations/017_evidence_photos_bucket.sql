-- ============================================================================
-- 017 - KANIT FOTOĞRAFI DEPOLAMA (Storage Bucket + Politikalar)
--
-- Denetim uygunsuzluk kanıtları ve aksiyon (sonrası) fotoğrafları için
-- "evidence-photos" adında herkese açık okunabilir (public) bir bucket
-- oluşturur.
--
--   * Yükleme: yalnızca oturum açmış kullanıcılar (authenticated)
--   * İçerik:  yalnızca görsel MIME türleri (jpeg/png/webp/gif/heic/heif)
--   * Boyut:   en fazla 10 MB (storage katmanında zorlanır)
-- ============================================================================

-- 1. Bucket (görsel türleri ve 10 MB limiti storage katmanında zorunlu kılınır)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidence-photos',
    'evidence-photos',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

-- 2. Yükleme politikası: yalnızca giriş yapmış kullanıcılar bu bucket'a yükleyebilir
DROP POLICY IF EXISTS "evidence_photos_authenticated_insert" ON storage.objects;
CREATE POLICY "evidence_photos_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence-photos');

-- 3. Güncelleme (örn. üzerine yazma) politikası: yalnızca giriş yapmış kullanıcılar
DROP POLICY IF EXISTS "evidence_photos_authenticated_update" ON storage.objects;
CREATE POLICY "evidence_photos_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'evidence-photos')
WITH CHECK (bucket_id = 'evidence-photos');

-- 4. Silme politikası: yalnızca giriş yapmış kullanıcılar (temizlik için)
DROP POLICY IF EXISTS "evidence_photos_authenticated_delete" ON storage.objects;
CREATE POLICY "evidence_photos_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'evidence-photos');
