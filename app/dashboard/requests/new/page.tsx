'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertCircle,
  HelpCircle,
  UserCheck,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Paperclip,
} from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const CATEGORIES = [
  { value: 'yemekhane', label: 'Yemekhane' },
  { value: 'servis', label: 'Servis' },
  { value: 'temizlik', label: 'Temizlik' },
  { value: 'filo', label: 'Filo' },
  { value: 'varlik', label: 'Varlık' },
  { value: 'teknik', label: 'Teknik' },
  { value: 'diger', label: 'Diğer' },
];

const PRIORITIES = [
  { value: 'dusuk', label: 'Düşük' },
  { value: 'orta', label: 'Orta' },
  { value: 'yuksek', label: 'Yüksek' },
  { value: 'kritik', label: 'Kritik' },
];

const MANAGER_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];

export default function NewRequestPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('yemekhane');
  const [priority, setPriority] = useState('orta');
  const [assignedTo, setAssignedTo] = useState('');
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);

  // User & Profiles
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [assignableProfiles, setAssignableProfiles] = useState<Profile[]>([]);
  const [canAssign, setCanAssign] = useState(false);

  // Status states
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id, facility_id, role')
          .eq('id', user.id)
          .single();

        if (profile) {
          setCurrentUserRole(profile.role);
          const hasAssignPermission = MANAGER_ROLES.includes(profile.role);
          setCanAssign(hasAssignPermission);

          if (hasAssignPermission) {
            let query = supabase
              .from('profiles')
              .select('id, full_name, email, role')
              .eq('company_id', profile.company_id);

            if (!['super_admin', 'company_admin'].includes(profile.role) && profile.facility_id) {
              query = query.eq('facility_id', profile.facility_id);
            }

            const { data: profiles } = await query;
            if (profiles) {
              setAssignableProfiles(profiles);
            }
          }
        }
      } catch (err) {
        console.error('Kullanıcı bilgisi yüklenirken hata oluştu:', err);
      }
    }

    loadUserData();
  }, [supabase]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = 'Talep başlığı zorunludur.';
    }
    if (!description.trim()) {
      newErrors.description = 'Talep açıklaması zorunludur.';
    } else if (description.trim().length < 10) {
      newErrors.description = 'Açıklama en az 10 karakter olmalıdır.';
    }
    if (!category) {
      newErrors.category = 'Lütfen bir kategori seçin.';
    }
    if (!priority) {
      newErrors.priority = 'Lütfen bir öncelik seçin.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddPhoto = () => {
    if (!photoUrlInput.trim()) return;
    setAttachmentUrls((prev) => [...prev, photoUrlInput.trim()]);
    setPhotoUrlInput('');
  };

  const handleRemovePhoto = (index: number) => {
    setAttachmentUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          assigned_to: canAssign && assignedTo ? assignedTo : null,
          attachment_urls: attachmentUrls,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Talep oluşturulurken bir hata oluştu.');
      }

      // Success: redirect to request detail page or list
      if (result.data?.id) {
        router.push(`/dashboard/requests/${result.data.id}`);
      } else {
        router.push('/dashboard/requests');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setGlobalError(err.message);
      } else {
        setGlobalError('Talep gönderilirken beklenmedik bir hata oluştu.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button and title */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/requests"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Yeni Talep Oluştur</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            İdari operasyonlar, tesis ihtiyaçları veya destek için yeni talep kaydı açın.
          </p>
        </div>
      </div>

      {globalError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Talep Bilgileri Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Talep Bilgileri</h2>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1.5">
                Başlık <span className="text-rose-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                placeholder="Örn: 2. Kat Toplantı Odası Klima Arızası"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  errors.title
                    ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.title && (
                <p className="text-xs text-rose-500 mt-1 font-medium">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1.5">
                Açıklama <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="description"
                rows={5}
                placeholder="Talebinizle ilgili tüm detayları, konum bilgisini ve gereksinimleri açıklayınız..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all min-h-[120px] ${
                  errors.description
                    ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {errors.description && (
                <p className="text-xs text-rose-500 mt-1 font-medium">{errors.description}</p>
              )}
            </div>

            {/* Category and Priority Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Kategori <span className="text-rose-500">*</span>
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.category
                      ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="text-xs text-rose-500 mt-1 font-medium">{errors.category}</p>
                )}
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Öncelik Seviyesi <span className="text-rose-500">*</span>
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.priority
                      ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {errors.priority && (
                  <p className="text-xs text-rose-500 mt-1 font-medium">{errors.priority}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Görsel / Belge Ekleme (Opsiyonel) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Paperclip className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Görsel / Belge Ekleme</h2>
              <p className="text-xs text-slate-500">
                Problemi veya arızayı gösteren fotoğraf ya da belge linki ekleyebilirsiniz (İsteğe bağlı).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Görsel veya belge linki (https://...)"
                value={photoUrlInput}
                onChange={(e) => setPhotoUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPhoto();
                  }
                }}
                className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddPhoto}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Ekle
              </button>
            </div>

            {attachmentUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {attachmentUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-50">
                    <img src={url} alt={`Ek ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1.5 right-1.5 p-1 bg-rose-600/90 text-white rounded-lg opacity-90 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
                <ImageIcon className="w-4 h-4 text-slate-300" />
                Henüz görsel eklenmedi.
              </div>
            )}
          </div>
        </div>

        {/* Atama Section (Only for facility_manager+ roles) */}
        {canAssign && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Atama Bilgileri</h2>
                <p className="text-xs text-slate-500">
                  Bu talebi doğrudan ilgili personele veya sorumluya atayabilirsiniz (İsteğe bağlı).
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="assigned_to" className="block text-sm font-medium text-slate-700 mb-1.5">
                Atanacak Kişi
              </label>
              <select
                id="assigned_to"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">Atama Yapma (Boş Bırak)</option>
                {assignableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.email}) - {p.role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/requests"
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            Vazgeç
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium transition-colors shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Talep Gönder
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
