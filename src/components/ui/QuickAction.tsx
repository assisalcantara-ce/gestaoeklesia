'use client';

import { ReactNode } from 'react';
import { TOKENS } from '@/config/tokens';

interface QuickActionProps {
  label: string;
  icon: string | ReactNode;
  onClick: () => void;
  className?: string;
}

export default function QuickAction({
  label,
  icon,
  onClick,
  className = '',
}: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 px-5 py-4 border border-slate-100 bg-white hover:bg-slate-50/50 hover:translate-y-[-2px] active:scale-95 transition-all duration-200 min-w-[96px] text-center cursor-pointer ${className}`}
      style={{
        borderRadius: TOKENS.radius.input,
        boxShadow: TOKENS.shadow.card,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = TOKENS.shadow.cardHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = TOKENS.shadow.card;
      }}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#062E6F]/5 text-2xl flex items-center justify-center text-[#062E6F] select-none">
        {typeof icon === 'string' ? <span>{icon}</span> : icon}
      </div>
      <span className="text-[11px] font-bold text-slate-700 tracking-tight leading-tight max-w-[80px]">
        {label}
      </span>
    </button>
  );
}
