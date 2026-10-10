'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TechnicalAccessBanner from '@/components/admin/technical/TechnicalAccessBanner';
import GlobalFinancialBanner from '@/components/financeiro/GlobalFinancialBanner';
import GlobalJuridicoGuard from '@/components/juridico/GlobalJuridicoGuard';
import { ReactNode } from 'react';

// Prefixos de rota que exibem o Sidebar
const SIDEBAR_PREFIXES = [
  '/dashboard',
  '/tesouraria',
  '/secretaria',
  '/acolhimento',
  '/ebd',
  '/comissao',
  '/reunioes',
  '/missoes',
  '/eventos',
  '/presidencia',
  '/patrimonio',
  '/financeiro',
  '/auditoria',
  '/geolocalizacao',
  '/usuarios',
  '/suporte',
  '/configuracoes',
  '/agenda',
  '/juridico/meu-contrato',
];

const STANDALONE_PUBLIC_PREFIXES = [
  '/reunioes/painel',
  '/eventos/check-in',
  '/eventos/e',
  '/ebd/chamada-rapida',
  '/formularios',
  '/membro',
  '/validar',
  '/revista',
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Páginas públicas e standalone (Check-in, Inscrição Pública de Eventos, Painel TV, etc.)
  const isStandalone = STANDALONE_PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  if (isStandalone) {
    return <>{children}</>;
  }

  const showSidebar = SIDEBAR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  if (!showSidebar) {
    return (
      <>
        <TechnicalAccessBanner />
        <GlobalFinancialBanner />
        <GlobalJuridicoGuard />
        {children}
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#f4f6f9] overflow-x-hidden">
      <TechnicalAccessBanner />
      <GlobalFinancialBanner />
      <GlobalJuridicoGuard />
      <div className="flex flex-1 min-h-0 min-w-0">
        <Sidebar />
        <main className="flex-1 min-h-0 min-w-0 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}

