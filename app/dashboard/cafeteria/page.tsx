'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Users,
  Truck,
  Edit2,
  Trash2,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface MenuItems {
  corba?: string;
  ana_yemek?: string;
  yan_yemek?: string;
  tatli_meyve?: string;
  kalori?: number | string;
  [key: string]: any;
}

interface CafeteriaMenu {
  id?: string;
  menu_date: string;
  meal_type: 'kahvalti' | 'ogle' | 'aksam';
  items: MenuItems;
  planned_count: number;
  actual_count: number;
  facility_id?: string;
  created_by?: string;
}

interface CafeteriaSupplier {
  id: string;
  supplier_name: string;
  service_type: 'yerinde_uretim' | 'tasima';
  contact_info?: {
    phone?: string;
    email?: string;
    address?: string;
    contact_person?: string;
  };
  contract_start?: string;
  contract_end?: string;
  is_active?: boolean;
}

const MEAL_LABELS: Record<string, string> = {
  kahvalti: 'Kahvaltı',
  ogle: 'Öğle Yemeği',
  aksam: 'Akşam Yemeği',
};

const SERVICE_LABELS: Record<string, string> = {
  yerinde_uretim: 'Yerinde Üretim',
  tasima: 'Taşımalı',
};

const MEAL_BADGE_CLASSES: Record<string, string> = {
  kahvalti: 'bg-orange-50 text-orange-700 border-orange-200/80',
  ogle: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  aksam: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
};

const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const TURKISH_DAYS = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
];

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday is day 1, Sunday is day 0
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CafeteriaPage() {
  const [activeTab, setActiveTab] = useState<'menus' | 'suppliers'>('menus');

  // Week management
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getStartOfWeek(new Date()));
  const [menus, setMenus] = useState<CafeteriaMenu[]>([]);
  const [menusLoading, setMenusLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Suppliers state
  const [suppliers, setSuppliers] = useState<CafeteriaSupplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  // Modals state
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Menu Form
  const [menuFormData, setMenuFormData] = useState({
    menu_date: formatDateISO(new Date()),
    meal_type: 'ogle' as 'kahvalti' | 'ogle' | 'aksam',
    corba: '',
    ana_yemek: '',
    yan_yemek: '',
    tatli_meyve: '',
    kalori: '',
    planned_count: '',
    actual_count: '',
  });

  // Supplier Form
  const [supplierFormData, setSupplierFormData] = useState({
    supplier_name: '',
    service_type: 'yerinde_uretim' as 'yerinde_uretim' | 'tasima',
    contact_person: '',
    phone: '',
    email: '',
    contract_start: '',
    contract_end: '',
  });

  // Calculate week days Monday to Friday
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  const currentMonthString = useMemo(() => {
    const year = currentWeekStart.getFullYear();
    const month = String(currentWeekStart.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [currentWeekStart]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const first = weekDays[0];
    const last = weekDays[4];
    return `${first.getDate()} ${TURKISH_MONTHS[first.getMonth()]} - ${last.getDate()} ${TURKISH_MONTHS[last.getMonth()]} ${last.getFullYear()}`;
  }, [weekDays]);

  // Fetch menus
  const fetchMenus = async (monthStr: string) => {
    setMenusLoading(true);
    setMenuError(null);
    try {
      const res = await fetch(`/api/cafeteria/menus?month=${monthStr}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Menüler yüklenemedi');
      setMenus(data.data || []);
    } catch (err: any) {
      setMenuError(err.message);
    } finally {
      setMenusLoading(false);
    }
  };

  // Fetch suppliers
  const fetchSuppliers = async () => {
    setSuppliersLoading(true);
    setSupplierError(null);
    try {
      const res = await fetch('/api/cafeteria/suppliers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tedarikçiler yüklenemedi');
      setSuppliers(data.data || []);
    } catch (err: any) {
      setSupplierError(err.message);
    } finally {
      setSuppliersLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus(currentMonthString);
  }, [currentMonthString]);

  useEffect(() => {
    if (activeTab === 'suppliers') {
      fetchSuppliers();
    }
  }, [activeTab]);

  const prevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const nextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const setTodayWeek = () => {
    setCurrentWeekStart(getStartOfWeek(new Date()));
  };

  const onDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const selected = new Date(e.target.value);
    if (!isNaN(selected.getTime())) {
      setCurrentWeekStart(getStartOfWeek(selected));
    }
  };

  // Open modal with preselected date & meal type
  const openMenuModal = (dateStr?: string, mealType?: 'kahvalti' | 'ogle' | 'aksam') => {
    setMenuFormData({
      menu_date: dateStr || formatDateISO(new Date()),
      meal_type: mealType || 'ogle',
      corba: '',
      ana_yemek: '',
      yan_yemek: '',
      tatli_meyve: '',
      kalori: '',
      planned_count: '',
      actual_count: '',
    });
    setIsMenuModalOpen(true);
  };

  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const itemsPayload: MenuItems = {
        corba: menuFormData.corba.trim() || undefined,
        ana_yemek: menuFormData.ana_yemek.trim() || undefined,
        yan_yemek: menuFormData.yan_yemek.trim() || undefined,
        tatli_meyve: menuFormData.tatli_meyve.trim() || undefined,
        kalori: menuFormData.kalori ? Number(menuFormData.kalori) : undefined,
      };

      const payload = {
        menu_date: menuFormData.menu_date,
        meal_type: menuFormData.meal_type,
        items: itemsPayload,
        planned_count: menuFormData.planned_count ? parseInt(menuFormData.planned_count, 10) : 0,
        actual_count: menuFormData.actual_count ? parseInt(menuFormData.actual_count, 10) : 0,
      };

      const res = await fetch('/api/cafeteria/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Menü kaydedilemedi');

      setIsMenuModalOpen(false);
      fetchMenus(currentMonthString);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        supplier_name: supplierFormData.supplier_name.trim(),
        service_type: supplierFormData.service_type,
        contact_info: {
          contact_person: supplierFormData.contact_person.trim() || undefined,
          phone: supplierFormData.phone.trim() || undefined,
          email: supplierFormData.email.trim() || undefined,
        },
        contract_start: supplierFormData.contract_start || null,
        contract_end: supplierFormData.contract_end || null,
      };

      const res = await fetch('/api/cafeteria/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Tedarikçi kaydedilemedi');

      setIsSupplierModalOpen(false);
      setSupplierFormData({
        supplier_name: '',
        service_type: 'yerinde_uretim',
        contact_person: '',
        phone: '',
        email: '',
        contract_start: '',
        contract_end: '',
      });
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = formatDateISO(new Date());

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Yemekhane Yönetimi</h1>
            <p className="text-sm text-slate-500">
              Günlük ve haftalık yemek menüleri, kişi sayıları ve yemek tedarikçilerini yönetin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <Truck className="w-4 h-4" />
            Tedarikçi Ekle
          </button>
          <button
            onClick={() => openMenuModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Menü Ekle
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('menus')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'menus'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Günlük Menüler
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'suppliers'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            Tedarikçiler
          </button>
        </div>
      </div>

      {/* TAB 1: Günlük Menüler */}
      {activeTab === 'menus' && (
        <div className="space-y-4">
          {/* Week Navigation bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={prevWeek}
                aria-label="Önceki Hafta"
                className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="font-semibold text-slate-800 text-base px-2">
                {weekRangeLabel}
              </div>
              <button
                onClick={nextWeek}
                aria-label="Sonraki Hafta"
                className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={setTodayWeek}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
              >
                Bugün
              </button>
              <div className="relative">
                <input
                  type="date"
                  onChange={onDateSelect}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {menuError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{menuError}</span>
            </div>
          )}

          {menusLoading ? (
            <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-500 text-sm">Menüler yükleniyor...</span>
            </div>
          ) : (
            /* Day Columns (Mon-Fri) */
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-2">
              {weekDays.map((dayDate) => {
                const dayDateStr = formatDateISO(dayDate);
                const isToday = dayDateStr === todayStr;
                const dayName = TURKISH_DAYS[dayDate.getDay()];
                const dayDisplay = `${dayDate.getDate()} ${TURKISH_MONTHS[dayDate.getMonth()]}`;

                // Day's menus
                const dayMenus = menus.filter((m) => m.menu_date === dayDateStr);

                return (
                  <div
                    key={dayDateStr}
                    className={`flex flex-col bg-slate-50/50 rounded-2xl border ${
                      isToday ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200/80'
                    } overflow-hidden`}
                  >
                    {/* Day Header */}
                    <div
                      className={`p-3 text-center border-b ${
                        isToday
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-800 border-slate-200/80'
                      }`}
                    >
                      <p className={`text-xs font-medium uppercase tracking-wider ${isToday ? 'text-blue-100' : 'text-slate-500'}`}>
                        {dayName}
                      </p>
                      <p className="text-sm font-bold">{dayDisplay}</p>
                    </div>

                    {/* Meal Cards */}
                    <div className="p-3 space-y-3 flex-1 flex flex-col">
                      {(['kahvalti', 'ogle', 'aksam'] as const).map((mealType) => {
                        const menu = dayMenus.find((m) => m.meal_type === mealType);

                        if (!menu) {
                          return (
                            <button
                              key={mealType}
                              onClick={() => openMenuModal(dayDateStr, mealType)}
                              className="w-full text-left p-3 rounded-xl border border-dashed border-slate-200 bg-white/70 hover:bg-blue-50/50 hover:border-blue-300 transition-colors group flex items-center justify-between"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-slate-400 group-hover:text-blue-600">
                                  {MEAL_LABELS[mealType]}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400 group-hover:text-blue-600 flex items-center gap-0.5">
                                <Plus className="w-3.5 h-3.5" /> Menü Ekle
                              </span>
                            </button>
                          );
                        }

                        const items = menu.items || {};

                        return (
                          <div
                            key={mealType}
                            className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between relative group"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                    MEAL_BADGE_CLASSES[mealType] || 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {MEAL_LABELS[mealType]}
                                </span>
                                <button
                                  onClick={() => {
                                    setMenuFormData({
                                      menu_date: menu.menu_date,
                                      meal_type: menu.meal_type,
                                      corba: items.corba || '',
                                      ana_yemek: items.ana_yemek || '',
                                      yan_yemek: items.yan_yemek || '',
                                      tatli_meyve: items.tatli_meyve || '',
                                      kalori: items.kalori ? String(items.kalori) : '',
                                      planned_count: menu.planned_count ? String(menu.planned_count) : '',
                                      actual_count: menu.actual_count ? String(menu.actual_count) : '',
                                    });
                                    setIsMenuModalOpen(true);
                                  }}
                                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                  title="Düzenle"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Items list */}
                              <ul className="text-xs text-slate-700 space-y-1">
                                {items.corba && (
                                  <li className="flex items-start gap-1">
                                    <span className="text-slate-400">•</span>
                                    <span>{items.corba}</span>
                                  </li>
                                )}
                                {items.ana_yemek && (
                                  <li className="flex items-start gap-1 font-medium text-slate-900">
                                    <span className="text-blue-500">•</span>
                                    <span>{items.ana_yemek}</span>
                                  </li>
                                )}
                                {items.yan_yemek && (
                                  <li className="flex items-start gap-1">
                                    <span className="text-slate-400">•</span>
                                    <span>{items.yan_yemek}</span>
                                  </li>
                                )}
                                {items.tatli_meyve && (
                                  <li className="flex items-start gap-1 text-slate-600">
                                    <span className="text-slate-400">•</span>
                                    <span>{items.tatli_meyve}</span>
                                  </li>
                                )}
                              </ul>
                            </div>

                            {/* Footer stats: calories & counts */}
                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                              <div>
                                {items.kalori ? (
                                  <span className="font-medium text-slate-600">{items.kalori} kcal</span>
                                ) : (
                                  <span>-</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5" title="Planlanan / Gerçekleşen">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span className="font-semibold text-slate-700">
                                  {menu.planned_count || 0}
                                </span>
                                <span className="text-slate-300">/</span>
                                <span className="text-emerald-600 font-medium">
                                  {menu.actual_count || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Tedarikçiler */}
      {activeTab === 'suppliers' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Yemek Tedarikçi Firmaları</h2>
              <p className="text-xs text-slate-500">Sözleşmeli catering ve yemek üretim firmaları</p>
            </div>
            <button
              onClick={() => setIsSupplierModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Tedarikçi Ekle
            </button>
          </div>

          {supplierError && (
            <div className="m-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{supplierError}</span>
            </div>
          )}

          {suppliersLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-500 text-sm">Tedarikçiler yükleniyor...</span>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-medium text-slate-600">Henüz tedarikçi eklenmemiş</p>
              <p className="text-xs text-slate-400 mt-1">Catering firması eklemek için Tedarikçi Ekle butonunu kullanın.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-3.5">Tedarikçi Adı</th>
                    <th className="px-6 py-3.5">Hizmet Türü</th>
                    <th className="px-6 py-3.5">İletişim</th>
                    <th className="px-6 py-3.5">Sözleşme Başlangıç</th>
                    <th className="px-6 py-3.5">Sözleşme Bitiş</th>
                    <th className="px-6 py-3.5">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {suppliers.map((s) => {
                    const isActive = s.is_active !== false;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">{s.supplier_name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              s.service_type === 'yerinde_uretim'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {SERVICE_LABELS[s.service_type] || s.service_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {s.contact_info?.contact_person && (
                            <p className="font-medium text-slate-800">{s.contact_info.contact_person}</p>
                          )}
                          {s.contact_info?.phone && (
                            <p className="text-slate-500">{s.contact_info.phone}</p>
                          )}
                          {s.contact_info?.email && (
                            <p className="text-slate-400">{s.contact_info.email}</p>
                          )}
                          {!s.contact_info?.contact_person && !s.contact_info?.phone && !s.contact_info?.email && (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {s.contract_start ? s.contract_start : '-'}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {s.contract_end ? s.contract_end : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${
                              isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Menü Ekle / Düzenle */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                Menü Ekle / Düzenle
              </h3>
              <button
                onClick={() => setIsMenuModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMenuSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tarih</label>
                  <input
                    type="date"
                    required
                    value={menuFormData.menu_date}
                    onChange={(e) => setMenuFormData({ ...menuFormData, menu_date: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Öğün Tipi</label>
                  <select
                    value={menuFormData.meal_type}
                    onChange={(e) =>
                      setMenuFormData({
                        ...menuFormData,
                        meal_type: e.target.value as 'kahvalti' | 'ogle' | 'aksam',
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="kahvalti">Kahvaltı</option>
                    <option value="ogle">Öğle Yemeği</option>
                    <option value="aksam">Akşam Yemeği</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Menü İçeriği</h4>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Çorba</label>
                  <input
                    type="text"
                    placeholder="Örn: Mercimek Çorbası"
                    value={menuFormData.corba}
                    onChange={(e) => setMenuFormData({ ...menuFormData, corba: e.target.value })}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Ana Yemek *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Orman Kebabı"
                    value={menuFormData.ana_yemek}
                    onChange={(e) => setMenuFormData({ ...menuFormData, ana_yemek: e.target.value })}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Yan Yemek</label>
                  <input
                    type="text"
                    placeholder="Örn: Pirinç Pilavı"
                    value={menuFormData.yan_yemek}
                    onChange={(e) => setMenuFormData({ ...menuFormData, yan_yemek: e.target.value })}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Tatlı / Meyve</label>
                  <input
                    type="text"
                    placeholder="Örn: Kemalpaşa Tatlısı / Mevsim Meyvesi"
                    value={menuFormData.tatli_meyve}
                    onChange={(e) => setMenuFormData({ ...menuFormData, tatli_meyve: e.target.value })}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Toplam Kalori (kcal)</label>
                  <input
                    type="number"
                    placeholder="Örn: 850"
                    value={menuFormData.kalori}
                    onChange={(e) => setMenuFormData({ ...menuFormData, kalori: e.target.value })}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Planlanan Kişi Sayısı</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={menuFormData.planned_count}
                    onChange={(e) => setMenuFormData({ ...menuFormData, planned_count: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gerçekleşen Kişi Sayısı</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={menuFormData.actual_count}
                    onChange={(e) => setMenuFormData({ ...menuFormData, actual_count: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tedarikçi Ekle */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Tedarikçi Ekle
              </h3>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tedarikçi Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Lezzet Catering A.Ş."
                  value={supplierFormData.supplier_name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, supplier_name: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hizmet Türü *</label>
                <select
                  value={supplierFormData.service_type}
                  onChange={(e) =>
                    setSupplierFormData({
                      ...supplierFormData,
                      service_type: e.target.value as 'yerinde_uretim' | 'tasima',
                    })
                  }
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="yerinde_uretim">Yerinde Üretim</option>
                  <option value="tasima">Taşımalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Yetkili Kişi</label>
                <input
                  type="text"
                  placeholder="Örn: Mehmet Demir"
                  value={supplierFormData.contact_person}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, contact_person: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    placeholder="0532..."
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-posta</label>
                  <input
                    type="email"
                    placeholder="info@..."
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sözleşme Başlangıç</label>
                  <input
                    type="date"
                    value={supplierFormData.contract_start}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contract_start: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sözleşme Bitiş</label>
                  <input
                    type="date"
                    value={supplierFormData.contract_end}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contract_end: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tedarikçi Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
