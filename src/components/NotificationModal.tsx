'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { BRAND } from '@/config/brand';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

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
    if (canRequestClose) {
      onRequestClose!();
    } else {
      onClose();
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Escape') {
      if (canRequestClose) onRequestClose!();
      else onClose();
    }
  };

  const renderIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Check className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 stroke-[2.5]" />
          </div>
        );
      case 'error':
        return (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <X className="w-7 h-7 sm:w-8 sm:h-8 text-rose-600 stroke-[2.5]" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600 stroke-[2.5]" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-50 border border-teal-200/90 text-teal-700 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Info className="w-7 h-7 sm:w-8 sm:h-8 text-teal-700 stroke-[2.5]" />
          </div>
        );
    }
  };

  const getPrimaryButtonClass = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 border border-emerald-700';
      case 'error':
        return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 border border-rose-700';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 border border-amber-700';
      case 'info':
      default:
        return 'bg-teal-700 hover:bg-teal-800 text-white shadow-teal-700/20 border border-teal-800';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm sm:max-w-md w-full p-6 sm:p-7 overflow-hidden text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar no Topo Direito */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Logo Institucional */}
        <div className="flex justify-center mb-4 pt-1">
          <Image
            src={BRAND.logoHorizontal}
            alt="Gestão Eklésia"
            width={180}
            height={48}
            priority
            sizes="180px"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Ícone de Status Moderno */}
        {renderIcon()}

        {/* Textos */}
        <div className="text-center mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1.5 tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-xs sm:max-w-sm mx-auto">
            {message}
          </p>
        </div>

        {/* Botões de Ação */}
        {showButton && (
          <div className={`flex items-center gap-3 ${secondaryLabel ? 'w-full' : 'w-full justify-center'}`}>
            {secondaryLabel && (
              <button
                type="button"
                onClick={onSecondary}
                className="flex-1 py-2.5 sm:py-3 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs sm:text-sm transition shadow-xs active:scale-[0.98] cursor-pointer"
              >
                {secondaryLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 sm:py-3 px-4 ${getPrimaryButtonClass()} rounded-xl font-bold text-xs sm:text-sm transition shadow-md active:scale-[0.98] cursor-pointer`}
            >
              {primaryLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
