'use client';

/**
 * Varlık Detayı (Paket 6 / Varlık)
 * - Varlık künyesi + zimmet bilgisi
 * - QR kod + yazdırılabilir etiket
 * - Akış işlemleri (zimmet, devir, iade, arıza, bakım, kayıp, hurda...)
 * - Hareket geçmişi (asset_history) zaman çizelgesi
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Package,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Printer,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  User,
  UserPlus,
  ArrowLeftRight,
  CornerDownLeft,
  Wrench,
  Eye,
  EyeOff,
  Trash2,
  History,
  X,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  AssetFlowDef,
  getAvailableFlows,
  getAssetStatusMeta,
  ASSET_ACTION_LABELS,
} from '@/lib/asset-flow';

interface HistoryItem {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
  from_user: { full_name: string } | null;
  to_user: { full_name: string } | null;
}

interface AssetDetail {
  id: string;
  asset_code: string;
  name: string;
  category: string;
  location: string | null;
  status: string;
  purchase_date: string | null;
  purchase_price: number | null;
  notes: string | null;
  created_at: string;
  assigned_to: string | null;
  assigned_user: { id: string; full_name: string; email: string } | null;
  facility: { id: string; name: string } | null;
  asset_history: HistoryItem[];
}

interface ProfileOption {
  id: string;
  full_name: string;
  email: string;
}

const MANAGE_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];

const TONE_CLASSES: Record<AssetFlowDef['tone'], string> = {
  blue: 'bg-blue-600 hover:bg-blue-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  amber: 'bg-amber-500 hover:bg-amber-600 text-white',
  red: 'bg-red-600 hover:bg-red-700 text-white',
  slate: 'bg-slate-700 hover:bg-slate-800 text-white',
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  zimmet: UserPlus,
  devir: ArrowLeftRight,
  iade: CornerDownLeft,
  ariza: AlertCircle,
  bakim: Wrench,
  bakim_cikis: CheckCircle2,
  kayip: EyeOff,
  bulundu: Eye,
  hurda: Trash2,
};

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatCurrency(value: number | null) {
  if (value == null) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
}

export default function AssetDetailPage() {
  const params = useParams();
  const assetId = params?.id as string;
  const supabase = createBrowserClient();

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Akış işlemi modalı
  const [modalFlow, setModalFlow] = useState<AssetFlowDef | null>(null);
  const [modalUser, setModalUser] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  const canManage = role != null && MANAGE_ROLES.includes(role);

  const fetchAsset = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Varlık yüklenemedi.');
      }
      const json = await res.json();
      setAsset(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchAsset();
  }, [fetchAsset]);

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (data) setRole(data.role);
    }
    loadRole();
  }, [supabase]);

  // Başarı mesajı otomatik gizlensin
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const openFlowModal = async (flow: AssetFlowDef) => {
    setModalFlow(flow);
    setModalUser('');
    setModalNote('');
    setModalError(null);
    if (flow.requiresUser && profiles.length === 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });
      if (data) setProfiles(data);
    }
  };

  const handleFlowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFlow || !asset) return;

    if (modalFlow.requiresUser && !modalUser) {
      setModalError('Lütfen hedef kişiyi seçiniz.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modalFlow.key,
          assigned_to: modalFlow.requiresUser ? modalUser : undefined,
          note: modalNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'İşlem uygulanamadı.');
      }
      setSuccessMessage(`"${modalFlow.label}" işlemi başarıyla uygulandı.`);
      setModalFlow(null);
      await fetchAsset();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-sm">Varlık yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-sm text-slate-600">{error || 'Varlık bulunamadı.'}</p>
          <Link
            href="/dashboard/assets"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Varlık Listesine Dön
          </Link>
        </div>
      </div>
    );
  }

  const statusMeta = getAssetStatusMeta(asset.status);
  const availableFlows = canManage ? getAvailableFlows(asset.status) : [];
  const history = asset.asset_history || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ==================== Uygulama Görünümü (yazdırmada gizli) ==================== */}
      <div className="print:hidden p-6 md:p-8 space-y-6">
        {/* Başlık */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/dashboard/assets"
              className="p-2.5 mt-0.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Varlık Listesine Dön"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{asset.name}</h1>
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 border border-slate-200/80 text-slate-800 rounded-md">
                  {asset.asset_code}
                </span>
                {asset.facility && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {asset.facility.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            Etiket Yazdır
          </button>
        </div>

        {/* Başarı mesajı */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol: Bilgiler + Akış */}
          <div className="lg:col-span-2 space-y-6">
            {/* Varlık Bilgileri */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Varlık Bilgileri
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Kategori</div>
                  <div className="text-sm font-medium text-slate-800">{asset.category || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Konum
                  </div>
                  <div className="text-sm font-medium text-slate-800">{asset.location || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Satın Alma Tarihi
                  </div>
                  <div className="text-sm font-medium text-slate-800">
                    {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('tr-TR') : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-0.5 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Satın Alma Fiyatı
                  </div>
                  <div className="text-sm font-medium text-slate-800">{formatCurrency(asset.purchase_price)}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-slate-400 mb-0.5 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Notlar
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{asset.notes || '-'}</div>
                </div>
              </div>
            </div>

            {/* Zimmet Bilgisi */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Zimmet Bilgisi
              </h2>
              {asset.assigned_user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                    {asset.assigned_user.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{asset.assigned_user.full_name}</div>
                    <div className="text-xs text-slate-500">{asset.assigned_user.email}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Bu varlık şu anda bir personele zimmetli değil.
                </p>
              )}
            </div>

            {/* Akış İşlemleri */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Akış İşlemleri
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Durum değişiklikleri yalnızca bu işlemlerle yapılır; her işlem geçmişe kaydedilir.
              </p>
              {!canManage ? (
                <p className="text-sm text-slate-500">
                  Görüntüleme yetkiniz var; işlem yapmak için yönetici rolü gerekir.
                </p>
              ) : availableFlows.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Bu varlık için uygulanabilir işlem bulunmuyor (hurda varlıklar kapatılmıştır).
                </p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {availableFlows.map((flow) => {
                    const Icon = ACTION_ICONS[flow.key] || Wrench;
                    const toneClass =
                      flow.key === 'hurda'
                        ? 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
                        : TONE_CLASSES[flow.tone];
                    return (
                      <button
                        key={flow.key}
                        onClick={() => openFlowModal(flow)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl shadow-sm transition-colors ${toneClass}`}
                      >
                        <Icon className="w-4 h-4" />
                        {flow.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sağ: QR + özet */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col items-center text-center">
              <h2 className="text-sm font-bold text-slate-900 mb-4 self-start">Varlık QR Kodu</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/assets/${asset.id}/qr`}
                alt={`${asset.asset_code} QR kodu`}
                className="w-44 h-44 border border-slate-200 rounded-xl bg-white"
              />
              <p className="text-xs text-slate-400 mt-4">
                Telefon kamerasıyla okutunca bu varlığın detayı açılır. Etiket yazdırarak cihaz üzerine
                yapıştırabilirsiniz.
              </p>
              <button
                onClick={() => window.print()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-xl transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Etiket Yazdır
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Kayıt Özeti</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">Kayıt Tarihi</span>
                  <span className="font-medium text-slate-800">
                    {new Date(asset.created_at).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">Hareket Sayısı</span>
                  <span className="font-medium text-slate-800">{history.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">Son Hareket</span>
                  <span className="font-medium text-slate-800">
                    {history[0] ? formatDateTime(history[0].created_at) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hareket Geçmişi */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            Hareket Geçmişi
          </h2>

          {history.length === 0 ? (
            <p className="text-sm text-slate-500">
              Bu varlık için henüz hareket kaydı yok. Kayıt oluşturulma tarihi:{' '}
              {formatDateTime(asset.created_at)}
            </p>
          ) : (
            <ol className="relative border-l border-slate-200 ml-3 space-y-6">
              {history.map((item) => {
                const Icon = ACTION_ICONS[item.action] || History;
                return (
                  <li key={item.id} className="ml-6">
                    <span className="absolute -left-[17px] flex items-center justify-center w-[33px] h-[33px] bg-white border border-slate-200 rounded-full">
                      <Icon className="w-4 h-4 text-slate-500" />
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="text-sm font-semibold text-slate-900">
                        {ASSET_ACTION_LABELS[item.action] || item.action}
                      </span>
                      <span className="text-xs text-slate-400">{formatDateTime(item.created_at)}</span>
                    </div>
                    {(item.from_user || item.to_user) && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.from_user && <span>Kimden: {item.from_user.full_name}</span>}
                        {item.from_user && item.to_user && <span> · </span>}
                        {item.to_user && <span>Kime: {item.to_user.full_name}</span>}
                      </div>
                    )}
                    {item.note && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{item.note}</p>}
                  </li>
                );
              })}
              {/* Kayıt oluşturulması (sanal ilk kayıt) */}
              <li className="ml-6">
                <span className="absolute -left-[17px] flex items-center justify-center w-[33px] h-[33px] bg-white border border-slate-200 rounded-full">
                  <Package className="w-4 h-4 text-slate-400" />
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-sm font-medium text-slate-500">Kayıt Oluşturuldu</span>
                  <span className="text-xs text-slate-400">{formatDateTime(asset.created_at)}</span>
                </div>
              </li>
            </ol>
          )}
        </div>
      </div>

      {/* ==================== Yazdırılabilir Etiket (yalnız yazdırmada görünür) ==================== */}
      <div className="hidden print:block p-8">
        <div className="border-2 border-slate-800 rounded-2xl p-6 max-w-md mx-auto flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/assets/${asset.id}/qr`} alt="QR" className="w-40 h-40" />
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">İdari360 · Varlık Etiketi</div>
            <div className="text-lg font-bold text-slate-900 leading-tight">{asset.name}</div>
            <div className="font-mono text-sm bg-slate-100 border border-slate-300 rounded px-2 py-1 inline-block">
              {asset.asset_code}
            </div>
            {asset.facility && <div className="text-xs text-slate-600">{asset.facility.name}</div>}
          </div>
        </div>
      </div>

      {/* ==================== Akış İşlemi Modalı ==================== */}
      {modalFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{modalFlow.label}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{modalFlow.hint}</p>
              </div>
              <button
                onClick={() => setModalFlow(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFlowSubmit} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <span className="font-semibold">{asset.name}</span>
                <span className="font-mono ml-2 px-1.5 py-0.5 bg-white border border-slate-200 rounded">
                  {asset.asset_code}
                </span>
              </div>

              {modalFlow.requiresUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hedef Kişi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalUser}
                    onChange={(e) => setModalUser(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  >
                    <option value="">Kişi seçiniz...</option>
                    {profiles
                      .filter((p) => p.id !== asset.assigned_to)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.email})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Not (İsteğe Bağlı)</label>
                <textarea
                  rows={3}
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="İşlemle ilgili açıklama..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 resize-none"
                />
              </div>

              {(modalFlow.key === 'hurda' || modalFlow.key === 'kayip') && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  Bu işlem geçmişe kalıcı olarak kaydedilir. Devam etmek istediğinize emin olun.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalFlow(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Onayla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
