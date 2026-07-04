'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import AppContent from './AppContent';

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
];

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const showSidebar = SIDEBAR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-[#F4F7FB] overflow-hidden">
      {/* AppSidebar - Desktop: visible directly, Mobile: toggled visibility */}
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed left-4 top-4 z-40 p-2 bg-[#062E6F] text-white rounded-lg shadow-md hover:bg-[#154A92] transition-colors"
        aria-label="Menu"
        aria-expanded={isMobileMenuOpen}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop for Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm z-30 md:hidden transition-all duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`fixed left-0 top-0 h-dvh min-h-screen z-40 transition-transform duration-250 md:static md:translate-x-0 md:h-full ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AppSidebar
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      </div>

      {/* Main Body */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col relative">
        <AppHeader />
        <AppContent>{children}</AppContent>
      </div>
    </div>
  );
}
