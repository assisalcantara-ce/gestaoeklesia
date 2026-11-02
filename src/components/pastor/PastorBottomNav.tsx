'use client';

/**
 * PastorBottomNav — Barra de navegação inferior do App do Pastor.
 * 5 abas: Início, Decisões, Indicadores, Financeiro, Mais.
 * Design navy/dourado, aba ativa destacada em âmbar.
 * Aplica safe-area-inset-bottom para dispositivos com notch.
 */

import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Scale,
  BarChart2,
  DollarSign,
  MoreHorizontal,
} from 'lucide-react';

interface TabItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exactMatch?: boolean;
}

const TABS: TabItem[] = [
  { href: '/pastor', label: 'Início', icon: Home, exactMatch: true },
  { href: '/pastor/decisoes', label: 'Decisões', icon: Scale },
  { href: '/pastor/indicadores', label: 'Indicadores', icon: BarChart2 },
  { href: '/pastor/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/pastor/mais', label: 'Mais', icon: MoreHorizontal },
];

export default function PastorBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(tab: TabItem): boolean {
    if (tab.exactMatch) return pathname === tab.href;
    return pathname.startsWith(tab.href);
  }

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0c182d]/98 backdrop-blur-md border-t border-[#1e2f4d]/80 z-50 flex items-stretch justify-around px-1"
      style={{
        height: 'calc(68px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab);
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className="relative flex flex-col items-center justify-center gap-1 flex-1 py-1 px-0.5 min-w-0 min-h-[44px] cursor-pointer transition-all active:scale-95 select-none"
            aria-label={tab.label}
          >
            <Icon
              size={22}
              className={
                active
                  ? 'text-[#f59e0b]'
                  : 'text-slate-400'
              }
              strokeWidth={active ? 2.3 : 1.8}
            />
            <span
              className={`text-[11px] font-semibold tracking-tight truncate max-w-full transition-colors ${
                active ? 'text-[#f59e0b]' : 'text-slate-400'
              }`}
            >
              {tab.label}
            </span>
            {active && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#f59e0b]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
