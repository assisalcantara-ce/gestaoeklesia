'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface DashboardEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  extra?: ReactNode;
}

export default function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  extra,
}: DashboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-6 md:p-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/30 transition-all duration-300 min-h-[260px] w-full">
      {/* Icone decorativo */}
      <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl mb-4 shrink-0 shadow-3xs ring-8 ring-blue-50/20">
        <Icon className="h-6 w-6" />
      </div>

      {/* Titulo & Descrição */}
      <div className="max-w-md space-y-1.5 mb-5">
        <h4 className="text-sm font-black text-slate-800 tracking-tight uppercase">
          {title}
        </h4>
        <p className="text-slate-500 text-xs leading-relaxed font-medium">
          {description}
        </p>
      </div>

      {/* Ações */}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-1.5 px-3.5 py-1.8 bg-blue-650 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all duration-205"
            >
              {action.icon && <action.icon className="h-3.5 w-3.5" />}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="flex items-center gap-1.5 px-3.5 py-1.8 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-extrabold text-xs transition"
            >
              {secondaryAction.icon && <secondaryAction.icon className="h-3.5 w-3.5" />}
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {/* Conteúdo Extra de contexto */}
      {extra && <div className="mt-4 pt-3.5 border-t border-slate-100 w-full max-w-sm">{extra}</div>}
    </div>
  );
}
