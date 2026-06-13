'use client';

import { ReactNode } from 'react';
import PremiumCard from './PremiumCard';
import StatBadge from './StatBadge';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string | ReactNode;
  delta?: number; // Variação percentual (opcional)
  description?: string; // Descrição opcional no rodapé
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void; // Ação ao clicar no card (opcional)
}

export default function StatCard({
  label,
  value,
  icon,
  delta,
  description,
  className = '',
  variant = 'default',
  onClick,
}: StatCardProps) {
  const isCustomVariant = variant !== 'default';

  const getVariantBg = () => {
    switch (variant) {
      case 'primary': return 'from-[#062E6F] to-[#154A92] text-white';
      case 'success': return 'from-green-600 to-emerald-600 text-white';
      case 'warning': return 'from-amber-500 to-yellow-500 text-white';
      case 'danger': return 'from-red-600 to-rose-600 text-white';
      default: return 'from-white to-white text-slate-800';
    }
  };

  const cardClass = isCustomVariant
    ? `bg-gradient-to-br ${getVariantBg()} border-none`
    : '';

  return (
    <PremiumCard
      hoverable
      onClick={onClick}
      className={`p-5 flex flex-col justify-between ${cardClass} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${
            isCustomVariant ? 'text-white/80' : 'text-slate-500'
          }`}>
            {label}
          </span>
          <span className={`text-2xl font-extrabold tracking-tight mt-1.5 ${
            isCustomVariant ? 'text-white' : 'text-[#062E6F]'
          }`}>
            {value}
          </span>
        </div>
        
        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl select-none shrink-0 ${
            isCustomVariant ? 'bg-white/20 text-white' : 'bg-slate-50 border border-slate-100 text-slate-600'
          }`}>
            {typeof icon === 'string' ? <span>{icon}</span> : icon}
          </div>
        )}
      </div>

      {(delta !== undefined || description) && (
        <div className="mt-4 flex items-center gap-2">
          {delta !== undefined && <StatBadge value={delta} />}
          {description && (
            <span className={`text-[10px] font-medium ${isCustomVariant ? 'text-white/75' : 'text-slate-400'}`}>
              {description}
            </span>
          )}
        </div>
      )}
    </PremiumCard>
  );
}
