'use client';

import { useState } from 'react';
import {
  CalendarDays,
  UsersRound,
  Mic,
  Layers,
  BookOpen,
  ArrowRight,
  Church,
} from 'lucide-react';

interface CapaEditorialV3Props {
  nomeInstituicao: string;
  logoUrl: string | null;
  ano: number;
  onAbrirRevista: () => void;
  playfairClassName: string;
  montserratClassName: string;
}

export default function CapaEditorialV3({
  nomeInstituicao,
  logoUrl,
  ano,
  onAbrirRevista,
  playfairClassName,
  montserratClassName,
}: CapaEditorialV3Props) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-[#031525]"
      style={{ containerType: 'size' }}
    >
      {/* ─── BACKGROUND OFICIAL (100% FULL-BLEED) ─────────────────── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('/img/bg_agenda.png')" }}
      />

      {/* ─── 1. CABEÇALHO INSTITUCIONAL (3.5%–14.5% vertical, 88% largura) ─── */}
      <div
        className="absolute left-[6%] w-[88%] flex items-center gap-[3.5cqw]"
        style={{ top: '3.5%', height: '11%' }}
      >
        {/* Logomarca à esquerda (13.3% da largura da capa) */}
        <div className="w-[15%] h-full flex items-center justify-center shrink-0">
          {logoUrl && !logoError ? (
            <img
              src={logoUrl}
              alt={nomeInstituicao}
              onError={() => setLogoError(true)}
              className="w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
            />
          ) : (
            <Church className="w-[70%] h-[70%] text-[#F5D477]" strokeWidth={1.6} />
          )}
        </div>

        {/* Nome institucional à direita */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h2
            className={`${playfairClassName} font-bold uppercase text-[#F8FAFC] text-left tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]`}
            style={{
              fontSize: 'clamp(10px, min(3.4cqw, 2.55cqh), 24px)',
              lineHeight: 1.12,
            }}
          >
            {nomeInstituicao}
          </h2>
          <div
            className="mt-[1.2cqh] h-[1.5px] w-[75%]"
            style={{
              background:
                'linear-gradient(90deg, #FFF4C5 0%, #E6B84F 55%, rgba(183,121,25,0.2) 100%)',
            }}
          />
        </div>
      </div>

      {/* ─── 2. TÍTULO PRINCIPAL: AGENDA MINISTERIAL + ANO (19%–52%) ─── */}
      <div
        className="absolute left-[6%] w-[88%] flex flex-col items-center justify-center text-center"
        style={{ top: '19%', height: '33%' }}
      >
        {/* Linha 1: Ícone Calendário Dourado + Agenda */}
        <div className="flex items-center justify-center gap-[2.5cqw]">
          <CalendarDays
            className="shrink-0 text-[#F5D477] drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)]"
            style={{
              width: 'min(10.5cqw, 7.8cqh)',
              height: 'min(10.5cqw, 7.8cqh)',
            }}
            strokeWidth={1.8}
          />
          <span
            className={`${playfairClassName} font-extrabold text-[#F8FAFC] tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]`}
            style={{
              fontSize: 'min(13.4cqw, 10cqh)',
              lineHeight: 0.95,
            }}
          >
            Agenda
          </span>
        </div>

        {/* Linha 2: Ministerial (itálico com gradiente metálico dourado) */}
        <span
          className={`${playfairClassName} font-extrabold italic tracking-tight bg-clip-text text-transparent drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]`}
          style={{
            fontSize: 'min(13cqw, 9.7cqh)',
            lineHeight: 0.95,
            backgroundImage:
              'linear-gradient(180deg, #FFF4C5 0%, #F5D477 28%, #DCA63A 65%, #B77919 100%)',
          }}
        >
          Ministerial
        </span>

        {/* Linha 3: Ano dinâmico (itálico branco perolado) */}
        <span
          className={`${playfairClassName} font-extrabold italic text-[#F8FAFC] tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]`}
          style={{
            fontSize: 'min(17.8cqw, 13.2cqh)',
            lineHeight: 0.95,
          }}
        >
          {ano}
        </span>

        {/* Ornamento curvo dourado abaixo do ano */}
        <svg
          viewBox="0 0 420 26"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mt-[0.8cqh]"
          style={{ width: '43%', height: 'min(2.4cqh, 22px)' }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="goldCurve" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B77919" stopOpacity="0.2" />
              <stop offset="25%" stopColor="#FFF4C5" />
              <stop offset="50%" stopColor="#F5D477" />
              <stop offset="75%" stopColor="#DCA63A" />
              <stop offset="100%" stopColor="#B77919" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path
            d="M8 18C95 24 220 4 412 10C310 14 150 26 8 18Z"
            fill="url(#goldCurve)"
          />
        </svg>
      </div>

      {/* ─── 3. FAIXA DE CATEGORIAS INSTITUCIONAIS (55%–65%, 84% largura) ─── */}
      <div
        className="absolute left-[8%] w-[84%] grid grid-cols-4 items-center"
        style={{ top: '55%', height: '10%' }}
      >
        {[
          { icon: CalendarDays, label: 'Programação\nAnual' },
          { icon: UsersRound, label: 'Cultos\nSolenes' },
          { icon: Mic, label: 'Conferências' },
          { icon: Layers, label: 'Atividades\nMinisteriais' },
        ].map((cat, idx) => {
          const IconComp = cat.icon;
          return (
            <div
              key={idx}
              className={`flex flex-col items-center justify-center text-center px-[1cqw] h-full ${
                idx < 3 ? 'border-r border-[#E6B84F]/60' : ''
              }`}
            >
              <IconComp
                className="text-[#F5D477] mb-[0.8cqh] shrink-0"
                style={{
                  width: 'min(4.4cqw, 3.3cqh)',
                  height: 'min(4.4cqw, 3.3cqh)',
                }}
                strokeWidth={1.85}
              />
              <span
                className={`${montserratClassName} font-medium text-[#F8FAFC] whitespace-pre-line`}
                style={{
                  fontSize: 'clamp(8px, min(2cqw, 1.5cqh), 15px)',
                  lineHeight: 1.2,
                }}
              >
                {cat.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ─── 4. BOTÃO ABRIR REVISTA (74%–82%, 65% largura) ─────────── */}
      <div
        className="absolute left-[17.5%] w-[65%] flex items-center justify-center"
        style={{ top: '74%', height: '8%' }}
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAbrirRevista();
          }}
          className={`${montserratClassName} w-full h-full rounded-full font-extrabold text-[#031525] flex items-center justify-center gap-[2.2cqw] cursor-pointer transition-transform duration-150 hover:brightness-105 active:scale-[0.98]`}
          style={{
            background:
              'linear-gradient(180deg, #FFF4C5 0%, #F5D477 28%, #DCA63A 65%, #B77919 100%)',
            border: '1.5px solid #FFF0B0',
            boxShadow:
              '0 10px 25px rgba(0, 0, 0, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.7)',
            fontSize: 'clamp(11px, min(3.7cqw, 2.7cqh), 22px)',
          }}
        >
          <BookOpen
            className="shrink-0 text-[#031525]"
            style={{
              width: 'min(4.5cqw, 3.3cqh)',
              height: 'min(4.5cqw, 3.3cqh)',
            }}
            strokeWidth={2.2}
          />
          <span className="tracking-wider">ABRIR REVISTA</span>
          <ArrowRight
            className="shrink-0 text-[#031525]"
            style={{
              width: 'min(4.5cqw, 3.3cqh)',
              height: 'min(4.5cqw, 3.3cqh)',
            }}
            strokeWidth={2.4}
          />
        </button>
      </div>
    </div>
  );
}
