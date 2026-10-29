'use client';

import { X, History, UserCheck, XCircle, ArrowRightLeft } from 'lucide-react';
import { AgendaEventoComEscala, HistoricoEscalaItem } from '@/hooks/secretaria/useEscalaPregadores';
import { formatHoraLocal, getLocalDateStr } from '@/lib/timezone-utils';

interface ModalHistoricoEscalaProps {
  aberto: boolean;
  evento: AgendaEventoComEscala | null;
  historico: HistoricoEscalaItem[];
  loading: boolean;
  onFechar: () => void;
}

export function ModalHistoricoEscala({
  aberto,
  evento,
  historico,
  loading,
  onFechar,
}: ModalHistoricoEscalaProps) {
  if (!aberto || !evento) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Histórico de Alterações da Escala</h2>
              <p className="text-xs text-slate-500">
                {evento.titulo} • {getLocalDateStr(evento.data_inicio)}
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Carregando auditoria...</div>
          ) : historico.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhuma alteração registrada para este evento.
            </div>
          ) : (
            <div className="relative border-l border-slate-200 ml-4 space-y-6">
              {historico.map((item) => {
                const isSubstituido = item.status === 'substituido';
                const isAtivo = ['escalado', 'confirmado'].includes(item.status);

                return (
                  <div key={item.id} className="relative pl-6">
                    {/* Marcador do Timeline */}
                    <div
                      className={`absolute -left-2.5 top-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] ${
                        isAtivo
                          ? 'bg-emerald-500'
                          : isSubstituido
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                    >
                      {isAtivo ? (
                        <UserCheck className="w-3 h-3" />
                      ) : isSubstituido ? (
                        <ArrowRightLeft className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-800">
                          {item.member?.name || 'Ministro'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isAtivo
                              ? 'bg-emerald-100 text-emerald-800'
                              : isSubstituido
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mb-1">
                        {item.member?.cargo_ministerial || 'Ministro'}
                      </p>

                      {item.motivo_alteracao && (
                        <div className="mt-2 text-xs bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700">
                          <strong className="text-slate-900 block text-[11px] mb-0.5">Motivo:</strong>
                          {item.motivo_alteracao}
                        </div>
                      )}

                      {isSubstituido && item.substituido_por_member && (
                        <p className="text-xs text-blue-700 mt-2 font-medium">
                          ↳ Substituído por: <strong>{item.substituido_por_member.name}</strong>
                        </p>
                      )}

                      <div className="mt-2 text-[11px] text-slate-400">
                        Registrado em {getLocalDateStr(item.created_at)} às {formatHoraLocal(item.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50">
          <button
            onClick={onFechar}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
