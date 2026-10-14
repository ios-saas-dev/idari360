'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  User,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  ClipboardCheck,
  FileText,
  Camera,
  Image as ImageIcon,
  ArrowRight,
  PlayCircle,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Shield,
  UserCheck,
  Target,
  Save,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

// ─── Interfaces ────────────────────────────────────────────────────

interface ActionDetail {
  id: string;
  action_number?: string;
  title: string;
  description?: string;
  category: string;
  priority: 'dusuk' | 'orta' | 'yuksek' | 'kritik';
  status: 'acik' | 'devam_ediyor' | 'kapali' | 'gecikti';
  due_date?: string | null;
  closed_at?: string | null;
  evidence_note?: string | null;
  audit_id?: string | null;
  audit_answer_id?: string | null;
  audit_question_id?: string | null;
  responsible_user_id?: string | null;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  company_id: string;
  facility_id?: string | null;
  responsible?: { id: string; full_name: string; email?: string; avatar_url?: string } | null;
  creator?: { id: string; full_name: string; email?: string } | null;
  facility?: { id: string; name: string; city?: string } | null;
  action_history?: ActionHistoryEntry[];
  action_photos?: ActionPhoto[];
  audit?: {
    id: string;
    title?: string;
    audit_date?: string;
    total_score?: number;
    max_possible_score?: number;
    percentage?: number;
    status?: string;
    audit_type?: { id: string; name: string; module?: string } | null;
  } | null;
  audit_answer?: {
    id?: string;
    answer?: string;
    note?: string;
    photo_url?: string;
    due_date?: string;
    question?: { id: string; question_text: string } | null;
  } | null;
}

interface ActionHistoryEntry {
  id: string;
  old_status?: string | null;
  new_status: string;
  note?: string | null;
  created_at: string;
  changer?: { id: string; full_name: string } | null;
}

interface ActionPhoto {
  id: string;
  photo_url: string;
  created_at: string;
  uploader?: { id: string; full_name: string } | null;
}

interface ProfileItem {
  id: string;
  full_name: string;
  email?: string;
}

// ─── Config & Helpers ──────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string; icon: React.ReactNode }> = {
  acik: {
    label: 'Açık',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  devam_ediyor: {
    label: 'Devam Ediyor',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    icon: <PlayCircle className="w-4 h-4" />,
  },
  kapali: {
    label: 'Kapalı / Çözüldü',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  gecikti: {
    label: 'Gecikti',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  dusuk: { label: 'Düşük', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  orta: { label: 'Orta', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  yuksek: { label: 'Yüksek', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  kritik: { label: 'Kritik', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300' },
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function isOverdue(dueDate?: string | null, status?: string) {
  if (!dueDate || status === 'kapali') return false;
  const target = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target < today;
}

function getEffectiveStatus(status: string, dueDate?: string | null) {
  if ((status === 'acik' || status === 'devam_ediyor') && isOverdue(dueDate, status)) {
    return 'gecikti';
  }
  return status;
}

// ─── Page Component ────────────────────────────────────────────────

export default function ActionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createBrowserClient();

  // ─── State ─────────────────────────────────────────────────
  const [action, setAction] = useState<ActionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status change
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [showStatusNote, setShowStatusNote] = useState<string | null>(null);

  // Resolution / evidence
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [afterPhotoUrl, setAfterPhotoUrl] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);

  // Assignment
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [selectedResponsible, setSelectedResponsible] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  // Sections expand
  const [showTimeline, setShowTimeline] = useState(true);

  // ─── Data Fetching ─────────────────────────────────────────

  const fetchAction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/actions/${id}`);
      if (!res.ok) throw new Error('Aksiyon yüklenirken hata oluştu');
      const json = await res.json();
      setAction(json.data);
      setEvidenceNote(json.data.evidence_note || '');
      setSelectedResponsible(json.data.responsible_user_id || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAction();
  }, [fetchAction]);

  // Load profiles for assignment dropdown
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
          .eq('is_active', true)
          .order('full_name');
        if (data) setProfiles(data);
      }
    }
    loadProfiles();
  }, [supabase]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleStatusChange = async (newStatus: string) => {
    if (!action) return;
    setStatusChanging(true);
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          note: statusNote.trim() || getStatusChangeDefaultNote(action.status, newStatus),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Durum güncellenemedi');
      }
      setStatusNote('');
      setShowStatusNote(null);
      await fetchAction();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setStatusChanging(false);
    }
  };

  const handleSaveEvidence = async () => {
    if (!action) return;
    setEvidenceSaving(true);
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence_note: evidenceNote.trim() }),
      });
      if (!res.ok) throw new Error('Çözüm notu kaydedilemedi');
      await fetchAction();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setEvidenceSaving(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!afterPhotoUrl.trim()) return;
    setPhotoSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Oturum hatası');
      const { error: photoErr } = await supabase.from('action_photos').insert({
        action_id: id,
        photo_url: afterPhotoUrl.trim(),
        uploaded_by: user.id,
      });
      if (photoErr) throw new Error(photoErr.message);
      setAfterPhotoUrl('');
      await fetchAction();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Fotoğraf eklenemedi');
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleAssignChange = async () => {
    if (!selectedResponsible || !action) return;
    if (selectedResponsible === action.responsible_user_id) return;
    setAssignSaving(true);
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responsible_user_id: selectedResponsible,
          note: 'Sorumlu kişi değiştirildi',
        }),
      });
      if (!res.ok) throw new Error('Atama güncellenemedi');
      await fetchAction();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setAssignSaving(false);
    }
  };

  function getStatusChangeDefaultNote(from: string, to: string): string {
    const fromLabel = STATUS_CONFIG[from]?.label || from;
    const toLabel = STATUS_CONFIG[to]?.label || to;
    return `${fromLabel} → ${toLabel}`;
  }

  // ─── Computed ──────────────────────────────────────────────

  const effectiveStatus = action ? getEffectiveStatus(action.status, action.due_date) : 'acik';
  const statusCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.acik;
  const priorityCfg = action ? PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG.orta : PRIORITY_CONFIG.orta;

  const sortedHistory = (action?.action_history || []).slice().sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Valid status transitions
  const getTransitions = (status: string): Array<{ target: string; label: string; color: string; icon: React.ReactNode }> => {
    const transitions: Array<{ target: string; label: string; color: string; icon: React.ReactNode }> = [];
    switch (status) {
      case 'acik':
        transitions.push(
          { target: 'devam_ediyor', label: 'İşleme Al', color: 'bg-amber-500 hover:bg-amber-600', icon: <PlayCircle className="w-4 h-4" /> },
          { target: 'kapali', label: 'Doğrudan Kapat', color: 'bg-emerald-500 hover:bg-emerald-600', icon: <CheckCircle2 className="w-4 h-4" /> }
        );
        break;
      case 'devam_ediyor':
        transitions.push(
          { target: 'kapali', label: 'Çözüldü / Kapat', color: 'bg-emerald-500 hover:bg-emerald-600', icon: <CheckCircle2 className="w-4 h-4" /> }
        );
        break;
      case 'kapali':
        transitions.push(
          { target: 'acik', label: 'Yeniden Aç', color: 'bg-blue-500 hover:bg-blue-600', icon: <RotateCcw className="w-4 h-4" /> }
        );
        break;
      case 'gecikti':
        transitions.push(
          { target: 'devam_ediyor', label: 'İşleme Al', color: 'bg-amber-500 hover:bg-amber-600', icon: <PlayCircle className="w-4 h-4" /> },
          { target: 'kapali', label: 'Çözüldü / Kapat', color: 'bg-emerald-500 hover:bg-emerald-600', icon: <CheckCircle2 className="w-4 h-4" /> }
        );
        break;
    }
    // Always allow reopen from any non-acik state
    if (status !== 'acik' && status !== 'kapali') {
      transitions.push(
        { target: 'acik', label: 'Yeniden Aç', color: 'bg-blue-500 hover:bg-blue-600', icon: <RotateCcw className="w-4 h-4" /> }
      );
    }
    return transitions;
  };

  // ─── Render: Loading / Error ───────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Aksiyon yükleniyor...</p>
      </div>
    );
  }

  if (error || !action) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 gap-4">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2 max-w-md">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-rose-700">{error || 'Aksiyon bulunamadı'}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={fetchAction}
              className="px-4 py-2 text-xs font-medium bg-rose-100 text-rose-700 rounded-xl hover:bg-rose-200 transition-colors"
            >
              Tekrar Dene
            </button>
            <Link
              href="/dashboard/actions"
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Listeye Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      {/* Back button & header */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/actions"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Aksiyonlar</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-mono font-semibold text-blue-600">
            {action.action_number || `ACT-${action.id.slice(0, 6).toUpperCase()}`}
          </span>
        </div>

        {/* Action Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text} border ${statusCfg.border}`}>
                  {statusCfg.icon}
                  {statusCfg.label}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.text} border ${priorityCfg.border} ${action.priority === 'kritik' ? 'animate-pulse' : ''}`}>
                  {priorityCfg.label}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {CATEGORY_LABELS[action.category] || action.category}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">{action.title}</h1>
              {action.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{action.description}</p>
              )}
            </div>
            {/* Due date warning */}
            {action.due_date && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${isOverdue(action.due_date, action.status) ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                <Calendar className="w-4 h-4" />
                <span>Termin: {formatShortDate(action.due_date)}</span>
                {isOverdue(action.due_date, action.status) && (
                  <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-bold">GECİKTİ</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ═══════════════════════ LEFT COLUMN ═══════════════════════ */}
          <div className="lg:col-span-7 space-y-6">

            {/* ── Denetim Bağlantısı (Audit Link) ── */}
            {action.audit && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-900">Denetim Bağlantısı</h2>
                </div>

                <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">
                        {action.audit.audit_type?.name || 'Denetim'}
                      </p>
                      <p className="font-semibold text-slate-800">
                        {action.audit.title || 'Denetim Raporu'}
                      </p>
                      {action.audit.audit_date && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatShortDate(action.audit.audit_date)}
                        </p>
                      )}
                    </div>
                    {action.audit.percentage != null && (
                      <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl ${action.audit.percentage >= 80 ? 'bg-emerald-100 text-emerald-700' : action.audit.percentage >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        <span className="text-lg font-bold">{Math.round(action.audit.percentage)}%</span>
                        <span className="text-[10px] font-medium">Puan</span>
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/audits/${action.audit.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Denetimi Görüntüle
                  </Link>
                </div>
              </div>
            )}

            {/* ── Uygunsuzluk Detayı (Finding Detail) ── */}
            {action.audit_answer && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-900">Uygunsuzluk Detayı</h2>
                </div>

                {/* Question text */}
                {action.audit_answer.question && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-medium text-slate-500 mb-1">Denetim Sorusu</p>
                    <p className="text-sm font-medium text-slate-800">
                      {action.audit_answer.question.question_text}
                    </p>
                  </div>
                )}

                {/* Finding note */}
                {action.audit_answer.note && (
                  <div className="bg-rose-50/50 rounded-xl border border-rose-100 p-4">
                    <p className="text-xs font-medium text-rose-600 mb-1">Uygunsuzluk Açıklaması</p>
                    <p className="text-sm text-slate-700">{action.audit_answer.note}</p>
                  </div>
                )}

                {/* Before photo */}
                {action.audit_answer.photo_url && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      Öncesi Fotoğraf (Tespit Anı)
                    </p>
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <img
                        src={action.audit_answer.photo_url}
                        alt="Uygunsuzluk fotoğrafı"
                        className="w-full max-h-64 object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Çözüm / Düzeltici Faaliyet ── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900">Çözüm / Düzeltici Faaliyet</h2>
              </div>

              {/* Evidence note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Çözüm Açıklaması
                </label>
                <textarea
                  rows={4}
                  placeholder="Yapılan düzeltici faaliyeti detaylı açıklayın..."
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSaveEvidence}
                    disabled={evidenceSaving || evidenceNote === (action.evidence_note || '')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {evidenceSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Kaydet
                  </button>
                </div>
              </div>

              {/* Before / After Comparison */}
              {(action.audit_answer?.photo_url || (action.action_photos && action.action_photos.length > 0)) && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-3">Öncesi / Sonrası Karşılaştırma</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Before */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Öncesi
                      </p>
                      {action.audit_answer?.photo_url ? (
                        <div className="rounded-xl overflow-hidden border-2 border-rose-200 bg-slate-100">
                          <img
                            src={action.audit_answer.photo_url}
                            alt="Öncesi"
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 h-48 flex items-center justify-center">
                          <p className="text-xs text-slate-400">Fotoğraf yok</p>
                        </div>
                      )}
                    </div>
                    {/* After */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Sonrası
                      </p>
                      {action.action_photos && action.action_photos.length > 0 ? (
                        <div className="rounded-xl overflow-hidden border-2 border-emerald-200 bg-slate-100">
                          <img
                            src={action.action_photos[action.action_photos.length - 1].photo_url}
                            alt="Sonrası"
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 h-48 flex items-center justify-center">
                          <p className="text-xs text-slate-400">Henüz eklenmedi</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Add After Photo */}
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sonrası Fotoğraf Ekle (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://... fotoğraf URL'si yapıştırın"
                    value={afterPhotoUrl}
                    onChange={(e) => setAfterPhotoUrl(e.target.value)}
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleAddPhoto}
                    disabled={photoSaving || !afterPhotoUrl.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    {photoSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    Ekle
                  </button>
                </div>
              </div>

              {/* Existing photos grid */}
              {action.action_photos && action.action_photos.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    Yüklenen Fotoğraflar ({action.action_photos.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {action.action_photos.map((photo) => (
                      <div key={photo.id} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group relative">
                        <img
                          src={photo.photo_url}
                          alt="Aksiyon fotoğrafı"
                          className="w-full h-32 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-[10px] text-white/80">
                            {photo.uploader?.full_name || '—'} • {formatShortDate(photo.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Aksiyon Tarihçesi (Timeline) ── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowTimeline(!showTimeline)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <History className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-900">Aksiyon Tarihçesi</h2>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {sortedHistory.length} kayıt
                  </span>
                </div>
                {showTimeline ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {showTimeline && (
                <div className="px-6 pb-6">
                  {sortedHistory.length === 0 ? (
                    <div className="text-center py-6 text-sm text-slate-400">
                      <History className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      Henüz tarihçe kaydı yok
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-slate-200" />

                      <div className="space-y-4">
                        {sortedHistory.map((entry, idx) => {
                          const entryCfg = STATUS_CONFIG[entry.new_status] || STATUS_CONFIG.acik;
                          return (
                            <div key={entry.id} className="relative flex gap-4 pl-1">
                              {/* Dot */}
                              <div className={`relative z-10 w-[30px] h-[30px] flex items-center justify-center rounded-full border-2 border-white shadow-sm ${entryCfg.dot}`}>
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                              {/* Content */}
                              <div className="flex-1 pb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  {entry.old_status && (
                                    <>
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_CONFIG[entry.old_status]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[entry.old_status]?.text || 'text-slate-600'}`}>
                                        {STATUS_CONFIG[entry.old_status]?.label || entry.old_status}
                                      </span>
                                      <ArrowRight className="w-3 h-3 text-slate-400" />
                                    </>
                                  )}
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${entryCfg.bg} ${entryCfg.text}`}>
                                    {entryCfg.label}
                                  </span>
                                </div>
                                {entry.note && (
                                  <p className="text-xs text-slate-600 mt-1">{entry.note}</p>
                                )}
                                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                                  {entry.changer?.full_name && (
                                    <>
                                      <User className="w-3 h-3" />
                                      <span>{entry.changer.full_name}</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  <Clock className="w-3 h-3" />
                                  {formatDate(entry.created_at)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════ RIGHT COLUMN ═══════════════════════ */}
          <div className="lg:col-span-5 space-y-6">

            {/* ── Durum Yönetimi (Status Management) ── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Target className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900">Durum Yönetimi</h2>
              </div>

              {/* Current status display */}
              <div className={`flex items-center gap-3 p-4 rounded-xl ${statusCfg.bg} border ${statusCfg.border}`}>
                <div className={`w-3 h-3 rounded-full ${statusCfg.dot}`} />
                <span className={`text-sm font-semibold ${statusCfg.text}`}>
                  Mevcut Durum: {statusCfg.label}
                </span>
              </div>

              {/* Transition buttons */}
              <div className="space-y-2">
                {getTransitions(action.status).map((transition) => (
                  <div key={transition.target}>
                    {showStatusNote === transition.target ? (
                      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                        <textarea
                          rows={2}
                          placeholder="Not ekleyin (isteğe bağlı)..."
                          value={statusNote}
                          onChange={(e) => setStatusNote(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setShowStatusNote(null);
                              setStatusNote('');
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            İptal
                          </button>
                          <button
                            onClick={() => handleStatusChange(transition.target)}
                            disabled={statusChanging}
                            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white rounded-lg shadow-sm transition-all disabled:opacity-50 ${transition.color}`}
                          >
                            {statusChanging ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              transition.icon
                            )}
                            {transition.label}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowStatusNote(transition.target)}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl shadow-sm transition-all ${transition.color}`}
                      >
                        {transition.icon}
                        {transition.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Atama Kartı ── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900">Sorumlu Kişi</h2>
              </div>

              {/* Current assignee */}
              {action.responsible && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-200">
                    {getInitials(action.responsible.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{action.responsible.full_name}</p>
                    {action.responsible.email && (
                      <p className="text-xs text-slate-400">{action.responsible.email}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sorumlu Değiştir</label>
                <select
                  value={selectedResponsible}
                  onChange={(e) => setSelectedResponsible(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Kişi Seçiniz...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.email ? `(${p.email})` : ''}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAssignChange}
                    disabled={assignSaving || !selectedResponsible || selectedResponsible === action.responsible_user_id}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assignSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Kaydet
                  </button>
                </div>
              </div>
            </div>

            {/* ── Bilgi Kartı ── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-slate-900">Bilgiler</h2>
              </div>

              <div className="space-y-3">
                {/* Created */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Oluşturulma
                  </span>
                  <span className="text-slate-700 font-medium text-xs">{formatDate(action.created_at)}</span>
                </div>

                {/* Due date */}
                {action.due_date && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Termin Tarihi
                    </span>
                    <span className={`font-medium text-xs ${isOverdue(action.due_date, action.status) ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                      {formatShortDate(action.due_date)}
                    </span>
                  </div>
                )}

                {/* Closed at */}
                {action.closed_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Kapanış
                    </span>
                    <span className="text-emerald-600 font-medium text-xs">{formatDate(action.closed_at)}</span>
                  </div>
                )}

                {/* Creator */}
                {action.creator && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Oluşturan
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold border border-slate-200">
                        {getInitials(action.creator.full_name)}
                      </div>
                      <span className="text-slate-700 font-medium text-xs">{action.creator.full_name}</span>
                    </div>
                  </div>
                )}

                {/* Facility */}
                {action.facility && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Tesis
                    </span>
                    <span className="text-slate-700 font-medium text-xs">{action.facility.name}</span>
                  </div>
                )}

                {/* Category */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5" /> Kategori
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {CATEGORY_LABELS[action.category] || action.category}
                  </span>
                </div>
              </div>
            </div>

            {/* ── İlgili Denetim Kartı (Compact Audit Card) ── */}
            {action.audit && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-900">İlgili Denetim</h2>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-800">
                      {action.audit.audit_type?.name || 'Denetim'}
                    </p>
                    {action.audit.audit_date && (
                      <p className="text-xs text-slate-500">{formatShortDate(action.audit.audit_date)}</p>
                    )}
                  </div>
                  {action.audit.percentage != null && (
                    <span className={`text-lg font-bold px-3 py-1 rounded-xl ${action.audit.percentage >= 80 ? 'bg-emerald-50 text-emerald-700' : action.audit.percentage >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                      {Math.round(action.audit.percentage)}%
                    </span>
                  )}
                </div>

                <Link
                  href={`/dashboard/audits/${action.audit.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors mt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Denetim Detayına Git
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
