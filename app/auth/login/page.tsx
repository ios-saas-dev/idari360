'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    const verifiedParam = searchParams.get('verified');
    const emailParam = searchParams.get('email');
    if (verifiedParam === 'true') {
      setVerifiedSuccess(true);
    }
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMagicLinkSent(false);

    if (!email.trim() || !password) {
      setError('Lütfen e-posta adresinizi ve şifrenizi girin.');
      return;
    }

    try {
      setLoading(true);
      const supabase = createBrowserClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('E-posta adresi veya şifre hatalı.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Lütfen e-posta adresinizi onaylayın.');
        } else {
          setError(signInError.message || 'Giriş yapılırken bir hata oluştu.');
        }
        return;
      }

      if (data.user) {
        router.push('/auth/select-facility');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    setError(null);
    setMagicLinkSent(false);

    if (!email.trim()) {
      setError('Lütfen e-posta adresinizi girin.');
      return;
    }

    try {
      setMagicLinkLoading(true);
      const supabase = createBrowserClient();

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'https://idari360.vercel.app'}/auth/callback`,
        },
      });

      if (otpError) {
        throw otpError;
      }

      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err?.message || 'Giriş bağlantısı gönderilemedi.');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Başlık Alanı */}
      <div className="mb-8 text-left">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Hoş Geldiniz
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          İdari360 hesabınıza giriş yapın
        </p>
      </div>

      {/* Doğrulama Başarılı Bildirimi */}
      {verifiedSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <p className="font-semibold">E-posta Adresiniz Doğrulandı!</p>
            <p className="text-emerald-700 text-xs mt-0.5">Hesabınız aktif edildi. Lütfen şifrenizle giriş yapın.</p>
          </div>
        </div>
      )}

      {/* Giriş Bağlantısı Gönderildi Bildirimi */}
      {magicLinkSent && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm flex items-start gap-3">
          <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
          <div>
            <p className="font-semibold">Giriş Bağlantısı Gönderildi!</p>
            <p className="text-blue-700 text-xs mt-0.5">
              <span className="font-medium text-blue-900">{email}</span> adresinize gelen e-postadaki <strong>[Sign in]</strong> butonuna tıklayarak şifresiz giriş yapabilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Hata Mesajı */}
      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 transition-all animate-shake"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Form Alanı */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* E-posta Alanı */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            E-posta Adresi
          </label>
          <div className="relative">
            <Mail
              className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@sirket.com"
              disabled={loading || magicLinkLoading}
              className="w-full h-12 pl-11 pr-4 rounded-lg border border-gray-200 text-slate-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Şifre Alanı */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Şifre
          </label>
          <div className="relative">
            <Lock
              className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading || magicLinkLoading}
              className="w-full h-12 pl-11 pr-11 rounded-lg border border-gray-200 text-slate-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-600 focus:outline-none transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Beni Hatırla & Şifremi Unuttum */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-slate-600">Beni Hatırla</span>
          </label>

          <Link
            href="/auth/forgot-password"
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            Şifremi Unuttum
          </Link>
        </div>

        {/* Şifre ile Giriş Butonu */}
        <button
          type="submit"
          disabled={loading || magicLinkLoading}
          className="w-full h-12 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Giriş Yapılıyor...</span>
            </div>
          ) : (
            'Şifre ile Giriş Yap'
          )}
        </button>

        {/* Veya Ayracı */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-medium">veya</span>
          </div>
        </div>

        {/* E-posta Bağlantısı ile Giriş Yap Butonu (Magic Link) */}
        <button
          type="button"
          onClick={handleSendMagicLink}
          disabled={loading || magicLinkLoading}
          className="w-full h-12 flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed gap-2"
        >
          {magicLinkLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Bağlantı Gönderiliyor...</span>
            </div>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>E-posta Giriş Bağlantısı Gönder</span>
            </>
          )}
        </button>
      </form>

      {/* Kayıt Ol Linki */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-600">
        Hesabınız yok mu?{' '}
        <Link
          href="/auth/register"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          Üye Olun
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Yükleniyor...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
