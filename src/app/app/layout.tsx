/**
 * Layout do App Mobile — /app/*
 *
 * Server component: exporta metadata completa PWA, Apple Mobile e Viewport.
 * Importa app-mobile.css com estrutura position:fixed + overflow:hidden que
 * bloqueia pinch-to-zoom no Safari iOS sem depender de event listeners.
 * Renderiza o MobileShell (client) com MobileMemberProvider, OfflineBanner e PwaInstaller.
 */

import type { Metadata, Viewport } from 'next';
import MobileShell from '@/components/mobile/MobileShell';
import './app-mobile.css';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: '#061D38',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: 'Gestão Eklésia — App do Membro',
  description: 'Portal e Aplicativo Oficial do Membro — Gestão Eklésia',
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <MobileShell>{children}</MobileShell>;
}