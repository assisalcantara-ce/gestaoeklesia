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
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0d1a2e]/95 backdrop-blur-md border-t border-slate-800/60 z-50 flex items-center justify-around px-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab);
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 px-0.5 min-w-0 cursor-pointer transition-all active:scale-95 select-none"
            aria-label={tab.label}
          >
            <Icon
              size={20}
              className={
                active
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }
              strokeWidth={active ? 2.2 : 1.7}
            />
            <span
              className={`text-[10px] font-semibold tracking-tight truncate max-w-full transition-colors ${
                active ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {tab.label}
            </span>
            {active && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
