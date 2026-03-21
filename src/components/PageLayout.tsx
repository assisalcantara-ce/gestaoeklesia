'use client';

import Sidebar from '@/components/Sidebar';
import { ReactNode, useState } from 'react';

interface PageLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  activeMenu?: string;
}

export default function PageLayout({
  title,
  description,
  children,
  activeMenu = 'dashboard'
}: PageLayoutProps) {
  const [sidebarActive, setSidebarActive] = useState(activeMenu);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* SIDEBAR */}
      <Sidebar activeMenu={sidebarActive} setActiveMenu={setSidebarActive} />

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="bg-white shadow-sm border-b border-gray-200 p-6">
          <h1 className="text-3xl font-bold text-[#123b63]">{title}</h1>
          <p className="text-gray-600 text-sm mt-1">{description}</p>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
