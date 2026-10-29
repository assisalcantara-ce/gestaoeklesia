'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { AgendaEventoComEscala } from '@/hooks/secretaria/useEscalaPregadores';
import { formatHoraLocal, getLocalDateStr } from '@/lib/timezone-utils';

interface ModalRemanejarPregadorProps {
  aberto: boolean;
  eventoOrigem: AgendaEventoComEscala | null;
  todosEventos: AgendaEventoComEscala[];
  onConfirmar: (dados: {
    escala_id: string;
    novo_agenda_evento_id: string;
    motivo_alteracao: string;
  }) => Promise<void>;
  onFechar: () => void;
}

export function ModalRemanejarPregador({
  aberto,
  eventoOrigem,
  todosEventos,
  onConfirmar,
  onFechar,
}: ModalRemanejarPregadorProps) {
  const [novoEventoId, setNovoEventoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setNovoEventoId('');
      setMotivo('');
      setErro(null);
    }
  }, [aberto]);

  if (!aberto || !eventoOrigem || !eventoOrigem.escala_ativa) return null;

  const ministro = eventoOrigem.escala_ativa.member;

  // Filtrar eventos de destino disponíveis (excluindo o atual e que não tenham pregador ativo)
  const eventosDestino = todosEventos.filter(
    (e) => e.id !== eventoOrigem.id && !e.escala_ativa
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoEventoId) {
      setErro('Selecione o culto de destino na agenda.');
      return;
    }
    if (!motivo.trim()) {
      setErro('Informe obrigatoriamente a justificativa para o remanejamento.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({
        escala_id: eventoOrigem.escala_ativa!.id,
        novo_agenda_evento_id: novoEventoId,
        motivo_alteracao: motivo.trim(),
      });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao remanejar ministro.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Remanejar Ministro</h2>
            <p className="text-xs text-slate-500">Transferir pregador para outro culto existente</p>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Origem */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Origem Atual
            </span>
            <p className="text-sm font-bold text-slate-900">{ministro?.name}</p>
            <p className="text-xs text-slate-600">
              {eventoOrigem.titulo} • {getLocalDateStr(eventoOrigem.data_inicio)} às {formatHoraLocal(eventoOrigem.data_inicio)}
            </p>
          </div>

          {/* Selecionar Destino */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Culto de Destino na Agenda Oficial <span className="text-red-500">*</span>
            </label>
            {eventosDestino.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                Não há outros cultos vagos (sem pregador) carregados no período atual para receber este remanejamento.
              </div>
            ) : (
              <select
                value={novoEventoId}
                onChange={(e) => setNovoEventoId(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              >
                <option value="">Selecione o culto de destino...</option>
                {eventosDestino.map((e) => (
                  <option key={e.id} value={e.id}>
                    {getLocalDateStr(e.data_inicio)} {formatHoraLocal(e.data_inicio)} — {e.titulo} (
                    {e.congregacoes?.nome || 'Campo Geral'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Justificativa do Remanejamento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Necessidade pastoral na congregação destino..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Rodapé */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !novoEventoId || !motivo.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {salvando ? 'Remanejando...' : 'Confirmar Remanejamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
