/**
 * Sunucu taraflı denetim PDF raporu (Excel kuralı: "PDF raporu: tarih, denetçi,
 * tüm sorular, cevaplar, fotoğraflar, açıklamalar; son sayfa: genel değerlendirme
 * + açık aksiyonlar").
 *
 * pdfmake + gömülü Roboto (Türkçe karakter desteği) ile oluşturulur.
 * Fotoğraflar storage public URL'lerinden çekilip base64 olarak gömülür;
 * yalnızca JPEG/PNG gömülebilir (HEIC/WEBP için yer tutucu gösterilir).
 */
import PdfPrinter from 'pdfmake';
import { ROBOTO_MEDIUM_BASE64, ROBOTO_REGULAR_BASE64 } from './fonts';

// ─── Girdi tipleri (API rotası doldurur) ────────────────────────────────────

export interface ReportQuestion {
  id: string;
  question_text: string;
  max_points: number | null;
  sort_order: number | null;
}

export interface ReportCategory {
  id: string;
  name: string;
  max_score: number | null;
  sort_order: number | null;
  questions: ReportQuestion[];
}

export interface ReportAnswer {
  question_id: string;
  answer: string;
  score: number | null;
  note: string | null;
  due_date: string | null;
  photo_url: string | null;
  action?: { action_number: string | null; status: string } | null;
}

export interface ReportAction {
  action_number: string | null;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  responsible_name: string | null;
}

export interface AuditReportData {
  audit: {
    id: string;
    title: string | null;
    status: string;
    audit_date: string | null;
    total_score: number | null;
    max_possible_score: number | null;
    percentage: number | null;
    notes: string | null;
  };
  auditTypeName: string;
  facility: { name: string | null; city: string | null } | null;
  vehicle: { plate_number: string; route_name: string | null } | null;
  auditorName: string | null;
  categories: ReportCategory[];
  answers: ReportAnswer[];
  generalPhotos: Array<{ photo_url: string; caption: string | null }>;
  actions: ReportAction[];
}

// ─── Sabitler ───────────────────────────────────────────────────────────────

const ANSWER_LABELS: Record<string, string> = {
  evet: 'Evet',
  hayir: 'Hayır',
  na: 'Uygun Değil',
};

const ANSWER_COLORS: Record<string, string> = {
  evet: '#059669',
  hayir: '#e11d48',
  na: '#64748b',
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  acik: 'Açık',
  devam_ediyor: 'Devam Ediyor',
  gecikti: 'Gecikti',
  onay_bekliyor: 'Onay Bekliyor',
  kapali: 'Kapalı',
};

const PRIORITY_LABELS: Record<string, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
};

const BAND_HEX: Record<string, { text: string; bg: string; label: string }> = {
  uygun: { text: '#047857', bg: '#ecfdf5', label: 'UYGUN' },
  takip: { text: '#b45309', bg: '#fffbeb', label: 'TAKİP GEREKİYOR' },
  kritik: { text: '#be123c', bg: '#fff1f2', label: 'KRİTİK UYGUNSUZLUK' },
};

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// ─── Yardımcılar ────────────────────────────────────────────────────────────

export function bandFor(percentage: number | null | undefined) {
  if (percentage === null || percentage === undefined || Number.isNaN(Number(percentage))) {
    return null;
  }
  const p = Number(percentage);
  if (p >= 80) return BAND_HEX.uygun;
  if (p >= 60) return BAND_HEX.takip;
  return BAND_HEX.kritik;
}

export function formatDateTR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return String(dateStr);
  return `${d}.${m}.${y}`;
}

function nowTR(): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(Math.round(Number(value) * 100) / 100).replace('.', ',');
}

/** PDF dosya adı için Türkçe karakterleri ASCII'ye indirger. */
export function slugifyTR(input: string): string {
  const map: Record<string, string> = {
    ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ş: 's', Ş: 'S', ı: 'i', İ: 'I',
    ö: 'o', Ö: 'O', ç: 'c', Ç: 'C', â: 'a', Â: 'A', î: 'i', Î: 'I',
  };
  return input
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const isJpeg = ct.includes('jpeg') || ct.includes('jpg');
    const isPng = ct.includes('png');
    if (!isJpeg && !isPng) return null; // pdfmake yalnızca JPEG/PNG gömebilir
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 4 * 1024 * 1024) return null;
    return `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// ─── Doküman tanımı ─────────────────────────────────────────────────────────

function buildDocDefinition(
  data: AuditReportData,
  imageMap: Map<string, string>,
  photoSkipCount: number
): Record<string, unknown> {
  const { audit } = data;
  const percentage = audit.percentage ?? 0;
  const band = bandFor(percentage);
  const bandLabel = band?.label ?? '—';
  const bandText = band?.text ?? '#334155';
  const bandBg = band?.bg ?? '#f8fafc';

  const answersByQuestion = new Map<string, ReportAnswer>();
  for (const a of data.answers || []) answersByQuestion.set(a.question_id, a);

  // Kategori özeti + soru listesi
  const categorySummaries = (data.categories || []).map((cat) => {
    const questions = [...(cat.questions || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    let earned = 0;
    let possible = 0;
    for (const q of questions) {
      const ans = answersByQuestion.get(q.id);
      if (ans) {
        earned += Number(ans.score) || 0;
        if (ans.answer !== 'na') possible += Number(q.max_points) || 0;
      }
    }
    const pct = possible > 0 ? Math.round((earned / possible) * 100) : null;
    return { cat, questions, earned, possible, pct };
  });

  const totalQuestions = data.answers?.length || 0;
  const evetCount = (data.answers || []).filter((a) => a.answer === 'evet').length;
  const hayirCount = (data.answers || []).filter((a) => a.answer === 'hayir').length;
  const naCount = (data.answers || []).filter((a) => a.answer === 'na').length;

  const openActions = (data.actions || []).filter((a) => a.status !== 'kapali');
  const closedCount = (data.actions || []).length - openActions.length;

  // ── İçerik iskeleti
  const content: unknown[] = [];

  // Başlık bloğu
  content.push({
    text: 'İDARİ360 · DENETİM RAPORU',
    fontSize: 8,
    bold: true,
    color: '#64748b',
    characterSpacing: 1.5,
  });
  content.push({
    text: audit.title || data.auditTypeName,
    fontSize: 17,
    bold: true,
    color: '#0f172a',
    margin: [0, 3, 0, 8],
  });

  const metaRows: Array<[string, string]> = [
    ['Denetim Türü', data.auditTypeName],
    ['Şube / Tesis', data.facility?.name
      ? `${data.facility.name}${data.facility.city ? ` — ${data.facility.city}` : ''}`
      : '—'],
  ];
  if (data.vehicle) {
    metaRows.push([
      'Servis Aracı',
      `${data.vehicle.plate_number}${data.vehicle.route_name ? ` — ${data.vehicle.route_name}` : ''}`,
    ]);
  }
  metaRows.push(['Denetim Tarihi', formatDateTR(audit.audit_date)]);
  metaRows.push(['Denetçi', data.auditorName || '—']);
  metaRows.push([
    'Durum',
    audit.status === 'approved' ? 'Yönetici Tarafından Onaylandı' : 'Tamamlandı',
  ]);
  content.push({
    table: {
      widths: [95, '*'],
      body: metaRows.map(([k, v]) => [
        { text: k, color: '#64748b', fontSize: 9 },
        { text: v, fontSize: 9.5, bold: true, color: '#0f172a' },
      ]),
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#e2e8f0',
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 10],
  });

  // Puan kutusu
  content.push({
    table: {
      widths: ['*'],
      body: [
        [
          {
            fillColor: bandBg,
            margin: [12, 9, 12, 9],
            columns: [
              { text: 'GENEL PUAN', color: '#64748b', fontSize: 8.5, bold: true, width: 90, margin: [0, 5, 0, 0] },
              {
                text: `${formatScore(audit.total_score)} / ${
                  audit.max_possible_score ? formatScore(audit.max_possible_score) : '100'
                }`,
                fontSize: 15,
                bold: true,
                color: '#0f172a',
                width: 130,
              },
              {
                text: `%${Math.round(percentage)} — ${bandLabel}`,
                fontSize: 13,
                bold: true,
                color: bandText,
                alignment: 'right',
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 14],
  });

  if (audit.notes) {
    content.push({
      table: {
        widths: ['*'],
        body: [[{ text: `Denetim Notu: ${audit.notes}`, fontSize: 9, color: '#334155', fillColor: '#f8fafc', margin: [8, 6, 8, 6] }]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 12],
    });
  }

  // Kategori özeti
  if (categorySummaries.length > 0) {
    content.push({ text: 'KATEGORİ ÖZETİ', fontSize: 10, bold: true, color: '#0f172a', margin: [0, 2, 0, 5] });
    content.push({
      table: {
        widths: ['*', 60, 60, 60],
        headerRows: 1,
        body: [
          [
            { text: 'Kategori', bold: true, fontSize: 9 },
            { text: 'Puan', bold: true, fontSize: 9, alignment: 'center' },
            { text: 'Maks.', bold: true, fontSize: 9, alignment: 'center' },
            { text: 'Başarı', bold: true, fontSize: 9, alignment: 'center' },
          ],
          ...categorySummaries.map((cs) => [
            { text: cs.cat.name, fontSize: 9 },
            { text: formatScore(Math.round(cs.earned * 100) / 100), fontSize: 9, alignment: 'center' },
            { text: cs.possible > 0 ? formatScore(cs.possible) : '—', fontSize: 9, alignment: 'center' },
            {
              text: cs.pct === null ? '—' : `%${cs.pct}`,
              fontSize: 9,
              alignment: 'center',
              bold: true,
              color: cs.pct !== null && cs.pct >= 80 ? '#047857' : cs.pct !== null && cs.pct >= 60 ? '#b45309' : '#be123c',
            },
          ]),
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#e2e8f0',
        vLineColor: () => '#e2e8f0',
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 14],
    });
  }

  // Soru & cevap bölümleri (kategori kategori)
  for (const cs of categorySummaries) {
    const rows: unknown[][] = [
      [
        { text: 'Soru', bold: true, fontSize: 8.5 },
        { text: 'Cevap', bold: true, fontSize: 8.5, alignment: 'center' },
        { text: 'Puan', bold: true, fontSize: 8.5, alignment: 'center' },
        { text: 'Açıklama / Kanıt', bold: true, fontSize: 8.5 },
      ],
    ];

    for (const q of cs.questions) {
      const ans = answersByQuestion.get(q.id);
      const answerText = ans ? ANSWER_LABELS[ans.answer] || ans.answer : '—';
      const answerColor = ans ? ANSWER_COLORS[ans.answer] || '#334155' : '#94a3b8';

      const explanation: unknown[] = [];
      if (ans?.note) {
        explanation.push({ text: ans.note, fontSize: 8.5, color: '#334155' });
      }
      if (ans?.answer === 'hayir' && ans.due_date) {
        explanation.push({
          text: `Düzeltici faaliyet termi: ${formatDateTR(ans.due_date)}`,
          fontSize: 8,
          color: '#b45309',
          margin: [0, 2, 0, 0],
        });
      }
      if (ans?.action?.action_number) {
        explanation.push({
          text: `Aksiyon: ${ans.action.action_number} (${ACTION_STATUS_LABELS[ans.action.status] || ans.action.status})`,
          fontSize: 8,
          color: '#475569',
          margin: [0, 2, 0, 0],
        });
      }
      const img = ans?.photo_url ? imageMap.get(ans.photo_url) : null;
      if (img) {
        explanation.push({ image: img, fit: [110, 82], margin: [0, 4, 0, 0] });
      }
      if (explanation.length === 0) {
        explanation.push({ text: '—', fontSize: 8.5, color: '#94a3b8' });
      }

      rows.push([
        { text: q.question_text, fontSize: 8.5 },
        { text: answerText, fontSize: 8.5, bold: true, color: answerColor, alignment: 'center' },
        { text: formatScore(ans?.score ?? null), fontSize: 8.5, alignment: 'center' },
        { stack: explanation },
      ]);
    }

    content.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: cs.cat.name,
              fontSize: 10.5,
              bold: true,
              color: '#0f172a',
              fillColor: '#f1f5f9',
              margin: [7, 5, 7, 5],
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 9, 0, 0],
    });
    content.push({
      table: {
        widths: [218, 46, 36, 197],
        headerRows: 1,
        body: rows,
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#e2e8f0',
        vLineColor: () => '#e2e8f0',
        paddingTop: () => 4,
        paddingBottom: () => 4,
        fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f8fafc' : null),
      },
      margin: [0, 0, 0, 8],
    });
  }

  // Genel görünüm fotoğrafları
  content.push({ text: 'GENEL GÖRÜNÜM FOTOĞRAFLARI', fontSize: 10, bold: true, color: '#0f172a', margin: [0, 12, 0, 6] });
  const generalWithImages = (data.generalPhotos || [])
    .map((p) => ({ ...p, img: imageMap.get(p.photo_url) || null }))
    .filter((p) => p.img);
  if (generalWithImages.length === 0) {
    content.push({
      text:
        photoSkipCount > 0
          ? `Fotoğraflar PDF'e gömülemedi (desteklenmeyen format: HEIC/WEBP). Görseller uygulama üzerinden incelenebilir.`
          : 'Genel görünüm fotoğrafı bulunmuyor.',
      fontSize: 9,
      color: '#94a3b8',
    });
  } else {
    const photoRows: unknown[][] = [];
    for (let i = 0; i < generalWithImages.length; i += 2) {
      const pair = generalWithImages.slice(i, i + 2);
      photoRows.push(
        pair.map((p) => ({
          stack: [
            { image: p.img as string, fit: [235, 175] },
            {
              text: p.caption || 'Genel görünüm',
              fontSize: 8,
              color: '#64748b',
              margin: [0, 3, 0, 0],
            },
          ],
        }))
      );
      if (photoRows[photoRows.length - 1].length === 1) photoRows[photoRows.length - 1].push({ text: '' });
    }
    content.push({
      table: { widths: ['*', '*'], body: photoRows },
      layout: 'noBorders',
    });
    if (photoSkipCount > 0) {
      content.push({
        text: `${photoSkipCount} fotoğraf format uyumsuzluğu (HEIC/WEBP) nedeniyle rapora eklenemedi; uygulama üzerinden görüntülenebilir.`,
        fontSize: 8,
        color: '#94a3b8',
        margin: [0, 4, 0, 0],
      });
    }
  }

  // ── Son sayfa: Genel değerlendirme + açık aksiyonlar
  const finalBlocks: unknown[] = [];
  finalBlocks.push({
    text: 'GENEL DEĞERLENDİRME',
    fontSize: 13,
    bold: true,
    color: '#0f172a',
    margin: [0, 0, 0, 8],
  });
  finalBlocks.push({
    table: {
      widths: ['*'],
      body: [
        [
          {
            fillColor: bandBg,
            margin: [14, 12, 14, 12],
            columns: [
              {
                stack: [
                  { text: `${Math.round(percentage)}/100`, fontSize: 26, bold: true, color: '#0f172a' },
                  { text: bandLabel, fontSize: 11, bold: true, color: bandText },
                ],
                width: 150,
              },
              {
                stack: [
                  { text: `Toplam soru: ${totalQuestions}`, fontSize: 9.5 },
                  { text: `Uygun (Evet): ${evetCount}`, fontSize: 9.5, color: '#047857' },
                  { text: `Uygunsuz (Hayır): ${hayirCount}`, fontSize: 9.5, color: '#be123c' },
                  { text: `Uygun değil (N/A): ${naCount}`, fontSize: 9.5, color: '#64748b' },
                ],
              },
            ],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 12],
  });

  // Uygunsuz maddelerin kısa dökümü
  const uygunsuzlar = (data.answers || []).filter((a) => a.answer === 'hayir');
  if (uygunsuzlar.length > 0) {
    finalBlocks.push({
      text: 'Uygunsuz Bulunan Maddeler',
      fontSize: 10,
      bold: true,
      color: '#0f172a',
      margin: [0, 2, 0, 4],
    });
    const qById = new Map<string, ReportQuestion>();
    for (const cs of categorySummaries) for (const q of cs.questions) qById.set(q.id, q);
    finalBlocks.push({
      ol: uygunsuzlar.map((a) => ({
        text: `${qById.get(a.question_id)?.question_text || 'Soru'}${a.note ? ` — ${a.note}` : ''}`,
        fontSize: 9,
        margin: [0, 1, 0, 1],
      })),
      margin: [0, 0, 0, 10],
    });
  }

  finalBlocks.push({
    text: 'AÇIK AKSİYONLAR',
    fontSize: 10,
    bold: true,
    color: '#0f172a',
    margin: [0, 4, 0, 5],
  });
  if (openActions.length === 0) {
    finalBlocks.push({
      text:
        closedCount > 0
          ? `Açık aksiyon bulunmuyor. (${closedCount} aksiyon kapatıldı.)`
          : 'Bu denetimden doğan açık aksiyon bulunmuyor.',
      fontSize: 9.5,
      color: '#047857',
      margin: [0, 0, 0, 8],
    });
  } else {
    finalBlocks.push({
      table: {
        widths: [22, 72, '*', 90, 62, 66],
        headerRows: 1,
        body: [
          [
            { text: '#', bold: true, fontSize: 8.5 },
            { text: 'Aksiyon No', bold: true, fontSize: 8.5 },
            { text: 'Başlık', bold: true, fontSize: 8.5 },
            { text: 'Sorumlu', bold: true, fontSize: 8.5 },
            { text: 'Termin', bold: true, fontSize: 8.5 },
            { text: 'Durum', bold: true, fontSize: 8.5 },
          ],
          ...openActions.map((a, i) => [
            { text: String(i + 1), fontSize: 8.5 },
            { text: a.action_number || '—', fontSize: 8.5 },
            { text: a.title, fontSize: 8.5 },
            { text: a.responsible_name || '—', fontSize: 8.5 },
            { text: formatDateTR(a.due_date), fontSize: 8.5 },
            {
              text: `${ACTION_STATUS_LABELS[a.status] || a.status}${
                a.priority ? ` · ${PRIORITY_LABELS[a.priority] || a.priority}` : ''
              }`,
              fontSize: 8.5,
              color: a.status === 'gecikti' ? '#be123c' : '#334155',
            },
          ]),
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#e2e8f0',
        vLineColor: () => '#e2e8f0',
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 10],
    });
  }

  finalBlocks.push({
    text: `Bu rapor İdari360 tarafından ${nowTR()} tarihinde otomatik olarak oluşturulmuştur.`,
    fontSize: 8,
    color: '#94a3b8',
    margin: [0, 8, 0, 0],
  });

  content.push({ text: '', pageBreak: 'before' });
  content.push(...finalBlocks);

  return {
    pageSize: 'A4',
    pageMargins: [36, 44, 36, 46],
    info: {
      title: `Denetim Raporu — ${audit.title || data.auditTypeName}`,
      author: 'İdari360',
      creator: 'İdari360',
      subject: `${data.auditTypeName} · ${formatDateTR(audit.audit_date)}`,
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'İdari360 · Denetim Raporu', fontSize: 8, color: '#94a3b8', margin: [36, 12, 0, 0] },
        { text: `Sayfa ${currentPage} / ${pageCount}`, fontSize: 8, color: '#94a3b8', alignment: 'right', margin: [0, 12, 36, 0] },
      ],
    }),
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#1e293b', lineHeight: 1.25 },
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

let cachedPrinter: PdfPrinter | null = null;
function getPrinter(): PdfPrinter {
  if (!cachedPrinter) {
    cachedPrinter = new PdfPrinter({
      Roboto: {
        normal: Buffer.from(ROBOTO_REGULAR_BASE64, 'base64'),
        bold: Buffer.from(ROBOTO_MEDIUM_BASE64, 'base64'),
      },
    });
  }
  return cachedPrinter;
}

export async function generateAuditReportPdf(data: AuditReportData): Promise<Buffer> {
  // Tüm fotoğrafları paralel çek
  const photoUrls = new Set<string>();
  for (const p of data.generalPhotos || []) photoUrls.add(p.photo_url);
  for (const a of data.answers || []) if (a.photo_url) photoUrls.add(a.photo_url);

  const imageMap = new Map<string, string>();
  let photoSkipCount = 0;
  const results = await Promise.all(
    [...photoUrls].map(async (url) => ({ url, uri: await fetchImageDataUri(url) }))
  );
  for (const r of results) {
    if (r.uri) imageMap.set(r.url, r.uri);
    else photoSkipCount++;
  }

  const dd = buildDocDefinition(data, imageMap, photoSkipCount);
  const printer = getPrinter();

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const doc = printer.createPdfKitDocument(dd);
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve());
    doc.on('error', (e: Error) => reject(e));
    doc.end();
  });
  return Buffer.concat(chunks);
}
