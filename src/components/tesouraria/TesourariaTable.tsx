'use client';

import { useState, useMemo, useEffect } from 'react';
import { Pencil, Trash2, QrCode, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { FinConta, FinCategoria } from '@/hooks/tesouraria/useTesouraria';
import LancamentoDetalhesModal from '@/components/tesouraria/modals/LancamentoDetalhesModal';

export interface TesourariaTableProps {
  lancsFiltrados: any[];
  fmtDate: (dateStr: string) => string;
  fmtBRL: (val: number) => string;
  TIPOS_SAIDA: Array<{ value: string; label: string; cor?: string }>;
  tipoCor: (tipo: string) => string;
  tipoLabel: (tipo: string) => string;
  totalFiltrado: number;
  scope: {
    canWrite?: boolean;
    canDelete?: boolean;
  };
  handleEdit?: (item: any) => void;
  setConfirmDel?: (id: string) => void;
  finContas?: FinConta[];
  finCategorias?: FinCategoria[];
  mostrarCategoria?: boolean;
}

export default function TesourariaTable({
  lancsFiltrados,
  fmtDate,
  fmtBRL,
  TIPOS_SAIDA,
  tipoCor,
  tipoLabel,
  totalFiltrado,
  scope,
  handleEdit,
  setConfirmDel,
  finContas = [],
  finCategorias = [],
  mostrarCategoria = true,
}: TesourariaTableProps) {
  const [selectedLanc, setSelectedLanc] = useState<any | null>(null);
  const [chargeDetails, setChargeDetails] = useState<any | null>(null);
  const [sortColumn, setSortColumn] = useState<'' | 'categoria' | 'tipo' | 'valor'>('');

  // ── Paginação ─────────────────────────────────────────────────────────────
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Resetar para página 1 ao alterar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [lancsFiltrados]);

  const getCategoriaNome = (l: any) => {
    if (mostrarCategoria) {
      const cat = finCategorias.find((c) => c.id === l.categoria_id);
      if (cat?.nome) return cat.nome;
      if (l.categoria_nome) return l.categoria_nome;
    }
    return l.departamento_nome || '';
  };

  const getTipoNome = (l: any) => {
    if (l.tipo_movimento === 'saida') {
      return TIPOS_SAIDA.find((t) => t.value === l.tipo_recebimento)?.label || l.tipo_recebimento || '';
    }
    return tipoLabel(l.tipo_recebimento) || '';
  };

  const sortedLancs = useMemo(() => {
    if (!sortColumn) return lancsFiltrados;
    return [...lancsFiltrados].sort((a, b) => {
      if (sortColumn === 'categoria') {
        const catA = getCategoriaNome(a);
        const catB = getCategoriaNome(b);
        return catA.localeCompare(catB, 'pt-BR', { sensitivity: 'base' });
      }
      if (sortColumn === 'tipo') {
        const tipoA = getTipoNome(a);
        const tipoB = getTipoNome(b);
        return tipoA.localeCompare(tipoB, 'pt-BR', { sensitivity: 'base' });
      }
      if (sortColumn === 'valor') {
        const valA = Number(a.valor) || 0;
        const valB = Number(b.valor) || 0;
        return valA - valB;
      }
      return 0;
    });
  }, [lancsFiltrados, sortColumn, finCategorias, mostrarCategoria, TIPOS_SAIDA, tipoLabel]);

  // Cálculos de paginação
  const totalRecords = sortedLancs.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  const paginatedLancs = useMemo(() => {
    return sortedLancs.slice(startIndex, endIndex);
  }, [sortedLancs, startIndex, endIndex]);

  // Abrir modal de detalhes e buscar enriquecimento em fin_payment_charges se necessário
  const handleOpenDetails = async (lanc: any) => {
    setSelectedLanc(lanc);
    setChargeDetails(null);

    if (lanc.origem_id) {
      try {
        const { createClient } = await import('@/lib/supabase-client');
        const supabase = createClient();
        const { data } = await supabase
          .from('fin_payment_charges')
          .select(`
            id, gateway_charge_id, status, paid_at, created_at, valor_pago,
            fin_payment_destinations (
              label, tipo_recebimento, congregacoes (nome)
            )
          `)
          .eq('id', lanc.origem_id)
          .maybeSingle();

        if (data) {
          setChargeDetails(data);
        }
      } catch {
        // Se falhar o fetch adicional, os dados principais do lançamento continuam sendo exibidos
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
      {sortedLancs.length === 0 ? (
        <div className="text-center py-16 px-4">
          <p className="text-slate-400 text-sm font-medium">Nenhum lançamento encontrado para os filtros aplicados.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Barra de Título / Cabeçalho Destacado */}
              <thead className="bg-slate-100/95 border-b-2 border-slate-300">
                <tr>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                    Data
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                    Caixa / Congregação
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={sortColumn === 'categoria'}
                        onChange={() => setSortColumn(sortColumn === 'categoria' ? '' : 'categoria')}
                        className="w-3.5 h-3.5 text-[#123b63] rounded border-slate-300 focus:ring-[#123b63] cursor-pointer"
                        title="Classificar de A a Z (crescente)"
                      />
                      <span className={`group-hover:text-[#123b63] transition ${sortColumn === 'categoria' ? 'text-[#123b63] font-extrabold' : ''}`}>
                        {mostrarCategoria ? 'Categoria Financeira' : 'Departamento'}
                      </span>
                      {sortColumn === 'categoria' && (
                        <span className="text-[10px] font-bold text-[#123b63] bg-blue-100 border border-blue-200 px-1 rounded">
                          A-Z
                        </span>
                      )}
                    </label>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={sortColumn === 'tipo'}
                        onChange={() => setSortColumn(sortColumn === 'tipo' ? '' : 'tipo')}
                        className="w-3.5 h-3.5 text-[#123b63] rounded border-slate-300 focus:ring-[#123b63] cursor-pointer"
                        title="Classificar de A a Z (crescente)"
                      />
                      <span className={`group-hover:text-[#123b63] transition ${sortColumn === 'tipo' ? 'text-[#123b63] font-extrabold' : ''}`}>
                        Tipo
                      </span>
                      {sortColumn === 'tipo' && (
                        <span className="text-[10px] font-bold text-[#123b63] bg-blue-100 border border-blue-200 px-1 rounded">
                          A-Z
                        </span>
                      )}
                    </label>
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                    Descrição / Ref.
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-700">
                    <div className="flex justify-end">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={sortColumn === 'valor'}
                          onChange={() => setSortColumn(sortColumn === 'valor' ? '' : 'valor')}
                          className="w-3.5 h-3.5 text-[#123b63] rounded border-slate-300 focus:ring-[#123b63] cursor-pointer"
                          title="Classificar por Valor crescente (menor para maior)"
                        />
                        <span className={`group-hover:text-[#123b63] transition ${sortColumn === 'valor' ? 'text-[#123b63] font-extrabold' : ''}`}>
                          Valor
                        </span>
                        {sortColumn === 'valor' && (
                          <span className="text-[10px] font-bold text-[#123b63] bg-blue-100 border border-blue-200 px-1 rounded">
                            0-9
                          </span>
                        )}
                      </label>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLancs.map((l) => {
                  const isDigitalPix = l.origem_modulo === 'gateway' || l.forma_pagamento === 'pix';

                  return (
                    <tr
                      key={l.id}
                      className={`hover:bg-slate-50 transition ${l.tipo_movimento === 'saida' ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-medium">
                        {fmtDate(l.data_lancamento)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{l.congregacao_nome}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {mostrarCategoria ? (
                          (() => {
                            const cat = finCategorias.find((c) => c.id === l.categoria_id);
                            if (cat) {
                              return (
                                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                  {cat.icone && <span>{cat.icone}</span>}
                                  <span>{cat.nome}</span>
                                </span>
                              );
                            }
                            return l.categoria_nome || '—';
                          })()
                        ) : (
                          l.departamento_nome || '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold w-fit ${
                              l.tipo_movimento === 'saida'
                                ? TIPOS_SAIDA.find((t) => t.value === l.tipo_recebimento)?.cor ?? 'bg-red-100 text-red-800'
                                : tipoCor(l.tipo_recebimento)
                            }`}
                          >
                            {l.tipo_movimento === 'saida'
                              ? TIPOS_SAIDA.find((t) => t.value === l.tipo_recebimento)?.label ?? l.tipo_recebimento
                              : tipoLabel(l.tipo_recebimento)}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {l.codigo_registro && (
                              <span
                                className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded"
                                title="Código / ID do Registro"
                              >
                                ID: {l.codigo_registro}
                              </span>
                            )}
                            <span
                              className={`text-xs font-semibold ${
                                l.tipo_movimento === 'saida' ? 'text-red-500' : 'text-green-600'
                              }`}
                            >
                              {l.tipo_movimento === 'saida' ? '↓ Saída' : '↑ Entrada'}
                            </span>
                            {isDigitalPix && (
                              <button
                                type="button"
                                onClick={() => handleOpenDetails(l)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#123b63]/10 text-[#123b63] border border-[#123b63]/20 px-2 py-0.5 rounded-full hover:bg-[#123b63]/20 transition"
                                title="Clique para ver detalhes do recebimento PIX"
                              >
                                <QrCode className="h-3 w-3" /> Arrecadação Digital PIX
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                        {l.referencia || l.observacoes || l.descricao || '—'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold whitespace-nowrap ${
                          l.tipo_movimento === 'saida' ? 'text-red-600' : 'text-[#123b63]'
                        }`}
                      >
                        {l.tipo_movimento === 'saida' ? '- ' : ''}
                        {fmtBRL(Number(l.valor))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botão 1: 👁 Visualizar Detalhes (Sempre visível para leitura segura) */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(l)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#123b63] hover:bg-slate-100 transition cursor-pointer"
                            title="Visualizar Detalhes"
                            aria-label="Visualizar Detalhes do Lançamento"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Botão 2: Editar / Reclassificar (Disponível para todos os lançamentos com permissão de escrita) */}
                          {scope.canWrite && handleEdit && (
                            <button
                              type="button"
                              onClick={() => handleEdit(l)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition cursor-pointer"
                              title="Editar / Reclassificar Lançamento"
                              aria-label="Editar / Reclassificar Lançamento"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          {/* Botão 3: Excluir (Apenas para quem tem permissão e não é PIX imutável) */}
                          {!isDigitalPix && scope.canDelete && setConfirmDel && (
                            <button
                              type="button"
                              onClick={() => setConfirmDel(l.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition cursor-pointer"
                              title="Excluir Lançamento"
                              aria-label="Excluir Lançamento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-600 text-right uppercase tracking-wider">
                    Total do Período Filtrado
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#123b63] text-sm">
                    {fmtBRL(totalFiltrado)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Barra de Paginação */}
          <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Lado Esquerdo: Contadores e seletor de itens por página */}
            <div className="flex items-center flex-wrap gap-3 text-slate-600">
              <span>
                Exibindo <strong className="text-slate-800">{totalRecords === 0 ? 0 : startIndex + 1}</strong> a{' '}
                <strong className="text-slate-800">{endIndex}</strong> de{' '}
                <strong className="text-slate-800">{totalRecords}</strong> registros
              </span>

              <div className="flex items-center gap-1.5">
                <label htmlFor="pageSizeSelect" className="text-slate-500">
                  Exibir:
                </label>
                <select
                  id="pageSizeSelect"
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value, 10);
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#123b63]"
                >
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
                <span className="text-slate-500">por página</span>
              </div>
            </div>

            {/* Lado Direito: Controles de Navegação */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* Primeira Página */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition"
                  title="Primeira Página"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Página Anterior */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition"
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Indicador de Páginas */}
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 5) return true;
                      if (page === 1 || page === totalPages) return true;
                      return Math.abs(page - safeCurrentPage) <= 1;
                    })
                    .map((page, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const hasGap = prevPage && page - prevPage > 1;

                      return (
                        <div key={page} className="flex items-center">
                          {hasGap && <span className="px-1 text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition ${
                              safeCurrentPage === page
                                ? 'bg-[#123b63] text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      );
                    })}
                </div>

                {/* Próxima Página */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition"
                  title="Próxima Página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Última Página */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition"
                  title="Última Página"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Dedicado Somente Leitura de Detalhes do Lançamento */}
      <LancamentoDetalhesModal
        isOpen={Boolean(selectedLanc)}
        lancamento={selectedLanc}
        chargeDetails={chargeDetails}
        finContas={finContas}
        finCategorias={finCategorias}
        onClose={() => {
          setSelectedLanc(null);
          setChargeDetails(null);
        }}
        fmtDate={fmtDate}
        fmtBRL={fmtBRL}
        tipoLabel={tipoLabel}
        tipoCor={tipoCor}
        TIPOS_SAIDA={TIPOS_SAIDA}
      />
    </div>
  );
}

