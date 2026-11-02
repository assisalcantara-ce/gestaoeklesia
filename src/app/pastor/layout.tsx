/**
 * Layout do App do Pastor — /pastor/*
 *
 * Server component: exporta metadata e viewport PWA.
 * Renderiza estrutura mobile-first sem sidebar, sem shell ERP.
 * Acesso restrito: apenas presidencia/administrador com has_modulo_presidencial.
 */

import type { Metadata, Viewport } from 'next';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: '#0d1f3c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'App do Pastor — Gestão Eklésia',
  description: 'Central executiva do pastor — deliberações, indicadores e financeiro.',
  applicationName: 'Gestão Eklésia',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Eklésia Pastor',
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

export default function PastorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#080f1e] text-slate-100 selection:bg-amber-600 selection:text-white"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="min-h-screen bg-[#0a1628] max-w-md mx-auto shadow-[0_0_80px_rgba(0,0,0,0.7)] border-x border-slate-800/30 relative overflow-x-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
