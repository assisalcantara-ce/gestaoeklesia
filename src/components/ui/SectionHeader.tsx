'use client';

import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  className?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  extra,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-4 ${className}`}>
      <div>
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {extra && <div className="shrink-0">{extra}</div>}
    </div>
  );
}
