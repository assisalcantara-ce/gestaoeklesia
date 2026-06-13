'use client';

import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { TOKENS, GRADIENTS } from '@/config/tokens';

interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  className?: string;
  loading?: boolean;
}

export default function PremiumButton({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  ...props
}: PremiumButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold text-sm transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none';
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white shadow-sm';
      case 'success':
        return 'bg-green-600 hover:bg-green-700 text-white shadow-sm';
      case 'ghost':
        return 'text-slate-600 hover:bg-slate-100/80';
      case 'primary':
      default:
        return 'text-white hover:brightness-110 shadow-md hover:shadow-lg';
    }
  };

  const styleObj: React.CSSProperties = {
    borderRadius: TOKENS.radius.button,
  };

  if (variant === 'primary') {
    styleObj.background = GRADIENTS.PRIMARY_BUTTON;
  }

  return (
    <button
      className={`${baseStyles} ${getVariantStyles()} ${className} px-5 py-3`}
      style={styleObj}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
