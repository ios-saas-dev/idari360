'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ClipboardList,
  UtensilsCrossed,
  Bus,
  Package,
  Sparkles,
  Building2,
  BarChart3,
  Megaphone,
  Settings,
  Warehouse,
  Truck,
  Box,
  ShieldCheck,
  CheckSquare,
  FileCheck2,
  Award,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile?.role) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.error('Sidebar rol yükleme hatası:', err);
      }
    }

    fetchUserRole();
  }, []);

  // Standart menü öğeleri
  const navItems = [
    { name: 'Ana Sayfa', href: '/dashboard', icon: Home, badge: null },
    { name: 'Talepler', href: '/dashboard/requests', icon: ClipboardList, badge: null },
    { name: 'Aksiyonlar', href: '/dashboard/actions', icon: CheckSquare, badge: null },
    { name: 'Denetimler', href: '/dashboard/audits', icon: FileCheck2, badge: null },
    { name: 'Tedarikçiler', href: '/dashboard/suppliers', icon: Award, badge: null },
    { name: 'Yemekhane', href: '/dashboard/cafeteria', icon: UtensilsCrossed, badge: null },
    { name: 'Servis', href: '/dashboard/shuttle', icon: Bus, badge: null },
    { name: 'Varlık Yönetimi', href: '/dashboard/assets', icon: Package, badge: null },
    { name: 'Temizlik', href: '/dashboard/cleaning', icon: Sparkles, badge: null },
    { name: 'Şubeler', href: '/dashboard/branches', icon: Building2, badge: null },
    { name: 'Raporlar', href: '/dashboard/reports', icon: BarChart3, badge: null },
    { name: 'Duyurular', href: '/dashboard/announcements', icon: Megaphone, badge: null },
    { name: 'Ayarlar', href: '/dashboard/settings', icon: Settings, badge: null },
  ];

  // Yönetici Paneli Görünürlük Kuralı: Sadece yetkisi olan rollerde görünsün
  const isAdminAuthorized =
    userRole === 'super_admin' || userRole === 'company_admin' || userRole === 'facility_manager';

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f1c2e] text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:self-start ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Üst Logo ve Başlık */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/5 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
          <div className="w-4 h-4 border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        </div>
        <div className="flex items-center tracking-tight">
          <span className="text-xl font-extrabold text-white">idari</span>
          <span className="text-xl font-extrabold text-cyan-400">360</span>
        </div>
      </div>

      {/* Navigasyon Listesi - Aşağıya doğru tamamen açık ve görünür */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    isActive ? 'bg-white text-blue-600' : 'bg-blue-600/80 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* SOL MENÜDE YÖNETİCİ PANELİ (SADECE YETKİLİ ROLLERDE GÖRÜNÜR) */}
        {isAdminAuthorized && (
          <div className="pt-2 mt-2 border-t border-white/10">
            <Link
              href="/dashboard/admin"
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname.startsWith('/dashboard/admin')
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                  : 'text-amber-300 hover:text-white hover:bg-white/10 border border-amber-400/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    pathname.startsWith('/dashboard/admin') ? 'text-white' : 'text-amber-400'
                  }`}
                />
                <span>Yönetici Paneli</span>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md tracking-wider ${
                  pathname.startsWith('/dashboard/admin')
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-400/20 text-amber-300'
                }`}
              >
                {userRole === 'super_admin' ? 'Süper' : 'Yönetim'}
              </span>
            </Link>
          </div>
        )}
      </nav>

      {/* Alt Bölüm: Kompakt Durum Rozeti */}
      <div className="p-3 border-t border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 text-[11px] text-slate-300">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistem Çevrimiçi</span>
          </span>
          <span className="text-slate-400 font-mono text-[10px]">v1.0</span>
        </div>
      </div>
    </aside>
  );
}
