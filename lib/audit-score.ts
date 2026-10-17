/**
 * Denetim puanı değerlendirme bantları.
 *
 * Excel kuralı: "92 / 100 – UYGUN" şeklinde genel değerlendirme gösterilir.
 * Eşikler denetim sonuç e-postası (lib/email.ts → sendAuditCompletedEmail) ile
 * birebir aynıdır:  ≥80 UYGUN · 60–79 TAKİP GEREKİYOR · <60 KRİTİK UYGUNSUZLUK
 */

export type AuditScoreBandKey = 'uygun' | 'takip' | 'kritik';

export interface AuditScoreBand {
  key: AuditScoreBandKey;
  label: string;
  /** Küçük rozet (chip) için tailwind sınıfları */
  chipClass: string;
  /** Büyük skor metni için tailwind renk sınıfı */
  textClass: string;
  /** Bar / dolgu rengi */
  barClass: string;
}

export function getAuditScoreBand(
  percentage: number | null | undefined
): AuditScoreBand | null {
  if (percentage === null || percentage === undefined) return null;
  const p = Number(percentage);
  if (Number.isNaN(p)) return null;

  if (p >= 80) {
    return {
      key: 'uygun',
      label: 'UYGUN',
      chipClass: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
      textClass: 'text-emerald-700',
      barClass: 'bg-emerald-500',
    };
  }

  if (p >= 60) {
    return {
      key: 'takip',
      label: 'TAKİP GEREKİYOR',
      chipClass: 'bg-amber-100/80 text-amber-800 border-amber-200',
      textClass: 'text-amber-700',
      barClass: 'bg-amber-500',
    };
  }

  return {
    key: 'kritik',
    label: 'KRİTİK UYGUNSUZLUK',
    chipClass: 'bg-rose-100/80 text-rose-800 border-rose-200',
    textClass: 'text-rose-700',
    barClass: 'bg-rose-500',
  };
}
