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
      <div className="max-w-md mx-auto bg-dark-blue text-white h-14 flex items-center px-4 shadow-md">
        {showBack && (
          <button
            onClick={handleBack}
            className="mr-3 p-1.5 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <h1 className="flex-1 text-base font-semibold tracking-wide truncate">{title}</h1>
        {rightSlot && <div className="ml-3">{rightSlot}</div>}
      </div>
    </header>
  );
}
