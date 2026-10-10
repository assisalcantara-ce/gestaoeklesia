'use client';

import { Calendar as CalendarIcon } from 'lucide-react';

export interface AgendaEvento {
  id: string;
  ministry_id: string;
  church_id: string | null;
  planejamento_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: 'culto' | 'reuniao' | 'aula' | 'evento' | 'tarefa' | 'outro';
  tipo_id: string | null;
  origem: string;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  visibilidade: 'privado' | 'lideranca' | 'igreja' | 'ministerio' | 'publico';
  status: 'agendado' | 'cancelado' | 'concluido';
  recorrente: boolean;
  escopo: 'organizacao' | 'divisao1' | 'divisao2' | 'divisao3';
  prioridade: number;
  calendario_oficial: boolean;
  gera_bloqueio: boolean;
  bloqueado: boolean;
  origem_tipo: string | null;
  origem_id: string | null;
  regra_posicionamento: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AgendaCalendarProps {
  daysInMonthArray: { dateStr: string | null; dayNum: number | null }[];
  eventosPorDia: Record<string, AgendaEvento[]>;
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
  isEscritaPermitida?: boolean;
  onOpenForm?: (evento: AgendaEvento | null, defaultDateStr?: string | null) => void;
}

export default function AgendaCalendar({
  daysInMonthArray,
  eventosPorDia,
  selectedDate,
  onSelectDate,
  isEscritaPermitida = false,
  onOpenForm,
}: AgendaCalendarProps) {
  return (
    <div className="flex-1 min-w-0 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <h3 className="font-black text-slate-800 text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-teal-700" />
          Calendário Mensal
        </h3>
        {selectedDate && isEscritaPermitida && onOpenForm && (
          <button
            onClick={() => onOpenForm(null, selectedDate)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            + Adicionar nesta data ({new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')})
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center font-black text-slate-400 text-[11px] tracking-wider mb-2.5">
        <span>DOM</span>
        <span>SEG</span>
        <span>TER</span>
        <span>QUA</span>
        <span>QUI</span>
        <span>SEX</span>
        <span>SÁB</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {daysInMonthArray.map((day, idx) => {
          if (day.dayNum === null) {
            return <div key={`empty-${idx}`} className="min-h-[58px] sm:min-h-[66px] bg-slate-50/40 rounded-xl" />;
          }

          const dateStr = day.dateStr!;
          const diaEventos = eventosPorDia[dateStr] ?? [];
          const hasEvents = diaEventos.length > 0;
          const isSelected = selectedDate === dateStr;
          const isToday = new Date().toISOString().split('T')[0] === dateStr;

          const handleCellClick = () => {
            // Seleciona o dia no calendário para filtrar e exibir a lista lateral
            onSelectDate(dateStr);
            // Se já estava selecionado ou se for duplo clique / intenção direta de criar quando não há eventos
            if (isSelected && isEscritaPermitida && onOpenForm) {
              onOpenForm(null, dateStr);
            }
          };

          return (
            <div
              key={dateStr}
              onClick={handleCellClick}
              className={`min-h-[58px] sm:min-h-[66px] p-2 rounded-xl flex flex-col justify-between items-center border transition-all relative cursor-pointer group ${
                isSelected 
                  ? 'bg-teal-700 border-teal-800 text-white shadow-sm ring-2 ring-teal-600/30' 
                  : isToday
                    ? hasEvents
                      ? 'bg-amber-100/70 border-amber-400 text-amber-950 font-bold'
                      : 'bg-teal-50/60 border-teal-300 text-teal-900 font-bold'
                    : hasEvents
                      ? 'bg-[#fff7ed] border-[#fed7aa] hover:bg-[#ffedd5] hover:border-[#fdba74] text-slate-800 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="w-full flex items-center justify-between">
                <span className={`text-xs sm:text-sm font-bold block ${
                  isSelected 
                    ? 'text-white' 
                    : isToday 
                      ? 'text-teal-900 font-black' 
                      : hasEvents
                        ? 'text-amber-950 font-black'
                        : 'text-slate-800'
                }`}>
                  {day.dayNum}
                </span>

                {/* Botão rápido + no hover do dia para adicionar evento direto */}
                {isEscritaPermitida && onOpenForm && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(dateStr);
                      onOpenForm(null, dateStr);
                    }}
                    title={`Adicionar novo evento em ${day.dayNum}`}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-md text-[10px] font-black flex items-center justify-center leading-none ${
                      isSelected 
                        ? 'bg-teal-800 hover:bg-teal-900 text-white' 
                        : 'bg-teal-100 hover:bg-teal-700 text-teal-800 hover:text-white'
                    }`}
                  >
                    +
                  </button>
                )}
              </div>

              {/* Indicadores de eventos com clique direto para editar */}
              <div className="flex gap-1 justify-center mt-auto w-full">
                {diaEventos.slice(0, 3).map(e => {
                  let dotColor = 'bg-slate-400';
                  if (e.calendario_oficial) dotColor = 'bg-indigo-500';
                  else if (e.bloqueado) dotColor = 'bg-rose-500';
                  else dotColor = 'bg-emerald-500';

                  return (
                    <span
                      key={e.id}
                      onClick={(evtClick) => {
                        if (isEscritaPermitida && onOpenForm && !e.bloqueado) {
                          evtClick.stopPropagation();
                          onSelectDate(dateStr);
                          onOpenForm(e, dateStr);
                        }
                      }}
                      title={e.titulo}
                      className={`w-2 h-2 rounded-full cursor-pointer hover:scale-125 transition-transform ${isSelected ? 'bg-white' : dotColor}`}
                    />
                  );
                })}
                {diaEventos.length > 3 && (
                  <span className={`text-[9px] font-black leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                    +{diaEventos.length - 3}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 pt-3.5 border-t border-slate-100 text-xs text-slate-500 font-semibold justify-center">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          Oficial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Local
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          Sincronizado / Bloqueado
        </span>
      </div>
    </div>
  );
}
