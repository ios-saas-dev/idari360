'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, ChevronDown, User, LogOut, Building2, Menu } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

interface TopHeaderProps {
  onMenuClick?: () => void;
}

export function TopHeader({ onMenuClick }: TopHeaderProps) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [userName, setUserName] = useState('Mehmet Yılmaz');
  const [userRole, setUserRole] = useState('İdari İşler Yöneticisi');
  const [rawRole, setRawRole] = useState<string>('facility_manager');
  const [facilityName, setFacilityName] = useState<string>('Maslak Genel Merkez');

  useEffect(() => {
    async function loadUser() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, facility_id, facilities(name)')
          .eq('id', user.id)
          .single();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
        if (profile?.role) {
          setRawRole(profile.role);
          const roleLabels: Record<string, string> = {
            super_admin: 'Sistem Süper Admini',
            company_admin: 'Şirket Yöneticisi',
            facility_manager: 'İdari İşler Yöneticisi',
            facility_officer: 'Tesis Sorumlusu',
            employee: 'Çalışan',
          };
          setUserRole(roleLabels[profile.role] || 'İdari İşler Yöneticisi');
        }

        const fac = (profile as any)?.facilities;
        if (fac?.name) {
          setFacilityName(fac.name);
        }
      }
    }
    loadUser();
  }, []);

  const handleSignOut = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const canSwitchFacility = rawRole === 'super_admin' || rawRole === 'company_admin';

  return (
    <header className="h-20 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      {/* Sol: Hamburger Butonu (Mobil) & Arama Çubuğu */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Menüyü aç"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Aramak istediğiniz alanı yazın..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-800 placeholder:text-slate-400 text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
      </div>

      {/* Sağ: Aktif Kilitli Tesis Rozeti, Bildirim Zili & Profil */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Aktif Tesis Rozeti (Kullanıcının kilitli tesisi) */}
        {facilityName && (
          <div className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
            <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="truncate max-w-[160px]">{facilityName}</span>
          </div>
        )}

        {/* Bildirim Zili */}
        <button
          className="relative p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Bildirimler"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            3
          </span>
        </button>

        {/* Kullanıcı Menüsü */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 p-1.5 pr-2 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-inner">
              <User className="w-5 h-5" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-bold text-slate-900 leading-tight">{userName}</p>
              <p className="text-xs text-slate-500 font-medium">{userRole}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {/* Profil Açılır Menü */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100 sm:hidden">
                <p className="text-sm font-bold text-slate-900">{userName}</p>
                <p className="text-xs text-slate-500">{userRole}</p>
                {facilityName && (
                  <p className="text-xs text-blue-600 font-medium mt-0.5">{facilityName}</p>
                )}
              </div>

              {/* Yalnızca Süper Admin ve Şirket Yöneticisi Tesis Değiştirebilir */}
              {canSwitchFacility && (
                <>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      router.push('/auth/select-facility');
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Tesis / Lokasyon Değiştir</span>
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                </>
              )}

              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Oturumu Kapat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
