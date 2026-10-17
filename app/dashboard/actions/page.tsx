'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  ClipboardCheck,
  User,
  Calendar,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  FileText,
  Eye,
} from 'lucide-react';

interface ActionItem {
  id: string;
  action_number?: string;
  title: string;
  description?: string;
  category: string;
  priority: 'dusuk' | 'orta' | 'yuksek' | 'kritik';
  status: 'acik' | 'devam_ediyor' | 'kapali' | 'gecikti' | 'onay_bekliyor';
  due_date?: string | null;
  facility_id?: string | null;
  created_at: string;
  responsible?: {
    id: string;
    full_name: string;
    email?: string;
  } | null;
  creator?: {
    id: string;
    full_name: string;
  } | null;
  facility?: {
    id: string;
    name: string;
  } | null;
}

interface ProfileItem {
  id: string;
  full_name: string;
  email?: string;
}

export default function ActionsPage() {
  const supabase = createBrowserClient();

  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Stats calculation
  const [allStatsActions, setAllStatsActions] = useState<ActionItem[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('diger');
  const [newPriority, setNewPriority] = useState<'dusuk' | 'orta' | 'yuksek' | 'kritik'>('orta');
  const [newResponsibleId, setNewResponsibleId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load profiles for modal select
  useEffect(() => {
    async function loadProfiles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (currentProfile?.company_id) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('company_id', currentProfile.company_id)
          .order('full_name', { ascending: true });

        if (data) setProfiles(data);
      }
    }
    loadProfiles();
  }, [supabase]);

  // Load stats (all actions for company to calculate overview counters accurately)
  const fetchAllForStats = useCallback(async () => {
    try {
      const res = await fetch('/api/actions?limit=500');
      const json = await res.json();
      if (json.data) {
        setAllStatsActions(json.data);
      }
    } catch {
      // ignore silently for stats
    }
  }, []);

  // Fetch paginated filtered actions
  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        params.set('priority', priorityFilter);
      }
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }

      const res = await fetch(`/api/actions?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Aksiyonlar yüklenirken hata oluştu');
      }
      const result = await res.json();
      setActions(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotalCount(result.count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, debouncedSearch]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  useEffect(() => {
    fetchAllForStats();
  }, [fetchAllForStats]);

  // Compute stats
  const stats = useMemo(() => {
    const list = allStatsActions.length > 0 ? allStatsActions : actions;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let total = list.length;
    let acik = 0;
    let devamEdiyor = 0;
    let gecikmis = 0;

    list.forEach((item) => {
      const isPastDue = item.due_date ? new Date(item.due_date) < today : false;
      if (item.status === 'acik') acik++;
      if (item.status === 'devam_ediyor') devamEdiyor++;
      if (item.status === 'gecikti' || ((item.status === 'acik' || item.status === 'devam_ediyor') && isPastDue)) {
        gecikmis++;
      }
    });

    if (allStatsActions.length === 0 && totalCount > 0) {
      total = totalCount;
    }

    return { total, acik, devamEdiyor, gecikmis };
  }, [allStatsActions, actions, totalCount]);

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newResponsibleId) {
      setModalError('Lütfen zorunlu alanları doldurun (Başlık ve Sorumlu Kişi).');
      return;
    }

    setModalSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: newCategory,
          priority: newPriority,
          responsible_user_id: newResponsibleId,
          due_date: newDueDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Aksiyon eklenirken bir hata oluştu.');
      }

      setIsModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewCategory('diger');
      setNewPriority('orta');
      setNewResponsibleId('');
      setNewDueDate('');
      setPage(1);
      fetchActions();
      fetchAllForStats();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, dueDate?: string | null) => {
    const isPastDue = dueDate ? new Date(dueDate) < new Date(new Date().setHours(0,0,0,0)) : false;
    const effectiveStatus = (status === 'acik' || status === 'devam_ediyor') && isPastDue ? 'gecikti' : status;

    switch (effectiveStatus) {
      case 'acik':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Açık
          </span>
        );
      case 'devam_ediyor':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Devam Ediyor
          </span>
        );
      case 'kapali':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Tamamlandı
          </span>
        );
      case 'onay_bekliyor':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            Onay Bekliyor
          </span>
        );
      case 'gecikti':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            Gecikti
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'dusuk':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Düşük
          </span>
        );
      case 'orta':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Orta
          </span>
        );
      case 'yuksek':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Yüksek
          </span>
        );
      case 'kritik':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            Kritik
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {priority}
          </span>
        );
    }
  };

  const isOverdue = (dueDate?: string | null, status?: string) => {
    if (!dueDate || status === 'kapali') return false;
    const target = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return target < today;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-sm shadow-blue-500/20">
            <ClipboardCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Aksiyon Takibi</h1>
            <p className="text-sm text-slate-500">Denetim bulguları ve operasyonel aksiyonların yönetimi</p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-medium shadow-sm transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Aksiyon Ekle</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Toplam Aksiyon</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</h3>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <ClipboardCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Açık */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Açık</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.acik}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Devam Ediyor */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Devam Ediyor</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.devamEdiyor}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Gecikmiş */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-rose-600 uppercase tracking-wider">Gecikmiş</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.gecikmis}</h3>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50">
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'acik', label: 'Açık' },
              { id: 'devam_ediyor', label: 'Devam Ediyor' },
              { id: 'onay_bekliyor', label: 'Onay Bekliyor' },
              { id: 'kapali', label: 'Tamamlandı' },
              { id: 'gecikti', label: 'Gecikti' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  statusFilter === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Priority Filter */}
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-44 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Öncelikler</option>
                <option value="dusuk">Düşük</option>
                <option value="orta">Orta</option>
                <option value="yuksek">Yüksek</option>
                <option value="kritik">Kritik</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Başlık veya kod ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Aksiyonlar yükleniyor...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={fetchActions}
              className="text-xs bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-100"
            >
              Tekrar Dene
            </button>
          </div>
        ) : actions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <ClipboardCheck className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-base font-medium text-slate-700">Kayıtlı aksiyon bulunamadı</p>
            <p className="text-xs text-slate-400">Filtreleri değiştirebilir veya yeni bir aksiyon ekleyebilirsiniz.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">No</th>
                  <th className="py-3.5 px-4">Başlık</th>
                  <th className="py-3.5 px-4">Sorumlu Kişi</th>
                  <th className="py-3.5 px-4">Öncelik</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Termin Tarihi</th>
                  <th className="py-3.5 px-4">Tesis</th>
                  <th className="py-3.5 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actions.map((item) => {
                  const pastDue = isOverdue(item.due_date, item.status);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">
                        {item.action_number || `ACT-${item.id.slice(0, 6).toUpperCase()}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 line-clamp-1">{item.title}</div>
                        {item.description && (
                          <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs border border-slate-200">
                            {item.responsible?.full_name ? item.responsible.full_name[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-700">
                              {item.responsible?.full_name || 'Atanmamış'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPriorityBadge(item.priority)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(item.status, item.due_date)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.due_date ? (
                          <div className={`flex items-center gap-1.5 text-xs font-medium ${pastDue ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(item.due_date).toLocaleDateString('tr-TR')}</span>
                            {pastDue && <span className="text-[10px] bg-rose-100 text-rose-700 px-1 py-0.5 rounded">Gecikti</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                        {item.facility?.name ? (
                          <div className="flex items-center gap-1 text-slate-600">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.facility.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <Link
                          href={`/dashboard/actions/${item.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detay</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && actions.length > 0 && (
          <div className="p-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Toplam <span className="font-medium text-slate-700">{totalCount}</span> kayıttan{' '}
              <span className="font-medium text-slate-700">{(page - 1) * 20 + 1}</span> -{' '}
              <span className="font-medium text-slate-700">{Math.min(page * 20, totalCount)}</span> arası gösteriliyor
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-slate-700 px-2">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Yeni Aksiyon Ekle */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Yeni Aksiyon Ekle</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAction} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Başlık <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Aksiyon başlığını giriniz"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Açıklama</label>
                <textarea
                  rows={3}
                  placeholder="Detaylı aksiyon açıklaması..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="yemekhane">Yemekhane</option>
                    <option value="servis">Servis</option>
                    <option value="temizlik">Temizlik</option>
                    <option value="varlik">Varlık</option>
                    <option value="teknik">Teknik</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Öncelik</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as 'dusuk' | 'orta' | 'yuksek' | 'kritik')}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="dusuk">Düşük</option>
                    <option value="orta">Orta</option>
                    <option value="yuksek">Yüksek</option>
                    <option value="kritik">Kritik</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sorumlu Kişi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newResponsibleId}
                    onChange={(e) => setNewResponsibleId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Kişi Seçiniz...</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.email ? `(${p.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Termin Tarihi</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={modalSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Aksiyon Oluştur</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
