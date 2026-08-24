'use client';

import { useState } from 'react';
import { Pencil, Trash2, QrCode, ShieldCheck, Eye, X, CheckCircle2, Info } from 'lucide-react';

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
  handleEdit: (item: any) => void;
  setConfirmDel: (id: string) => void;
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Departamento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Descrição / Ref.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lancsFiltrados.map((l) => {
                const isDigitalPix = l.origem_modulo === 'gateway' && l.forma_pagamento === 'pix';

                return (
                  <tr
                    key={l.id}
                    className={`hover:bg-slate-50 transition ${l.tipo_movimento === 'saida' ? 'bg-red-50/40' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(l.data_lancamento)}</td>
                    <td className="px-4 py-3 text-gray-700">{l.congregacao_nome}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.departamento_nome}</td>
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
                          <span
                            className={`text-xs font-semibold ${
                              l.tipo_movimento === 'saida' ? 'text-red-500' : 'text-green-600'
                            }`}
                          >
                            {l.tipo_movimento === 'saida' ? '↓ Saída' : '↑ Entrada'}
                          </span>
                          {isDigitalPix && (
                            <button
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
                      {isDigitalPix ? (
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleOpenDetails(l)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-lg transition"
                            title="Lançamento gerado automaticamente pelo pagamento PIX. Clique para ver detalhes."
                          >
                            <Eye className="h-3.5 w-3.5 text-[#123b63]" /> Detalhes PIX
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-center">
                          {scope.canWrite && (
                            <button
                              onClick={() => handleEdit(l)}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {scope.canDelete && (
                            <button
                              onClick={() => setConfirmDel(l.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-500 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
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

      {/* ── MODAL SOMENTE LEITURA: DETALHES DO RECEBIMENTO PIX ── */}
      {selectedLanc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            {/* Cabeçalho do Modal */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#123b63]/10 text-[#123b63] rounded-xl border border-[#123b63]/20">
                  <QrCode className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Detalhes do Recebimento PIX
                  </h3>
                  <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Arrecadação Digital PIX
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLanc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Alerta Destacado */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-800 font-medium">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Lançamento Automático Imutável:</strong> Este lançamento foi gerado automaticamente a partir de um pagamento PIX confirmado via ASAAS.
              </div>
            </div>

            {/* Grid de Informações Organizadas */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Valor Recebido:</span>
                <span className="text-lg font-extrabold text-[#123b63]">
                  {fmtBRL(Number(selectedLanc.valor))}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Data do Lançamento</span>
                <p className="font-bold text-slate-800">{fmtDate(selectedLanc.data_lancamento)}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Tipo de Recebimento</span>
                <p className="font-bold text-slate-800">{tipoLabel(selectedLanc.tipo_recebimento)}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Congregação / Caixa</span>
                <p className="font-bold text-slate-800">{selectedLanc.congregacao_nome || 'Sede'}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Forma & Gateway</span>
                <p className="font-bold text-slate-800">PIX (Gateway ASAAS)</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Descrição / Ref. Destino</span>
                <p className="font-bold text-slate-800">{selectedLanc.descricao || '—'}</p>
              </div>

              {/* Informações Enriquecidas da Cobrança ASAAS */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 space-y-2">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Identificadores Técnicos do Sistema</span>
                
                <div className="space-y-1 font-mono text-[11px] text-slate-600">
                  <p><span className="text-slate-400 font-sans">ID Lançamento:</span> {selectedLanc.id}</p>
                  {selectedLanc.origem_id && (
                    <p><span className="text-slate-400 font-sans">ID Cobrança Digital:</span> {selectedLanc.origem_id}</p>
                  )}
                  {chargeDetails?.gateway_charge_id && (
                    <p><span className="text-slate-400 font-sans">ID Pagamento ASAAS:</span> <strong className="text-slate-800">{chargeDetails.gateway_charge_id}</strong></p>
                  )}
                  {chargeDetails?.status && (
                    <p className="font-sans">
                      <span className="text-slate-400">Status Gateway:</span>{' '}
                      <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> {chargeDetails.status.toUpperCase()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Rodapé Fechar */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLanc(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
