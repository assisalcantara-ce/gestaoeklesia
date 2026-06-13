'use client';

import { InputHTMLAttributes, ReactNode } from 'react';
import { TOKENS } from '@/config/tokens';

interface PremiumInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  rightIcon?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export default function PremiumInput({
  label,
  icon,
  rightIcon,
  error,
  containerClassName = '',
  className = '',
  id,
  ...props
}: PremiumInputProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3.5 text-slate-400 flex items-center justify-center">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`w-full py-3 border border-slate-200 bg-white outline-none transition-all text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-100 ${
            icon ? 'pl-10' : 'pl-4'
          } ${rightIcon ? 'pr-10' : 'pr-4'} ${
            error ? 'border-red-300 focus:border-red-500' : 'focus:border-[#0B3B82]'
          } ${className}`}
          style={{ borderRadius: TOKENS.radius.input }}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3.5 text-slate-400 flex items-center justify-center">
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 font-semibold ml-1">{error}</p>
      )}
    </div>
  );
}
