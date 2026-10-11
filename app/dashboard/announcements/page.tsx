'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  Megaphone,
  Plus,
  AlertCircle,
  Bell,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  Filter,
} from 'lucide-react';

interface Announcement {
  id: string;
  company_id: string;
  title: string;
  content: string;
  priority: 'dusuk' | 'orta' | 'yuksek' | 'kritik' | string;
  published_by: string;
  published_at?: string;
  created_at?: string;
  expires_at?: string | null;
  is_active: boolean;
  publisher?: {
    id: string;
    full_name: string;
    role: string;
  };
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [userRole, setUserRole] = useState<string>('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'orta',
    expires_at: '',
  });

  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.error('Kullanıcı rolü alınamadı:', err);
      }
    }

    loadUser();
    fetchAnnouncements();
  }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/announcements');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Duyurular yüklenirken hata oluştu');
      }
      const json = await res.json();
      setAnnouncements(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Duyurular alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  const canCreate = ['super_admin', 'company_admin', 'facility_manager'].includes(userRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setModalError('Başlık ve içerik alanları zorunludur.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          priority: formData.priority,
          expires_at: formData.expires_at || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Duyuru kaydedilemedi.');
      }

      setIsModalOpen(false);
      setFormData({
        title: '',
        content: '',
        priority: 'orta',
        expires_at: '',
      });
      await fetchAnnouncements();
    } catch (err: any) {
      setModalError(err.message || 'Duyuru kaydedilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toLowerCase();
    switch (p) {
      case 'kritik':
        return {
          label: 'Kritik',
          bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
          dot: 'bg-rose-500',
        };
      case 'yuksek':
        return {
          label: 'Yüksek',
          bg: 'bg-amber-50 text-amber-700 border-amber-200/80',
          dot: 'bg-amber-500',
        };
      case 'orta':
        return {
          label: 'Orta',
          bg: 'bg-blue-50 text-blue-700 border-blue-200/80',
          dot: 'bg-blue-500',
        };
      case 'dusuk':
      default:
        return {
          label: 'Düşük',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'Süper Yönetici';
      case 'company_admin':
        return 'Şirket Yöneticisi';
      case 'facility_manager':
        return 'Tesis Müdürü';
      case 'facility_officer':
        return 'Tesis Sorumlusu';
      case 'employee':
        return 'Çalışan';
      default:
        return 'Yetkili';
    }
  };

  const filteredAnnouncements = announcements.filter((item) => {
    if (selectedPriority === 'all') return true;
    return item.priority?.toLowerCase() === selectedPriority.toLowerCase();
  });

  const totalCount = announcements.length;
  const activeCount = announcements.filter((a) => a.is_active !== false).length;
  const highPriorityCount = announcements.filter(
    (a) => a.priority?.toLowerCase() === 'yuksek' || a.priority?.toLowerCase() === 'kritik'
  ).length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Duyurular & Bilgilendirmeler
            </h1>
            <p className="text-sm text-slate-500">
              Şirket ve tesis geneli kurumsal duyurular, bildirimler ve güncellemeler
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Yeni Duyuru
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Toplam Duyuru
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
            <Bell className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Aktif Duyuru
            </p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Yüksek Öncelikli
            </p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{highPriorityCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Priority Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'Tümü' },
          { key: 'dusuk', label: 'Düşük' },
          { key: 'orta', label: 'Orta' },
          { key: 'yuksek', label: 'Yüksek' },
          { key: 'kritik', label: 'Kritik' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedPriority(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap ${
              selectedPriority === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content State */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Duyurular yükleniyor...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="font-semibold">{error}</p>
          <button
            onClick={fetchAnnouncements}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700"
          >
            Yeniden Dene
          </button>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Duyuru Bulunamadı</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Bu filtrelere uygun herhangi bir duyuru bulunmamaktadır.
          </p>
        </div>
      ) : (
        /* Announcement Cards List */
        <div className="space-y-4">
          {filteredAnnouncements.map((item) => {
            const badge = getPriorityBadge(item.priority);
            const pubDate = formatDate(item.published_at || item.created_at);
            const expDate = item.expires_at ? formatDate(item.expires_at) : null;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow transition-shadow space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">{item.title}</h2>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{pubDate}</span>
                  </div>
                </div>

                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                  {item.content}
                </p>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-700">
                      {item.publisher?.full_name || 'Yönetim'}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>{getRoleLabel(item.publisher?.role)}</span>
                  </div>

                  {expDate && (
                    <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Son Geçerlilik: {expDate}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* '+ Yeni Duyuru' Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">Yeni Duyuru Oluştur</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Başlık <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Duyuru başlığını girin..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Öncelik
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
                >
                  <option value="dusuk">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="yuksek">Yüksek</option>
                  <option value="kritik">Kritik</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Son Geçerlilik Tarihi (Opsiyonel)
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  İçerik <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Duyuru detaylarını ve açıklamalarını girin..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Yayınla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
