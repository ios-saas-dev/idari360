'use client';

import React, { useEffect, useState } from 'react';
import {
  Star,
  Award,
  TrendingUp,
  Plus,
  Building2,
  Calendar,
  Loader2,
  X,
  History,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

interface SupplierScore {
  id: string;
  overall_score: number;
  period_start: string;
  period_end: string;
  created_at: string;
  service_quality?: number;
  timeliness?: number;
  complaint_management?: number;
  staff_suitability?: number;
  audit_results?: number;
  action_closure?: number;
  scorer?: { id: string; full_name: string };
}

interface Supplier {
  id: string;
  company_id: string;
  name: string;
  service_type: string;
  contact_info: {
    phone?: string;
    email?: string;
    notes?: string;
  };
  contract_start: string | null;
  contract_end: string | null;
  created_at: string;
  supplier_scores?: SupplierScore[];
}

const SERVICE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  yemekhane: { label: 'Yemekhane', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  servis: { label: 'Personel Servisi', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  temizlik: { label: 'Temizlik', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  teknik: { label: 'Teknik Bakım', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  guvenlik: { label: 'Güvenlik', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  diger: { label: 'Diğer Hizmetler', color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('employee');

  // Modals state
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddScoreOpen, setIsAddScoreOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [historyScores, setHistoryScores] = useState<SupplierScore[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form states - Add Supplier
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    service_type: 'yemekhane',
    phone: '',
    email: '',
    notes: '',
    contract_start: '',
    contract_end: '',
  });
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Form states - Add Score
  const [newScore, setNewScore] = useState({
    period_start: '',
    period_end: '',
    service_quality: 8,
    timeliness: 8,
    complaint_management: 8,
    staff_suitability: 8,
    audit_results: 8,
    action_closure: 8,
  });
  const [submittingScore, setSubmittingScore] = useState(false);

  const canManage = ['super_admin', 'company_admin', 'facility_manager'].includes(userRole);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/suppliers');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Tedarikçiler yüklenirken bir sorun oluştu');
      }
      setSuppliers(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile?.role) {
          setUserRole(profile.role);
        }
      }
    } catch (err) {
      console.error('Kullanıcı rolü alınamadı:', err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchUserProfile();
  }, []);

  const handleOpenAddScore = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    const today = new Date().toISOString().split('T')[0];
    const pastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setNewScore({
      period_start: pastMonth,
      period_end: today,
      service_quality: 8,
      timeliness: 8,
      complaint_management: 8,
      staff_suitability: 8,
      audit_results: 8,
      action_closure: 8,
    });
    setIsAddScoreOpen(true);
  };

  const handleOpenHistory = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/scores`);
      const json = await res.json();
      if (res.ok) {
        setHistoryScores(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;

    try {
      setSubmittingSupplier(true);
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplier.name,
          service_type: newSupplier.service_type,
          contact_info: {
            phone: newSupplier.phone,
            email: newSupplier.email,
            notes: newSupplier.notes,
          },
          contract_start: newSupplier.contract_start || null,
          contract_end: newSupplier.contract_end || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tedarikçi eklenemedi');
      setIsAddSupplierOpen(false);
      setNewSupplier({
        name: '',
        service_type: 'yemekhane',
        phone: '',
        email: '',
        notes: '',
        contract_start: '',
        contract_end: '',
      });
      await fetchSuppliers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingSupplier(false);
    }
  };

  const calculateOverallScore = () => {
    const scores = [
      newScore.service_quality,
      newScore.timeliness,
      newScore.complaint_management,
      newScore.staff_suitability,
      newScore.audit_results,
      newScore.action_closure,
    ];
    const sum = scores.reduce((a, b) => a + Number(b), 0);
    return (sum / scores.length).toFixed(1);
  };

  const handleAddScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    try {
      setSubmittingScore(true);
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: newScore.period_start,
          period_end: newScore.period_end,
          service_quality: Number(newScore.service_quality),
          timeliness: Number(newScore.timeliness),
          complaint_management: Number(newScore.complaint_management),
          staff_suitability: Number(newScore.staff_suitability),
          audit_results: Number(newScore.audit_results),
          action_closure: Number(newScore.action_closure),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Puan eklenemedi');
      setIsAddScoreOpen(false);
      await fetchSuppliers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingScore(false);
    }
  };

  // Stats calculation
  const totalSuppliers = suppliers.length;
  const now = new Date();
  const activeContracts = suppliers.filter((s) => {
    if (!s.contract_end) return true;
    return new Date(s.contract_end) >= now;
  }).length;

  const suppliersWithScores = suppliers.filter(
    (s) => s.supplier_scores && s.supplier_scores.length > 0
  );
  const averageOverallScore =
    suppliersWithScores.length > 0
      ? (
          suppliersWithScores.reduce((acc, s) => {
            const latest = s.supplier_scores![s.supplier_scores!.length - 1];
            return acc + (latest.overall_score || 0);
          }, 0) / suppliersWithScores.length
        ).toFixed(1)
      : '0.0';

  const getScoreColor = (score: number) => {
    if (score >= 8) return { text: 'text-emerald-600', stroke: '#059669', bg: 'bg-emerald-500' };
    if (score >= 6) return { text: 'text-amber-500', stroke: '#f59e0b', bg: 'bg-amber-500' };
    return { text: 'text-rose-500', stroke: '#f43f5e', bg: 'bg-rose-500' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
            <Star className="w-6 h-6 fill-blue-500 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tedarikçi Karnesi</h1>
            <p className="text-sm text-slate-500">
              Tedarikçi hizmet kalitesi, dönemsel değerlendirmeler ve sözleşme yönetimi
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => setIsAddSupplierOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Yeni Tedarikçi Ekle
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Toplam Tedarikçi</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalSuppliers}</h3>
            <p className="text-xs text-slate-400 mt-1">Kayıtlı hizmet sağlayıcı</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Aktif Sözleşme</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{activeContracts}</h3>
            <p className="text-xs text-slate-400 mt-1">Yürürlükte olan iş anlaşması</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Ortalama Puan</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{averageOverallScore} / 10</h3>
            <p className="text-xs text-slate-400 mt-1">Değerlendirilen tedarikçiler</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm">Tedarikçi bilgileri yükleniyor...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 rounded-2xl p-6 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-semibold">Veriler yüklenirken hata oluştu</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-sm text-center">
          <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Henüz Tedarikçi Bulunmuyor</h3>
          <p className="text-sm text-slate-500 mt-1">
            Sisteme ilk tedarikçinizi ekleyerek karne ve performans takibine başlayabilirsiniz.
          </p>
          {canManage && (
            <button
              onClick={() => setIsAddSupplierOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Tedarikçi Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {suppliers.map((supplier) => {
            const scoresList = supplier.supplier_scores || [];
            const latestScore = scoresList.length > 0 ? scoresList[scoresList.length - 1] : null;
            const scoreVal = latestScore ? latestScore.overall_score : null;
            const scoreColors = scoreVal !== null ? getScoreColor(scoreVal) : null;
            const badge = SERVICE_TYPE_LABELS[supplier.service_type] || {
              label: supplier.service_type,
              color: 'bg-slate-100 text-slate-700 border-slate-200',
            };

            // SVG gauge variables
            const radius = 38;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset =
              scoreVal !== null ? circumference - (scoreVal / 10) * circumference : circumference;

            return (
              <div
                key={supplier.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {supplier.name}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    {/* Circular Score Gauge */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                      {scoreVal !== null ? (
                        <div className="relative w-20 h-20 flex items-center justify-center">
                          <svg className="w-20 h-20 transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r={radius}
                              stroke="#e2e8f0"
                              strokeWidth="6"
                              fill="transparent"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r={radius}
                              stroke={scoreColors?.stroke}
                              strokeWidth="6"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              fill="transparent"
                              className="transition-all duration-700 ease-out"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-xl font-bold leading-none ${scoreColors?.text}`}>
                              {scoreVal}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">/ 10</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                          <span className="text-xs font-medium text-center">Puan Yok</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contract Dates & Contact */}
                  <div className="py-2.5 border-y border-slate-100 text-xs text-slate-500 space-y-1.5 my-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Sözleşme:{' '}
                        <strong className="text-slate-700 font-medium">
                          {supplier.contract_start ? supplier.contract_start : 'Belirtilmedi'}
                        </strong>{' '}
                        -{' '}
                        <strong className="text-slate-700 font-medium">
                          {supplier.contract_end ? supplier.contract_end : 'Belirtilmedi'}
                        </strong>
                      </span>
                    </div>
                    {supplier.contact_info?.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{supplier.contact_info.phone}</span>
                      </div>
                    )}
                    {supplier.contact_info?.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{supplier.contact_info.email}</span>
                      </div>
                    )}
                  </div>

                  {/* 6 Sub-scores Mini Progress Bars */}
                  {latestScore && (
                    <div className="space-y-2 mt-3">
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                        Alt Kriter Değerlendirmeleri
                      </p>
                      {[
                        { label: 'Hizmet Kalitesi', val: latestScore.service_quality ?? 8 },
                        { label: 'Zamanında Teslimat', val: latestScore.timeliness ?? 8 },
                        { label: 'Şikayet Yönetimi', val: latestScore.complaint_management ?? 8 },
                        { label: 'Personel Uygunluğu', val: latestScore.staff_suitability ?? 8 },
                        { label: 'Denetim Sonuçları', val: latestScore.audit_results ?? 8 },
                        { label: 'Aksiyon Kapama', val: latestScore.action_closure ?? 8 },
                      ].map((item, idx) => {
                        const barColor =
                          item.val >= 8
                            ? 'bg-emerald-500'
                            : item.val >= 6
                            ? 'bg-amber-500'
                            : 'bg-rose-500';
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-600">
                              <span>{item.label}</span>
                              <span className="font-semibold text-slate-700">{item.val}/10</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${(item.val / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenHistory(supplier)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    Geçmiş Puanlar ({scoresList.length})
                  </button>

                  {canManage && (
                    <button
                      onClick={() => handleOpenAddScore(supplier)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Puan Ekle
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Yeni Tedarikçi Ekle */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">Yeni Tedarikçi Ekle</h3>
              <button
                onClick={() => setIsAddSupplierOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplierSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tedarikçi / Firma Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Lezzet Catering Ltd. Şti."
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hizmet Türü *
                </label>
                <select
                  value={newSupplier.service_type}
                  onChange={(e) => setNewSupplier({ ...newSupplier, service_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="yemekhane">Yemekhane</option>
                  <option value="servis">Personel Servisi</option>
                  <option value="temizlik">Temizlik</option>
                  <option value="teknik">Teknik Bakım & Onarım</option>
                  <option value="guvenlik">Güvenlik</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    placeholder="0212 555 0101"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-posta</label>
                  <input
                    type="email"
                    placeholder="info@firma.com"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sözleşme Başlangıç
                  </label>
                  <input
                    type="date"
                    value={newSupplier.contract_start}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, contract_start: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sözleşme Bitiş
                  </label>
                  <input
                    type="date"
                    value={newSupplier.contract_end}
                    onChange={(e) =>
                      setNewSupplier({ ...newSupplier, contract_end: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notlar / İletişim Detayları
                </label>
                <textarea
                  rows={2}
                  placeholder="Yetkili kişi adı, unvanı ve özel notlar..."
                  value={newSupplier.notes}
                  onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submittingSupplier}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {submittingSupplier && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Puan Ekle */}
      {isAddScoreOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800">Tedarikçi Değerlendirme Puanı</h3>
                <p className="text-xs text-slate-500">{selectedSupplier.name}</p>
              </div>
              <button
                onClick={() => setIsAddScoreOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddScoreSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dönem Başlangıç *
                  </label>
                  <input
                    type="date"
                    required
                    value={newScore.period_start}
                    onChange={(e) => setNewScore({ ...newScore, period_start: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dönem Bitiş *
                  </label>
                  <input
                    type="date"
                    required
                    value={newScore.period_end}
                    onChange={(e) => setNewScore({ ...newScore, period_end: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 6 Kriter Puan Girişi */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Alt Kriterler (0 - 10)
                </p>

                {[
                  { key: 'service_quality', label: 'Hizmet Kalitesi' },
                  { key: 'timeliness', label: 'Zamanında Teslimat' },
                  { key: 'complaint_management', label: 'Şikayet Yönetimi' },
                  { key: 'staff_suitability', label: 'Personel Uygunluğu' },
                  { key: 'audit_results', label: 'Denetim Sonuçları' },
                  { key: 'action_closure', label: 'Aksiyon Kapama' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-700 font-medium flex-1">{label}</span>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={(newScore as any)[key]}
                      onChange={(e) =>
                        setNewScore({ ...newScore, [key]: parseFloat(e.target.value) })
                      }
                      className="w-32 accent-blue-600"
                    />
                    <span className="w-8 text-right font-bold text-sm text-blue-600">
                      {(newScore as any)[key]}
                    </span>
                  </div>
                ))}

                {/* Hesaplanmış Ortalama */}
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Hesaplanan Toplam Puan:
                  </span>
                  <span className="text-lg font-extrabold text-blue-600">
                    {calculateOverallScore()} / 10
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddScoreOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submittingScore}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {submittingScore && <Loader2 className="w-4 h-4 animate-spin" />}
                  Puanı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Geçmiş Puanlar */}
      {isHistoryOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800">Puan Değerlendirme Geçmişi</h3>
                <p className="text-xs text-slate-500">{selectedSupplier.name}</p>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {historyLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                  <p className="text-xs">Puanlar yükleniyor...</p>
                </div>
              ) : historyScores.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Award className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Bu tedarikçi için henüz geçmiş puan kaydı yok.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyScores.map((score) => {
                    const colors = getScoreColor(score.overall_score);
                    return (
                      <div
                        key={score.id}
                        className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-slate-700">
                              Dönem: {score.period_start} — {score.period_end}
                            </span>
                            {score.scorer && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Değerlendiren: {score.scorer.full_name}
                              </p>
                            )}
                          </div>
                          <div
                            className={`px-3 py-1 rounded-full text-sm font-bold bg-white border ${colors.text} shadow-sm`}
                          >
                            {score.overall_score} / 10
                          </div>
                        </div>

                        {/* Alt puanlar listesi */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-200">
                          <div>
                            <span className="text-slate-500">Hizmet Kalitesi:</span>{' '}
                            <strong>{score.service_quality ?? '-'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Zamanlama:</span>{' '}
                            <strong>{score.timeliness ?? '-'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Şikayet Yön.:</span>{' '}
                            <strong>{score.complaint_management ?? '-'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Personel Uygun.:</span>{' '}
                            <strong>{score.staff_suitability ?? '-'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Denetim Sonucu:</span>{' '}
                            <strong>{score.audit_results ?? '-'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Aksiyon Kapama:</span>{' '}
                            <strong>{score.action_closure ?? '-'}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 text-sm font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
