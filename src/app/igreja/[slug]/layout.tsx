import type { Metadata, Viewport } from 'next';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Gestão Eklésia — Aplicativo da Igreja',
  description: 'Portal público e Aplicativo Oficial da Igreja — Gestão Eklésia',
  applicationName: 'Gestão Eklésia',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Eklésia',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function IgrejaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      <div className="min-h-screen bg-[#0f172a] max-w-md mx-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] border-x border-slate-800/40 relative overflow-x-hidden flex flex-col justify-between">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
