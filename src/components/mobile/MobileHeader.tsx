'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  backHref?: string;
  rightSlot?: React.ReactNode;
}

export default function MobileHeader({
  title,
  showBack = false,
  backHref,
  rightSlot,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-md mx-auto bg-[#0f172a]/95 backdrop-blur-md text-white h-14 flex items-center px-4 border-b border-slate-800/60 shadow-xs">
        {showBack && (
          <button
            onClick={handleBack}
            className="mr-3 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <h1 className="flex-1 text-base font-bold tracking-tight text-slate-100 truncate">{title}</h1>
        {rightSlot && <div className="ml-3">{rightSlot}</div>}
      </div>
    </header>
  );
}
