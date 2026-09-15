'use client';

/**
 * MobileShell — wrapper client-side para o App Mobile.
 * Fornece o MobileMemberProvider, banner offline, instalador PWA e estrutura base da UI.
 */

import { MobileMemberProvider } from '@/providers/MobileMemberProvider';
import OfflineBanner from '@/components/mobile/OfflineBanner';
import PwaInstaller from '@/components/mobile/PwaInstaller';

export default function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="min-h-screen bg-white max-w-md mx-auto shadow-[0_0_40px_rgba(0,0,0,0.08)] relative overflow-x-hidden flex flex-col justify-between">
        <MobileMemberProvider>
          <OfflineBanner />
          <main className="flex-1">{children}</main>
          <PwaInstaller />
        </MobileMemberProvider>
      </div>
    </div>
  );
}
