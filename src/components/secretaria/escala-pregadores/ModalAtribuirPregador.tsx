'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Search, X, Star, AlertCircle } from 'lucide-react';
import { AgendaEventoComEscala, MinistroRodizio } from '@/hooks/secretaria/useEscalaPregadores';
import { formatHoraLocal, getLocalDateStr } from '@/lib/timezone-utils';

interface ModalAtribuirPregadorProps {
  aberto: boolean;
  evento: AgendaEventoComEscala | null;
  ministros: MinistroRodizio[];
  loadingMinistros: boolean;
  onBuscarMinistros: (termo: string) => void;
  onConfirmar: (dados: {
    agenda_evento_id: string;
    member_id: string;
    status: 'escalado' | 'confirmado';
    tema_mensagem?: string;
    texto_biblico?: string;
    observacoes?: string;
  }) => Promise<void>;
  onFechar: () => void;
}

export function ModalAtribuirPregador({
  aberto,
  evento,
  ministros,
  loadingMinistros,
  onBuscarMinistros,
  onConfirmar,
  onFechar,
}: ModalAtribuirPregadorProps) {
  const [busca, setBusca] = useState('');
  const [selectedMinistroId, setSelectedMinistroId] = useState<string | null>(null);
  const [temaMensagem, setTemaMensagem] = useState('');
  const [textoBiblico, setTextoBiblico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setBusca('');
      setSelectedMinistroId(null);
      setTemaMensagem('');
      setTextoBiblico('');
      setObservacoes('');
      setErro(null);
      onBuscarMinistros('');
    }
  }, [aberto, onBuscarMinistros]);

  if (!aberto || !evento) return null;

  const dataFormatada = getLocalDateStr(evento.data_inicio);
  const horaInicio = formatHoraLocal(evento.data_inicio);
  const horaFim = formatHoraLocal(evento.data_fim);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMinistroId) {
      setErro('Selecione um ministro para a escala.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({
        agenda_evento_id: evento.id,
        member_id: selectedMinistroId,
        status: 'escalado',
        tema_mensagem: temaMensagem ? temaMensagem.trim() : undefined,
        texto_biblico: textoBiblico ? textoBiblico.trim() : undefined,
        observacoes: observacoes ? observacoes.trim() : undefined,
      });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao atribuir pregador.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Escalar Pregador Oficial</h2>
            <p className="text-xs text-slate-500">
              {evento.titulo} • {dataFormatada} às {horaInicio} {horaFim ? `(${horaFim})` : ''}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Campo de Busca de Ministros */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Buscar Ministro Ativo (Rodízio Ministerial)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por nome, cargo ou congregação..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  onBuscarMinistros(e.target.value);
                }}
                className="w-full text-sm rounded-lg border border-slate-300 pl-9 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Lista com Indicadores de Rodízio */}
          <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
            {loadingMinistros ? (
              <div className="p-6 text-center text-xs text-slate-500">Buscando ministros ativos...</div>
            ) : ministros.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Nenhum ministro com status ministerial ativo encontrado.
              </div>
            ) : (
              ministros.map((m) => {
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
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-9 h-9 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xs text-slate-600">
                        {m.foto_url ? (
                          <Image src={m.foto_url} alt={m.name} fill className="object-cover" unoptimized />
                        ) : (
                          m.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
                          {m.is_menos_escalado && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              <Star className="w-2.5 h-2.5 fill-current" /> Menos Escalado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {m.cargo_ministerial || 'Ministro'} • {m.congregacao_nome || 'Sem congregação'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 pl-2">
                      <span className="text-xs font-semibold text-slate-700 block">
                        {m.total_escalas} {m.total_escalas === 1 ? 'escala' : 'escalas'}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {m.ultima_escala_em ? `Última: ${m.ultima_escala_em}` : 'Nunca escalado'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Dados Adicionais da Homilética */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tema da Mensagem (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: A Fidelidade de Deus"
                value={temaMensagem}
                onChange={(e) => setTemaMensagem(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Texto Bíblico Base (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Salmos 23:1-6"
                value={textoBiblico}
                onChange={(e) => setTextoBiblico(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações Pastorais (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Instruções específicas para o pregador escalado..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Rodapé com Botões */}
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
              disabled={salvando || !selectedMinistroId}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Confirmar Escala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
