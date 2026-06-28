'use client';

import { ReactNode } from 'react';

interface DashboardContentProps {
  children: ReactNode;
  className?: string;
}

export default function DashboardContent({
  children,
  className = '',
}: DashboardContentProps) {
  return (
    <div
      id="dashboard-content-scroll"
      className={`flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden bg-slate-50/60 px-4 md:px-6 pt-5 pb-8 space-y-4 ${className}`}
    >
      {children}
    </div>
  );
}
