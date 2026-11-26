'use client';

import { useState } from 'react';
import { CalendarDays, Clock, MapPin, Award } from 'lucide-react';

export interface EventoRevistaV3 {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  local?: string | null;
  calendario_oficial?: boolean;
  tipo?: {
    nome?: string | null;
    cor?: string | null;
    categoria?: string | null;
  } | null;
}

interface ProgramacaoMensalV3Props {
  ano: number;
  mesNome: string;
  eventos: EventoRevistaV3[];
  formatarDataHora: (inicio: string, fim: string | null) => {
    dia: string;
    mes: string;
    horario: string;
  };
  playfairClassName: string;
  montserratClassName: string;
}

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'oficial', label: 'Oficiais' },
  { id: 'culto', label: 'Cultos' },
  { id: 'reuniao', label: 'Reuniões' },
  { id: 'evento', label: 'Eventos' },
  { id: 'departamento', label: 'Departamentos' },
];

function normalizeHexColor(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

export default function ProgramacaoMensalV3({
  ano,
  mesNome,
  eventos,
  formatarDataHora,
  playfairClassName,
  montserratClassName,
}: ProgramacaoMensalV3Props) {
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const filtrados =
    filtroCategoria === 'todos'
      ? eventos
      : filtroCategoria === 'oficial'
      ? eventos.filter((e) => e.calendario_oficial)
      : eventos.filter((e) => e.tipo?.categoria === filtroCategoria);

  return (
    <div
      className={`h-full w-full flex flex-col min-h-0 bg-[#FAF8F2] text-[#031525] px-3.5 sm:px-6 pt-3.5 sm:pt-5 pb-2 select-none ${montserratClassName}`}
    >
      {/* Cabeçalho Editorial Compacto */}
      <header className="shrink-0 text-center pb-2.5 border-b border-[#C9A24D]/30">
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9A24D]">
          PROGRAMAÇÃO MENSAL • {ano}
        </p>
        <h3
          className={`${playfairClassName} text-[24px] sm:text-[30px] font-bold text-[#031525] leading-tight mt-0.5`}
        >
          {mesNome}
        </h3>
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <span className="h-[1px] w-10 bg-gradient-to-r from-transparent to-[#C9A24D]" />
          <span className="w-1.5 h-1.5 rotate-45 bg-[#C9A24D]" />
          <span className="h-[1px] w-10 bg-gradient-to-l from-transparent to-[#C9A24D]" />
        </div>

        {/* Filtros preservados */}
        <div className="flex items-center justify-center gap-1 flex-wrap mt-2.5">
          {FILTROS.map((f) => {
            const ativo = filtroCategoria === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setFiltroCategoria(f.id);
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer border ${
                  ativo
                    ? 'bg-[#031525] text-[#FAF8F2] border-[#031525]'
                    : 'bg-white/70 text-[#263548] border-[#C9A24D]/30 hover:border-[#C9A24D]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Lista Cronológica Ultracompacta (ocupa 100% da altura restante) */}
      <div className="flex-1 min-h-0 overflow-y-auto revista-scroll pr-0.5 mt-1">
        {filtrados.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
            <CalendarDays className="w-8 h-8 text-[#C9A24D]/70 mb-2" />
            <h4 className="text-sm font-bold text-[#031525]">Sem eventos programados</h4>
            <p className="text-[11px] text-[#263548]/80 mt-1 max-w-xs">
              Nenhuma atividade pública cadastrada para este mês com o filtro selecionado.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#C9A24D]/20">
            {filtrados.map((evento) => {
              const { dia, mes, horario } = formatarDataHora(
                evento.data_inicio,
                evento.data_fim ?? null
              );
              const hexCor = normalizeHexColor(evento.tipo?.cor);
              const rowStyle = hexCor
                ? {
                    background: `linear-gradient(90deg, transparent 0%, transparent 45%, ${hexCor}2E 100%)`,
                    borderRight: `3px solid ${hexCor}`,
                  }
                : {
                    borderRight: '3px solid transparent',
                  };

              return (
                <article
                  key={evento.id}
                  style={rowStyle}
                  className="flex items-center py-[6px] min-h-[46px] transition-colors"
                >
                  {/* ESQUERDA (~12%): Dia + Mês + Separador vertical dourado */}
                  <div className="w-[12%] min-w-[40px] shrink-0 flex flex-col items-center justify-center pr-1.5 border-r border-[#C9A24D]/35">
                    <span className="text-[20px] sm:text-[22px] font-bold leading-none text-[#031525] tabular-nums">
                      {dia}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#C9A24D] mt-0.5 leading-none">
                      {mes}
                    </span>
                  </div>

                  {/* CENTRO (~53%): Categoria + Título completo */}
                  <div className="w-[53%] min-w-0 px-2.5 flex flex-col justify-center">
                    {(evento.tipo?.nome || evento.calendario_oficial) && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {evento.tipo?.nome && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#263548]/75 truncate">
                            {evento.tipo.nome}
                          </span>
                        )}
                        {evento.calendario_oficial && (
                          <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold uppercase tracking-wide text-[#9A7422]">
                            <Award className="w-2.5 h-2.5 text-[#C9A24D]" />
                            Oficial
                          </span>
                        )}
                      </div>
                    )}
                    <h4 className="text-[12px] sm:text-[13px] font-semibold text-[#031525] leading-snug break-words">
                      {evento.titulo}
                    </h4>
                  </div>

                  {/* DIREITA (~35%): Horário + Localização alinhados à direita */}
                  <div className="w-[35%] min-w-0 pr-2 flex flex-col items-end justify-center text-right gap-0.5 text-[10px] sm:text-[11px] text-[#263548] font-medium">
                    {horario && (
                      <span className="inline-flex items-center justify-end gap-1 max-w-full">
                        <Clock className="w-2.5 h-2.5 text-[#C9A24D] shrink-0" />
                        <span className="truncate">{horario}</span>
                      </span>
                    )}
                    {evento.local && (
                      <span className="inline-flex items-center justify-end gap-1 max-w-full text-[#263548]/80">
                        <MapPin className="w-2.5 h-2.5 text-[#C9A24D] shrink-0" />
                        <span className="truncate">{evento.local}</span>
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
