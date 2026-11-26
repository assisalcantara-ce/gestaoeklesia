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
    const availW = Math.max(280, Math.floor(rect.width || (typeof window !== 'undefined' ? window.innerWidth - 12 : 380)));
    const availH = Math.max(
      360,
      Math.floor(rect.height || (typeof window !== 'undefined' ? window.innerHeight - 104 : 620))
    );
    const isTwoPage = availW >= 768;
    const pageW = isTwoPage ? Math.floor(availW / 2) : availW;

    const flip = new PageFlip(container, {
      width: pageW,
      height: availH,
      size: 'stretch',
      minWidth: 260,
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
      showPageCorners: false, // Desativa curvatura automática nos cantos por aproximação do mouse (hover)
      disableFlipByClick: true, // Desativa virada nativa de clique do StPageFlip para controle exclusivo nas margens de 4%
    });

    flip.loadFromHTML(pages);

    flip.on('flip', (e: any) => {
      const idx = typeof e?.data === 'number' ? e.data : 0;
      isSyncingFromProp.current = true;
      onPageChangeRef.current(idx);
      setTimeout(() => {
        isSyncingFromProp.current = false;
      }, 50);
    });

    pageFlipRef.current = flip;

    // Desativa completamente a curvatura por aproximação (hover) nos eventos de mousemove/pointermove,
    // garantindo que a virada ocorra exclusivamente por clique ou arraste intencional nos 4% externos.
    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest('button, a, input, select, textarea, [role="button"]')
      );
    };

    const getRelX = (e: MouseEvent | TouchEvent | PointerEvent): number | null => {
      const cRect = container.getBoundingClientRect();
      if (!cRect.width) return null;

      let clientX: number | null = null;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
      } else if ('clientX' in e) {
        clientX = e.clientX;
      }

      if (clientX === null) return null;
      return (clientX - cRect.left) / cRect.width;
    };

    let startX: number | null = null;

    const handleCaptureStart = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (isInteractiveTarget(e.target)) {
        e.stopPropagation();
        return;
      }
      const relX = getRelX(e);
      if (relX === null) return;

      if ('touches' in e && e.touches.length > 0) {
        startX = e.touches[0].clientX;
      } else if ('clientX' in e) {
        startX = e.clientX;
      }

      // Se o início do toque/clique estiver nos 92% centrais, impede que o StPageFlip inicie arraste ou clique
      if (relX > 0.04 && relX < 0.96) {
        e.stopPropagation();
      }
    };

    // Suprime qualquer evento de hover para não acionar corner curl nos 92% centrais ou sobre elementos interativos
    const handleCaptureMove = (e: MouseEvent | PointerEvent) => {
      const interactive = isInteractiveTarget(e.target);
      const relX = getRelX(e);
      const inCenter = relX === null || (relX > 0.04 && relX < 0.96);

      if (interactive || inCenter) {
        e.stopPropagation();
      }
    };

    // Funções auxiliares para virada precisa
    const turnNext = () => {
      const flipAny = flip as any;
      try {
        if (typeof flipAny.flipNext === 'function') {
          flipAny.flipNext('top');
        } else {
          flipAny.turnToNextPage();
        }
      } catch {
        // ignore
      }
    };

    const turnPrev = () => {
      const flipAny = flip as any;
      try {
        if (typeof flipAny.flipPrev === 'function') {
          flipAny.flipPrev('top');
        } else {
          flipAny.turnToPrevPage();
        }
      } catch {
        // ignore
      }
    };

    // Garante que o clique nas zonas de 4% acione a virada voluntária (flipNext/flipPrev)
    const handleCaptureClick = (e: MouseEvent) => {
      if (isInteractiveTarget(e.target)) return;
      const relX = getRelX(e);
      if (relX === null) return;

      // Se houve arraste significativo, o próprio flipController gerencia
      if (startX !== null && Math.abs(e.clientX - startX) > 10) return;

      if (relX >= 0.96) {
        e.stopPropagation();
        turnNext();
      } else if (relX <= 0.04) {
        e.stopPropagation();
        turnPrev();
      }
    };

    // Suporte mobile: touch voluntário nas extremidades (4%)
    const handleCaptureTouchEnd = (e: TouchEvent) => {
      if (isInteractiveTarget(e.target)) return;
      if (startX === null || e.changedTouches.length === 0) return;
      const endX = e.changedTouches[0].clientX;
      const diffX = endX - startX;

      const cRect = container.getBoundingClientRect();
      if (!cRect.width) return;
      const relStartX = (startX - cRect.left) / cRect.width;

      // Toque simples (sem swipe longo) nas zonas de 4%
      if (Math.abs(diffX) < 15) {
        if (relStartX >= 0.96) {
          turnNext();
        } else if (relStartX <= 0.04) {
          turnPrev();
        }
      } else if (relStartX >= 0.94 && diffX < -20) {
        // Swipe da borda direita para a esquerda
        turnNext();
      } else if (relStartX <= 0.06 && diffX > 20) {
        // Swipe da borda esquerda para a direita
        turnPrev();
      }
    };

    container.addEventListener('pointerdown', handleCaptureStart, { capture: true });
    container.addEventListener('mousedown', handleCaptureStart, { capture: true });
    container.addEventListener('touchstart', handleCaptureStart, { capture: true, passive: true });
    container.addEventListener('pointermove', handleCaptureMove, { capture: true });
    container.addEventListener('mousemove', handleCaptureMove, { capture: true });
    container.addEventListener('click', handleCaptureClick, { capture: true });
    container.addEventListener('touchend', handleCaptureTouchEnd, { capture: true, passive: true });

    return () => {
      container.removeEventListener('pointerdown', handleCaptureStart, { capture: true });
      container.removeEventListener('mousedown', handleCaptureStart, { capture: true });
      container.removeEventListener('touchstart', handleCaptureStart, { capture: true });
      container.removeEventListener('pointermove', handleCaptureMove, { capture: true });
      container.removeEventListener('mousemove', handleCaptureMove, { capture: true });
      container.removeEventListener('click', handleCaptureClick, { capture: true });
      container.removeEventListener('touchend', handleCaptureTouchEnd, { capture: true });
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
      if (isSyncingFromProp.current) return;
      const activeIdx = flip.getCurrentPageIndex();
      // Em modo landscape, uma página ativa pode compartilhar o spread com a página adjacente
      const flipAny = flip as any;
      const pageCol = typeof flipAny.getPageCollection === 'function' ? flipAny.getPageCollection() : null;
      if (pageCol) {
        const curSpread = pageCol.getCurrentSpreadIndex();
        const targetSpread = pageCol.getSpreadIndexByPage(currentPage);
        if (curSpread === targetSpread) {
          return;
        }
      }

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
