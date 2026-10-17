'use client';

import React, { useEffect, useState } from 'react';
import {
  Camera,
  FolderOpen,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';

// ─── Kanıt Fotoğrafı Yükleyici ─────────────────────────────────────────────
// Masaüstü: dosya seçici ile görsel yükleme
// Mobil:    kamera ile anlık çekim (native capture) + albümden görsel seçimi
// Yalnızca görsel dosyaları kabul edilir (istemci + sunucu + storage katmanı).
//
// ⚠ Mobil uyumluluk notu:
// Dosya girdileri GİZLİ (display:none) tutulup JS ile .click() ÇAĞRILMAZ.
// Bazı mobil tarayıcılar (özellikle WebKit/Safari ve uygulama içi tarayıcılar)
// gizli girdilerde programatik tıklamayı ve/veya capture özelliğini sessizce
// yok sayar (hata vermez, kamera açılmaz). Bunun yerine dokunma hedefi
// <label> öğesidir ve girdi "sr-only" (görsel gizli ama aktif) tutulur;
// böylece aktive tamamen native çalışır her cihazda.

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

interface PhotoEvidenceUploaderProps {
  /** Yükleme bağlamı: denetim kanıtı veya aksiyon fotoğrafı */
  context: 'audit' | 'action';
  auditId?: string;
  questionId?: string;
  actionId?: string;
  /** Mevcut görsel URL'i (varsa önizleme gösterilir) */
  currentUrl?: string | null;
  /** Denetim tamamlandıysa salt-okunur */
  disabled?: boolean;
  helperText?: string;
  /** Yükleme başarılı: yeni URL — kaldırma: boş string */
  onChange: (url: string) => void;
}

export default function PhotoEvidenceUploader({
  context,
  auditId,
  questionId,
  actionId,
  currentUrl,
  disabled = false,
  helperText = 'JPG, PNG, WEBP • en fazla 10 MB',
  onChange,
}: PhotoEvidenceUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Dokunmatik cihaz tespiti: kaba işaretçi veya mobil tarayıcı
  useEffect(() => {
    try {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const mobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(coarsePointer || mobileUA);
    } catch {
      // yoksay
    }
  }, []);

  const busy = disabled || uploading;

  const handleFile = async (file?: File | null) => {
    if (!file || disabled) return;
    setError(null);

    // Yalnızca görsel dosyaları
    const isImage = (file.type || '').toLowerCase().startsWith('image/') || IMAGE_EXT_RE.test(file.name);
    if (!isImage) {
      setError('Yalnızca görsel dosyaları yükleyebilirsiniz.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Görsel boyutu en fazla 10 MB olabilir.');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('context', context);
      if (context === 'audit') {
        if (auditId) fd.append('audit_id', auditId);
        if (questionId) fd.append('question_id', questionId);
      } else if (actionId) {
        fd.append('action_id', actionId);
      }

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        throw new Error(json.error || 'Görsel yüklenemedi.');
      }
      onChange(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görsel yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Aynı dosyanın tekrar seçilebilmesi için girdiyi hemen sıfırla
    e.target.value = '';
    handleFile(file);
  };

  const galleryBtnClass =
    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors select-none';
  const cameraBtnClass =
    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors select-none';
  const stateClass = busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  // Native kamera girdisi (mobilde doğrudan cihaz kamerasını açar)
  const cameraInput = (
    <input
      type="file"
      accept="image/*"
      capture="environment"
      className="sr-only"
      disabled={busy}
      onChange={handleInputChange}
    />
  );

  // Galeri / dosya seçici girdisi
  const galleryInput = (
    <input
      type="file"
      accept="image/*"
      className="sr-only"
      disabled={busy}
      onChange={handleInputChange}
    />
  );

  return (
    <div className="space-y-1.5">
      {currentUrl ? (
        <div className="flex flex-wrap items-start gap-3">
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt="Kanıt fotoğrafı"
              className="h-24 w-auto max-w-[220px] object-cover"
            />
            {!disabled && (
              <button
                type="button"
                title="Fotoğrafı kaldır"
                onClick={() => {
                  setError(null);
                  onChange('');
                }}
                className="absolute top-1 right-1 p-1.5 bg-white/95 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg border border-slate-200 shadow-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!disabled && (
            <div className="flex flex-col gap-1.5">
              {isMobile && (
                <label className={`${cameraBtnClass} ${stateClass}`}>
                  {cameraInput}
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Yeniden Çek</span>
                </label>
              )}
              <label
                className={`${galleryBtnClass} bg-white hover:bg-slate-50 text-slate-700 border-slate-200 ${stateClass}`}
              >
                {galleryInput}
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" />
                )}
                <span>{isMobile ? 'Albümden Değiştir' : 'Görseli Değiştir'}</span>
              </label>
            </div>
          )}

          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-blue-600 hover:underline self-end pb-1"
          >
            Tam boyutta görüntüle
          </a>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {isMobile && (
            <label className={`${cameraBtnClass} ${stateClass}`}>
              {cameraInput}
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span>Kamera ile Çek</span>
            </label>
          )}
          <label
            className={`${galleryBtnClass} ${
              isMobile
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm'
            } ${stateClass}`}
          >
            {galleryInput}
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isMobile ? (
              <ImagePlus className="w-3.5 h-3.5" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5" />
            )}
            <span>{isMobile ? 'Albümden Seç' : 'Görsel Yükle'}</span>
          </label>
          {uploading && (
            <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor...
            </span>
          )}
        </div>
      )}

      {helperText && !error && (
        <p className="text-[10px] text-slate-400">{helperText}</p>
      )}
      {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
}
