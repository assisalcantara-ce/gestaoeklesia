'use client';

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  extra,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5 ${className}`}>
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#062E6F] tracking-tight leading-none">
          {title}
        </h1>
        {description && (
          <p className="text-slate-500 text-sm mt-1.5 font-medium">
            {description}
          </p>
        )}
      </div>
      {extra && <div className="flex items-center gap-3 self-start md:self-center shrink-0">{extra}</div>}
    </div>
  );
}
