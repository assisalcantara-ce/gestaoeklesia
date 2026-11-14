import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import './checkin-viewport.css';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: '#031536',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: 'Check-in de Reunião Ministerial — Gestão Eklésia',
  description: 'Terminal de credenciamento e presença em reuniões ministeriais.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Check-in Eklésia',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function CheckinPublicoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="checkin-viewport-scope">
      {children}
    </div>
  );
}
