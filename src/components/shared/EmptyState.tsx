'use client';

import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  children?: ReactNode;
  className?: string;
}

export default function EmptyState({
  title = 'Nenhum registro encontrado',
  description = 'Não há itens disponíveis para exibição no momento.',
  icon,
  action,
  children,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`p-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-xl flex flex-col items-center justify-center text-center shadow-xs ${className}`}>
      <div className="p-3.5 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60 text-gray-400 rounded-2xl mb-4">
        {icon || <Inbox className="h-8 w-8 stroke-[1.5]" />}
      </div>
      <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mb-5 leading-relaxed">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-xs transition flex items-center gap-2"
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      )}

      {children}
    </div>
  );
}
