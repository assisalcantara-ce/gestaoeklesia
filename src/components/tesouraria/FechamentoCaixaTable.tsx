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
    <div className="space-y-5">
      {/* Barra de Busca e Filtros de Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar unidade / congregação..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="flex rounded-xl border border-slate-300 overflow-hidden text-xs h-[38px] p-0.5 bg-slate-50">
            {[
              { v: '' as const, label: 'Todas' },
              { v: 'aberto' as const, label: 'Abertos' },
              { v: 'fechado' as const, label: 'Fechados' },
            ].map((st) => (
              <button
                key={st.v}
                type="button"
                onClick={() => setFiltroStatus(st.v)}
                className={`px-3.5 font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                  filtroStatus === st.v
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold text-slate-500 hidden md:inline ml-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            {listaFiltrada.length} de {congregacoes.length} unidades
          </span>
        </div>
      </div>

      {/* Tabela de Unidades */}
      <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                <th className="py-3.5 px-5">Unidade / Congregação</th>
                <th className="py-3.5 px-5">Status ({filtroMes})</th>
                <th className="py-3.5 px-5">Último Fechamento</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 text-sm font-medium">
                    Nenhuma congregação encontrada para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                listaFiltrada.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    {/* Coluna 1: Nome da Congregação */}
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        {item.nome}
                        {item.isSede && (
                          <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-bold px-2 py-0.5 rounded-full shadow-2xs">
                            Sede
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium">Unidade Local</p>
                    </td>

                    {/* Coluna 2: Status do Mês Selecionado */}
                    <td className="py-3.5 px-5">
                      {item.isFechado ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full shadow-2xs">
                          <Lock className="h-3 w-3 text-amber-700" /> Fechado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-2xs">
                          <CheckCircle className="h-3 w-3 text-emerald-700" /> Aberto
                        </span>
                      )}
                    </td>

                    {/* Coluna 3: Histórico do Último Fechamento */}
                    <td className="py-3.5 px-5 text-xs">
                      {item.ultFechamento ? (
                        <div>
                          <p className="font-bold text-slate-800">
                            {item.ultFechamento.mes_referencia}
                          </p>
                          <p className="text-slate-500 font-medium mt-0.5">
                            Saldo Final:{' '}
                            <span className="font-extrabold text-[#1e3a8a]">
                              {fmtBRL(item.ultFechamento.saldo_final)}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sem fechamento anterior</span>
                      )}
                    </td>

                    {/* Coluna 4: Botões de Ações */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Botão Fechar Caixa */}
                        <button
                          onClick={() => onAbrirModalFechamento(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-xs border border-teal-800 cursor-pointer"
                          title="Realizar Fechamento do Caixa"
                        >
                          <Lock className="h-3.5 w-3.5" /> Fechar
                        </button>

                        {/* Botão Imprimir (se houver fechamento) */}
                        {item.ultFechamento && (
                          <button
                            onClick={() => onImprimirFechamento(item.ultFechamento, item.nome)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                            title="Imprimir Relatório de Fechamento"
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-500" /> Imprimir
                          </button>
                        )}

                        {/* Botão Ver Histórico Completo */}
                        <button
                          onClick={() => setHistoricoModalCong({ id: item.id, nome: item.nome })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                          title="Ver Histórico de Fechamentos"
                        >
                          <History className="h-3.5 w-3.5 text-slate-500" /> Histórico
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
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 w-full max-w-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3.5 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Histórico de Fechamentos</h3>
                  <p className="text-xs text-slate-500 font-medium">{historicoModalCong.nome}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoricoModalCong(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
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
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3.5">Mês/Ano</th>
                      <th className="py-3 px-3.5">Saldo Inicial</th>
                      <th className="py-3 px-3.5">Entradas</th>
                      <th className="py-3 px-3.5">Saídas</th>
                      <th className="py-3 px-3.5 text-right">Saldo Final</th>
                      <th className="py-3 px-3.5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historicoCong.map((h, idx) => (
                      <tr key={h.id} className={`hover:bg-slate-50 transition ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">{h.mes_referencia}</td>
                        <td className="py-2.5 px-3.5 text-slate-500 font-medium">{fmtBRL(h.saldo_inicial)}</td>
                        <td className="py-2.5 px-3.5 text-[#15803d] font-bold">+{fmtBRL(h.entradas)}</td>
                        <td className="py-2.5 px-3.5 text-[#be123c] font-bold">-{fmtBRL(h.saidas)}</td>
                        <td className="py-2.5 px-3.5 text-right font-extrabold text-[#1e3a8a]">
                          {fmtBRL(h.saldo_final)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <button
                            onClick={() => onImprimirFechamento(h, historicoModalCong.nome)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
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
