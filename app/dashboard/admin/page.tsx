'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  ShieldCheck,
  Building,
  Activity,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Sliders,
  UserCheck,
  RefreshCw,
  Power,
  ShieldAlert,
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'facilities' | 'companies' | 'logs'>('users');
  const [callerRole, setCallerRole] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  // Veri State'leri
  const [users, setUsers] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  // Filtreler & Arama
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Kullanıcı Düzenleme Modalı
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editFacilityId, setEditFacilityId] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [savingUser, setSavingUser] = useState<boolean>(false);
  const [userModalMsg, setUserModalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Yeni Tesis Modalı
  const [facilityModalOpen, setFacilityModalOpen] = useState(false);
  const [newFacName, setNewFacName] = useState('');
  const [newFacCode, setNewFacCode] = useState('');
  const [newFacCity, setNewFacCity] = useState('İstanbul');
  const [newFacRegion, setNewFacRegion] = useState('Marmara');
  const [savingFac, setSavingFac] = useState(false);

  // Yeni Şirket Modalı
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompDomain, setNewCompDomain] = useState('');
  const [newCompPlan, setNewCompPlan] = useState('enterprise');
  const [savingComp, setSavingComp] = useState(false);

  // Verileri Yükle
  const loadData = async () => {
    try {
      setLoading(true);
      setAccessDenied(false);

      // 1. Kullanıcıları çek
      const usersRes = await fetch('/api/admin/users');
      if (usersRes.status === 403 || usersRes.status === 401) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const usersData = await usersRes.json();
      if (usersData.users) setUsers(usersData.users);
      if (usersData.callerRole) setCallerRole(usersData.callerRole);

      // 2. Tesisleri çek
      const facRes = await fetch('/api/admin/facilities');
      const facData = await facRes.json();
      if (facData.facilities) setFacilities(facData.facilities);

      // 3. Süper Admin ise şirketleri çek
      if (usersData.callerRole === 'super_admin') {
        const compRes = await fetch('/api/admin/companies');
        const compData = await compRes.json();
        if (compData.companies) setCompanies(compData.companies);
      }

      // 4. Logları çek
      const logsRes = await fetch('/api/admin/logs');
      const logsData = await logsRes.json();
      if (logsData.logs) setLogs(logsData.logs);

    } catch (err) {
      console.error('Yönetici verisi yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Kullanıcıyı Düzenle Kaydet
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setSavingUser(true);
      setUserModalMsg(null);

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          newRole: editRole,
          newFacilityId: editFacilityId || null,
          isActive: editIsActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Güncelleme başarısız oldu.');
      }

      setUserModalMsg({ type: 'success', text: 'Kullanıcı bilgileri başarıyla güncellendi!' });
      loadData();
      setTimeout(() => setSelectedUser(null), 1200);
    } catch (err: any) {
      setUserModalMsg({ type: 'error', text: err?.message || 'Hata oluştu.' });
    } finally {
      setSavingUser(false);
    }
  };

  // Yeni Tesis Ekle
  const handleCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingFac(true);
      const res = await fetch('/api/admin/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFacName,
          code: newFacCode,
          city: newFacCity,
          region: newFacRegion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tesis eklenemedi.');
      setFacilityModalOpen(false);
      setNewFacName('');
      setNewFacCode('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Tesis eklenirken hata oluştu.');
    } finally {
      setSavingFac(false);
    }
  };

  // Yeni Şirket Tanımla
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingComp(true);
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompName,
          domain: newCompDomain,
          subscriptionPlan: newCompPlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şirket tanımlanamadı.');
      setCompanyModalOpen(false);
      setNewCompName('');
      setNewCompDomain('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Şirket tanımlanırken hata oluştu.');
    } finally {
      setSavingComp(false);
    }
  };

  // Şirket Aktif/Pasif Değiştir
  const handleToggleCompany = async (comp: any) => {
    const nextState = !comp.is_active;
    const confirmMsg = nextState
      ? `"${comp.name}" şirketini aktif etmek istediğinize emin misiniz?`
      : `DİKKAT: "${comp.name}" şirketini pasife alırsanız şirkete ait tüm çalışanların sisteme erişimi derhal durdurulacaktır. Onaylıyor musunuz?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/companies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: comp.id, isActive: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız.');
      loadData();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  // Tesis Aktif/Pasif Değiştir
  const handleToggleFacility = async (fac: any) => {
    const nextState = !fac.is_active;
    if (!confirm(`"${fac.name}" tesisini ${nextState ? 'aktif' : 'pasif'} duruma getirmek istiyor musunuz?`)) return;

    try {
      const res = await fetch('/api/admin/facilities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId: fac.id, isActive: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız.');
      loadData();
    } catch (err: any) {
      alert(err?.message);
    }
  };

  const roleLabels: Record<string, { label: string; badge: string }> = {
    super_admin: { label: 'Süper Admin', badge: 'bg-red-50 text-red-700 border-red-200' },
    company_admin: { label: 'Şirket Yöneticisi', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    facility_manager: { label: 'Tesis Müdürü', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    facility_officer: { label: 'Tesis Sorumlusu', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    employee: { label: 'Çalışan', badge: 'bg-slate-50 text-slate-700 border-slate-200' },
  };

  // Arama filtreleme
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (accessDenied) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Erişim Yetkiniz Bulunmamaktadır</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-md">
          Yönetici Paneli yalnızca Şirket Yöneticileri ve Sistem Süper Admini tarafından görüntülenebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. ÜST BAŞLIK VE YENİLE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Yönetici Paneli
              </h1>
              <p className="text-sm font-medium text-slate-500">
                Yetki, tesis ve kurumsal platform yönetimi
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Verileri Yenile</span>
        </button>
      </div>

      {/* 2. STATS KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kullanıcılar</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{users.length}</p>
          <p className="text-xs text-slate-400 mt-1">Kayıtlı personel</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Aktif Tesisler</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {facilities.filter((f) => f.is_active).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Toplam {facilities.length} tesis</p>
        </div>

        {callerRole === 'super_admin' ? (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Şirketler</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{companies.length}</p>
            <p className="text-xs text-slate-400 mt-1">
              {companies.filter((c) => c.is_active).length} Aktif Şirket
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Yetki Düzeyi</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900 mt-2">
              {roleLabels[callerRole]?.label || callerRole}
            </p>
            <p className="text-xs text-slate-400 mt-1">Şirket Kapsamı</p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Güvenlik Logları</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{logs.length}</p>
          <p className="text-xs text-slate-400 mt-1">Son kayıtlar</p>
        </div>
      </div>

      {/* 3. SEKMELER (TABS) */}
      <div className="border-b border-slate-200/80">
        <nav className="flex space-x-2 sm:space-x-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kullanıcı & Rol Yönetimi</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('facilities')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'facilities'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Tesis & Lokasyonlar</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {facilities.length}
            </span>
          </button>

          {callerRole === 'super_admin' && (
            <button
              onClick={() => setActiveTab('companies')}
              className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'companies'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Şirket Yönetimi</span>
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                Süper Admin
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Güvenlik & Aktivite Günlüğü</span>
          </button>
        </nav>
      </div>

      {/* 4. TAB 1: KULLANICILAR VE ROLLER */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Arama ve Filtre Çubuğu */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kullanıcı ara..."
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:border-blue-500 outline-none"
              >
                <option value="all">Tüm Roller</option>
                <option value="super_admin">Süper Admin</option>
                <option value="company_admin">Şirket Yöneticisi</option>
                <option value="facility_manager">Tesis Müdürü</option>
                <option value="facility_officer">Tesis Sorumlusu</option>
                <option value="employee">Çalışan</option>
              </select>
            </div>
          </div>

          {/* Kullanıcılar Tablosu */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 text-slate-500 text-xs uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Kullanıcı</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Bağlı Tesis</th>
                  <th className="px-6 py-4">Şirket</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      Kullanıcı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-900">{u.full_name || 'İsimsiz'}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border ${
                            roleLabels[u.role]?.badge || 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {roleLabels[u.role]?.label || u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {u.facilities?.name ? (
                          <span className="flex items-center gap-1.5 text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            {u.facilities.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Atanmadı</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {u.companies?.name || 'Genel Platform'}
                      </td>
                      <td className="px-6 py-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                            <XCircle className="w-3.5 h-3.5" />
                            Pasif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setEditRole(u.role);
                            setEditFacilityId(u.facility_id || '');
                            setEditIsActive(u.is_active ?? true);
                            setUserModalMsg(null);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all"
                        >
                          Yetki & Tesis Düzenle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB 2: TESİSLER VE LOKASYONLAR */}
      {activeTab === 'facilities' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800">Şirket Tesisleri</h2>
            <button
              onClick={() => setFacilityModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Tesis Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilities.map((f) => (
              <div
                key={f.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                      {f.code}
                    </span>
                    <button
                      onClick={() => handleToggleFacility(f)}
                      title={f.is_active ? 'Tesisi Pasife Al' : 'Tesisi Aktife Al'}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                        f.is_active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{f.is_active ? 'Aktif' : 'Pasif'}</span>
                    </button>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{f.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {f.city} • {f.region}
                  </p>
                  {f.address && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">{f.address}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
                  <span>Şirket: {f.companies?.name || 'Mevcut'}</span>
                  <span>{new Date(f.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TAB 3: ŞİRKET YÖNETİMİ (SÜPER ADMİN) */}
      {activeTab === 'companies' && callerRole === 'super_admin' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-800">Platform Şirketleri</h2>
              <p className="text-xs text-slate-500">Çok kiracılı (multi-tenant) kurumsal şirket tanımları</p>
            </div>
            <button
              onClick={() => setCompanyModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all shadow-md shadow-purple-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Şirket Tanımla</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {companies.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                      {c.subscription_plan}
                    </span>
                    <button
                      onClick={() => handleToggleCompany(c)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        c.is_active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{c.is_active ? 'Aktif Şirket' : 'Pasife Alındı'}</span>
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{c.name}</h3>
                  <p className="text-xs font-semibold text-blue-600 mt-1">
                    E-posta Domain: @{c.email_domain || 'tanımsız'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Tesis Sayısı: {c.facilities?.[0]?.count || 0}</span>
                  <span>Personel: {c.profiles?.[0]?.count || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. TAB 4: GÜVENLİK VE AKTİVİTE LOGLARI */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-800">Denetim İzi & Aktivite Günlüğü</h2>
              <p className="text-xs text-slate-500">
                Tüm rol değişiklikleri, tesis kilitleri ve güvenlik olayları kaydedilir.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 text-slate-500 text-xs uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Olay Türü</th>
                  <th className="px-6 py-4">İşlemi Yapan</th>
                  <th className="px-6 py-4">Detaylar</th>
                  <th className="px-6 py-4 text-right">Zaman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      Henüz kayıtlı aktivite bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {log.profiles?.full_name || log.profiles?.email || 'Sistem / Anonim'}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-500 max-w-md truncate">
                        {JSON.stringify(log.details)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-400">
                        {new Date(log.created_at).toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: KULLANICI DÜZENLE */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Kullanıcı Yetki & Tesis Düzenle</h3>
                <p className="text-xs text-slate-500">{selectedUser.full_name} ({selectedUser.email})</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {userModalMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  userModalMsg.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {userModalMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{userModalMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-sm">
              {/* Rol Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kullanıcı Rolü</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:border-blue-500 outline-none"
                >
                  <option value="employee">Çalışan (employee)</option>
                  <option value="facility_officer">Tesis Sorumlusu (facility_officer)</option>
                  <option value="facility_manager">Tesis Müdürü (facility_manager)</option>
                  {callerRole === 'super_admin' && (
                    <>
                      <option value="company_admin">Şirket Yöneticisi (company_admin)</option>
                      <option value="super_admin">Sistem Süper Admini (super_admin)</option>
                    </>
                  )}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  * Kendi yetki seviyenizin üstünde veya eşit bir rol atanamaz.
                </p>
              </div>

              {/* Tesis Atama */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bağlı Olduğu Tesis</label>
                <select
                  value={editFacilityId}
                  onChange={(e) => setEditFacilityId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:border-blue-500 outline-none"
                >
                  <option value="">Tesis Atanmadı (Seçiniz)</option>
                  {facilities
                    .filter((f) => callerRole === 'super_admin' || f.company_id === selectedUser.company_id)
                    .map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name} ({fac.city})
                      </option>
                    ))}
                </select>
              </div>

              {/* Hesap Durumu */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Kullanıcı Hesabı Aktif</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="w-1/2 h-11 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="w-1/2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {savingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Değişiklikleri Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: YENİ TESİS EKLE */}
      {facilityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Yeni Tesis Tanımla</h3>
            <form onSubmit={handleCreateFacility} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tesis Adı *</label>
                <input
                  type="text"
                  required
                  value={newFacName}
                  onChange={(e) => setNewFacName(e.target.value)}
                  placeholder="Örn: Maslak Genel Merkez"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tesis Kodu *</label>
                <input
                  type="text"
                  required
                  value={newFacCode}
                  onChange={(e) => setNewFacCode(e.target.value)}
                  placeholder="Örn: MSK-01"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Şehir</label>
                  <input
                    type="text"
                    value={newFacCity}
                    onChange={(e) => setNewFacCity(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bölge</label>
                  <input
                    type="text"
                    value={newFacRegion}
                    onChange={(e) => setNewFacRegion(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFacilityModalOpen(false)}
                  className="w-1/2 h-11 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingFac}
                  className="w-1/2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2"
                >
                  {savingFac && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Tesisi Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: YENİ ŞİRKET TANIMLA (SÜPER ADMİN) */}
      {companyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Yeni Şirket Tanımla</h3>
            <form onSubmit={handleCreateCompany} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Şirket Adı *</label>
                <input
                  type="text"
                  required
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  placeholder="Örn: Anadolu Holding A.Ş."
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kurumsal E-posta Domaini *</label>
                <input
                  type="text"
                  required
                  value={newCompDomain}
                  onChange={(e) => setNewCompDomain(e.target.value)}
                  placeholder="Örn: anadoluholding.com"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:border-purple-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * Bu domaine sahip kullanıcılar kaydolurken otomatik olarak bu şirkete bağlanır.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Abonelik Planı</label>
                <select
                  value={newCompPlan}
                  onChange={(e) => setNewCompPlan(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:border-purple-500 outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompanyModalOpen(false)}
                  className="w-1/2 h-11 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingComp}
                  className="w-1/2 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center justify-center gap-2"
                >
                  {savingComp && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Şirketi Oluştur</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
