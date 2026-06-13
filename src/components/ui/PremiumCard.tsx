'use client';

import { ReactNode } from 'react';
import { TOKENS } from '@/config/tokens';

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  variant?: 'default' | 'glass' | 'gradient';
}

export default function PremiumCard({
  children,
  className = '',
  onClick,
  hoverable = true,
  variant = 'default',
}: PremiumCardProps) {
  const isClickable = typeof onClick === 'function';

  const baseStyles = 'transition-all duration-200 overflow-hidden';
  
  const variantStyles = {
    default: 'bg-white border border-slate-100',
    glass: 'bg-white/80 backdrop-blur-md border border-white/20',
    gradient: 'bg-gradient-to-br from-white to-slate-50 border border-slate-100',
  };

  const interactiveStyles = hoverable || isClickable
    ? 'hover:translate-y-[-2px] cursor-pointer'
    : '';

  const styleObj = {
    borderRadius: TOKENS.radius.card,
    boxShadow: TOKENS.shadow.card,
  };

  return (
    <div
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${interactiveStyles} ${className}`}
      style={styleObj}
      onMouseEnter={(e) => {
        if (hoverable || isClickable) {
          e.currentTarget.style.boxShadow = TOKENS.shadow.cardHover;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = TOKENS.shadow.card;
      }}
    >
      {children}
    </div>
  );
}
