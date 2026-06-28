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
    <div className="w-full bg-slate-50/50 min-h-screen overflow-y-auto">
      <div className={`max-w-[1440px] mx-auto w-full flex flex-col min-w-0 px-4 md:px-6 ${className}`}>
        {children}
      </div>
    </div>
  );
}
