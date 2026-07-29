'use client';

import { TableColumn, TableAction } from '@/types/shared';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CrudTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  actions?: TableAction<T>[];
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    perPage: number;
    onPageChange: (page: number) => void;
  };
  className?: string;
}

export default function CrudTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  actions,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription = 'Não existem dados correspondentes aos filtros aplicados.',
  pagination,
  className = '',
}: CrudTableProps<T>) {
  if (loading) {
    return <LoadingState message="Carregando registros..." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-700 dark:text-gray-200">
          <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700/60 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3.5 ${col.headerClassName || ''}`}>
                  {col.header}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="px-4 py-3.5 text-right w-24">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50">
            {data.map((item) => {
              const rowKey = keyExtractor(item);
              return (
                <tr
                  key={rowKey}
                  className="hover:bg-gray-50/80 dark:hover:bg-gray-750/50 transition-colors"
                >
                  {columns.map((col) => {
                    const content = col.accessor ? col.accessor(item) : (item as any)[col.key];
                    return (
                      <td key={col.key} className={`px-4 py-3.5 ${col.className || ''}`}>
                        {content}
                      </td>
                    );
                  })}

                  {actions && actions.length > 0 && (
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {actions.map((act, idx) => {
                          if (act.showCondition && !act.showCondition(item)) return null;
                          return (
                            <button
                              key={idx}
                              onClick={() => act.onClick(item)}
                              title={act.label}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            >
                              {act.icon || act.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Mostrando página <strong className="text-gray-900 dark:text-white">{pagination.currentPage}</strong> de{' '}
            <strong className="text-gray-900 dark:text-white">{pagination.totalPages}</strong> ({pagination.totalItems} registros)
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.currentPage <= 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
