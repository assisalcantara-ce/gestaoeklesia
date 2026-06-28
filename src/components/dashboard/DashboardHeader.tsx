'use client';

import { ReactNode } from 'react';

interface DashboardHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  extra?: ReactNode;
  greeting?: string;
  currentDate?: string;
  quickStats?: ReactNode;
  contextSubtitle?: string;
  centerContent?: ReactNode;
}

export default function DashboardHeader({
  title,
  description,
  breadcrumbs,
  actions,
  extra,
  greeting,
  currentDate,
  quickStats,
  contextSubtitle,
  centerContent,
}: DashboardHeaderProps) {
  return (
    <div className="bg-white px-4 md:px-6 pt-5 pb-0 shrink-0">
      
      {/* Top Meta: Saudação e Data */}
      {(greeting || currentDate) && (
        <div className="flex items-center justify-between gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
          {greeting ? (
            <span className="text-slate-500 font-semibold">{greeting}</span>
          ) : <div />}
          {currentDate && <span>{currentDate}</span>}
        </div>
      )}

      {/* Breadcrumbs se existirem */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
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

      {/* Titulo, Snapshot Central e Ações */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        
        {/* Esquerda: Titulo e Descrição */}
        <div className="space-y-1 max-w-xl">
          {contextSubtitle && (
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-0.5">
              {contextSubtitle}
            </span>
          )}
          <h1 className="text-2xl md:text-3.5xl font-black text-[#123b63] tracking-tight leading-none">
            {title}
          </h1>
          {description && (
            <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-medium">
              {description}
            </p>
          )}
        </div>

        {/* Centro: Snapshot Executivo opcional */}
        {centerContent && (
          <div className="flex items-center justify-start lg:justify-center shrink-0 w-full lg:w-auto py-2 lg:py-0 border-t border-b lg:border-none border-slate-50">
            {centerContent}
          </div>
        )}

        {/* Direita: Quick Stats e Botões de Ação */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 self-start lg:self-center">
          {quickStats && (
            <div className="flex items-center gap-4 border-r border-slate-100 pr-4 mr-1 shrink-0">
              {quickStats}
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>

      </div>

      {/* Área Opcional para Indicadores Rápidos / Abas */}
      {extra && <div className="mt-4 pt-4 border-t border-slate-100">{extra}</div>}
    </div>
  );
}
