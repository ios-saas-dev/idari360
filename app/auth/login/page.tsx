'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Lütfen e-posta adresinizi ve şifrenizi girin.');
      return;
    }

    try {
      setLoading(true);
      const supabase = createBrowserClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
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

  return (
    <div className="w-full">
      {/* Başlık Alanı */}
      <div className="mb-8 text-left">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hoş Geldiniz</h1>
        <p className="mt-2 text-sm text-slate-500">
          İdari360 hesabınıza giriş yapın
        </p>
      </div>

      {/* Hata Bildirimi */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
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
              disabled={loading}
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
              disabled={loading}
              className="w-full h-12 pl-11 pr-11 rounded-lg border border-gray-200 text-slate-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
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
              disabled={loading}
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

        {/* Giriş Yap Butonu */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Giriş Yapılıyor...</span>
            </div>
          ) : (
            'Giriş Yap'
          )}
        </button>
      </form>

      {/* Alt Bilgi & Kayıt Bağlantısı */}
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
