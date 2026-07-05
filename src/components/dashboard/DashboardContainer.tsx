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
    <div className="w-full bg-white h-full flex flex-col">
      <div className={`max-w-[1440px] mx-auto w-full flex flex-col flex-1 min-h-0 min-w-0 ${className}`}>
        {children}
      </div>
    </div>
  );
}
