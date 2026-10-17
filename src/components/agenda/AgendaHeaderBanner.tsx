'use client';

import { Calendar } from 'lucide-react';

export default function AgendaHeaderBanner() {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-slate-200/70 shadow-sm bg-[#1e1e1e] min-h-[130px] sm:min-h-[140px] flex items-center">
      {/* Imagem de Fundo (Recurso gráfico separado) */}
      <img
        src="/agenda-banner.jpg"
        alt="Bíblia Sagrada e Iluminação Acolhedora"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
      />

      {/* Gradiente suave à esquerda para garantir contraste perfeito das letras brancas */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 via-45% to-transparent pointer-events-none" />

      {/* Conteúdo HTML do Banner */}
      <div className="relative z-10 w-full px-5 sm:px-8 py-4 sm:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Lado Esquerdo: Ícone + Título + Subtítulo */}
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Caixa Branca com Ícone Azul do Calendário */}
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-100">
            <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-[#0284c7]" strokeWidth={2.2} />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-sm">
              Agenda da Igreja
            </h1>
            <p className="text-xs sm:text-sm text-white/95 font-medium mt-0.5 drop-shadow-xs max-w-md">
              Organize, acompanhe e viva cada momento da nossa jornada.
            </p>
          </div>
        </div>

        {/* Lado Direito: Citação Bíblica Manuscrita de Eclesiastes 3:1 */}
        <div className="hidden sm:flex flex-col items-end text-right pr-2 select-none">
          <p
            className="text-slate-800 text-lg sm:text-xl lg:text-[22px] font-bold leading-snug italic tracking-wide drop-shadow-xs max-w-sm lg:max-w-md"
            style={{ fontFamily: "'Caveat', cursive, serif" }}
          >
            &ldquo;Tudo tem o seu tempo, e há tempo para todo o propósito debaixo do céu.&rdquo;
          </p>
          <div className="flex flex-col items-end mt-0.5">
            <span
              className="text-xs sm:text-sm font-bold text-slate-800"
              style={{ fontFamily: "'Caveat', cursive, sans-serif" }}
            >
              Eclesiastes 3:1
            </span>
            {/* Pincelada / Curva dourada abaixo da referência */}
            <svg
              className="w-16 h-2 mt-0.5"
              viewBox="0 0 60 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 5.5C18 2.5 44 2.5 58 5"
                stroke="#f59e0b"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
