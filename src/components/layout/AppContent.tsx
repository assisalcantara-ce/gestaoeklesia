'use client';

import { ReactNode } from 'react';

interface AppContentProps {
  children: ReactNode;
}

export default function AppContent({ children }: AppContentProps) {
  return (
    <div
      id="app-content-container"
      className="flex-1 w-full overflow-y-auto overflow-x-hidden p-6 bg-[#F4F7FB]"
    >
      {children}
    </div>
  );
}
