'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ClipboardList,
  UtensilsCrossed,
  Bus,
  Car,
  Package,
  Sparkles,
  Building2,
  BarChart3,
  Megaphone,
  Settings,
  Warehouse,
  Truck,
  Box,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Ana Sayfa', href: '/dashboard', icon: Home, badge: null },
    { name: 'Talepler', href: '/dashboard/requests', icon: ClipboardList, badge: '12' },
    { name: 'Yemekhane', href: '/dashboard/cafeteria', icon: UtensilsCrossed, badge: null },
    { name: 'Servis', href: '/dashboard/shuttle', icon: Bus, badge: null },
    { name: 'Filo Yönetimi', href: '/dashboard/fleet', icon: Car, badge: null },
    { name: 'Varlık Yönetimi', href: '/dashboard/assets', icon: Package, badge: null },
    { name: 'Temizlik', href: '/dashboard/cleaning', icon: Sparkles, badge: null },
    { name: 'Şubeler', href: '/dashboard/branches', icon: Building2, badge: null },
    { name: 'Raporlar', href: '/dashboard/reports', icon: BarChart3, badge: null },
    { name: 'Duyurular', href: '/dashboard/announcements', icon: Megaphone, badge: null },
    { name: 'Ayarlar', href: '/dashboard/settings', icon: Settings, badge: null },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f1c2e] text-white flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Üst Logo ve Başlık */}
      <div>
        <div className="h-20 px-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            {/* Hexagon stilinde İdari360 amblemi */}
            <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </div>
          <div className="flex items-center tracking-tight">
            <span className="text-2xl font-extrabold text-white">idari</span>
            <span className="text-2xl font-extrabold text-cyan-400">360</span>
          </div>
        </div>

        {/* Navigasyon Listesi */}
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
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
                      isActive
                        ? 'bg-white text-blue-600'
                        : 'bg-blue-600/80 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Alt Görsel: Lojistik / Tesis İllüstrasyonu */}
      <div className="p-4 border-t border-white/5">
        <div className="relative rounded-2xl bg-gradient-to-b from-blue-950/60 to-slate-900/80 border border-white/10 p-4 text-center overflow-hidden">
          <div className="flex justify-center items-end gap-2 mb-2 text-cyan-400">
            <Warehouse className="w-8 h-8 text-blue-400" />
            <Box className="w-4 h-4 text-amber-400 -mb-1" />
            <Truck className="w-6 h-6 text-white -mb-0.5" />
          </div>
          <p className="text-xs font-semibold text-slate-200 leading-tight">
            İdari İşler Yönetim
          </p>
          <p className="text-[11px] text-cyan-400/90 font-medium">
            Süreç Platformu
          </p>
        </div>
      </div>
    </aside>
  );
}
