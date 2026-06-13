'use client';

import { ReactNode } from 'react';
import PremiumButton from './PremiumButton';
import PremiumCard from './PremiumCard';

interface EmptyStateProps {
  icon?: string | ReactNode;
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon = '🔍',
  title = 'Sem registros encontrados',
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <PremiumCard
      hoverable={false}
      className={`flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto ${className}`}
    >
      <div className="text-4xl mb-3 animate-bounce select-none">
        {typeof icon === 'string' ? icon : icon}
      </div>
      <h3 className="text-base font-bold text-slate-800 tracking-tight">
        {title}
      </h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <PremiumButton
          onClick={onAction}
          className="mt-5 text-xs py-2 px-4"
        >
          {actionLabel}
        </PremiumButton>
      )}
    </PremiumCard>
  );
}
