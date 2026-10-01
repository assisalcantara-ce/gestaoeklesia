import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Check-in por QR Code • Gestão Eklésia',
  description: 'Controle de entrada e validação de inscrições para eventos',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
};

export default function CheckinPublicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}
