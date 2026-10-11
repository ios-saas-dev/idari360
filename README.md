<div align="center">

# 🏢 İdari360

### Akıllı İdari İşlemler Yönetim Platformu

[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**Çok kiracılı (multi-tenant) SaaS mimarisiyle kurumların tesis, yemekhane, servis, temizlik, güvenlik ve varlık yönetimini tek platformda dijitalleştiren uçtan uca idari işlemler yönetim sistemi.**

</div>

---

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Yol Haritası](#-yol-haritası)
- [Teknoloji Yığını](#-teknoloji-yığını)
- [Modüller](#-modüller)
- [Rol Hiyerarşisi](#-rol-hiyerarşisi)
- [Kurulum](#-kurulum)
- [Veritabanı Migrasyonları](#-veritabanı-migrasyonları)
- [Proje Yapısı](#-proje-yapısı)
- [Lisans](#-lisans)

---

## ✨ Özellikler

- 🔐 **Çok Kiracılı Mimari** — Her şirket kendi verisini görür, şirketler arası veri izolasyonu
- 👥 **5 Seviyeli Rol Sistemi** — Süper Admin'den Personel'e kadar granüler yetkilendirme
- 🛡️ **Satır Bazlı Güvenlik (RLS)** — PostgreSQL seviyesinde veri koruma
- 📧 **E-posta Domain Eşleştirme** — Kayıt sırasında otomatik şirket eşleştirme
- 🔑 **OTP Doğrulama** — E-posta ile güvenli üyelik onayı
- 📱 **Responsive Tasarım** — Web ve mobil uyumlu arayüz
- 📊 **Akıllı Dashboard** — Anlık istatistik ve grafikler
- 🔔 **Otomasyon & Bildirimler** — Planlı hatırlatmalar ve otomatik uyarılar

---

## 🗺️ Yol Haritası

| Faz | Açıklama | Çıktı | Durum |
|-----|----------|-------|-------|
| **Faz 1** | Uygulama Arayüzü & Temel Altyapı | İdari360 iskeleti, giriş sistemi, dashboard | ✅ Done |
| **Faz 2** | Talep & Onay Sistemi | İş akışları, kategori bazlı talepler | 🔄 In Progress |
| **Faz 3** | Ana Modüller | Yemekhane, Servis, Güvenlik, Temizlik, Şube | 🔄 In Progress |
| **Faz 4** | Denetim & Kontrol Merkezi | Dijital denetim sistemi, puanlama | 🔄 In Progress |
| **Faz 5** | Tedarikçi & Firma Performansı | Tedarikçi karnesi, performans takibi | 🔄 In Progress |
| **Faz 6** | Raporlama & Yönetici Dashboard | Yönetim aracı, bölgesel analizler | 🔄 In Progress |
| **Faz 7** | Otomasyon & Bildirimler | Otomatik hatırlatmalar, e-posta bildirimleri | 🔄 In Progress |
| **Faz 8** | Akıllı İdari 360 | AI destekli analiz & öneriler | 📋 Planned |

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | Next.js 14+ (App Router), React 18, TypeScript |
| **Stil** | Tailwind CSS 4, shadcn/ui |
| **Backend** | Supabase (PostgreSQL 15+, Auth, Storage, Realtime) |
| **Güvenlik** | Row Level Security (RLS), JWT, OTP |
| **Deployment** | Vercel (Web), Supabase Cloud (DB) |

---

## 📦 Modüller

### 🍽️ Yemekhane Yönetimi
Günlük menü planlama, yemek sayıları, üretim/tüketim takibi, tedarikçi takibi, memnuniyet anketi, hijyen denetimi. Yerinde üretim ve taşıma modelleri desteklenir.

### 🚌 Akıllı Servis Yönetimi
Servis araçları, güzergahlar, sürücü bilgileri, vardiya planlaması, araç/sürücü denetimleri, klima kontrolleri, aylık puantaj.

### 🛡️ Güvenlik Yönetimi
Güvenlik denetimleri, eğitimler, raporlar, personel puantajı, vardiya takibi.

### 🧹 Temizlik Yönetimi
Personel organizasyon şeması, ekipman envanterleri, makine takibi, hijyen denetimleri, puantaj.

### 📦 Varlık Yönetimi
Demirbaş listesi, lokasyon takibi, personel zimmeti, devir/iade, arıza/bakım, QR kod, varlık geçmişi.

### 🏢 Şube Yönetimi
Her şubenin 360° karnesi — temizlik, ilaçlama, waternet, maliyet.

### 📋 Denetim & Kontrol Merkezi
Tüm modüller için dijital denetim formları, fotoğraf yükleme, otomatik puanlama, PDF rapor oluşturma, aksiyon takibi.

### 📝 Talep & Onay Sistemi
Kategori bazlı talep oluşturma, onay akışı, durum takibi, ek dosya ekleme.

### 🏭 Tedarikçi Karnesi
Firma performans takibi — hizmet kalitesi, zamanında hizmet, şikayet yönetimi, personel uygunluğu, denetim sonuçları.

### ♻️ Akıllı Atık Yönetimi
Konteyner tartım, günlük karton/naylon raporları, aylık geri dönüşüm geliri.

---

## 👥 Rol Hiyerarşisi

```
┌─────────────────────────────────────────────────────────┐
│  super_admin (100)    → Tüm sisteme tam erişim          │
│  ├── company_admin (80)  → Kendi şirketinde tam erişim  │
│  │   ├── facility_manager (60) → Kendi tesisinde tam    │
│  │   │   ├── facility_officer (40) → Kendi tesisinde    │
│  │   │   │   └── employee (20)  → Sadece kendi verileri │
└─────────────────────────────────────────────────────────┘
```

| Rol | Kapsam | Yetki |
|-----|--------|-------|
| **super_admin** | Tüm sistem | Şirket CRUD, admin atama, sistem yönetimi |
| **company_admin** | Kendi şirketi | Tesis CRUD, kullanıcı yönetimi, raporlar |
| **facility_manager** | Kendi tesisi | Denetim, talep, aksiyon yönetimi |
| **facility_officer** | Kendi tesisi | Denetim, talep, aksiyon yönetimi |
| **employee** | Kendi verileri | Profil görüntüleme, talep oluşturma |

> ⚠️ **Güvenlik Kuralları:**
> - Hiçbir rol, kendi seviyesindeki veya üstündeki bir role yetki veremez/alamaz
> - Hiçbir kullanıcı kendi rolünü yükseltemez
> - Şirketler arası veri kesinlikle izole edilir

---

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- npm veya pnpm
- Supabase hesabı
- Git

### 1. Repoyu Klonlayın
```bash
git clone https://github.com/ios-saas-dev/idari360.git
cd idari360
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Ortam Değişkenlerini Ayarlayın
```bash
cp .env.example .env.local
```
`.env.local` dosyasını Supabase bilgilerinizle doldurun.

### 4. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

---

## 🗄️ Veritabanı Migrasyonları

Migration dosyaları `supabase/migrations/` klasöründedir:

| Dosya | Açıklama |
|-------|----------|
| `001_core_schema.sql` | Tüm tablolar, enum'lar, indexler ve trigger'lar |
| `002_rls_policies.sql` | RLS politikaları, güvenlik fonksiyonları ve trigger'lar |
| `003_seed_data.sql` | Başlangıç verileri (denetim soruları, varsayılan ayarlar) |

### Supabase'e Uygulama
Supabase Dashboard → SQL Editor'den migration dosyalarını sırasıyla çalıştırın:
1. Önce `001_core_schema.sql`
2. Sonra `002_rls_policies.sql`
3. Son olarak `003_seed_data.sql`

---

## 📁 Proje Yapısı

```
idari360/
├── 📂 app/                    # Next.js App Router
│   ├── (auth)/               # Giriş, kayıt, şifre sıfırlama
│   ├── (dashboard)/          # Ana dashboard
│   ├── (admin)/              # Süper admin paneli
│   └── layout.tsx            # Root layout
├── 📂 components/             # Yeniden kullanılabilir bileşenler
│   ├── ui/                   # shadcn/ui bileşenleri
│   ├── forms/                # Form bileşenleri
│   └── charts/               # Grafik bileşenleri
├── 📂 lib/                    # Yardımcı fonksiyonlar
│   ├── supabase/             # Supabase client yapılandırması
│   ├── utils/                # Genel yardımcılar
│   └── validations/          # Zod şemaları
├── 📂 hooks/                  # Custom React hooks
├── 📂 types/                  # TypeScript tip tanımları
├── 📂 supabase/               # Supabase yapılandırma
│   ├── migrations/           # SQL migration dosyaları
│   └── seed.sql              # Başlangıç verileri
├── 📂 docs/                   # Proje dokümantasyonu
│   └── DATABASE.md           # Veritabanı dokümantasyonu
├── 📂 public/                 # Statik dosyalar
├── .env.example              # Ortam değişkenleri şablonu
├── .gitignore                # Git ignore kuralları
├── package.json              # Proje bağımlılıkları
├── tailwind.config.ts        # Tailwind yapılandırması
├── tsconfig.json             # TypeScript yapılandırması
└── README.md                 # Bu dosya
```

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

<div align="center">

**İdari360** ile idari işlemlerinizi dijitalleştirin. 🚀

Geliştirici: [@ios-saas-dev](https://github.com/ios-saas-dev)

</div>
