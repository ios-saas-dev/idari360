/**
 * İdari360 - Güvenli Dosya ve Medya Doğrulama Yardımcısı
 * 
 * Bu modül, dosya yüklemelerinde uzantı hilelerini (extension spoofing) önlemek için
 * dosya başlık baytlarını (magic numbers / signatures) doğrular, dosya adlarını
 * dizin atlatma (path traversal) saldırılarına karşı temizler ve boyut kontrolleri yapar.
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFilename?: string;
  detectedMimeType?: string;
}

// Desteklenen MIME tipleri ve dosya başlık sihirli baytları (Magic Bytes)
const MAGIC_NUMBERS: Record<string, { bytes: number[]; offset?: number }> = {
  'image/jpeg': { bytes: [0xFF, 0xD8, 0xFF] },
  'image/png': { bytes: [0x89, 0x50, 0x4E, 0x47] },
  'image/webp': { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF formatı
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
};

const BUCKET_LIMITS: Record<string, { maxSizeMb: number; allowedMimes: string[] }> = {
  'audit-photos': {
    maxSizeMb: 10,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  'action-evidence': {
    maxSizeMb: 15,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  'request-attachments': {
    maxSizeMb: 20,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  'company-assets': {
    maxSizeMb: 5,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

/**
 * Dosya adını sanitize eder, özel ve tehlikeli karakterleri temizler.
 * Path Traversal (../../) saldırılarını engeller.
 */
export function sanitizeFileName(fileName: string): string {
  // Yalnızca alfanümerik, tire, alt tire ve nokta bırak
  const clean = fileName
    .replace(/^.*[\\\/]/, '') // Dizin yollarını at
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Güvenli olmayan karakterleri _ yap
    .replace(/\.{2,}/g, '.'); // Çift noktaları tek noktaya indir
  
  return clean || `upload_${Date.now()}`;
}

/**
 * Dosyanın ilk baytlarını (Magic Bytes) okuyup gerçek türünü doğrular.
 */
export async function validateFileIntegrity(
  file: File | Blob,
  bucketName: string,
  fileName: string
): Promise<FileValidationResult> {
  const bucketConfig = BUCKET_LIMITS[bucketName];
  if (!bucketConfig) {
    return { isValid: false, error: `Geçersiz depolama alanı: ${bucketName}` };
  }

  // 1. Boyut Kontrolü
  const maxBytes = bucketConfig.maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      isValid: false,
      error: `Dosya boyutu sınırı aşıldı. Maksimum izin verilen: ${bucketConfig.maxSizeMb} MB`,
    };
  }

  // 2. Magic Byte Kontrolü
  try {
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let detectedMime: string | undefined;

    for (const [mime, config] of Object.entries(MAGIC_NUMBERS)) {
      const match = config.bytes.every((expectedByte, index) => {
        return bytes[index] === expectedByte;
      });
      if (match) {
        detectedMime = mime;
        break;
      }
    }

    if (!detectedMime || !bucketConfig.allowedMimes.includes(detectedMime)) {
      return {
        isValid: false,
        error: `Dosya formatı güvenlik denetiminden geçemedi veya sahte dosya başlığı tespit edildi. İzin verilen türler: ${bucketConfig.allowedMimes.join(', ')}`,
      };
    }

    const sanitized = sanitizeFileName(fileName);

    return {
      isValid: true,
      sanitizedFilename: sanitized,
      detectedMimeType: detectedMime,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Dosya içeriği incelenirken hata oluştu: ${err?.message || 'Bilinmeyen hata'}`,
    };
  }
}
