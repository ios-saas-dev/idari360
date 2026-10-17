/**
 * Varlık akış motoru (Paket 6 / Varlık)
 * Hem API (sunucu tarafı geçiş doğrulaması) hem arayüz (işlem butonları) buradan beslenir.
 *
 * Excel akışları: zimmet, devir, iade, arıza, bakım, kayıp, hurda (+ bakım çıkışı, bulundu)
 */

export type AssetFlowKey =
  | 'zimmet'
  | 'devir'
  | 'iade'
  | 'ariza'
  | 'bakim'
  | 'bakim_cikis'
  | 'kayip'
  | 'bulundu'
  | 'hurda';

export interface AssetFlowDef {
  key: AssetFlowKey;
  label: string;
  /** Bu durumlardan başlatılabilir */
  from: string[];
  /** Hedef durumu hesaplar (zimmetli mi bilgisine göre değişebilir) */
  resolveTo: (assignedTo: string | null) => string;
  /** true ise hedef kişi seçimi zorunlu */
  requiresUser?: boolean;
  tone: 'blue' | 'indigo' | 'emerald' | 'amber' | 'red' | 'slate';
  /** Kullanıcıya gösterilen kısa açıklama */
  hint: string;
}

export const ASSET_FLOWS: AssetFlowDef[] = [
  {
    key: 'zimmet',
    label: 'Zimmetle',
    from: ['aktif', 'iade'],
    resolveTo: () => 'devirde',
    requiresUser: true,
    tone: 'blue',
    hint: 'Varlık seçilen personele zimmetlenir.',
  },
  {
    key: 'devir',
    label: 'Devret',
    from: ['devirde'],
    resolveTo: () => 'devirde',
    requiresUser: true,
    tone: 'indigo',
    hint: 'Zimmetli varlık başka bir personele devredilir.',
  },
  {
    key: 'iade',
    label: 'İade Al',
    from: ['devirde'],
    resolveTo: () => 'iade',
    tone: 'slate',
    hint: 'Personelden teslim alınır; zimmet kapanır.',
  },
  {
    key: 'ariza',
    label: 'Arıza Bildir',
    from: ['aktif', 'devirde', 'iade'],
    resolveTo: () => 'ariza',
    tone: 'red',
    hint: 'Varlık arızalı olarak işaretlenir.',
  },
  {
    key: 'bakim',
    label: 'Bakıma Gönder',
    from: ['ariza', 'aktif', 'devirde', 'iade'],
    resolveTo: () => 'bakimda',
    tone: 'amber',
    hint: 'Varlık bakım/onarım sürecine alınır.',
  },
  {
    key: 'bakim_cikis',
    label: 'Bakımdan Çıkış',
    from: ['bakimda'],
    resolveTo: (assignedTo) => (assignedTo ? 'devirde' : 'aktif'),
    tone: 'emerald',
    hint: 'Bakım tamamlandı; zimmetli ise personele döner, değilse aktife alınır.',
  },
  {
    key: 'kayip',
    label: 'Kayıp Bildir',
    from: ['aktif', 'devirde', 'iade', 'ariza', 'bakimda'],
    resolveTo: () => 'kayip',
    tone: 'red',
    hint: 'Varlık kayıp olarak işaretlenir.',
  },
  {
    key: 'bulundu',
    label: 'Bulundu İşaretle',
    from: ['kayip'],
    resolveTo: (assignedTo) => (assignedTo ? 'devirde' : 'aktif'),
    tone: 'emerald',
    hint: 'Kayıp varlık bulundu; zimmetli ise personele döner, değilse aktife alınır.',
  },
  {
    key: 'hurda',
    label: 'Hurdala',
    from: ['aktif', 'devirde', 'iade', 'ariza', 'bakimda', 'kayip'],
    resolveTo: () => 'hurda',
    tone: 'slate',
    hint: 'Varlık kalıcı olarak hurdaya ayrılır; zimmet kapanır.',
  },
];

/** Geçerli durumdan başlatılabilecek işlemler */
export function getAvailableFlows(status: string): AssetFlowDef[] {
  return ASSET_FLOWS.filter((f) => f.from.includes(status));
}

export function getAssetFlow(key: string): AssetFlowDef | undefined {
  return ASSET_FLOWS.find((f) => f.key === key);
}

/** Varlık durumu etiketleri + rozet sınıfları */
export const ASSET_STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  aktif: { label: 'Aktif', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
  devirde: { label: 'Zimmetli', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80' },
  iade: { label: 'İade Edildi', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  ariza: { label: 'Arızalı', badgeClass: 'bg-red-50 text-red-700 border-red-200/80' },
  bakimda: { label: 'Bakımda', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80' },
  kayip: { label: 'Kayıp', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80' },
  hurda: { label: 'Hurda', badgeClass: 'bg-gray-100 text-gray-700 border-gray-300' },
};

/** Geçmiş zaman çizelgesi etiketleri (asset_history.action) */
export const ASSET_ACTION_LABELS: Record<string, string> = {
  zimmet: 'Zimmetlendi',
  devir: 'Devredildi',
  iade: 'İade Alındı',
  ariza: 'Arıza Bildirildi',
  bakim: 'Bakıma Gönderildi',
  bakim_cikis: 'Bakımdan Çıktı',
  kayip: 'Kayıp Bildirildi',
  bulundu: 'Bulundu',
  hurda: 'Hurdalandı',
};

/** Durum rozeti döndürür (bilinmeyen durumlar için güvenli varsayılan) */
export function getAssetStatusMeta(status: string) {
  return (
    ASSET_STATUS_META[status] || {
      label: status,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  );
}
