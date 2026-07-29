'use client';

import { Pencil, Trash2 } from 'lucide-react';

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
              {lancsFiltrados.map((l) => (
                <tr
                  key={l.id}
                  className={`hover:bg-slate-50 transition ${l.tipo_movimento === 'saida' ? 'bg-red-50/40' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(l.data_lancamento)}</td>
                  <td className="px-4 py-3 text-gray-700">{l.congregacao_nome}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.departamento_nome}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
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
                      <span
                        className={`text-xs font-semibold ${
                          l.tipo_movimento === 'saida' ? 'text-red-500' : 'text-green-600'
                        }`}
                      >
                        {l.tipo_movimento === 'saida' ? '↓ Saída' : '↑ Entrada'}
                      </span>
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
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
