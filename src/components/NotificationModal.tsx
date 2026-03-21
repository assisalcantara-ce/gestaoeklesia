'use client';

import { useEffect } from 'react';

interface NotificationModalProps {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  isOpen: boolean;
  autoClose?: number; // Tempo em ms para fechar automaticamente
  showButton?: boolean; // Se deve mostrar o botão de fechar

  // Opcional: padronizar confirm/cancel
  primaryLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onRequestClose?: () => void; // fechar ao clicar fora / ESC
}

export default function NotificationModal({
  title,
  message,
  type = 'success',
  onClose,
  isOpen,
  autoClose,
  showButton = true,
  primaryLabel = 'OK',
  secondaryLabel,
  onSecondary,
  onRequestClose,
}: NotificationModalProps) {
  // Auto-close effect
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, onClose]);

  if (!isOpen) return null;

  const canRequestClose = typeof onRequestClose === 'function';

  const handleBackdrop = () => {
    if (canRequestClose) onRequestClose!();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!canRequestClose) return;
    if (e.key === 'Escape') onRequestClose!();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '✓';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          title: 'text-green-900',
          message: 'text-green-700',
          button: 'bg-green-600 hover:bg-green-700',
          icon: 'text-green-600'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          title: 'text-red-900',
          message: 'text-red-700',
          button: 'bg-red-600 hover:bg-red-700',
          icon: 'text-red-600'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          title: 'text-yellow-900',
          message: 'text-yellow-700',
          button: 'bg-yellow-600 hover:bg-yellow-700',
          icon: 'text-yellow-600'
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          title: 'text-blue-900',
          message: 'text-blue-700',
          button: 'bg-blue-600 hover:bg-blue-700',
          icon: 'text-blue-600'
        };
      default:
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          title: 'text-green-900',
          message: 'text-green-700',
          button: 'bg-green-600 hover:bg-green-700',
          icon: 'text-green-600'
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div
        className={`${colors.bg} ${colors.border} border-2 rounded-lg shadow-2xl max-w-md w-full p-6 max-h-screen overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="/img/logo_modal.png"
            alt="Gestão Eclesial"
            className="h-24 object-contain"
          />
        </div>

        {/* Icon */}
        <div className={`text-5xl text-center mb-4 ${colors.icon}`}>
          {getIcon()}
        </div>

        {/* Conteúdo */}
        <div className="text-center mb-6">
          <h2 className={`text-xl font-bold ${colors.title} mb-2`}>
            {title}
          </h2>
          <p className={`text-sm ${colors.message}`}>
            {message}
          </p>
        </div>

        {/* Botão (Opcional) */}
        {showButton && (
          <div className={secondaryLabel ? 'flex gap-3' : ''}>
            {secondaryLabel && (
              <button
                onClick={onSecondary}
                className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition font-bold text-sm"
              >
                {secondaryLabel}
              </button>
            )}
            <button
              onClick={onClose}
              className={`w-full px-6 py-3 ${colors.button} text-white rounded-lg transition font-bold text-sm`}
            >
              {primaryLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
