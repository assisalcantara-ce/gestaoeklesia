'use client';

/**
 * MobileShell — wrapper client-side centralizado para o App Mobile (/app/*).
 *
 * Aplica de forma robusta e persistente a proteção contra pinch-to-zoom no iPhone Safari:
 * 1. Classes CSS de app-mobile.css (.app-viewport-root, .app-container-frame, .app-main-scroll)
 * 2. Listener passivo/ativo em window/document restrito a gestos multi-touch (e.touches.length > 1 ou gesturestart),
 *    garantindo que durante toda a navegação client-side (login -> dashboard -> rotas internas -> retorno)
 *    o Safari iOS não ative o pinch-to-zoom, sem prejudicar o scroll vertical ou os formulários.
 */

import { useEffect } from 'react';
import { MobileMemberProvider } from '@/providers/MobileMemberProvider';
import OfflineBanner from '@/components/mobile/OfflineBanner';
import PwaInstaller from '@/components/mobile/PwaInstaller';
import MobileViewportDiagnostics from '@/components/mobile/MobileViewportDiagnostics';

export default function MobileShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Trava de overflow no elemento raiz do documento enquanto estiver dentro de /app
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevBodyPosition = bodyEl.style.position;
    const prevBodyTouchAction = bodyEl.style.touchAction;

    htmlEl.style.overflow = 'hidden';
    bodyEl.style.overflow = 'hidden';
    bodyEl.style.position = 'fixed';
    bodyEl.style.width = '100vw';
    bodyEl.style.height = '100dvh';
    bodyEl.style.touchAction = 'pan-y';

    // Bloqueia evento proprietário do WebKit/Safari para gestos de zoom/pinça (gesturestart, gesturechange)
    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    // Bloqueia gestos multi-toque de pinça (dois ou mais dedos em direções opostas)
    // Preserva 100% o toque com 1 dedo (scroll vertical nativo fluido)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('gesturestart', handleGesture, { passive: false });
    window.addEventListener('gesturechange', handleGesture, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      bodyEl.style.position = prevBodyPosition;
      bodyEl.style.touchAction = prevBodyTouchAction;

      window.removeEventListener('gesturestart', handleGesture);
      window.removeEventListener('gesturechange', handleGesture);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

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
