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
  Calendar,
  UserCheck,
  Check,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Plus,
  Trash2,
  ShieldAlert,
  Award,
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
  assigned_at?: string | null;
  closed_at?: string | null;
  resolution_note?: string | null;
  resolution_photos?: string[] | null;
  attachment_urls?: string[] | null;
  sla_response_minutes?: number | null;
  sla_resolution_minutes?: number | null;
  sla_total_minutes?: number | null;
  created_by?: string;
  assigned_to?: string | null;
  creator?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
  assignee?: { id: string; full_name: string; email: string; avatar_url?: string } | null;
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
    attachment_urls?: string[] | null;
    created_at: string;
    changer?: { id: string; full_name: string } | null;
  }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  yeni: {
    label: 'Açık / Beklemede',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  islemde: {
    label: 'İşlemde / Üzerime Alındı',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  cozumlendi: {
    label: 'Çözümlendi',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  tamamlandi: {
    label: 'Çözümlendi',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  reddedildi: {
    label: 'Reddedildi',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  atandi: {
    label: 'Atandı',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  onaylandi: {
    label: 'Onaylandı',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
};

const CATEGORY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  temizlik: { label: 'Temizlik & Hijyen', bg: 'bg-cyan-50', text: 'text-cyan-700' },
  yemekhane: { label: 'Yemekhane', bg: 'bg-orange-50', text: 'text-orange-700' },
  teknik: { label: 'Teknik & Bakım', bg: 'bg-rose-50', text: 'text-rose-700' },
  servis: { label: 'Servis / Ulaşım', bg: 'bg-sky-50', text: 'text-sky-700' },
  filo: { label: 'Filo & Taşıt', bg: 'bg-purple-50', text: 'text-purple-700' },
  varlik: { label: 'Varlık & Zimmet', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  diger: { label: 'Diğer Talepler', bg: 'bg-slate-50', text: 'text-slate-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  dusuk: { label: 'Düşük Öncelik', bg: 'bg-slate-100', text: 'text-slate-700' },
  orta: { label: 'Orta Öncelik', bg: 'bg-blue-50', text: 'text-blue-700' },
  yuksek: { label: 'Yüksek Öncelik', bg: 'bg-amber-50', text: 'text-amber-700' },
  kritik: { label: 'Kritik Öncelik', bg: 'bg-rose-100 text-rose-700 font-semibold', text: 'text-rose-700' },
};

function formatDate(dateStr?: string | null) {
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

function formatMinutes(minutes?: number | null) {
  if (minutes == null || minutes < 0) return '-';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} dakika`;
  const hours = Math.floor(rounded / 60);
  const remainingMins = rounded % 60;
  return remainingMins > 0 ? `${hours} saat ${remainingMins} dk` : `${hours} saat`;
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
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; fullName: string; facilityId?: string } | null>(null);

  // Action / Take over loading
  const [takeOverLoading, setTakeOverLoading] = useState(false);

  // Resolution Pop-up Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'cozumlendi' | 'reddedildi'>('cozumlendi');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionPhotoUrl, setResolutionPhotoUrl] = useState('');
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const [modalSubmitting, setModalSubmitting] = useState(false);

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
          .select('id, full_name, role, company_id, facility_id')
          .eq('id', user.id)
          .single();

        if (profile) {
          setCurrentUser({
            id: profile.id,
            role: profile.role || 'employee',
            fullName: profile.full_name || 'Kullanıcı',
            facilityId: profile.facility_id || undefined,
          });
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
        if (res.status === 404) throw new Error('Talep bulunamadı.');
        throw new Error('Talep detayları yüklenirken bir hata oluştu.');
      }
      const json = await res.json();
      const req: RequestDetail = json.data;

      if (req.request_comments) {
        req.request_comments.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (req.request_history) {
        req.request_history.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      setRequestData(req);
    } catch (err: any) {
      setError(err?.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestDetail();
  }, [id]);

  // Adım 2: Talebi Üzerine Alma ("Üzerime Al" butonu)
  const handleTakeOver = async () => {
    if (takeOverLoading) return;
    setTakeOverLoading(true);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'take_over',
          status: 'islemde',
          note: `Talep ${currentUser?.fullName || 'Tesis Sorumlusu'} tarafından üzerine alındı (T2: Karşılama)`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Talep üzerinize alınırken bir hata oluştu.');
      }

      await fetchRequestDetail();
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız.');
    } finally {
      setTakeOverLoading(false);
    }
  };

  // Pop-up açma: Çöz veya Reddet
  const openResolutionModal = (action: 'cozumlendi' | 'reddedildi') => {
    setModalAction(action);
    setResolutionNote('');
    setResolutionPhotos([]);
    setResolutionPhotoUrl('');
    setModalOpen(true);
  };

  // Fotoğraf listesine ekleme
  const handleAddPhoto = () => {
    if (!resolutionPhotoUrl.trim()) return;
    if (!resolutionPhotos.includes(resolutionPhotoUrl.trim())) {
      setResolutionPhotos([...resolutionPhotos, resolutionPhotoUrl.trim()]);
    }
    setResolutionPhotoUrl('');
  };

  // Fotoğraf silme
  const handleRemovePhoto = (index: number) => {
    setResolutionPhotos(resolutionPhotos.filter((_, i) => i !== index));
  };

  // Adım 3: Sonuçlandırma Submit (Çözüldü Olarak Kapat veya Reddet)
  const handleResolutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalSubmitting) return;

    if (!resolutionNote.trim() || resolutionNote.trim().length < 5) {
      alert('Lütfen en az 5 karakterlik açıklama/not giriniz.');
      return;
    }

    setModalSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: modalAction,
          note: resolutionNote.trim(),
          resolution_photos: resolutionPhotos,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'İşlem kaydedilirken hata oluştu.');
      }

      setModalOpen(false);
      await fetchRequestDetail();
    } catch (err: any) {
      alert(err.message || 'İşlem kaydedilemedi.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Yorum Ekleme
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || commentLoading) return;

    setCommentLoading(true);
    try {
      const res = await fetch(`/api/requests/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment.trim() }),
      });

      if (!res.ok) {
        throw new Error('Yorum eklenirken hata oluştu.');
      }

      setNewComment('');
      await fetchRequestDetail();
    } catch (err: any) {
      alert(err.message || 'Yorum eklenemedi.');
    } finally {
      setCommentLoading(false);
    }
  };

  // Yetki Kontrolleri
  const isManagerOrAdmin = [
    'super_admin',
    'company_admin',
    'facility_manager',
    'facility_officer',
  ].includes(currentUser?.role || '');

  // Tesis Müdürü / Sorumlusu kendi tesisine ait talebi mi görüyor?
  const isFacilityAuthorized =
    ['super_admin', 'company_admin'].includes(currentUser?.role || '') ||
    (currentUser?.facilityId && requestData?.facility?.id === currentUser?.facilityId);

  const canTakeAction = isManagerOrAdmin && isFacilityAuthorized;

  // Hesaplanan SLA Süreleri
  const t1Date = requestData?.created_at ? new Date(requestData.created_at) : null;
  const t2Date = requestData?.assigned_at ? new Date(requestData.assigned_at) : null;
  const t3Date = requestData?.closed_at ? new Date(requestData.closed_at) : null;

  // Karşılama Süresi (T2 - T1)
  let responseMinutes = requestData?.sla_response_minutes;
  if (responseMinutes == null && t1Date && t2Date) {
    responseMinutes = Math.max(0, (t2Date.getTime() - t1Date.getTime()) / 60000);
  }

  // Çözüm Süresi (T3 - T2)
  let resolutionMinutes = requestData?.sla_resolution_minutes;
  if (resolutionMinutes == null && t2Date && t3Date) {
    resolutionMinutes = Math.max(0, (t3Date.getTime() - t2Date.getTime()) / 60000);
  }

  // Toplam Süre (T3 - T1)
  let totalMinutes = requestData?.sla_total_minutes;
  if (totalMinutes == null && t1Date && t3Date) {
    totalMinutes = Math.max(0, (t3Date.getTime() - t1Date.getTime()) / 60000);
  }

  const isResponseOnTarget = responseMinutes != null && responseMinutes <= 60;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200 h-96" />
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200 h-96" />
        </div>
      </div>
    );
  }

  if (error || !requestData) {
    return (
      <div className="bg-rose-50 rounded-2xl p-6 border border-rose-200 text-rose-700 flex items-center gap-3">
        <AlertCircle className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-semibold">Hata Oluştu</h3>
          <p className="text-sm">{error || 'Talep bulunamadı.'}</p>
          <Link
            href="/dashboard/requests"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline mt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Talepler Listesine Dön
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[requestData.status] || STATUS_CONFIG.yeni;
  const categoryCfg = CATEGORY_CONFIG[requestData.category] || CATEGORY_CONFIG.diger;
  const priorityCfg = PRIORITY_CONFIG[requestData.priority] || PRIORITY_CONFIG.orta;

  const isClosed = requestData.status === 'cozumlendi' || requestData.status === 'reddedildi' || requestData.status === 'tamamlandi';
  const isResolved = requestData.status === 'cozumlendi' || requestData.status === 'tamamlandi';

  return (
    <div className="space-y-6">
      {/* Üst Navigasyon */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/requests"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Talepler Listesine Dön</span>
        </Link>
        <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md font-semibold">
          {requestData.request_number}
        </span>
      </div>

      {/* Ana Izgara */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= SOL KOLON (lg:col-span-7 veya 8) ================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* Ana Talep Bilgi Kartı */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* Statü Rozeti */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>

                {/* Öncelik */}
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-200/60 ${priorityCfg.bg} ${priorityCfg.text}`}
                >
                  {priorityCfg.label}
                </span>

                {/* Kategori */}
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-200/60 ${categoryCfg.bg} ${categoryCfg.text}`}
                >
                  {categoryCfg.label}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {requestData.title}
              </h1>
            </div>

            {/* Çözüldü / Reddedildi İse: Sonuçlandırma Özel Kartı */}
            {isClosed && (
              <div
                className={`rounded-2xl p-5 border ${
                  isResolved
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/70 border-rose-200 text-rose-900'
                } space-y-3`}
              >
                <div className="flex items-center gap-2.5">
                  {isResolved ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  )}
                  <h3 className="font-bold text-sm sm:text-base">
                    {isResolved ? 'Talep Başarıyla Çözümlendi' : 'Talep Reddedildi'}
                  </h3>
                  <span className="text-xs opacity-75 ml-auto">
                    {formatDate(requestData.closed_at)}
                  </span>
                </div>

                <div className="bg-white/80 rounded-xl p-3.5 border border-black/5 text-sm whitespace-pre-wrap leading-relaxed">
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">
                    {isResolved ? 'Çözüm Notu / Açıklama' : 'Red Sebebi'}
                  </div>
                  {requestData.resolution_note || 'Not girilmemiş.'}
                </div>

                {/* Çözüm Fotoğrafları / Belgeleri */}
                {requestData.resolution_photos && requestData.resolution_photos.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Çözüm Belgeleri / Fotoğrafları ({requestData.resolution_photos.length})
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {requestData.resolution_photos.map((photo, idx) => (
                        <a
                          key={idx}
                          href={photo}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative w-20 h-20 rounded-xl overflow-hidden border border-black/10 bg-white hover:shadow-md transition-all flex items-center justify-center"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo}
                            alt={`Çözüm kanıtı ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ExternalLink className="w-4 h-4" />
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Açıklama */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Talep Açıklaması
              </h2>
              <div className="bg-slate-50 rounded-xl p-4 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap border border-slate-100">
                {requestData.description || 'Açıklama belirtilmemiş.'}
              </div>
            </div>

            {/* Talep Açılışında Eklenen Belgeler / Fotoğraflar */}
            {requestData.attachment_urls && requestData.attachment_urls.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  Talep Açılış Fotoğrafları ({requestData.attachment_urls.length})
                </h2>
                <div className="flex flex-wrap gap-2.5">
                  {requestData.attachment_urls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:shadow-md transition-all flex items-center justify-center"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Talep eki ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ExternalLink className="w-4 h-4" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* İlgili Kişiler & Lokasyon */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              {/* Talep Sahibi */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                  {getInitials(requestData.creator?.full_name)}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Talep Sahibi
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {requestData.creator?.full_name || 'Bilinmiyor'}
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[150px]">
                    {requestData.creator?.email || ''}
                  </div>
                </div>
              </div>

              {/* Sorumlu / Çözücü */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                  {getInitials(requestData.assignee?.full_name)}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Tesis Sorumlusu
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {requestData.assignee?.full_name || 'Henüz Atanmadı'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {requestData.assignee?.email || 'İşlem bekleniyor'}
                  </div>
                </div>
              </div>

              {/* Lokasyon */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Tesis / Lokasyon
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {requestData.facility?.name || 'Tesis Yok'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {requestData.facility?.city || 'Şehir Belirtilmemiş'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Yorumlar Bölümü */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span>Yorumlar & Mesajlaşma</span>
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {requestData.request_comments?.length || 0}
                </span>
              </h2>
            </div>

            {/* Yorum Listesi */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {requestData.request_comments && requestData.request_comments.length > 0 ? (
                requestData.request_comments.map((c) => (
                  <div key={c.id} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                          {getInitials(c.user?.full_name)}
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          {c.user?.full_name || 'Kullanıcı'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(c.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap pl-8">
                      {c.comment}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Henüz yorum yapılmamış.
                </div>
              )}
            </div>

            {/* Yeni Yorum Ekleme Formu */}
            <form onSubmit={handleCommentSubmit} className="space-y-2 pt-2 border-t border-slate-100">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Bu talep ile ilgili bir yorum veya soru yazın..."
                rows={2}
                className="w-full text-sm rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newComment.trim() || commentLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  {commentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Yorum Gönder</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ================= SAĞ KOLON (lg:col-span-4) ================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. İŞ AKIŞI YÖNETİM KARTI (ÇÖZÜCÜ ROLÜ İÇİN AKSİYONLAR) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Talep İş Akışı</span>
              <span className="text-[11px] font-normal text-slate-400">Adım Adım Süreç</span>
            </h2>

            {/* Adım 2: Talebi Üzerine Alma (Statü: Açık / Beklemede ise) */}
            {requestData.status === 'yeni' && (
              <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100 space-y-3">
                <div className="text-xs text-blue-900 leading-relaxed font-medium">
                  Bu talep şu an <strong className="text-blue-700">Açık / Beklemede</strong> statüsündedir. Karşılama ve çözüm sürecini başlatmak için talebi üzerinize alabilirsiniz.
                </div>

                {canTakeAction ? (
                  <button
                    onClick={handleTakeOver}
                    disabled={takeOverLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {takeOverLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    <span>Talebi Üzerime Al</span>
                  </button>
                ) : (
                  <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                    Talebi üzerinize alma yetkisi sadece sorumlu Tesis Müdürü ve Şirket Yöneticilerine aittir.
                  </div>
                )}
              </div>
            )}

            {/* Adım 3: Sonuçlandırma - Çözüm veya Red (Statü: İşlemde ise) */}
            {(requestData.status === 'islemde' || requestData.status === 'atandi' || requestData.status === 'onaylandi') && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 leading-relaxed">
                  Talep şu anda <strong className="text-amber-700">İşlemde</strong> durumundadır. İşlemi tamamladığınızda talebi sonuçlandırınız:
                </div>

                {canTakeAction ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Çözüldü Olarak Kapat Butonu */}
                    <button
                      onClick={() => openResolutionModal('cozumlendi')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm active:scale-[0.98] transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Çözüldü Olarak Kapat</span>
                    </button>

                    {/* Reddet Butonu */}
                    <button
                      onClick={() => openResolutionModal('reddedildi')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 active:scale-[0.98] transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reddet</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                    Talebi sonuçlandırma yetkisi Tesis Sorumlusu veya Şirket Yöneticisine aittir.
                  </div>
                )}
              </div>
            )}

            {/* Kapanmış ise Bilgi */}
            {isClosed && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 text-center space-y-1">
                <div className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                  {isResolved ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{isResolved ? 'Talep Kapatıldı (Çözüldü)' : 'Talep Kapatıldı (Reddedildi)'}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Bu talep için işlem süreci tamamlanmıştır.
                </p>
              </div>
            )}
          </div>

          {/* 2. ZAMAN DAMGALARI (T1, T2, T3) VE SLA SÜRE METRİKLERİ */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>SLA & Zaman Damgaları</span>
              </h2>
            </div>

            {/* T1, T2, T3 Zaman Çizelgesi */}
            <div className="relative border-l-2 border-slate-100 ml-3 space-y-6 pl-5 py-1">
              {/* T1: Açılış */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 ring-4 ring-white" />
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>T1: Talep Açılışı</span>
                  <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Başlangıç</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {formatDate(requestData.created_at)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Açan: {requestData.creator?.full_name || 'Kullanıcı'}
                </div>
              </div>

              {/* T2: Karşılama */}
              <div className="relative">
                <div
                  className={`absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full ring-4 ring-white ${
                    requestData.assigned_at ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                />
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>T2: Karşılama (Üzerime Alma)</span>
                  {responseMinutes != null && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isResponseOnTarget
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isResponseOnTarget ? 'Hedefte' : 'Gecikmeli'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {requestData.assigned_at ? formatDate(requestData.assigned_at) : 'Henüz karşılanmadı'}
                </div>
                {responseMinutes != null && (
                  <div className="text-[11px] font-semibold text-amber-700 mt-1 bg-amber-50 px-2 py-1 rounded-md inline-block">
                    Müdahale Süresi (T2 - T1): {formatMinutes(responseMinutes)}
                  </div>
                )}
              </div>

              {/* T3: Kapanış */}
              <div className="relative">
                <div
                  className={`absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full ring-4 ring-white ${
                    requestData.closed_at
                      ? isResolved
                        ? 'bg-emerald-500'
                        : 'bg-rose-500'
                      : 'bg-slate-300'
                  }`}
                />
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>T3: Kapanış (Çözüm / Red)</span>
                  {isClosed && (
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      Sonuç
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {requestData.closed_at ? formatDate(requestData.closed_at) : 'İşlem devam ediyor'}
                </div>

                {resolutionMinutes != null && (
                  <div className="text-[11px] font-semibold text-emerald-800 mt-1 bg-emerald-50 px-2 py-1 rounded-md block">
                    Çözüm İşlem Süresi (T3 - T2): {formatMinutes(resolutionMinutes)}
                  </div>
                )}
              </div>
            </div>

            {/* Baştan Sona Toplam Süre Kartı */}
            {totalMinutes != null && (
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                    Baştan Sona Toplam Süre
                  </div>
                  <div className="text-xs text-slate-400">T3 - T1 (Açılıştan Kapanışa)</div>
                </div>
                <div className="text-sm font-extrabold text-slate-900 font-mono">
                  {formatMinutes(totalMinutes)}
                </div>
              </div>
            )}
          </div>

          {/* 3. TALEP TARİHÇESİ (LOGS) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>İşlem Tarihçesi</span>
            </h2>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {requestData.request_history && requestData.request_history.length > 0 ? (
                requestData.request_history.map((h) => (
                  <div key={h.id} className="text-xs border-l-2 border-slate-200 pl-3 py-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">
                        {STATUS_CONFIG[h.new_status]?.label || h.new_status}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDate(h.created_at)}
                      </span>
                    </div>
                    {h.note && <div className="text-slate-600 bg-slate-50 p-2 rounded-lg text-[11px]">{h.note}</div>}
                    <div className="text-[10px] text-slate-400">
                      İşlem Yapan: {h.changer?.full_name || 'Sistem'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">Tarihçe kaydı bulunamadı.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SONUÇLANDIRMA POP-UP (AÇILIR PENCERE / MODAL)
          KRİTİK KURAL: Açıklama/Not ZORUNLU alandır. Boşken "Kaydet" aktif olmaz!
         ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Başlık */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    modalAction === 'cozumlendi'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {modalAction === 'cozumlendi' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {modalAction === 'cozumlendi'
                      ? 'Talebi Çözüldü Olarak Kapat'
                      : 'Talebi Reddet'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Talep No: <span className="font-mono font-semibold">{requestData.request_number}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Bilgilendirme Notu */}
            <div
              className={`rounded-xl p-3 text-xs leading-relaxed ${
                modalAction === 'cozumlendi'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                  : 'bg-rose-50 text-rose-800 border border-rose-100'
              }`}
            >
              {modalAction === 'cozumlendi'
                ? 'Bu işlemle talep kapatılacak ve T3 kapanış süresi kaydedilecektir. Talep sahibine çözüm notu bildirim olarak gönderilir.'
                : 'Talep iptal/red edilecek ve gerekçeniz talep sahibine sistem bildirimi olarak iletilecektir.'}
            </div>

            <form onSubmit={handleResolutionSubmit} className="space-y-4">
              {/* ZORUNLU ALAN: Açıklama / Not */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Açıklama / Not <span className="text-rose-600 font-extrabold">* (Zorunlu Alan)</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder={
                    modalAction === 'cozumlendi'
                      ? 'Çözüm ile ilgili yapılan müdahale, işlem detayı veya onarım notunuzu giriniz...'
                      : 'Talebin neden reddedildiğine dair detaylı red sebebini giriniz...'
                  }
                  className="w-full text-sm rounded-xl border border-slate-200 p-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Bu alan doldurulmadan kayıt tamamlanamaz.</span>
                  <span className={resolutionNote.trim().length < 5 ? 'text-amber-600 font-semibold' : 'text-emerald-600'}>
                    {resolutionNote.trim().length} / min. 5 karakter
                  </span>
                </div>
              </div>

              {/* OPSİYONEL ALAN: Görsel Ekleme */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Görsel Ekleme <span className="text-slate-400 font-normal">(Opsiyonel Alan)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Yapılan onarımın fotoğrafı, tedarikçinin fişi veya tutanak belgesi URL adresi eklenebilir.
                </p>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={resolutionPhotoUrl}
                    onChange={(e) => setResolutionPhotoUrl(e.target.value)}
                    placeholder="https://... fotoğraf veya belge linki"
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhoto}
                    disabled={!resolutionPhotoUrl.trim()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl disabled:opacity-40"
                  >
                    Ekle
                  </button>
                </div>

                {/* Eklenen Görseller Önizleme */}
                {resolutionPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {resolutionPhotos.map((url, i) => (
                      <div
                        key={i}
                        className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Ek ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(i)}
                          className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Aksiyon Butonları */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={modalSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Vazgeç
                </button>

                {/* KRİTİK KURAL: Açıklama notu min 5 karakter olmadan disabled kalır! */}
                <button
                  type="submit"
                  disabled={resolutionNote.trim().length < 5 || modalSubmitting}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    modalAction === 'cozumlendi'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                  }`}
                >
                  {modalSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {modalAction === 'cozumlendi' ? 'Çözüldü Olarak Kaydet' : 'Reddet ve Kaydet'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
