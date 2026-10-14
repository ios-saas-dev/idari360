'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  ShieldCheck,
  ClipboardList,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Eye,
  X,
  Loader2,
  Calendar,
  Building2,
  User,
  TrendingUp,
  Play,
  ArrowRight,
} from 'lucide-react';

interface AuditItem {
  id: string;
  title: string;
  module?: 'catering' | 'shuttle' | 'cleaning' | 'security' | string;
  audit_type?: { id: string; name: string; module: string };
  facility?: { id: string; name: string; city: string };
  facility_name?: string;
  facility_city?: string;
  auditor?: { id: string; full_name: string };
  auditor_name?: string;
  audit_date?: string;
  score?: number | null;
  total_score?: number | null;
  percentage?: number | null;
  status: 'draft' | 'in_progress' | 'completed' | 'approved' | string;
  notes?: string;
}

export default function AuditsPage() {
  const router = useRouter();
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [auditTypes, setAuditTypes] = useState<Array<{ id: string; name: string; module: string }>>([]);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; city: string }>>([]);
  
  // Filters
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Detail Modal
  const [selectedAudit, setSelectedAudit] = useState<AuditItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    audit_type_id: '',
    facility_id: '',
    audit_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadMeta() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, company_id, facility_id')
            .eq('id', user.id)
            .single();
          if (profile) {
            setUserRole(profile.role);
          }
        }

        // Load audit types
        const { data: types } = await supabase
          .from('audit_types')
          .select('id, name, module')
          .order('name');
        if (types && types.length > 0) {
          setAuditTypes(types);
          setFormData((prev) => ({
            ...prev,
            audit_type_id: types[0].id,
            title: `${types[0].name} - ${new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}`,
          }));
        }

        // Load facilities
        const { data: facs } = await supabase
          .from('facilities')
          .select('id, name, city')
          .order('name');
        if (facs && facs.length > 0) {
          setFacilities(facs);
          setFormData((prev) => ({ ...prev, facility_id: facs[0].id }));
        }
      } catch (err) {
        console.error('Meta veriler alınamadı:', err);
      }
    }

    loadMeta();
    fetchAudits();
  }, []);

  async function fetchAudits() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audits');
      if (res.ok) {
        const json = await res.json();
        const mapped = (json.data || []).map((a: any) => ({
          ...a,
          module: a.audit_type?.module || a.module || 'catering',
          facility_name: a.facility?.name || a.facility_name,
          facility_city: a.facility?.city || a.facility_city,
          auditor_name: a.auditor?.full_name || a.auditor_name,
          score: a.total_score ?? a.percentage ?? a.score,
        }));
        setAudits(mapped);
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setAudits([]);
        } else {
          throw new Error(errJson.error || 'Denetim kayıtları alınamadı.');
        }
      }
    } catch (err: any) {
      console.warn('Fetch audits warning:', err);
      setError(err.message || 'Denetim kayıtları alınırken bir hata meydana geldi.');
    } finally {
      setLoading(false);
    }
  }

  // Permissions: Managers and officers can create audits
  const canCreate = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'].includes(userRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.audit_type_id) {
      setModalError('Lütfen bir denetim türü seçiniz.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          audit_type_id: formData.audit_type_id,
          facility_id: formData.facility_id || null,
          audit_date: formData.audit_date,
          notes: formData.notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Denetim başlatılamadı.');
      }

      const json = await res.json();
      setIsModalOpen(false);

      if (json.data?.id) {
        router.push(`/dashboard/audits/${json.data.id}`);
      } else {
        await fetchAudits();
      }
    } catch (err: any) {
      setModalError(err.message || 'Denetim oluşturulurken bir sorun oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for module translation
  const getModuleBadge = (mod: string) => {
    const m = (mod || '').toLowerCase();
    switch (m) {
      case 'catering':
      case 'yemekhane':
        return { label: 'Yemekhane', bg: 'bg-orange-50 text-orange-700 border-orange-200/80' };
      case 'shuttle':
      case 'servis':
        return { label: 'Servis', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80' };
      case 'cleaning':
      case 'temizlik':
        return { label: 'Temizlik', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' };
      case 'security':
      case 'guvenlik':
      case 'güvenlik':
        return { label: 'Güvenlik', bg: 'bg-blue-50 text-blue-700 border-blue-200/80' };
      default:
        return { label: mod || 'Genel', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  // Helper for status badge
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'draft':
      case 'taslak':
        return {
          label: 'Taslak',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
      case 'in_progress':
      case 'devam_ediyor':
        return {
          label: 'Devam Ediyor',
          bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
          dot: 'bg-amber-500',
        };
      case 'completed':
      case 'tamamlandi':
      case 'tamamlandı':
        return {
          label: 'Tamamlandı',
          bg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          dot: 'bg-blue-500',
        };
      case 'approved':
      case 'onaylandi':
      case 'onaylandı':
        return {
          label: 'Onaylandı',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          dot: 'bg-emerald-500',
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
    }
  };

  // Filters logic
  const filteredAudits = audits.filter((item) => {
    const mod = (item.module || '').toLowerCase();
    const st = (item.status || '').toLowerCase();

    // Module check
    if (selectedModule !== 'all') {
      const match =
        (selectedModule === 'catering' && (mod === 'catering' || mod === 'yemekhane')) ||
        (selectedModule === 'shuttle' && (mod === 'shuttle' || mod === 'servis')) ||
        (selectedModule === 'cleaning' && (mod === 'cleaning' || mod === 'temizlik')) ||
        (selectedModule === 'security' && (mod === 'security' || mod === 'guvenlik' || mod === 'güvenlik'));
      if (!match) return false;
    }

    // Status check
    if (selectedStatus !== 'all') {
      const matchStatus =
        (selectedStatus === 'draft' && (st === 'draft' || st === 'taslak')) ||
        (selectedStatus === 'in_progress' && (st === 'in_progress' || st === 'devam_ediyor')) ||
        (selectedStatus === 'completed' && (st === 'completed' || st === 'tamamlandi' || st === 'tamamlandı')) ||
        (selectedStatus === 'approved' && (st === 'approved' || st === 'onaylandi' || st === 'onaylandı'));
      if (!matchStatus) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = item.title?.toLowerCase().includes(q);
      const auditorMatch = item.auditor_name?.toLowerCase().includes(q);
      const facilityMatch = item.facility_name?.toLowerCase().includes(q);
      if (!titleMatch && !auditorMatch && !facilityMatch) return false;
    }

    return true;
  });

  // Calculate statistics
  const totalAudits = audits.length;
  const completedAudits = audits.filter(
    (a) => a.status === 'completed' || a.status === 'tamamlandi' || a.status === 'approved' || a.status === 'onaylandi'
  ).length;
  const draftAudits = audits.filter((a) => a.status === 'draft' || a.status === 'taslak').length;
  
  const scoredAudits = audits.filter((a) => typeof a.score === 'number' && a.score !== null);
  const avgScore =
    scoredAudits.length > 0
      ? Math.round(scoredAudits.reduce((acc, curr) => acc + (curr.score || 0), 0) / scoredAudits.length)
      : 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Denetim & Kontrol Merkezi
            </h1>
            <p className="text-sm text-slate-500">
              Yemekhane, servis, temizlik ve güvenlik operasyonlarının dijital saha denetimleri
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Yeni Denetim Başlat
          </button>
        )}
      </div>

      {/* Stats Row (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Toplam Denetim
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalAudits}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Tamamlanan Denetim
            </p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{completedAudits}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Ortalama Puan
            </p>
            <h3 className="text-2xl font-bold text-blue-600 mt-1">%{avgScore}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Taslak Denetimler
            </p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{draftAudits}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
        {/* Module Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Modül:
          </span>
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'catering', label: 'Yemekhane' },
            { key: 'shuttle', label: 'Servis' },
            { key: 'cleaning', label: 'Temizlik' },
            { key: 'security', label: 'Güvenlik' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedModule(tab.key)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-colors ${
                selectedModule === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Durum:
            </span>
            {[
              { key: 'all', label: 'Tümü' },
              { key: 'draft', label: 'Taslak' },
              { key: 'in_progress', label: 'Devam Ediyor' },
              { key: 'completed', label: 'Tamamlandı' },
              { key: 'approved', label: 'Onaylandı' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${
                  selectedStatus === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Denetim veya denetçi ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Main Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Denetimler yükleniyor...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-rose-50/50">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="font-semibold text-rose-800 text-sm">{error}</p>
            <button
              onClick={fetchAudits}
              className="mt-3 px-3.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-medium hover:bg-rose-700"
            >
              Tekrar Dene
            </button>
          </div>
        ) : filteredAudits.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Denetim Kaydı Bulunamadı</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Seçili filtrelere uygun denetim bulunmuyor. Yeni bir denetim başlatabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Denetim Türü / Başlık</th>
                  <th className="py-3.5 px-4">Modül</th>
                  <th className="py-3.5 px-4">Tesis & Şehir</th>
                  <th className="py-3.5 px-4">Denetçi</th>
                  <th className="py-3.5 px-4">Tarih</th>
                  <th className="py-3.5 px-4">Puan</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAudits.map((item) => {
                  const modBadge = getModuleBadge(item.module || 'catering');
                  const stBadge = getStatusBadge(item.status);
                  const score = item.score ?? 0;

                    return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <Link
                          href={`/dashboard/audits/${item.id}`}
                          className="hover:text-blue-600 transition-colors flex items-center gap-1.5 group"
                        >
                          <span>{item.title}</span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium border ${modBadge.bg}`}
                        >
                          {modBadge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {item.facility_name || 'Ana Tesis'}{' '}
                            {item.facility_city ? `(${item.facility_city})` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.auditor_name || 'Atanmadı'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(item.audit_date)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.score !== null && item.score !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 80
                                    ? 'bg-emerald-500'
                                    : score >= 60
                                    ? 'bg-blue-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-700">
                              %{score}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${stBadge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stBadge.dot}`} />
                          {stBadge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/audits/${item.id}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                              item.status === 'completed' || item.status === 'approved'
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            }`}
                          >
                            {item.status === 'completed' || item.status === 'approved' ? (
                              <>
                                <FileText className="w-3.5 h-3.5" />
                                <span>Rapor & İncele</span>
                              </>
                            ) : (
                              <>
                                <ClipboardList className="w-3.5 h-3.5" />
                                <span>Denetime Başla</span>
                              </>
                            )}
                          </Link>
                          <button
                            onClick={() => setSelectedAudit(item)}
                            title="Hızlı Önizleme"
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* '+ Yeni Denetim Başlat' Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">Yeni Denetim Başlat</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Denetim Türü */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Denetim Türü / Modülü <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.audit_type_id}
                  onChange={(e) => {
                    const chosen = auditTypes.find((t) => t.id === e.target.value);
                    setFormData({
                      ...formData,
                      audit_type_id: e.target.value,
                      title: chosen
                        ? `${chosen.name} - ${new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}`
                        : formData.title,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
                >
                  {auditTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (100 Puan)
                    </option>
                  ))}
                </select>
              </div>

              {/* Tesis & Lokasyon */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Denetlenecek Tesis / Lokasyon <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.facility_id}
                  onChange={(e) => setFormData({ ...formData, facility_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
                >
                  {facilities.length > 0 ? (
                    facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.city ? `(${f.city})` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">Varsayılan Merkez Tesis</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Denetim Başlığı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ekim 2026 Yemekhane Yerinde Üretim Denetimi"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Denetim Tarihi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.audit_date}
                  onChange={(e) => setFormData({ ...formData, audit_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notlar / Açıklama (İsteğe Bağlı)
                </label>
                <textarea
                  rows={2}
                  placeholder="Denetim kapsamı veya ön talimatlar..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm shadow-blue-500/20"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Denetimi Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">Denetim Detayı</h3>
              </div>
              <button
                onClick={() => setSelectedAudit(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-lg font-bold text-slate-900">{selectedAudit.title}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium border ${
                      getModuleBadge(selectedAudit.module || 'catering').bg
                    }`}
                  >
                    {getModuleBadge(selectedAudit.module || 'catering').label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      getStatusBadge(selectedAudit.status || 'draft').bg
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        getStatusBadge(selectedAudit.status || 'draft').dot
                      }`}
                    />
                    {getStatusBadge(selectedAudit.status || 'draft').label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium">Tesis & Şehir</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {selectedAudit.facility_name || 'Ana Tesis'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium">Denetçi</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {selectedAudit.auditor_name || 'Belirtilmedi'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium">Denetim Tarihi</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {formatDate(selectedAudit.audit_date)}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium">Başarı Puanı</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {selectedAudit.score !== null && selectedAudit.score !== undefined
                      ? `%${selectedAudit.score}`
                      : 'Değerlendirilmedi'}
                  </p>
                </div>
              </div>

              {selectedAudit.notes && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Notlar
                  </p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-line">
                    {selectedAudit.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedAudit(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium text-sm rounded-xl hover:bg-slate-100 transition-colors"
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
