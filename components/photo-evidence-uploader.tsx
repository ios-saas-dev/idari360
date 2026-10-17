'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  FolderOpen,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';

// ─── Kanıt Fotoğrafı Yükleyici ─────────────────────────────────────────────
// Mobil:    sayfa içi kamera (getUserMedia) ile anlık çekim + albümden seçim
// Masaüstü: dosya seçici ile görsel yükleme
// Yalnızca görsel dosyaları kabul edilir (istemci + sunucu + storage katmanı).
//
// Neden sayfa içi kamera?
// Bazı mobil tarayıcılar (uygulama içi tarayıcılar, WebView'lar) dosya
// girdilerinde `capture` özelliğini veya kamera uygulaması çağrısını sessizce
// engeller — ne kamera açılır ne hata görünür. Bu yüzden "Kamera ile Çek"
// doğrudan getUserMedia ile sayfa içinde canlı önizleme açar; erişim
// engellenirse kullanıcıya net hata + alternatifler (telefon kamerası /
// albüm) gösterilir. Albüm yolu, native <label> + sr-only girdi ile çalışır.

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIM = 1920; // Çekilen fotoğrafın en büyük kenarı (px)
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

function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Kamera izni verilmedi. Tarayıcı adres çubuğundaki kilit simgesinden bu siteye kamera izni verip tekrar deneyin.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Cihazda kullanılabilir bir kamera bulunamadı.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kamera şu anda başka bir uygulama tarafından kullanılıyor olabilir. Diğer uygulamaları kapatıp tekrar deneyin.';
  }
  if (name === 'NotSupportedError') {
    return 'Bu tarayıcı sayfa içi kamerayı desteklemiyor.';
  }
  if (name === 'OverconstrainedError') {
    return 'Uygun bir arka kamera bulunamadı.';
  }
  return 'Kamera açılamadı.';
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

  // Sayfa içi kamera durumu
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // ── Sayfa içi kamera: açıkken canlı akışı başlat, kapanınca kamerayı bırak
  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      setCameraError(null);
      setCameraReady(false);
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          throw new DOMException('getUserMedia yok', 'NotSupportedError');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            // otomatik oynatma engellendi — çekim yine denenebilir
          }
        }
        if (!cancelled) setCameraReady(true);
      } catch (err) {
        if (!cancelled) setCameraError(cameraErrorMessage(err));
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOpen, cameraAttempt]);

  const openCamera = () => {
    if (busy) return;
    setError(null);
    setCameraError(null);
    setCameraReady(false);
    setCameraAttempt((n) => n + 1);
    setCameraOpen(true);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCameraReady(false);
    setCameraError(null);
  };

  const retryCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    setCameraAttempt((n) => n + 1);
  };

  // ── Yükleme
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

  // ── Deklanşör: canlı görüntüyü yakala, JPEG'e çevir, yükle
  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (!vw || !vh) {
      setCameraError('Kamera görüntüsü henüz hazır değil. Lütfen bir saniye sonra tekrar deneyin.');
      return;
    }
    const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Fotoğraf oluşturulamadı.');
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setCameraError('Fotoğraf oluşturulamadı.');
      return;
    }
    const file = new File([blob], `kanit-${Date.now()}.jpg`, { type: 'image/jpeg' });
    closeCamera();
    void handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Aynı dosyanın tekrar seçilebilmesi için girdiyi hemen sıfırla
    e.target.value = '';
    if (file) closeCamera();
    void handleFile(file);
  };

  const galleryBtnClass =
    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors select-none';
  const cameraBtnClass =
    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed';
  const stateClass = busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  // Native yedek girdiler (yalnızca <label> içinde, programatik tıklama yok)
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

  const galleryInput = (
    <input
      type="file"
      accept="image/*"
      className="sr-only"
      disabled={busy}
      onChange={handleInputChange}
    />
  );

  // ── Sayfa içi kamera modali (portal ile body'ye taşınır)
  const cameraModal =
    cameraOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[120] bg-black flex flex-col">
            {/* Başlık */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-white text-sm font-semibold">Kanıt Fotoğrafı Çek</p>
                <p className="text-white/50 text-[11px]">Uygunsuzluğu net gösterecek şekilde kareleyin</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                title="Kapat"
                className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Görüntü alanı / hata */}
            <div className="flex-1 relative overflow-hidden">
              {cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <div className="max-w-sm w-full text-center space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center">
                      <ShieldAlert className="w-6 h-6 text-rose-400" />
                    </div>
                    <p className="text-white text-sm leading-relaxed">{cameraError}</p>
                    <p className="text-white/50 text-xs leading-relaxed">
                      Telefonunuzun kendi kamera uygulamasını deneyebilir veya albümden seçebilirsiniz.
                      Sorun devam ederse bağlantıyı Chrome / Safari gibi bir tarayıcıda açmayı deneyin
                      (uygulama içi tarayıcılar kamerayı engelleyebilir).
                    </p>
                    <div className="flex flex-col items-center gap-2 pt-1">
                      {isMobile && (
                        <label className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white text-slate-900 shadow-sm cursor-pointer select-none">
                          {cameraInput}
                          <Camera className="w-4 h-4" />
                          <span>Telefon Kamerasıyla Çek</span>
                        </label>
                      )}
                      <label className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white/10 text-white border border-white/20 cursor-pointer select-none">
                        {galleryInput}
                        <ImagePlus className="w-4 h-4" />
                        <span>Albümden Seç</span>
                      </label>
                      <button
                        type="button"
                        onClick={retryCamera}
                        className="mt-1 inline-flex items-center gap-1 text-white/60 hover:text-white text-xs underline underline-offset-2 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Tekrar Dene
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white/70 text-sm flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Kamera açılıyor...
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Deklanşör */}
            {!cameraError && (
              <div className="flex items-center justify-center py-6">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraReady}
                  title="Fotoğraf çek"
                  className="w-20 h-20 rounded-full bg-white ring-4 ring-white/30 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="space-y-1.5">
      {cameraModal}

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
                <button type="button" onClick={openCamera} disabled={busy} className={cameraBtnClass}>
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Yeniden Çek</span>
                </button>
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
            <button type="button" onClick={openCamera} disabled={busy} className={cameraBtnClass}>
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span>Kamera ile Çek</span>
            </button>
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
