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
  ArrowRight,
  Check,
  Timer,
  Award,
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
  assigned_at?: string | null;
  closed_at?: string | null;
  sla_response_minutes?: number | null;
  sla_resolution_minutes?: number | null;
  sla_total_minutes?: number | null;
  creator?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  assignee?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  facility?: { id: string; name: string; city: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  yeni: 'Açık / Beklemede',
  islemde: 'İşlemde',
  cozumlendi: 'Çözümlendi',
  tamamlandi: 'Çözümlendi',
  reddedildi: 'Reddedildi',
  atandi: 'Onay Bekliyor',
  onaylandi: 'Onaylandı',
};

const CATEGORY_LABELS: Record<string, string> = {
  temizlik: 'Temizlik & Hijyen',
  yemekhane: 'Yemekhane',
  teknik: 'Teknik & Bakım',
  servis: 'Servis / Ulaşım',
  varlik: 'Varlık & Zimmet',
  diger: 'Diğer Talepler',
};

const PRIORITY_LABELS: Record<string, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
};

function formatMinutes(minutes?: number | null) {
  if (minutes == null || minutes < 0) return '-';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} dk`;
  const hours = Math.floor(rounded / 60);
  const remainingMins = rounded % 60;
  return remainingMins > 0 ? `${hours}s ${remainingMins}d` : `${hours}s`;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

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
      case 'islemde':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cozumlendi':
      case 'tamamlandi':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'reddedildi':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'atandi':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'onaylandi':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'temizlik':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'yemekhane':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'teknik':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'servis':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'varlik':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
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
  const totalOpen = requests.filter((r) => r.status === 'yeni').length;
  const totalInProgress = requests.filter((r) => r.status === 'islemde' || r.status === 'atandi' || r.status === 'onaylandi').length;
  const totalSolved = requests.filter((r) => r.status === 'cozumlendi' || r.status === 'tamamlandi').length;
  const totalRejected = requests.filter((r) => r.status === 'reddedildi').length;

  // Average response time
  const respTimes = requests
    .map((r) => r.sla_response_minutes)
    .filter((v): v is number => v != null && v >= 0);
  const avgResponse = respTimes.length > 0 ? Math.round(respTimes.reduce((a, b) => a + b, 0) / respTimes.length) : null;
  const isAvgRespOnTarget = avgResponse != null && avgResponse <= 60;

  // Average resolution time
  const resolTimes = requests
    .map((r) => r.sla_resolution_minutes)
    .filter((v): v is number => v != null && v >= 0);
  const avgResolution = resolTimes.length > 0 ? Math.round(resolTimes.reduce((a, b) => a + b, 0) / resolTimes.length) : null;

  const statusTabs = [
    { key: 'all', label: 'Tüm Talepler' },
    { key: 'yeni', label: 'Açık / Beklemede' },
    { key: 'atandi', label: 'Onay Bekleyen' },
    { key: 'onaylandi', label: 'İşlem Bekleyen' },
    { key: 'islemde', label: 'İşlemde' },
    { key: 'cozumlendi', label: 'Çözümlendi' },
    { key: 'reddedildi', label: 'Reddedildi' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Talep & Onay Yönetim Merkezi</h1>
          <p className="text-sm text-slate-500 mt-1">
            İdari operasyon talepleri, karşılama ve çözüm süreleri (SLA) ile anlık takip.
          </p>
        </div>
        <Link
          href="/dashboard/requests/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-md shadow-blue-500/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Talep Oluştur</span>
        </Link>
      </div>

      {/* KPI Kartları (Ekranın En Üstü) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Toplam Açılan Talep */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Açık / Beklemede</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">{totalOpen}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Müdahale bekleniyor</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        {/* 2. İşlemdeki Talepler */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">İşlemde</p>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{totalInProgress}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Üzerine alınmış</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Çözülen Talep (Yeşil renkli kart) */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm flex items-center justify-between bg-emerald-50/20">
          <div>
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Çözülen Talep</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{totalSolved}</p>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">Başarıyla kapatıldı</p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Reddedilen Talep (Kırmızı renkli kart) */}
        <div className="bg-white rounded-2xl p-5 border border-rose-200 shadow-sm flex items-center justify-between bg-rose-50/20">
          <div>
            <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Reddedilen Talep</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{totalRejected}</p>
            <p className="text-[11px] text-rose-700/80 mt-0.5">Gerekçeli iptal</p>
          </div>
          <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* 5. Ortalama Karşılama (Müdahale) Süresi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ort. Karşılama</p>
              {avgResponse != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isAvgRespOnTarget ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {isAvgRespOnTarget ? 'Hedefte' : 'Hedef Üstü'}
                </span>
              )}
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {avgResponse != null ? formatMinutes(avgResponse) : '-'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {avgResolution != null ? `Çözüm: ${formatMinutes(avgResolution)}` : 'Hedef: < 60 dk'}
            </p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Timer className="w-5 h-5" />
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
              className={`pb-3 px-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
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
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-2.5 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                  <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                </div>
                <div className="h-8 bg-slate-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Talepler Getirilemedi</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{error}</p>
          </div>
        ) : requests.length === 0 ? (
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
                  <th className="py-3.5 px-4">Tesis / Şehir</th>
                  <th className="py-3.5 px-4">Talep Eden & Sorumlu</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">SLA (Müdahale / Çözüm)</th>
                  <th className="py-3.5 px-6 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {requests.map((req) => {
                  const respMin = req.sla_response_minutes;
                  const resolMin = req.sla_resolution_minutes;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {req.title}
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{req.request_number}</span>
                          <span>•</span>
                          <span>{formatDate(req.created_at)}</span>
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
                        <div className="text-slate-800 font-medium text-xs">
                          {req.facility?.name || 'Tesis Yok'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {req.facility?.city || ''}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-800">
                          {req.creator?.full_name || 'Kullanıcı'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Sorumlu: <strong className="text-slate-700">{req.assignee?.full_name || 'Atanmadı'}</strong>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                            req.status
                          )}`}
                        >
                          {STATUS_LABELS[req.status] || req.status}
                        </span>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {respMin != null ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-mono flex items-center gap-1.5">
                              <span className="text-slate-400 text-[10px]">Müdahale:</span>
                              <span className={respMin <= 60 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                {formatMinutes(respMin)}
                              </span>
                            </div>
                            {resolMin != null && (
                              <div className="text-xs font-mono flex items-center gap-1.5">
                                <span className="text-slate-400 text-[10px]">Çözüm:</span>
                                <span className="text-slate-700 font-semibold">{formatMinutes(resolMin)}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Beklemede</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Link
                          href={`/dashboard/requests/${req.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 transition-colors shadow-xs"
                        >
                          <span>İncele / İşlem</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Toplam <span className="font-semibold text-slate-800">{totalCount}</span> talepten{' '}
              <span className="font-semibold text-slate-800">{(currentPage - 1) * 20 + 1}</span>-
              <span className="font-semibold text-slate-800">{Math.min(currentPage * 20, totalCount)}</span> arası gösteriliyor
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
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
