'use client';

import React, { useState } from 'react';
import { Camera, FileText, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import CameraCaptureModal from '@/components/camera-capture-modal';
import { useIsMobile } from '@/lib/use-is-mobile';
import { compressImage } from '@/lib/image-compress';

// ─── Talep Medya Yükleyici (çoklu dosya) ───────────────────────────────────
// Taleplere görsel (fotoğraf çek / galeriden seç) ve PDF belge eklemek için.
// Aynı native desen: sayfa içi kamera (getUserMedia) + <label> + sr-only girdi.
// Görseller yükleme öncesi sıkıştırılır; PDF'ler olduğu gibi yüklenir.

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PDF_SIZE = 4 * 1024 * 1024; // 4 MB
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

/** URL bir PDF belgesine mi ait? (görsel yerine belge kartı göstermek için) */
export function isPdfUrl(url: string): boolean {
  return /\.pdf($|[?#])/i.test(url);
}

interface RequestMediaUploaderProps {
  /** Talep id'si (varsa dosyalar talep klasörüne gider; yoksa taslak klasörü) */
  requestId?: string;
  /** Mevcut dosya URL listesi */
  urls: string[];
  /** Liste değiştiğinde (ekleme/çıkarma) çağrılır */
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  helperText?: string;
  /** Kamera modali başlığı */
  cameraTitle?: string;
}

export default function RequestMediaUploader({
  requestId,
  urls,
  onChange,
  disabled = false,
  helperText = 'Fotoğraf (JPG, PNG, WEBP, HEIC) en fazla 10 MB • PDF belge en fazla 4 MB',
  cameraTitle = 'Fotoğraf Çek',
}: RequestMediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const isMobile = useIsMobile();

  const busy = disabled || uploading;

  const uploadFile = async (raw: File): Promise<string> => {
    const isPdf = raw.type === 'application/pdf' || /\.pdf$/i.test(raw.name);
    if (isPdf) {
      if (raw.size > MAX_PDF_SIZE) {
        throw new Error(`"${raw.name}" — PDF boyutu en fazla 4 MB olabilir.`);
      }
    } else {
      const isImage =
        (raw.type || '').toLowerCase().startsWith('image/') || IMAGE_EXT_RE.test(raw.name);
      if (!isImage) {
        throw new Error(`"${raw.name}" desteklenen bir tür değil. Yalnızca fotoğraf veya PDF yükleyin.`);
      }
      if (raw.size > MAX_IMAGE_SIZE) {
        throw new Error(`"${raw.name}" — görsel boyutu en fazla 10 MB olabilir.`);
      }
    }

    const prepared = isPdf ? raw : await compressImage(raw);

    const fd = new FormData();
    fd.append('file', prepared);
    fd.append('context', 'request');
    if (requestId) fd.append('request_id', requestId);

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      throw new Error(json.error || `"${raw.name}" yüklenemedi.`);
    }
    return String(json.url);
  };

  const handleFiles = async (list: File[]) => {
    if (!list.length || disabled) return;
    setError(null);
    setUploading(true);
    setProgress({ done: 0, total: list.length });
    const added: string[] = [];
    try {
      for (const f of list) {
        added.push(await uploadFile(f));
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dosya yüklenemedi.');
    } finally {
      setUploading(false);
      setProgress(null);
      if (added.length > 0) onChange([...urls, ...added]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Aynı dosyaların tekrar seçilebilmesi için girdiyi hemen sıfırla
    e.target.value = '';
    if (files.length > 0) void handleFiles(files);
  };

  const removeAt = (index: number) => {
    setError(null);
    onChange(urls.filter((_, i) => i !== index));
  };

  const cameraBtnClass =
    'inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed';
  const uploadBtnClass =
    'inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl border bg-white hover:bg-slate-50 text-slate-700 border-slate-200 transition-colors select-none';
  const stateClass = busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <div className="space-y-3">
      {cameraOpen && (
        <CameraCaptureModal
          title={cameraTitle}
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            void handleFiles([file]);
          }}
        />
      )}

      {/* Yükleme butonları */}
      <div className="flex flex-wrap items-center gap-2">
        {isMobile && (
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setError(null);
              setCameraOpen(true);
            }}
            disabled={busy}
            className={cameraBtnClass}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span>Kamera ile Çek</span>
          </button>
        )}
        <label className={`${uploadBtnClass} ${stateClass}`}>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={handleInputChange}
          />
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          <span>Fotoğraf / Belge Yükle</span>
        </label>
        {uploading && progress && (
          <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Yükleniyor{progress.total > 1 ? ` (${progress.done}/${progress.total})` : ''}...
          </span>
        )}
      </div>

      {/* Eklenenler */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {urls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
            >
              {isPdfUrl(url) ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title="PDF belgeyi aç"
                  className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-red-600 transition-colors"
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-[9px] font-bold uppercase tracking-wide">PDF</span>
                </a>
              ) : (
                <a href={url} target="_blank" rel="noreferrer" title="Görseli aç" className="block w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Ek ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  title="Kaldır"
                  className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-80 hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {urls.length === 0 && !uploading && !error && (
        <p className="text-[11px] text-slate-400">
          Henüz dosya eklenmedi. Fotoğraf çekebilir, galeriden veya dosyalarınızdan yükleyebilirsiniz.
        </p>
      )}

      {helperText && !error && <p className="text-[10px] text-slate-400">{helperText}</p>}
      {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
}
