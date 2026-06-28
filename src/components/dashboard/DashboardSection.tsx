'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface DashboardSectionProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function DashboardSection({
  title,
  icon: Icon,
  children,
  actions,
  className = '',
}: DashboardSectionProps) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 transition-all duration-300 ${className}`}>
      {/* Header da Seção */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
        <h3 className="font-black text-slate-800 text-xs tracking-wider uppercase flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-blue-600" />}
          {title}
        </h3>
        {actions && (
          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
