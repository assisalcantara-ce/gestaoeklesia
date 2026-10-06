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
    <div className="space-y-5">
      {/* Cards de Resumo Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Cadastrado */}
        <div className="relative overflow-hidden rounded-3xl border border-[#d0e6ff] bg-[#ebf5ff] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-[#dbeafe]">
              <UserCheck className="h-6 w-6 text-[#2563eb]" />
            </div>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#2563eb] shadow-2xs border border-[#bfdbfe]">
              Dizimistas
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1d4ed8]">
              Total Cadastrado
            </p>
            <p className="mt-1 text-2xl lg:text-3xl font-extrabold text-[#1e3a8a] tracking-tight">
              {stats.total} dizimistas
            </p>
            <p className="mt-1 text-xs text-[#2563eb]/90 font-medium">
              Base ativa no sistema
            </p>
          </div>
        </div>

        {/* Card 2: Adimplentes no Mês */}
        <div className="relative overflow-hidden rounded-3xl border border-[#cff7de] bg-[#ecfdf3] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-[#dcfce7]">
              <CheckCircle2 className="h-6 w-6 text-[#16a34a]" />
            </div>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#16a34a] shadow-2xs border border-[#bbf7d0]">
              Adimplentes
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#15803d]">
              Contribuíram no Mês
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <p className="text-2xl lg:text-3xl font-extrabold text-[#14532d] tracking-tight">
                {stats.qtdAdimplentes}
              </p>
              <span className="text-xs font-extrabold text-[#15803d] bg-white px-2.5 py-1 rounded-xl border border-[#bbf7d0] shadow-2xs">
                {fmtBRL(stats.valorTotalMes)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#16a34a]/90 font-medium">
              Dízimos recebidos no período
            </p>
          </div>
        </div>

        {/* Card 3: Inadimplentes no Mês */}
        <div className="relative overflow-hidden rounded-3xl border border-[#fecdd3] bg-[#fff1f2] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-[#ffe4e6]">
              <AlertCircle className="h-6 w-6 text-[#e11d48]" />
            </div>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#e11d48] shadow-2xs border border-[#fecdd3]">
              Pendentes
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#be123c]">
              Sem Contribuição no Mês
            </p>
            <p className="mt-1 text-2xl lg:text-3xl font-extrabold text-[#881337] tracking-tight">
              {stats.qtdInadimplentes}
            </p>
            <p className="mt-1 text-xs text-[#e11d48]/90 font-medium">
              Aguardando lançamento de dízimo
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de Dizimistas */}
      <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                <th className="py-3.5 px-5">Nome do Dizimista</th>
                <th className="py-3.5 px-5">Vínculo / Cargo</th>
                <th className="py-3.5 px-5">Congregação / Caixa</th>
                <th className="py-3.5 px-5 text-center">Status no Mês</th>
                <th className="py-3.5 px-5 text-right">Valor Contribuído</th>
                <th className="py-3.5 px-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dizimistas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm font-medium">
                    Nenhum dizimista encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                dizimistas.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="py-3.5 px-5 font-bold text-slate-900">{item.nome}</td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold capitalize border shadow-2xs ${
                          item.tipoCadastro === 'ministro'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                      >
                        {item.tipoCadastro}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-700 text-xs font-semibold">
                      {item.congregacaoNome}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {item.pagoNoMes ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-2xs">
                          <CheckCircle2 className="h-3 w-3 text-emerald-700" /> Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full shadow-2xs">
                          <AlertCircle className="h-3 w-3 text-rose-700" /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-extrabold text-sm tracking-tight">
                      {item.pagoNoMes ? (
                        <span className="text-[#15803d]">{fmtBRL(item.valorPago)}</span>
                      ) : (
                        <span className="text-slate-300 font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {!item.pagoNoMes && (
                        <button
                          onClick={() => onRegistrarDizimo(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-xs border border-teal-800 cursor-pointer ml-auto"
                        >
                          <Plus className="h-3.5 w-3.5" /> Lançar Dízimo
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
