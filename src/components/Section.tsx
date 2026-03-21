'use client';

import { ReactNode } from 'react';

interface SectionProps {
  icon?: string;
  title: string;
  children: ReactNode;
}

export default function Section({ icon, title, children }: SectionProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-2xl">{icon}</span>}
        <h2 className="text-lg font-bold text-[#123b63]">{title}</h2>
      </div>
      <div className="border-t border-gray-200 pt-4">
        {children}
      </div>
    </div>
  );
}
