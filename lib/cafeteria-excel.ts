/**
 * İdari360 - Yemekhane Menü Excel Şablonu ve İçe Aktarma Yardımcısı
 *
 * Bu modül iki saf fonksiyon sağlar:
 *  - buildMenuTemplateBuffer(): Aylık menülerin toplu girilebilmesi için hazır
 *    başlıklı, örnek ve kılavuz sekmeleri içeren bir .xlsx şablonu üretir.
 *  - parseMenuWorkbook(): Yüklenen .xlsx dosyasını doğrular ve veritabanına
 *    yazılmaya hazır menü kayıtlarına (ve hatalara) ayrıştırır.
 *
 * Veritabanı erişimi içermez; bu nedenle bağımsız olarak test edilebilir.
 */

import * as XLSX from 'xlsx';

/* ============================================================================
   TİPLER
============================================================================ */

export type MenuMealType = 'kahvalti' | 'ogle' | 'aksam';

export interface MenuImportRecord {
  /** Excel'deki satır numarası (başlık 1. satırdır) */
  row: number;
  /** YYYY-MM-DD */
  menu_date: string;
  meal_type: MenuMealType;
  corba: string | null;
  ana_yemek: string;
  yan_yemek: string | null;
  tatli_meyve: string | null;
  kalori: number | null;
  planned_count: number | null;
  unit_cost: number | null;
}

export interface MenuImportError {
  row: number;
  /** Tarih · öğün kısa etiketi (ör. "2026-10-05 · Öğle Yemeği") */
  label: string;
  message: string;
}

export interface MenuParseResult {
  /** Dosya hiç işlenemediyse (başlık yok, boş vb.) dolu olur */
  fatalError?: string;
  records: MenuImportRecord[];
  errors: MenuImportError[];
  /** Başlık dışındaki dolu satır sayısı */
  totalRows: number;
}

/* ============================================================================
   SABİTLER
============================================================================ */

export const MAX_IMPORT_ROWS = 400;
export const MAX_FILE_SIZE_MB = 5;

export const MEAL_LABELS: Record<MenuMealType, string> = {
  kahvalti: 'Kahvaltı',
  ogle: 'Öğle Yemeği',
  aksam: 'Akşam Yemeği',
};

interface ColumnDef {
  key: keyof Omit<MenuImportRecord, 'row'>;
  header: string;
  /** Başlık eşleştirmede kabul edilen ek varyasyonlar (normalize edilir) */
  aliases: string[];
  required: boolean;
  example: string | number;
  format: string;
  guide: string;
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'menu_date',
    header: 'TARİH',
    aliases: ['TARIH', 'MENÜ TARİHİ', 'MENU TARIHI', 'GÜN', 'GUN'],
    required: true,
    example: '2026-10-05',
    format: '2026-10-05, 05.10.2026 veya Excel tarih hücresi',
    guide: 'Zorunlu. Menünün sunulacağı gün.',
  },
  {
    key: 'meal_type',
    header: 'ÖĞÜN (VARDİYA)',
    aliases: ['ÖĞÜN', 'OGUN', 'VARDİYA', 'VARDIYA', 'ÖĞÜN / VARDİYA', 'OGUN / VARDIYA'],
    required: true,
    example: 'Kahvaltı',
    format: 'Kahvaltı / Öğle / Akşam',
    guide: 'Zorunlu. Kahvaltı = 1. vardiya, Öğle = 2. vardiya, Akşam = 3. vardiya. Vardiya numarası da yazılabilir.',
  },
  {
    key: 'corba',
    header: 'ÇORBA',
    aliases: ['CORBA'],
    required: false,
    example: 'Mercimek Çorbası',
    format: 'Metin',
    guide: 'Çorba (opsiyonel).',
  },
  {
    key: 'ana_yemek',
    header: 'ANA YEMEK',
    aliases: ['ANAYEMEK', 'ANA YEMEK ADI'],
    required: true,
    example: 'Izgara Tavuk',
    format: 'Metin',
    guide: 'Zorunlu. Menünün ana yemeği.',
  },
  {
    key: 'yan_yemek',
    header: 'YAN YEMEK',
    aliases: ['YANYEMEK', 'GARNİTÜR', 'GARNITUR'],
    required: false,
    example: 'Pirinç Pilavı',
    format: 'Metin',
    guide: 'Pilav, makarna, garnitür vb. (opsiyonel).',
  },
  {
    key: 'tatli_meyve',
    header: 'TATLI / MEYVE',
    aliases: ['TATLI', 'TATLI-MEYVE', 'TATLI MEYVE', 'MEYVE', 'TATLIMEYVE'],
    required: false,
    example: 'Mevsim Meyvesi',
    format: 'Metin',
    guide: 'Tatlı veya meyve (opsiyonel).',
  },
  {
    key: 'kalori',
    header: 'KALORİ (KCAL)',
    aliases: ['KALORİ', 'KALORI', 'KCAL'],
    required: false,
    example: 850,
    format: '0 - 5000 arası sayı',
    guide: 'Öğünün toplam kalorisi (opsiyonel).',
  },
  {
    key: 'planned_count',
    header: 'PLANLANAN KİŞİ',
    aliases: ['PLANLANAN KİŞİ SAYISI', 'PLANLANAN KISI SAYISI', 'KİŞİ SAYISI', 'KISI SAYISI', 'PLANLANAN'],
    required: false,
    example: 250,
    format: '0 - 20000 arası sayı',
    guide: 'Planlanan kişi sayısı (opsiyonel).',
  },
  {
    key: 'unit_cost',
    header: 'PORSİYON MALİYETİ (TL)',
    aliases: ['PORSİYON MALİYETİ', 'PORSIYON MALIYETI', 'BİRİM MALİYET', 'BIRIM MALIYET', 'MALİYET', 'MALIYET'],
    required: false,
    example: 45,
    format: 'TL (örn: 45 veya 45,50)',
    guide: 'Porsiyon başı maliyet (opsiyonel). Yemekhane maliyet raporlarında kullanılır.',
  },
];

const SHEET_DATA = 'Menüler';
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

/** Sayı ayrıştırma; Türkçe ondalık ayracını da destekler; başarısızsa null */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    let s = value.replace(/\s/g, '').replace(/₺|TL/gi, '');
    if (s === '') return null;
    if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Yıl/ay/gün üçlüsünü gerçek bir tarihe çevirir; aralık dışıysa null */
function toISODate(y: number, mo: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

/**
 * Tarih hücresini YYYY-MM-DD'ye çevirir.
 * Desteklenenler: Excel tarih hücresi (Date), 2026-10-05, 05.10.2026, 5/10/2026, 05.10.26
 */
export function parseMenuDate(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    // xlsx tarihleri UTC tabanlı üretir; yerel getter'lar UTC/TR sunucuda doğru gün verir
    return toISODate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return toISODate(Number(m[1]), Number(m[2]), Number(m[3]));
    m = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) return toISODate(Number(m[3]), Number(m[2]), Number(m[1]));
    m = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2})$/);
    if (m) return toISODate(2000 + Number(m[3]), Number(m[2]), Number(m[1]));
  }
  return null;
}

/** Öğün / vardiya hücresini meal_type'a çevirir */
export function parseMealType(value: unknown): MenuMealType | null {
  const t = normalizeHeader(value);
  if (!t) return null;
  if (
    ['KAHVALTI', 'KAHVALTİ', 'SABAH', 'SABAH YEMEĞİ', 'SABAH YEMEGI', '1. VARDİYA', '1. VARDIYA', 'VARDİYA 1', 'VARDIYA 1', '1'].includes(t)
  ) {
    return 'kahvalti';
  }
  if (
    ['ÖĞLE', 'OGLE', 'ÖĞLEN', 'OGLEN', 'ÖĞLE YEMEĞİ', 'ÖĞLE YEMEGI', 'OGLE YEMEGI', '2. VARDİYA', '2. VARDIYA', 'VARDİYA 2', 'VARDIYA 2', '2'].includes(t)
  ) {
    return 'ogle';
  }
  if (
    ['AKŞAM', 'AKSAM', 'AKŞAM YEMEĞİ', 'AKSAM YEMEGI', '3. VARDİYA', '3. VARDIYA', 'VARDİYA 3', 'VARDIYA 3', '3'].includes(t)
  ) {
    return 'aksam';
  }
  return null;
}

/** Dosya yükleme öncesi ham içeriğin gerçekten XLSX (ZIP) veya XLS (OLE2) olduğunu doğrular */
export function hasValidSpreadsheetSignature(bytes: Uint8Array): boolean {
  const isZip =
    bytes.length > 3 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
  const isOle2 =
    bytes.length > 7 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;
  return isZip || isOle2;
}

/* ============================================================================
   1. ŞABLON ÜRETİMİ
============================================================================ */

/**
 * Hazır başlıklı yemekhane menü şablonu üretir.
 * Sekmeler: "Menüler" (boş, doldurulacak), "Örnek Doldurulmuş", "Kılavuz".
 */
export function buildMenuTemplateBuffer(): Buffer {
  const headers = COLUMNS.map((c) => c.header);
  const widths = COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 4, 16) }));

  /* --- Sekme 1: Menüler (doldurulacak boş şablon) --- */
  const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
  dataSheet['!cols'] = widths;

  /* --- Sekme 2: Örnek Doldurulmuş --- */
  const exampleRows: (string | number)[][] = [
    headers,
    ['2026-10-05', 'Kahvaltı', '', 'Menemen', 'Beyaz Peynir', 'Zeytin', 620, 250, 25],
    ['2026-10-05', 'Öğle', 'Mercimek Çorbası', 'Izgara Tavuk', 'Pirinç Pilavı', 'Mevsim Meyvesi', 850, 400, 45],
    ['2026-10-05', 'Akşam', 'Ezogelin Çorbası', 'Fırın Köfte', 'Bulgur Pilavı', 'Sütlaç', 900, 180, 45],
    ['2026-10-06', 'Kahvaltı', '', 'Simit', 'Kaşar Peyniri', 'Reçel', 600, 240, 25],
    ['2026-10-06', 'Öğle', 'Domates Çorbası', 'Etli Nohut', 'Şehriyeli Pilav', 'Kemalpaşa Tatlısı', 880, 420, 47.5],
  ];
  const exampleSheet = XLSX.utils.aoa_to_sheet(exampleRows);
  exampleSheet['!cols'] = widths;

  /* --- Sekme 3: Kılavuz --- */
  const guideRows: (string | number)[][] = [
    ['YEMEKHANE MENÜ TOPLU YÜKLEME KILAVUZU'],
    [''],
    ['1) Menülerinizi "Menüler" sekmesine girin. Nasıl doldurulacağını görmek için "Örnek Doldurulmuş" sekmesine bakın.'],
    ['2) Her satır bir gün + öğündür (kahvaltı / öğle / akşam). Bir ay için 3 öğün × ~30 gün = ~90 satır doldurmanız yeterlidir.'],
    ['3) Sadece dolu satırlar içe aktarılır; boş satırlar otomatik atlanır.'],
    ['4) Örnek sekmesindeki satırlar yüklenmez; yalnızca "Menüler" sekmesi okunur.'],
    [`5) Tek seferde en fazla ${MAX_IMPORT_ROWS} satır aktarılabilir.`],
    ['6) Aynı gün + öğün sistemde zaten varsa varsayılan olarak atlanır. İçe aktarma ekranındaki "Mevcut kayıtların üzerine yaz" seçeneğiyle menü içeriği, planlanan kişi ve maliyet güncellenebilir.'],
    ['7) "Üzerine yaz" seçeneği gerçekleşen kişi, üretim, tüketim ve fire verilerine DOKUNMAZ; yalnızca plan bilgilerini günceller.'],
    [''],
    ['ÖĞÜN / VARDİYA EŞLEMESİ', '', '', ''],
    ['Kahvaltı', '1. Vardiya', '', ''],
    ['Öğle', '2. Vardiya', '', ''],
    ['Akşam', '3. Vardiya', '', ''],
    [''],
    ['ALAN', 'ZORUNLU', 'FORMAT / AÇIKLAMA', 'ÖRNEK'],
    ...COLUMNS.map((c) => [c.header, c.required ? 'EVET' : 'HAYIR', `${c.format}. ${c.guide}`, String(c.example)]),
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 95 }, { wch: 30 }];

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
 * Öncelikle "Menüler" sekmesini, yoksa TARİH + ÖĞÜN başlıklarını içeren ilk sekmeyi okur.
 */
export function parseMenuWorkbook(buffer: Buffer | Uint8Array): MenuParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
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

  // Sekme seçimi: önce "Menüler", sonra başlığı eşleşen ilk sekme
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
    // TARİH + ÖĞÜN zorunlu + en az 3 kolon eşleşmesi aranır
    if (indexes.menu_date !== undefined && indexes.meal_type !== undefined && matched >= 3) {
      headerRow = candidateHeader;
      dataRows = matrix.slice(1);
      break;
    }
  }

  if (!headerRow) {
    return {
      fatalError:
        'Başlık satırı bulunamadı. Lütfen indirdiğiniz şablonu kullanın ("Menüler" sekmesindeki TARİH, ÖĞÜN (VARDİYA), ANA YEMEK... başlıkları korunmalıdır).',
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

  const records: MenuImportRecord[] = [];
  const errors: MenuImportError[] = [];
  const seenKeys = new Set<string>();
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

    const rawDate = cell(row, 'menu_date');
    const rawMeal = cell(row, 'meal_type');
    const menuDate = parseMenuDate(rawDate);
    const mealType = parseMealType(rawMeal);
    const label = `${menuDate ?? (String(rawDate).trim() || '?')} · ${
      mealType ? MEAL_LABELS[mealType] : String(rawMeal).trim() || '?'
    }`;

    // 1) Tarih
    if (!menuDate) {
      errors.push({
        row: rowNumber,
        label,
        message: 'Tarih okunamadı. Örnek biçimler: 2026-10-05, 05.10.2026 veya Excel tarih hücresi.',
      });
      return;
    }

    // 2) Öğün / vardiya
    if (!mealType) {
      errors.push({
        row: rowNumber,
        label,
        message: 'Öğün/Vardiya değeri geçersiz. Kahvaltı, Öğle veya Akşam yazın (1./2./3. vardiya da kabul edilir).',
      });
      return;
    }

    // 3) Dosya içi mükerrer gün + öğün
    const key = `${menuDate}|${mealType}`;
    if (seenKeys.has(key)) {
      errors.push({
        row: rowNumber,
        label,
        message: 'Bu gün ve öğün dosyada birden fazla kez var; yalnızca ilk satır işlenir.',
      });
      return;
    }

    // 4) Ana yemek (zorunlu)
    const anaYemek = cleanText(cell(row, 'ana_yemek'), 200);
    if (anaYemek.error) {
      errors.push({ row: rowNumber, label, message: `Ana yemek: ${anaYemek.error}` });
      return;
    }
    if (!anaYemek.value) {
      errors.push({ row: rowNumber, label, message: 'Ana yemek boş olamaz.' });
      return;
    }

    // 5) Opsiyonel metinler
    const corba = cleanText(cell(row, 'corba'), 200);
    if (corba.error) {
      errors.push({ row: rowNumber, label, message: `Çorba: ${corba.error}` });
      return;
    }
    const yanYemek = cleanText(cell(row, 'yan_yemek'), 200);
    if (yanYemek.error) {
      errors.push({ row: rowNumber, label, message: `Yan yemek: ${yanYemek.error}` });
      return;
    }
    const tatliMeyve = cleanText(cell(row, 'tatli_meyve'), 200);
    if (tatliMeyve.error) {
      errors.push({ row: rowNumber, label, message: `Tatlı/Meyve: ${tatliMeyve.error}` });
      return;
    }

    // 6) Kalori
    const rawKalori = cell(row, 'kalori');
    let kalori: number | null = null;
    if (rawKalori !== '' && rawKalori !== null && rawKalori !== undefined) {
      const parsed = toNumber(rawKalori);
      if (parsed === null || parsed < 0 || parsed > 5000) {
        errors.push({ row: rowNumber, label, message: 'Kalori 0 - 5000 arası bir sayı olmalıdır.' });
        return;
      }
      kalori = Math.round(parsed);
    }

    // 7) Planlanan kişi sayısı
    const rawPlanned = cell(row, 'planned_count');
    let plannedCount: number | null = null;
    if (rawPlanned !== '' && rawPlanned !== null && rawPlanned !== undefined) {
      const parsed = toNumber(rawPlanned);
      if (parsed === null || parsed < 0 || parsed > 20000) {
        errors.push({ row: rowNumber, label, message: 'Planlanan kişi sayısı 0 - 20000 arası bir sayı olmalıdır.' });
        return;
      }
      plannedCount = Math.round(parsed);
    }

    // 8) Porsiyon maliyeti
    const rawCost = cell(row, 'unit_cost');
    let unitCost: number | null = null;
    if (rawCost !== '' && rawCost !== null && rawCost !== undefined) {
      const parsed = toNumber(rawCost);
      if (parsed === null || parsed < 0 || parsed > 100000) {
        errors.push({ row: rowNumber, label, message: 'Porsiyon maliyeti 0 - 100000 arası bir sayı olmalıdır.' });
        return;
      }
      unitCost = Math.round(parsed * 100) / 100;
    }

    seenKeys.add(key);
    records.push({
      row: rowNumber,
      menu_date: menuDate,
      meal_type: mealType,
      corba: corba.value,
      ana_yemek: anaYemek.value,
      yan_yemek: yanYemek.value,
      tatli_meyve: tatliMeyve.value,
      kalori,
      planned_count: plannedCount,
      unit_cost: unitCost,
    });
  });

  return { records, errors, totalRows };
}
