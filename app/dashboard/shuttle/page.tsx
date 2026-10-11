'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bus,
  Car,
  MapPin,
  User,
  Phone,
  Users,
  Building2,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ServiceRoute {
  id?: string;
  route_name?: string;
  shift_type?: string;
  region?: string;
}

interface Facility {
  id: string;
  name: string;
  city?: string;
}

interface Vehicle {
  id: string;
  company_id: string;
  facility_id?: string;
  plate_number: string;
  brand?: string;
  model?: string;
  model_year?: number;
  capacity: number;
  driver_name?: string;
  driver_phone?: string;
  route_name?: string;
  is_active: boolean;
  facility?: Facility;
  routes?: ServiceRoute[];
  created_at?: string;
}

interface FormDataState {
  plate_number: string;
  brand: string;
  model: string;
  model_year: string;
  capacity: number;
  driver_name: string;
  driver_phone: string;
  route_name: string;
  is_active: boolean;
}

const initialFormState: FormDataState = {
  plate_number: '',
  brand: '',
  model: '',
  model_year: '',
  capacity: 16,
  driver_name: '',
  driver_phone: '',
  route_name: '',
  is_active: true,
};

export default function ShuttlePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'routes'>('vehicles');

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<FormDataState>(initialFormState);

  // Fetch vehicles
  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/shuttle/vehicles');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Araçlar yüklenirken hata oluştu');
      }
      const data = await res.json();
      setVehicles(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Veriler alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter((v) => v.is_active).length;
    const totalCapacity = vehicles.reduce((sum, v) => sum + (v.capacity || 0), 0);
    
    // Unique routes from vehicle route_name and vehicle.routes
    const routeSet = new Set<string>();
    vehicles.forEach((v) => {
      if (v.route_name && v.route_name.trim()) {
        routeSet.add(v.route_name.trim());
      }
      if (v.routes && Array.isArray(v.routes)) {
        v.routes.forEach((r) => {
          if (r.route_name) routeSet.add(r.route_name.trim());
        });
      }
    });
    const uniqueRoutes = routeSet.size;

    return {
      totalVehicles,
      activeVehicles,
      totalCapacity,
      uniqueRoutes,
    };
  }, [vehicles]);

  // Derived routes list for Tab 2
  const routesList = useMemo(() => {
    const routesMap = new Map<string, {
      routeName: string;
      vehicles: string[];
      shiftType: string;
      region: string;
    }>();

    vehicles.forEach((v) => {
      if (v.routes && v.routes.length > 0) {
        v.routes.forEach((r) => {
          const name = r.route_name || v.route_name || 'İsimsiz Güzergah';
          if (!routesMap.has(name)) {
            routesMap.set(name, {
              routeName: name,
              vehicles: [v.plate_number],
              shiftType: r.shift_type || 'Genel Vardiya',
              region: r.region || v.facility?.city || 'Merkez',
            });
          } else {
            const existing = routesMap.get(name)!;
            if (!existing.vehicles.includes(v.plate_number)) {
              existing.vehicles.push(v.plate_number);
            }
          }
        });
      } else if (v.route_name && v.route_name.trim()) {
        const name = v.route_name.trim();
        if (!routesMap.has(name)) {
          routesMap.set(name, {
            routeName: name,
            vehicles: [v.plate_number],
            shiftType: 'Standart',
            region: v.facility?.city || 'Belirtilmemiş',
          });
        } else {
          const existing = routesMap.get(name)!;
          if (!existing.vehicles.includes(v.plate_number)) {
            existing.vehicles.push(v.plate_number);
          }
        }
      }
    });

    return Array.from(routesMap.values());
  }, [vehicles]);

  // Modal open helpers
  const handleOpenAddModal = () => {
    setEditingVehicle(null);
    setFormData(initialFormState);
    setShowModal(true);
  };

  const handleOpenEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      plate_number: vehicle.plate_number || '',
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      model_year: vehicle.model_year ? String(vehicle.model_year) : '',
      capacity: vehicle.capacity || 16,
      driver_name: vehicle.driver_name || '',
      driver_phone: vehicle.driver_phone || '',
      route_name: vehicle.route_name || '',
      is_active: vehicle.is_active ?? true,
    });
    setShowModal(true);
  };

  // Toggle active status inline
  const handleToggleActive = async (vehicle: Vehicle) => {
    const updatedStatus = !vehicle.is_active;

    // Optimistic UI update
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicle.id ? { ...v, is_active: updatedStatus } : v))
    );

    try {
      const res = await fetch(`/api/shuttle/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: updatedStatus }),
      });
      if (!res.ok) {
        throw new Error('Durum güncellenemedi');
      }
    } catch (err: any) {
      // Revert if error
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? { ...v, is_active: vehicle.is_active } : v))
      );
      alert('Durum güncellenirken bir hata oluştu: ' + err.message);
    }
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate_number.trim()) {
      alert('Lütfen araç plakasını giriniz.');
      return;
    }

    setSubmitting(true);
    const payload = {
      plate_number: formData.plate_number.trim().toUpperCase(),
      brand: formData.brand.trim() || null,
      model: formData.model.trim() || null,
      model_year: formData.model_year ? parseInt(formData.model_year, 10) : null,
      capacity: Number(formData.capacity) || 16,
      driver_name: formData.driver_name.trim() || null,
      driver_phone: formData.driver_phone.trim() || null,
      route_name: formData.route_name.trim() || null,
      is_active: formData.is_active,
    };

    try {
      if (editingVehicle) {
        // Update vehicle
        const res = await fetch(`/api/shuttle/vehicles/${editingVehicle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Araç güncellenemedi');
        }

        const data = await res.json();
        const updated = data.data;

        setVehicles((prev) =>
          prev.map((v) =>
            v.id === editingVehicle.id
              ? { ...v, ...updated, facility: v.facility, routes: v.routes }
              : v
          )
        );
      } else {
        // Add new vehicle
        const res = await fetch('/api/shuttle/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Araç eklenemedi');
        }

        const data = await res.json();
        setVehicles((prev) => [data.data, ...prev]);
      }

      setShowModal(false);
    } catch (err: any) {
      alert(err.message || 'İşlem sırasında bir hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
            <Bus className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Servis Yönetimi</h1>
            <p className="text-sm text-slate-500">Personel servis araçları ve güzergah planlaması</p>
          </div>
        </div>

        {activeTab === 'vehicles' && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Araç Ekle</span>
          </button>
        )}
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Toplam Araç</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalVehicles}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Aktif Araç</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.activeVehicles}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Toplam Kapasite</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalCapacity} <span className="text-sm font-normal text-slate-500">kişi</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Güzergah Sayısı</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.uniqueRoutes}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'vehicles'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Araçlar ({vehicles.length})
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'routes'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Güzergahlar ({routesList.length})
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <p className="text-sm text-slate-500">Veriler yükleniyor...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : activeTab === 'vehicles' ? (
        /* Tab 1: Vehicles Grid */
        vehicles.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Henüz Araç Eklenmemiş</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Sisteme servis aracı ekleyerek personel taşımacılığını organize etmeye başlayabilirsiniz.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Araç Ekle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Plate Badge & Active Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="bg-slate-900 text-white font-mono px-3 py-1 rounded-lg text-sm font-bold tracking-wider">
                      {vehicle.plate_number}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        vehicle.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {vehicle.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>

                  {/* Vehicle Brand & Model */}
                  <div className="mb-2">
                    <h3 className="text-slate-800 font-semibold text-base">
                      {vehicle.brand || vehicle.model
                        ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim()
                        : 'Belirtilmemiş Model'}
                      {vehicle.model_year && (
                        <span className="text-slate-400 font-normal text-sm ml-1.5">
                          ({vehicle.model_year})
                        </span>
                      )}
                    </h3>
                  </div>

                  {/* Route Name */}
                  {vehicle.route_name && (
                    <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-3">
                      <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-medium truncate">{vehicle.route_name}</span>
                    </div>
                  )}

                  <hr className="my-3 border-slate-100" />

                  {/* Driver and Specs Details */}
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{vehicle.driver_name || 'Şoför Belirtilmedi'}</span>
                      </div>
                      {vehicle.driver_phone && (
                        <div className="flex items-center gap-1 text-slate-500 text-xs">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{vehicle.driver_phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Kapasite: <strong>{vehicle.capacity || 16}</strong> kişi</span>
                      </div>
                      {vehicle.facility && (
                        <div className="flex items-center gap-1 text-slate-500 text-xs truncate max-w-[150px]">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{vehicle.facility.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleActive(vehicle)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {vehicle.is_active ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-emerald-600" />
                        <span>Devre Dışı Bırak</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-slate-400" />
                        <span>Aktifleştir</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(vehicle)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Düzenle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Tab 2: Routes Table */
        routesList.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Tanımlı Güzergah Bulunamadı</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              Araçlara güzergah adı atayarak veya servis rotaları tanımlayarak bu alanda görüntüleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Güzergah Adı</th>
                    <th className="py-3.5 px-5">Atanan Araçlar</th>
                    <th className="py-3.5 px-5">Vardiya Türü</th>
                    <th className="py-3.5 px-5">Bölge / Tesis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {routesList.map((route, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5 font-semibold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                        {route.routeName}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1.5">
                          {route.vehicles.map((plate) => (
                            <span
                              key={plate}
                              className="bg-slate-100 text-slate-800 font-mono text-xs font-medium px-2 py-0.5 rounded border border-slate-200"
                            >
                              {plate}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {route.shiftType}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-slate-600">{route.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Add / Edit Vehicle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingVehicle ? 'Servis Aracını Düzenle' : 'Yeni Servis Aracı Ekle'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Plaka */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Plaka <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="34 ABC 123"
                    value={formData.plate_number}
                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                  />
                </div>

                {/* Marka */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Marka
                  </label>
                  <input
                    type="text"
                    placeholder="Mercedes, Ford vs."
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    placeholder="Sprinter, Transit vs."
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Model Yılı */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Model Yılı
                  </label>
                  <input
                    type="number"
                    min="1990"
                    max="2030"
                    placeholder="2022"
                    value={formData.model_year}
                    onChange={(e) => setFormData({ ...formData, model_year: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Kapasite */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Kapasite (Kişi)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Şoför Adı */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Şoför Adı Soyadı
                  </label>
                  <input
                    type="text"
                    placeholder="Ahmet Yılmaz"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Şoför Telefonu */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Şoför Telefonu
                  </label>
                  <input
                    type="tel"
                    placeholder="0532 000 00 00"
                    value={formData.driver_phone}
                    onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Güzergah Adı */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Güzergah Adı
                  </label>
                  <input
                    type="text"
                    placeholder="Kadıköy - Fabrika Ana Hat"
                    value={formData.route_name}
                    onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Aktif/Pasif Toggle */}
                <div className="sm:col-span-2 flex items-center justify-between pt-2">
                  <span className="text-sm font-medium text-slate-700">Araç Aktif Mi?</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className="inline-flex items-center gap-1.5 focus:outline-none"
                  >
                    {formData.is_active ? (
                      <ToggleRight className="w-7 h-7 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-400" />
                    )}
                    <span className={`text-xs font-semibold ${formData.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {formData.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingVehicle ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
