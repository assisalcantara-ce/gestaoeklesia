'use client';

import DashboardSection from '@/components/dashboard/DashboardSection';
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState';
import { AgendaEvento } from './AgendaCalendar';
import { CalendarRange, Calendar as CalendarIcon, Plus, Pencil, Trash2, TrendingUp, Clock } from 'lucide-react';

interface AgendaTimelineProps {
  mode: 'sidebar' | 'full';
  selectedDate?: string | null;
  loading?: boolean;
  eventosColunaDireita?: AgendaEvento[];
  proximosEventos?: AgendaEvento[];
  isEscritaPermitida?: boolean;
  daysLeftInMonth?: number;
  MESES_PT?: string[];
  getEscopoLabel?: (escopoVal: string) => string;
  onClearSelectedDate?: () => void;
  onOpenForm?: (evento: AgendaEvento | null) => void;
  onDeleteEvento?: (evento: AgendaEvento) => void;
}

export default function AgendaTimeline({
  mode,
  selectedDate,
  loading = false,
  eventosColunaDireita = [],
  proximosEventos = [],
  isEscritaPermitida = false,
  daysLeftInMonth = 0,
  MESES_PT = [],
  getEscopoLabel = (val) => val,
  onClearSelectedDate,
  onOpenForm,
  onDeleteEvento,
}: AgendaTimelineProps) {
  if (mode === 'sidebar') {
    return (
      <div className="space-y-4">
        <DashboardSection
          title={selectedDate ? `Eventos de ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Compromissos do Mês'}
          icon={CalendarRange}
          iconClassName="text-slate-400"
          className="!p-5"
          actions={
            selectedDate ? (
              <button onClick={onClearSelectedDate} className="text-[10px] text-blue-600 hover:text-blue-700 font-extrabold hover:underline">
                Ver todos
              </button>
            ) : undefined
          }
        >
          {loading ? (
            <div className="text-xs text-slate-400 text-center py-10">Carregando eventos...</div>
          ) : eventosColunaDireita.length === 0 ? (
            <DashboardEmptyState
              icon={CalendarIcon}
              title="Nenhum compromisso agendado"
              description="Você não possui eventos ou reuniões registradas para o período visualizado. Que tal criar o primeiro?"
              action={
                isEscritaPermitida && onOpenForm
                  ? {
                      label: 'Novo Compromisso',
                      onClick: () => onOpenForm(null),
                      icon: Plus,
                    }
                  : undefined
              }
              extra={
                <p className="text-[11px] text-slate-500 font-semibold">
                  Faltam {daysLeftInMonth} dias para o encerramento do mês de {MESES_PT[new Date().getMonth()]}
                </p>
              }
            />
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
              {eventosColunaDireita.map(evt => {
                const dateObj = new Date(evt.data_inicio);
                const hora = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const diaNum = dateObj.getDate();
                const mesAbrev = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

                return (
                  <div
                    key={evt.id}
                    className={`flex gap-3.5 p-3 rounded-xl border bg-white hover:bg-slate-50/30 shadow-xs hover:shadow-md transition-all duration-300 hover:translate-y-[-1px] group relative ${
                      evt.calendario_oficial ? 'border-indigo-100 hover:border-indigo-200 border-l-4 border-l-indigo-500' :
                      evt.bloqueado ? 'border-rose-100 hover:border-rose-200 border-l-4 border-l-rose-500' : 
                      'border-emerald-100 hover:border-emerald-200 border-l-4 border-l-emerald-500'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 ${
                      evt.calendario_oficial ? 'bg-gradient-to-b from-indigo-50 to-white border-indigo-250/70' :
                      evt.bloqueado ? 'bg-gradient-to-b from-rose-50 to-white border-rose-250/70' :
                      'bg-gradient-to-b from-emerald-50 to-white border-emerald-250/70'
                    }`}>
                      <span className={`text-[8px] font-black leading-none tracking-wider ${
                        evt.calendario_oficial ? 'text-indigo-600' :
                        evt.bloqueado ? 'text-rose-600' :
                        'text-emerald-600'
                      }`}>{mesAbrev}</span>
                      <span className="text-base font-black text-slate-850 leading-none mt-0.5">{diaNum}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-200/50 px-1.5 py-0.2 rounded">{hora}</span>
                        {evt.local && <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[120px]">· {evt.local}</span>}
                      </div>
                      <p className="text-xs font-black text-slate-800 truncate leading-snug">{evt.titulo}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {evt.calendario_oficial && (
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-bold shadow-2xs">Oficial</span>
                        )}
                        {evt.bloqueado && (
                          <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full font-bold shadow-2xs">Bloqueado</span>
                        )}
                        <span className="text-[9px] bg-slate-50 text-slate-600 border border-slate-200/60 px-2 py-0.5 rounded-full font-bold shadow-2xs">{getEscopoLabel(evt.escopo)}</span>
                      </div>
                    </div>

                    {isEscritaPermitida && !evt.bloqueado && onOpenForm && onDeleteEvento && (
                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 shrink-0 self-center transition-all duration-200 bg-white/90 backdrop-blur-xs pl-2">
                        <button
                          onClick={() => onOpenForm(evt)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all duration-200 shadow-2xs hover:shadow-xs"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteEvento(evt)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all duration-200 shadow-2xs hover:shadow-xs"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Linha do Tempo"
          icon={TrendingUp}
          iconClassName="text-slate-400"
          className="!p-5"
        >
          {proximosEventos.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <CalendarIcon className="h-8 w-8 text-slate-200" />
              <span className="font-semibold text-slate-500">Nenhum compromisso.</span>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-100 ml-4 pl-4 space-y-4 py-1">
              {proximosEventos.map(evt => {
                const d = new Date(evt.data_inicio);
                const isOficial = evt.calendario_oficial;
                const isBlocked = evt.bloqueado;

                let bulletColor = 'bg-emerald-500 ring-emerald-100';
                if (isOficial) bulletColor = 'bg-indigo-500 ring-indigo-100';
                else if (isBlocked) bulletColor = 'bg-rose-500 ring-rose-100';

                return (
                  <div key={evt.id} className="relative group transition-all duration-200">
                    <span className={`absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ring-4 transition ${bulletColor}`} />
                    <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl p-2.5 transition">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <h4 className="font-black text-slate-800 text-xs mt-1 truncate">{evt.titulo}</h4>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>
      </div>
    );
  }

  return (
    <DashboardSection
      title="Linha do Tempo Ministerial"
      icon={TrendingUp}
      className="flex-1 min-w-0"
    >
      {proximosEventos.length === 0 ? (
        <DashboardEmptyState
          icon={TrendingUp}
          title="Linha do tempo livre"
          description="Seus próximos dias estão livres de atividades oficiais ou locais agendadas."
          action={
            isEscritaPermitida && onOpenForm
              ? {
                  label: 'Registrar Evento',
                  onClick: () => onOpenForm(null),
                  icon: Plus,
                }
              : undefined
          }
        />
      ) : (
        <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-5 py-2">
          {proximosEventos.map(evt => {
            const d = new Date(evt.data_inicio);
            const isOficial = evt.calendario_oficial;
            const isBlocked = evt.bloqueado;

            let bulletColor = 'bg-emerald-500 ring-emerald-100';
            if (isOficial) bulletColor = 'bg-indigo-500 ring-indigo-100';
            else if (isBlocked) bulletColor = 'bg-rose-500 ring-rose-100';

            return (
              <div key={evt.id} className="relative group transition-all duration-200">
                <span className={`absolute -left-[30px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ring-4 transition ${bulletColor}`} />
                
                <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl p-3 max-w-2xl transition">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {evt.local && (
                      <>
                        <span>•</span>
                        <span className="text-slate-500">{evt.local}</span>
                      </>
                    )}
                  </div>
                  <h4 className="font-black text-slate-850 text-sm mt-1">{evt.titulo}</h4>
                  {evt.descricao && (
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">{evt.descricao}</p>
                  )}
                  
                  <div className="flex gap-1.5 mt-2">
                    {isOficial && (
                      <span className="text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-full font-bold">Oficial</span>
                    )}
                    {isBlocked && (
                      <span className="text-[8px] bg-rose-50 text-rose-700 border border-rose-150 px-2 py-0.5 rounded-full font-bold">Sincronizado</span>
                    )}
                    <span className="text-[8px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{getEscopoLabel(evt.escopo)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardSection>
  );
}
