'use client';

/**
 * MobileShell — wrapper client-side para o App Mobile.
 *
 * Usa as classes CSS de app-mobile.css (importadas no layout.tsx do /app):
 *   .app-viewport-root  →  position:fixed + overflow:hidden → bloqueia pinch-to-zoom no Safari iOS
 *   .app-container-frame → touch-action:manipulation → sem double-tap zoom, sem atraso 300ms
 *   .app-main-scroll    → touch-action:pan-y → só scroll vertical, sem pinch
 *
 * Esta estrutura é a mesma comprovada no SISCOMIEADEPA que bloqueia efetivamente
 * o pinch-to-zoom no iPhone Safari sem depender de event listeners JS agressivos.
 */

import { MobileMemberProvider } from '@/providers/MobileMemberProvider';
import OfflineBanner from '@/components/mobile/OfflineBanner';
import PwaInstaller from '@/components/mobile/PwaInstaller';
import MobileViewportDiagnostics from '@/components/mobile/MobileViewportDiagnostics';

export default function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-viewport-root">
      <div className="app-container-frame">
        <MobileMemberProvider>
          <OfflineBanner />
          <main className="app-main-scroll">{children}</main>
          <PwaInstaller />
          <MobileViewportDiagnostics />
        </MobileMemberProvider>
      </div>
    </div>
  );
}