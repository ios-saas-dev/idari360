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
  }>;
}

function formatMinutes(minutes?: number | null) {
  if (minutes == null || minutes <= 0) return '0 dk';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} dk`;
  const hours = Math.floor(rounded / 60);
  const remainingMins = rounded % 60;
  return remainingMins > 0 ? `${hours} saat ${remainingMins} dk` : `${hours} saat`;
}

export default function ReportsPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [timeFilter, setTimeFilter] = useState<'bu_ay' | 'son_3_ay' | 'son_6_ay' | 'bu_yil'>('son_6_ay');
  const [selectedFacility, setSelectedFacility] = useState<string>('all');

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

  const { kpi, donut_chart, duration_analysis, category_performance, facility_scorecards, user_scope, facilities_list } = data;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

        {/* 5. Ortalama Çözüm Süresi (T3 - T2) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ort. Çözüm (T3 - T2)
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
          4. TESİS / SORUMLU KARNESİ (Facility & Manager Scorecard)
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-0">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Tesis / Sorumlu Performans Karnesi</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Hangi tesis ve sorumlu taleplere en hızlı müdahale ediyor, hangisi hedeflerin gerisinde kalıyor?
            </p>
          </div>
          <span className="text-xs font-mono font-semibold bg-slate-100 px-3 py-1 rounded-lg text-slate-700">
            Hedef Karşılama: &le; 60 dk
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-6">Tesis / Lokasyon</th>
                <th className="py-3.5 px-4 text-center">Toplam Talep</th>
                <th className="py-3.5 px-4 text-center">Çözülen</th>
                <th className="py-3.5 px-4 text-center">İşlemde</th>
                <th className="py-3.5 px-4 text-center">Reddedilen</th>
                <th className="py-3.5 px-4 text-center">Başarı Oranı</th>
                <th className="py-3.5 px-4 text-center">Ort. Karşılama (T2-T1)</th>
                <th className="py-3.5 px-4 text-center">Ort. Çözüm (T3-T2)</th>
                <th className="py-3.5 px-6 text-right">SLA Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facility_scorecards.length > 0 ? (
                facility_scorecards.map((f) => (
                  <tr key={f.facility_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900 text-sm">{f.facility_name}</div>
                      <div className="text-[11px] text-slate-400">{f.city || 'Şehir Belirtilmemiş'}</div>
                    </td>

                    <td className="py-4 px-4 text-center font-bold font-mono">{f.total_handled}</td>

                    <td className="py-4 px-4 text-center font-semibold text-emerald-700 font-mono">
                      {f.solved_count}
                    </td>

                    <td className="py-4 px-4 text-center font-semibold text-amber-700 font-mono">
                      {f.in_progress_count}
                    </td>

                    <td className="py-4 px-4 text-center font-semibold text-rose-700 font-mono">
                      {f.rejected_count}
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

                    <td className="py-4 px-4 text-center font-mono font-semibold">
                      {formatMinutes(f.avg_response_minutes)}
                    </td>

                    <td className="py-4 px-4 text-center font-mono text-slate-600">
                      {formatMinutes(f.avg_resolution_minutes)}
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
      </div>
    </div>
  );
}
