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
    <div className="space-y-6">
      {/* TAB BUTTONS */}
      <div className="border-b border-slate-200/90 bg-white rounded-2xl px-4 pt-2 shadow-xs">
        <div className="flex flex-wrap gap-1 sm:gap-2 max-w-full min-w-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`group relative py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'text-emerald-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.icon && (
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-colors ${
                      isActive
                        ? 'bg-emerald-100/80 text-emerald-800 font-bold'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-700'
                    }`}
                  >
                    {tab.icon.replace(/[^0-9]/g, '') || tab.icon}
                  </div>
                )}
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t-full shadow-xs" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-7 max-w-full overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
