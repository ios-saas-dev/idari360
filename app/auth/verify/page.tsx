'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailCheck, Loader2, AlertCircle, ArrowLeft, RefreshCw, CheckCircle2, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [timer, setTimer] = useState(120);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
      // Sayfa ilk yüklendiğinde OTP kodunu tetikle
      fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam, purpose: 'email_verification' }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.dev_code) {
            setDevCode(data.dev_code);
          }
        })
        .catch(() => {});
    }
  }, [emailParam]);

  // Geri sayım sayacı (120 saniye)
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Yapıştırma durumu
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newDigits = [...digits];
      pastedDigits.forEach((d, idx) => {
        if (idx < 6) newDigits[idx] = d;
      });
      setDigits(newDigits);
      const nextIdx = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const cleanVal = value.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    setDigits(newDigits);

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const allFilled = digits.every((d) => d !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('E-posta adresi bulunamadı. Lütfen kayıt sayfasına dönün.');
      return;
    }

    const code = digits.join('');
    if (code.length < 6) {
      setError('Lütfen 6 haneli onay kodunun tamamını girin.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          purpose: 'email_verification',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Onay kodu geçersiz veya süresi dolmuş.');
      }

      setSuccessMsg('E-posta adresiniz başarıyla doğrulandı!');

      const supabase = createBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();

      setTimeout(() => {
        if (sessionData?.session) {
          router.push('/auth/select-facility');
        } else {
          router.push('/auth/login?verified=true&email=' + encodeURIComponent(email));
        }
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Doğrulama işlemi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || resending || !email) return;

    setResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'email_verification' }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Kod tekrar gönderilemedi.');
      }

      if (data.dev_code) {
        setDevCode(data.dev_code);
      }

      setSuccessMsg('Yeni onay kodu e-posta adresinize gönderildi.');
      setTimer(120);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err?.message || 'Kod gönderilemedi.');
    } finally {
      setResending(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-sm">
          <MailCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">E-posta Doğrulama</h1>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{email || 'E-posta'}</span> adresinize gönderilen 6 haneli onay kodunu girin.
        </p>
      </div>

      {devCode && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Test / Geliştirme Onay Kodu: <strong className="font-mono text-sm tracking-widest text-amber-950">{devCode}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => {
              const split = devCode.split('');
              setDigits(split);
              inputRefs.current[5]?.focus();
            }}
            className="text-blue-700 underline font-semibold hover:text-blue-900 ml-2"
          >
            Otomatik Doldur
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 6 Haneli Giriş Kutuları */}
        <div className="flex justify-between gap-2 sm:gap-3">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all ${
                digit
                  ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
              }`}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || !allFilled}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Doğrulanıyor...</span>
            </>
          ) : (
            <span>Doğrula ve Devam Et</span>
          )}
        </button>
      </form>

      <div className="mt-8 text-center space-y-4">
        <div className="text-sm text-slate-500 flex items-center justify-center gap-2">
          <span>Kod gelmedi mi?</span>
          {timer > 0 ? (
            <span className="font-semibold text-slate-700">{formatTimer(timer)}</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              {resending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Tekrar Gönder
            </button>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Yükleniyor...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
