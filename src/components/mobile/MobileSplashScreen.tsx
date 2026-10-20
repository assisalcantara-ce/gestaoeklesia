'use client';

/**
 * MobileSplashScreen
 * 
 * Tela de abertura / carregamento inicial (Splash Screen) oficial do App do Membro.
 * Reproduz fielmente a composição visual aprovada:
 * - Imagem de fundo bg_app_membros.png (família, igreja e gradiente inferior).
 * - Logomarca icon-mask2.png no terço superior.
 * - Indicador de carregamento circular estilizado com pulso suave.
 * - Textos: "Carregando a sua igreja..." e "Conectando ao Eklésia".
 */

import Image from 'next/image';

interface MobileSplashScreenProps {
  titulo?: string;
  subtitulo?: string;
}

export default function MobileSplashScreen({
  titulo = 'Carregando a sua igreja...',
  subtitulo = 'Conectando ao Eklésia',
}: MobileSplashScreenProps) {
  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-[#0a1120] select-none">
      {/* ── Background oficial do App com alta prioridade ── */}
      <Image
        src="/img/bg_app_membros.png"
        alt="Gestão Eklésia"
        fill
        priority
        quality={90}
        sizes="(max-width: 768px) 100vw, 448px"
        className="object-cover object-center pointer-events-none"
      />

      {/* ── Região Superior: Logomarca Gestão Eklésia ── */}
      <header className="relative z-10 w-full pt-14 sm:pt-16 pb-4 flex justify-center px-6">
        <div className="relative w-44 sm:w-48 h-20 sm:h-24 drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          <Image
            src="/icons/icon-mask2.png"
            alt="Logomarca Gestão Eklésia"
            fill
            priority
            sizes="192px"
            className="object-contain"
          />
        </div>
      </header>

      {/* ── Região Inferior: Spinner e Textos sobre o gradiente azul ── */}
      <footer className="relative z-10 w-full pb-12 sm:pb-14 pt-6 px-6 flex flex-col items-center text-center">
        {/* Indicador circular animado */}
        <div className="relative w-12 h-12 mb-5 flex items-center justify-center">
          <div className="w-11 h-11 rounded-full border-[3.5px] border-sky-400/25 border-t-sky-400 border-r-cyan-300 animate-spin" />
          <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-xs animate-pulse" />
        </div>

        {/* Texto principal */}
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          {titulo}
        </h2>

        {/* Texto secundário */}
        <p className="text-xs sm:text-sm font-medium text-slate-200/90 mt-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          {subtitulo}
        </p>
      </footer>
    </div>
  );
}
