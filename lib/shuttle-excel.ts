/**
 * İdari360 - Servis Aracı Excel Şablonu ve İçe Aktarma Yardımcısı
 *
 * Bu modül iki saf fonksiyon sağlar:
 *  - buildVehicleTemplateBuffer(): Kullanıcıların doldurması için hazır başlıklı,
 *    örnek ve kılavuz sekmeleri içeren bir .xlsx şablonu üretir.
 *  - parseVehicleWorkbook(): Yüklenen .xlsx dosyasını doğrular ve
 *    veritabanına yazılmaya hazır kayıtlara (ve hatalara) ayrıştırır.
 *
 * Veritabanı erişimi içermez; bu nedenle bağımsız olarak test edilebilir.
 */

import * as XLSX from 'xlsx';

/* ============================================================================
   TİPLER
============================================================================ */

export interface VehicleImportRecord {
  /** Excel'deki satır numarası (başlık 1. satırdır) */
  row: number;
  plate_number: string;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  capacity: number;
  driver_name: string | null;
  driver_phone: string | null;
  route_name: string | null;
  is_active: boolean;
}

export interface VehicleImportError {
  row: number;
  plate: string;
  message: string;
}

export interface VehicleParseResult {
  /** Dosya hiç işlenemediyse (başlık yok, boş vb.) dolu olur */
  fatalError?: string;
  records: VehicleImportRecord[];
  errors: VehicleImportError[];
  /** Başlık dışındaki dolu satır sayısı */
  totalRows: number;
}

/* ============================================================================
   SABİTLER
============================================================================ */

export const MAX_IMPORT_ROWS = 500;
export const MAX_FILE_SIZE_MB = 5;
export const DEFAULT_CAPACITY = 16;

interface ColumnDef {
  key: keyof Omit<VehicleImportRecord, 'row'>;
  header: string;
  /** Başlık eşleştirmede kabul edilen ek varyasyonlar (normalize edilir) */
  aliases: string[];
  required: boolean;
  example: string | number | boolean;
  format: string;
  guide: string;
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'plate_number',
    header: 'PLAKA',
    aliases: ['PLAKA NO', 'PLAKA NUMARASI', 'ARAÇ PLAKASI', 'ARAC PLAKASI'],
    required: true,
    example: '34 ABC 123',
    format: 'Örn: 34 ABC 123',
    guide: 'Zorunlu. Aracın plakası. Aynı plaka şirkette bir kez kayıtlı olabilir.',
  },
  {
    key: 'brand',
    header: 'MARKA',
    aliases: ['ARAÇ MARKASI', 'ARAC MARKASI'],
    required: false,
    example: 'Mercedes',
    format: 'Metin',
    guide: 'Aracın markası (Mercedes, Ford, Otokar vb.).',
  },
  {
    key: 'model',
    header: 'MODEL',
    aliases: ['ARAÇ MODELİ', 'ARAC MODELI'],
    required: false,
    example: 'Sprinter',
    format: 'Metin',
    guide: 'Aracın modeli (Sprinter, Transit vb.).',
  },
  {
    key: 'model_year',
    header: 'MODEL YILI',
    aliases: ['MODEL YIL', 'YIL', 'ARAÇ YILI', 'ARAC YILI'],
    required: false,
    example: 2022,
    format: '1990 - 2030 arası sayı',
    guide: 'Aracın model yılı. Boş bırakılabilir.',
  },
  {
    key: 'capacity',
    header: 'KAPASİTE (KİŞİ)',
    aliases: ['KAPASİTE', 'KAPASITE', 'KAPASITE (KISI)', 'KİŞİ SAYISI', 'KISI SAYISI'],
    required: false,
    example: 16,
    format: '1 - 100 arası sayı',
    guide: 'Aracın kişi kapasitesi. Boş bırakılırsa 16 kabul edilir.',
  },
  {
    key: 'driver_name',
    header: 'ŞOFÖR ADI SOYADI',
    aliases: ['ŞOFÖR', 'SOFOR', 'SOFOR ADI SOYADI', 'ŞOFÖR ADI', 'SOFOR ADI', 'SÜRÜCÜ ADI SOYADI', 'SURUCU ADI SOYADI'],
    required: false,
    example: 'Ahmet Yılmaz',
    format: 'Metin',
    guide: 'Servis şoförünün adı ve soyadı.',
  },
  {
    key: 'driver_phone',
    header: 'ŞOFÖR TELEFONU',
    aliases: ['SOFOR TELEFONU', 'ŞOFÖR TELEFON', 'TELEFON', 'SÜRÜCÜ TELEFONU', 'SURUCU TELEFONU'],
    required: false,
    example: '0532 000 00 00',
    format: 'Örn: 0532 000 00 00',
    guide: 'Şoförün iletişim numarası.',
  },
  {
    key: 'route_name',
    header: 'GÜZERGAH ADI',
    aliases: ['GUZERGAH ADI', 'GÜZERGAH', 'GUZERGAH', 'SERVİS GÜZERGAHI', 'SERVIS GUZERGAHI'],
    required: false,
    example: 'Kadıköy - Fabrika Ana Hat',
    format: 'Metin',
    guide: 'Aracın çalışacağı servis güzergahının adı.',
  },
  {
    key: 'is_active',
    header: 'ARAÇ AKTİF Mİ (EVET/HAYIR)',
    aliases: ['ARAÇ AKTİF Mİ', 'ARAC AKTIF MI', 'AKTİF', 'AKTIF', 'DURUM', 'AKTİF Mİ', 'AKTIF MI'],
    required: false,
    example: 'EVET',
    format: 'EVET / HAYIR',
    guide: 'Araç aktifse EVET, pasifse HAYIR yazın. Boş bırakılırsa EVET kabul edilir.',
  },
];

const SHEET_DATA = 'Araçlar';
const SHEET_EXAMPLE = 'Örnek Doldurulmuş';
const SHEET_GUIDE = 'Kılavuz';

/* ============================================================================
   YARDIMCI FONKSİYONLAR
============================================================================ */

/** Başlık karşılaştırması için normalizasyon (Türkçe uyumlu büyük harf) */
function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('tr-TR');
}

/** Bir hücre metnini temizler; boşsa null döner */
function cleanText(value: unknown, maxLength: number): { value: string | null; error?: string } {
  if (value === null || value === undefined) return { value: null };
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (text === '') return { value: null };
  if (text.length > maxLength) {
    return { value: null, error: `Metin çok uzun (en fazla ${maxLength} karakter)` };
  }
  return { value: text };
}

/** Sayı ayrıştırma; başarısızsa null */
function toInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[.\s]/g, '').replace(',', '.');
    if (cleaned === '') return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? Math.trunc(num) : null;
  }
  return null;
}

/** EVET/HAYIR ve varyasyonlarını boolean'a çevirir */
function parseActive(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  const text = normalizeHeader(value);
  if (text === '') return null;
  if (['EVET', 'E', 'TRUE', 'DOĞRU', 'DOGRU', 'YES', '1', 'AKTİF', 'AKTIF', 'ACTIVE', 'AÇIK', 'ACIK'].includes(text)) return true;
  if (['HAYIR', 'H', 'FALSE', 'YANLIŞ', 'YANLIS', 'NO', '0', 'PASİF', 'PASIF', 'INACTIVE', 'KAPALI'].includes(text)) return false;
  return null;
}

/** Türk plakası normalizasyonu: kırp, boşlukları sadeleştir, büyük harfe çevir */
export function normalizePlate(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Dosya içi mükerrer kontrolü için plaka anahtarı */
function plateKey(plate: string): string {
  return plate.replace(/\s+/g, '');
}

/* ============================================================================
   1. ŞABLON ÜRETİMİ
============================================================================ */

/**
 * Hazır başlıklı servis aracı şablonu üretir.
 * Sekmeler: "Araçlar" (boş, doldurulacak), "Örnek Doldurulmuş", "Kılavuz".
 */
export function buildVehicleTemplateBuffer(): Buffer {
  const headers = COLUMNS.map((c) => c.header);

  /* --- Sekme 1: Araçlar (doldurulacak boş şablon) --- */
  const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
  dataSheet['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 4, 18) }));

  /* --- Sekme 2: Örnek Doldurulmuş --- */
  const exampleRows: (string | number)[][] = [
    headers,
    ['34 ORN 001', 'Mercedes', 'Sprinter', 2022, 16, 'Ahmet Yılmaz', '0532 000 00 00', 'Kadıköy - Fabrika Ana Hat', 'EVET'],
    ['06 ORN 002', 'Ford', 'Transit', 2021, 14, 'Ayşe Demir', '0542 111 22 33', 'Çankaya - Genel Merkez', 'EVET'],
    ['35 ORN 003', 'Otokar', 'Sultan', 2023, 27, 'Mehmet Kaya', '0555 444 55 66', 'Bornova - Depo Hattı', 'HAYIR'],
  ];
  const exampleSheet = XLSX.utils.aoa_to_sheet(exampleRows);
  exampleSheet['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 4, 18) }));

  /* --- Sekme 3: Kılavuz --- */
  const guideRows: (string | number)[][] = [
    ['SERVİS ARACI TOPLU YÜKLEME KILAVUZU'],
    [''],
    ['1) Verilerinizi "Araçlar" sekmesine girin. Nasıl doldurulacağını görmek için "Örnek Doldurulmuş" sekmesine bakın.'],
    ['2) Sadece dolu satırlar içe aktarılır; boş satırlar otomatik atlanır.'],
    ['3) Örnek sekmesindeki satırlar yüklenmez; yalnızca "Araçlar" sekmesi okunur.'],
    [`4) Tek seferde en fazla ${MAX_IMPORT_ROWS} satır aktarılabilir.`],
    ['5) Sistemde kayıtlı bir plaka tekrar eklenmeye çalışılırsa o satır atlanır ve raporlanır.'],
    [''],
    ['ALAN', 'ZORUNLU', 'FORMAT / AÇIKLAMA', 'ÖRNEK'],
    ...COLUMNS.map((c) => [c.header, c.required ? 'EVET' : 'HAYIR', `${c.format}. ${c.guide}`, String(c.example)]),
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 80 }, { wch: 30 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, SHEET_DATA);
  XLSX.utils.book_append_sheet(workbook, exampleSheet, SHEET_EXAMPLE);
  XLSX.utils.book_append_sheet(workbook, guideSheet, SHEET_GUIDE);

  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return Buffer.from(output);
}

/* ============================================================================
   2. DOSYA AYRIŞTIRMA
============================================================================ */

/** Bir sayfanın başlık satırından kolon indekslerini çözer */
function resolveColumnIndexes(headerRow: unknown[]): {
  indexes: Partial<Record<ColumnDef['key'], number>>;
  matched: number;
} {
  const normalized = headerRow.map((h) => normalizeHeader(h));
  const indexes: Partial<Record<ColumnDef['key'], number>> = {};
  let matched = 0;

  for (const col of COLUMNS) {
    const candidates = [col.header, ...col.aliases].map((h) => normalizeHeader(h));
    const idx = normalized.findIndex((actual) => {
      if (!actual) return false;
      return candidates.some((candidate) => actual === candidate || actual.startsWith(candidate));
    });
    if (idx >= 0) {
      indexes[col.key] = idx;
      matched += 1;
    }
  }
  return { indexes, matched };
}

/**
 * Yüklenen Excel dosyasını ayrıştırır ve doğrular.
 * Öncelikle "Araçlar" sekmesini, yoksa PLAKA başlığı içeren ilk sekmeyi okur.
 */
export function parseVehicleWorkbook(buffer: Buffer | Uint8Array): VehicleParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  } catch {
    return {
      fatalError: 'Dosya okunamadı. Lütfen geçerli bir Excel (.xlsx) dosyası yükleyin.',
      records: [],
      errors: [],
      totalRows: 0,
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      fatalError: 'Excel dosyasında sayfa bulunamadı.',
      records: [],
      errors: [],
      totalRows: 0,
    };
  }

  // Sekme seçimi: önce "Araçlar", sonra başlığı eşleşen ilk sekme
  const sheetOrder = workbook.SheetNames.includes(SHEET_DATA)
    ? [SHEET_DATA, ...workbook.SheetNames.filter((n) => n !== SHEET_DATA)]
    : workbook.SheetNames;

  let headerRow: unknown[] | null = null;
  let dataRows: unknown[][] = [];

  for (const sheetName of sheetOrder) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    if (matrix.length === 0) continue;
    const candidateHeader = matrix[0] || [];
    const { indexes, matched } = resolveColumnIndexes(candidateHeader);
    // PLAKA zorunlu + en az 3 kolon eşleşmesi aranır
    if (indexes.plate_number !== undefined && matched >= 3) {
      headerRow = candidateHeader;
      dataRows = matrix.slice(1);
      break;
    }
  }

  if (!headerRow) {
    return {
      fatalError:
        'Başlık satırı bulunamadı. Lütfen indirdiğiniz şablonu kullanın ("Araçlar" sekmesindeki PLAKA, MARKA, MODEL... başlıkları korunmalıdır).',
      records: [],
      errors: [],
      totalRows: 0,
    };
  }

  const { indexes } = resolveColumnIndexes(headerRow);

  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      fatalError: `Dosyada ${dataRows.length} satır var; tek seferde en fazla ${MAX_IMPORT_ROWS} satır aktarılabilir. Lütfen dosyayı bölerek yükleyin.`,
      records: [],
      errors: [],
      totalRows: dataRows.length,
    };
  }

  const records: VehicleImportRecord[] = [];
  const errors: VehicleImportError[] = [];
  const seenPlates = new Set<string>();
  let totalRows = 0;

  const cell = (row: unknown[], key: ColumnDef['key']): unknown => {
    const idx = indexes[key];
    if (idx === undefined) return '';
    return row[idx];
  };

  dataRows.forEach((row, i) => {
    const rowNumber = i + 2; // 1. satır başlık
    // Tamamen boş satırları atla
    const isEmpty = !row || row.every((v) => v === null || v === undefined || String(v).trim() === '');
    if (isEmpty) return;
    totalRows += 1;

    const plate = normalizePlate(cell(row, 'plate_number'));

    // 1) Plaka kontrolleri
    if (!plate) {
      errors.push({ row: rowNumber, plate: '-', message: 'Plaka boş olamaz.' });
      return;
    }
    if (plate.length < 4 || plate.length > 30) {
      errors.push({ row: rowNumber, plate, message: 'Plaka uzunluğu 4-30 karakter olmalıdır.' });
      return;
    }
    if (!/[A-Z0-9]/.test(plate)) {
      errors.push({ row: rowNumber, plate, message: 'Plaka en az bir harf veya rakam içermelidir.' });
      return;
    }
    const key = plateKey(plate);
    if (seenPlates.has(key)) {
      errors.push({ row: rowNumber, plate, message: 'Bu plaka dosya içinde birden fazla kez geçiyor; yalnızca ilk satır aktarılır.' });
      return;
    }

    // 2) Kapasite
    const rawCapacity = cell(row, 'capacity');
    let capacity = DEFAULT_CAPACITY;
    if (rawCapacity !== '' && rawCapacity !== null && rawCapacity !== undefined) {
      const parsed = toInteger(rawCapacity);
      if (parsed === null || parsed < 1 || parsed > 100) {
        errors.push({ row: rowNumber, plate, message: 'Kapasite 1-100 arası bir sayı olmalıdır.' });
        return;
      }
      capacity = parsed;
    }

    // 3) Model yılı
    const rawYear = cell(row, 'model_year');
    let modelYear: number | null = null;
    if (rawYear !== '' && rawYear !== null && rawYear !== undefined) {
      const parsed = toInteger(rawYear);
      if (parsed === null || parsed < 1990 || parsed > 2030) {
        errors.push({ row: rowNumber, plate, message: 'Model yılı 1990-2030 arası bir sayı olmalıdır.' });
        return;
      }
      modelYear = parsed;
    }

    // 4) Aktiflik
    const rawActive = cell(row, 'is_active');
    let isActive = true;
    if (rawActive !== '' && rawActive !== null && rawActive !== undefined) {
      const parsed = parseActive(rawActive);
      if (parsed === null) {
        errors.push({ row: rowNumber, plate, message: 'Aktiflik değeri EVET veya HAYIR olmalıdır.' });
        return;
      }
      isActive = parsed;
    }

    // 5) Metin alanları (DB sütun limitleriyle uyumlu)
    const brand = cleanText(cell(row, 'brand'), 100);
    if (brand.error) {
      errors.push({ row: rowNumber, plate, message: `Marka: ${brand.error}` });
      return;
    }
    const model = cleanText(cell(row, 'model'), 100);
    if (model.error) {
      errors.push({ row: rowNumber, plate, message: `Model: ${model.error}` });
      return;
    }
    const driverName = cleanText(cell(row, 'driver_name'), 150);
    if (driverName.error) {
      errors.push({ row: rowNumber, plate, message: `Şoför adı: ${driverName.error}` });
      return;
    }
    const driverPhone = cleanText(cell(row, 'driver_phone'), 50);
    if (driverPhone.error) {
      errors.push({ row: rowNumber, plate, message: `Şoför telefonu: ${driverPhone.error}` });
      return;
    }
    const routeName = cleanText(cell(row, 'route_name'), 255);
    if (routeName.error) {
      errors.push({ row: rowNumber, plate, message: `Güzergah adı: ${routeName.error}` });
      return;
    }

    seenPlates.add(key);
    records.push({
      row: rowNumber,
      plate_number: plate,
      brand: brand.value,
      model: model.value,
      model_year: modelYear,
      capacity,
      driver_name: driverName.value,
      driver_phone: driverPhone.value,
      route_name: routeName.value,
      is_active: isActive,
    });
  });

  return { records, errors, totalRows };
}
