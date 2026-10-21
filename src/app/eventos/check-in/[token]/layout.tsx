import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Check-in por QR Code • Gestão Eklésia',
  description: 'Controle de entrada e validação de inscrições para eventos',
};

export default function CheckinPublicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}
