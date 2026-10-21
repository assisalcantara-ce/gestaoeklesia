'use client';

/**
 * MobileViewportDiagnostics
 *
 * Instrumentação de diagnóstico de responsividade para o App do Membro.
 * Monitora em tempo real:
 * - window.innerWidth / clientWidth / scrollWidth
 * - window.visualViewport.width / height / scale
 * - Elementos filhos que provocam overflow horizontal (scrollWidth > clientWidth)
 * 
 * Permite diagnóstico transparente e auditoria remota no iPhone Safari e PWA.
 */

import { useState, useEffect } from 'react';

export default function MobileViewportDiagnostics() {
  const [metrics, setMetrics] = useState<{
    innerWidth: number;
    clientWidth: number;
    scrollWidth: number;
    viewportWidth: number;
    viewportScale: number;
    overflowElements: string[];
    isPwa: boolean;
  } | null>(null);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Verificar se há flag na URL ou em localStorage para depuração
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug_viewport');
    if (debugParam === '1' || debugParam === 'true') {
      setVisible(true);
      try {
        localStorage.setItem('ge_debug_viewport', '1');
      } catch {}
    } else {
      try {
        if (localStorage.getItem('ge_debug_viewport') === '1') {
          setVisible(true);
        }
      } catch {}
    }

    const checkMetrics = () => {
      const doc = document.documentElement;
      const innerW = window.innerWidth;
      const clientW = doc.clientWidth;
      const scrollW = doc.scrollWidth;

      const vv = window.visualViewport;
      const vpW = vv ? Math.round(vv.width) : innerW;
      const vpScale = vv ? Number(vv.scale.toFixed(2)) : 1;

      // Detectar modo PWA instalado
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

      // Localizar elementos com overflow horizontal
      const overflows: string[] = [];
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.offsetWidth > clientW + 2) {
          const tag = htmlEl.tagName.toLowerCase();
          const id = htmlEl.id ? `#${htmlEl.id}` : '';
          const cls = typeof htmlEl.className === 'string' && htmlEl.className
            ? `.${htmlEl.className.trim().split(/\s+/).slice(0, 2).join('.')}`
            : '';
          overflows.push(`${tag}${id}${cls} (${htmlEl.offsetWidth}px > ${clientW}px)`);
        }
      });

      setMetrics({
        innerWidth: innerW,
        clientWidth: clientW,
        scrollWidth: scrollW,
        viewportWidth: vpW,
        viewportScale: vpScale,
        overflowElements: overflows.slice(0, 5),
        isPwa: isStandalone,
      });

      if (scrollW > clientW + 2 || vpScale > 1.05) {
        console.warn('[VIEWPORT OVERFLOW/ZOOM DETECTED]:', {
          innerWidth: innerW,
          clientWidth: clientW,
          scrollWidth: scrollW,
          viewportScale: vpScale,
          overflows,
        });
      }
    };

    checkMetrics();
    window.addEventListener('resize', checkMetrics);
    window.addEventListener('orientationchange', checkMetrics);
    document.addEventListener('visibilitychange', checkMetrics);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkMetrics);
      window.visualViewport.addEventListener('scroll', checkMetrics);
    }

    return () => {
      window.removeEventListener('resize', checkMetrics);
      window.removeEventListener('orientationchange', checkMetrics);
      document.removeEventListener('visibilitychange', checkMetrics);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', checkMetrics);
        window.visualViewport.removeEventListener('scroll', checkMetrics);
      }
    };
  }, []);

  if (!visible || !metrics) return null;

  const hasOverflow = metrics.scrollWidth > metrics.clientWidth + 2;
  const isZoomed = metrics.viewportScale > 1.02;

  return (
    <aside
      aria-label="Diagnóstico de Viewport"
      className="fixed bottom-20 left-2 right-2 z-[9999] pointer-events-auto bg-slate-950/95 border border-slate-700 text-[10px] text-slate-200 p-2.5 rounded-xl shadow-2xl backdrop-blur-md max-w-sm mx-auto font-mono"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
        <span className="font-bold text-sky-400">
          Viewport Monitor {metrics.isPwa ? '• [PWA]' : '• [Browser]'}
        </span>
        <button
          onClick={() => {
            setVisible(false);
            try {
              localStorage.removeItem('ge_debug_viewport');
            } catch {}
          }}
          className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 text-[9px]"
        >
          Fechar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <div>
          <span className="text-slate-400">innerW: </span>
          <span className="font-bold text-white">{metrics.innerWidth}px</span>
        </div>
        <div>
          <span className="text-slate-400">clientW: </span>
          <span className="font-bold text-white">{metrics.clientWidth}px</span>
        </div>
        <div>
          <span className="text-slate-400">scrollW: </span>
          <span className={hasOverflow ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
            {metrics.scrollWidth}px
          </span>
        </div>
        <div>
          <span className="text-slate-400">scale: </span>
          <span className={isZoomed ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
            {metrics.viewportScale}x
          </span>
        </div>
      </div>

      {hasOverflow && (
        <div className="mt-1.5 pt-1.5 border-t border-rose-900/50 text-rose-300">
          <p className="font-bold">⚠️ Elementos com overflow:</p>
          <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[9px]">
            {metrics.overflowElements.map((el, i) => (
              <li key={i} className="truncate">{el}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
