'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImagePlus, Loader2, RotateCcw, ShieldAlert, X } from 'lucide-react';

// ─── Sayfa İçi Kamera Modali ───────────────────────────────────────────────
// getUserMedia ile canlı önizleme açar; deklanşörle çekilen kare JPEG'e
// çevrilip onCapture ile üst bileşene verilir. Dosya girdisi/camera intent
// tuhaflıklarına bağımlı değildir — bazı mobil tarayıcılar (uygulama içi
// tarayıcılar, WebView'lar) capture akışını sessizce engeller.
// Erişim engellenirse sessiz kalınmaz: net hata + native yedekler gösterilir.

const MAX_DIM = 1920;

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

interface CameraCaptureModalProps {
  /** Kapatma isteği */
  onClose: () => void;
  /** Çekilen (veya native yedekten seçilen) dosya — modal kapanmaz, üst bileşen yönetir */
  onCapture: (file: File) => void;
  /** Başlık */
  title?: string;
  /** Hata durumunda native kamera/albüm yedeklerini göster */
  showNativeFallback?: boolean;
}

export default function CameraCaptureModal({
  onClose,
  onCapture,
  title = 'Kanıt Fotoğrafı Çek',
  showNativeFallback = true,
}: CameraCaptureModalProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Dokunmatik cihaz tespiti (native yedekler için)
  useEffect(() => {
    try {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const mobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(coarsePointer || mobileUA);
    } catch {
      // yoksay
    }
  }, []);

  // ESC ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Canlı akışı başlat; kapanınca kamerayı bırak
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      setError(null);
      setReady(false);
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
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(cameraErrorMessage(err));
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [attempt]);

  // Deklanşör: canlı görüntüyü yakala, JPEG'e çevir, üst bileşene ver
  const capture = async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (!vw || !vh) {
      setError('Kamera görüntüsü henüz hazır değil. Lütfen bir saniye sonra tekrar deneyin.');
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
      setError('Fotoğraf oluşturulamadı.');
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setError('Fotoğraf oluşturulamadı.');
      return;
    }
    const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
  };

  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onCapture(file);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black flex flex-col">
      {/* Başlık */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-white text-sm font-semibold">{title}</p>
          <p className="text-white/50 text-[11px]">Uygunsuzluğu net gösterecek şekilde kareleyin</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Kapat"
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Görüntü alanı / hata */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="max-w-sm w-full text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-rose-400" />
              </div>
              <p className="text-white text-sm leading-relaxed">{error}</p>
              <p className="text-white/50 text-xs leading-relaxed">
                Telefonunuzun kendi kamera uygulamasını deneyebilir veya albümden seçebilirsiniz.
                Sorun devam ederse bağlantıyı Chrome / Safari gibi bir tarayıcıda açmayı deneyin
                (uygulama içi tarayıcılar kamerayı engelleyebilir).
              </p>
              <div className="flex flex-col items-center gap-2 pt-1">
                {showNativeFallback && isMobile && (
                  <label className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white text-slate-900 shadow-sm cursor-pointer select-none">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={handleFallbackChange}
                    />
                    <Camera className="w-4 h-4" />
                    <span>Telefon Kamerasıyla Çek</span>
                  </label>
                )}
                <label className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white/10 text-white border border-white/20 cursor-pointer select-none">
                  <input type="file" accept="image/*" className="sr-only" onChange={handleFallbackChange} />
                  <ImagePlus className="w-4 h-4" />
                  <span>Albümden Seç</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAttempt((n) => n + 1)}
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
            {!ready && (
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
      {!error && (
        <div className="flex items-center justify-center py-6">
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            title="Fotoğraf çek"
            className="w-20 h-20 rounded-full bg-white ring-4 ring-white/30 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
      )}
    </div>,
    document.body
  );
}
