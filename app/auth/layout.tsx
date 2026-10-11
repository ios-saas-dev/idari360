import React from 'react';
import { Building2, Shield, BarChart3, Users } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const features = [
    {
      icon: Building2,
      text: 'Tüm idari süreçlerinizi tek platformda yönetin',
    },
    {
      icon: Shield,
      text: 'Kurumsal düzeyde güvenlik ve veri izolasyonu',
    },
    {
      icon: BarChart3,
      text: 'Gerçek zamanlı raporlama ve analitik',
    },
    {
      icon: Users,
      text: 'Çok lokasyonlu yönetim desteği',
    },
  ];

  return (
    <div className="min-h-screen flex w-full bg-[#f1f5f9]">
      {/* Sol Panel: Marka & Özellikler (Masaüstü) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0f1c2e] via-[#14233a] to-[#1a2740] p-12 text-white flex-col justify-between overflow-hidden">
        {/* Arka Plan Dekoratif Işık Efektleri */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-24 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20" />

        {/* Üst Kısım: Logo ve Başlık */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-white">İdari</span>
              <span className="text-3xl font-extrabold tracking-tight text-blue-400">360</span>
            </div>
          </div>
          <p className="mt-3 text-lg font-medium text-slate-300">
            Akıllı İdari İşlemler Yönetim Platformu
          </p>
        </div>

        {/* Orta Kısım: Öne Çıkan Özellikler */}
        <div className="relative z-10 my-auto py-8">
          <div className="space-y-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 shadow-sm backdrop-blur-sm group-hover:bg-blue-600/20 group-hover:border-blue-500/30 transition-all duration-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-base font-medium text-slate-200 group-hover:text-white transition-colors duration-200">
                    {feature.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alt Kısım: Şehir / Bina İllüstrasyonu (SVG) */}
        <div className="relative z-10 pt-6">
          <div className="w-full h-32 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-4 flex flex-col justify-end">
            <svg
              className="absolute inset-x-0 bottom-0 w-full h-24 text-blue-400/20"
              viewBox="0 0 500 120"
              fill="currentColor"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* Arka plan silüeti */}
              <rect x="20" y="50" width="35" height="70" opacity="0.3" rx="2" />
              <rect x="70" y="30" width="45" height="90" opacity="0.4" rx="2" />
              <rect x="130" y="60" width="30" height="60" opacity="0.3" rx="2" />
              <rect x="175" y="20" width="55" height="100" opacity="0.5" rx="3" />
              <rect x="245" y="45" width="40" height="75" opacity="0.4" rx="2" />
              <rect x="300" y="15" width="60" height="105" opacity="0.6" rx="3" />
              <rect x="375" y="55" width="35" height="65" opacity="0.3" rx="2" />
              <rect x="425" y="35" width="50" height="85" opacity="0.5" rx="2" />
              
              {/* Ön plan detay çizgileri */}
              <path
                d="M0 115 L500 115 M0 118 L500 118"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.7"
              />
            </svg>
            <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
              <span>© {new Date().getFullYear()} İdari360. Tüm hakları saklıdır.</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Sistem Aktif
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sağ Panel: Form İçeriği */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center items-center overflow-y-auto min-h-screen px-6 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Mobil Logo Görünümü */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-md">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold tracking-tight text-[#0f1c2e]">İdari</span>
              <span className="text-2xl font-bold tracking-tight text-blue-600">360</span>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
