'use client';

import { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  icon?: ReactNode;
  children?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  icon,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-xl p-5 shadow-sm transition-all">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-2">
              {idx > 0 && <span>/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                  {crumb.label}
                </a>
              ) : (
                <span className="font-medium text-gray-700 dark:text-gray-200">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800/40 shrink-0">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
              {badge && (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800/60">
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
      </div>

      {children && <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">{children}</div>}
    </div>
  );
}
