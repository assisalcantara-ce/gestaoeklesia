'use client';

/**
 * MobileShell — wrapper client-side para o App Mobile.
 * Fornece o MobileMemberProvider e estrutura base da UI.
 * Separado do layout.tsx (server component) para permitir metadata export.
 */

import { MobileMemberProvider } from '@/providers/MobileMemberProvider';

export default function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="min-h-screen bg-white max-w-md mx-auto shadow-[0_0_40px_rgba(0,0,0,0.08)] relative overflow-x-hidden">
        <MobileMemberProvider>{children}</MobileMemberProvider>
      </div>
    </div>
  );
}
