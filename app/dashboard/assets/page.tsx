'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Package,
  Search,
  Plus,
  User,
  MapPin,
  Calendar,
  Edit2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle2,
  Layers,
  Wrench,
  Tag,
  DollarSign,
  FileText,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

interface AssignedUser {
  id: string;
  full_name: string;
  email: string;
}

interface Facility {
  id: string;
  name: string;
  city?: string;
}

interface Asset {
  id: string;
  asset_code: string;
  name: string;
  category: string;
  location: string;
  status: string;
  purchase_date: string | null;
  purchase_price: number | null;
  notes: string | null;
  created_at: string;
  assigned_to?: string | null;
  assigned_user?: AssignedUser | null;
  facility?: Facility | null;
}

interface ProfileOption {
  id: string;
  full_name: string;
  email: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  aktif: {
    label: 'Aktif',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
  devirde: {
    label: 'Devirde / Zimmetli',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
  },
  iade: {
    label: 'İade Edildi',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  ariza: {
    label: 'Arızalı',
    badgeClass: 'bg-red-50 text-red-700 border-red-200/80',
  },
  bakimda: {
    label: 'Bakımda',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
  kayip: {
    label: 'Kayıp',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
  },
  hurda: {
    label: 'Hurda',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-300',
  },
};

const STATUS_TABS = [
  { id: '', label: 'Tümü' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'devirde', label: 'Devirde' },
  { id: 'ariza', label: 'Arızalı' },
  { id: 'bakimda', label: 'Bakımda' },
  { id: 'hurda', label: 'Hurda' },
];

const CATEGORIES = [
  'Elektronik',
  'Mobilya',
  'Araç',
  'Makine',
  'Ofis Ekipmanı',
  'Diğer',
];

export default function AssetsPage() {
  const supabase = createBrowserClient();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    aktif: 0,
    zimmetli: 0,
    arizali: 0,
  });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    category: 'Elektronik',
    location: '',
    assigned_to: '',
    purchase_date: '',
    purchase_price: '',
    notes: '',
    status: 'aktif',
  });

  // Debounce search query 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load profiles for assignment select
  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });
      if (data) {
        setProfiles(data);
      }
    }
    loadProfiles();
  }, [supabase]);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const { data: allAssets } = await supabase
        .from('assets')
        .select('status, assigned_to');

      if (allAssets) {
        const total = allAssets.length;
        const aktif = allAssets.filter((a) => a.status === 'aktif').length;
        const zimmetli = allAssets.filter(
          (a) => a.status === 'devirde' || Boolean(a.assigned_to)
        ).length;
        const arizali = allAssets.filter((a) => a.status === 'ariza').length;
        setStats({ total, aktif, zimmetli, arizali });
      }
    } catch {
      // Fallback silently if stats query fails
    }
  };

  // Fetch Assets
  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedCategory) params.append('category', selectedCategory);
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      params.append('page', currentPage.toString());

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Varlıklar yüklenirken bir sorun oluştu');
      }

      const json = await res.json();
      setAssets(json.data || []);
      setTotalCount(json.count || 0);
      setTotalPages(json.totalPages || 1);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Bilinmeyen bir hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchStats();
  }, [selectedStatus, selectedCategory, debouncedSearch, currentPage]);

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      category: 'Elektronik',
      location: '',
      assigned_to: '',
      purchase_date: '',
      purchase_price: '',
      notes: '',
      status: 'aktif',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      name: asset.name,
      category: asset.category,
      location: asset.location || '',
      assigned_to: asset.assigned_to || '',
      purchase_date: asset.purchase_date || '',
      purchase_price: asset.purchase_price ? String(asset.purchase_price) : '',
      notes: asset.notes || '',
      status: asset.status,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Lütfen varlık adını giriniz');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        location: formData.location.trim(),
        assigned_to: formData.assigned_to || null,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        notes: formData.notes.trim(),
      };

      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Varlık eklenirken hata oluştu');
      }

      setIsAddModalOpen(false);
      fetchAssets();
      fetchStats();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('İşlem başarısız');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        location: formData.location.trim(),
        assigned_to: formData.assigned_to || null,
        status: formData.status,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        notes: formData.notes.trim(),
      };

      const res = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Varlık güncellenirken hata oluştu');
      }

      setIsEditModalOpen(false);
      fetchAssets();
      fetchStats();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Güncelleme işlemi başarısız');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Varlık & Demirbaş Yönetimi
            </h1>
            <p className="text-sm text-slate-500">
              Şirket demirbaşlarının zimmet, arıza ve lokasyon takibi
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Varlık Ekle
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Toplam Varlık</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
            <span className="text-xs text-slate-400">adet kayıtlı</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Aktif</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{stats.aktif}</span>
            <span className="text-xs text-slate-400">kullanıma hazır</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Zimmetli</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <User className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">{stats.zimmetli}</span>
            <span className="text-xs text-slate-400">personele atanmış</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Arızalı</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600">{stats.arizali}</span>
            <span className="text-xs text-slate-400">müdahale bekleyen</span>
          </div>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-slate-100 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedStatus(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Search Input */}
          <div className="sm:col-span-8 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Varlık adı veya demirbaş kodu ile ara..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <div className="sm:col-span-4">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700"
            >
              <option value="">Tüm Kategoriler</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Assets Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm">Varlıklar yükleniyor...</span>
          </div>
        ) : assets.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-700">Kayıtlı Varlık Bulunamadı</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Arama kriterlerinize uygun demirbaş bulunamadı veya henüz bir varlık eklenmedi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Kod</th>
                  <th className="py-3.5 px-4 font-semibold">Varlık Adı</th>
                  <th className="py-3.5 px-4 font-semibold">Kategori</th>
                  <th className="py-3.5 px-4 font-semibold">Konum</th>
                  <th className="py-3.5 px-4 font-semibold">Zimmetli Kişi</th>
                  <th className="py-3.5 px-4 font-semibold">Durum</th>
                  <th className="py-3.5 px-4 font-semibold">Tarih</th>
                  <th className="py-3.5 px-4 font-semibold text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((asset) => {
                  const statusInfo = STATUS_CONFIG[asset.status] || {
                    label: asset.status,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Kod */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-semibold px-2 py-1 bg-slate-100 border border-slate-200/80 text-slate-800 rounded-md">
                          {asset.asset_code}
                        </span>
                      </td>

                      {/* Varlık Adı */}
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {asset.name}
                      </td>

                      {/* Kategori */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {asset.category}
                        </span>
                      </td>

                      {/* Konum */}
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{asset.location || '-'}</span>
                        </div>
                      </td>

                      {/* Zimmetli Kişi */}
                      <td className="py-3.5 px-4">
                        {asset.assigned_user ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                              {asset.assigned_user.full_name?.charAt(0) || 'U'}
                            </div>
                            <span className="text-xs font-medium text-slate-800">
                              {asset.assigned_user.full_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      {/* Durum */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusInfo.badgeClass}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Tarih */}
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {asset.purchase_date
                              ? new Date(asset.purchase_date).toLocaleDateString('tr-TR')
                              : new Date(asset.created_at).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      </td>

                      {/* İşlemler */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditModal(asset)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-5 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Toplam <span className="font-semibold text-slate-700">{totalCount}</span> varlıktan{' '}
            <span className="font-semibold text-slate-700">
              {assets.length > 0 ? (currentPage - 1) * 20 + 1 : 0}
            </span>
            -
            <span className="font-semibold text-slate-700">
              {Math.min(currentPage * 20, totalCount)}
            </span>{' '}
            arası gösteriliyor
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || loading}
              className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:hover:text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-600 px-2">
              Sayfa {currentPage} / {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages || loading}
              className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:hover:text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Asset Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Yeni Varlık Ekle</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Varlık Adı */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Varlık Adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="örn: Dell Latitude 5420 Laptop"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Konum */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Konum
                </label>
                <input
                  type="text"
                  placeholder="örn: Merkez Ofis - Kat 2, Yazılım Odası"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              {/* Zimmetlenecek Kişi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zimmetlenecek Kişi (İsteğe Bağlı)
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="">Atama Yapılmadı (Boşta)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Satın Alma Tarihi & Fiyatı */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satın Alma Tarihi
                  </label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) =>
                      setFormData({ ...formData, purchase_date: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satın Alma Fiyatı (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.purchase_price}
                    onChange={(e) =>
                      setFormData({ ...formData, purchase_price: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notlar
                </label>
                <textarea
                  rows={3}
                  placeholder="Seri no, garanti durumu veya özel notlar..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {isEditModalOpen && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Varlık Düzenle</h2>
                  <p className="text-xs font-mono text-slate-400">{selectedAsset.asset_code}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAsset} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Varlık Adı */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Varlık Adı
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              {/* Durum & Kategori */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Durum
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="devirde">Devirde</option>
                    <option value="iade">İade</option>
                    <option value="ariza">Arızalı</option>
                    <option value="bakimda">Bakımda</option>
                    <option value="kayip">Kayıp</option>
                    <option value="hurda">Hurda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Konum */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Konum
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              {/* Zimmetlenecek Kişi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zimmetli Kişi
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="">Atama Yok (Boşta)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Satın Alma Tarihi & Fiyatı */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satın Alma Tarihi
                  </label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) =>
                      setFormData({ ...formData, purchase_date: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satın Alma Fiyatı (₺)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.purchase_price}
                    onChange={(e) =>
                      setFormData({ ...formData, purchase_price: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notlar
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
