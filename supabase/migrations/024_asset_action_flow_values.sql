-- 024 · Varlık akışı zenginleştirme (Paket 6 / Varlık)
-- asset_action enum'una iki yeni işlem ekler:
--   * bakim_cikis → "Bakımdan Çıkış" (bakım tamamlandı; zimmetliyse devirde, değilse aktif)
--   * bulundu     → "Bulundu" (kayıp varlık bulundu; zimmetliyse devirde, değilse aktif)
-- Mevcut 7 işlem korunur: zimmet, devir, iade, ariza, bakim, kayip, hurda

ALTER TYPE asset_action ADD VALUE IF NOT EXISTS 'bakim_cikis';
ALTER TYPE asset_action ADD VALUE IF NOT EXISTS 'bulundu';
