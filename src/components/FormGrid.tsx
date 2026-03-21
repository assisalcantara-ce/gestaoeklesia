'use client';

import { ReactNode } from 'react';

interface FormGridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
}

export default function FormGrid({ children, cols = 2 }: FormGridProps) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4'
  }[cols];

  return (
    <div className={`grid grid-cols-1 ${gridClass} gap-4`}>
      {children}
    </div>
  );
}
