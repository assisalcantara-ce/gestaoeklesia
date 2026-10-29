'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Search, X, Star, AlertCircle } from 'lucide-react';
import { AgendaEventoComEscala, MinistroRodizio } from '@/hooks/secretaria/useEscalaPregadores';

interface ModalSubstituirPregadorProps {
  aberto: boolean;
  evento: AgendaEventoComEscala | null;
  ministros: MinistroRodizio[];
  loadingMinistros: boolean;
  onBuscarMinistros: (termo: string) => void;
  onConfirmar: (dados: {
    escala_id: string;
    novo_member_id: string;
    motivo_alteracao: string;
    status: 'escalado' | 'confirmado';
    tema_mensagem?: string;
    texto_biblico?: string;
    observacoes?: string;
  }) => Promise<void>;
  onFechar: () => void;
}

export function ModalSubstituirPregador({
  aberto,
  evento,
  ministros,
  loadingMinistros: _loadingMinistros,
  onBuscarMinistros,
  onConfirmar,
  onFechar,
}: ModalSubstituirPregadorProps) {
  const [busca, setBusca] = useState('');
  const [selectedMinistroId, setSelectedMinistroId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [temaMensagem, setTemaMensagem] = useState('');
  const [textoBiblico, setTextoBiblico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto && evento?.escala_ativa) {
      setBusca('');
      setSelectedMinistroId(null);
      setMotivo('');
      setTemaMensagem(evento.escala_ativa.tema_mensagem || '');
      setTextoBiblico(evento.escala_ativa.texto_biblico || '');
      setObservacoes(evento.escala_ativa.observacoes || '');
      setErro(null);
      onBuscarMinistros('');
    }
  }, [aberto, evento, onBuscarMinistros]);

  if (!aberto || !evento || !evento.escala_ativa) return null;

  const ministroAtual = evento.escala_ativa.member;
  const escalaAtivaId = evento.escala_ativa.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMinistroId) {
      setErro('Selecione o ministro substituto.');
      return;
    }
    if (selectedMinistroId === evento.escala_ativa?.member_id) {
      setErro('Selecione um ministro diferente do atual.');
      return;
    }
    if (!motivo.trim()) {
      setErro('Informe obrigatoriamente o motivo da substituição.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({
        escala_id: escalaAtivaId,
        novo_member_id: selectedMinistroId,
        motivo_alteracao: motivo.trim(),
        status: 'escalado',
        tema_mensagem: temaMensagem ? temaMensagem.trim() : undefined,
        texto_biblico: textoBiblico ? textoBiblico.trim() : undefined,
        observacoes: observacoes ? observacoes.trim() : undefined,
      });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao substituir ministro.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Substituir Pregador</h2>
            <p className="text-xs text-slate-500">
              Culto: {evento.titulo} • Histórico mantido integralmente
            </p>
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

          {/* Comparativo Atual */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center font-bold text-xs text-slate-600 flex-shrink-0">
              {ministroAtual?.name?.charAt(0) || 'M'}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Ministro Atual
              </span>
              <p className="text-sm font-bold text-slate-800 truncate">
                {ministroAtual?.name} ({ministroAtual?.cargo_ministerial || 'Ministro'})
              </p>
            </div>
          </div>

          {/* Motivo Obrigatório */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Motivo da Substituição <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Viagem ministerial, impedimento de saúde, permuta..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Selecionar Novo Ministro */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Selecionar Novo Ministro Substituto
            </label>
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Filtrar ministro..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  onBuscarMinistros(e.target.value);
                }}
                className="w-full text-sm rounded-lg border border-slate-300 pl-9 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
              {ministros
                .filter((m) => m.id !== evento.escala_ativa?.member_id)
                .map((m) => {
                  const isSelected = selectedMinistroId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMinistroId(m.id)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xs text-slate-600">
                          {m.foto_url ? (
                            <Image src={m.foto_url} alt={m.name} fill className="object-cover" unoptimized />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{m.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {m.cargo_ministerial || 'Ministro'} • {m.congregacao_nome || 'Sem congregação'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-700 block">
                          {m.total_escalas} esc.
                        </span>
                        {m.is_menos_escalado && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 justify-end">
                            <Star className="w-2.5 h-2.5 fill-current" /> Menos escalado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
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
              disabled={salvando || !selectedMinistroId || !motivo.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {salvando ? 'Substituindo...' : 'Confirmar Substituição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
