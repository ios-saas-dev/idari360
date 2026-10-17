'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAuditScoreBand } from '@/lib/audit-score';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  TrendingDown,
  TrendingUp,
  Trophy,
  AlertTriangle,
} from 'lucide-react';

interface MonthlyPoint {
  key: string;
  label: string;
  count: number;
  avgScore: number | null;
}

interface FacilityStat {
  id: string;
  name: string;
  city: string | null;
  auditCount: number;
  avgScore: number;
}

interface StatsResponse {
  totals: {
    total: number;
    completed: number;
    thisMonth: number;
    avgScore: number | null;
    scoredCount: number;
    facilitiesCount: number;
  };
  bands: { uygun: number; takip: number; kritik: number };
  monthly: MonthlyPoint[];
  facilities: FacilityStat[];
  top: FacilityStat[];
  worst: FacilityStat[];
}

function scoreChipClasses(score: number | null): string {
  const band = getAuditScoreBand(score);
  return band ? band.chipClass : 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function AuditAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/audits/stats');
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'İstatistikler yüklenemedi.');
        }
        const json = await res.json();
        setStats(json);
      } catch (err: any) {
        setError(err?.message || 'İstatistikler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 12 aylık trend: bar = tamamlanan denetim sayısı, çizgi = ortalama puan
  const chart = useMemo(() => {
    const monthly = stats?.monthly || [];
    const maxCount = Math.max(1, ...monthly.map((m) => m.count));
    const n = monthly.length || 12;

    // Ardışık (veri olan) ayları çizgi parçalarına böl
    const segments: string[] = [];
    let current: string[] = [];
    const dots: Array<{ x: number; y: number; avg: number; label: string }> = [];

    monthly.forEach((m, i) => {
      if (m.avgScore === null || m.avgScore === undefined) {
        if (current.length >= 2) segments.push(current.join(' '));
        current = [];
        return;
      }
      const x = ((i + 0.5) / n) * 1200;
      const y = 100 - Math.max(0, Math.min(100, m.avgScore));
      current.push(`${x},${y}`);
      dots.push({ x, y, avg: m.avgScore, label: m.label });
    });
    if (current.length >= 2) segments.push(current.join(' '));

    return { monthly, maxCount, segments, dots };
  }, [stats]);

  const totalScored = stats
    ? stats.bands.uygun + stats.bands.takip + stats.bands.kritik
    : 0;
  const bandAvgText = getAuditScoreBand(stats?.totals.avgScore ?? null);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-64 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/audits"
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 shadow-sm transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Denetim Analizi
            </h1>
            <p className="text-sm text-slate-500">
              Aylık denetim sayıları, ortalama puan trendi ve bölgesel başarı (son 12 ay)
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/audits"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ClipboardList className="w-4 h-4 text-slate-500" />
          Denetim Listesi
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {stats && stats.totals.total === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 mb-4">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Henüz denetim verisi yok</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Denetim başlatıp tamamladığınızda; aylık trend, ortalama puan ve bölgesel
            başarı grafikleri burada görünecek.
          </p>
          <Link
            href="/dashboard/audits"
            className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Denetimlere Git
          </Link>
        </div>
      )}

      {stats && stats.totals.total > 0 && (
        <>
          {/* KPI kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Toplam Denetim
                </p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.totals.total}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tamamlanan
                </p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  {stats.totals.completed}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Bu Ay Tamamlanan
                </p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {stats.totals.thisMonth}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <CalendarDays className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Ortalama Puan (12 ay)
                </p>
                <h3 className={`text-2xl font-bold mt-1 ${bandAvgText?.textClass || 'text-slate-900'}`}>
                  {stats.totals.avgScore !== null ? `%${stats.totals.avgScore}` : '—'}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Trend grafiği + puan dağılımı */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
                <div>
                  <h3 className="font-bold text-slate-900">Son 12 Ay Denetim Trendi</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bar: tamamlanan denetim sayısı · Çizgi: ortalama puan
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-blue-500" /> Denetim
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500" /> Ort. Puan
                  </span>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-end gap-1.5 h-48">
                  {chart.monthly.map((m) => (
                    <div
                      key={m.key}
                      className="flex-1 h-full flex flex-col items-center justify-end"
                      title={`${m.label}: ${m.count} denetim${
                        m.avgScore !== null ? ` · ort. %${m.avgScore}` : ''
                      }`}
                    >
                      {m.count > 0 && (
                        <span className="text-[10px] font-semibold text-slate-600 mb-0.5">
                          {m.count}
                        </span>
                      )}
                      <div
                        className={`w-full max-w-[40px] mx-auto rounded-t-md transition-all ${
                          m.count > 0
                            ? 'bg-gradient-to-t from-blue-600 to-blue-400'
                            : 'bg-slate-200'
                        }`}
                        style={{
                          height:
                            m.count > 0
                              ? `${Math.max((m.count / chart.maxCount) * 100, 5)}%`
                              : '3px',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Ortalama puan çizgisi (SVG) */}
                <svg
                  className="absolute left-0 right-0 top-0 w-full h-48 pointer-events-none"
                  viewBox="0 0 1200 100"
                  preserveAspectRatio="none"
                >
                  {chart.segments.map((points, idx) => (
                    <polyline
                      key={idx}
                      points={points}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity="0.9"
                    />
                  ))}
                </svg>

                {/* Veri noktaları */}
                {chart.dots.map((d, idx) => (
                  <div
                    key={idx}
                    className="absolute w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white shadow-sm -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${(d.x / 1200) * 100}%`,
                      top: `${(d.y / 100) * 192}px`, // h-48 = 192px
                    }}
                    title={`${d.label}: ort. %${d.avg}`}
                  />
                ))}

                <div className="flex gap-1.5 mt-2">
                  {chart.monthly.map((m) => (
                    <div
                      key={m.key}
                      className="flex-1 text-center text-[10px] font-medium text-slate-500"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Puan dağılımı */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900">Puan Bandı Dağılımı</h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-5">
                Tamamlanan {totalScored} denetimin genel değerlendirmesi
              </p>

              <div className="space-y-4">
                {[
                  {
                    key: 'uygun',
                    label: 'UYGUN',
                    desc: '≥ 80 puan',
                    count: stats.bands.uygun,
                    bar: 'bg-emerald-500',
                    text: 'text-emerald-700',
                  },
                  {
                    key: 'takip',
                    label: 'TAKİP GEREKİYOR',
                    desc: '60 – 79 puan',
                    count: stats.bands.takip,
                    bar: 'bg-amber-500',
                    text: 'text-amber-700',
                  },
                  {
                    key: 'kritik',
                    label: 'KRİTİK UYGUNSUZLUK',
                    desc: '< 60 puan',
                    count: stats.bands.kritik,
                    bar: 'bg-rose-500',
                    text: 'text-rose-700',
                  },
                ].map((b) => {
                  const pct = totalScored > 0 ? Math.round((b.count / totalScored) * 100) : 0;
                  return (
                    <div key={b.key}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className={`font-semibold ${b.text}`}>{b.label}</span>
                        <span className="text-slate-600 font-medium">
                          {b.count} · %{pct}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${b.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{b.desc}</p>
                    </div>
                  );
                })}
              </div>

              {totalScored === 0 && (
                <p className="text-sm text-slate-500 mt-4">
                  Henüz puanlanmış tamamlanan denetim yok.
                </p>
              )}
            </div>
          </div>

          {/* Bölgesel başarı */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 pb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Bölgesel Başarı</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tesis bazlı ortalama puanlar (tamamlanan denetimler)
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            {stats.facilities.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-slate-500">
                Puanlanmış tamamlanan denetimi olan tesis bulunmuyor.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="text-left font-semibold px-6 py-3">Tesis</th>
                      <th className="text-left font-semibold px-4 py-3">Şehir</th>
                      <th className="text-center font-semibold px-4 py-3">Denetim</th>
                      <th className="text-center font-semibold px-4 py-3">Ort. Puan</th>
                      <th className="text-right font-semibold px-6 py-3">Değerlendirme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.facilities.map((f) => {
                      const band = getAuditScoreBand(f.avgScore);
                      return (
                        <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3 font-medium text-slate-900">{f.name}</td>
                          <td className="px-4 py-3 text-slate-500">{f.city || '—'}</td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {f.auditCount}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">
                            %{f.avgScore}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span
                              className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full border ${scoreChipClasses(
                                f.avgScore
                              )}`}
                            >
                              {band?.label || '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* En iyi / en kötü ilk 10 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Trophy className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900">En İyi 10 Şube</h3>
              </div>
              {stats.top.length === 0 ? (
                <p className="text-sm text-slate-500">Veri yok.</p>
              ) : (
                <ol className="space-y-2.5">
                  {stats.top.map((f, i) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      <span
                        className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${
                          i < 3
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {f.city || '—'} · {f.auditCount} denetim
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${scoreChipClasses(
                          f.avgScore
                        )}`}
                      >
                        %{f.avgScore}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900">İyileştirme Gereken 10 Şube</h3>
              </div>
              {stats.worst.length === 0 ? (
                <p className="text-sm text-slate-500">Veri yok.</p>
              ) : (
                <ol className="space-y-2.5">
                  {stats.worst.map((f, i) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      <span
                        className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${
                          i < 3
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {f.city || '—'} · {f.auditCount} denetim
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${scoreChipClasses(
                          f.avgScore
                        )}`}
                      >
                        %{f.avgScore}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
