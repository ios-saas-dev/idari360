'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  MapPin, 
  Search, 
  Check, 
  LogOut, 
  Loader2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Facility {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  company_id?: string;
  is_active?: boolean;
  companies?: {
    name: string;
  } | null;
}

interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
  company_id?: string;
  facility_id?: string | null;
}

export default function SelectFacilityPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/auth/login');
          return;
        }

        // 2. Fetch user profile
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError || !userProfile) {
          setError('Kullanıcı profili yüklenirken bir hata oluştu.');
          setLoading(false);
          return;
        }

        setProfile({
          ...userProfile,
          email: user.email,
        });

        const isSuperAdmin = userProfile.role === 'super_admin';

        // 3. Fetch facilities
        let facilitiesQuery;
        if (isSuperAdmin) {
          facilitiesQuery = supabase
            .from('facilities')
            .select('*, companies(name)')
            .eq('is_active', true)
            .order('name');
        } else if (userProfile.company_id) {
          facilitiesQuery = supabase
            .from('facilities')
            .select('*')
            .eq('company_id', userProfile.company_id)
            .eq('is_active', true)
            .order('name');
        } else {
          // User has no company assigned
          setFacilities([]);
          setLoading(false);
          return;
        }

        const { data: facilitiesData, error: facilitiesError } = await facilitiesQuery;

        if (facilitiesError) {
          setError('Lokasyon listesi yüklenemedi. Lütfen sayfayı yenileyin.');
        } else {
          const list: Facility[] = facilitiesData || [];
          setFacilities(list);

          // Auto-selection logic:
          // 1. If only 1 facility exists, auto-select it
          // 2. Or if profile already had a valid facility_id among active ones, preselect it
          if (list.length === 1) {
            setSelectedFacilityId(list[0].id);
          } else if (userProfile.facility_id && list.some((f) => f.id === userProfile.facility_id)) {
            setSelectedFacilityId(userProfile.facility_id);
          }
        }
      } catch (err: unknown) {
        console.error('Veri yükleme hatası:', err);
        setError('Beklenmeyen bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // Filter facilities based on search input
  const filteredFacilities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return facilities;

    return facilities.filter((facility) => {
      const nameMatch = facility.name?.toLowerCase().includes(query);
      const cityMatch = facility.city?.toLowerCase().includes(query);
      const regionMatch = facility.region?.toLowerCase().includes(query);
      const addressMatch = facility.address?.toLowerCase().includes(query);
      const companyMatch = facility.companies?.name?.toLowerCase().includes(query);

      return nameMatch || cityMatch || regionMatch || addressMatch || companyMatch;
    });
  }, [facilities, searchQuery]);

  // Sign out handler
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch (err) {
      console.error('Çıkış hatası:', err);
      setLoggingOut(false);
    }
  };

  // Facility confirmation handler
  const handleConfirmFacility = async () => {
    if (!selectedFacilityId || !profile) return;

    try {
      setSubmitting(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ facility_id: selectedFacilityId })
        .eq('id', profile.id);

      if (updateError) {
        setError('Lokasyon seçimi kaydedilemedi. Lütfen tekrar deneyin.');
        setSubmitting(false);
        return;
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      console.error('Kayıt hatası:', err);
      setError('İşlem sırasında bir hata oluştu.');
      setSubmitting(false);
    }
  };

  // Helper for user initials
  const getUserInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'İD';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-blue-600">İdari</span>
              <span className="text-slate-800">360</span>
            </span>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs sm:text-sm select-none"
                aria-label="Kullanıcı Profil İkonu"
              >
                {getUserInitials(profile?.full_name, profile?.email)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-800 leading-none">
                  {profile?.full_name || profile?.email || 'Kullanıcı'}
                </p>
                {profile?.role && (
                  <p className="text-xs text-slate-400 capitalize mt-0.5">
                    {profile.role.replace('_', ' ')}
                  </p>
                )}
              </div>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Oturumu Kapat"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Çıkış Yap</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 flex flex-col">
        {/* Page Heading */}
        <div className="text-center sm:text-left mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Lokasyon Seçin
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm sm:text-base">
            Çalışmak istediğiniz tesis veya lokasyonu seçin
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="text-sm font-medium text-slate-600">Lokasyonlar yükleniyor...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Search Input */}
            {facilities.length > 0 && (
              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Lokasyon ara..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            )}

            {/* Empty state: No facilities assigned to company */}
            {facilities.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center my-auto shadow-sm">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">
                  Henüz atanmış lokasyonunuz bulunmuyor
                </h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                  Sisteme erişebilmek için lütfen yöneticinizle iletişime geçin.
                </p>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Farklı bir hesapla giriş yap
                </button>
              </div>
            ) : filteredFacilities.length === 0 ? (
              /* Empty state: Search filter returned no results */
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center my-8 shadow-sm">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-700 mb-1">
                  Aramanızla eşleşen lokasyon bulunamadı
                </h3>
                <p className="text-sm text-slate-500">
                  Farklı anahtar kelimeler ile tekrar arama yapabilirsiniz.
                </p>
              </div>
            ) : (
              /* Facility Cards Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFacilities.map((facility) => {
                  const isSelected = selectedFacilityId === facility.id;

                  return (
                    <div
                      key={facility.id}
                      onClick={() => setSelectedFacilityId(facility.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedFacilityId(facility.id);
                        }
                      }}
                      className={`relative bg-white rounded-xl p-5 cursor-pointer border transition-all text-left flex flex-col justify-between select-none ${
                        isSelected
                          ? 'border-2 border-blue-500 bg-blue-50/60 ring-2 ring-blue-100 shadow-sm'
                          : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                      }`}
                    >
                      {/* Top Row: Icon and Selection Check */}
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <h2 className="font-semibold text-slate-800 text-base leading-snug line-clamp-1 mb-1.5">
                          {facility.name}
                        </h2>

                        {facility.companies?.name && (
                          <span className="inline-block text-[11px] font-medium text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded mb-2">
                            {facility.companies.name}
                          </span>
                        )}

                        {(facility.city || facility.region) && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">
                              {[facility.city, facility.region].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}

                        {facility.address && (
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                            {facility.address}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Action Button */}
            {facilities.length > 0 && (
              <div className="mt-8 pt-4">
                <button
                  onClick={handleConfirmFacility}
                  disabled={!selectedFacilityId || submitting}
                  className="w-full max-w-md mx-auto py-3 px-6 rounded-lg font-semibold shadow-sm transition-all text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <span>Devam Et</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
