'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  Bus,
  CalendarClock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Clock,
  Calendar,
  Building2,
  User,
  Save,
  Check,
  Printer,
  FileDown,
  ExternalLink,
  Camera,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Loader2,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import PhotoEvidenceUploader from '@/components/photo-evidence-uploader';
import { getAuditScoreBand } from '@/lib/audit-score';

interface Question {
  id: string;
  question_text: string;
  max_points: number;
  sort_order: number;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  max_score: number;
  sort_order: number;
  questions: Question[];
}

interface AuditAnswer {
  id?: string;
  question_id: string;
  answer: 'evet' | 'hayir' | 'na';
  score?: number;
  note?: string | null;
  due_date?: string | null;
  photo_url?: string | null;
  action_id?: string | null;
  action?: {
    id: string;
    action_number: string;
    status: string;
    due_date: string;
  } | null;
}

interface AuditDetail {
  id: string;
  title: string;
  module?: string;
  audit_date: string;
  planned_date?: string | null;
  completed_at?: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'approved' | string;
  total_score: number;
  max_possible_score: number;
  percentage: number;
  notes?: string;
  facility?: { id: string; name: string; city: string } | null;
  auditor?: { id: string; full_name: string; email: string } | null;
  service_vehicle?: {
    id: string;
    plate_number: string;
    route_name?: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;
  audit_type?: {
    id: string;
    name: string;
    module: string;
    max_score: number;
    categories: Category[];
  } | null;
  answers?: AuditAnswer[];
  photos?: Array<{ id: string; photo_url: string; photo_type: string; caption?: string }>;
}

export default function AuditRunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const auditId = resolvedParams.id;
  const router = useRouter();
  const supabase = createBrowserClient();

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [answersState, setAnswersState] = useState<
    Record<
      string,
      {
        answer: 'evet' | 'hayir' | 'na';
        note: string;
        due_date: string;
        photo_url: string;
      }
    >
  >({});

  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Genel görünüm fotoğrafları (Excel: "En az 1 fotoğraf zorunlu") — audit_photos (photo_type='general')
  const [generalPhotos, setGeneralPhotos] = useState<string[]>([]);
  // Planlanan tarih düzenleme (planlı denetim)
  const [isEditingPlanned, setIsEditingPlanned] = useState(false);
  const [plannedDraft, setPlannedDraft] = useState('');
  const [plannedSaving, setPlannedSaving] = useState(false);
  // PDF rapor indirme durumu (sunucu taraflı rapor)
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Load user role & audit data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile) setUserRole(profile.role);
        }

        const res = await fetch(`/api/audits/${auditId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Denetim bilgileri yüklenemedi.');
        }

        const json = await res.json();
        const auditData: AuditDetail = json.data;
        setAudit(auditData);

        // Genel görünüm fotoğraflarını state'e al
        setGeneralPhotos(
          (auditData.photos || [])
            .filter((p) => p.photo_type === 'general')
            .map((p) => p.photo_url)
        );

        // Prepopulate answersState
        const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        const initialMap: Record<
          string,
          {
            answer: 'evet' | 'hayir' | 'na';
            note: string;
            due_date: string;
            photo_url: string;
          }
        > = {};

        // Collect all questions
        const categories = auditData.audit_type?.categories || [];
        categories.forEach((cat) => {
          cat.questions?.forEach((q) => {
            initialMap[q.id] = {
              answer: 'na',
              note: '',
              due_date: defaultDue,
              photo_url: '',
            };
          });
        });

        // Overlay existing saved answers if any
        if (auditData.answers && auditData.answers.length > 0) {
          auditData.answers.forEach((ans) => {
            initialMap[ans.question_id] = {
              answer: ans.answer,
              note: ans.note || '',
              due_date: ans.due_date || defaultDue,
              photo_url: ans.photo_url || '',
            };
          });
        }

        setAnswersState(initialMap);
      } catch (err: any) {
        console.error('Audit detail fetch error:', err);
        setError(err.message || 'Denetim yüklenemedi.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [auditId]);

  // Toast timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Sunucu taraflı PDF raporunu indir (Excel: "PDF raporu")
  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    try {
      setPdfLoading(true);
      const res = await fetch(`/api/audits/${auditId}/pdf`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'PDF raporu oluşturulamadı.');
      }
      const blob = await res.blob();

      // Sunucudan gelen dosya adını kullan (yoksa varsayılan)
      let filename = 'denetim-raporu.pdf';
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      if (match && match[1]) filename = match[1];

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setToastMessage({ text: 'PDF raporu indirildi.', type: 'success' });
    } catch (err: any) {
      setToastMessage({
        text: err?.message || 'PDF raporu oluşturulamadı.',
        type: 'error',
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const categories = useMemo(() => {
    return audit?.audit_type?.categories || [];
  }, [audit]);

  const allQuestions = useMemo(() => {
    return categories.flatMap((c) => c.questions || []);
  }, [categories]);

  // Live Category and Total Score Calculation
  const scoreBreakdown = useMemo(() => {
    let totalScore = 0;
    const catScores: Record<
      string,
      { earned: number; max: number; percentage: number; hayirCount: number }
    > = {};

    categories.forEach((cat) => {
      const questions = cat.questions || [];
      let catMaxPoints = 0;
      let catEarnedPoints = 0;
      let hayirCount = 0;

      questions.forEach((q) => {
        const state = answersState[q.id];
        const ans = state?.answer || 'na';
        const weight = Number(q.max_points) || 1;

        if (ans === 'evet') {
          catEarnedPoints += weight;
          catMaxPoints += weight;
        } else if (ans === 'hayir') {
          catMaxPoints += weight;
          hayirCount++;
        }
        // 'na' excludes from both
      });

      const catMaxScore = Number(cat.max_score) || 0;
      const proportion = catMaxPoints > 0 ? catEarnedPoints / catMaxPoints : 1;
      const catEarned = Math.round(proportion * catMaxScore * 10) / 10;
      const catPct = catMaxPoints > 0 ? Math.round(proportion * 100) : 100;

      totalScore += catEarned;
      catScores[cat.id] = {
        earned: catEarned,
        max: catMaxScore,
        percentage: catPct,
        hayirCount,
      };
    });

    const finalTotal = Math.min(100, Math.max(0, Math.round(totalScore)));

    const nonConformitiesCount = Object.values(answersState).filter(
      (a) => a.answer === 'hayir'
    ).length;

    return {
      totalScore: finalTotal,
      categories: catScores,
      nonConformitiesCount,
    };
  }, [categories, answersState]);

  // N/A (yanıtlanmadı) soru sayısı — tamamlamak için tüm sorular Evet/Hayır olmalı
  const unansweredCount = useMemo(() => {
    return allQuestions.filter((q) => {
      const ans = answersState[q.id]?.answer || 'na';
      return ans === 'na';
    }).length;
  }, [allQuestions, answersState]);

  // Açıklaması eksik "Hayır" maddeleri — tamamlamak için her uygunsuzluğa açıklama zorunlu
  const missingNotesCount = useMemo(() => {
    return Object.values(answersState).filter(
      (a) => a.answer === 'hayir' && !a.note.trim()
    ).length;
  }, [answersState]);

  // En az 1 genel görünüm fotoğrafı zorunlu
  const hasGeneralPhoto = generalPhotos.length > 0;

  // Puan değerlendirme bandı (UYGUN / TAKİP GEREKİYOR / KRİTİK UYGUNSUZLUK)
  const scoreBand = getAuditScoreBand(scoreBreakdown.totalScore);

  // Handle Question Answer Change
  const handleAnswerSelect = (
    questionId: string,
    answer: 'evet' | 'hayir' | 'na'
  ) => {
    if (audit?.status === 'completed' || audit?.status === 'approved') return;
    setAnswersState((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        answer,
      },
    }));
  };

  const handleNoteChange = (questionId: string, note: string) => {
    if (audit?.status === 'completed' || audit?.status === 'approved') return;
    setAnswersState((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        note,
      },
    }));
  };

  const handleDueDateChange = (questionId: string, due_date: string) => {
    if (audit?.status === 'completed' || audit?.status === 'approved') return;
    setAnswersState((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        due_date,
      },
    }));
  };

  const handlePhotoUrlChange = (questionId: string, photo_url: string) => {
    if (audit?.status === 'completed' || audit?.status === 'approved') return;
    setAnswersState((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        photo_url,
      },
    }));
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const answersPayload = Object.entries(answersState).map(([qId, val]) => ({
        question_id: qId,
        answer: val.answer,
        note: val.note,
        due_date: val.due_date,
        photo_url: val.photo_url,
      }));

      const res = await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          answers: answersPayload,
          general_photos: generalPhotos,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Taslak kaydedilemedi.');
      }

      setToastMessage({
        text: 'Denetim taslağı başarıyla kaydedildi.',
        type: 'success',
      });
      // Refresh audit
      const refreshRes = await fetch(`/api/audits/${auditId}`);
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setAudit(json.data);
      }
    } catch (err: any) {
      setToastMessage({
        text: err.message || 'Taslak kaydedilirken bir hata oluştu.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Complete Audit
  const handleCompleteAudit = async () => {
    setIsCompleting(true);
    try {
      const answersPayload = Object.entries(answersState).map(([qId, val]) => ({
        question_id: qId,
        answer: val.answer,
        note: val.note,
        due_date: val.due_date,
        photo_url: val.photo_url,
      }));

      const res = await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          answers: answersPayload,
          general_photos: generalPhotos,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Denetim tamamlanamadı.');
      }

      setShowConfirmModal(false);
      setToastMessage({
        text: 'Denetim başarıyla tamamlandı! Uygunsuzluklar için aksiyonlar oluşturuldu ve sonuç yöneticilere bildirildi.',
        type: 'success',
      });

      // Reload fresh data with created actions
      const refreshRes = await fetch(`/api/audits/${auditId}`);
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setAudit(json.data);
      }
    } catch (err: any) {
      setToastMessage({
        text: err.message || 'Denetim tamamlanırken bir hata oluştu.',
        type: 'error',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  // Planlanan tarih güncelleme (planlı denetim)
  const handleSavePlannedDate = async () => {
    setPlannedSaving(true);
    try {
      const res = await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planned_date: plannedDraft || null }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Planlanan tarih güncellenemedi.');
      }
      const json = await res.json();
      setAudit((prev) => (prev ? { ...prev, planned_date: json.data?.planned_date ?? null } : prev));
      setToastMessage({
        text: plannedDraft ? 'Planlanan denetim tarihi güncellendi.' : 'Planlanan tarih kaldırıldı.',
        type: 'success',
      });
      setIsEditingPlanned(false);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Planlanan tarih güncellenemedi.', type: 'error' });
    } finally {
      setPlannedSaving(false);
    }
  };

  // Approve Audit (for Admin/Manager)
  const handleApproveAudit = async () => {
    try {
      const res = await fetch(`/api/audits/${auditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (res.ok) {
        setToastMessage({
          text: 'Denetim başarıyla onaylandı.',
          type: 'success',
        });
        const refreshRes = await fetch(`/api/audits/${auditId}`);
        if (refreshRes.ok) {
          const json = await refreshRes.json();
          setAudit(json.data);
        }
      }
    } catch {
      setToastMessage({ text: 'Onay verilemedi.', type: 'error' });
    }
  };

  const isCompleted =
    audit?.status === 'completed' || audit?.status === 'approved';

  // Planlı denetim göstergeleri
  const canPlanAudit = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'].includes(userRole);
  const plannedDateObj = audit?.planned_date ? new Date(`${audit.planned_date}T00:00:00`) : null;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const plannedOverdue = !!plannedDateObj && plannedDateObj < todayStart && !isCompleted;
  const plannedDaysLeft = plannedDateObj
    ? Math.round((plannedDateObj.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const plannedInfoLabel =
    plannedDaysLeft === null
      ? null
      : plannedDaysLeft < 0
      ? `${Math.abs(plannedDaysLeft)} gündür gecikmede`
      : plannedDaysLeft === 0
      ? 'Bugün'
      : `${plannedDaysLeft} gün kaldı`;
  const formatPlannedDate = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00`).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">
          Denetim soru formu ve puanlama tablosu yükleniyor...
        </p>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-rose-900">
            Denetime Erişilemedi
          </h2>
          <p className="text-sm text-rose-700 mt-1">
            {error || 'Kayıt bulunamadı.'}
          </p>
          <Link
            href="/dashboard/audits"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Denetim Listesine Dön
          </Link>
        </div>
      </div>
    );
  }

  // Answer map for lookup
  const answersLookup = new Map<string, AuditAnswer>();
  audit.answers?.forEach((a) => answersLookup.set(a.question_id, a));

  return (
    <div className="space-y-6 pb-24 print:pb-0 print:space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2.5 transition-all transform animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/audits"
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 shadow-sm transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {audit.audit_type?.name || 'Denetim'}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isCompleted
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {audit.status === 'completed'
                  ? 'Tamamlandı'
                  : audit.status === 'approved'
                  ? 'Yönetici Tarafından Onaylandı'
                  : 'Taslak / Devam Ediyor'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              {audit.title || audit.audit_type?.name}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {isCompleted && (
            <>
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-60"
              >
                {pdfLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                <span>{pdfLoading ? 'PDF Hazırlanıyor…' : 'PDF İndir'}</span>
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Yazdır</span>
              </button>
            </>
          )}

          {!isCompleted ? (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <Save className="w-4 h-4 text-slate-500" />
                )}
                <span>Taslak Kaydet</span>
              </button>
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={isCompleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all shadow-blue-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Denetimi Tamamla</span>
              </button>
            </>
          ) : (
            audit.status === 'completed' &&
            ['super_admin', 'company_admin', 'facility_manager'].includes(
              userRole
            ) && (
              <button
                onClick={handleApproveAudit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Yönetici Onayı Ver</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Audit Meta & Live Score Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        {/* Planlı Denetim Şeridi */}
        {(audit.planned_date || (canPlanAudit && !isCompleted)) && (
          <div
            className={`mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border px-4 py-3 ${
              plannedOverdue ? 'border-rose-200/80 bg-rose-50/60' : 'border-violet-200/80 bg-violet-50/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 bg-white rounded-xl border shadow-xs ${
                  plannedOverdue ? 'text-rose-600 border-rose-200/70' : 'text-violet-600 border-violet-200/70'
                }`}
              >
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <div
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    plannedOverdue ? 'text-rose-600' : 'text-violet-600'
                  }`}
                >
                  Planlı Denetim
                </div>
                {isEditingPlanned ? (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <input
                      type="date"
                      value={plannedDraft}
                      onChange={(e) => setPlannedDraft(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      onClick={handleSavePlannedDate}
                      disabled={plannedSaving}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {plannedSaving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      Kaydet
                    </button>
                    <button
                      onClick={() => setIsEditingPlanned(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-slate-800 flex flex-wrap items-center gap-2 mt-0.5">
                    {audit.planned_date ? (
                      <>
                        <span>{formatPlannedDate(audit.planned_date)}</span>
                        {plannedInfoLabel && (
                          <span
                            className={`text-xs font-semibold ${
                              plannedOverdue ? 'text-rose-600' : 'text-violet-600'
                            }`}
                          >
                            {plannedOverdue ? `⚠️ ${plannedInfoLabel}` : `• ${plannedInfoLabel}`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-500 font-medium">Planlanan tarih belirlenmedi</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {!isEditingPlanned && canPlanAudit && !isCompleted && (
              <button
                onClick={() => {
                  setPlannedDraft(audit.planned_date || '');
                  setIsEditingPlanned(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors self-start sm:self-center"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                {audit.planned_date ? 'Tarihi Değiştir' : 'Planla'}
              </button>
            )}
          </div>
        )}

        {/* Denetlenen Servis Aracı Şeridi (araç bazlı denetim) */}
        {audit.service_vehicle && (
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white text-indigo-600 rounded-xl border border-indigo-200/70 shadow-xs">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">
                  Denetlenen Servis Aracı
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-slate-900">
                    Hat: {audit.service_vehicle.route_name || 'Atanmamış'}
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-800 bg-white border border-indigo-200/70 px-2.5 py-0.5 rounded-lg tracking-wider">
                    {audit.service_vehicle.plate_number}
                  </span>
                </div>
              </div>
            </div>
            {(audit.service_vehicle.brand || audit.service_vehicle.model) && (
              <div className="text-xs text-indigo-700 font-medium sm:pr-1">
                {[audit.service_vehicle.brand, audit.service_vehicle.model].filter(Boolean).join(' ')}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Info Card 1: Facility */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-50 rounded-xl text-slate-600 border border-slate-100">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">
                Denetlenen Tesis
              </div>
              <div className="text-sm font-bold text-slate-800">
                {audit.facility?.name || 'Tesis Belirtilmedi'}
              </div>
              <div className="text-xs text-slate-500">
                {audit.facility?.city || 'Merkez'}
              </div>
            </div>
          </div>

          {/* Info Card 2: Auditor */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-50 rounded-xl text-slate-600 border border-slate-100">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">
                Denetçi / Sorumlu
              </div>
              <div className="text-sm font-bold text-slate-800">
                {audit.auditor?.full_name || 'Bilinmiyor'}
              </div>
              <div className="text-xs text-slate-500">
                {audit.auditor?.email || ''}
              </div>
            </div>
          </div>

          {/* Info Card 3: Date */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-50 rounded-xl text-slate-600 border border-slate-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">
                Denetim Tarihi
              </div>
              <div className="text-sm font-bold text-slate-800">
                {audit.audit_date
                  ? new Date(audit.audit_date).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '-'}
              </div>
              <div className="text-xs text-slate-500">
                Toplam {allQuestions.length} Kontrol Maddesi
              </div>
            </div>
          </div>

          {/* Info Card 4: Score Showcase */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
              scoreBreakdown.totalScore >= 80
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : scoreBreakdown.totalScore >= 60
                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                : 'bg-rose-50/70 border-rose-200 text-rose-900'
            }`}
          >
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-75">
                {isCompleted ? 'Nihai Denetim Puanı' : 'Anlık Puan (100 Puan)'}
              </div>
              <div className="text-2xl font-black tracking-tight mt-0.5">
                %{scoreBreakdown.totalScore}
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider mt-0.5 opacity-90">
                {scoreBand?.label}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-semibold px-2 py-1 rounded-lg bg-white/80 border border-current shadow-xs">
                {scoreBreakdown.nonConformitiesCount > 0 ? (
                  <span className="text-rose-700 font-bold">
                    ⚠️ {scoreBreakdown.nonConformitiesCount} Uygunsuzluk
                  </span>
                ) : (
                  <span className="text-emerald-700 font-bold">
                    ✓ 0 Uygunsuzluk
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Category Weight & Progress Bar Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center justify-between">
            <span>Kategori Bazlı Ağırlık Dağılımı ve Başarı Oranları</span>
            <span>Genel Toplam: %{scoreBreakdown.totalScore} / 100</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {categories.map((cat) => {
              const catStat = scoreBreakdown.categories[cat.id] || {
                earned: 0,
                max: cat.max_score,
                percentage: 100,
                hayirCount: 0,
              };

              return (
                <div
                  key={cat.id}
                  onClick={() =>
                    setActiveCategoryTab(
                      activeCategoryTab === cat.id ? 'all' : cat.id
                    )
                  }
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    activeCategoryTab === cat.id
                      ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-100 shadow-sm'
                      : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {cat.name}
                    </span>
                    <span className="text-[11px] font-bold text-slate-600 shrink-0">
                      {catStat.earned} / {cat.max_score}p
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        catStat.percentage >= 80
                          ? 'bg-emerald-500'
                          : catStat.percentage >= 60
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(catStat.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                    <span>{cat.questions?.length || 0} Madde</span>
                    {catStat.hayirCount > 0 ? (
                      <span className="text-rose-600 font-semibold">
                        {catStat.hayirCount} Hayır
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Kusursuz</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Genel Görünüm Fotoğrafı (Excel kuralı: en az 1 fotoğraf zorunlu) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm print:break-inside-avoid">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                hasGeneralPhoto
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-blue-50 text-blue-600 border-blue-100'
              }`}
            >
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Genel Görünüm Fotoğrafı
              </h3>
              <p className="text-[11px] text-slate-500">
                Sahanın genel görünümü — denetim tamamlanırken en az 1 fotoğraf
                zorunludur.
              </p>
            </div>
          </div>
          {!isCompleted && (
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                hasGeneralPhoto
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {hasGeneralPhoto
                ? `✓ ${generalPhotos.length} Fotoğraf Yüklendi`
                : '* Zorunlu'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          {generalPhotos.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Genel görünüm ${idx + 1}`}
                className="h-28 w-auto max-w-[260px] object-cover"
              />
              {!isCompleted && (
                <button
                  type="button"
                  title="Fotoğrafı kaldır"
                  onClick={() =>
                    setGeneralPhotos((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="absolute top-1 right-1 p-1.5 bg-white/95 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg border border-slate-200 shadow-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {!isCompleted && generalPhotos.length < 3 && (
            <div className="min-w-[220px]">
              <PhotoEvidenceUploader
                context="audit"
                auditId={auditId}
                currentUrl=""
                disabled={isCompleted}
                onChange={(url) => {
                  if (url) {
                    setGeneralPhotos((prev) =>
                      prev.includes(url) ? prev : [...prev, url]
                    );
                  }
                }}
                helperText=""
              />
            </div>
          )}

          {generalPhotos.length === 0 && isCompleted && (
            <p className="text-xs text-slate-400 italic">
              Bu denetim için genel görünüm fotoğrafı yüklenmemiş.
            </p>
          )}
        </div>

        {!isCompleted && generalPhotos.length > 0 && generalPhotos.length < 3 && (
          <p className="text-[10px] text-slate-400 mt-2">
            İsteğe bağlı: en fazla 3 genel görünüm fotoğrafı ekleyebilirsiniz.
          </p>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 print:hidden">
        <button
          onClick={() => setActiveCategoryTab('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors shrink-0 ${
            activeCategoryTab === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
          }`}
        >
          Tüm Kategoriler ({allQuestions.length} Soru)
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryTab(cat.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors shrink-0 ${
              activeCategoryTab === cat.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
            }`}
          >
            {cat.name} ({cat.questions?.length || 0})
          </button>
        ))}
      </div>

      {/* Questions Section grouped by Category */}
      <div className="space-y-6">
        {categories
          .filter(
            (cat) =>
              activeCategoryTab === 'all' || activeCategoryTab === cat.id
          )
          .map((cat, catIdx) => {
            const catStat = scoreBreakdown.categories[cat.id];
            const catQuestions = cat.questions || [];

            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
              >
                {/* Category Header */}
                <div className="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                      {catIdx + 1}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">
                      {cat.name}
                    </h2>
                    <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                      • Kategori Ağırlığı: {cat.max_score} Puan
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
                      Kazanılan: {catStat?.earned || 0} / {cat.max_score} Puan
                    </span>
                  </div>
                </div>

                {/* Questions List */}
                <div className="divide-y divide-slate-100">
                  {catQuestions.map((q, qIndex) => {
                    const state = answersState[q.id] || {
                      answer: 'na',
                      note: '',
                      due_date: '',
                      photo_url: '',
                    };
                    const existingSaved = answersLookup.get(q.id);
                    const isHayir = state.answer === 'hayir';

                    return (
                      <div
                        key={q.id}
                        className={`p-4 sm:p-5 transition-colors ${
                          isHayir
                            ? 'bg-rose-50/20'
                            : state.answer === 'na'
                            ? 'bg-slate-50/40'
                            : 'hover:bg-slate-50/30'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          {/* Question Text & Meta */}
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-400">
                                #{qIndex + 1}
                              </span>
                              {isHayir && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                                  <AlertTriangle className="w-3 h-3" />
                                  Uygunsuzluk Tespit Edildi
                                </span>
                              )}
                              {existingSaved?.action && (
                                <Link
                                  href={`/dashboard/actions/${existingSaved.action.id}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded-md transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Aksiyon: {existingSaved.action.action_number} (
                                  {existingSaved.action.status})
                                </Link>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                              {q.question_text}
                            </p>
                          </div>

                          {/* Answer Choice Buttons (Evet / Hayır / N/A) */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* EVET */}
                            <button
                              type="button"
                              disabled={isCompleted}
                              onClick={() => handleAnswerSelect(q.id, 'evet')}
                              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                state.answer === 'evet'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20'
                                  : 'bg-white hover:bg-emerald-50 text-slate-600 border-slate-200'
                              } ${
                                isCompleted
                                  ? 'cursor-default opacity-85'
                                  : 'active:scale-95'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Evet</span>
                            </button>

                            {/* HAYIR */}
                            <button
                              type="button"
                              disabled={isCompleted}
                              onClick={() => handleAnswerSelect(q.id, 'hayir')}
                              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                state.answer === 'hayir'
                                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/20'
                                  : 'bg-white hover:bg-rose-50 text-slate-600 border-slate-200'
                              } ${
                                isCompleted
                                  ? 'cursor-default opacity-85'
                                  : 'active:scale-95'
                              }`}
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Hayır</span>
                            </button>

                            {/* N/A */}
                            <button
                              type="button"
                              disabled={isCompleted}
                              onClick={() => handleAnswerSelect(q.id, 'na')}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                state.answer === 'na'
                                  ? 'bg-slate-700 text-white border-slate-700'
                                  : 'bg-white hover:bg-slate-100 text-slate-500 border-slate-200'
                              } ${
                                isCompleted
                                  ? 'cursor-default opacity-85'
                                  : 'active:scale-95'
                              }`}
                            >
                              <MinusCircle className="w-4 h-4" />
                              <span>N/A</span>
                            </button>
                          </div>
                        </div>

                        {/* Expandable Finding Details when "Hayır" is chosen */}
                        {isHayir && (
                          <div className="mt-4 p-4 bg-white rounded-xl border border-rose-200 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-rose-800 border-b border-rose-100 pb-2">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                Uygunsuzluk / Düzeltici Faaliyet Detayları
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {isCompleted
                                  ? 'Otomatik Aksiyon Oluşturuldu'
                                  : 'Denetim bitince otomatik Aksiyon açılır'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Açıklama */}
                              <div className="md:col-span-2 space-y-1">
                                <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                                  <span>Uygunsuzluk Açıklaması / Tespit:</span>
                                  {!isCompleted && (
                                    <span className="text-[10px] text-rose-600 font-bold">
                                      * Zorunlu
                                    </span>
                                  )}
                                </label>
                                <textarea
                                  disabled={isCompleted}
                                  value={state.note}
                                  onChange={(e) =>
                                    handleNoteChange(q.id, e.target.value)
                                  }
                                  placeholder="Sahada tespit edilen aksaklık ve giderilmesi gereken durumu yazınız..."
                                  rows={2}
                                  className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50 disabled:bg-slate-100"
                                />
                              </div>

                              {/* Termin Tarihi (Deadline) */}
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Termin Tarihi (Deadline):</span>
                                </label>
                                <input
                                  type="date"
                                  disabled={isCompleted}
                                  value={state.due_date}
                                  onChange={(e) =>
                                    handleDueDateChange(q.id, e.target.value)
                                  }
                                  className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50 disabled:bg-slate-100"
                                />
                                <div className="text-[10px] text-slate-400">
                                  Aksiyon sorumlu kişiye bu terminle atanır.
                                </div>
                              </div>
                            </div>

                            {/* Fotoğraf / Kanıt (cihazdan görsel yükleme) */}
                            <div className="space-y-1 pt-1">
                              <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-slate-400" />
                                <span>Fotoğraf / Kanıt:</span>
                              </label>
                              <PhotoEvidenceUploader
                                context="audit"
                                auditId={auditId}
                                questionId={q.id}
                                currentUrl={state.photo_url}
                                disabled={isCompleted}
                                onChange={(url) => handlePhotoUrlChange(q.id, url)}
                                helperText="Uygunsuzluğa ait görseli yükleyin (JPG, PNG, WEBP) — en fazla 10 MB"
                              />
                            </div>
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

      {/* Sticky Bottom Actions Bar (Mobile & Desktop) */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-lg print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-xs">
                <span className="text-slate-500">Mevcut Skor: </span>
                <span className="font-bold text-slate-900 text-sm">
                  %{scoreBreakdown.totalScore}
                </span>
              </div>
              <div className="hidden sm:block h-4 w-px bg-slate-200" />
              <div className="hidden sm:flex items-center gap-2 text-xs">
                {scoreBreakdown.nonConformitiesCount > 0 ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {scoreBreakdown.nonConformitiesCount} Uygunsuzluk
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Uygunsuzluk Yok
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Taslak Kaydet</span>
              </button>

              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={isCompleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Denetimi Tamamla</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Complete */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-slate-900 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  Denetimi Tamamlamak Üzeresiniz
                </h3>
                <p className="text-xs text-slate-500">
                  Denetim sonuçları kaydedilecek ve puanlama kilitlenecektir.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Hesaplanan Toplam Puan:</span>
                <span className="font-bold text-slate-900 text-sm">
                  %{scoreBreakdown.totalScore} / 100
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Genel Değerlendirme:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wide ${scoreBand?.chipClass || ''}`}
                >
                  {scoreBand?.label}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">
                  Tespit Edilen Uygunsuzluk ("Hayır"):
                </span>
                <span className="font-bold text-rose-600">
                  {scoreBreakdown.nonConformitiesCount} Adet
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Yanıtlanmayan (N/A):</span>
                <span
                  className={`font-bold ${
                    unansweredCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {unansweredCount} Adet
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">
                  Açıklaması Eksik Uygunsuzluk:
                </span>
                <span
                  className={`font-bold ${
                    missingNotesCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {missingNotesCount} Adet
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Genel Görünüm Fotoğrafı:</span>
                <span
                  className={`font-bold ${
                    hasGeneralPhoto ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {hasGeneralPhoto
                    ? `✓ ${generalPhotos.length} Fotoğraf`
                    : '⚠ Eksik (Zorunlu)'}
                </span>
              </div>
              {scoreBreakdown.nonConformitiesCount > 0 && (
                <div className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 mt-2">
                  ℹ️ "Hayır" olarak işaretlenen her madde için sisteme otomatik
                  olarak terminli <strong>Aksiyon (ACT-...)</strong> kaydı
                  açılacaktır.
                  {audit.service_vehicle && (
                    <>
                      {' '}
                      Aksiyonlar{' '}
                      <strong>
                        {audit.service_vehicle.plate_number}
                        {audit.service_vehicle.route_name
                          ? ` (${audit.service_vehicle.route_name})`
                          : ''}
                      </strong>{' '}
                      aracına bağlanır.
                    </>
                  )}
                </div>
              )}
            </div>

            {unansweredCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <strong>{unansweredCount} soru hâlâ N/A (yanıtlanmadı).</strong>{' '}
                  Tüm sorular Evet veya Hayır olarak yanıtlanmadan denetim
                  tamamlanamaz. Çalışmanızı <strong>Taslak Kaydet</strong> ile
                  saklayıp daha sonra kaldığınız yerden devam edebilirsiniz.
                </div>
              </div>
            )}

            {!hasGeneralPhoto && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                <Camera className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-800">
                  <strong>Genel görünüm fotoğrafı zorunludur.</strong> Denetimi
                  tamamlamadan önce formun üst kısmındaki{" "}
                  <strong>Genel Görünüm Fotoğrafı</strong> bölümünden sahanın
                  genel görünümüne ait en az 1 fotoğraf yükleyin.
                </div>
              </div>
            )}

            {missingNotesCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <strong>
                    {missingNotesCount} uygunsuzluk ("Hayır") maddesinin açıklaması
                    eksik.
                  </strong>{' '}
                  Tamamlamak için her uygunsuzluğa tespit açıklaması yazın.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isCompleting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={
                  isCompleting ||
                  unansweredCount > 0 ||
                  missingNotesCount > 0 ||
                  !hasGeneralPhoto
                }
                onClick={handleCompleteAudit}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCompleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Onayla ve Tamamla</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
