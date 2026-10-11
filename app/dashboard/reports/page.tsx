'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  ClipboardList,
  Package,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Calendar,
  Filter,
} from 'lucide-react';

interface SummaryData {
  requests: {
    total: number;
    by_status: {
      yeni: number;
      islemde: number;
      tamamlandi: number;
      reddedildi: number;
    };
    by_category: { category: string; count: number }[];
    monthly: { month: string; count: number }[];
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
}

const CATEGORY_NAMES: Record<string, { label: string; color: string; bg: string }> = {
  yemekhane: { label: 'Yemekhane', color: '#f97316', bg: 'bg-orange-500' },
  servis: { label: 'Servis / Ulaşım', color: '#3b82f6', bg: 'bg-blue-500' },
  temizlik: { label: 'Temizlik & Hijyen', color: '#06b6d4', bg: 'bg-cyan-500' },
  filo: { label: 'Filo & Taşıt', color: '#a855f7', bg: 'bg-purple-500' },
  varlik: { label: 'Varlık & Zimmet', color: '#6366f1', bg: 'bg-indigo-500' },
  teknik: { label: 'Teknik & Bakım', color: '#f43f5e', bg: 'bg-rose-500' },
  diger: { label: 'Diğer Talepler', color: '#64748b', bg: 'bg-slate-500' },
};

export default function ReportsPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'bu_ay' | 'son_3_ay' | 'son_6_ay' | 'bu_yil'>('son_6_ay');

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/reports/summary');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Rapor verileri alınamadı');
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse p-5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse p-6" />
          ))}
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

  // Calculations for summary stats
  const totalActions = data.actions.total;
  const closedRate = totalActions > 0 ? Math.round((data.actions.closed / totalActions) * 100) : 0;

  // Monthly trend calculation
  const monthlyList = data.requests.monthly || [];
  const currentMonthCount = monthlyList.length > 0 ? monthlyList[monthlyList.length - 1].count : 0;
  const prevMonthCount = monthlyList.length > 1 ? monthlyList[monthlyList.length - 2].count : 0;
  const monthlyDiff = currentMonthCount - prevMonthCount;
  const monthlyDiffPercent =
    prevMonthCount > 0 ? Math.round((monthlyDiff / prevMonthCount) * 100) : monthlyDiff > 0 ? 100 : 0;

  // Area chart calculations
  const maxMonthlyVal = Math.max(...monthlyList.map((m) => m.count), 5);
  const chartWidth = 500;
  const chartHeight = 180;
  const chartPadding = { top: 20, right: 20, bottom: 30, left: 30 };
  const graphW = chartWidth - chartPadding.left - chartPadding.right;
  const graphH = chartHeight - chartPadding.top - chartPadding.bottom;

  const points = monthlyList.map((m, idx) => {
    const x = chartPadding.left + (idx / Math.max(monthlyList.length - 1, 1)) * graphW;
    const y = chartPadding.top + graphH - (m.count / maxMonthlyVal) * graphH;
    return { x, y, count: m.count, month: m.month };
  });

  const linePath =
    points.length > 0
      ? `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`
      : '';
  const areaPath =
    points.length > 0
      ? `M ${points[0].x},${chartPadding.top + graphH} L ${points
          .map((p) => `${p.x},${p.y}`)
          .join(' L ')} L ${points[points.length - 1].x},${chartPadding.top + graphH} Z`
      : '';

  // Donut chart calculations
  const { yeni, islemde, tamamlandi, reddedildi } = data.requests.by_status;
  const totalStatusRequests = yeni + islemde + tamamlandi + reddedildi;
  const donutRadius = 60;
  const donutCircumference = 2 * Math.PI * donutRadius;

  const donutSlices = [
    { label: 'Tamamlandı', count: tamamlandi, color: '#10b981', strokeClass: 'text-emerald-500' },
    { label: 'İşlemde', count: islemde, color: '#f59e0b', strokeClass: 'text-amber-500' },
    { label: 'Yeni', count: yeni, color: '#3b82f6', strokeClass: 'text-blue-500' },
    { label: 'Reddedildi', count: reddedildi, color: '#ef4444', strokeClass: 'text-rose-500' },
  ];

  let currentOffset = 0;
  const donutRenderData = donutSlices.map((slice) => {
    const ratio = totalStatusRequests > 0 ? slice.count / totalStatusRequests : 0;
    const strokeDash = ratio * donutCircumference;
    const strokeOffset = -currentOffset;
    currentOffset += strokeDash;
    return {
      ...slice,
      percentage: totalStatusRequests > 0 ? Math.round(ratio * 100) : 0,
      strokeDasharray: `${strokeDash} ${donutCircumference - strokeDash}`,
      strokeDashoffset: strokeOffset,
    };
  });

  // Max category calculation for horizontal bar chart
  const maxCategoryCount = Math.max(...data.requests.by_category.map((c) => c.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Raporlama & Analitik</h1>
            <p className="text-sm text-slate-500">
              Operasyonel süreçler, talep eğilimleri ve tesis performans göstergeleri
            </p>
          </div>
        </div>

        {/* Date Filter Tabs */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600 border border-slate-200">
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
                  ? 'bg-white text-blue-600 shadow-sm font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards Row (4 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Toplam Talep */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Toplam Talep</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.requests.total}</h3>
            <div className="flex items-center gap-1 text-xs mt-1.5 font-medium">
              <span
                className={`flex items-center gap-0.5 ${
                  monthlyDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                <TrendingUp
                  className={`w-3.5 h-3.5 ${monthlyDiff < 0 ? 'transform rotate-180' : ''}`}
                />
                %{Math.abs(monthlyDiffPercent)}
              </span>
              <span className="text-slate-400">geçen aya göre</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ClipboardList className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Toplam Aksiyon */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Toplam Aksiyon</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.actions.total}</h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
              <span className="font-semibold text-emerald-600">%{closedRate}</span>
              <span>tamamlanma oranı</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Denetim Ortalaması */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Denetim Ortalaması
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">%{data.audits.avg_score}</h3>
            <p className="text-xs text-slate-400 mt-1.5">{data.audits.completed} tamamlanan denetim</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Toplam Varlık */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Toplam Varlık</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.assets.total}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1.5">
              {data.assets.active} aktif demirbaş
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Charts Section (2 columns grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Talep Durumu Dağılımı (Donut Chart) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base">Talep Durumu Dağılımı</h3>
            <span className="text-xs text-slate-400 font-medium">Toplam: {totalStatusRequests}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            {/* SVG Donut */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={donutRadius} stroke="#f1f5f9" strokeWidth="18" fill="transparent" />
                {totalStatusRequests > 0 ? (
                  donutRenderData.map((slice, i) => (
                    <circle
                      key={i}
                      cx="80"
                      cy="80"
                      r={donutRadius}
                      stroke={slice.color}
                      strokeWidth="18"
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      fill="transparent"
                      className="transition-all duration-700 ease-out"
                    />
                  ))
                ) : (
                  <circle cx="80" cy="80" r={donutRadius} stroke="#cbd5e1" strokeWidth="18" fill="transparent" />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-slate-800">{totalStatusRequests}</span>
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Talep</span>
              </div>
            </div>

            {/* Legend with Counts and % */}
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2.5 w-full sm:w-auto">
              {donutRenderData.map((slice, i) => (
                <div key={i} className="flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md" style={{ backgroundColor: slice.color }} />
                    <span className="text-slate-600 font-medium">{slice.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800">{slice.count}</span>
                    <span className="text-slate-400 text-[11px]">({slice.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Aylık Talep Trendi (Area Chart) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-900 text-base">Aylık Talep Trendi</h3>
            <span className="text-xs text-slate-400">Son 6 Aylık Seyir</span>
          </div>

          <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44 overflow-visible">
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.5, 1].map((ratio, idx) => {
                const y = chartPadding.top + graphH * ratio;
                return (
                  <line
                    key={idx}
                    x1={chartPadding.left}
                    y1={y}
                    x2={chartWidth - chartPadding.right}
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Filled Area */}
              {areaPath && <path d={areaPath} fill="url(#blueGradient)" />}

              {/* Trend Line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                  <text
                    x={p.x}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-medium"
                  >
                    {p.month}
                  </text>
                  <text
                    x={p.x}
                    y={p.y - 8}
                    textAnchor="middle"
                    className="text-[11px] fill-slate-700 font-bold"
                  >
                    {p.count}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* 3. Talep Kategorileri (Horizontal Bar Chart) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base">Talep Kategorileri</h3>
            <span className="text-xs text-slate-400">Kategori Bazlı Hacim</span>
          </div>

          <div className="space-y-3">
            {data.requests.by_category.map((item) => {
              const info = CATEGORY_NAMES[item.category] || {
                label: item.category,
                color: '#64748b',
                bg: 'bg-slate-500',
              };
              const percentage = Math.round((item.count / maxCategoryCount) * 100);

              return (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{info.label}</span>
                    <span className="font-bold text-slate-900">{item.count} adet</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.max(percentage, item.count > 0 ? 5 : 0)}%`,
                        backgroundColor: info.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Aksiyon Özeti (2x2 Mini Stat Grid) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base">Aksiyon Özeti</h3>
            <span className="text-xs text-slate-400">Durum ve Takip</span>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Açık */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Açık</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  Bekliyor
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900">{data.actions.open}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">İşlem sırasındaki görevler</p>
              </div>
            </div>

            {/* Devam Ediyor */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Devam Ediyor</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                  Süreçte
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-amber-600">
                  {data.actions.in_progress}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">Çözüm aşamasındaki aksiyonlar</p>
              </div>
            </div>

            {/* Tamamlandı */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Tamamlandı</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                  Kapalı
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-emerald-600">
                  {data.actions.closed}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">Başarıyla sonuçlananlar</p>
              </div>
            </div>

            {/* Gecikmiş */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Gecikmiş</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                  Kritik
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-rose-600">
                  {data.actions.overdue}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">Termini geçen aksiyonlar</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
