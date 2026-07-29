'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export interface CrudDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl';
}

export default function CrudDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'lg',
}: CrudDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[size];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end transition-opacity">
      <div
        className={`w-full ${sizeClasses} bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700/80 shadow-2xl flex flex-col h-full transition-transform`}
      >
        {/* Cabeçalho do Drawer */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700/60 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/40">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo do Drawer */}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {/* Rodapé do Drawer */}
        {footer && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
