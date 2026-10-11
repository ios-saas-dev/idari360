'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  Building,
  Calendar,
  Layers,
} from 'lucide-react';

interface RequestItem {
  id: string;
  request_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  creator?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  assignee?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  facility?: { id: string; name: string; city: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  yeni: 'Yeni',
  atandi: 'Atandı',
  onaylandi: 'Onaylandı',
  islemde: 'İşlemde',
  tamamlandi: 'Tamamlandı',
  reddedildi: 'Reddedildi',
};

const CATEGORY_LABELS: Record<string, string> = {
  yemekhane: 'Yemekhane',
  servis: 'Servis',
  temizlik: 'Temizlik',
  filo: 'Filo',
  varlik: 'Varlık',
  teknik: 'Teknik',
  diger: 'Diğer',
};

const PRIORITY_LABELS: Record<string, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Requests
  useEffect(() => {
    async function fetchRequests() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedStatus !== 'all') params.append('status', selectedStatus);
        if (selectedCategory !== 'all') params.append('category', selectedCategory);
        if (selectedPriority !== 'all') params.append('priority', selectedPriority);
        if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
        params.append('page', currentPage.toString());

        const res = await fetch(`/api/requests?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Talepler yüklenirken bir hata meydana geldi');
        }
        const data = await res.json();
        setRequests(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.count || 0);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Beklenmeyen bir hata oluştu');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, [selectedStatus, selectedCategory, selectedPriority, debouncedSearch, currentPage]);

  // Badge stylings
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'yeni':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'atandi':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'onaylandi':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'islemde':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'tamamlandi':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'reddedildi':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'yemekhane':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'servis':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'temizlik':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'filo':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'varlik':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'teknik':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'diger':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'dusuk':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'orta':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'yuksek':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'kritik':
        return 'bg-rose-100 text-rose-700 border-rose-300 font-semibold animate-pulse';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Stats calculation
  const countByStatus = (statusKey: string) => {
    return requests.filter((r) => r.status === statusKey).length;
  };

  const statusTabs = [
    { key: 'all', label: 'Tümü' },
    { key: 'yeni', label: 'Yeni' },
    { key: 'atandi', label: 'Atandı' },
    { key: 'onaylandi', label: 'Onaylandı' },
    { key: 'islemde', label: 'İşlemde' },
    { key: 'tamamlandi', label: 'Tamamlandı' },
    { key: 'reddedildi', label: 'Reddedildi' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Talep & Onay Sistemi</h1>
          <p className="text-sm text-slate-500 mt-1">
            İdari operasyon taleplerini takip edin, atayın ve sonuçlandırın.
          </p>
        </div>
        <Link
          href="/dashboard/requests/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Talep
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yeni Talepler</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{countByStatus('yeni')}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">İşlemdekiler</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{countByStatus('islemde')}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tamamlananlar</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{countByStatus('tamamlandi')}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reddedilenler</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{countByStatus('reddedildi')}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Status Tabs */}
        <div className="border-b border-slate-200 px-6 pt-4 flex gap-1 overflow-x-auto scrollbar-none">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedStatus(tab.key);
                setCurrentPage(1);
              }}
              className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedStatus === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Talep no, başlık veya açıklama ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400 shadow-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Kategoriler</option>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            {/* Priority Dropdown */}
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
            >
              <option value="all">Tüm Öncelikler</option>
              {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          /* Loading Skeleton */
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 bg-slate-200 rounded w-24"></div>
                    <div className="h-4 bg-slate-200 rounded w-16"></div>
                  </div>
                  <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                </div>
                <div className="h-8 bg-slate-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Talepler Getirilemedi</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{error}</p>
          </div>
        ) : requests.length === 0 ? (
          /* Empty State */
          <div className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Kayıtlı Talep Bulunamadı</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Arama kriterlerinize uygun talep bulunmuyor ya da henüz sistemde bir talep oluşturulmamış.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard/requests/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                İlk Talebi Oluştur
              </Link>
            </div>
          </div>
        ) : (
          /* Requests Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Talep No / Başlık</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Öncelik</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Talep Eden</th>
                  <th className="py-3.5 px-4">Atanan</th>
                  <th className="py-3.5 px-4">Tarih</th>
                  <th className="py-3.5 px-6 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {req.title}
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">
                        {req.request_number}
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryBadge(
                          req.category
                        )}`}
                      >
                        {CATEGORY_LABELS[req.category] || req.category}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityBadge(
                          req.priority
                        )}`}
                      >
                        {PRIORITY_LABELS[req.priority] || req.priority}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                          req.status
                        )}`}
                      >
                        {STATUS_LABELS[req.status] || req.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                          {req.creator?.full_name?.charAt(0) || <User className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-slate-700 text-xs font-medium">
                          {req.creator?.full_name || 'Bilinmiyor'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      {req.assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                            {req.assignee.full_name?.charAt(0) || <User className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-slate-700 text-xs font-medium">
                            {req.assignee.full_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Atanmadı</span>
                      )}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(req.created_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <Link
                        href={`/dashboard/requests/${req.id}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-xs font-medium transition-colors"
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Toplam <span className="font-semibold text-slate-700">{totalCount}</span> talepten{' '}
              <span className="font-semibold text-slate-700">{(currentPage - 1) * 20 + 1}</span> -{' '}
              <span className="font-semibold text-slate-700">
                {Math.min(currentPage * 20, totalCount)}
              </span>{' '}
              arası gösteriliyor
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-slate-700 px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
