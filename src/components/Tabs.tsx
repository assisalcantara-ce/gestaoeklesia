'use client';

import { ReactNode } from 'react';

interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
}

export default function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div>
      {/* TAB BUTTONS */}
      <div className="flex gap-0 border-b border-gray-200 mb-6 bg-white rounded-t-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-6 py-3 font-medium text-sm transition border-b-2 ${
              activeTab === tab.id
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white rounded-b-lg p-6">
        {children}
      </div>
    </div>
  );
}
