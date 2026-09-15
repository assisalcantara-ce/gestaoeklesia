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
      <div className="max-w-md mx-auto bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around h-16 px-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2.5 rounded-xl transition-colors min-w-[56px] ${
                  isActive
                    ? 'text-dark-blue'
                    : 'text-gray-400 hover:text-gray-600 active:text-gray-700'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? 'text-dark-blue font-bold' : 'text-gray-400'
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
