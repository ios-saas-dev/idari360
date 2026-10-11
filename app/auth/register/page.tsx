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
  CheckCircle2,
  Building2,
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

  // Domain Kontrol Durumları (Seçenek B: Kayıtsız Şirketleri Engelleme)
  const [domainChecking, setDomainChecking] = useState(false);
  const [matchedCompany, setMatchedCompany] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  const checkDomainAvailability = async (emailToCheck: string) => {
    const cleanEmail = emailToCheck.trim().toLowerCase();
    if (!cleanEmail.includes('@') || cleanEmail.split('@')[1].length < 3) {
      setMatchedCompany(null);
      setDomainError(null);
      return;
    }

    try {
      setDomainChecking(true);
      setDomainError(null);
      setMatchedCompany(null);

      const res = await fetch('/api/auth/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!data.registered) {
        setDomainError(data.message || 'Şirketiniz henüz sistemde tanımlı değildir.');
        setMatchedCompany(null);
      } else {
        setMatchedCompany(data.companyName);
        setDomainError(null);
      }
    } catch {
      // Hata durumunda formu engelleme, submit anındaki DB trigger kontrol etsin
    } finally {
      setDomainChecking(false);
    }
  };

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

    // Seçenek B Kuralı: Şirket sistemde kayıtlı değilse kesinlikle engelle
    if (domainError) {
      setError(domainError);
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
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
          },
        },
      });

      if (signUpError) {
        // Veritabanı triggerından dönen Seçenek B hata mesajını göster
        setError(signUpError.message || 'Kayıt olunurken bir hata oluştu.');
        return;
      }

      if (data.user) {
        // OTP kodu oluşturmak için backend API'yi tetikle
        await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            purpose: 'email_verification',
          }),
        });

        router.push(`/auth/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
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
          İdari360 kurumsal yönetim platformuna kayıt olun
        </p>
      </div>

      {/* Genel Hata Bildirimi */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Şirket Eşleşme Başarılı Bildirimi */}
      {matchedCompany && !domainError && (
        <div className="mb-5 p-3.5 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3 text-green-800 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-600" />
          <div className="text-xs font-semibold">
            Şirket Doğrulandı: <span className="underline">{matchedCompany}</span>
          </div>
        </div>
      )}

      {/* Seçenek B: Şirket Kayıtlı Değil Uyarısı */}
      {domainError && (
        <div
          role="alert"
          className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 animate-in fade-in duration-200"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <div className="text-xs font-medium leading-relaxed">
            {domainError}
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
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-5 h-5" />
            </div>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ahmet Yılmaz"
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
        </div>

        {/* E-posta */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Kurumsal E-posta <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-5 h-5" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setMatchedCompany(null);
                setDomainError(null);
              }}
              onBlur={(e) => checkDomainAvailability(e.target.value)}
              placeholder="ahmet.yilmaz@sirketiniz.com"
              className={`w-full h-12 pl-11 pr-11 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 text-sm outline-none transition-all ${
                domainError
                  ? 'border-red-400 focus:ring-4 focus:ring-red-100'
                  : matchedCompany
                  ? 'border-green-400 focus:ring-4 focus:ring-green-100'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
              }`}
            />
            {domainChecking && (
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            {matchedCompany && !domainChecking && (
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-green-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* Telefon */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Telefon Numarası
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Phone className="w-5 h-5" />
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XX XXX XX XX"
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
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
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 pl-11 pr-11 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 pl-11 pr-11 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Kullanım Şartları Onayı */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              <Link href="/terms" className="text-blue-600 hover:underline">
                Kullanım şartlarını
              </Link>{' '}
              ve{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                gizlilik politikasını
              </Link>{' '}
              okudum, kabul ediyorum.
            </span>
          </label>
        </div>

        {/* Üye Ol Butonu */}
        <button
          type="submit"
          disabled={loading || Boolean(domainError) || domainChecking}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Kaydediliyor...</span>
            </>
          ) : (
            <span>Üye Ol</span>
          )}
        </button>
      </form>

      {/* Alt Bilgi & Giriş Yap Linki */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <p className="text-sm text-slate-500">
          Zaten bir hesabınız var mı?{' '}
          <Link
            href="/auth/login"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Giriş Yapın
          </Link>
        </p>
      </div>
    </div>
  );
}
