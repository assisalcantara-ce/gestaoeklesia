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
    <div className="w-full bg-white min-h-screen">
      <div className={`max-w-[1440px] mx-auto w-full flex flex-col min-w-0 ${className}`}>
        {children}
      </div>
    </div>
  );
}
