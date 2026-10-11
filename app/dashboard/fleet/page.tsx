'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Car,
  Plus,
  Search,
  User,
  Phone,
  Building2,
  Edit2,
  CheckCircle2,
  Wrench,
  XCircle,
  X,
  Loader2,
  AlertCircle,
  Filter,
  ShieldAlert,
  Calendar,
  Layers
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

interface Facility {
  id: string;
  name: string;
  city?: string;
}

interface Vehicle {
  id: string;
  company_id?: string;
  facility_id?: string;
  plate_number: string;
  brand?: string;
  model?: string;
  model_year?: number | string;
  capacity?: number;
  driver_name?: string;
  driver_phone?: string;
  route_name?: string;
  is_active: boolean;
  status?: string; // 'active' | 'maintenance' | 'inactive'
  facility?: Facility;
  created_at?: string;
}

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    plate_number: '',
    brand: '',
    model: '',
    model_year: new Date().getFullYear().toString(),
    driver_name: '',
    driver_phone: '',
    facility_id: '',
    status: 'active', // 'active' | 'maintenance' | 'inactive'
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Load vehicles & facilities in parallel
      const [vehiclesRes, facilitiesRes] = await Promise.all([
        fetch('/api/shuttle/vehicles'),
        fetch('/api/admin/facilities').catch(() => null),
      ]);

      if (!vehiclesRes.ok) {
        const errData = await vehiclesRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Araçlar yüklenirken hata oluştu.');
      }

      const vehiclesData = await vehiclesRes.json();
      setVehicles(vehiclesData.data || []);

      if (facilitiesRes && facilitiesRes.ok) {
        const facilitiesData = await facilitiesRes.json();
        setFacilities(facilitiesData.facilities || []);
      }
    } catch (err: any) {
      setError(err.message || 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingVehicle(null);
    setFormData({
      plate_number: '',
      brand: '',
      model: '',
      model_year: new Date().getFullYear().toString(),
      driver_name: '',
      driver_phone: '',
      facility_id: facilities[0]?.id || '',
      status: 'active',
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(v: Vehicle) {
    setEditingVehicle(v);
    setFormData({
      plate_number: v.plate_number || '',
      brand: v.brand || '',
      model: v.model || '',
      model_year: v.model_year?.toString() || new Date().getFullYear().toString(),
      driver_name: v.driver_name || '',
      driver_phone: v.driver_phone || '',
      facility_id: v.facility_id || v.facility?.id || facilities[0]?.id || '',
      status: v.status || (v.is_active ? 'active' : 'inactive'),
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.plate_number.trim()) {
      setFormError('Plaka numarası zorunludur.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const isActiveBool = formData.status === 'active';

      if (editingVehicle) {
        // Edit existing vehicle: PATCH /api/shuttle/vehicles/[id]
        const res = await fetch(`/api/shuttle/vehicles/${editingVehicle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plate_number: formData.plate_number.trim().toUpperCase(),
            brand: formData.brand.trim() || null,
            model: formData.model.trim() || null,
            model_year: formData.model_year ? parseInt(formData.model_year, 10) : null,
            driver_name: formData.driver_name.trim() || null,
            driver_phone: formData.driver_phone.trim() || null,
            facility_id: formData.facility_id || null,
            is_active: isActiveBool,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Araç güncellenemedi.');
        }
      } else {
        // Add new vehicle: POST /api/shuttle/vehicles
        const res = await fetch('/api/shuttle/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plate_number: formData.plate_number.trim().toUpperCase(),
            brand: formData.brand.trim() || null,
            model: formData.model.trim() || null,
            model_year: formData.model_year ? parseInt(formData.model_year, 10) : null,
            driver_name: formData.driver_name.trim() || null,
            driver_phone: formData.driver_phone.trim() || null,
            facility_id: formData.facility_id || null,
            is_active: isActiveBool,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Yeni araç kaydedilemedi.');
        }
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'İşlem sırasında bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Check status
      const vStatus = v.status || (v.is_active ? 'active' : 'inactive');
      const matchesStatus = statusFilter === 'all' || vStatus === statusFilter;

      // Check search query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.plate_number?.toLowerCase().includes(q) ||
        v.brand?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q) ||
        v.driver_name?.toLowerCase().includes(q) ||
        v.facility?.name?.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [vehicles, statusFilter, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter((v) => (v.status ? v.status === 'active' : v.is_active)).length;
    const maintenance = vehicles.filter((v) => v.status === 'maintenance').length;
    const drivers = new Set(
      vehicles
        .map((v) => v.driver_name?.trim())
        .filter((d): d is string => Boolean(d && d.length > 0))
    ).size;

    return { total, active, maintenance, drivers };
  }, [vehicles]);

  function getStatusBadge(v: Vehicle) {
    const vStatus = v.status || (v.is_active ? 'active' : 'inactive');

    if (vStatus === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Aktif
        </span>
      );
    } else if (vStatus === 'maintenance') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Serviste / Bakımda
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Pasif
        </span>
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 shadow-sm">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Filo & Şirket Araçları Yönetimi
            </h1>
            <p className="text-sm text-slate-500">
              Şirket binek araçları, servis filosu, zimmetli sürücüler ve bakım süreçlerinin takibi.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Araç Ekle
        </button>
      </div>

      {/* Stats Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Filo Aracı */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Toplam Filo Aracı
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">Kayıtlı şirket aracı</div>
          </div>
        </div>

        {/* Aktif Araç */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Aktif Araç
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
            <div className="text-xs text-slate-500 mt-1">Hizmette & görevde</div>
          </div>
        </div>

        {/* Bakımda Olan */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bakımda Olan
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.maintenance}</div>
            <div className="text-xs text-slate-500 mt-1">Servis ve periyodik bakım</div>
          </div>
        </div>

        {/* Toplam Sürücü */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Toplam Sürücü
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.drivers}</div>
            <div className="text-xs text-slate-500 mt-1">Zimmetli şoför / personel</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tüm Araçlar ({vehicles.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
              statusFilter === 'active'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Aktif
          </button>
          <button
            onClick={() => setStatusFilter('maintenance')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
              statusFilter === 'maintenance'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Serviste / Bakımda
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
              statusFilter === 'inactive'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Pasif
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Plaka, marka, model veya sürücü ara..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">Filo araçları yükleniyor...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Hata:</span> {error}
          </div>
          <button
            onClick={loadData}
            className="ml-auto text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Yeniden Dene
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredVehicles.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Car className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Araç Bulunamadı</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
            {searchQuery || statusFilter !== 'all'
              ? 'Arama kriterlerinize uygun araç kaydı bulunamadı.'
              : 'Filo envanterine henüz herhangi bir araç eklenmemiş.'}
          </p>
          {(searchQuery || statusFilter !== 'all') ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
            >
              Filtreleri Temizle
            </button>
          ) : (
            <button
              onClick={openAddModal}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              Yeni Araç Ekle
            </button>
          )}
        </div>
      )}

      {/* Vehicle Cards Grid */}
      {!loading && !error && filteredVehicles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Plate and Status Row */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="font-mono bg-slate-900 text-white rounded-lg px-2.5 py-1 text-sm font-bold tracking-wider shadow-sm flex items-center gap-1.5">
                    <span className="text-[10px] text-blue-400 font-sans border-r border-slate-700 pr-1.5">TR</span>
                    {vehicle.plate_number}
                  </div>
                  {getStatusBadge(vehicle)}
                </div>

                {/* Brand & Model & Year */}
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">
                    {vehicle.brand || 'Belirtilmemiş Marka'}{' '}
                    <span className="text-slate-700 font-semibold">{vehicle.model || ''}</span>
                  </h3>
                  {vehicle.model_year && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{vehicle.model_year} Model</span>
                      {vehicle.capacity && (
                        <span>• {vehicle.capacity} Kişilik Kapasite</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Details list */}
                <div className="space-y-2 text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  {/* Sürücü / Zimmet */}
                  <div className="flex items-center justify-between text-slate-700">
                    <div className="flex items-center gap-2 text-slate-500">
                      <User className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span>Sürücü / Zimmet:</span>
                    </div>
                    <span className="font-semibold text-slate-900">
                      {vehicle.driver_name || 'Atanmamış'}
                    </span>
                  </div>

                  {/* Telefon */}
                  {vehicle.driver_phone && (
                    <div className="flex items-center justify-between text-slate-700">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span>İletişim:</span>
                      </div>
                      <span className="font-mono text-slate-800">{vehicle.driver_phone}</span>
                    </div>
                  )}

                  {/* Tesis / Lokasyon */}
                  <div className="flex items-center justify-between text-slate-700">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      <span>Tesis / Lokasyon:</span>
                    </div>
                    <span className="font-medium text-slate-800 truncate max-w-[150px]">
                      {vehicle.facility?.name || 'Genel Merkez'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Action button */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Kayıt: {vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString('tr-TR') : 'Mevcut'}
                </span>
                <button
                  onClick={() => openEditModal(vehicle)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Düzenle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Araç Ekle / Düzenle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingVehicle ? 'Aracı Düzenle' : 'Yeni Filo Aracı Ekle'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 text-xs font-medium p-3 rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Plaka */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Plaka <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: 34 ABC 123"
                  value={formData.plate_number}
                  onChange={(e) =>
                    setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-bold"
                />
              </div>

              {/* Marka & Model Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Marka</label>
                  <input
                    type="text"
                    placeholder="Örn: Renault, Ford, Toyota"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Model</label>
                  <input
                    type="text"
                    placeholder="Örn: Megane, Transit, Corolla"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Model Yılı & Durum */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Model Yılı
                  </label>
                  <input
                    type="number"
                    min="1990"
                    max={new Date().getFullYear() + 1}
                    value={formData.model_year}
                    onChange={(e) => setFormData({ ...formData, model_year: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Araç Durumu
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  >
                    <option value="active">Aktif (Görevde)</option>
                    <option value="maintenance">Serviste / Bakımda</option>
                    <option value="inactive">Pasif / Kullanım Dışı</option>
                  </select>
                </div>
              </div>

              {/* Sürücü Adı & Sürücü Telefonu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Sürücü Adı / Zimmetli Kişi
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Ahmet Yılmaz"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Sürücü Telefonu
                  </label>
                  <input
                    type="tel"
                    placeholder="05XX XXX XX XX"
                    value={formData.driver_phone}
                    onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Tesis / Lokasyon Seçimi */}
              {facilities.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bağlı Olduğu Tesis / Şube
                  </label>
                  <select
                    value={formData.facility_id}
                    onChange={(e) => setFormData({ ...formData, facility_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  >
                    <option value="">Merkez / Tesis Seçilmedi</option>
                    {facilities.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name} {fac.city ? `(${fac.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  {isSubmitting
                    ? 'Kaydediliyor...'
                    : editingVehicle
                    ? 'Değişiklikleri Kaydet'
                    : 'Aracı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
