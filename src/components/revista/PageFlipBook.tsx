'use client';

import React, { useEffect, useRef } from 'react';
import { PageFlip } from 'page-flip';

interface PageFlipBookProps {
  children: React.ReactNode[];
  currentPage: number;
  onPageChange: (pageIndex: number) => void;
  bookKey: string;
}

/**
 * Componente de folheamento 3D realista baseado em StPageFlip (`page-flip`),
 * compatível com React 19 e Next.js 16.
 * Oferece curvatura de página, sombras dinâmicas, arraste/clique nos cantos e
 * sincronização bidirecional com os botões Anterior/Próxima e Índice.
 */
export default function PageFlipBook({
  children,
  currentPage,
  onPageChange,
  bookKey,
}: PageFlipBookProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);
  const isSyncingFromProp = useRef<boolean>(false);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) return;

    const pages = container.querySelectorAll<HTMLElement>('.stf-page-item');
    if (pages.length === 0) return;

    const rect = wrapper.getBoundingClientRect();
    const availH = Math.max(
      360,
      Math.floor(rect.height || (typeof window !== 'undefined' ? window.innerHeight - 104 : 620))
    );

    const flip = new PageFlip(container, {
      width: 520,
      height: availH,
      size: 'stretch',
      minWidth: 280,
      maxWidth: 960,
      minHeight: 360,
      maxHeight: availH,
      maxShadowOpacity: 0.45,
      showCover: true,
      mobileScrollSupport: true,
      usePortrait: true,
      startPage: currentPage,
      flippingTime: 1040,
      drawShadow: true,
      autoSize: true,
      clickEventForward: true,
      useMouseEvents: true,
      swipeDistance: 30,
    });

    flip.loadFromHTML(pages);

    flip.on('flip', (e: any) => {
      const idx = typeof e?.data === 'number' ? e.data : 0;
      if (!isSyncingFromProp.current) {
        onPageChangeRef.current(idx);
      }
    });

    pageFlipRef.current = flip;

    // Restringe paginação por toque/arraste aos 12% laterais de cada extremidade,
    // reservando os 76% centrais para leitura e rolagem vertical.
    const handleCaptureStart = (e: MouseEvent | TouchEvent | PointerEvent) => {
      const cRect = container.getBoundingClientRect();
      if (!cRect.width) return;

      let clientX: number | null = null;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
      } else if ('clientX' in e) {
        clientX = e.clientX;
      }

      if (clientX === null) return;
      const relX = (clientX - cRect.left) / cRect.width;
      if (relX > 0.12 && relX < 0.88) {
        e.stopPropagation();
      }
    };

    container.addEventListener('pointerdown', handleCaptureStart, { capture: true });
    container.addEventListener('mousedown', handleCaptureStart, { capture: true });
    container.addEventListener('touchstart', handleCaptureStart, { capture: true, passive: true });

    return () => {
      container.removeEventListener('pointerdown', handleCaptureStart, { capture: true });
      container.removeEventListener('mousedown', handleCaptureStart, { capture: true });
      container.removeEventListener('touchstart', handleCaptureStart, { capture: true });
      try {
        flip.destroy();
      } catch {
        // ignore cleanup errors
      }
      pageFlipRef.current = null;
    };
    // Recria apenas quando a estrutura de páginas (bookKey) mudar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey]);

  // Sincroniza navegação externa (botões Anterior/Próxima, Índice, ?mes=...)
  useEffect(() => {
    const flip = pageFlipRef.current;
    if (!flip) return;
    try {
      const activeIdx = flip.getCurrentPageIndex();
      if (activeIdx !== currentPage) {
        isSyncingFromProp.current = true;
        flip.flip(currentPage, 'top');
        setTimeout(() => {
          isSyncingFromProp.current = false;
        }, 1100);
      }
    } catch {
      isSyncingFromProp.current = false;
    }
  }, [currentPage]);

  return (
    <div ref={wrapperRef} className="w-full flex-1 min-h-0 overflow-hidden flex items-center justify-center">
      <div
        ref={containerRef}
        className="w-full h-full max-w-4xl mx-auto select-none"
      >
        {children.map((child, idx) => (
          <div
            key={idx}
            className={`stf-page-item bg-white shadow-xl border border-slate-200/90 ${
              idx === 0 ? 'overflow-hidden' : 'overflow-y-auto revista-scroll'
            }`}
            data-density={idx === 0 ? 'hard' : 'soft'}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
