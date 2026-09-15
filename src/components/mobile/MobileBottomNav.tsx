'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, CreditCard, DollarSign, CalendarDays } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/app/inicio', label: 'Início', icon: Home },
  { href: '/app/eventos', label: 'Eventos', icon: CalendarDays },
  { href: '/app/contribuir', label: 'Contribuir', icon: DollarSign },
  { href: '/app/carteirinha', label: 'Carteirinha', icon: CreditCard },
  { href: '/app/perfil', label: 'Perfil', icon: User },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-md mx-auto bg-[#111827]/95 backdrop-blur-md border-t border-slate-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-around h-16 px-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-1.5 px-2 rounded-xl transition-all min-w-[56px] relative ${
                  isActive
                    ? 'text-blue-500 font-bold'
                    : 'text-slate-400 hover:text-slate-200 active:text-slate-100'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? 'text-blue-500' : 'text-slate-400'} />
                <span
                  className={`text-[10px] tracking-tight ${
                    isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 font-medium'
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
