import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Acolhimento de Visitantes | Gestão Eklésia',
  description: 'Canal oficial de recepção, boas-vindas e acolhimento da igreja.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AcolhimentoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-[100dvh] bg-slate-100">{children}</div>;
}
