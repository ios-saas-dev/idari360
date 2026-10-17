// ─── İstemci Tarafı Görsel Sıkıştırma ─────────────────────────────────────
// Telefon kameraları 5-15 MB arası fotoğraf üretir; sunucu tarafında istek
// gövdesi sınırı ~4.5 MB'tır. Yükleme öncesi fotoğraflar tarayıcıda küçültülüp
// JPEG'e çevrilir; zaten küçük olan dosyalar olduğu gibi bırakılır.
// Tarayıcının çözemediği türlerde (ör. Chrome + HEIC) orijinal dosya döner.

const DEFAULT_MAX_DIM = 1920;
const DEFAULT_QUALITY = 0.85;
// Bu boyutun altındaki ve büyütme gerektirmeyen görseller yeniden kodlanmaz
const PASS_THROUGH_LIMIT = 3.5 * 1024 * 1024;

export async function compressImage(
  file: File,
  maxDim: number = DEFAULT_MAX_DIM,
  quality: number = DEFAULT_QUALITY
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= PASS_THROUGH_LIMIT) {
      bitmap.close?.();
      return file;
    }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    // Sıkıştırma fayda sağlamadıysa orijinali gönder
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
