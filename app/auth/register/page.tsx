'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Genel e-posta sağlayıcıları kontrolü (Kurumsal e-posta uyarısı)
  const publicDomains = [
    'gmail.com',
    'hotmail.com',
    'yahoo.com',
    'outlook.com',
    'live.com',
    'icloud.com',
    'yandex.com',
  ];

  const getEmailDomain = (emailStr: string) => {
    const parts = emailStr.trim().toLowerCase().split('@');
    return parts.length === 2 ? parts[1] : '';
  };

  const isPublicEmail = publicDomains.includes(getEmailDomain(email));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Lütfen adınızı ve soyadınızı girin.');
      return;
    }

    if (!email.trim()) {
      setError('Lütfen e-posta adresinizi girin.');
      return;
    }

    if (password.length < 8) {
      setError('Şifreniz en az 8 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Girdiğiniz şifreler birbiriyle eşleşmiyor.');
      return;
    }

    if (!termsAccepted) {
      setError('Lütfen kullanım şartlarını ve gizlilik politikasını onaylayın.');
      return;
    }

    try {
      setLoading(true);
      const supabase = createBrowserClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Kayıt olunurken bir hata oluştu.');
        return;
      }

      if (data.user) {
        router.push(`/auth/verify?email=${encodeURIComponent(email.trim())}`);
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
      <div className="mb-6 text-left">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Üye Ol</h1>
        <p className="mt-2 text-sm text-slate-500">
          İdari360 platformuna kayıt olun
        </p>
      </div>

      {/* Hata Bildirimi */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Genel E-posta Uyarısı */}
      {isPublicEmail && (
        <div
          role="note"
          className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800 animate-in fade-in duration-200"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="text-xs font-medium leading-relaxed">
            İdari360 kurumsal bir platformdur. Kurumunuza ait özel e-posta adresinizi (@sirketiniz.com) kullanmanız önerilir.
          </div>
        </div>
      )}

      {/* Kayıt Formu */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Ad Soyad */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Ad Soyad <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User
              className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Adınız Soyadınız"
              disabled={loading}
              className="w-full h-12 pl-11 pr-4 rounded-lg border border-gray-200 text-slate-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* E-posta Adresi */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            E-posta Adresi <span className="text-red-500">*</span>
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

        {/* Telefon */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Telefon <span className="text-slate-400 text-xs font-normal">(İsteğe bağlı)</span>
          </label>
          <div className="relative">
            <Phone
              className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XX XXX XX XX"
              disabled={loading}
              className="w-full h-12 pl-11 pr-4 rounded-lg border border-gray-200 text-slate-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Şifre */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Şifre <span className="text-red-500">*</span>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 8 karakter"
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

        {/* Şifre Tekrar */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Şifre Tekrar <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock
              className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Şifrenizi tekrar girin"
              disabled={loading}
              className="w-full h-12 pl-11 pr-11 rounded-lg border border-gray-200 text-slate-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loading}
              aria-label={showConfirmPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-600 focus:outline-none transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Kullanım Şartları Onayı */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
            />
            <span className="text-xs leading-relaxed text-slate-600">
              Kullanım şartlarını ve gizlilik politikasını okudum, kabul ediyorum.
            </span>
          </label>
        </div>

        {/* Kayıt Ol Butonu */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 mt-2 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Hesap Oluşturuluyor...</span>
            </div>
          ) : (
            'Üye Ol'
          )}
        </button>
      </form>

      {/* Alt Bilgi & Giriş Bağlantısı */}
      <div className="mt-8 pt-5 border-t border-slate-100 text-center text-sm text-slate-600">
        Zaten hesabınız var mı?{' '}
        <Link
          href="/auth/login"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          Giriş Yapın
        </Link>
      </div>
    </div>
  );
}
