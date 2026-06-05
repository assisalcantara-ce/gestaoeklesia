'use client';

import { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  activeMenu?: string;
  headerExtra?: ReactNode;
}

export default function PageLayout({
  title,
  description,
  children,
  headerExtra,
}: PageLayoutProps) {
  return (
    <div className="flex flex-col h-full min-w-0 overflow-x-hidden">
      {/* HEADER */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[#123b63]">{title}</h1>
            <p className="text-gray-600 text-sm mt-1">{description}</p>
          </div>
          {headerExtra && <div className="self-center">{headerExtra}</div>}
        </div>
      </div>

      {/* CONTENT */}
      <div id="page-scroll-container" className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden p-6">
        {children}
      </div>
    </div>
  );
}

