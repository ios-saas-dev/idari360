'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
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

export default function DashboardPage() {
  const [userName, setUserName] = useState('Yönetici');
  const [userRole, setUserRole] = useState<string>('');
  const [requestStats, setRequestStats] = useState<{
    totalRequests: number;
    slices: RequestStatusSlice[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

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
      } catch (err) {
        console.error('Talep durum dağılımı yüklenemedi:', err);
      } finally {
        setStatsLoading(false);
      }
    }
    loadRequestStats();
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

  // En çok talep oluşturulan kategoriler
  const topCategories = [
    { name: 'Yemekhane', count: 12, pct: 100, color: 'bg-blue-600' },
    { name: 'Servis', count: 8, pct: 66, color: 'bg-cyan-500' },
    { name: 'Filo', count: 6, pct: 50, color: 'bg-amber-500' },
    { name: 'Temizlik', count: 4, pct: 33, color: 'bg-purple-600' },
    { name: 'Diğer', count: 2, pct: 16, color: 'bg-slate-400' },
  ];

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
          <button className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>30 Mayıs 2026, Cuma</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
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

        {/* Kolon 2: Aylık Talep Trendi (5 Kolon) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Aylık Talep Trendi</h2>
              <p className="text-xs text-slate-400 mt-0.5">Son 6 aylık talep yoğunluğu</p>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+%18.4</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-end w-full relative mt-3 min-h-[190px]">
            {/* Grid Çizgileri ve Y Ekseni */}
            <div className="relative flex-1 w-full flex flex-col justify-between pb-6">
              {[80, 60, 40, 20, 0].map((val, idx) => (
                <div key={idx} className="flex items-center w-full">
                  <span className="w-6 text-[10px] font-bold text-slate-400 flex-shrink-0 text-left">{val}</span>
                  <div className="flex-1 border-b border-slate-100 ml-1" />
                </div>
              ))}

              {/* SVG Eğrisi (Kılavuz çizgileriyle tam uyumlu) */}
              <div className="absolute inset-0 pl-7 pb-6 pointer-events-none">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  <path
                    d="M 20 140 C 70 125, 110 85, 150 75 C 190 65, 230 95, 270 90 C 310 85, 350 45, 395 30 C 420 22, 450 35, 470 45 L 470 160 L 20 160 Z"
                    fill="url(#trendGradient)"
                  />
                  <path
                    d="M 20 140 C 70 125, 110 85, 150 75 C 190 65, 230 95, 270 90 C 310 85, 350 45, 395 30 C 420 22, 450 35, 470 45"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Mayıs Zirve Noktası */}
                  <circle cx="395" cy="30" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
                </svg>

                {/* Mayıs 56 Talep Etiketi (Zirve noktasının hemen üstünde) */}
                <div className="absolute top-0 right-[14%] -translate-x-1/2 bg-white border border-blue-200 rounded-xl px-2.5 py-1 text-center shadow-lg shadow-blue-500/10 pointer-events-auto">
                  <span className="text-[10px] text-slate-400 block font-semibold leading-none">Mayıs</span>
                  <span className="text-xs font-black text-blue-600 leading-tight">56 Talep</span>
                </div>
              </div>
            </div>

            {/* X Ekseni Ayları */}
            <div className="flex justify-between pl-7 pr-3 pt-1 border-t border-slate-100 text-[11px] font-semibold text-slate-400">
              <span>Oca</span>
              <span>Şub</span>
              <span>Mar</span>
              <span>Nis</span>
              <span className="font-bold text-blue-600 bg-blue-50 px-1.5 rounded">May</span>
              <span>Haz</span>
            </div>
          </div>
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
              {/* Duyuru 1 */}
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="text-xs font-bold text-slate-800">Bayram Tatili Duyurusu</span>
                  </div>
                  <span className="text-[11px] text-slate-400">30.05.2026</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 pl-4">
                  Kurban Bayramı tatili 6-9 Haziran tarihleri arasındadır.
                </p>
              </div>

              {/* Duyuru 2 */}
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="text-xs font-bold text-slate-800">Yemekhane Çalışma Saatleri</span>
                  </div>
                  <span className="text-[11px] text-slate-400">28.05.2026</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 pl-4">
                  1 Haziran itibarıyla yemekhane saatlerinde değişiklik olacaktır.
                </p>
              </div>

              {/* Duyuru 3 */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="text-xs font-bold text-slate-800">Servis Güzergah Güncellemesi</span>
                  </div>
                  <span className="text-[11px] text-slate-400">27.05.2026</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 pl-4">
                  Bazı servis güzergahlarında güncelleme yapılmıştır.
                </p>
              </div>
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
