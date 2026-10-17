'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Timer,
  Building2,
  Award,
  Filter,
  Check,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Info,
  User,
  UserCheck,
  Star,
  Package,
  Truck,
  ArrowDownRight,
  CalendarClock,
} from 'lucide-react';

interface SummaryData {
  user_scope: {
    role: string;
    facility_id: string | null;
    facility_name: string;
  };
  facilities_list: Array<{ id: string; name: string; city: string }>;
  kpi: {
    total_requests: number;
    solved_requests: number;
    rejected_requests: number;
    in_progress_requests: number;
    open_requests: number;
    avg_response_minutes: number;
    avg_resolution_minutes: number;
    avg_total_minutes: number;
    response_target_minutes: number;
    resolution_target_minutes: number;
    is_response_on_target: boolean;
    is_resolution_on_target: boolean;
  };
  donut_chart: Array<{
    id: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  duration_analysis: Array<{
    label: string;
    response_minutes: number;
    resolution_minutes: number;
    total_minutes: number;
  }>;
  category_performance: Array<{
    category: string;
    label: string;
    color: string;
    total: number;
    solved: number;
    rejected: number;
    in_progress: number;
    open: number;
    resolution_rate: number;
    avg_response_minutes: number;
    avg_resolution_minutes: number;
    avg_total_minutes: number;
  }>;
  facility_scorecards: Array<{
    facility_id: string;
    facility_name: string;
    city: string;
    total_handled: number;
    solved_count: number;
    rejected_count: number;
    in_progress_count: number;
    open_count: number;
    success_rate: number;
    avg_response_minutes: number;
    avg_resolution_minutes: number;
    on_target: boolean;
    target_badge: string;
    satisfaction_avg: number | null;
    satisfaction_count: number;
  }>;
  resolver_scorecards?: Array<{
    user_id: string;
    full_name: string;
    role: string;
    total_taken: number;
    solved_count: number;
    rejected_count: number;
    in_progress_count: number;
    success_rate: number;
    avg_resolution_minutes: number;
    on_target: boolean;
    target_badge: string;
    satisfaction_avg: number | null;
    satisfaction_count: number;
  }>;
  satisfaction: {
    avg: number | null;
    count: number;
  };
  actions: {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
    overdue: number;
  };
  audits: {
    total: number;
    completed: number;
    avg_score: number;
  };
  assets: {
    total: number;
    active: number;
    in_transfer: number;
    broken: number;
  };
  facility_health: Array<{
    facility_id: string;
    facility_name: string;
    city: string;
    score: number | null;
    color: 'green' | 'amber' | 'red' | 'gray';
    label: string;
    parts: Array<{ key: string; label: string; score: number | null; detail: string }>;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    service_type: string;
    is_active: boolean;
    latest_period: string | null;
    overall: number | null;
    previous_overall: number | null;
    avg_overall: number | null;
    score_count: number;
    criteria: {
      service_quality: number;
      timeliness: number;
      complaint_management: number;
      staff_suitability: number;
      audit_results: number;
      action_closure: number;
    } | null;
  }>;
  open_actions: Array<{
    id: string;
    action_number: string;
    title: string;
    priority: string;
    status: string;
    due_date: string | null;
    overdue: boolean;
    facility_name: string | null;
    responsible_name: string | null;
  }>;
  completed_this_month: { requests: number; actions: number; audits: number };
}

function formatMinutes(minutes?: number | null) {
  if (minutes == null || minutes <= 0) return '0 dk';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} dk`;
  const hours = Math.floor(rounded / 60);
  const remainingMins = rounded % 60;
  return remainingMins > 0 ? `${hours} saat ${remainingMins} dk` : `${hours} saat`;
}

const PRIORITY_LABELS: Record<string, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
};

const PRIORITY_CLASSES: Record<string, string> = {
  dusuk: 'bg-slate-100 text-slate-700 border-slate-200',
  orta: 'bg-blue-50 text-blue-700 border-blue-200',
  yuksek: 'bg-amber-50 text-amber-700 border-amber-200',
  kritik: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  acik: 'Açık',
  devam_ediyor: 'Devam Ediyor',
  gecikti: 'Gecikti',
  kapali: 'Kapalı',
};

const HEALTH_COLORS: Record<string, { dot: string; badge: string; card: string }> = {
  green: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    card: 'border-emerald-200/80 bg-emerald-50/20',
  },
  amber: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    card: 'border-amber-200/80 bg-amber-50/20',
  },
  red: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    card: 'border-rose-200/80 bg-rose-50/20',
  },
  gray: {
    dot: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    card: 'border-slate-200/80',
  },
};

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function partScoreClass(score: number | null) {
  if (score == null) return 'text-slate-300';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-rose-600';
}

const SUPPLIER_CRITERIA: Array<{ key: string; label: string }> = [
  { key: 'service_quality', label: 'Hizmet Kalitesi' },
  { key: 'timeliness', label: 'Zamanında Hizmet' },
  { key: 'complaint_management', label: 'Şikayet Yönetimi' },
  { key: 'staff_suitability', label: 'Personel Uygunluğu' },
  { key: 'audit_results', label: 'Denetim Sonuçları' },
  { key: 'action_closure', label: 'Aksiyon Kapatma' },
];

export default function ReportsPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [timeFilter, setTimeFilter] = useState<'bu_ay' | 'son_3_ay' | 'son_6_ay' | 'bu_yil'>('son_6_ay');
  const [selectedFacility, setSelectedFacility] = useState<string>('all');
  const [scorecardTab, setScorecardTab] = useState<'facility' | 'resolver'>('facility');

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('range', timeFilter);
      if (selectedFacility && selectedFacility !== 'all') {
        params.append('facility_id', selectedFacility);
      }

      const res = await fetch(`/api/reports/summary?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Rapor verileri alınamadı');
      setData(json.data);
    } catch (err: any) {
      setError(err?.message || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [timeFilter, selectedFacility]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-slate-200 rounded-lg" />
          <div className="h-10 w-48 bg-slate-200 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 p-5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-white rounded-2xl border border-slate-200" />
          <div className="h-80 bg-white rounded-2xl border border-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-50 rounded-2xl p-6 border border-rose-200 text-rose-700 flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-semibold">Rapor yüklenirken hata oluştu</h3>
          <p className="text-sm">{error || 'Veri bulunamadı.'}</p>
        </div>
      </div>
    );
  }

  const {
    kpi,
    donut_chart,
    duration_analysis,
    category_performance,
    facility_scorecards,
    resolver_scorecards = [],
    satisfaction,
    user_scope,
    facilities_list,
    facility_health = [],
    suppliers = [],
    open_actions = [],
    completed_this_month: completedThisMonth = { requests: 0, actions: 0, audits: 0 },
    actions: actionsSummary,
    audits: auditsSummary,
    assets: assetsSummary,
  } = data;

  // Donut SVG Calculations
  const donutRadius = 60;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let currentOffset = 0;
  const donutRenderData = donut_chart.map((slice) => {
    const ratio = kpi.total_requests > 0 ? slice.count / kpi.total_requests : 0;
    const strokeDash = ratio * donutCircumference;
    const strokeOffset = -currentOffset;
    currentOffset += strokeDash;
    return {
      ...slice,
      strokeDasharray: `${strokeDash} ${donutCircumference - strokeDash}`,
      strokeDashoffset: strokeOffset,
    };
  });

  // Bar Chart calculations for Duration Analysis
  const maxDuration = Math.max(
    ...duration_analysis.map((d) => Math.max(d.total_minutes, d.resolution_minutes, d.response_minutes)),
    60
  );

  return (
    <div className="space-y-6">
      {/* Başlık ve Filtreleme Barı */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
              {user_scope.facility_name}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Performans, Süre & SLA Raporlama Merkezi
          </h1>
          <p className="text-sm text-slate-500">
            Talep karşılama (müdahale), çözüm süreleri, kategori analizi ve tesis performans karnesi
          </p>
        </div>

        {/* Filtre Seçimleri */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tesis Filtresi (Yalnızca Üst Yöneticilerde Aktiftir) */}
          {['super_admin', 'company_admin'].includes(user_scope.role) && (
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Tüm Tesisler (Konsolide)</option>
              {facilities_list.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.city})
                </option>
              ))}
            </select>
          )}

          {/* Tarih Aralığı Sekmeleri */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200">
            {[
              { id: 'bu_ay', label: 'Bu Ay' },
              { id: 'son_3_ay', label: 'Son 3 Ay' },
              { id: 'son_6_ay', label: 'Son 6 Ay' },
              { id: 'bu_yil', label: 'Bu Yıl' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeFilter === tab.id
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          A. ÖZET BİLGİ (KPI) KARTLARI (Ekranın En Üstü)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Toplam Açılan Talep */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Toplam Açılan Talep
            </p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{kpi.total_requests}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Seçilen dönemde açılan</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        {/* 2. Çözülen Talep (Yeşil renkli kart) */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm flex items-center justify-between bg-emerald-50/25">
          <div>
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Çözülen Talep
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{kpi.solved_requests}</h3>
            <p className="text-[11px] text-emerald-700/80 mt-0.5 font-medium">
              Başarı: %{kpi.total_requests > 0 ? Math.round((kpi.solved_requests / kpi.total_requests) * 100) : 0}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Reddedilen Talep (Kırmızı renkli kart) */}
        <div className="bg-white rounded-2xl p-5 border border-rose-200 shadow-sm flex items-center justify-between bg-rose-50/25">
          <div>
            <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              Reddedilen Talep
            </p>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{kpi.rejected_requests}</h3>
            <p className="text-[11px] text-rose-700/80 mt-0.5">Gerekçeli kapatılan</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Ortalama Karşılama Süresi (T2 - T1) (SLA Hedef Uyarı Rozetli) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Ort. Karşılama (T2 - T1)
              </p>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                  kpi.is_response_on_target
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {kpi.is_response_on_target ? 'Hedefte' : 'Hedef Üstü'}
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {formatMinutes(kpi.avg_response_minutes)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hedef: &le; {kpi.response_target_minutes} dakika
            </p>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              kpi.is_response_on_target
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            <Timer className="w-5 h-5" />
          </div>
        </div>

        {/* 5. Ortalama Çözüm Süresi (T5 - T2) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ort. Çözüm (T5 - T2)
            </p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {formatMinutes(kpi.avg_resolution_minutes)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Toplam Süre: {formatMinutes(kpi.avg_total_minutes)}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* 6. Memnuniyet Skoru (Kapanış Anketi) */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm flex items-center justify-between bg-amber-50/25">
          <div>
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Memnuniyet Skoru
            </p>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
              {satisfaction.avg != null
                ? `${satisfaction.avg.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`
                : '—'}
            </h3>
            <p className="text-[11px] text-amber-700/80 mt-0.5">
              {satisfaction.count > 0 ? `${satisfaction.count} değerlendirme` : 'Henüz değerlendirme yok'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Star className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          A2. ŞUBE DURUM PANOSU (Trafik Işığı) — son 90 gün
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Şube Durum Panosu</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Son 90 gün verisiyle trafik ışığı: Denetim Puanı %35 · Memnuniyet %25 · Aksiyon Kapatma %25 · Müdahale Hızı %15
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> İyi (≥80)
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Takip Gerekli (60-79)
            </span>
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Kritik (&lt;60)
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Veri Yok
            </span>
          </div>
        </div>

        {facility_health.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">
            Gösterilecek tesis verisi bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {facility_health.map((h) => {
              const palette = HEALTH_COLORS[h.color] || HEALTH_COLORS.gray;
              return (
                <div
                  key={h.facility_id}
                  className={`rounded-2xl border p-4 shadow-sm ${palette.card}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${palette.dot}`} />
                        <span className="font-bold text-slate-900 text-sm truncate">{h.facility_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 ml-5">
                        {h.city || 'Şehir Belirtilmemiş'}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${palette.badge}`}
                    >
                      {h.score != null ? `${h.score}/100` : '—'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {h.parts.map((p) => (
                      <div key={p.key} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-500 font-medium w-28 flex-shrink-0">{p.label}</span>
                        <span className="text-slate-600 truncate flex-1">{p.detail}</span>
                        <span className={`font-bold font-mono w-9 text-right ${partScoreClass(p.score)}`}>
                          {p.score != null ? p.score : '—'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                    <span className={`text-xs font-bold ${palette.badge.split(' ')[1]}`}>{h.label}</span>
                    <a
                      href={`/dashboard/branches/${h.facility_id}`}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      Şube Detayı
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          B. GRAFİKLER (Uygulamanın Çıkaracağı Analizler)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. TALEP DURUM DAĞILIMI (Donut Chart - Halka Grafik) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>Talep Durum Dağılımı</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">Halka Grafik</span>
            </div>

            {/* SVG Donut */}
            <div className="flex items-center justify-center py-4">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                  {/* Background Track */}
                  <circle
                    cx="80"
                    cy="80"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="18"
                  />
                  {/* Slices */}
                  {donutRenderData.map((slice, i) => (
                    <circle
                      key={i}
                      cx="80"
                      cy="80"
                      r={donutRadius}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="18"
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      className="transition-all duration-700 ease-out"
                    />
                  ))}
                </svg>

                {/* Donut Merkez Metni */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {kpi.total_requests}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Toplam Talep
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Donut Lejantı */}
          <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-slate-100">
            {donut_chart.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-medium text-slate-700 truncate">{item.label}</span>
                </div>
                <div className="text-xs font-bold text-slate-900 text-right ml-2">
                  <span>%{item.percentage}</span>
                  <span className="text-[10px] text-slate-400 block font-normal">({item.count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. SÜRE VE PERFORMANS ANALİZİ (Bar Chart - Çubuk Grafik) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>Süre ve Performans Analizi (SLA Kıyaslama)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kategori bazında Karşılama (T2-T1), Çözüm (T3-T2) ve Toplam Süre kıyaslaması
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">Çubuk Grafik</span>
            </div>

            {/* Lejant */}
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600 mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-500" />
                <span>Karşılama / Müdahale (T2-T1)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500" />
                <span>Çözüm Süresi (T3-T2)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-500" />
                <span>Toplam Süre (T3-T1)</span>
              </div>
            </div>

            {/* Çubuk Grafiği (Bar Chart) */}
            <div className="space-y-4 py-2">
              {duration_analysis.length > 0 ? (
                duration_analysis.map((row, idx) => {
                  const respWidth = Math.min(100, Math.max(3, (row.response_minutes / maxDuration) * 100));
                  const resolWidth = Math.min(100, Math.max(3, (row.resolution_minutes / maxDuration) * 100));
                  const totalWidth = Math.min(100, Math.max(3, (row.total_minutes / maxDuration) * 100));

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{row.label}</span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          Toplam: {formatMinutes(row.total_minutes)}
                        </span>
                      </div>

                      {/* Çoklu Çubuk Grubu */}
                      <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        {/* Karşılama Çubuğu */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] w-14 font-semibold text-slate-400">Müdahale</span>
                          <div className="flex-1 bg-slate-200/60 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${respWidth}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 w-16 text-right">
                            {formatMinutes(row.response_minutes)}
                          </span>
                        </div>

                        {/* Çözüm Çubuğu */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] w-14 font-semibold text-slate-400">Çözüm</span>
                          <div className="flex-1 bg-slate-200/60 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-amber-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${resolWidth}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 w-16 text-right">
                            {formatMinutes(row.resolution_minutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-xs text-slate-400">
                  Dönemde henüz tamamlanmış veya karşılama süresi ölçülmüş talep bulunmuyor.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. KATEGORİ BAZLI PERFORMANS (Temizlik, Yemekhane, Teknik vb.)
         ========================================================================= */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Kategori Bazlı Talep & Çözüm Performansı</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Hangi kategoride ne kadar talep açılıyor, kaçı çözümlendi ve çözüm başarı oranları
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {category_performance.map((cat) => (
            <div
              key={cat.category}
              className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/70 space-y-3 hover:shadow-xs transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs font-bold text-slate-800">{cat.label}</span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700">
                  {cat.total} Talep
                </span>
              </div>

              {/* İlerleme Çubuğu - Çözüm Oranı */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500 text-[11px]">Çözüm Oranı</span>
                  <span className="font-extrabold text-emerald-600">%{cat.resolution_rate}</span>
                </div>
                <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${cat.resolution_rate}%` }}
                  />
                </div>
              </div>

              {/* Alt Metrikler */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] pt-1 border-t border-slate-200/50">
                <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block">Çözülen</span>
                  <span className="font-bold text-emerald-700">{cat.solved}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block">İşlemde</span>
                  <span className="font-bold text-amber-700">{cat.in_progress}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block">Red</span>
                  <span className="font-bold text-rose-700">{cat.rejected}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          4. TESİS VE SORUMLU PERFORMANS KARNELERİ (Ayrı Tesis & Sorumlu Odaklı)
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-0">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Performans ve SLA Karnesi</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Karşılama süresi (T2-T1) tesisin karnesine; çözüm süresi (T3-T2) ise talebi üzerine alan kişinin karnesine yazılır.
            </p>
          </div>

          {/* Karne Seçici Sekmeleri (Tesis / Sorumlu) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 self-start sm:self-auto">
            <button
              onClick={() => setScorecardTab('facility')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scorecardTab === 'facility'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Tesis Karnesi (T2 - T1)</span>
            </button>
            <button
              onClick={() => setScorecardTab('resolver')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scorecardTab === 'resolver'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Sorumlu Karnesi (T3 - T2)</span>
            </button>
          </div>
        </div>

        {scorecardTab === 'facility' ? (
          /* =========================================================================
             A. TESİS KARNESİ: Karşılama Süresi (T2 - T1) Odaklı
             ========================================================================= */
          <div className="overflow-x-auto">
            <div className="px-6 py-2 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between text-xs text-blue-800">
              <span className="flex items-center gap-1.5 font-medium">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Talep karşılanana kadar (üzerine alınana kadar) geçen süre doğrudan tesisin performans karnesine yazılır.</span>
              </span>
              <span className="font-mono font-bold bg-white px-2.5 py-0.5 rounded-md border border-blue-200">
                Hedef Karşılama: &le; 60 dk
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Tesis / Lokasyon</th>
                  <th className="py-3.5 px-4 text-center">Toplam Talep</th>
                  <th className="py-3.5 px-4 text-center">Bekleyen (Yeni)</th>
                  <th className="py-3.5 px-4 text-center">İşlemde</th>
                  <th className="py-3.5 px-4 text-center">Çözülen</th>
                  <th className="py-3.5 px-4 text-center">Başarı Oranı</th>
                  <th className="py-3.5 px-4 text-center text-blue-700 bg-blue-50/40">Ort. Karşılama (T2-T1)</th>
                  <th className="py-3.5 px-4 text-center text-amber-700 bg-amber-50/40">Memnuniyet (1-5)</th>
                  <th className="py-3.5 px-6 text-right">SLA Karşılama Durumu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facility_scorecards.length > 0 ? (
                  facility_scorecards.map((f) => (
                    <tr key={f.facility_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>{f.facility_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 ml-6">{f.city || 'Şehir Belirtilmemiş'}</div>
                      </td>

                      <td className="py-4 px-4 text-center font-bold font-mono">{f.total_handled}</td>

                      <td className="py-4 px-4 text-center font-semibold text-blue-700 font-mono">
                        {f.open_count}
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-amber-700 font-mono">
                        {f.in_progress_count}
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-emerald-700 font-mono">
                        {f.solved_count}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <div className="font-bold text-slate-800">%{f.success_rate}</div>
                        <div className="w-16 mx-auto bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${f.success_rate}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center font-mono font-bold text-blue-700 bg-blue-50/20">
                        {formatMinutes(f.avg_response_minutes)}
                      </td>

                      <td className="py-4 px-4 text-center bg-amber-50/10">
                        {f.satisfaction_count > 0 && f.satisfaction_avg != null ? (
                          <div className="inline-flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="font-bold text-amber-700">
                              {f.satisfaction_avg.toLocaleString('tr-TR', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400">({f.satisfaction_count})</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            f.on_target
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {f.on_target ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{f.target_badge}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Kayıtlı tesis karne verisi bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* =========================================================================
             B. SORUMLU KARNESİ: Çözüm İşlem Süresi (T3 - T2) Odaklı
             ========================================================================= */
          <div className="overflow-x-auto">
            <div className="px-6 py-2 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-800">
              <span className="flex items-center gap-1.5 font-medium">
                <Info className="w-4 h-4 text-indigo-600" />
                <span>Talep üzerine alındıktan kapanana kadar geçen süre (T5 - T2) doğrudan ilgili kişinin karnesine yazılır.</span>
              </span>
              <span className="font-mono font-bold bg-white px-2.5 py-0.5 rounded-md border border-indigo-200">
                Hedef Çözüm: &le; 4 Saat (240 dk)
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Sorumlu / Çözücü Yetkili</th>
                  <th className="py-3.5 px-4 text-center">Rol</th>
                  <th className="py-3.5 px-4 text-center">Üzerine Alınan</th>
                  <th className="py-3.5 px-4 text-center">Çözülen</th>
                  <th className="py-3.5 px-4 text-center">İşlemde Olan</th>
                  <th className="py-3.5 px-4 text-center">Reddedilen</th>
                  <th className="py-3.5 px-4 text-center">Çözüm Oranı</th>
                  <th className="py-3.5 px-4 text-center text-indigo-700 bg-indigo-50/40">Ort. Çözüm (T5-T2)</th>
                  <th className="py-3.5 px-4 text-center text-amber-700 bg-amber-50/40">Memnuniyet (1-5)</th>
                  <th className="py-3.5 px-6 text-right">SLA Çözüm Durumu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolver_scorecards.length > 0 ? (
                  resolver_scorecards.map((r) => (
                    <tr key={r.user_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {r.full_name?.slice(0, 2).toUpperCase() || 'SO'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{r.full_name}</div>
                            <div className="text-[11px] text-slate-400">Çözücü Yetkili</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium capitalize">
                          {r.role.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center font-bold font-mono">{r.total_taken}</td>

                      <td className="py-4 px-4 text-center font-semibold text-emerald-700 font-mono">
                        {r.solved_count}
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-amber-700 font-mono">
                        {r.in_progress_count}
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-rose-700 font-mono">
                        {r.rejected_count}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <div className="font-bold text-slate-800">%{r.success_rate}</div>
                        <div className="w-16 mx-auto bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-indigo-500 h-full rounded-full"
                            style={{ width: `${r.success_rate}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/20">
                        {formatMinutes(r.avg_resolution_minutes)}
                      </td>

                      <td className="py-4 px-4 text-center bg-amber-50/10">
                        {r.satisfaction_count > 0 && r.satisfaction_avg != null ? (
                          <div className="inline-flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="font-bold text-amber-700">
                              {r.satisfaction_avg.toLocaleString('tr-TR', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400">({r.satisfaction_count})</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            r.on_target
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {r.on_target ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{r.target_badge}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Henüz talebi üzerine alıp sonuçlandıran sorumlu karne verisi bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          5. TEDARİKÇİ PERFORMANS KARNESİ
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            <span>Tedarikçi Performans Karnesi</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Son değerlendirme dönemi ve önceki döneme göre değişim (hizmet, zamanındalık, şikayet, personel, denetim, aksiyon kapatma)
          </p>
        </div>

        {suppliers.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">
            Kayıtlı tedarikçi bulunamadı veya henüz karne puanı girilmedi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Tedarikçi</th>
                  <th className="py-3.5 px-4 text-center">Son Dönem</th>
                  <th className="py-3.5 px-4 text-center">Genel Puan</th>
                  <th className="py-3.5 px-4 text-center">Değişim</th>
                  <th className="py-3.5 px-6">Kriter Puanları</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => {
                  const delta =
                    s.overall != null && s.previous_overall != null
                      ? Math.round((s.overall - s.previous_overall) * 10) / 10
                      : null;
                  const overallClass =
                    s.overall == null
                      ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : s.overall >= 85
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : s.overall >= 70
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {s.service_type}
                          {!s.is_active && ' · Pasif'}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center text-slate-600 whitespace-nowrap">
                        {s.latest_period ? formatDate(s.latest_period) : '—'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${overallClass}`}
                        >
                          {s.overall != null ? s.overall.toFixed(0) : '—'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {s.score_count > 0
                            ? `${s.score_count} dönem ort: ${s.avg_overall?.toFixed(1) ?? '—'}`
                            : 'Puan yok'}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {delta != null ? (
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-500'
                            }`}
                          >
                            {delta > 0 ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : delta < 0 ? (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            ) : null}
                            {delta > 0 ? '+' : ''}
                            {delta.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {s.criteria ? (
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 max-w-lg">
                            {SUPPLIER_CRITERIA.map((c) => {
                              const val = (s.criteria as any)[c.key];
                              return (
                                <div key={c.key} className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] text-slate-500 truncate">{c.label}</span>
                                  <span className="text-[11px] font-bold font-mono text-slate-700">
                                    {Number(val || 0).toFixed(0)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-300">Değerlendirme yok</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          6. BU AY TAMAMLANAN İŞLER & AÇIK AKSİYONLAR
         ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Bu Ay Tamamlanan İşler */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <CalendarClock className="w-5 h-5 text-teal-600" />
              <span>Bu Ay Tamamlanan İşler</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">İçinde bulunulan takvim ayında kapatılan kayıtlar</p>

            <div className="space-y-3">
              {[
                { label: 'Çözülen Talep', value: completedThisMonth.requests, cls: 'bg-emerald-50 text-emerald-600' },
                { label: 'Kapatılan Aksiyon', value: completedThisMonth.actions, cls: 'bg-blue-50 text-blue-600' },
                { label: 'Tamamlanan Denetim', value: completedThisMonth.audits, cls: 'bg-indigo-50 text-indigo-600' },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between bg-slate-50/70 border border-slate-100 rounded-xl px-4 py-3"
                >
                  <span className="text-xs font-semibold text-slate-600">{row.label}</span>
                  <span className={`text-lg font-extrabold px-3 py-0.5 rounded-lg ${row.cls}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Operasyon Özeti */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-slate-500" />
              <span>Operasyon Özeti</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Aksiyonlar</span>
                <span className="font-bold text-slate-800">
                  {actionsSummary.total} toplam · {actionsSummary.open + actionsSummary.in_progress} açık ·{' '}
                  <span className={actionsSummary.overdue > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    {actionsSummary.overdue} gecikmiş
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Denetimler</span>
                <span className="font-bold text-slate-800">
                  {auditsSummary.total} toplam · {auditsSummary.completed} tamamlanan · ort{' '}
                  {auditsSummary.total > 0 ? `${auditsSummary.avg_score}/100` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Varlıklar</span>
                <span className="font-bold text-slate-800">
                  {assetsSummary.total} toplam · {assetsSummary.active} aktif ·{' '}
                  <span className={assetsSummary.broken > 0 ? 'text-rose-600' : 'text-slate-800'}>
                    {assetsSummary.broken} arıza/bakım
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Açık Aksiyonlar */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Açık Aksiyonlar</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Termin tarihi yaklaşan ve gecikmiş aksiyonlar öncelikli listelenir
              </p>
            </div>
            {actionsSummary.overdue > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                {actionsSummary.overdue} gecikmiş
              </span>
            )}
          </div>

          {open_actions.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-10">
              Açık aksiyon bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-6">Aksiyon</th>
                    <th className="py-3 px-3 text-center">Tesis</th>
                    <th className="py-3 px-3 text-center">Sorumlu</th>
                    <th className="py-3 px-3 text-center">Öncelik</th>
                    <th className="py-3 px-6 text-right">Termin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {open_actions.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 max-w-[260px]">
                        <div className="font-bold text-slate-900 truncate">{a.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{a.action_number}</div>
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-600 whitespace-nowrap">
                        {a.facility_name || '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-600 whitespace-nowrap">
                        {a.responsible_name || '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            PRIORITY_CLASSES[a.priority] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {PRIORITY_LABELS[a.priority] || a.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <div className={`font-bold ${a.overdue ? 'text-rose-600' : 'text-slate-700'}`}>
                          {formatDate(a.due_date)}
                        </div>
                        {a.overdue ? (
                          <span className="text-[10px] font-bold text-rose-500">GECİKMİŞ</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            {ACTION_STATUS_LABELS[a.status] || a.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
