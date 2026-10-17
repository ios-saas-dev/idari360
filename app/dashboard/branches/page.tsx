'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  Package,
  ClipboardList,
  Compass,
  X,
  Loader2,
  Building,
  AlertCircle,
  Filter,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

interface FacilityStats {
  open_requests: number;
  month_requests: number;
  avg_response_minutes: number | null;
  open_actions: number;
  overdue_actions: number;
  assets_total: number;
  assets_broken: number;
  staff_active: number;
  users_active: number;
  audit_avg_90d: number | null;
  audit_count_90d: number;
  satisfaction_avg: number | null;
  satisfaction_count: number;
}

interface Facility {
  id: string;
  name: string;
  code: string;
  city?: string;
  region?: string;
  address?: string;
  is_active: boolean;
  company_id?: string;
  created_at?: string;
  companies?: {
    name: string;
  };
  stats?: FacilityStats;
  health?: {
    score: number | null;
    color: 'green' | 'amber' | 'red' | 'gray';
    label: string;
    parts: Array<{ key: string; label: string; score: number | null; detail: string }>;
  };
}

const HEALTH_CHIP: Record<string, { dot: string; chip: string }> = {
  green: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amber: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  red: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  gray: { dot: 'bg-slate-300', chip: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const REGIONS = [
  'Tümü',
  'Marmara',
  'Ege',
  'İç Anadolu',
  'Akdeniz',
  'Karadeniz',
  'Güneydoğu Anadolu',
  'Doğu Anadolu',
];

const MODAL_REGIONS = [
  'Marmara',
  'Ege',
  'İç Anadolu',
  'Akdeniz',
  'Karadeniz',
  'Güneydoğu Anadolu',
  'Doğu Anadolu',
];

export default function BranchesPage() {
  const router = useRouter();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('Tümü');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    city: 'İstanbul',
    region: 'Marmara',
    address: '',
  });

  // Check user role & fetch data
  useEffect(() => {
    async function init() {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.role) {
            setUserRole(profile.role);
          }
        }
      } catch (e) {
        console.error('Kullanıcı rolü alınamadı:', e);
      }

      await loadFacilities();
    }

    init();
  }, []);

  async function loadFacilities() {
    try {
      setLoading(true);
      setError(null);
      // Gerçek 360° verileri (talepler, denetimler, aksiyonlar, varlıklar, personel, memnuniyet)
      const res = await fetch('/api/facilities/stats');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Şubeler yüklenirken bir hata oluştu.');
      }
      const data = await res.json();
      setFacilities(data.facilities || []);
    } catch (err: any) {
      setError(err.message || 'Veriler alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  // Handle New Branch Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Lütfen Tesis Adı ve Tesis Kodunu doldurunuz.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const res = await fetch('/api/admin/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          city: formData.city.trim() || 'İstanbul',
          region: formData.region,
          address: formData.address.trim() || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Şube kaydedilemedi.');
      }

      // Başarılı
      setIsModalOpen(false);
      setFormData({
        name: '',
        code: '',
        city: 'İstanbul',
        region: 'Marmara',
        address: '',
      });
      await loadFacilities();
    } catch (err: any) {
      setFormError(err.message || 'Bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filtered branches
  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      const matchesRegion =
        selectedRegion === 'Tümü' || (f.region && f.region.toLowerCase() === selectedRegion.toLowerCase());
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        f.name?.toLowerCase().includes(query) ||
        f.code?.toLowerCase().includes(query) ||
        f.city?.toLowerCase().includes(query) ||
        f.address?.toLowerCase().includes(query);

      return matchesRegion && matchesSearch;
    });
  }, [facilities, selectedRegion, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = facilities.length;
    const active = facilities.filter((f) => f.is_active).length;
    const marmara = facilities.filter(
      (f) => f.region && f.region.toLowerCase().includes('marmara')
    ).length;
    const others = total - marmara;

    return { total, active, marmara, others };
  }, [facilities]);

  const canAddBranch = userRole === 'super_admin' || userRole === 'company_admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Şube & Tesis Yönetimi
            </h1>
            <p className="text-sm text-slate-500">
              Şirketinizin tüm lokasyonlarını, kampüslerini ve tesis altyapısını merkezi olarak yönetin.
            </p>
          </div>
        </div>

        {canAddBranch && (
          <button
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Yeni Şube Ekle
          </button>
        )}
      </div>

      {/* Stats Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Şube */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Toplam Şube
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">Kayıtlı tüm tesisler</div>
          </div>
        </div>

        {/* Aktif Tesis */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Aktif Tesis
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
            <div className="text-xs text-slate-500 mt-1">Faaliyetteki lokasyonlar</div>
          </div>
        </div>

        {/* Marmara Bölgesi */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Marmara Bölgesi
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.marmara}</div>
            <div className="text-xs text-slate-500 mt-1">Ana merkez ve şubeler</div>
          </div>
        </div>

        {/* Diğer Bölgeler */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Diğer Bölgeler
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.others}</div>
            <div className="text-xs text-slate-500 mt-1">Anadolu ve taşra şubeleri</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
        {/* Region filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {REGIONS.slice(0, 6).map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                selectedRegion === region
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Şube adı, kodu, şehir veya adres ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">Şube ve tesis verileri yükleniyor...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Hata:</span> {error}
          </div>
          <button
            onClick={loadFacilities}
            className="ml-auto text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Yeniden Dene
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredFacilities.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Eşleşen Şube Bulunamadı</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
            {searchQuery || selectedRegion !== 'Tümü'
              ? 'Arama kriterlerinize uygun şube kaydı bulunamadı. Filtreleri temizleyebilirsiniz.'
              : 'Henüz sisteme tanımlanmış bir şube veya tesis bulunmuyor.'}
          </p>
          {(searchQuery || selectedRegion !== 'Tümü') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedRegion('Tümü');
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      )}

      {/* Branch Cards Grid */}
      {!loading && !error && filteredFacilities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredFacilities.map((branch) => (
            <div
              key={branch.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-base leading-snug truncate">
                        {branch.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200/60">
                          {branch.code}
                        </span>
                        {branch.companies?.name && (
                          <span className="text-[11px] text-slate-400 truncate">
                            • {branch.companies.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      branch.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        branch.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {branch.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>

                {/* City & Region Badge */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-slate-800">{branch.city || 'Belirtilmemiş'}</span>
                  {branch.region && (
                    <span className="text-slate-400">({branch.region} Bölgesi)</span>
                  )}
                </div>

                {/* Address text */}
                <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] leading-relaxed">
                  {branch.address || 'Detaylı adres açıklaması girilmemiş.'}
                </p>
              </div>

              {/* Quick Metrics: 360° Şube Özeti (gerçek veri) */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    360° Şube Özeti
                  </span>
                  {branch.health && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        (HEALTH_CHIP[branch.health.color] || HEALTH_CHIP.gray).chip
                      }`}
                      title={branch.health.parts?.map((p) => `${p.label}: ${p.detail}`).join(' · ')}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          (HEALTH_CHIP[branch.health.color] || HEALTH_CHIP.gray).dot
                        }`}
                      />
                      {branch.health.label}
                      {branch.health.score != null && ` · ${branch.health.score}`}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                      <ClipboardList className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] text-slate-500 font-medium">Açık Talep</span>
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {branch.stats?.open_requests ?? '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Bu ay {branch.stats?.month_requests ?? 0}
                    </div>
                  </div>
                  <div className="text-center border-x border-slate-200/60">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                      <Package className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] text-slate-500 font-medium">Varlıklar</span>
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {branch.stats?.assets_total ?? '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {(branch.stats?.assets_broken ?? 0) > 0
                        ? `${branch.stats?.assets_broken} arızalı`
                        : 'Arıza yok'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
                      <Users className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] text-slate-500 font-medium">Personel</span>
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {branch.stats
                        ? (branch.stats.staff_active || 0) + (branch.stats.users_active || 0)
                        : '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {(branch.stats?.overdue_actions ?? 0) > 0
                        ? `${branch.stats?.overdue_actions} gecikmiş aksiyon`
                        : 'Gecikme yok'}
                    </div>
                  </div>
                </div>

                {/* Denetim & Memnuniyet mini satır */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 px-1">
                  <span>
                    Denetim (90g):{' '}
                    <span className="font-bold text-slate-700">
                      {branch.stats?.audit_avg_90d != null
                        ? `${branch.stats.audit_avg_90d}/100`
                        : '—'}
                    </span>
                  </span>
                  <span>
                    Memnuniyet:{' '}
                    <span className="font-bold text-slate-700">
                      {branch.stats?.satisfaction_avg != null
                        ? `${branch.stats.satisfaction_avg.toFixed(1)}/5`
                        : '—'}
                    </span>
                  </span>
                </div>

                {/* Detay butonu */}
                <button
                  onClick={() => router.push(`/dashboard/branches/${branch.id}`)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition"
                >
                  Şube Detayı (360°)
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Yeni Şube Ekle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Yeni Şube / Tesis Ekle</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 text-xs font-medium p-3 rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Tesis Adı */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tesis / Şube Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Maslak Genel Müdürlük, Kartal Lojistik Kampüsü"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              {/* Tesis Kodu */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tesis Kodu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: IST-01, ANK-02"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Kurum içi kodlandırma için benzersiz bir kısaltma belirleyin.
                </span>
              </div>

              {/* Şehir ve Bölge Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Şehir</label>
                  <input
                    type="text"
                    placeholder="Örn: İstanbul, Ankara, İzmir"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bölge</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  >
                    {MODAL_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Adres */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adres</label>
                <textarea
                  rows={3}
                  placeholder="Mahalle, Cadde, No, İlçe / İl posta detayları..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm shadow-blue-600/20 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Kaydediliyor...' : 'Şubeyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
