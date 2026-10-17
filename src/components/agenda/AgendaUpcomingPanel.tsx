'use client';

import { ChevronRight, Calendar } from 'lucide-react';
import { AgendaEvento } from '@/hooks/agenda/useAgenda';
import { getEventoVisual, AgendaCategoryKey } from '@/lib/agenda-visual-utils';

interface AgendaUpcomingPanelProps {
  proximosEventos: AgendaEvento[];
  selectedDate?: string | null;
  selectedCategory?: AgendaCategoryKey;
  onSelectDate?: (dateStr: string | null) => void;
  onOpenForm?: (evento: AgendaEvento | null, defaultDateStr?: string | null) => void;
  onVerTodos?: () => void;
}

export default function AgendaUpcomingPanel({
  proximosEventos = [],
  selectedDate,
  selectedCategory = 'todos',
  onSelectDate,
  onOpenForm,
  onVerTodos,
}: AgendaUpcomingPanelProps) {
  // Filtrar pela categoria selecionada, se houver
  const filteredByCat = selectedCategory === 'todos' 
    ? proximosEventos 
    : proximosEventos.filter(ev => getEventoVisual(ev).category === selectedCategory);

  // Se houver selectedDate, prioriza ou destaca
  const baseEvents = selectedDate 
    ? filteredByCat.filter(ev => ev.data_inicio.startsWith(selectedDate))
    : filteredByCat;

  // Ordenar cronologicamente
  const sortedEvents = [...(baseEvents.length > 0 ? baseEvents : filteredByCat)].sort((a, b) => {
    return new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime();
  });

  // Agrupar por data (YYYY-MM-DD)
  const groupedEvents: { [dateStr: string]: AgendaEvento[] } = {};
  sortedEvents.forEach(ev => {
    const dStr = ev.data_inicio.split('T')[0];
    if (!groupedEvents[dStr]) {
      groupedEvents[dStr] = [];
    }
    groupedEvents[dStr].push(ev);
  });

  const dateKeys = Object.keys(groupedEvents);

  const formatGroupHeader = (dateStr: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);

    const diaSemana = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const capitalizedDiaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
    const diaMes = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

    if (dateStr === todayStr) {
      return `Hoje • ${diaMes}`;
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    if (dateStr === tomorrowStr) {
      return `Amanhã • ${diaMes}`;
    }

    return `${capitalizedDiaSemana} • ${diaMes}`;
  };

  const formatHorario = (inicio: string, fim?: string | null) => {
    const horaInicio = inicio.includes('T') ? inicio.split('T')[1].substring(0, 5) : '';
    const horaFim = fim && fim.includes('T') ? fim.split('T')[1].substring(0, 5) : null;
    if (horaInicio && horaFim && horaFim !== '00:00') {
      return `${horaInicio} - ${horaFim}`;
    }
    return horaInicio || 'Dia todo';
  };

  return (
    <div className="w-full bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      {/* Header do Painel */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Próximos Compromissos
          </h2>
          <button
            type="button"
            onClick={onVerTodos}
            className="text-xs font-semibold text-[#1d4ed8] hover:text-[#1e40af] hover:underline cursor-pointer transition"
          >
            Ver todos
          </button>
        </div>

        {/* Lista Cronológica com Linha Vertical */}
        {dateKeys.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-xs font-medium">Nenhum próximo compromisso agendado.</p>
          </div>
        ) : (
          <div className="relative pt-4 space-y-6">
            {/* Linha vertical contínua */}
            <div className="absolute left-[7px] top-6 bottom-4 w-[2px] bg-slate-200 -z-0" />

            {dateKeys.slice(0, 6).map((dStr) => {
              const eventsInGroup = groupedEvents[dStr];
              const firstEventVisual = getEventoVisual(eventsInGroup[0]);

              return (
                <div key={dStr} className="relative z-10 space-y-2.5">
                  {/* Cabeçalho da data com Dot colorido */}
                  <div
                    onClick={() => onSelectDate?.(dStr)}
                    className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition"
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full shrink-0 border-2 border-white shadow-xs ${firstEventVisual.dotColor}`}
                    />
                    <span className="text-xs font-bold text-slate-700 tracking-tight">
                      {formatGroupHeader(dStr)}
                    </span>
                  </div>

                  {/* Cards do dia */}
                  <div className="pl-6 space-y-2">
                    {eventsInGroup.map(evento => {
                      const visual = getEventoVisual(evento);
                      const IconComponent = visual.icon;
                      const horario = formatHorario(evento.data_inicio, evento.data_fim);
                      const local = evento.local || 'Templo Sede';

                      return (
                        <div
                          key={evento.id}
                          onClick={() => onOpenForm?.(evento)}
                          className="group bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-2xl p-3 flex items-center justify-between gap-3 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Ícone com fundo colorido */}
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${visual.iconBg} ${visual.iconColor} shadow-2xs border border-white/60`}
                            >
                              <IconComponent className="w-5 h-5" />
                            </div>

                            {/* Informações */}
                            <div className="min-w-0">
                              <span className="text-[11px] font-semibold text-slate-500 block">
                                {horario}
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug truncate group-hover:text-[#1d4ed8] transition-colors">
                                {evento.titulo}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                                {local}
                              </p>
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legenda de Cores no Rodapé (Exatamente como mockup) */}
      <div className="mt-8 pt-4 border-t border-slate-200">
        <h3 className="text-xs font-bold text-slate-800 mb-3 tracking-tight">
          Legenda de Cores
        </h3>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ea580c] shrink-0" />
            <span>Cultos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e11d48] shrink-0" />
            <span>Congressos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shrink-0" />
            <span>Reuniões</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308] shrink-0" />
            <span>Eventos Especiais</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#9333ea] shrink-0" />
            <span>Escola Bíblica</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#64748b] shrink-0" />
            <span>Outros</span>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] shrink-0" />
            <span>Departamentos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
