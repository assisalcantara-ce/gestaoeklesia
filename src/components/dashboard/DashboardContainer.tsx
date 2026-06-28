'use client';

import { ReactNode } from 'react';

interface DashboardContainerProps {
  children: ReactNode;
  className?: string;
}

export default function DashboardContainer({
  children,
  className = '',
}: DashboardContainerProps) {
  return (
    <div className={`flex flex-col h-full min-w-0 overflow-x-hidden bg-slate-50/50 ${className}`}>
      {children}
    </div>
  );
}
