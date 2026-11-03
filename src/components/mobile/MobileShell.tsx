'use client';

/**
 * MobileShell — wrapper client-side para o App Mobile.
 * Fornece o MobileMemberProvider, banner offline, instalador PWA e estrutura base da UI.
 */

import { MobileMemberProvider } from '@/providers/MobileMemberProvider';
import OfflineBanner from '@/components/mobile/OfflineBanner';
import PwaInstaller from '@/components/mobile/PwaInstaller';
import MobileViewportDiagnostics from '@/components/mobile/MobileViewportDiagnostics';

export default function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#030e1d] text-slate-100 selection:bg-blue-600 selection:text-white">
      <div className="min-h-[100dvh] bg-[#061D38] max-w-[430px] w-full mx-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] border-x border-slate-800/40 relative overflow-x-hidden flex flex-col justify-between">
        <MobileMemberProvider>
          <OfflineBanner />
          <main className="flex-1">{children}</main>
          <PwaInstaller />
          <MobileViewportDiagnostics />
        </MobileMemberProvider>
      </div>
    </div>
  );
}
