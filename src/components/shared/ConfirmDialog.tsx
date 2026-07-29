'use client';

import { ReactNode } from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import CrudModal from './CrudModal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const variantConfig = {
    danger: {
      icon: <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />,
      iconBg: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800/40',
      buttonBg: 'bg-red-600 hover:bg-red-500 text-white',
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/40',
      buttonBg: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    info: {
      icon: <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/40',
      buttonBg: 'bg-blue-600 hover:bg-blue-500 text-white',
    },
  }[variant];

  return (
    <CrudModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-2 ${variantConfig.buttonBg} disabled:opacity-50`}
          >
            {loading ? (
              <>
                <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                <span>Processando...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl border shrink-0 ${variantConfig.iconBg}`}>
          {variantConfig.icon}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pt-1">
          {description}
        </div>
      </div>
    </CrudModal>
  );
}
