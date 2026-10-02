'use client';

import { ReactNode } from 'react';

interface SectionProps {
  icon?: string;
  title: string;
  children: ReactNode;
}

export default function Section({ icon, title, children }: SectionProps) {
  const badgeNumber = icon ? icon.replace(/[^0-9]/g, '') : '';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-5 min-w-0 pb-3 border-b border-slate-100">
        {icon && (
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            {badgeNumber || icon}
          </div>
        )}
        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight break-words">{title}</h2>
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}
