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
      className={`flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-4 md:space-y-6 ${className}`}
    >
      {children}
    </div>
  );
}
