'use client';

import { useState } from 'react';
import { Pencil, Trash2, QrCode, Eye } from 'lucide-react';
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
      {lancsFiltrados.length === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">Nenhum lançamento no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Caixa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                  {mostrarCategoria ? 'Categoria Financeira' : 'Departamento'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Descrição / Ref.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lancsFiltrados.map((l) => {
                const isDigitalPix = l.origem_modulo === 'gateway' || l.forma_pagamento === 'pix';

                return (
                  <tr
                    key={l.id}
                    className={`hover:bg-slate-50 transition ${l.tipo_movimento === 'saida' ? 'bg-red-50/40' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(l.data_lancamento)}</td>
                    <td className="px-4 py-3 text-gray-700">{l.congregacao_nome}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
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
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded" title="Código / ID do Registro">
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
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                      {l.referencia || l.observacoes || l.descricao || '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
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
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#123b63] hover:bg-slate-100 transition"
                          title="👁 Visualizar Detalhes"
                          aria-label="Visualizar Detalhes do Lançamento"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Botão 2: Editar (Apenas para quem tem permissão e não é PIX imutável) */}
                        {!isDigitalPix && scope.canWrite && handleEdit && (
                          <button
                            type="button"
                            onClick={() => handleEdit(l)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                            title="Editar Lançamento"
                            aria-label="Editar Lançamento"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        {/* Botão 3: Excluir (Apenas para quem tem permissão e não é PIX imutável) */}
                        {!isDigitalPix && scope.canDelete && setConfirmDel && (
                          <button
                            type="button"
                            onClick={() => setConfirmDel(l.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"
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
              <tr className="bg-[#123b63]/5 border-t border-gray-200">
                <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-600 text-right">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#123b63]">{fmtBRL(totalFiltrado)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
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
