'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  User,
  Package,
  Plus,
  Edit2,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  AlertCircle,
  Check,
  Calendar,
  MapPin,
  Ban,
  CalendarClock,
  Camera,
  ShieldCheck,
} from 'lucide-react';
import PhotoEvidenceUploader from '@/components/photo-evidence-uploader';

interface Facility {
  id: string;
  name: string;
}

interface CleaningStaff {
  id: string;
  company_id: string;
  facility_id?: string | null;
  full_name: string;
  position: string;
  is_active: boolean;
  supervisor_id?: string | null;
  facility?: Facility | null;
  created_at?: string;
}

interface CleaningEquipment {
  id: string;
  company_id: string;
  facility_id?: string | null;
  name: string;
  type: string;
  brand?: string | null;
  model?: string | null;
  quantity: number;
  condition: string;
  location?: string | null;
  facility?: Facility | null;
  created_at?: string;
}

/** ATS — Planlı temizlik kaydı */
interface CleaningPlan {
  id: string;
  company_id: string;
  facility_id: string;
  title: string;
  area?: string | null;
  planned_date: string;
  status: 'oneri' | 'onaylandi' | 'tamamlandi' | 'iptal';
  notes?: string | null;
  completion_note?: string | null;
  photo_urls?: string[] | null;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  created_at: string;
  facility?: Facility | null;
  creator?: { full_name?: string | null } | null;
  approver?: { full_name?: string | null } | null;
  completer?: { full_name?: string | null } | null;
}

const EQUIPMENT_TYPES = [
  'Makine',
  'Araç',
  'Malzeme',
  'İlaçlama Ekipmanı',
  'Kokulandırma Cihazı',
  'Diğer',
];
const EQUIPMENT_CONDITIONS = ['İyi', 'Orta', 'Kötü'];

/** Ekipman türüne göre rozet rengi (ilaçlama/kokulandırma özel sınıflandırılır) */
function getEquipmentTypeBadgeClass(type?: string | null): string {
  if (type === 'İlaçlama Ekipmanı') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (type === 'Kokulandırma Cihazı') return 'bg-pink-50 text-pink-700 border-pink-200';
  if (type === 'Makine') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (type === 'Araç') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (type === 'Malzeme') return 'bg-teal-50 text-teal-700 border-teal-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

/** ATS plan durumu rozeti */
const PLAN_STATUS_META: Record<
  CleaningPlan['status'],
  { label: string; badgeClass: string; dotClass: string }
> = {
  oneri: {
    label: 'Onay Bekliyor',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  onaylandi: {
    label: 'Planlandı',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  tamamlandi: {
    label: 'Tamamlandı',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  iptal: {
    label: 'İptal',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
    dotClass: 'bg-slate-400',
  },
};

/** YYYY-MM-DD → "17 Ekim 2026" */
function formatDateTR(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00+03:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}


function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CleaningPage() {
  const [activeTab, setActiveTab] = useState<'staff' | 'equipment' | 'plans'>('staff');
  const [userRole, setUserRole] = useState<string>('');

  // Staff state
  const [staffList, setStaffList] = useState<CleaningStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');

  // Equipment state
  const [equipmentList, setEquipmentList] = useState<CleaningEquipment[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [equipmentSearch, setEquipmentSearch] = useState('');

  // ATS — Planlı temizlik state
  const [plansList, setPlansList] = useState<CleaningPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [plansFilter, setPlansFilter] = useState<'all' | CleaningPlan['status']>('all');

  // Staff Modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<CleaningStaff | null>(null);
  const [staffFormData, setStaffFormData] = useState({
    full_name: '',
    position: 'Temizlik Görevlisi',
    is_active: true,
    supervisor_id: '',
  });

  // ATS modalları
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planFormData, setPlanFormData] = useState({
    title: '',
    area: '',
    planned_date: '',
    notes: '',
  });
  const [planAction, setPlanAction] = useState<{
    type: 'onayla' | 'yeni_tarih' | 'tamamla' | 'iptal';
    plan: CleaningPlan;
  } | null>(null);
  const [planActionNote, setPlanActionNote] = useState('');
  const [planNewDate, setPlanNewDate] = useState('');
  const [planPhotos, setPlanPhotos] = useState<string[]>(['']);
  const [planCompletionNote, setPlanCompletionNote] = useState('');

  // Equipment Modal
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<CleaningEquipment | null>(null);
  const [equipmentFormData, setEquipmentFormData] = useState({
    name: '',
    type: 'Makine',
    brand: '',
    model: '',
    quantity: 1,
    condition: 'İyi',
    location: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null);

  // Fetch Staff
  const fetchStaff = async () => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      const res = await fetch('/api/cleaning/staff');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Personel verisi alınamadı');
      setStaffList(data.data || []);
    } catch (err: any) {
      setStaffError(err.message || 'Personel listesi yüklenirken bir hata oluştu');
    } finally {
      setStaffLoading(false);
    }
  };

  // Fetch Equipment
  const fetchEquipment = async () => {
    setEquipmentLoading(true);
    setEquipmentError(null);
    try {
      const res = await fetch('/api/cleaning/equipment');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ekipman verisi alınamadı');
      setEquipmentList(data.data || []);
    } catch (err: any) {
      setEquipmentError(err.message || 'Ekipman listesi yüklenirken bir hata oluştu');
    } finally {
      setEquipmentLoading(false);
    }
  };

  // Fetch Plans (ATS)
  const fetchPlans = async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const res = await fetch('/api/cleaning/plans');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Plan verisi alınamadı');
      setPlansList(data.data || []);
      if (data.role) setUserRole(data.role);
    } catch (err: any) {
      setPlansError(err.message || 'Planlı temizlik listesi yüklenirken bir hata oluştu');
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchEquipment();
    fetchPlans();
  }, []);

  // Derin bağlantı: /dashboard/cleaning?plan=<id> ile gelindiyse ATS sekmesi açılır
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('plan')) setActiveTab('plans');
  }, []);

  // Stats
  const totalStaff = staffList.length;
  const activeStaff = useMemo(
    () => staffList.filter((s) => s.is_active !== false).length,
    [staffList]
  );
  const totalEquipmentCount = useMemo(
    () => staffList.length ? equipmentList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : equipmentList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [equipmentList]
  );
  const uniqueEquipmentTypes = useMemo(() => {
    const types = new Set(equipmentList.map((e) => e.type || e.name));
    return types.size;
  }, [equipmentList]);

  // Filtered lists
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return staffList;
    const query = staffSearch.toLowerCase();
    return staffList.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(query) ||
        s.position?.toLowerCase().includes(query) ||
        s.facility?.name?.toLowerCase().includes(query)
    );
  }, [staffList, staffSearch]);

  const filteredEquipment = useMemo(() => {
    if (!equipmentSearch.trim()) return equipmentList;
    const query = equipmentSearch.toLowerCase();
    return equipmentList.filter(
      (e) =>
        e.name?.toLowerCase().includes(query) ||
        e.type?.toLowerCase().includes(query) ||
        e.brand?.toLowerCase().includes(query) ||
        e.model?.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query) ||
        e.facility?.name?.toLowerCase().includes(query)
    );
  }, [equipmentList, equipmentSearch]);

  // ATS — türev veriler
  const pendingPlanCount = useMemo(() => plansList.filter((p) => p.status === 'oneri').length, [plansList]);
  const approvedPlanCount = useMemo(() => plansList.filter((p) => p.status === 'onaylandi').length, [plansList]);
  const completedPlanCount = useMemo(() => plansList.filter((p) => p.status === 'tamamlandi').length, [plansList]);

  const filteredPlans = useMemo(() => {
    const base = plansFilter === 'all' ? plansList : plansList.filter((p) => p.status === plansFilter);
    const order: Record<string, number> = { oneri: 0, onaylandi: 1, tamamlandi: 2, iptal: 3 };
    return [...base].sort((a, b) => {
      const d = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (d !== 0) return d;
      return (b.planned_date || '').localeCompare(a.planned_date || '');
    });
  }, [plansList, plansFilter]);

  const canApprove = ['super_admin', 'company_admin', 'facility_manager'].includes(userRole);
  const canManagePlans = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'].includes(userRole);

  // ATS — yeni tarih önerisi modalı
  const openPlanModal = () => {
    setPlanFormData({
      title: '',
      area: '',
      planned_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      notes: '',
    });
    setIsPlanModalOpen(true);
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/cleaning/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: planFormData.title.trim(),
          area: planFormData.area.trim() || null,
          planned_date: planFormData.planned_date,
          notes: planFormData.notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Plan önerisi kaydedilemedi');
      setIsPlanModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ATS — akış aksiyonu (onayla / yeni tarih / tamamla / iptal)
  const openPlanAction = (type: 'onayla' | 'yeni_tarih' | 'tamamla' | 'iptal', plan: CleaningPlan) => {
    setPlanActionNote('');
    setPlanNewDate(plan.planned_date || '');
    setPlanPhotos(['']);
    setPlanCompletionNote('');
    setPlanAction({ type, plan });
  };

  const handlePlanActionSubmit = async () => {
    if (!planAction) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        intent: planAction.type,
        note: planActionNote.trim(),
      };
      if (planAction.type === 'yeni_tarih') body.planned_date = planNewDate;
      if (planAction.type === 'tamamla') {
        body.photo_urls = planPhotos.filter((u) => u && u.trim());
        body.completion_note = planCompletionNote.trim();
      }
      const res = await fetch(`/api/cleaning/plans/${planAction.plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'İşlem tamamlanamadı');
      setPlanAction(null);
      fetchPlans();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Staff Modal Openers
  const openAddStaffModal = () => {
    setEditingStaff(null);
    setStaffFormData({
      full_name: '',
      position: 'Temizlik Görevlisi',
      is_active: true,
      supervisor_id: '',
    });
    setIsStaffModalOpen(true);
  };

  const openEditStaffModal = (staff: CleaningStaff) => {
    setEditingStaff(staff);
    setStaffFormData({
      full_name: staff.full_name,
      position: staff.position || 'Temizlik Görevlisi',
      is_active: staff.is_active !== false,
      supervisor_id: staff.supervisor_id || '',
    });
    setIsStaffModalOpen(true);
  };

  // Staff Toggle Active
  const handleToggleStaffActive = async (staff: CleaningStaff) => {
    setTogglingStaffId(staff.id);
    const updatedStatus = !staff.is_active;
    try {
      const res = await fetch('/api/cleaning/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staff.id,
          is_active: updatedStatus,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Durum güncellenemedi');
      }
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, is_active: updatedStatus } : s))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingStaffId(null);
    }
  };

  // Staff Submit
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingStaff) {
        const res = await fetch('/api/cleaning/staff', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingStaff.id,
            full_name: staffFormData.full_name.trim(),
            position: staffFormData.position.trim(),
            is_active: staffFormData.is_active,
            supervisor_id: staffFormData.supervisor_id || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Personel güncellenemedi');
      } else {
        const res = await fetch('/api/cleaning/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: staffFormData.full_name.trim(),
            position: staffFormData.position.trim() || 'Temizlik Görevlisi',
            supervisor_id: staffFormData.supervisor_id || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Personel kaydedilemedi');
      }

      setIsStaffModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Equipment Modal Openers
  const openAddEquipmentModal = () => {
    setEditingEquipment(null);
    setEquipmentFormData({
      name: '',
      type: 'Makine',
      brand: '',
      model: '',
      quantity: 1,
      condition: 'İyi',
      location: '',
    });
    setIsEquipmentModalOpen(true);
  };

  const openEditEquipmentModal = (equip: CleaningEquipment) => {
    setEditingEquipment(equip);
    setEquipmentFormData({
      name: equip.name,
      type: equip.type || 'Makine',
      brand: equip.brand || '',
      model: equip.model || '',
      quantity: equip.quantity || 1,
      condition: equip.condition || 'İyi',
      location: equip.location || '',
    });
    setIsEquipmentModalOpen(true);
  };

  // Equipment Submit
  const handleEquipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingEquipment) {
        const res = await fetch('/api/cleaning/equipment', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingEquipment.id,
            name: equipmentFormData.name.trim(),
            type: equipmentFormData.type,
            brand: equipmentFormData.brand.trim() || null,
            model: equipmentFormData.model.trim() || null,
            quantity: Number(equipmentFormData.quantity) || 1,
            condition: equipmentFormData.condition,
            location: equipmentFormData.location.trim() || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Ekipman güncellenemedi');
      } else {
        const res = await fetch('/api/cleaning/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: equipmentFormData.name.trim(),
            type: equipmentFormData.type,
            brand: equipmentFormData.brand.trim() || null,
            model: equipmentFormData.model.trim() || null,
            quantity: Number(equipmentFormData.quantity) || 1,
            condition: equipmentFormData.condition || 'İyi',
            location: equipmentFormData.location.trim() || '',
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Ekipman kaydedilemedi');
      }

      setIsEquipmentModalOpen(false);
      fetchEquipment();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Temizlik Yönetimi</h1>
            <p className="text-sm text-slate-500">
              Tesis temizlik personeli, görev dağılımları ve temizlik ekipmanlarını yönetin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'staff' && (
            <button
              onClick={openAddStaffModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Personel Ekle
            </button>
          )}
          {activeTab === 'equipment' && (
            <button
              onClick={openAddEquipmentModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ekipman Ekle
            </button>
          )}
          {activeTab === 'plans' && canManagePlans && (
            <button
              onClick={openPlanModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tarih Öner
            </button>
          )}
        </div>
      </div>

      {/* Stats Row (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Personel */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Toplam Personel
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalStaff}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <User className="w-6 h-6" />
          </div>
        </div>

        {/* Aktif Personel */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Aktif Personel
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeStaff}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Toplam Ekipman */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Toplam Ekipman
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalEquipmentCount}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Ekipman Çeşidi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ekipman Çeşidi
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{uniqueEquipmentTypes}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('staff')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            Personel
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'equipment'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            Ekipmanlar
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'plans'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            Planlı Temizlik (ATS)
            {pendingPlanCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                {pendingPlanCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: Personel */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Personel veya tesis ara..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Toplam {filteredStaff.length} kayıt listeleniyor
            </div>
          </div>

          {staffError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{staffError}</span>
            </div>
          )}

          {staffLoading ? (
            <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-500 text-sm">Personel yükleniyor...</span>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700 text-base">Henüz personel bulunmuyor</p>
              <p className="text-xs text-slate-400 mt-1">
                {staffSearch ? 'Arama kriterlerinize uygun personel bulunamadı.' : 'Temizlik personeli eklemek için Personel Ekle butonunu kullanabilirsiniz.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="px-6 py-4">Ad Soyad</th>
                      <th className="px-6 py-4">Pozisyon</th>
                      <th className="px-6 py-4">Bağlı Olduğu Kişi</th>
                      <th className="px-6 py-4">Tesis</th>
                      <th className="px-6 py-4">Durum</th>
                      <th className="px-6 py-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {filteredStaff.map((staff) => {
                      const isActive = staff.is_active !== false;
                      const isToggling = togglingStaffId === staff.id;
                      // Organizasyon şeması: bağlı olduğu kişinin adı listeden eşlenir
                      const supervisorName = staff.supervisor_id
                        ? staffList.find((s) => s.id === staff.supervisor_id)?.full_name || null
                        : null;

                      return (
                        <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                {getInitials(staff.full_name)}
                              </div>
                              <span className="font-semibold text-slate-900">{staff.full_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-700 font-medium">
                            {staff.position || 'Temizlik Görevlisi'}
                          </td>
                          <td className="px-6 py-4">
                            {supervisorName ? (
                              <span className="inline-flex items-center gap-1.5 text-slate-700">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                {supervisorName}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {staff.facility?.name || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleStaffActive(staff)}
                              disabled={isToggling}
                              title="Durumu değiştirmek için tıklayın"
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {isToggling ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isActive ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span>{isActive ? 'Aktif' : 'Pasif'}</span>
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => openEditStaffModal(staff)}
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
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Ekipmanlar */}
      {activeTab === 'equipment' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
                placeholder="Ekipman, tür veya marka ara..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Toplam {filteredEquipment.length} ekipman listeleniyor
            </div>
          </div>

          {equipmentError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{equipmentError}</span>
            </div>
          )}

          {equipmentLoading ? (
            <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-500 text-sm">Ekipmanlar yükleniyor...</span>
            </div>
          ) : filteredEquipment.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700 text-base">Henüz ekipman eklenmemiş</p>
              <p className="text-xs text-slate-400 mt-1">
                {equipmentSearch ? 'Arama kriterlerinize uygun ekipman bulunamadı.' : 'Temizlik ekipmanı eklemek için Ekipman Ekle butonunu kullanabilirsiniz.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="px-6 py-4">Ekipman Adı</th>
                      <th className="px-6 py-4">Tür</th>
                      <th className="px-6 py-4">Marka / Model</th>
                      <th className="px-6 py-4">Adet</th>
                      <th className="px-6 py-4">Durum</th>
                      <th className="px-6 py-4">Konum</th>
                      <th className="px-6 py-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {filteredEquipment.map((equip) => {
                      const brandModel = [equip.brand, equip.model].filter(Boolean).join(' ');

                      // Condition badges
                      let conditionBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                      if (equip.condition === 'İyi') {
                        conditionBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      } else if (equip.condition === 'Orta') {
                        conditionBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                      } else if (equip.condition === 'Kötü') {
                        conditionBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                      }

                      return (
                        <tr key={equip.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-900">
                            {equip.name}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEquipmentTypeBadgeClass(equip.type)}`}
                            >
                              {equip.type || 'Diğer'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {brandModel || '-'}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {equip.quantity}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${conditionBadgeClass}`}
                            >
                              {equip.condition || 'İyi'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {equip.location || '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => openEditEquipmentModal(equip)}
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
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Planlı Temizlik (ATS) */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {/* Filtre çipleri */}
          <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            {(
              [
                ['all', 'Tümü', plansList.length],
                ['oneri', 'Onay Bekleyen', pendingPlanCount],
                ['onaylandi', 'Planlandı', approvedPlanCount],
                ['tamamlandi', 'Tamamlandı', completedPlanCount],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setPlansFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  plansFilter === key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {label}
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    plansFilter === key ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
            <div className="ml-auto text-xs text-slate-400 font-medium hidden sm:block">
              Firma tarih önerir → şube onaylar → temizlik fotoğrafla tamamlanır
            </div>
          </div>

          {plansError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{plansError}</span>
            </div>
          )}

          {plansLoading ? (
            <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-500 text-sm">Planlı temizlikler yükleniyor...</span>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <CalendarClock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700 text-base">Planlı temizlik kaydı bulunmuyor</p>
              <p className="text-xs text-slate-400 mt-1">
                {plansFilter !== 'all'
                  ? 'Seçili durumda plan bulunamadı.'
                  : 'Temizlik firması "Tarih Öner" butonuyla yeni bir plan önerisi oluşturabilir.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredPlans.map((plan) => {
                const meta = PLAN_STATUS_META[plan.status];
                const photos = (plan.photo_urls || []).filter(Boolean);
                const hasActions =
                  (plan.status === 'oneri' && canApprove) ||
                  (plan.status === 'onaylandi' && canManagePlans);

                return (
                  <div
                    key={plan.id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                            {meta.label}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {plan.facility?.name || ''}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 mt-2 truncate">{plan.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDateTR(plan.planned_date)}
                          </span>
                          {plan.area && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {plan.area}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-50 text-slate-500 rounded-xl shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                    </div>

                    {plan.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 leading-relaxed">
                        {plan.notes}
                      </p>
                    )}

                    {plan.status === 'tamamlandi' && plan.completion_note && (
                      <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 leading-relaxed">
                        <span className="font-semibold">Tamamlama notu: </span>
                        {plan.completion_note}
                      </p>
                    )}

                    {photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {photos.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Fotoğrafı büyüt"
                            className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:border-blue-400 transition-colors"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Temizlik fotoğrafı ${i + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      {plan.creator?.full_name && <span>Öneren: {plan.creator.full_name}</span>}
                      {plan.approved_at && (
                        <span>
                          Onaylayan: {plan.approver?.full_name || '—'} · {formatDateTR(plan.approved_at)}
                        </span>
                      )}
                      {plan.completed_at && (
                        <span>
                          Tamamlayan: {plan.completer?.full_name || '—'} · {formatDateTR(plan.completed_at)}
                        </span>
                      )}
                    </div>

                    {hasActions && (
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        {plan.status === 'oneri' && canApprove && (
                          <>
                            <button
                              onClick={() => openPlanAction('onayla', plan)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Onayla
                            </button>
                            <button
                              onClick={() => openPlanAction('yeni_tarih', plan)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              Yeni Tarih Öner
                            </button>
                            <button
                              onClick={() => openPlanAction('iptal', plan)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              İptal
                            </button>
                          </>
                        )}
                        {plan.status === 'onaylandi' && canManagePlans && (
                          <>
                            <button
                              onClick={() => openPlanAction('tamamla', plan)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              Tamamla (Fotoğraflı)
                            </button>
                            {canApprove && (
                              <button
                                onClick={() => openPlanAction('iptal', plan)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                İptal
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Personel Ekle / Düzenle */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                {editingStaff ? 'Personel Düzenle' : 'Yeni Personel Ekle'}
              </h3>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStaffSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ad Soyad <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Yılmaz"
                  value={staffFormData.full_name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, full_name: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pozisyon
                </label>
                <input
                  type="text"
                  placeholder="Örn: Temizlik Görevlisi"
                  value={staffFormData.position}
                  onChange={(e) => setStaffFormData({ ...staffFormData, position: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bağlı Olduğu Kişi <span className="text-slate-400 font-normal">(Organizasyon Şeması)</span>
                </label>
                <select
                  value={staffFormData.supervisor_id}
                  onChange={(e) => setStaffFormData({ ...staffFormData, supervisor_id: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">— Bağımsız (üst yönetime bağlı) —</option>
                  {staffList
                    .filter((s) => s.id !== editingStaff?.id && s.is_active !== false)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                        {s.position ? ` — ${s.position}` : ''}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Şef → görevli bağlantısı bu alanla kurulur; personel listesinde görünür.
                </p>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setStaffFormData({ ...staffFormData, is_active: !staffFormData.is_active })}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                      staffFormData.is_active ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        staffFormData.is_active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    {staffFormData.is_active ? 'Personel Aktif' : 'Personel Pasif'}
                  </span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingStaff ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ekipman Ekle / Düzenle */}
      {isEquipmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                {editingEquipment ? 'Ekipman Düzenle' : 'Yeni Ekipman Ekle'}
              </h3>
              <button
                onClick={() => setIsEquipmentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEquipmentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ekipman Adı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Zemin Yıkama Makinesi"
                  value={equipmentFormData.name}
                  onChange={(e) => setEquipmentFormData({ ...equipmentFormData, name: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tür
                  </label>
                  <select
                    value={equipmentFormData.type}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, type: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    {EQUIPMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adet
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={equipmentFormData.quantity}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Marka
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Kärcher"
                    value={equipmentFormData.brand}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, brand: e.target.value })}
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: BR 40/10 C"
                    value={equipmentFormData.model}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, model: e.target.value })}
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Durum
                  </label>
                  <select
                    value={equipmentFormData.condition}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, condition: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    {EQUIPMENT_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Konum
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: B Blok Depo"
                    value={equipmentFormData.location}
                    onChange={(e) => setEquipmentFormData({ ...equipmentFormData, location: e.target.value })}
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEquipmentModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingEquipment ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATS — Tarih Öner */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-blue-600" />
                Planlı Temizlik — Tarih Öner
              </h3>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Temizlik Konusu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Halı yıkama ve derin temizlik"
                  value={planFormData.title}
                  onChange={(e) => setPlanFormData({ ...planFormData, title: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alan / Lokasyon
                </label>
                <input
                  type="text"
                  placeholder="Örn: B Blok ofis katları"
                  value={planFormData.area}
                  onChange={(e) => setPlanFormData({ ...planFormData, area: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Önerilen Tarih <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={planFormData.planned_date}
                  onChange={(e) => setPlanFormData({ ...planFormData, planned_date: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Onay için şube yöneticisine bildirim gönderilir.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Not</label>
                <textarea
                  rows={3}
                  placeholder="Örn: Operasyon saatleri dışında yapılması planlanıyor..."
                  value={planFormData.notes}
                  onChange={(e) => setPlanFormData({ ...planFormData, notes: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Öneri Gönder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATS — Akış Aksiyonu (Onayla / Yeni Tarih / Tamamla / İptal) */}
      {planAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {planAction.type === 'onayla' && <><CheckCircle2 className="w-5 h-5 text-emerald-600" />Planı Onayla</>}
                {planAction.type === 'yeni_tarih' && <><CalendarClock className="w-5 h-5 text-blue-600" />Yeni Tarih Öner</>}
                {planAction.type === 'tamamla' && <><Camera className="w-5 h-5 text-emerald-600" />Temizliği Tamamla</>}
                {planAction.type === 'iptal' && <><Ban className="w-5 h-5 text-rose-600" />Planı İptal Et</>}
              </h3>
              <button
                onClick={() => setPlanAction(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan özeti */}
            <div className="mt-4 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="font-semibold text-slate-900 text-sm">{planAction.plan.title}</p>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateTR(planAction.plan.planned_date)}
                </span>
                {planAction.plan.area && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {planAction.plan.area}
                  </span>
                )}
                <span>{planAction.plan.facility?.name}</span>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {planAction.type === 'onayla' && (
                <p className="text-sm text-slate-600 leading-relaxed">
                  Plan kesinleşecek ve öneri sahibine onay bilgisi gönderilecek. Tarih uygun değilse
                  &quot;Yeni Tarih Öner&quot; seçeneğini kullanabilirsiniz.
                </p>
              )}

              {planAction.type === 'yeni_tarih' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Yeni Tarih <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={planNewDate}
                    onChange={(e) => setPlanNewDate(e.target.value)}
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Firma yeni tarih önerisini görür ve onay süreci yeniden başlar.
                  </p>
                </div>
              )}

              {planAction.type === 'tamamla' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tamamlama Fotoğrafları <span className="text-rose-500">*</span>{' '}
                      <span className="text-slate-400 font-normal">(en az 1)</span>
                    </label>
                    <div className="space-y-3">
                      {planPhotos.map((url, i) => (
                        <PhotoEvidenceUploader
                          key={i}
                          context="cleaning"
                          cleaningPlanId={planAction.plan.id}
                          currentUrl={url || null}
                          helperText="Temizlik sonrası alanın fotoğrafı • JPG, PNG, WEBP • en fazla 10 MB"
                          onChange={(newUrl) => {
                            setPlanPhotos((prev) => {
                              if (!newUrl) return prev.filter((_, idx) => idx !== i);
                              return prev.map((p, idx) => (idx === i ? newUrl : p));
                            });
                          }}
                        />
                      ))}
                    </div>
                    {planPhotos.filter(Boolean).length < 5 &&
                      planPhotos.every((u) => u) && (
                        <button
                          type="button"
                          onClick={() => setPlanPhotos((prev) => [...prev, ''])}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Fotoğraf Ekle
                        </button>
                      )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tamamlama Notu
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Örn: Tüm alanlar temizlendi, sarf malzemeler tamamlandı..."
                      value={planCompletionNote}
                      onChange={(e) => setPlanCompletionNote(e.target.value)}
                      className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {planAction.type === 'iptal' && (
                <p className="text-sm text-slate-600 leading-relaxed">
                  Plan iptal edilecek ve öneri sahibine bilgi gönderilecek. İptal edilen planlar
                  listede &quot;İptal&quot; durumuyla kalır.
                </p>
              )}

              {planAction.type !== 'yeni_tarih' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {planAction.type === 'tamamla' ? 'Ek Not' : 'Not / Gerekçe'}{' '}
                    <span className="text-slate-400 font-normal">(opsiyonel)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder={
                      planAction.type === 'onayla'
                        ? 'Örn: Uygun, operasyon saatleri dışında yapılacak...'
                        : planAction.type === 'tamamla'
                          ? 'Ek açıklama...'
                          : 'İptal gerekçesi...'
                    }
                    value={planActionNote}
                    onChange={(e) => setPlanActionNote(e.target.value)}
                    className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPlanAction(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handlePlanActionSubmit}
                disabled={
                  submitting ||
                  (planAction.type === 'yeni_tarih' && !planNewDate) ||
                  (planAction.type === 'tamamla' && planPhotos.filter(Boolean).length === 0)
                }
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl shadow-sm transition-colors disabled:opacity-50 ${
                  planAction.type === 'iptal'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : planAction.type === 'yeni_tarih'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {planAction.type === 'onayla' && 'Onayla'}
                {planAction.type === 'yeni_tarih' && 'Tarihi Öner'}
                {planAction.type === 'tamamla' && 'Tamamlandı Olarak İşaretle'}
                {planAction.type === 'iptal' && 'Planı İptal Et'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
