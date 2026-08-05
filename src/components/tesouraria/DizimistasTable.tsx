'use client';

import { useMemo } from 'react';
import { CheckCircle2, AlertCircle, UserCheck, Plus } from 'lucide-react';

export interface DizimistaItem {
  id: string;
  nome: string;
  tipoCadastro: string;
  congregacaoId?: string | null;
  congregacaoNome: string;
  pagoNoMes: boolean;
  valorPago: number;
  dataPagamento?: string | null;
}

interface DizimistasTableProps {
  dizimistas: DizimistaItem[];
  fmtBRL: (val: number) => string;
  onRegistrarDizimo: (dizimista: DizimistaItem) => void;
}

export default function DizimistasTable({
  dizimistas,
  fmtBRL,
  onRegistrarDizimo,
}: DizimistasTableProps) {
  // Estatísticas do topo
  const stats = useMemo(() => {
    const total = dizimistas.length;
    const adimplentes = dizimistas.filter((d) => d.pagoNoMes);
    const inadimplentes = dizimistas.filter((d) => !d.pagoNoMes);
    const valorTotalMes = adimplentes.reduce((acc, curr) => acc + curr.valorPago, 0);

    return {
      total,
      qtdAdimplentes: adimplentes.length,
      qtdInadimplentes: inadimplentes.length,
      valorTotalMes,
    };
  }, [dizimistas]);

  return (
    <div className="space-y-4">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-semibold uppercase">Total Cadastrado</span>
            <UserCheck className="h-4 w-4 text-[#123b63]" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.total} dizimistas</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-semibold uppercase">Adimplentes (Mês)</span>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex justify-between items-baseline">
            <p className="text-2xl font-bold text-green-600">{stats.qtdAdimplentes}</p>
            <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
              {fmtBRL(stats.valorTotalMes)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-semibold uppercase">Inadimplentes (Mês)</span>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.qtdInadimplentes}</p>
        </div>
      </div>

      {/* Tabela de Dizimistas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Nome do Dizimista</th>
                <th className="py-3 px-4">Vínculo / Cargo</th>
                <th className="py-3 px-4">Congregação / Caixa</th>
                <th className="py-3 px-4 text-center">Status no Mês</th>
                <th className="py-3 px-4 text-right">Valor Contribuído</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dizimistas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    Nenhum dizimista encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                dizimistas.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-gray-800">{item.nome}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold capitalize ${
                          item.tipoCadastro === 'ministro'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.tipoCadastro}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs font-medium">
                      {item.congregacaoNome}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.pagoNoMes ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-800 bg-green-100 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-800 bg-red-100 px-2.5 py-1 rounded-full">
                          <AlertCircle className="h-3 w-3" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      {item.pagoNoMes ? (
                        <span className="text-green-600">{fmtBRL(item.valorPago)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!item.pagoNoMes && (
                        <button
                          onClick={() => onRegistrarDizimo(item)}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition ml-auto"
                        >
                          <Plus className="h-3 w-3" /> Lançar Dízimo
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
