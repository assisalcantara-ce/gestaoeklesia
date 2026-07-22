'use client';

import { LucideIcon } from 'lucide-react';

interface ExecutiveMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  color?: 'blue' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
  badgeText?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    label?: string;
  };
  footerText?: string;
  loading?: boolean;
  empty?: boolean;
}

export default function ExecutiveMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'slate',
  badgeText,
  trend,
  footerText,
  loading = false,
  empty = false,
}: ExecutiveMetricCardProps) {
  // Cores semânticas baseadas em Tailwind CSS
  const colors = {
    blue: {
      bg: 'from-blue-50/60 to-white',
      border: 'border-blue-100',
      text: 'text-blue-700',
      iconBg: 'bg-blue-50 text-blue-600',
    },
    indigo: {
      bg: 'from-indigo-50/60 to-white',
      border: 'border-indigo-100',
      text: 'text-indigo-700',
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    emerald: {
      bg: 'from-emerald-50/60 to-white',
      border: 'border-emerald-100',
      text: 'text-emerald-700',
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    rose: {
      bg: 'from-rose-50/60 to-white',
      border: 'border-rose-100',
      text: 'text-rose-700',
      iconBg: 'bg-rose-50 text-rose-600',
    },
    amber: {
      bg: 'from-amber-50/65 to-white',
      border: 'border-amber-100',
      text: 'text-amber-755',
      iconBg: 'bg-amber-50 text-amber-600',
    },
    slate: {
      bg: 'from-slate-50/60 to-white',
      border: 'border-slate-150',
      text: 'text-slate-700',
      iconBg: 'bg-slate-100 text-slate-500',
    },
  };

  const scheme = colors[color] || colors.slate;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 shadow-xs animate-pulse">
        <div className="h-3.5 bg-slate-150 rounded w-1/3 mb-2" />
        <div className="h-8 bg-slate-200 rounded w-1/2 mb-3" />
        <div className="h-3 bg-slate-100 rounded w-2/3" />
      </div>
    );
  }

  if (empty) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 shadow-xs flex flex-col justify-center items-center text-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{title}</span>
        <p className="text-slate-350 text-xs font-bold mt-2">Sem dados</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${scheme.bg} rounded-2xl border ${scheme.border} shadow-xs p-4 md:p-5 flex flex-col justify-between transition-all hover:shadow-md hover:translate-y-[-1px] duration-200 group`}>
      
      {/* Topo do Card */}
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1">
          <span className="text-[10.5px] font-black text-slate-900 uppercase tracking-wide block">
            {title}
          </span>
          <p className={`text-2xl md:text-3xl font-black ${scheme.text} tracking-tight leading-none`}>
            {value}
          </p>
        </div>
        
        {Icon && (
          <div className={`p-2.5 rounded-xl ${scheme.iconBg} shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-2xs`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
      </div>

      {/* Subtítulo / Badge de Tendência */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-200/60">
        
        {trend && (
          <span className={`text-[10px] font-extrabold flex items-center gap-0.5 rounded px-1 py-0.2 shrink-0 ${
            trend.direction === 'up' ? 'text-emerald-700 bg-emerald-50' :
            trend.direction === 'down' ? 'text-rose-700 bg-rose-50' : 'text-slate-600 bg-slate-100'
          }`}>
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {trend.direction === 'stable' && '→'}
            {trend.label}
          </span>
        )}

        {badgeText && (
          <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded shadow-3xs shrink-0">
            {badgeText}
          </span>
        )}

        {subtitle && (
          <span className="text-[10px] text-slate-600 font-semibold truncate flex-1 min-w-[80px]">
            {subtitle}
          </span>
        )}
      </div>

      {/* Footer Text opcional */}
      {footerText && (
        <span className="text-[9px] text-slate-600 font-bold mt-1.5 block">
          {footerText}
        </span>
      )}
    </div>
  );
}
