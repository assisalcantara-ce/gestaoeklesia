'use client';

import Image from 'next/image';
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  UserPlus,
  ArrowRightLeft,
  XCircle,
  History,
  BookOpen,
  Church,
  AlertCircle,
} from 'lucide-react';
import { AgendaEventoComEscala } from '@/hooks/secretaria/useEscalaPregadores';
import { formatHoraLocal, getLocalDateStr } from '@/lib/timezone-utils';

interface EscalaEventosTableProps {
  eventos: AgendaEventoComEscala[];
  loading: boolean;
  onAtribuir: (evento: AgendaEventoComEscala) => void;
  onSubstituir: (evento: AgendaEventoComEscala) => void;
  onRemanejar: (evento: AgendaEventoComEscala) => void;
  onDesfazer: (evento: AgendaEventoComEscala) => void;
  onVerHistorico: (evento: AgendaEventoComEscala) => void;
}

export function EscalaEventosTable({
  eventos,
  loading,
  onAtribuir,
  onSubstituir,
  onRemanejar,
  onDesfazer,
  onVerHistorico,
}: EscalaEventosTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3" />
        <p className="text-sm font-medium text-slate-600">Carregando cultos da Agenda Oficial...</p>
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">Nenhum evento encontrado</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Nenhum culto ou evento foi encontrado com os filtros selecionados. A Escala de Pregadores vincula-se
          estritamente aos eventos já cadastrados na Agenda Oficial.
        </p>
      </div>
    );
  }

  const formatarDataCabecalho = (isoString: string) => {
    const dataStr = getLocalDateStr(isoString);
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia));
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dataObj);
  };

  return (
    <div className="space-y-4">
      {eventos.map((evento) => {
        const horaInicio = formatHoraLocal(evento.data_inicio);
        const horaFim = formatHoraLocal(evento.data_fim);
        const escala = evento.escala_ativa;
        const temPregador = Boolean(escala && escala.member);
        const ministro = escala?.member;

        return (
          <div
            key={evento.id}
            className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md ${
              temPregador ? 'border-slate-200' : 'border-amber-200 bg-amber-50/10'
            }`}
          >
            <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Informações do Culto / Evento Oficial */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Calendar className="w-3 h-3" />
                    {formatarDataCabecalho(evento.data_inicio)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {horaInicio} {horaFim ? `às ${horaFim}` : ''}
                  </span>
                  {evento.congregacoes && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      <Church className="w-3 h-3" />
                      {evento.congregacoes.nome} {evento.congregacoes.is_sede ? '(Sede)' : ''}
                    </span>
                  )}
                  {evento.agenda_tipos && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${evento.agenda_tipos.cor || '#3b82f6'}15`,
                        color: evento.agenda_tipos.cor || '#3b82f6',
                      }}
                    >
                      {evento.agenda_tipos.nome}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 truncate">{evento.titulo}</h3>

                {evento.local && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {evento.local}
                  </p>
                )}
              </div>

              {/* Bloco do Pregador Escalado */}
              <div className="flex-1 min-w-[280px] p-3 rounded-lg bg-slate-50 border border-slate-100">
                {temPregador && ministro ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-500 font-bold text-sm">
                        {ministro.foto_url ? (
                          <Image
                            src={ministro.foto_url}
                            alt={ministro.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          ministro.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-900 truncate">{ministro.name}</p>
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Escalado
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {ministro.cargo_ministerial || 'Ministro'} • Matrícula {ministro.matricula || '—'}
                        </p>
                        {escala?.tema_mensagem && (
                          <p className="text-xs text-blue-700 flex items-center gap-1 mt-0.5 truncate">
                            <BookOpen className="w-3 h-3 text-blue-500" />
                            {escala.tema_mensagem}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">Sem pregador escalado</p>
                      <p className="text-[11px] text-amber-700">
                        Clique em &quot;Escalar&quot; para vincular um ministro ativo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {!temPregador ? (
                  <button
                    type="button"
                    onClick={() => onAtribuir(evento)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Escalar Pregador</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSubstituir(evento)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors"
                      title="Substituir por outro ministro"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Substituir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemanejar(evento)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors"
                      title="Transferir pregador para outro culto da agenda"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Remanejar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDesfazer(evento)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                      title="Cancelar designação de pregador neste culto"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>Desfazer</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => onVerHistorico(evento)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Ver histórico de alterações"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
