/**
 * Şube Sağlık Skoru (Trafik Işığı) — paylaşılan hesaplama
 *
 * Excel gereksinimi: "Şube durum trafik ışığı (🟢 iyi / 🟡 takip / 🔴 kritik)"
 *
 * Bileşenler ve ağırlıkları (mevcut veriye göre yeniden normalize edilir):
 *  - Denetim puanı (son 90 gün ort., tamamlanmış denetimler) — %35
 *  - Memnuniyet skoru (son 90 gün, en az 2 yanıt; 5 üzerinden → 100) — %25
 *  - Aksiyon sağlığı (gecikmiş açık aksiyon yoksa 100; her gecikme −25) — %25
 *  - Müdahale hızı (ort. karşılama ≤60dk→100, ≤4sa→70, üzeri→40) — %15
 *
 * Renk eşikleri: ≥80 yeşil (İyi) · 60-79 sarı (Takip Gerekli) · <60 kırmızı (Kritik)
 * Hiç sinyal yoksa (denetim/memnuniyet/talep verisi yok) gri (Veri Yok).
 */

export interface FacilityHealthInput {
  audit_avg: number | null; // son 90 gün ortalama denetim puanı (0-100)
  audit_count: number;
  satisfaction_avg: number | null; // son 90 gün ortalama (1-5), min 2 yanıt şartı dışarıda uygulanır
  satisfaction_count: number;
  overdue_actions: number; // termin geçmiş açık aksiyon sayısı
  avg_response_minutes: number | null; // son 90 gün ort. karşılama süresi (T2-T1)
  response_sample_count: number;
  request_total: number; // dönemsel toplam talep (aktivite kontrolü için)
}

export interface HealthPart {
  key: 'audit' | 'satisfaction' | 'action' | 'response';
  label: string;
  score: number | null; // 0-100 bileşen puanı; null = veri yok
  detail: string;
}

export interface FacilityHealth {
  score: number | null; // 0-100
  color: 'green' | 'amber' | 'red' | 'gray';
  label: string; // İyi / Takip Gerekli / Kritik / Veri Yok
  parts: HealthPart[];
}

const WEIGHTS: Record<HealthPart['key'], number> = {
  audit: 35,
  satisfaction: 25,
  action: 25,
  response: 15,
};

export function computeFacilityHealth(input: FacilityHealthInput): FacilityHealth {
  const parts: HealthPart[] = [];

  // 1) Denetim puanı
  if (input.audit_count > 0 && input.audit_avg != null) {
    parts.push({
      key: 'audit',
      label: 'Denetim Puanı',
      score: clamp(input.audit_avg),
      detail: `Son 90 gün ort. puan: ${Math.round(input.audit_avg)}/100 (${input.audit_count} denetim)`,
    });
  } else {
    parts.push({
      key: 'audit',
      label: 'Denetim Puanı',
      score: null,
      detail: 'Son 90 günde tamamlanmış denetim yok',
    });
  }

  // 2) Memnuniyet (tek yanıt istatistiksel olarak zayıf; en az 2 yanıt)
  if (input.satisfaction_count >= 2 && input.satisfaction_avg != null) {
    parts.push({
      key: 'satisfaction',
      label: 'Memnuniyet',
      score: clamp(input.satisfaction_avg * 20),
      detail: `${input.satisfaction_avg.toFixed(1)}/5 (${input.satisfaction_count} yanıt)`,
    });
  } else {
    parts.push({
      key: 'satisfaction',
      label: 'Memnuniyet',
      score: null,
      detail:
        input.satisfaction_count > 0
          ? `Yeterli yanıt yok (${input.satisfaction_count} yanıt)`
          : 'Değerlendirme yok',
    });
  }

  // 3) Aksiyon sağlığı (her gecikmiş açık aksiyon −25)
  const actionScore = clamp(100 - input.overdue_actions * 25);
  parts.push({
    key: 'action',
    label: 'Aksiyon Kapatma',
    score: actionScore,
    detail:
      input.overdue_actions > 0
        ? `${input.overdue_actions} gecikmiş açık aksiyon`
        : 'Gecikmiş açık aksiyon yok',
  });

  // 4) Müdahale hızı
  if (input.response_sample_count > 0 && input.avg_response_minutes != null) {
    const avg = input.avg_response_minutes;
    const score = avg <= 60 ? 100 : avg <= 240 ? 70 : 40;
    parts.push({
      key: 'response',
      label: 'Müdahale Hızı',
      score,
      detail: `Ort. karşılama: ${Math.round(avg)} dk (hedef ≤60)`,
    });
  } else {
    parts.push({
      key: 'response',
      label: 'Müdahale Hızı',
      score: null,
      detail: 'Karşılama süresi verisi yok',
    });
  }

  // Aktivite yoksa: "Veri Yok"
  const noActivity =
    input.audit_count === 0 &&
    input.satisfaction_count === 0 &&
    input.response_sample_count === 0 &&
    input.request_total === 0;

  if (noActivity) {
    return { score: null, color: 'gray', label: 'Veri Yok', parts };
  }

  // Ağırlıklı ortalama (yalnızca veri olan bileşenler üzerinden)
  let weightedSum = 0;
  let weightSum = 0;
  parts.forEach((p) => {
    if (p.score == null) return;
    weightedSum += p.score * WEIGHTS[p.key];
    weightSum += WEIGHTS[p.key];
  });

  if (weightSum === 0) {
    return { score: null, color: 'gray', label: 'Veri Yok', parts };
  }

  const score = Math.round(weightedSum / weightSum);
  const color: FacilityHealth['color'] = score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red';
  const label = score >= 80 ? 'İyi' : score >= 60 ? 'Takip Gerekli' : 'Kritik';

  return { score, color, label, parts };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
