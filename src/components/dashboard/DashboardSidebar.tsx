'use client';

import { ReactNode } from 'react';

interface DashboardSidebarProps {
  children?: ReactNode;
  className?: string;
}

export default function DashboardSidebar({
  children,
  className = '',
}: DashboardSidebarProps) {
  // Retorna nulo se não houver filhos, evitando renderização de caixas vazias
  if (!children) return null;

  return (
    <aside className={`w-full lg:w-80 shrink-0 space-y-4 md:space-y-6 ${className}`}>
      {children}
    </aside>
  );
}
