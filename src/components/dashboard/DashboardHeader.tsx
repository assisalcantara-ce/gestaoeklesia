'use client';

import { ReactNode } from 'react';

interface DashboardHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  extra?: ReactNode;
}

export default function DashboardHeader({
  title,
  description,
  breadcrumbs,
  actions,
  extra,
}: DashboardHeaderProps) {
  return (
    <div className="bg-white border-b border-slate-200/80 p-5 md:p-6 shrink-0 transition-all duration-300">
      {/* Breadcrumbs se existirem */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          {breadcrumbs.map((b, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <span className="text-slate-300">/</span>}
              {b.href ? (
                <a href={b.href} className="hover:text-slate-600 transition">
                  {b.label}
                </a>
              ) : (
                <span className="text-slate-500">{b.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Titulo, Descrição e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-[#123b63] tracking-tight leading-none">
            {title}
          </h1>
          {description && (
            <p className="text-slate-500 text-xs md:text-sm leading-relaxed max-w-2xl font-medium">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            {actions}
          </div>
        )}
      </div>

      {/* Área Opcional para Indicadores Rápidos */}
      {extra && <div className="mt-4 pt-4 border-t border-slate-100">{extra}</div>}
    </div>
  );
}
