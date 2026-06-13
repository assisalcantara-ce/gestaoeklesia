'use client';

import { ReactNode } from 'react';
import PremiumCard from './PremiumCard';
import SectionHeader from './SectionHeader';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  extra?: ReactNode;
  className?: string;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  extra,
  className = '',
}: ChartCardProps) {
  return (
    <PremiumCard hoverable={false} className={`p-5 flex flex-col ${className}`}>
      <SectionHeader title={title} subtitle={subtitle} extra={extra} className="mb-4" />
      <div className="flex-1 w-full min-h-[260px] relative">
        {children}
      </div>
    </PremiumCard>
  );
}
