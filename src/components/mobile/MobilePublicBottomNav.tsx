'use client';

/**
 * MobilePublicBottomNav
 * 
 * Barra de navegação inferior para a rota pública /igreja/[slug].
 * Suporta navegação entre seções da igreja pública e aciona modal de identificação
 * ao clicar em funcionalidades privadas (como Credencial e Perfil).
 */

import { Home, CalendarDays, HeartHandshake, CreditCard, User } from 'lucide-react';

interface MobilePublicBottomNavProps {
  slug: string;
  activeTab?: string;
  onSelectTab: (tab: string) => void;
  onRequestAuth: (featureName: string) => void;
}

export default function MobilePublicBottomNav({
  slug: _slug,
  activeTab = 'inicio',
  onSelectTab,
  onRequestAuth,
}: MobilePublicBottomNavProps) {
  const items = [
    { id: 'inicio', label: 'Início', icon: Home, isPrivate: false },
    { id: 'agenda', label: 'Cultos', icon: CalendarDays, isPrivate: false },
    { id: 'oracao', label: 'Oração', icon: HeartHandshake, isPrivate: false },
    { id: 'credencial', label: 'Credencial', icon: CreditCard, isPrivate: true },
    { id: 'perfil', label: 'Entrar', icon: User, isPrivate: true },
  ];

  const handleClick = (item: typeof items[0]) => {
    if (item.isPrivate) {
      onRequestAuth(item.label);
    } else {
      onSelectTab(item.id);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-md mx-auto bg-[#111827]/95 backdrop-blur-md border-t border-slate-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-around h-16 px-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleClick(item)}
                className={`flex flex-col items-center gap-1 py-1.5 px-2 rounded-xl transition-all min-w-[56px] relative cursor-pointer ${
                  isActive
                    ? 'text-blue-500 font-bold'
                    : 'text-slate-400 hover:text-slate-200 active:text-slate-100'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                )}
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  className={isActive ? 'text-blue-500' : 'text-slate-400'}
                />
                <span
                  className={`text-[10px] tracking-tight ${
                    isActive ? 'text-blue-400 font-semibold' : 'text-slate-400 font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
