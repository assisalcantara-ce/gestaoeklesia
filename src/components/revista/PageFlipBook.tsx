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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);
  const isSyncingFromProp = useRef<boolean>(false);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pages = container.querySelectorAll<HTMLElement>('.stf-page-item');
    if (pages.length === 0) return;

    const flip = new PageFlip(container, {
      width: 520,
      height: 680,
      size: 'stretch',
      minWidth: 300,
      maxWidth: 960,
      minHeight: 460,
      maxHeight: 820,
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

    return () => {
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
    <div className="w-full flex items-center justify-center py-2">
      <div
        ref={containerRef}
        className="w-full max-w-4xl mx-auto select-none"
      >
        {children.map((child, idx) => (
          <div
            key={idx}
            className="stf-page-item bg-white shadow-xl border border-slate-200/90 overflow-y-auto"
            data-density={idx === 0 ? 'hard' : 'soft'}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
