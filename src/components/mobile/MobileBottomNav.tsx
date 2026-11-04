'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  PlayCircle,
  BookOpen,
  Heart,
  MoreHorizontal,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/app/inicio', label: 'Início', icon: Home, exact: true },
  { href: '/app/midia', label: 'Conteúdo', icon: PlayCircle },
  { href: '/app/biblia', label: 'Bíblia', icon: BookOpen },
  { href: '/app/contribuir', label: 'Doações', icon: Heart },
  { href: '/app/perfil', label: 'Mais', icon: MoreHorizontal },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 bg-[#FFFFFF] border-t border-[#E5EAF1] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-between h-[66px] px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, ...rest }) => {
          const exact = (rest as any).exact;
          const isActive = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all select-none active:scale-95 ${
                isActive
                  ? 'text-[#1354C8]'
                  : 'text-[#102A4B] hover:text-[#1354C8]'
              }`}
            >
              <Icon
                size={23}
                strokeWidth={isActive ? 2.3 : 1.9}
                className={isActive ? 'text-[#1354C8]' : 'text-[#102A4B]'}
              />
              <span
                className={`text-[10px] leading-tight tracking-tight ${
                  isActive
                    ? 'font-bold text-[#1354C8]'
                    : 'font-medium text-[#102A4B]'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
