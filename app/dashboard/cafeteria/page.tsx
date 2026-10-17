'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
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
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Star,
  MessageSquare,
  ClipboardList,
  Copy,
  Scale,
  Flame,
  Coins,
  ArrowRight,
  Download,
  FileSpreadsheet,
  FileUp,
  UploadCloud,
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
  produced_kg?: number | null;
  consumed_kg?: number | null;
  waste_kg?: number | null;
  unit_cost?: number | null;
  facility_id?: string;
  created_by?: string;
}

interface CafeteriaSatisfactionData {
  month: string;
  today: string;
  mine: { id: string; score: number; comment: string | null; period: string } | null;
  score_avg: number | null;
  count: number;
  distribution: Record<string, number> | null;
  recent: Array<{ score: number; comment: string; period: string; user_name: string | null }> | null;
}

interface YemekhaneRequest {
  id: string;
  request_number?: string | null;
  title: string;
  status: string;
  created_at: string;
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

interface MenuImportIssue {
  row: number;
  label: string;
  message: string;
}

interface MenuImportResult {
  success: boolean;
  message: string;
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    invalid: number;
  };
  issues: MenuImportIssue[];
}

/** Excel içe aktarma: dosya boyutu üst sınırı (API ile aynı) */
const MAX_IMPORT_FILE_MB = 5;

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

// Menü üretim/maliyet girişini yapabilecek roller (API ile aynı liste)
const MENU_MANAGER_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];
// Yemek tedarikçisi ekleyebilecek roller (cafeteria suppliers API ile aynı liste)
const SUPPLIER_MANAGER_ROLES = ['super_admin', 'company_admin', 'facility_manager'];

// Yemekhane talepleri için durum rozetleri (talep detay sayfasıyla aynı palet)
const REQ_STATUS: Record<string, { label: string; classes: string; dot: string }> = {
  yeni: { label: 'Açık', classes: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  atandi: { label: 'Onay Bekliyor', classes: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  onaylandi: { label: 'Onaylandı', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  islemde: { label: 'İşlemde', classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  cozumlendi: { label: 'Çözümlendi', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  tamamlandi: { label: 'Çözümlendi', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  reddedildi: { label: 'Reddedildi', classes: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

function fmtNum(n: number, maxFrac = 1): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: maxFrac });
}

function fmtTL(n: number, maxFrac = 2): string {
  return '₺' + n.toLocaleString('tr-TR', { maximumFractionDigits: maxFrac });
}

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
    produced_kg: '',
    consumed_kg: '',
    waste_kg: '',
    unit_cost: '',
  });

  // Kullanıcı rolü (görünürlük ve düzenleme yetkileri)
  const [userRole, setUserRole] = useState<string | null>(null);

  // Günlük memnuniyet anketi
  const [satisfaction, setSatisfaction] = useState<CafeteriaSatisfactionData | null>(null);
  const [satScore, setSatScore] = useState<number>(0);
  const [satComment, setSatComment] = useState('');
  const [satSubmitting, setSatSubmitting] = useState(false);
  const [satFlash, setSatFlash] = useState<string | null>(null);

  // Yemekhane kategorili talepler
  const [yemekhaneRequests, setYemekhaneRequests] = useState<YemekhaneRequest[]>([]);
  const [yemekhaneTotal, setYemekhaneTotal] = useState(0);

  // Hafta kopyalama
  const [copying, setCopying] = useState(false);

  // Excel ile toplu menü içe aktarma
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<MenuImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const monthLabel = useMemo(
    () => `${TURKISH_MONTHS[currentWeekStart.getMonth()]} ${currentWeekStart.getFullYear()}`,
    [currentWeekStart]
  );

  // Rol bazlı yetkiler (rol yüklenene kadar gizli tutulur)
  const canManageMenus = userRole ? MENU_MANAGER_ROLES.includes(userRole) : false;
  const canManageSuppliers = userRole ? SUPPLIER_MANAGER_ROLES.includes(userRole) : false;

  // Bu ayın üretim / tüketim / fire / maliyet toplamları (yüklenen ayın menülerinden)
  const monthStats = useMemo(() => {
    let produced = 0;
    let consumed = 0;
    let waste = 0;
    let cost = 0;
    let portions = 0;
    for (const m of menus) {
      if (m.produced_kg != null) produced += Number(m.produced_kg) || 0;
      if (m.consumed_kg != null) consumed += Number(m.consumed_kg) || 0;
      if (m.waste_kg != null) waste += Number(m.waste_kg) || 0;
      if (m.unit_cost != null) {
        const cnt = m.actual_count || m.planned_count || 0;
        cost += (Number(m.unit_cost) || 0) * cnt;
        portions += cnt;
      }
    }
    return {
      produced,
      consumed,
      waste,
      cost,
      portions,
      costPerPortion: portions > 0 ? cost / portions : 0,
      fireRatio: produced > 0 ? (waste / produced) * 100 : null,
    };
  }, [menus]);

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

  // Fetch günlük yemekhane memnuniyet anketi (aylık özet + kendi puanım)
  const fetchSatisfaction = async (monthStr: string) => {
    try {
      const res = await fetch(`/api/cafeteria/satisfaction?month=${monthStr}`);
      const json = await res.json();
      if (!res.ok) return;
      const d: CafeteriaSatisfactionData = json.data;
      setSatisfaction(d);
      setSatScore(d.mine?.score || 0);
      setSatComment(d.mine?.comment || '');
    } catch (err) {
      console.error('Anket verisi yüklenemedi:', err);
    }
  };

  // Fetch yemekhane kategorili son talepler
  const fetchYemekhaneRequests = async () => {
    try {
      const res = await fetch('/api/requests?category=yemekhane&page=1');
      const json = await res.json();
      if (!res.ok) return;
      setYemekhaneRequests((json.data || []).slice(0, 5));
      setYemekhaneTotal(json.count || 0);
    } catch (err) {
      console.error('Yemekhane talepleri yüklenemedi:', err);
    }
  };

  // Excel içe aktarma yardımcıları
  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setImportError(null);
    setOverwriteExisting(false);
    setDragOver(false);
    setShowImportModal(true);
  };

  const closeImportModal = () => {
    if (importing) return;
    setShowImportModal(false);
  };

  const pickImportFile = (file: File | null) => {
    setImportError(null);
    setImportResult(null);
    if (!file) {
      setImportFile(null);
      return;
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setImportError('Yalnızca .xlsx veya .xls uzantılı Excel dosyaları yüklenebilir.');
      setImportFile(null);
      return;
    }
    if (file.size > MAX_IMPORT_FILE_MB * 1024 * 1024) {
      setImportError(`Dosya boyutu en fazla ${MAX_IMPORT_FILE_MB} MB olabilir.`);
      setImportFile(null);
      return;
    }
    setImportFile(file);
  };

  const handleImportSubmit = async () => {
    if (!importFile || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('mode', overwriteExisting ? 'overwrite' : 'skip');

      const res = await fetch('/api/cafeteria/menus/import', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'İçe aktarma başarısız oldu.');

      setImportResult(json as MenuImportResult);
      if ((json.summary?.created || 0) + (json.summary?.updated || 0) > 0) {
        fetchMenus(currentMonthString);
      }
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    fetchMenus(currentMonthString);
    fetchSatisfaction(currentMonthString);
  }, [currentMonthString]);

  useEffect(() => {
    if (activeTab === 'suppliers') {
      fetchSuppliers();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchYemekhaneRequests();
    (async () => {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (p?.role) setUserRole(p.role);
      } catch (err) {
        console.error('Kullanıcı rolü alınamadı:', err);
      }
    })();
  }, []);

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
      produced_kg: '',
      consumed_kg: '',
      waste_kg: '',
      unit_cost: '',
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
        produced_kg: menuFormData.produced_kg.trim() ? Number(menuFormData.produced_kg) : null,
        consumed_kg: menuFormData.consumed_kg.trim() ? Number(menuFormData.consumed_kg) : null,
        waste_kg: menuFormData.waste_kg.trim() ? Number(menuFormData.waste_kg) : null,
        unit_cost: menuFormData.unit_cost.trim() ? Number(menuFormData.unit_cost) : null,
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

  // Günlük memnuniyet değerlendirmesi gönder / güncelle
  const handleSatisfactionSubmit = async () => {
    if (!satScore) return;
    setSatSubmitting(true);
    setSatFlash(null);
    try {
      const res = await fetch('/api/cafeteria/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: satScore, comment: satComment.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Değerlendirme kaydedilemedi');
      setSatFlash(json.updated ? 'Değerlendirmeniz güncellendi. Teşekkürler!' : 'Değerlendirmeniz kaydedildi. Teşekkürler!');
      fetchSatisfaction(currentMonthString);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSatSubmitting(false);
    }
  };

  // Geçen haftanın menülerini bu haftaya kopyala
  const handleCopyWeek = async () => {
    if (
      !confirm(
        'Geçen haftanın menüleri bu haftaya kopyalanacak. Boş gün ve öğünler doldurulur; mevcut kayıtlara dokunulmaz. Devam edilsin mi?'
      )
    ) {
      return;
    }
    setCopying(true);
    try {
      const res = await fetch('/api/cafeteria/menus/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: formatDateISO(currentWeekStart) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Kopyalama başarısız');
      const { copied, skipped } = json.data || {};
      if (copied > 0) {
        alert(`${copied} menü kopyalandı.${skipped > 0 ? ` ${skipped} kayıt zaten mevcuttu, atlandı.` : ''}`);
      } else {
        alert(json.message || 'Kopyalanacak menü bulunamadı.');
      }
      fetchMenus(currentMonthString);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCopying(false);
    }
  };

  const todayStr = formatDateISO(new Date());
  const todayLabel = `${TURKISH_DAYS[new Date().getDay()]}, ${new Date().getDate()} ${TURKISH_MONTHS[new Date().getMonth()]}`;

  // Modal içi üretim önizlemesi (kalan / fire oranı)
  const modalProduced = menuFormData.produced_kg.trim() ? Number(menuFormData.produced_kg) : 0;
  const modalConsumed = menuFormData.consumed_kg.trim() ? Number(menuFormData.consumed_kg) : 0;
  const modalWaste = menuFormData.waste_kg.trim() ? Number(menuFormData.waste_kg) : 0;
  const modalKalan = modalProduced - modalConsumed - modalWaste;
  const modalFireRatio = modalProduced > 0 ? (modalWaste / modalProduced) * 100 : null;

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
          {canManageSuppliers && (
            <button
              onClick={() => setIsSupplierModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Truck className="w-4 h-4" />
              Tedarikçi Ekle
            </button>
          )}
          {canManageMenus && (
            <>
              <a
                href="/api/cafeteria/menus/template"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-colors"
                title="Aylık menüleri toplu girmek için hazır başlıklı Excel şablonunu indirin"
              >
                <Download className="w-4 h-4" />
                Şablon İndir
              </a>
              <button
                onClick={openImportModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                title="Excel dosyasından toplu menü yükleyin"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel'den Aktar
              </button>
              <button
                onClick={() => openMenuModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Menü Ekle
              </button>
            </>
          )}
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
          {/* Ay Özeti: Üretim / Tüketim / Fire / Maliyet */}
          <div className={`grid grid-cols-2 gap-3 ${canManageMenus ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Scale className="w-4 h-4 text-blue-500" />
                Üretim
              </div>
              <p className="mt-1.5 text-xl font-bold text-slate-900">{fmtNum(monthStats.produced)} kg</p>
              <p className="text-[11px] text-slate-400">{monthLabel} toplamı</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <UtensilsCrossed className="w-4 h-4 text-emerald-500" />
                Tüketim
              </div>
              <p className="mt-1.5 text-xl font-bold text-slate-900">{fmtNum(monthStats.consumed)} kg</p>
              <p className="text-[11px] text-slate-400">{monthLabel} toplamı</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <Flame className="w-4 h-4 text-rose-500" />
                Fire
              </div>
              <p className="mt-1.5 text-xl font-bold text-slate-900">{fmtNum(monthStats.waste)} kg</p>
              <p className="text-[11px] text-slate-400">
                {monthStats.fireRatio != null ? `Fire oranı %${fmtNum(monthStats.fireRatio)}` : 'Üretim girildikçe hesaplanır'}
              </p>
            </div>
            {canManageMenus && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Coins className="w-4 h-4 text-amber-500" />
                  Yemek Maliyeti
                </div>
                <p className="mt-1.5 text-xl font-bold text-slate-900">{fmtTL(monthStats.cost, 0)}</p>
                <p className="text-[11px] text-slate-400">
                  {monthStats.portions > 0 ? `Kişi başı ~${fmtTL(monthStats.costPerPortion)}` : 'Maliyet girildikçe hesaplanır'}
                </p>
              </div>
            )}
          </div>

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
              {canManageMenus && (
                <button
                  onClick={handleCopyWeek}
                  disabled={copying}
                  title="Geçen haftanın menülerini bu haftaya kopyalar"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
                >
                  {copying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                  Geçen Haftayı Kopyala
                </button>
              )}
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
                          return canManageMenus ? (
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
                          ) : (
                            <div
                              key={mealType}
                              className="w-full p-3 rounded-xl border border-dashed border-slate-200 bg-white/50 flex items-center justify-between"
                            >
                              <span className="text-xs font-medium text-slate-300">{MEAL_LABELS[mealType]}</span>
                              <span className="text-[11px] text-slate-300">Menü yok</span>
                            </div>
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
                                {canManageMenus && (
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
                                        produced_kg: menu.produced_kg != null ? String(menu.produced_kg) : '',
                                        consumed_kg: menu.consumed_kg != null ? String(menu.consumed_kg) : '',
                                        waste_kg: menu.waste_kg != null ? String(menu.waste_kg) : '',
                                        unit_cost: menu.unit_cost != null ? String(menu.unit_cost) : '',
                                      });
                                      setIsMenuModalOpen(true);
                                    }}
                                    className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                    title="Düzenle"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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

                            {/* Üretim & maliyet satırları (girilmişse) */}
                            {(menu.produced_kg != null ||
                              menu.consumed_kg != null ||
                              menu.waste_kg != null ||
                              menu.unit_cost != null) && (
                              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                {(menu.produced_kg != null || menu.consumed_kg != null || menu.waste_kg != null) && (
                                  <div className="flex items-center gap-1 flex-wrap text-[11px] text-slate-500">
                                    <Scale className="w-3 h-3 text-slate-400" />
                                    {menu.produced_kg != null && <span>{fmtNum(Number(menu.produced_kg))} kg üretim</span>}
                                    {menu.consumed_kg != null && <span>· {fmtNum(Number(menu.consumed_kg))} kg tüketim</span>}
                                    {menu.waste_kg != null && (
                                      <span className={Number(menu.waste_kg) > 0 ? 'text-rose-500 font-medium' : ''}>
                                        · {fmtNum(Number(menu.waste_kg))} kg fire
                                      </span>
                                    )}
                                  </div>
                                )}
                                {menu.unit_cost != null && (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <Coins className="w-3 h-3 text-slate-400" />
                                    <span>{fmtTL(Number(menu.unit_cost))}/kişi</span>
                                    {(menu.actual_count || menu.planned_count) > 0 && (
                                      <span>
                                        · Toplam{' '}
                                        <span className="font-semibold text-slate-700">
                                          {fmtTL(Number(menu.unit_cost) * (menu.actual_count || menu.planned_count), 0)}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Anket · Memnuniyet Özeti · Talepler */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1) Bugünün yemek değerlendirmesi */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
                  <Star className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bugünün Yemek Değerlendirmesi</h3>
                  <p className="text-[11px] text-slate-500">{todayLabel} · Günde bir değerlendirme</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSatScore(i);
                      setSatFlash(null);
                    }}
                    aria-label={`${i} puan ver`}
                    title={`${i} puan`}
                    className="p-0.5"
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        i <= satScore ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-300'
                      }`}
                    />
                  </button>
                ))}
                {satScore > 0 && <span className="ml-2 text-sm font-semibold text-slate-700">{satScore}/5</span>}
              </div>

              <textarea
                rows={2}
                placeholder="Yorumunuz (opsiyonel) — örn. bugünkü ana yemek hakkında"
                value={satComment}
                onChange={(e) => {
                  setSatComment(e.target.value);
                  setSatFlash(null);
                }}
                className="mt-3 w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  onClick={handleSatisfactionSubmit}
                  disabled={!satScore || satSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
                >
                  {satSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {satisfaction?.mine ? 'Değerlendirmeyi Güncelle' : 'Gönder'}
                </button>
                {satisfaction?.mine && !satFlash && (
                  <span className="text-[11px] text-slate-400">Bugünkü puanınız: {satisfaction.mine.score}/5</span>
                )}
              </div>
              {satFlash && <p className="mt-2 text-[12px] text-emerald-600 font-medium">{satFlash}</p>}
            </div>

            {/* 2) Memnuniyet özeti */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Memnuniyet Özeti</h3>
                  <p className="text-[11px] text-slate-500">{monthLabel} · yemekhane anketi</p>
                </div>
              </div>

              {satisfaction && satisfaction.count > 0 ? (
                <>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {Number(satisfaction.score_avg).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-sm text-slate-400 mb-1">/ 5</span>
                    <span className="ml-auto text-xs text-slate-500 mb-1">{satisfaction.count} değerlendirme</span>
                  </div>

                  {satisfaction.distribution && (
                    <div className="mt-3 space-y-1.5">
                      {[5, 4, 3, 2, 1].map((s) => {
                        const c = satisfaction.distribution![String(s)] || 0;
                        const pct = satisfaction.count > 0 ? Math.round((c / satisfaction.count) * 100) : 0;
                        return (
                          <div key={s} className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="w-6 text-right">{s}★</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  s >= 4 ? 'bg-emerald-400' : s === 3 ? 'bg-amber-400' : 'bg-rose-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8">{c}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {satisfaction.recent && satisfaction.recent.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Son Yorumlar</p>
                      {satisfaction.recent.slice(0, 3).map((r, i) => (
                        <div key={i} className="text-xs text-slate-600">
                          <span className="font-semibold text-amber-500">{r.score}★</span>{' '}
                          <span className="italic">
                            "{r.comment.length > 90 ? r.comment.slice(0, 90) + '…' : r.comment}"
                          </span>
                          <span className="text-slate-400"> — {r.user_name || 'Çalışan'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-6 text-center text-slate-400">
                  <Star className="w-8 h-8 mx-auto mb-1.5 text-slate-200" />
                  <p className="text-xs">Bu ay henüz değerlendirme yok.</p>
                </div>
              )}
            </div>

            {/* 3) Yemekhane talepleri */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Yemekhane Talepleri</h3>
                    <p className="text-[11px] text-slate-500">Şikayet ve talepler aynı akışta takip edilir</p>
                  </div>
                </div>
                <Link
                  href="/dashboard/requests/new"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Yeni Talep
                </Link>
              </div>

              {yemekhaneRequests.length === 0 ? (
                <div className="mt-6 text-center text-slate-400">
                  <UtensilsCrossed className="w-8 h-8 mx-auto mb-1.5 text-slate-200" />
                  <p className="text-xs">Yemekhane kategorisinde talep bulunmuyor.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {yemekhaneRequests.map((r) => {
                    const cfg = REQ_STATUS[r.status] || REQ_STATUS.yeni;
                    return (
                      <Link
                        key={r.id}
                        href={`/dashboard/requests/${r.id}`}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700">
                            {r.title}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {r.request_number || 'Talep'} · {new Date(r.created_at).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.classes}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </Link>
                    );
                  })}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Toplam {yemekhaneTotal} kayıt</span>
                    <Link
                      href="/dashboard/requests"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Tüm Talepler <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
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
            {canManageSuppliers && (
              <button
                onClick={() => setIsSupplierModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Tedarikçi Ekle
              </button>
            )}
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

      {/* MODAL: Excel ile Menü Aktar */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Excel ile Menü Aktar</h2>
              </div>
              <button
                onClick={closeImportModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Adım rehberi */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
                <p className="font-semibold mb-1.5">Nasıl çalışır?</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800 text-[13px]">
                  <li>
                    Hazır başlıklı şablonu indirin:
                    <a
                      href="/api/cafeteria/menus/template"
                      className="ml-1.5 inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-blue-600"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Şablonu İndir
                    </a>
                  </li>
                  <li>
                    Şablondaki <strong>&quot;Menüler&quot;</strong> sekmesini doldurun. Her satır bir gün + öğündür
                    (kahvaltı / öğle / akşam). Nasıl doldurulacağını <strong>&quot;Örnek Doldurulmuş&quot;</strong>{' '}
                    sekmesinden görebilirsiniz.
                  </li>
                  <li>Doldurduğunuz dosyayı aşağıya yükleyip &quot;İçe Aktar&quot; butonuna basın.</li>
                </ol>
              </div>

              {importResult ? (
                /* ---- Sonuç Görünümü ---- */
                <div className="space-y-4">
                  <div
                    className={`flex items-start gap-3 p-4 rounded-xl border ${
                      importResult.summary.created + importResult.summary.updated > 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {importResult.summary.created + importResult.summary.updated > 0 ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium">{importResult.message}</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                      <p className="text-lg font-bold text-slate-900">{importResult.summary.total}</p>
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Toplam Satır</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-emerald-700">{importResult.summary.created}</p>
                      <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">Yeni</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-blue-700">{importResult.summary.updated}</p>
                      <p className="text-[11px] font-medium text-blue-600 uppercase tracking-wider">Güncellenen</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">{importResult.summary.skipped}</p>
                      <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">Atlanan</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-red-700">{importResult.summary.invalid}</p>
                      <p className="text-[11px] font-medium text-red-600 uppercase tracking-wider">Hatalı Satır</p>
                    </div>
                  </div>

                  {importResult.issues.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Atlamış Satırlar
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {importResult.issues.map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 px-3 py-2 text-xs">
                            <span className="font-mono bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 shrink-0">
                              Satır {issue.row}
                            </span>
                            <span className="font-medium text-slate-700 shrink-0">{issue.label}</span>
                            <span className="text-slate-500">{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ---- Dosya Seçme ---- */
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => pickImportFile(e.target.files?.[0] || null)}
                  />
                  <div
                    onClick={() => !importing && fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      if (!importing) pickImportFile(e.dataTransfer.files?.[0] || null);
                    }}
                    className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                      dragOver
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                  >
                    {importFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileUp className="w-8 h-8 text-emerald-600" />
                        <p className="text-sm font-semibold text-slate-800 break-all">{importFile.name}</p>
                        <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pickImportFile(null);
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                        >
                          Dosyayı kaldır
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <UploadCloud className="w-10 h-10 text-slate-300" />
                        <p className="text-sm font-medium text-slate-700">
                          Excel dosyasını buraya sürükleyin veya tıklayıp seçin
                        </p>
                        <p className="text-xs text-slate-400">.xlsx / .xls — en fazla {MAX_IMPORT_FILE_MB} MB</p>
                      </div>
                    )}
                  </div>

                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      disabled={importing}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium text-slate-800">Mevcut kayıtların üzerine yaz</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        İşaretlenmezse sistemde zaten kayıtlı gün + öğünler atlanır. İşaretlenirse menü içeriği,
                        planlanan kişi ve porsiyon maliyeti güncellenir; gerçekleşen kişi, üretim, tüketim ve fire
                        verileri korunur.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {importError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              {importResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => pickImportFile(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
                  >
                    Yeni Dosya Yükle
                  </button>
                  <button
                    type="button"
                    onClick={closeImportModal}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors"
                  >
                    Kapat
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={closeImportModal}
                    disabled={importing}
                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    disabled={!importFile || importing}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    {importing ? 'Aktarılıyor...' : 'İçe Aktar'}
                  </button>
                </>
              )}
            </div>
          </div>
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

              {/* Üretim & Maliyet (üretim/sevkiyat gerçekleştikten sonra doldurulur) */}
              <div className="space-y-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-500" />
                  Üretim & Maliyet (Opsiyonel)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Üretim (kg)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Örn: 120"
                      value={menuFormData.produced_kg}
                      onChange={(e) => setMenuFormData({ ...menuFormData, produced_kg: e.target.value })}
                      className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Tüketim (kg)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Örn: 105"
                      value={menuFormData.consumed_kg}
                      onChange={(e) => setMenuFormData({ ...menuFormData, consumed_kg: e.target.value })}
                      className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Fire / Zayiat (kg)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Örn: 8"
                      value={menuFormData.waste_kg}
                      onChange={(e) => setMenuFormData({ ...menuFormData, waste_kg: e.target.value })}
                      className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Porsiyon Maliyeti (₺)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Örn: 45"
                      value={menuFormData.unit_cost}
                      onChange={(e) => setMenuFormData({ ...menuFormData, unit_cost: e.target.value })}
                      className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                {(menuFormData.produced_kg.trim() || menuFormData.consumed_kg.trim() || menuFormData.waste_kg.trim()) && (
                  <p className="text-[11px] text-slate-500">
                    Kalan (stok) ≈ <span className="font-semibold text-slate-700">{fmtNum(modalKalan)} kg</span>
                    {modalFireRatio != null && (
                      <>
                        {' '}
                        · Fire oranı{' '}
                        <span className={`font-semibold ${modalFireRatio > 10 ? 'text-rose-600' : 'text-slate-700'}`}>
                          %{fmtNum(modalFireRatio)}
                        </span>
                      </>
                    )}
                  </p>
                )}
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
