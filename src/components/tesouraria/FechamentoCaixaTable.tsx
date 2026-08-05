'use client';

import { useState, useMemo } from 'react';
import { Search, Lock, Printer, History, CheckCircle, X } from 'lucide-react';

export interface FechamentoCaixaTableProps {
  congregacoes: Array<{ id: string; nome: string; is_sede?: boolean }>;
  fechamentos: Array<{
    id: string;
    mes_referencia: string;
    saldo_inicial: number;
    entradas: number;
    saidas: number;
    saldo_final: number;
    status: string;
    congregacao_id?: string | null;
    created_at?: string;
    observacoes?: string;
    data_fim?: string;
  }>;
  filtroMes: string;
  fmtBRL: (val: number) => string;
  onAbrirModalFechamento: (congId: string) => void;
  onImprimirFechamento: (fechamento: any, congNome: string) => void;
}

export default function FechamentoCaixaTable({
  congregacoes,
  fechamentos,
  filtroMes,
  fmtBRL,
  onAbrirModalFechamento,
  onImprimirFechamento,
}: FechamentoCaixaTableProps) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'' | 'aberto' | 'fechado'>('');
  const [historicoModalCong, setHistoricoModalCong] = useState<{ id: string; nome: string } | null>(null);

  // Mapear último fechamento por congregação
  const statusCongregacoes = useMemo(() => {
    return congregacoes.map((c) => {
      // Fechamento no mês atual selecionado
      const fechoMes = fechamentos.find(
        (f) => (f.congregacao_id === c.id || (f as any).cong_id === c.id) && f.mes_referencia === filtroMes
      );

      // Último fechamento histórico dessa congregação
      const ultFechamento = fechamentos
        .filter((f) => f.congregacao_id === c.id || (f as any).cong_id === c.id)
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())[0];

      const isFechado = fechoMes?.status === 'fechado' || !!fechoMes;

      return {
        id: c.id,
        nome: c.nome,
        isSede: c.is_sede,
        isFechado,
        fechoMes,
        ultFechamento,
      };
    });
  }, [congregacoes, fechamentos, filtroMes]);

  // Filtragem da lista
  const listaFiltrada = useMemo(() => {
    return statusCongregacoes.filter((item) => {
      if (busca && !item.nome.toLowerCase().includes(busca.toLowerCase())) {
        return false;
      }
      if (filtroStatus === 'aberto' && item.isFechado) return false;
      if (filtroStatus === 'fechado' && !item.isFechado) return false;
      return true;
    });
  }, [statusCongregacoes, busca, filtroStatus]);

  // Histórico da congregação selecionada no modal
  const historicoCong = useMemo(() => {
    if (!historicoModalCong) return [];
    return fechamentos
      .filter((f) => f.congregacao_id === historicoModalCong.id || (f as any).cong_id === historicoModalCong.id)
      .sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia));
  }, [historicoModalCong, fechamentos]);

  return (
    <div className="space-y-4">
      {/* Barra de Busca e Filtros de Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar unidade / congregação..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#123b63]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs h-[36px]">
            {[
              { v: '' as const, label: 'Todas' },
              { v: 'aberto' as const, label: 'Abertos' },
              { v: 'fechado' as const, label: 'Fechados' },
            ].map((st) => (
              <button
                key={st.v}
                type="button"
                onClick={() => setFiltroStatus(st.v)}
                className={`px-3 font-medium transition ${
                  filtroStatus === st.v
                    ? 'bg-[#123b63] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-400 hidden md:inline ml-2">
            {listaFiltrada.length} de {congregacoes.length} unidades
          </span>
        </div>
      </div>

      {/* Tabela de Unidades */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Unidade / Congregação</th>
                <th className="py-3 px-4">Status ({filtroMes})</th>
                <th className="py-3 px-4">Último Fechamento</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                    Nenhuma congregação encontrada para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                listaFiltrada.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    {/* Coluna 1: Nome da Congregação */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-800 flex items-center gap-2">
                        {item.nome}
                        {item.isSede && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                            Sede
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Unidade Local</p>
                    </td>

                    {/* Coluna 2: Status do Mês Selecionado */}
                    <td className="py-3 px-4">
                      {item.isFechado ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                          <Lock className="h-3 w-3" /> Fechado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-800 bg-green-100 px-2.5 py-1 rounded-full">
                          <CheckCircle className="h-3 w-3" /> Aberto
                        </span>
                      )}
                    </td>

                    {/* Coluna 3: Histórico do Último Fechamento */}
                    <td className="py-3 px-4 text-xs">
                      {item.ultFechamento ? (
                        <div>
                          <p className="font-semibold text-gray-700">
                            {item.ultFechamento.mes_referencia}
                          </p>
                          <p className="text-gray-400">
                            Saldo Final: <span className="font-semibold text-[#123b63]">{fmtBRL(item.ultFechamento.saldo_final)}</span>
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Sem fechamento anterior</span>
                      )}
                    </td>

                    {/* Coluna 4: Botões de Ações */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Botão Fechar Caixa */}
                        <button
                          onClick={() => onAbrirModalFechamento(item.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#0f2a45] transition"
                          title="Realizar Fechamento do Caixa"
                        >
                          <Lock className="h-3.5 w-3.5" /> Fechar
                        </button>

                        {/* Botão Imprimir (se houver fechamento) */}
                        {item.ultFechamento && (
                          <button
                            onClick={() => onImprimirFechamento(item.ultFechamento, item.nome)}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium transition"
                            title="Imprimir Relatório de Fechamento"
                          >
                            <Printer className="h-3.5 w-3.5" /> Imprimir
                          </button>
                        )}

                        {/* Botão Ver Histórico Completo */}
                        <button
                          onClick={() => setHistoricoModalCong({ id: item.id, nome: item.nome })}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-gray-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition"
                          title="Ver Histórico de Fechamentos"
                        >
                          <History className="h-3.5 w-3.5 text-gray-500" /> Histórico
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Gaveta de Histórico de Fechamentos por Congregação */}
      {historicoModalCong && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3 border-gray-100">
              <div>
                <h3 className="text-base font-bold text-[#123b63]">Histórico de Fechamentos</h3>
                <p className="text-xs text-gray-500">{historicoModalCong.nome}</p>
              </div>
              <button onClick={() => setHistoricoModalCong(null)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              {historicoCong.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  Nenhum fechamento registrado anteriormente para esta congregação.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase">
                      <th className="py-2.5 px-3">Mês/Ano</th>
                      <th className="py-2.5 px-3">Saldo Inicial</th>
                      <th className="py-2.5 px-3">Entradas</th>
                      <th className="py-2.5 px-3">Saídas</th>
                      <th className="py-2.5 px-3 text-right">Saldo Final</th>
                      <th className="py-2.5 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historicoCong.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-bold text-gray-800">{h.mes_referencia}</td>
                        <td className="py-2.5 px-3 text-gray-500">{fmtBRL(h.saldo_inicial)}</td>
                        <td className="py-2.5 px-3 text-green-600 font-medium">+{fmtBRL(h.entradas)}</td>
                        <td className="py-2.5 px-3 text-red-500 font-medium">-{fmtBRL(h.saidas)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#123b63]">
                          {fmtBRL(h.saldo_final)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onImprimirFechamento(h, historicoModalCong.nome)}
                            className="p-1 text-gray-600 hover:text-[#123b63] transition"
                            title="Imprimir comprovante"
                          >
                            <Printer className="h-4 w-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
