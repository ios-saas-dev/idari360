'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Mail,
  Shield,
  Building,
  Phone,
  Lock,
  Bell,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

interface ProfileData {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  phone?: string;
  company_id?: string;
  companies?: {
    name: string;
  };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('İdari360');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification Preferences State
  const [notifRequests, setNotifRequests] = useState(true);
  const [notifAudits, setNotifAudits] = useState(true);
  const [notifActions, setNotifActions] = useState(false);
  const [notifSystem, setNotifSystem] = useState(true);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [notifMessage, setNotifMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Security / Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        setLoading(true);
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profileRecord, error } = await supabase
            .from('profiles')
            .select('*, companies(name)')
            .eq('id', user.id)
            .maybeSingle();

          if (profileRecord) {
            setProfile({
              id: user.id,
              email: user.email || profileRecord.email,
              full_name: profileRecord.full_name || user.user_metadata?.full_name || '',
              role: profileRecord.role || 'employee',
              phone: profileRecord.phone || user.user_metadata?.phone || '',
              company_id: profileRecord.company_id,
              companies: profileRecord.companies,
            });

            setFullName(profileRecord.full_name || user.user_metadata?.full_name || '');
            setPhone(profileRecord.phone || user.user_metadata?.phone || '');
            if (profileRecord.companies?.name) {
              setCompanyName(profileRecord.companies.name);
            }
          } else {
            setProfile({
              id: user.id,
              email: user.email || '',
              full_name: user.user_metadata?.full_name || '',
              role: 'employee',
              phone: user.user_metadata?.phone || '',
            });
            setFullName(user.user_metadata?.full_name || '');
            setPhone(user.user_metadata?.phone || '');
          }

          // Load local notification settings if stored
          const savedNotifs = localStorage.getItem('idari360_notif_prefs');
          if (savedNotifs) {
            try {
              const parsed = JSON.parse(savedNotifs);
              setNotifRequests(parsed.requests ?? true);
              setNotifAudits(parsed.audits ?? true);
              setNotifActions(parsed.actions ?? false);
              setNotifSystem(parsed.system ?? true);
            } catch (e) {
              // Ignore json parse error
            }
          }
        }
      } catch (err) {
        console.error('Profil yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, []);

  // Update Profile
  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsUpdatingProfile(true);
      setProfileMessage(null);

      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }

      // Update in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      // Also update auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      });

      setProfileMessage({ type: 'success', text: 'Profil bilgileriniz başarıyla güncellendi.' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Profil güncellenirken bir hata oluştu.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  // Update Notification Preferences
  async function handleSaveNotifications() {
    try {
      setIsSavingNotifs(true);
      setNotifMessage(null);

      const prefs = {
        requests: notifRequests,
        audits: notifAudits,
        actions: notifActions,
        system: notifSystem,
      };

      localStorage.setItem('idari360_notif_prefs', JSON.stringify(prefs));

      // Simulate a small delay for user feedback
      await new Promise((resolve) => setTimeout(resolve, 350));
      setNotifMessage({ type: 'success', text: 'Bildirim tercihleriniz kaydedildi.' });
    } catch (err) {
      setNotifMessage({ type: 'error', text: 'Tercihler kaydedilemedi.' });
    } finally {
      setIsSavingNotifs(false);
    }
  }

  // Update Password
  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) {
      setPasswordMessage({ type: 'error', text: 'Lütfen yeni şifrenizi giriniz.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Şifreniz en az 6 karakter olmalıdır.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Yeni şifreler birbiriyle eşleşmiyor.' });
      return;
    }

    try {
      setIsUpdatingPassword(true);
      setPasswordMessage(null);

      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setPasswordMessage({ type: 'success', text: 'Şifreniz başarıyla değiştirildi.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMessage({
        type: 'error',
        text: err.message || 'Şifre güncellenirken bir hata oluştu.',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  // Role labels
  const roleNames: Record<string, { label: string; badge: string }> = {
    super_admin: { label: 'Süper Yönetici', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    company_admin: { label: 'Şirket Yöneticisi', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    facility_manager: { label: 'Tesis Müdürü', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    facility_officer: { label: 'Tesis Görevlisi', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    employee: { label: 'Çalışan', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  const currentRoleInfo = roleNames[profile?.role || 'employee'] || {
    label: profile?.role || 'Kullanıcı',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Ayarlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 shadow-sm">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sistem & Profil Ayarları
          </h1>
          <p className="text-sm text-slate-500">
            Kişisel profilinizi, bildirim kanallarınızı ve güvenlik tercihlerinizi yapılandırın.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Information (Takes 2 columns on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Profil Bilgileri</h2>
                  <p className="text-xs text-slate-500">Hesap bilgilerinizi ve iletişim detaylarınızı güncelleyin</p>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${currentRoleInfo.badge}`}>
                {currentRoleInfo.label}
              </span>
            </div>

            {profileMessage && (
              <div
                className={`mb-5 p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  profileMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {profileMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {/* Ad Soyad */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ad Soyad
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adınız ve Soyadınız"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  E-Posta Adresi (Değiştirilemez)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={profile?.email || ''}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Telefon & Şirket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Telefon Numarası
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05XX XXX XX XX"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bağlı Şirket
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      disabled
                      value={companyName}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm shadow-blue-600/20 disabled:opacity-60"
                >
                  {isUpdatingProfile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isUpdatingProfile ? 'Kaydediliyor...' : 'Profili Güncelle'}
                </button>
              </div>
            </form>
          </div>

          {/* Güvenlik & Şifre Değiştirme Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Güvenlik & Şifre Değiştirme</h2>
                <p className="text-xs text-slate-500">
                  Hesabınızın güvenliği için periyodik olarak güçlü bir şifre belirleyin
                </p>
              </div>
            </div>

            {passwordMessage && (
              <div
                className={`mb-5 p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  passwordMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {passwordMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mevcut Şifre
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Mevcut şifreniz"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Yeni Şifre
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    required
                    placeholder="En az 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Yeni Şifre Tekrar
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    required
                    placeholder="Yeni şifrenizi doğrulayın"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition shadow-sm shadow-purple-600/20 disabled:opacity-60"
                >
                  {isUpdatingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  {isUpdatingPassword ? 'Şifre Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Notification Preferences */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Bildirim Tercihleri</h2>
                <p className="text-xs text-slate-500">Hangi olaylarda bildirim almak istediğinizi seçin</p>
              </div>
            </div>

            {notifMessage && (
              <div
                className={`mb-4 p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  notifMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{notifMessage.text}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                E-Posta Bildirimleri
              </div>

              {/* Talepler Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Talepler</div>
                  <div className="text-[11px] text-slate-500">
                    Yeni talep ve durum değişiklikleri
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifRequests(!notifRequests)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-200 ease-in-out ${
                    notifRequests ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-md transform" />
                </button>
              </div>

              {/* Denetimler Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Denetimler</div>
                  <div className="text-[11px] text-slate-500">
                    Saha teftişleri ve uygunsuzluklar
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifAudits(!notifAudits)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-200 ease-in-out ${
                    notifAudits ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-md transform" />
                </button>
              </div>

              {/* Aksiyonlar Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Aksiyonlar</div>
                  <div className="text-[11px] text-slate-500">
                    Size atanan düzeltici faaliyetler
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifActions(!notifActions)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-200 ease-in-out ${
                    notifActions ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-md transform" />
                </button>
              </div>

              <div className="pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Sistem & Uygulama İçi
              </div>

              {/* Sistem bildirimleri Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Sistem Bildirimleri</div>
                  <div className="text-[11px] text-slate-500">
                    Duyurular, planlı bakım ve güncellemeler
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifSystem(!notifSystem)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-200 ease-in-out ${
                    notifSystem ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-md transform" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={isSavingNotifs}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition shadow-sm disabled:opacity-60"
              >
                {isSavingNotifs ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {isSavingNotifs ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
