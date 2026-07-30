'use client';

import DashboardSection from '@/components/dashboard/DashboardSection';
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
}

export default function AgendaCalendar({
  daysInMonthArray,
  eventosPorDia,
  selectedDate,
  onSelectDate,
}: AgendaCalendarProps) {
  return (
    <DashboardSection
      title="Calendário Mensal"
      icon={CalendarIcon}
      className="flex-1 min-w-0 !shadow-none !border-slate-200/50"
    >
      <div className="grid grid-cols-7 gap-1 text-center font-black text-slate-400 text-[10px] tracking-wider mb-2">
        <span>DOM</span>
        <span>SEG</span>
        <span>TER</span>
        <span>QUA</span>
        <span>QUI</span>
        <span>SEX</span>
        <span>SÁB</span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysInMonthArray.map((day, idx) => {
          if (day.dayNum === null) {
            return <div key={`empty-${idx}`} className="min-h-[56px] sm:min-h-[64px] bg-slate-50/50 rounded-md" />;
          }

          const dateStr = day.dateStr!;
          const diaEventos = eventosPorDia[dateStr] ?? [];
          const isSelected = selectedDate === dateStr;
          const isToday = new Date().toISOString().split('T')[0] === dateStr;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={`min-h-[56px] sm:min-h-[64px] p-1.5 rounded-md flex flex-col justify-between items-center border transition relative ${
                isSelected 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                  : isToday
                    ? 'bg-blue-50/50 border-blue-200/60 text-blue-800'
                    : 'bg-white border-slate-100/70 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span className="text-xs font-semibold text-center w-full block">{day.dayNum}</span>

              <div className="flex gap-0.5 justify-center mt-auto w-full">
                {diaEventos.slice(0, 3).map(e => {
                  let dotColor = 'bg-slate-400';
                  if (e.calendario_oficial) dotColor = 'bg-indigo-500';
                  else if (e.bloqueado) dotColor = 'bg-rose-500';
                  else dotColor = 'bg-emerald-500';

                  return (
                    <span
                      key={e.id}
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : dotColor}`}
                    />
                  );
                })}
                {diaEventos.length > 3 && (
                  <span className={`text-[8px] font-black leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                    +
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-bold justify-center">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Oficial
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Local
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Sincronizado/Bloqueado
        </span>
      </div>
    </DashboardSection>
  );
}
