'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Loader2,
  AlertCircle,
  ClipboardList,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  Award,
  Users,
  SprayCan,
  MessageSquare,
  CalendarClock,
  Wrench,
} from 'lucide-react';
import { getAuditScoreBand } from '@/lib/audit-score';
import type { FacilityHealth } from '@/lib/facility-health';

interface HealthPart {
  key: string;
  label: string;
  score: number | null;
  detail: string;
}

interface DetailData {
  facility: {
    id: string;
    name: string;
    code: string;
    city?: string;
    region?: string;
    address?: string;
    is_active: boolean;
    companies?: { name: string };
  };
  health: FacilityHealth;
  kpi: {
    open_requests: number;
    total_requests: number;
    solved_requests: number;
    avg_response_minutes: number | null;
    avg_audit_score: number | null;
    audit_count: number;
    satisfaction_avg: number | null;
    satisfaction_count: number;
    open_actions: number;
    overdue_actions: number;
    assets_total: number;
    assets_broken: number;
    staff_active: number;
    users_active: number;
  };
  audit_trend: Array<{ month: string; month_key: string; avg: number | null; count: number }>;
  recent_audits: Array<{
    id: string;
    audit_date: string;
    percentage: number;
    status: string;
    type_name: string;
  }>;
  recent_requests: Array<{
    id: string;
    request_number: string;
    status: string;
    category: string;
    priority: string;
    created_at: string;
    assignee_name: string | null;
  }>;
  open_actions: Array<{
    id: string;
    action_number: string;
    title: string;
    priority: string;
    status: string;
    due_date: string | null;
    overdue: boolean;
    responsible_name: string | null;
  }>;
  assets_by_status: Record<string, number>;
  staff: Array<{ id: string; full_name: string; position: string | null; is_active: boolean }>;
  equipment: Array<{ id: string; name: string; type: string | null; quantity: number; condition: string | null }>;
  recent_satisfaction: Array<{ score: number; comment: string | null; created_at: string }>;
}

// ----- Etiketler -----
const REQUEST_STATUS_LABELS: Record<string, string> = {
  yeni: 'Yeni',
  atandi: 'Atandı',
  onaylandi: 'Onaylandı',
  islemde: 'İşlemde',
  tamamlandi: 'Tamamlandı',
  cozumlendi: 'Çözüldü',
  reddedildi: 'Reddedildi',
};

const REQUEST_STATUS_CLASSES: Record<string, string> = {
  yeni: 'bg-blue-50 text-blue-700 border-blue-200',
  atandi: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  onaylandi: 'bg-purple-50 text-purple-700 border-purple-200',
  islemde: 'bg-amber-50 text-amber-700 border-amber-200',
  tamamlandi: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cozumlendi: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reddedildi: 'bg-rose-50 text-rose-700 border-rose-200',
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

const AUDIT_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  approved: 'Onaylandı',
};

const PRIORITY_LABELS: Record<string, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
};

const PRIORITY_CLASSES: Record<string, string> = {
  dusuk: 'bg-slate-100 text-slate-700 border-slate-200',
  orta: 'bg-blue-50 text-blue-700 border-blue-200',
  yuksek: 'bg-amber-50 text-amber-700 border-amber-200',
  kritik: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ASSET_STATUS_LABELS: Record<string, string> = {
  aktif: 'Aktif',
  devirde: 'Devirde',
  iade: 'İade',
  ariza: 'Arızalı',
  bakimda: 'Bakımda',
  kayip: 'Kayıp',
  hurda: 'Hurda',
};

const ASSET_STATUS_CLASSES: Record<string, string> = {
  aktif: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  devirde: 'bg-blue-50 text-blue-700 border-blue-200',
  iade: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ariza: 'bg-rose-50 text-rose-700 border-rose-200',
  bakimda: 'bg-amber-50 text-amber-700 border-amber-200',
  kayip: 'bg-slate-100 text-slate-700 border-slate-200',
  hurda: 'bg-slate-100 text-slate-500 border-slate-200',
};

const HEALTH_COLORS: Record<string, { dot: string; badge: string; card: string }> = {
  green: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    card: 'border-emerald-200/80 bg-emerald-50/20',
  },
  amber: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    card: 'border-amber-200/80 bg-amber-50/20',
  },
  red: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    card: 'border-rose-200/80 bg-rose-50/20',
  },
  gray: {
    dot: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    card: 'border-slate-200/80',
  },
};

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function partScoreClass(score: number | null) {
  if (score == null) return 'text-slate-300';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-rose-600';
}

export default function BranchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/facilities/${id}/detail`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(result.error || 'Şube detayı yüklenemedi.');
        }
        setData(result.data);
      } catch (err: any) {
        setError(err.message || 'Veriler alınamadı.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Şube 360° verileri yükleniyor...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/dashboard/branches')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Şubelere Dön
        </button>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Hata:</span> {error || 'Şube bulunamadı.'}
          </div>
        </div>
      </div>
    );
  }

  const { facility, health, kpi, audit_trend, recent_audits, recent_requests, open_actions, assets_by_status, staff, equipment, recent_satisfaction } = data;
  const palette = HEALTH_COLORS[health.color] || HEALTH_COLORS.gray;
  const maxTrend = Math.max(...audit_trend.map((t) => t.avg || 0), 100);

  return (
    <div className="space-y-6">
      {/* Geri + Başlık */}
      <div>
        <button
          onClick={() => router.push('/dashboard/branches')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Şubelere Dön
        </button>

        <div className={`bg-white rounded-2xl border shadow-sm p-6 ${palette.card}`}>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 flex-shrink-0">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{facility.name}</h1>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200/60">
                    {facility.code}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      facility.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${facility.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {facility.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-slate-800">{facility.city || 'Belirtilmemiş'}</span>
                  {facility.region && <span className="text-slate-400">({facility.region} Bölgesi)</span>}
                  {facility.companies?.name && (
                    <span className="text-slate-400">• {facility.companies.name}</span>
                  )}
                </div>
                {facility.address && (
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-2xl">{facility.address}</p>
                )}
              </div>
            </div>

            {/* Sağlık Rozeti */}
            <div className={`rounded-2xl border p-4 text-center flex-shrink-0 min-w-[170px] ${palette.card}`}>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Şube Sağlık Skoru
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono">
                {health.score != null ? health.score : '—'}
                {health.score != null && <span className="text-sm text-slate-400 font-sans">/100</span>}
              </div>
              <span
                className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${palette.badge}`}
              >
                <span className={`w-2 h-2 rounded-full ${palette.dot}`} />
                {health.label}
              </span>
              <div className="text-[10px] text-slate-400 mt-2">Son 90 gün verisiyle</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Açık Talep</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">{kpi.open_requests}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Toplam {kpi.total_requests} · Çözülen {kpi.solved_requests}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Denetim Puanı (90g)</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {kpi.avg_audit_score != null ? kpi.avg_audit_score : '—'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {kpi.audit_count > 0 ? `${kpi.audit_count} denetim ortalaması` : 'Tamamlanmış denetim yok'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Memnuniyet</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {kpi.satisfaction_avg != null ? kpi.satisfaction_avg.toFixed(1) : '—'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {kpi.satisfaction_count > 0 ? `${kpi.satisfaction_count} değerlendirme (90g)` : 'Değerlendirme yok'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Star className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Açık Aksiyon</p>
            <h3 className={`text-2xl font-extrabold mt-1 font-mono ${kpi.overdue_actions > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {kpi.open_actions}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {kpi.overdue_actions > 0 ? (
                <span className="text-rose-600 font-semibold">{kpi.overdue_actions} gecikmiş</span>
              ) : (
                'Gecikme yok'
              )}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Varlıklar</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">{kpi.assets_total}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {kpi.assets_broken > 0 ? (
                <span className="text-rose-600 font-semibold">{kpi.assets_broken} arıza/bakım</span>
              ) : (
                'Arıza yok'
              )}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sağlık Skoru Bileşenleri */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
          <Award className="w-5 h-5 text-amber-500" />
          <span>Sağlık Skoru Bileşenleri</span>
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Ağırlıklar: Denetim %35 · Memnuniyet %25 · Aksiyon Kapatma %25 · Müdahale Hızı %15 — veri olmayan bileşen ağırlık dışı kalır.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {health.parts.map((p: HealthPart) => (
            <div key={p.key} className="bg-slate-50/70 border border-slate-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-600">{p.label}</span>
                <span className={`text-lg font-extrabold font-mono ${partScoreClass(p.score)}`}>
                  {p.score != null ? p.score : '—'}
                </span>
              </div>
              <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${
                    p.score == null
                      ? 'bg-slate-300'
                      : p.score >= 80
                        ? 'bg-emerald-500'
                        : p.score >= 60
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                  }`}
                  style={{ width: `${p.score ?? 0}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Denetimler + Talepler */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Denetimler */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <span>Denetimler</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Son 12 ay puan trendi ve son denetimler</p>
          </div>

          {/* Trend */}
          <div className="px-6 pt-5">
            <div className="flex items-end gap-1.5 h-24">
              {audit_trend.map((t) => (
                <div key={t.month_key} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center h-20">
                    {t.avg != null ? (
                      <div
                        className={`w-full max-w-[26px] rounded-t-md ${
                          t.avg >= 80 ? 'bg-emerald-400' : t.avg >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                        }`}
                        style={{ height: `${Math.max((t.avg / maxTrend) * 100, 6)}%` }}
                        title={`${t.month}: ${t.avg}/100 (${t.count} denetim)`}
                      />
                    ) : (
                      <div className="w-full max-w-[26px] h-1 rounded bg-slate-100" />
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">{t.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Son denetimler */}
          <div className="p-6 pt-4">
            {recent_audits.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">Son 12 ayda denetim kaydı yok.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent_audits.map((a) => {
                  const band = getAuditScoreBand(a.percentage);
                  return (
                    <div key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{a.type_name}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatDate(a.audit_date)} · {AUDIT_STATUS_LABELS[a.status] || a.status}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${
                          band?.chipClass || 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        %{Math.round(a.percentage)} {band ? `· ${band.label}` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Talepler */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <span>Talepler</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Son talepler ve ortalama müdahale süresi
              {kpi.avg_response_minutes != null && ` (90g: ${Math.round(kpi.avg_response_minutes)} dk)`}
            </p>
          </div>

          <div className="p-6">
            {recent_requests.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">Bu şubede henüz talep kaydı yok.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent_requests.map((r) => (
                  <div
                    key={r.id}
                    className="py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/60 -mx-2 px-2 rounded-lg transition"
                    onClick={() => router.push(`/dashboard/requests/${r.id}`)}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800">
                        <span className="font-mono text-[10px] text-slate-400 mr-1.5">{r.request_number}</span>
                        {CATEGORY_LABELS[r.category] || r.category}
                        {r.assignee_name && (
                          <span className="font-normal text-slate-400"> · {r.assignee_name}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{formatDate(r.created_at)}</div>
                    </div>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${
                        REQUEST_STATUS_CLASSES[r.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {REQUEST_STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Aksiyonlar + Varlıklar */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Aksiyonlar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Açık Aksiyonlar</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {kpi.open_actions} açık
                {kpi.overdue_actions > 0 && (
                  <span className="text-rose-600 font-semibold"> · {kpi.overdue_actions} gecikmiş</span>
                )}
              </p>
            </div>
            {kpi.overdue_actions > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                {kpi.overdue_actions} gecikmiş
              </span>
            )}
          </div>

          <div className="p-6">
            {open_actions.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">Açık aksiyon bulunmuyor.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {open_actions.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{a.title}</div>
                      <div className="text-[10px] text-slate-400">
                        <span className="font-mono">{a.action_number}</span>
                        {a.responsible_name && <span> · {a.responsible_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          PRIORITY_CLASSES[a.priority] || 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {PRIORITY_LABELS[a.priority] || a.priority}
                      </span>
                      <span className={`text-[10px] font-bold ${a.overdue ? 'text-rose-600' : 'text-slate-500'}`}>
                        {a.due_date ? formatDate(a.due_date) : 'Terminsiz'}
                        {a.overdue && ' ⚠'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Varlıklar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" />
              <span>Varlıklar</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Bu şubeye kayıtlı {kpi.assets_total} varlığın durum dağılımı
            </p>
          </div>

          <div className="p-6">
            {kpi.assets_total === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">Bu şubede kayıtlı varlık yok.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(assets_by_status).map(([status, count]) => (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                      ASSET_STATUS_CLASSES[status] || 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {ASSET_STATUS_LABELS[status] || status}
                    <span className="font-mono font-bold">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Temizlik Ekibi & Ekipman + Memnuniyet */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Temizlik & İlaçlama */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <SprayCan className="w-5 h-5 text-teal-600" />
              <span>Temizlik & İlaçlama</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {kpi.staff_active} aktif temizlik personeli · {equipment.length} ekipman kaydı
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Personel */}
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Personel
              </div>
              {staff.length === 0 ? (
                <p className="text-xs text-slate-400">Kayıtlı temizlik personeli yok.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {staff.map((s) => (
                    <div key={s.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-slate-800">{s.full_name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{s.position || '—'}</span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          title={s.is_active ? 'Aktif' : 'Pasif'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ekipman */}
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <SprayCan className="w-3.5 h-3.5" />
                Ekipman
              </div>
              {equipment.length === 0 ? (
                <p className="text-xs text-slate-400">Kayıtlı ekipman yok.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {equipment.map((e) => (
                    <div key={e.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0 text-xs font-semibold text-slate-800 truncate">
                        {e.name}
                        {e.type && <span className="font-normal text-slate-400"> · {e.type}</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">×{e.quantity}</span>
                        {e.condition && (
                          <span className="text-[10px] text-slate-400">{e.condition}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-3">
              Not: Waternet ve maliyet verileri Excel&apos;deki &quot;Şubeler hk. her şey&quot; sayfası doldurulduğunda eklenecektir.
            </p>
          </div>
        </div>

        {/* Son Memnuniyet Yorumları */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-500" />
              <span>Son Memnuniyet Değerlendirmeleri</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Talep kapanış anketlerinden gelen yorumlar</p>
          </div>

          <div className="p-6">
            {recent_satisfaction.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">Henüz memnuniyet değerlendirmesi yok.</p>
            ) : (
              <div className="space-y-3">
                {recent_satisfaction.map((s, idx) => (
                  <div key={idx} className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-3.5 h-3.5 ${
                              n <= s.score ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                        <span className="text-xs font-bold text-slate-700 ml-1.5 font-mono">{s.score}/5</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{formatDate(s.created_at)}</span>
                    </div>
                    {s.comment && <p className="text-xs text-slate-600 leading-relaxed">{s.comment}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
              <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
              Son 90 gün ortalaması:{' '}
              <span className="font-bold text-slate-700">
                {kpi.satisfaction_avg != null ? `${kpi.satisfaction_avg.toFixed(1)}/5` : '—'}
              </span>
              {kpi.satisfaction_count > 0 && (
                <span className="text-slate-400">({kpi.satisfaction_count} değerlendirme)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
