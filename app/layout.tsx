import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'İdari360 - Akıllı İdari İşlemler Yönetim Platformu',
  description: 'Tüm idari süreçlerinizi, tesislerinizi ve operasyonlarınızı tek bir platformdan yönetin.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-[#f1f5f9] text-[#0f172a] antialiased">
        {children}
      </body>
    </html>
  );
}
