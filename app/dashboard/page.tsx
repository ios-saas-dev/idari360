'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
  ClipboardList,
  Hourglass,
  CheckCircle2,
  Users,
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

export default function DashboardPage() {
  const [userName, setUserName] = useState('Yönetici');
  const [userRole, setUserRole] = useState<string>('');

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
    { title: 'Servis Denetim Formu', href: '/dashboard/shuttle/audit', icon: Bus, color: 'bg-blue-100 text-blue-600' },
    { title: 'Yemekhane Denetim Formu', href: '/dashboard/cafeteria/audit', icon: UtensilsCrossed, color: 'bg-green-100 text-green-600' },
    { title: 'Temizlik Denetim Formu', href: '/dashboard/cleaning/audit', icon: Sparkles, color: 'bg-purple-100 text-purple-600' },
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

  // Donut grafik verileri
  const donutData = [
    { label: 'Yeni', count: 12, pct: '37.5', color: '#2563eb' },
    { label: 'Devam Ediyor', count: 8, pct: '25.0', color: '#06b6d4' },
    { label: 'Beklemede', count: 6, pct: '18.8', color: '#f59e0b' },
    { label: 'Onayda', count: 3, pct: '9.4', color: '#8b5cf6' },
    { label: 'Tamamlandı', count: 3, pct: '9.4', color: '#10b981' },
  ];

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

      {/* 2. DÖRT ANA İSTATİSTİK KARTI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Kart 1: Açık Talepler */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Açık Talepler</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">12</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Toplam 32 talep</p>
        </div>

        {/* Kart 2: Devam Eden İşler */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Devam Eden İşler</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
              <Hourglass className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">8</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Toplam 24 iş</p>
        </div>

        {/* Kart 3: Tamamlanan İşler */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tamamlanan İşler</span>
            <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">216</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Bu ay</p>
        </div>

        {/* Kart 4: Bekleyen Onaylar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Bekleyen Onaylar</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">5</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Onay bekleyen</p>
        </div>
      </div>

      {/* 3. ORTA BÖLÜM: DONUT GRAFİK, TREND VE HIZLI İŞLEMLER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kolon 1: Taleplerin Durumuna Göre Dağılımı (4 Kolon) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">Taleplerin Durumuna Göre Dağılımı</h2>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
            {/* SVG Donut Grafiği */}
            <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#2563eb" strokeWidth="16" strokeDasharray="89.5 238.7" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#06b6d4" strokeWidth="16" strokeDasharray="59.7 238.7" strokeDashoffset="-89.5" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f59e0b" strokeWidth="16" strokeDasharray="44.8 238.7" strokeDashoffset="-149.2" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#8b5cf6" strokeWidth="16" strokeDasharray="22.4 238.7" strokeDashoffset="-194" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#10b981" strokeWidth="16" strokeDasharray="22.4 238.7" strokeDashoffset="-216.4" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-medium text-slate-400">Toplam</span>
                <span className="text-2xl font-black text-slate-900 leading-none">32</span>
              </div>
            </div>

            {/* Lejant Listesi */}
            <div className="space-y-2 w-full text-xs">
              {donutData.map((d, idx) => (
                <div key={idx} className="flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="font-medium text-slate-700">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{d.count}</span>
                    <span className="text-slate-400 w-9 text-right">%{d.pct}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kolon 2: Aylık Talep Trendi (4 Kolon) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Aylık Talep Trendi</h2>
          </div>

          <div className="relative mt-4 h-48 w-full">
            {/* SVG Çizgi Grafiği */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
              {/* Yatay Kılavuz Çizgileri */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="60" x2="480" y2="60" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="100" x2="480" y2="100" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="140" x2="480" y2="140" stroke="#f1f5f9" strokeWidth="1" />

              {/* Gradyan Alan */}
              <defs>
                <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <path
                d="M 50 140 Q 120 120, 150 90 T 230 85 T 320 100 T 400 45 T 470 50 L 470 160 L 50 160 Z"
                fill="url(#trendGradient)"
              />
              <path
                d="M 50 140 Q 120 120, 150 90 T 230 85 T 320 100 T 400 45 T 470 50"
                fill="none"
                stroke="#2563eb"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Mayıs Vurgu Noktası */}
              <circle cx="400" cy="45" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
            </svg>

            {/* Mayıs 56 Talep Etiketi */}
            <div className="absolute top-2 right-16 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-center shadow-md">
              <span className="text-[10px] text-slate-400 block font-medium">Mayıs</span>
              <span className="text-xs font-extrabold text-blue-600">56 Talep</span>
            </div>

            {/* Y Ekseni Etiketleri */}
            <div className="absolute left-0 inset-y-0 flex flex-col justify-between text-[11px] font-semibold text-slate-400 py-1">
              <span>80</span>
              <span>60</span>
              <span>40</span>
              <span>20</span>
              <span>0</span>
            </div>

            {/* X Ekseni Ayları */}
            <div className="absolute bottom-0 inset-x-0 pl-10 pr-2 flex justify-between text-[11px] font-medium text-slate-400">
              <span>Oca</span>
              <span>Şub</span>
              <span>Mar</span>
              <span>Nis</span>
              <span className="font-bold text-blue-600">May</span>
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

      {/* 4. ALT BÖLÜM: DUYURULAR, KATEGORİ DAĞILIMI VE MEMNUNİYET SKORU */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sol: Duyurular (4 Kolon) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
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

        {/* Orta: En Çok Talep Oluşturulan Kategoriler (4 Kolon) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
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

        {/* Sağ: Memnuniyet Skoru (3 Kolon) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm text-center flex flex-col justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800 self-start">Memnuniyet Skoru</h2>

          <div className="relative w-36 h-36 flex items-center justify-center my-2">
            {/* SVG Daire Göstergesi */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="8" />
              {/* 4.6 / 5 = %92 doluluk (251.2 * 0.92 = 231) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#10b981"
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset="25"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-slate-900 leading-none">4.6</span>
              <span className="text-xs font-semibold text-slate-400 mt-0.5">/5</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700">Yemekhane Memnuniyet Skoru</p>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              <span>%8.2 artış (Geçen aya göre)</span>
            </div>
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
