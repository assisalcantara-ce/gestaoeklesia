'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { AgendaEvento } from '@/hooks/agenda/useAgenda';
import { getEventoVisual, AgendaCategoryKey } from '@/lib/agenda-visual-utils';
import { formatHoraLocal } from '@/lib/timezone-utils';

export type CalendarViewMode = 'mes' | 'semana' | 'dia' | 'lista';

interface AgendaCalendarViewProps {
  currentMonth: number;
  currentYear: number;
  MESES_PT: string[];
  daysInMonthArray: { dateStr: string | null; dayNum: number | null }[];
  eventosPorDia: Record<string, AgendaEvento[]>;
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
  isEscritaPermitida?: boolean;
  onOpenForm?: (evento: AgendaEvento | null, defaultDateStr?: string | null) => void;
  activeCategory?: AgendaCategoryKey;
}

export default function AgendaCalendarView({
  currentMonth,
  currentYear,
  MESES_PT,
  daysInMonthArray,
  eventosPorDia,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
  isEscritaPermitida = false,
  onOpenForm,
  activeCategory = 'todos',
}: AgendaCalendarViewProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('mes');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Calcular dias do mês anterior para preencher as células vazias do início
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 0);
  const totalDaysPrevMonth = prevMonthDate.getDate();

  // Calcular dias do próximo mês para completar a última linha se necessário
  const emptyAtStartCount = daysInMonthArray.findIndex(d => d.dayNum !== null);
  const startOffset = emptyAtStartCount > 0 ? emptyAtStartCount : 0;

  // Filtrar eventos de acordo com a categoria ativa, se houver filtro
  const filterEventsByCategory = (events: AgendaEvento[]) => {
    if (activeCategory === 'todos') return events;
    return events.filter(ev => {
      const visual = getEventoVisual(ev);
      return visual.category === activeCategory;
    });
  };

  const formatHora = (dataInicio: string) => {
    return formatHoraLocal(dataInicio);
  };

  const monthTitle = `${MESES_PT[currentMonth - 1]} de ${currentYear}`;

  return (
    <div className="flex-1 min-w-0 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Barra de Controles Superiores: Navegação de Mês + Hoje + Modos de Visualização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        {/* Lado Esquerdo: Botões < e > + Título do Mês */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrevMonth}
              title="Mês anterior"
              className="w-8 h-8 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              title="Próximo mês"
              className="w-8 h-8 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {monthTitle}
          </h2>
        </div>

        {/* Lado Direito: Botão "Hoje" + Alternador de Visualização (Mês, Semana, Dia, Lista) */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onGoToToday}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            Hoje
          </button>

          <div className="bg-slate-100/80 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode('mes')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'mes'
                  ? 'bg-[#1d4ed8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setViewMode('semana')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'semana'
                  ? 'bg-[#1d4ed8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode('dia')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'dia'
                  ? 'bg-[#1d4ed8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-[#1d4ed8] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* VISÃO MENSAL (Principal e idêntica ao Mockup) */}
      {viewMode === 'mes' && (
        <div className="pt-4 flex-1 flex flex-col">
          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 text-center font-semibold text-slate-600 text-xs sm:text-sm py-2.5 border-b border-slate-200">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Grade Mensal de 7 Colunas com Bordas Claras e Definidas */}
          <div className="grid grid-cols-7 border-t border-l border-slate-200 rounded-b-2xl overflow-hidden mt-1 flex-1 shadow-2xs">
            {daysInMonthArray.map((day, idx) => {
              // Células vazias que antecedem o 1º dia do mês (mostram os últimos dias do mês anterior)
              if (day.dayNum === null) {
                const prevDayNumber = totalDaysPrevMonth - startOffset + idx + 1;
                return (
                  <div
                    key={`prev-${idx}`}
                    className="min-h-[96px] sm:min-h-[114px] p-2 border-r border-b border-slate-200/70 bg-slate-50/40 flex flex-col select-none"
                  >
                    <span className="text-xs sm:text-sm font-normal text-slate-300">
                      {prevDayNumber}
                    </span>
                  </div>
                );
              }

              const dateStr = day.dateStr!;
              const todosEventosDoDia = eventosPorDia[dateStr] ?? [];
              const diaEventos = filterEventsByCategory(todosEventosDoDia);
              const isToday = todayStr === dateStr;
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={() => onSelectDate(dateStr)}
                  className={`min-h-[96px] sm:min-h-[114px] p-1.5 sm:p-2 border-r border-b border-slate-200/80 flex flex-col justify-start relative group transition-colors cursor-pointer ${
                    isToday
                      ? 'bg-blue-50/70 border-blue-300 ring-1 ring-inset ring-blue-400/50'
                      : isSelected
                        ? 'bg-blue-50/40 ring-1 ring-inset ring-[#1d4ed8]/30'
                        : 'hover:bg-slate-50/70 bg-white'
                  }`}
                >
                  {/* Linha superior da célula: Número do dia + botão adicionar */}
                  <div className="flex items-center justify-between mb-1.5">
                    {isToday ? (
                      <span className="w-6 h-6 rounded-full bg-[#1d4ed8] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {day.dayNum}
                      </span>
                    ) : (
                      <span
                        className={`text-xs sm:text-sm font-semibold pl-0.5 ${
                          isSelected ? 'text-[#1d4ed8] font-bold' : 'text-slate-700'
                        }`}
                      >
                        {day.dayNum}
                      </span>
                    )}

                    {/* Botão sutil + no hover para cadastrar evento nesta data */}
                    {isEscritaPermitida && onOpenForm && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onSelectDate(dateStr);
                          onOpenForm(null, dateStr);
                        }}
                        title={`Novo evento em ${day.dayNum}`}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-slate-100 hover:bg-[#1d4ed8] hover:text-white text-slate-600 flex items-center justify-center transition-all text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Lista de mini-cards de eventos dentro da célula */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {diaEventos.slice(0, 3).map(ev => {
                      const visual = getEventoVisual(ev);
                      const IconComponent = visual.icon;
                      const hora = formatHora(ev.data_inicio);

                      return (
                        <div
                          key={ev.id}
                          onClick={e => {
                            e.stopPropagation();
                            onSelectDate(dateStr);
                            onOpenForm?.(ev, dateStr);
                          }}
                          className={`rounded-lg px-2 py-1 text-[11px] leading-tight border transition-all hover:scale-[1.02] shadow-2xs ${visual.pillBg} ${visual.pillBorder} ${visual.pillText}`}
                          title={`${hora} - ${ev.titulo} (${ev.local || 'Templo'})`}
                        >
                          <div className="flex items-center gap-1 font-semibold text-[10px] opacity-90">
                            <IconComponent className="w-3 h-3 shrink-0" />
                            <span>{hora || 'Dia todo'}</span>
                          </div>
                          <div className="font-bold truncate mt-0.5">
                            {ev.titulo}
                          </div>
                        </div>
                      );
                    })}

                    {diaEventos.length > 3 && (
                      <div className="text-[10px] font-bold text-slate-500 pl-1 hover:text-[#1d4ed8]">
                        +{diaEventos.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISÃO SEMANAL */}
      {viewMode === 'semana' && (
        <div className="pt-4 flex-1 flex flex-col">
          <div className="p-4 bg-slate-50 rounded-2xl mb-4 text-xs font-medium text-slate-600 flex items-center justify-between">
            <span>Visão Semanal de Atividades</span>
            <span className="font-bold text-slate-800">
              {daysInMonthArray.filter(d => d.dayNum !== null).length} dias no mês
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((diaNome) => {
              return (
                <div key={diaNome} className="bg-slate-50/60 rounded-2xl p-3 border border-slate-100">
                  <div className="font-bold text-xs text-slate-700 pb-2 border-b border-slate-200/60 mb-2">
                    {diaNome}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Clique em um dia na visão Mês para detalhar.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISÃO DIÁRIA */}
      {viewMode === 'dia' && (
        <div className="pt-4 flex-1 flex flex-col">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Dia selecionado</span>
              <h3 className="text-base font-bold text-slate-900">
                {selectedDate
                  ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Selecione uma data no calendário'}
              </h3>
            </div>
            {isEscritaPermitida && onOpenForm && (
              <button
                onClick={() => onOpenForm(null, selectedDate || todayStr)}
                className="px-3.5 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-bold rounded-xl transition shadow-xs"
              >
                + Adicionar Evento
              </button>
            )}
          </div>

          {selectedDate && eventosPorDia[selectedDate]?.length ? (
            <div className="space-y-2.5">
              {eventosPorDia[selectedDate].map(ev => {
                const visual = getEventoVisual(ev);
                const IconComponent = visual.icon;
                return (
                  <div
                    key={ev.id}
                    onClick={() => onOpenForm?.(ev, selectedDate)}
                    className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 cursor-pointer transition shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${visual.iconBg} ${visual.iconColor}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500">
                          {formatHora(ev.data_inicio) || 'Dia todo'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800">{ev.titulo}</h4>
                        <p className="text-xs text-slate-400">{ev.local || 'Templo Sede'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhum evento registrado nesta data.</p>
            </div>
          )}
        </div>
      )}

      {/* VISÃO EM LISTA */}
      {viewMode === 'lista' && (
        <div className="pt-4 flex-1 flex flex-col space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
            Todos os eventos do mês ({monthTitle})
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {Object.keys(eventosPorDia).length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Nenhum evento agendado neste mês.</p>
              </div>
            ) : (
              Object.entries(eventosPorDia)
                .sort(([a], [b]) => a.localeCompare(b))
                .flatMap(([dateStr, evList]) =>
                  evList.map(ev => {
                    const visual = getEventoVisual(ev);
                    const IconComponent = visual.icon;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => onOpenForm?.(ev, dateStr)}
                        className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 flex items-center justify-between gap-3 cursor-pointer transition shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${visual.iconBg} ${visual.iconColor}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')} • {formatHora(ev.data_inicio) || 'Dia todo'}
                            </span>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-800">{ev.titulo}</h4>
                            <span className="text-[11px] text-slate-400">{ev.local || 'Templo Sede'}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${visual.pillBg} ${visual.pillBorder} ${visual.pillText}`}>
                          {visual.label}
                        </span>
                      </div>
                    );
                  })
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
