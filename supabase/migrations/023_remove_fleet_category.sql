-- 023 · Filo modülü kaldırıldı (kullanıcı kararı · 17.10.2026)
-- Filo yönetimi sayfası ve tüm arayüz referansları kaldırıldı.
-- Bu migration, request_category enum'undan 'filo' değerini güvenli şekilde çıkarır.
-- Emniyet: mevcut 'filo' talepleri (varsa) 'diger' kategorisine taşınır; veri kaybı olmaz.

DO $$
BEGIN
    -- 1) Varsa 'filo' kategorili talepleri 'diger'e taşı (canlıda veri yok, emniyet amaçlı)
    UPDATE requests SET category = 'diger' WHERE category::text = 'filo';

    -- 2) Enum'da 'filo' hâlâ tanımlıysa tipi yeniden oluştur
    IF EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'request_category' AND e.enumlabel = 'filo'
    ) THEN
        ALTER TYPE request_category RENAME TO request_category_old;
        CREATE TYPE request_category AS ENUM (
            'yemekhane',
            'servis',
            'temizlik',
            'varlik',
            'teknik',
            'diger'
        );
        ALTER TABLE requests ALTER COLUMN category DROP DEFAULT;
        ALTER TABLE requests ALTER COLUMN category TYPE request_category
            USING category::text::request_category;
        ALTER TABLE requests ALTER COLUMN category SET DEFAULT 'diger';
        DROP TYPE request_category_old;
    END IF;
END $$;
