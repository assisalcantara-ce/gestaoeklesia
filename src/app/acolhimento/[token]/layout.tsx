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
  return (
    <div className="min-h-[100dvh] w-full bg-[#0A2E63] bg-[url('/img/BG_acolhimento.png')] bg-cover bg-top bg-no-repeat overflow-x-hidden selection:bg-sky-500 selection:text-white">
      {children}
    </div>
  );
}
