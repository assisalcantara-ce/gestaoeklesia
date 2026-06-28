'use client';

import { ReactNode } from 'react';

interface DashboardActionsProps {
  children: ReactNode;
  className?: string;
}

export default function DashboardActions({
  children,
  className = '',
}: DashboardActionsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 py-1 ${className}`}>
      {children}
    </div>
  );
}
