'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { ReactNode } from 'react';

// Prefixos de rota que exibem o Sidebar
const SIDEBAR_PREFIXES = [
  '/dashboard',
  '/tesouraria',
  '/secretaria',
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
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showSidebar = SIDEBAR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-[#f4f6f9] overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-h-0 flex flex-col">
        {children}
      </main>
    </div>
  );
}
