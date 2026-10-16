'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ClipboardList,
  Hourglass,
  CheckCircle2,
  XCircle,
  Plus,
  Bus,
  UtensilsCrossed,
  Sparkles,
  Package,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Megaphone,
  Car,
  Building2,
  BarChart3,
  Settings,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

interface RequestStatusSlice {
  id: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface TrendPoint {
  month: string;
  count: number;
  solved?: number;
}

interface CategoryPerformanceItem {
  label: string;
  color?: string;
  total: number;
}

interface AnnouncementItem {
  id: string;
  title: string;
  content?: string | null;
  published_at?: string | null;
  created_at?: string | null;
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('Yönetici');
  const [userRole, setUserRole] = useState<string>('');
  const [requestStats, setRequestStats] = useState<{
    totalRequests: number;
    slices: RequestStatusSlice[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [monthlyTrend, setMonthlyTrend] = useState<TrendPoint[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryPerformanceItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, role')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.full_name) {
            setUserName(profile.full_name);
          } else if (profile?.email) {
            setUserName(profile.email.split('@')[0]);
          }

          if (profile?.role) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.error('Kullanıcı bilgisi yüklenemedi:', err);
      }
    }
    loadUser();
  }, []);

  // Talep durum dağılımı — Raporlar modülü ile aynı veri kaynağından beslenir
  // (/api/reports/summary → donut_chart + kpi). Kartlar ve grafik aynı veriyi kullanır.
  useEffect(() => {
    async function loadRequestStats() {
      try {
        const res = await fetch('/api/reports/summary');
        if (!res.ok) throw new Error('Talep özeti alınamadı');
        const json = await res.json();
        const summary = json?.data;
        setRequestStats({
          totalRequests: summary?.kpi?.total_requests ?? 0,
          slices: Array.isArray(summary?.donut_chart) ? summary.donut_chart : [],
        });
        setMonthlyTrend(Array.isArray(summary?.monthly_trend) ? summary.monthly_trend : []);
        setCategoryStats(Array.isArray(summary?.category_performance) ? summary.category_performance : []);
      } catch (err) {
        console.error('Talep durum dağılımı yüklenemedi:', err);
      } finally {
        setStatsLoading(false);
      }
    }
    loadRequestStats();
  }, []);

  // Bugünün tarihi (sunucu/istemci gün farkını önlemek için mount sonrası hesaplanır)
  useEffect(() => {
    const now = new Date();
    const datePart = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const weekdayPart = now.toLocaleDateString('tr-TR', { weekday: 'long' });
    setTodayLabel(`${datePart}, ${weekdayPart}`);
  }, []);

  // Son duyurular — gerçek duyuru modülünden (/api/announcements)
  useEffect(() => {
    async function loadAnnouncements() {
      try {
        const res = await fetch('/api/announcements');
        if (!res.ok) throw new Error('Duyurular alınamadı');
        const json = await res.json();
        setAnnouncements(Array.isArray(json?.data) ? json.data.slice(0, 3) : []);
      } catch (err) {
        console.error('Duyurular yüklenemedi:', err);
      } finally {
        setAnnouncementsLoading(false);
      }
    }
    loadAnnouncements();
  }, []);

  // Hızlı işlemler listesi (Rol durumuna göre dinamik)
  const isSuperAdmin = userRole === 'super_admin';
  const isCompanyAdmin = userRole === 'company_admin';

  const quickActions = [
    ...(isSuperAdmin || isCompanyAdmin ? [{
      title: isSuperAdmin ? 'Platform Yönetimi' : 'Şirket & Tesis Yönetimi',
      href: '/dashboard/admin',
      icon: ShieldCheck,
      color: 'bg-purple-600 text-white',
    }] : []),
    { title: 'Yeni Talep Oluştur', href: '/dashboard/requests/new', icon: Plus, color: 'bg-blue-500 text-white' },
    { title: 'Servis Denetim Formu', href: '/dashboard/audits?module=shuttle', icon: Bus, color: 'bg-blue-100 text-blue-600' },
    { title: 'Yemekhane Denetim Formu', href: '/dashboard/audits?module=catering', icon: UtensilsCrossed, color: 'bg-green-100 text-green-600' },
    { title: 'Temizlik Denetim Formu', href: '/dashboard/audits?module=cleaning', icon: Sparkles, color: 'bg-purple-100 text-purple-600' },
    { title: 'Stok Takip Desbord', href: '/dashboard/assets', icon: Package, color: 'bg-amber-100 text-amber-600' },
  ];

  // Kategoriler (Görselin en altındaki hızlı navigasyon çubuğu)
  const categories = [
    { name: 'Yemekhane', icon: UtensilsCrossed, color: 'text-green-500', href: '/dashboard/cafeteria' },
    { name: 'Servis', icon: Bus, color: 'text-blue-500', href: '/dashboard/shuttle' },
    { name: 'Filo', icon: Car, color: 'text-cyan-500', href: '/dashboard/fleet' },
    { name: 'Temizlik', icon: Sparkles, color: 'text-purple-500', href: '/dashboard/cleaning' },
    { name: 'Varlıklar', icon: Package, color: 'text-indigo-500', href: '/dashboard/assets' },
    { name: 'Şubeler', icon: Building2, color: 'text-blue-600', href: '/dashboard/branches' },
    { name: 'Raporlar', icon: BarChart3, color: 'text-amber-500', href: '/dashboard/reports' },
    { name: 'Duyurular', icon: Megaphone, color: 'text-red-500', href: '/dashboard/announcements' },
    { name: 'Ayarlar', icon: Settings, color: 'text-slate-600', href: '/dashboard/settings' },
  ];

  // Talep durum dağılımı — kartlar ve donut grafik aynı veriden beslenir
  const statusSlices = requestStats?.slices ?? [];
  const totalRequests = requestStats?.totalRequests ?? 0;

  // Durum kartları (yeni grafiğin dilimleriyle bire bir eşleşir)
  const statusCards = [
    { id: 'yeni', title: 'Açık Talepler', icon: ClipboardList, tone: 'bg-blue-50 border-blue-100 text-blue-600' },
    { id: 'islemde', title: 'Devam Eden Talepler', icon: Hourglass, tone: 'bg-amber-50 border-amber-100 text-amber-500' },
    { id: 'cozumlendi', title: 'Çözümlenen Talepler', icon: CheckCircle2, tone: 'bg-green-50 border-green-100 text-green-600' },
    { id: 'reddedildi', title: 'Reddedilen Talepler', icon: XCircle, tone: 'bg-red-50 border-red-100 text-red-600' },
  ];

  // Donut SVG hesaplamaları (Raporlar modülündeki grafikle aynı mantık)
  const donutRadius = 60;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let currentOffset = 0;
  const donutRenderData = statusSlices.map((slice) => {
    const ratio = totalRequests > 0 ? slice.count / totalRequests : 0;
    const strokeDash = ratio * donutCircumference;
    const strokeOffset = -currentOffset;
    currentOffset += strokeDash;
    return {
      ...slice,
      strokeDasharray: `${strokeDash} ${donutCircumference - strokeDash}`,
      strokeDashoffset: strokeOffset,
    };
  });

  // En çok talep oluşturulan kategoriler — /api/reports/summary → category_performance
  const categoryBarColors = ['bg-blue-600', 'bg-cyan-500', 'bg-amber-500', 'bg-purple-600', 'bg-slate-400'];
  const sortedCategories = [...categoryStats]
    .filter((c) => (Number(c.total) || 0) > 0)
    .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
    .slice(0, 5);
  const maxCategoryTotal = sortedCategories.length > 0 ? Number(sortedCategories[0].total) || 0 : 0;
  const topCategories = sortedCategories.map((c, idx) => {
    const categoryTotal = Number(c.total) || 0;
    return {
      name: c.label,
      count: categoryTotal,
      pct: maxCategoryTotal > 0 ? Math.round((categoryTotal / maxCategoryTotal) * 100) : 0,
      color: categoryBarColors[idx % categoryBarColors.length],
    };
  });

  // Aylık trend grafiği — /api/reports/summary → monthly_trend (son 6 ay)
  const trendPoints = monthlyTrend.map((t) => ({ month: t.month, count: Number(t.count) || 0 }));
  const trendMaxCount = trendPoints.reduce((max, p) => Math.max(max, p.count), 0);
  const hasTrendData = trendPoints.length > 0 && trendMaxCount > 0;
  const axisStep = Math.max(1, Math.ceil(trendMaxCount / 4));
  const gridLabels = [4, 3, 2, 1, 0].map((k) => axisStep * k);

  const CHART_W = 500;
  const CHART_H = 160;
  const chartPoints = trendPoints.map((p, i) => {
    const x = 20 + (i * (470 - 20)) / Math.max(1, trendPoints.length - 1);
    const y = 138 - (p.count / (axisStep * 4)) * (138 - 10);
    return { ...p, x, y };
  });
  const chartLinePath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const chartAreaPath = chartPoints.length > 0 ? `${chartLinePath} L 470 ${CHART_H} L 20 ${CHART_H} Z` : '';
  let peakIdx = 0;
  chartPoints.forEach((p, i) => {
    if (p.count > chartPoints[peakIdx].count) peakIdx = i;
  });
  const peakPoint = chartPoints.length > 0 ? chartPoints[peakIdx] : { month: '', count: 0, x: 0, y: 0 };

  // Trend rozeti — son ayın bir önceki aya göre değişimi
  const lastMonthCount = trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].count : 0;
  const prevMonthCount = trendPoints.length > 1 ? trendPoints[trendPoints.length - 2].count : 0;
  const trendChange = prevMonthCount > 0 ? ((lastMonthCount - prevMonthCount) / prevMonthCount) * 100 : null;

  return (
    <div className="space-y-6">
      {/* 1. ÜST KARŞILAMA VE TARİH FİLTRESİ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hoş geldiniz, {userName}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Tüm idari süreçleri buradan yönetebilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{todayLabel || '—'}</span>
          </div>
        </div>
      </div>

      {/* 2. TALEP DURUM KARTLARI — yeni "Talep Durum Dağılımı" grafiğiyle aynı veriden beslenir */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {statusCards.map((card) => {
          const Icon = card.icon;
          const slice = statusSlices.find((s) => s.id === card.id);
          const count = slice?.count ?? 0;
          const pct = slice?.percentage ?? 0;
          return (
            <div
              key={card.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{card.title}</span>
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${card.tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-2">{statsLoading ? '—' : count}</p>
              <p className="text-xs font-medium text-slate-400 mt-1">
                {statsLoading ? 'Yükleniyor...' : totalRequests > 0 ? `Oran: %${pct}` : 'Henüz talep yok'}
              </p>
            </div>
          );
        })}
      </div>

      {/* 3. ORTA BÖLÜM: DONUT GRAFİK, TREND VE HIZLI İŞLEMLER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kolon 1: Talep Durum Dağılımı (Raporlar modülündeki grafikle aynı — gerçek veri) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-800">Talep Durum Dağılımı</h2>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {statsLoading ? '...' : `${totalRequests} Talep`}
              </span>
            </div>

            {/* SVG Donut Grafiği */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                  {/* Zemin Halkası */}
                  <circle cx="80" cy="80" r={donutRadius} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                  {/* Dilimler */}
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
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {statsLoading ? '—' : totalRequests}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                    Toplam Talep
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Donut Lejantı */}
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[42px] rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : statusSlices.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4 border-t border-slate-100">
              Henüz talep verisi yok
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
              {statusSlices.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50/70 p-2 rounded-xl border border-slate-100 flex items-center justify-between gap-1"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] font-medium text-slate-700 truncate">{item.label}</span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 text-right flex-shrink-0">
                    %{item.percentage}
                    <span className="text-[10px] text-slate-400 font-normal block">({item.count})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolon 2: Aylık Talep Trendi (5 Kolon) — /api/reports/summary → monthly_trend */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Aylık Talep Trendi</h2>
              <p className="text-xs text-slate-400 mt-0.5">Son 6 aylık talep yoğunluğu</p>
            </div>
            {trendChange !== null && (
              <div
                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
                  trendChange >= 0
                    ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                    : 'text-red-600 bg-red-50 border-red-100'
                }`}
              >
                {trendChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>
                  {trendChange >= 0 ? '+' : '-'}%{Math.abs(trendChange).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {hasTrendData ? (
            <div className="flex-1 flex flex-col justify-end w-full relative mt-3 min-h-[190px]">
              {/* Grid Çizgileri ve Y Ekseni */}
              <div className="relative flex-1 w-full flex flex-col justify-between pb-6">
                {gridLabels.map((val, idx) => (
                  <div key={idx} className="flex items-center w-full">
                    <span className="w-6 text-[10px] font-bold text-slate-400 flex-shrink-0 text-left">{val}</span>
                    <div className="flex-1 border-b border-slate-100 ml-1" />
                  </div>
                ))}

                {/* SVG Eğrisi (gerçek aylık verilerden hesaplanır) */}
                <div className="absolute inset-0 pl-7 pb-6 pointer-events-none">
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <path d={chartAreaPath} fill="url(#trendGradient)" />
                    <path
                      d={chartLinePath}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Zirve noktası */}
                    <circle cx={peakPoint.x} cy={peakPoint.y} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
                  </svg>

                  {/* Zirve noktası etiketi (yüksekse altına, değilse üstüne yerleşir) */}
                  <div
                    className="absolute bg-white border border-blue-200 rounded-xl px-2.5 py-1 text-center shadow-lg shadow-blue-500/10 pointer-events-auto"
                    style={{
                      left: `${(peakPoint.x / CHART_W) * 100}%`,
                      top: `${
                        (peakPoint.y / CHART_H) * 100 < 34
                          ? Math.min(80, (peakPoint.y / CHART_H) * 100 + 4)
                          : Math.max(1, (peakPoint.y / CHART_H) * 100 - 24)
                      }%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <span className="text-[10px] text-slate-400 block font-semibold leading-none">{peakPoint.month}</span>
                    <span className="text-xs font-black text-blue-600 leading-tight">{peakPoint.count} Talep</span>
                  </div>
                </div>
              </div>

              {/* X Ekseni Ayları */}
              <div className="flex justify-between pl-7 pr-3 pt-1 border-t border-slate-100 text-[11px] font-semibold text-slate-400">
                {chartPoints.map((p, idx) => (
                  <span
                    key={idx}
                    className={idx === peakIdx ? 'font-bold text-blue-600 bg-blue-50 px-1.5 rounded' : ''}
                  >
                    {p.month}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[190px] text-xs text-slate-400">
              {statsLoading ? 'Yükleniyor...' : 'Henüz talep verisi yok'}
            </div>
          )}
        </div>

        {/* Kolon 3: Hızlı İşlemler (3 Kolon) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Hızlı İşlemler</h2>

          <div className="space-y-2">
            {quickActions.map((qa, idx) => {
              const Icon = qa.icon;
              return (
                <Link
                  key={idx}
                  href={qa.href}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${qa.color} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                      {qa.title}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. ALT BÖLÜM: DUYURULAR VE KATEGORİ DAĞILIMI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sol: Duyurular (6 Kolon) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800">Duyurular</h2>
              </div>
            </div>

            <div className="space-y-4">
              {announcements.length > 0 ? (
                announcements.map((item) => {
                  const dateValue = item.published_at || item.created_at;
                  const dateStr = dateValue ? new Date(dateValue).toLocaleDateString('tr-TR') : '';
                  return (
                    <div key={item.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate">{item.title}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">{dateStr}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 pl-4 line-clamp-2">{item.content}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 py-2">
                  {announcementsLoading ? 'Yükleniyor...' : 'Henüz duyuru yok'}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <Link
              href="/dashboard/announcements"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors w-full sm:w-auto"
            >
              <span>Tüm Duyurular</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Sağ: En Çok Talep Oluşturulan Kategoriler (6 Kolon) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <h2 className="text-sm font-bold text-slate-800 mb-4">En Çok Talep Oluşturulan Kategoriler</h2>

          {topCategories.length > 0 ? (
            <div className="space-y-3.5 my-auto">
              {topCategories.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{cat.name}</span>
                    <span className="text-slate-900">{cat.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${cat.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              {statsLoading ? 'Yükleniyor...' : 'Henüz talep verisi yok'}
            </div>
          )}
        </div>
      </div>

      {/* 5. EN ALT: KATEGORİLER HIZLI NAVİGASYON ŞERİDİ */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-4">Kategoriler</h2>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
          {categories.map((c, idx) => {
            const Icon = c.icon;
            return (
              <Link
                key={idx}
                href={c.href}
                className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-50 transition-all border border-slate-100 hover:border-slate-200 text-center group"
              >
                <div className={`w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-white flex items-center justify-center ${c.color} shadow-xs mb-2 transition-all`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                  {c.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
