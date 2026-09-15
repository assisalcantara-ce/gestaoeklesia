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
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      <div className="min-h-screen bg-[#0f172a] max-w-md mx-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] border-x border-slate-800/40 relative overflow-x-hidden flex flex-col justify-between">
        <MobileMemberProvider>
          <OfflineBanner />
          <main className="flex-1">{children}</main>
          <PwaInstaller />
        </MobileMemberProvider>
      </div>
    </div>
  );
}
