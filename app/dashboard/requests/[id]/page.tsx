'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  RotateCcw,
  Calendar,
  Check,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

interface RequestDetail {
  id: string;
  request_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  assigned_to?: string | null;
  approved_by?: string | null;
  creator?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  assignee?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  approver?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  facility?: { id: string; name: string; city: string } | null;
  request_comments?: Array<{
    id: string;
    comment: string;
    created_at: string;
    user?: { id: string; full_name: string; avatar_url?: string } | null;
  }>;
  request_history?: Array<{
    id: string;
    old_status: string;
    new_status: string;
    note?: string | null;
    created_at: string;
    changer?: { id: string; full_name: string } | null;
  }>;
}

interface ProfileOption {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  yeni: {
    label: 'Yeni',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  atandi: {
    label: 'Atandı',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  onaylandi: {
    label: 'Onaylandı',
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  islemde: {
    label: 'İşlemde',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  tamamlandi: {
    label: 'Tamamlandı',
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  reddedildi: {
    label: 'Reddedildi',
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
};

const CATEGORY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  yemekhane: { label: 'Yemekhane', bg: 'bg-orange-50', text: 'text-orange-700' },
  servis: { label: 'Servis', bg: 'bg-sky-50', text: 'text-sky-700' },
  temizlik: { label: 'Temizlik', bg: 'bg-cyan-50', text: 'text-cyan-700' },
  filo: { label: 'Filo', bg: 'bg-purple-50', text: 'text-purple-700' },
  varlik: { label: 'Varlık', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  teknik: { label: 'Teknik', bg: 'bg-rose-50', text: 'text-rose-700' },
  diger: { label: 'Diğer', bg: 'bg-slate-50', text: 'text-slate-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  dusuk: { label: 'Düşük Öncelik', bg: 'bg-slate-100', text: 'text-slate-700' },
  orta: { label: 'Orta Öncelik', bg: 'bg-blue-50', text: 'text-blue-700' },
  yuksek: { label: 'Yüksek Öncelik', bg: 'bg-amber-50', text: 'text-amber-700' },
  kritik: { label: 'Kritik Öncelik', bg: 'bg-rose-100 text-rose-700 font-semibold', text: 'text-rose-700' },
};

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [requestData, setRequestData] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current user & role
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; fullName: string } | null>(null);
  const [assignableProfiles, setAssignableProfiles] = useState<ProfileOption[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Status transition state
  const [selectedTransition, setSelectedTransition] = useState<{ nextStatus: string; label: string } | null>(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Comments state
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // Fetch current user & request data
  useEffect(() => {
    async function initUserAndFetch() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, role, company_id')
          .eq('id', user.id)
          .single();

        if (profile) {
          setCurrentUser({
            id: profile.id,
            role: profile.role || 'employee',
            fullName: profile.full_name || 'Kullanıcı',
          });

          // If manager or admin, fetch profiles in the company for assignment
          if (['super_admin', 'company_admin', 'facility_manager', 'facility_officer'].includes(profile.role)) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email, role')
              .eq('company_id', profile.company_id)
              .order('full_name', { ascending: true });

            if (profiles) {
              setAssignableProfiles(profiles);
            }
          }
        }
      }
    }

    initUserAndFetch();
  }, []);

  const fetchRequestDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Talep bulunamadı.');
        }
        throw new Error('Talep detayları yüklenirken bir hata oluştu.');
      }
      const data = await res.json();
      const req: RequestDetail = data.data;

      // Ensure comments sorted asc
      if (req.request_comments) {
        req.request_comments.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      // Ensure history sorted asc
      if (req.request_history) {
        req.request_history.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      setRequestData(req);
      setSelectedAssignee(req.assigned_to || '');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Beklenmeyen bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchRequestDetail();
    }
  }, [id]);

  // Handle comment submit
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || commentLoading) return;

    const commentText = newComment.trim();
    setCommentLoading(true);

    // Optimistic comment creation
    const tempCommentId = 'temp-' + Date.now();
    const optimisticComment = {
      id: tempCommentId,
      comment: commentText,
      created_at: new Date().toISOString(),
      user: {
        id: currentUser?.id || 'temp',
        full_name: currentUser?.fullName || 'Siz',
        avatar_url: undefined,
      },
    };

    setRequestData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        request_comments: [...(prev.request_comments || []), optimisticComment],
      };
    });

    setNewComment('');

    try {
      const res = await fetch(`/api/requests/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText }),
      });

      if (!res.ok) {
        throw new Error('Yorum eklenemedi.');
      }

      const resData = await res.json();
      // Replace optimistic comment with server-returned comment
      setRequestData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          request_comments: (prev.request_comments || []).map((c) =>
            c.id === tempCommentId ? resData.data : c
          ),
        };
      });
    } catch (err) {
      // Revert optimistic addition if failed
      setRequestData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          request_comments: (prev.request_comments || []).filter((c) => c.id !== tempCommentId),
        };
      });
      alert('Yorum gönderilirken bir hata oluştu.');
    } finally {
      setCommentLoading(false);
    }
  };

  // Handle status update
  const handleStatusChange = async () => {
    if (!selectedTransition || statusLoading) return;

    setStatusLoading(true);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedTransition.nextStatus,
          note: transitionNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Durum güncellenirken hata oluştu.');
      }

      // Reset modal/state and refresh data
      setSelectedTransition(null);
      setTransitionNote('');
      await fetchRequestDetail();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert('Durum güncellenemedi.');
      }
    } finally {
      setStatusLoading(false);
    }
  };

  // Handle assignment change
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assignLoading) return;

    setAssignLoading(true);
    setAssignSuccess(false);

    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_to: selectedAssignee || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Atama yapılırken hata oluştu.');
      }

      setAssignSuccess(true);
      setTimeout(() => setAssignSuccess(false), 2500);
      await fetchRequestDetail();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert('Atama işlemi başarısız oldu.');
      }
    } finally {
      setAssignLoading(false);
    }
  };

  // Permission check for manager actions
  const isManagerOrAdmin = [
    'super_admin',
    'company_admin',
    'facility_manager',
    'facility_officer',
  ].includes(currentUser?.role || '');

  // Calculate valid transitions
  const getValidTransitions = (currentStatus: string) => {
    switch (currentStatus) {
      case 'yeni':
        return [
          { nextStatus: 'atandi', label: 'Ata', variant: 'purple' },
          { nextStatus: 'reddedildi', label: 'Reddet', variant: 'rose' },
        ];
      case 'atandi':
        return [
          { nextStatus: 'onaylandi', label: 'Onayla', variant: 'indigo' },
          { nextStatus: 'reddedildi', label: 'Reddet', variant: 'rose' },
        ];
      case 'onaylandi':
        return [
          { nextStatus: 'islemde', label: 'İşleme Al', variant: 'amber' },
        ];
      case 'islemde':
        return [
          { nextStatus: 'tamamlandi', label: 'Tamamlandı', variant: 'emerald' },
          { nextStatus: 'reddedildi', label: 'Reddet', variant: 'rose' },
        ];
      default:
        return [];
    }
  };

  // Skeleton Loading State
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-24 h-5 bg-slate-200 rounded"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="h-6 w-32 bg-slate-200 rounded"></div>
              <div className="h-8 w-3/4 bg-slate-200 rounded"></div>
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
                <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
              </div>
              <div className="h-24 bg-slate-100 rounded-xl mt-4"></div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="h-6 w-28 bg-slate-200 rounded"></div>
              <div className="h-20 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="h-6 w-36 bg-slate-200 rounded"></div>
              <div className="h-10 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="h-6 w-28 bg-slate-200 rounded"></div>
              <div className="h-28 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !requestData) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm text-center max-w-xl mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Talep Bilgisi Alınamadı</h3>
        <p className="text-sm text-slate-500 mb-6">{error || 'Talep verisi bulunamadı.'}</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard/requests"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Talepler Listesine Dön
          </Link>
          <button
            onClick={fetchRequestDetail}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Yeniden Dene
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[requestData.status] || {
    label: requestData.status,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  };

  const categoryConfig = CATEGORY_CONFIG[requestData.category] || {
    label: requestData.category,
    bg: 'bg-slate-50',
    text: 'text-slate-700',
  };

  const priorityConfig = PRIORITY_CONFIG[requestData.priority] || {
    label: requestData.priority,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
  };

  const validTransitions = getValidTransitions(requestData.status);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div>
        <Link
          href="/dashboard/requests"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Talepler</span>
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN (lg:col-span-7) ================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Detail Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-mono text-slate-400 font-semibold tracking-wide">
                  {requestData.request_number}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(requestData.created_at)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {requestData.title}
              </h1>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </span>

                {/* Priority Badge */}
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-200/60 ${priorityConfig.bg} ${priorityConfig.text}`}
                >
                  {priorityConfig.label}
                </span>

                {/* Category Badge */}
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-200/60 ${categoryConfig.bg} ${categoryConfig.text}`}
                >
                  {categoryConfig.label}
                </span>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Description Section */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Açıklama
              </h2>
              <div className="bg-slate-50 rounded-xl p-4 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap border border-slate-100">
                {requestData.description || 'Açıklama belirtilmemiş.'}
              </div>
            </div>

            {/* People Section */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                İlgili Kişiler
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Creator */}
                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(requestData.creator?.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Talebi Oluşturan
                    </p>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {requestData.creator?.full_name || 'Bilinmiyor'}
                    </p>
                  </div>
                </div>

                {/* Assignee */}
                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(requestData.assignee?.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Atanan Kişi
                    </p>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {requestData.assignee?.full_name || 'Atanmadı'}
                    </p>
                  </div>
                </div>

                {/* Approver */}
                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(requestData.approver?.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Onaylayan
                    </p>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {requestData.approver?.full_name || 'Bekleniyor'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Facility Section */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Tesis Bilgisi
              </h2>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm font-medium">
                  {requestData.facility?.name || 'Genel Tesis'}
                  {requestData.facility?.city && ` (${requestData.facility.city})`}
                </span>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Yorumlar ve Notlar
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {requestData.request_comments?.length || 0}
              </span>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              {requestData.request_comments && requestData.request_comments.length > 0 ? (
                requestData.request_comments.map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-50 rounded-xl p-4 border border-slate-100/90 space-y-2 transition-all hover:bg-slate-50/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {getInitials(c.user?.full_name)}
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {c.user?.full_name || 'Kullanıcı'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(c.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 pl-10 whitespace-pre-wrap leading-relaxed">
                      {c.comment}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 font-medium">Henüz bir yorum yapılmamış.</p>
                  <p className="text-xs text-slate-400 mt-0.5">İlk yorumu aşağıdaki alandan ekleyebilirsiniz.</p>
                </div>
              )}
            </div>

            {/* New Comment Input */}
            <form onSubmit={handleAddComment} className="space-y-3 pt-2">
              <div>
                <label htmlFor="newCommentText" className="sr-only">
                  Yorum Ekle
                </label>
                <textarea
                  id="newCommentText"
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Bu talep ile ilgili bir yorum veya operasyonel not bırakın..."
                  className="w-full text-sm rounded-xl border border-slate-200 p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-y min-h-[80px]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={commentLoading || !newComment.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium transition-colors shadow-sm"
                >
                  {commentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Yorum Ekle
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (lg:col-span-5) ================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* STATUS MANAGEMENT Card (facility_manager+ only) */}
          {isManagerOrAdmin && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Durum Yönetimi</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Talebin iş akışındaki mevcut durumunu güncelleyin.
                </p>
              </div>

              {/* Current Status Badge Display */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Mevcut Durum
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </span>
              </div>

              {/* Transition Action Buttons */}
              {validTransitions.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Kullanılabilir Aksiyonlar
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {validTransitions.map((t) => {
                      const isDanger = t.nextStatus === 'reddedildi';
                      const isSuccess = t.nextStatus === 'tamamlandi';
                      const isSelected = selectedTransition?.nextStatus === t.nextStatus;

                      let btnStyle = 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200';
                      if (isDanger) {
                        btnStyle = 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200';
                      } else if (isSuccess) {
                        btnStyle = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200';
                      } else if (t.nextStatus === 'atandi') {
                        btnStyle = 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200';
                      } else if (t.nextStatus === 'onaylandi') {
                        btnStyle = 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200';
                      } else if (t.nextStatus === 'islemde') {
                        btnStyle = 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200';
                      }

                      return (
                        <button
                          key={t.nextStatus}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTransition(null);
                            } else {
                              setSelectedTransition({ nextStatus: t.nextStatus, label: t.label });
                            }
                          }}
                          className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs border transition-all shadow-xs ${btnStyle} ${
                            isSelected ? 'ring-2 ring-offset-2 ring-blue-600 shadow-sm' : ''
                          }`}
                        >
                          {isSuccess && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isDanger && <XCircle className="w-3.5 h-3.5" />}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Inline Note and Confirm Dialog */}
                  {selectedTransition && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Durum Değişikliği: {selectedTransition.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTransition(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                        >
                          İptal
                        </button>
                      </div>

                      <div>
                        <label
                          htmlFor="transitionNoteInput"
                          className="block text-xs font-medium text-slate-600 mb-1"
                        >
                          Not (isteğe bağlı)
                        </label>
                        <textarea
                          id="transitionNoteInput"
                          rows={2}
                          value={transitionNote}
                          onChange={(e) => setTransitionNote(e.target.value)}
                          placeholder="Durum değişikliği ile ilgili açıklama ekleyin..."
                          className="w-full text-xs rounded-lg border border-slate-200 p-2 text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTransition(null)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="button"
                          disabled={statusLoading}
                          onClick={handleStatusChange}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs"
                        >
                          {statusLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Kaydediliyor...
                            </>
                          ) : (
                            'Onayla ve Değiştir'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-3 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                  Bu talep için başka durum geçişi bulunmuyor.
                </div>
              )}
            </div>
          )}

          {/* ATAMA Card (facility_manager+ only) */}
          {isManagerOrAdmin && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Talep Atama</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Talebi ilgilenecek personele ya da sorumluya yönlendirin.
                </p>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-3">
                <div>
                  <label htmlFor="assigneeSelect" className="block text-xs font-medium text-slate-600 mb-1">
                    Atanan Personel
                  </label>
                  <select
                    id="assigneeSelect"
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-200 p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">-- Atanmadı (Seçilmedi) --</option>
                    {assignableProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.role ? `(${p.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {assignSuccess && (
                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Atandı
                    </span>
                  )}
                  {!assignSuccess && <span />}

                  <button
                    type="submit"
                    disabled={assignLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    {assignLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Kaydediliyor...
                      </>
                    ) : (
                      'Kaydet'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ZAMAN BİLGİSİ Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Zaman Bilgisi
            </h2>
            <div className="space-y-3 divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-slate-500">Oluşturulma Tarihi</span>
                <span className="text-xs font-semibold text-slate-800">
                  {formatDate(requestData.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs font-medium text-slate-500">Son Güncelleme</span>
                <span className="text-xs font-semibold text-slate-800">
                  {formatDate(requestData.updated_at || requestData.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* TARİHÇE (History) Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-600" />
              Tarihçe ve Süreç
            </h2>

            {requestData.request_history && requestData.request_history.length > 0 ? (
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {requestData.request_history.map((h) => {
                  const newStatusConfig = STATUS_CONFIG[h.new_status] || {
                    label: h.new_status,
                    dot: 'bg-slate-400',
                  };
                  const oldStatusConfig = STATUS_CONFIG[h.old_status] || {
                    label: h.old_status,
                  };

                  return (
                    <div key={h.id} className="relative group">
                      {/* Timeline Dot */}
                      <span
                        className={`absolute -left-[29px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${newStatusConfig.dot}`}
                      />

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            <span className="text-slate-500 line-through mr-1 font-normal">
                              {oldStatusConfig.label}
                            </span>
                            →
                            <span className="ml-1 text-blue-700 font-bold">
                              {newStatusConfig.label}
                            </span>
                          </p>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {formatDate(h.created_at)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{h.changer?.full_name || 'Sistem / Kullanıcı'}</span>
                        </p>

                        {h.note && (
                          <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                            &quot;{h.note}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                Henüz kayıtlı bir geçmiş bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
