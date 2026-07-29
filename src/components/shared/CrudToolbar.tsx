'use client';

import { ReactNode } from 'react';
import { Search } from 'lucide-react';

export interface CrudToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  primaryAction?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
  secondaryActions?: ReactNode;
  children?: ReactNode;
}

export default function CrudToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Pesquisar...',
  filters,
  primaryAction,
  secondaryActions,
  children,
}: CrudToolbarProps) {
  return (
    <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm transition-all">
      {/* Esquerda: Pesquisa e Filtros */}
      <div className="flex flex-wrap items-center gap-3 flex-1">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900/60 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        )}

        {filters}
      </div>

      {/* Direita: Ações Secundárias e Ação Principal */}
      <div className="flex items-center gap-3 shrink-0">
        {secondaryActions}

        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg shadow-sm transition flex items-center gap-2"
          >
            {primaryAction.icon}
            <span>{primaryAction.label}</span>
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
