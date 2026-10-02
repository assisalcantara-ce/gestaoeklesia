'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NivelAcesso } from '@/hooks/usePermissions';

interface Membro {
  id: string;
  nome: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';
  status: 'ativo' | 'inativo';
  congregacao?: string;
  dizimista?: boolean;
  dataCadastro?: string | Date;
  cargoMinisterial?: string;
  created_at?: string;
}

interface MembrosOverviewProps {
  membros: Membro[];
  nivelUsuario?: NivelAcesso;
  congregacaoUsuario?: string;
  supervisaoUsuario?: string;
  maxMembros?: number;
}

export default function MembrosOverview({
  membros,
  nivelUsuario = 'administrador',
  congregacaoUsuario,
  supervisaoUsuario,
}: MembrosOverviewProps) {
  const [membrosFiltrados, setMembrosFiltrados] = useState<Membro[]>(membros);

  useEffect(() => {
    let filtrados = membros;
    if (nivelUsuario === 'operador' && congregacaoUsuario) {
      filtrados = membros.filter(m => m.congregacao === congregacaoUsuario);
    }
    setMembrosFiltrados(filtrados);
  }, [membros, nivelUsuario, congregacaoUsuario, supervisaoUsuario]);

  const totalMembros = membrosFiltrados.length;
  const ativos = membrosFiltrados.filter(m => m.status === 'ativo').length;
  const inativos = membrosFiltrados.filter(m => m.status === 'inativo').length;

  const percentualAtivo = totalMembros > 0 ? ((ativos / totalMembros) * 100).toFixed(1) : '0';
  const percentualInativo = totalMembros > 0 ? ((inativos / totalMembros) * 100).toFixed(1) : '0';

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const dataMesAnterior = new Date(anoAtual, mesAtual - 1, 1);
  const mesAnterior = dataMesAnterior.getMonth();
  const anoAnterior = dataMesAnterior.getFullYear();

  const parseDataMembro = (membro: Membro): Date | null => {
    const raw = membro.dataCadastro || membro.created_at;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const novosMembrosMes = membrosFiltrados.filter(m => {
    const d = parseDataMembro(m);
    return d && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).length;

  const novosMembrosMesAnterior = membrosFiltrados.filter(m => {
    const d = parseDataMembro(m);
    return d && d.getMonth() === mesAnterior && d.getFullYear() === anoAnterior;
  }).length;

  // Cálculo de percentual de novos membros
  let textoComparativoNovos = '';
  if (novosMembrosMesAnterior > 0) {
    const pct = (((novosMembrosMes - novosMembrosMesAnterior) / novosMembrosMesAnterior) * 100).toFixed(0);
    const sinal = Number(pct) >= 0 ? '+' : '';
    textoComparativoNovos = `${sinal}${pct}% em relação ao mês anterior`;
  } else if (novosMembrosMes > 0) {
    textoComparativoNovos = `+${novosMembrosMes} em relação ao mês anterior`;
  } else {
    textoComparativoNovos = `Sem novos cadastros no mês`;
  }

  // Comparativo para Total de Membros
  const membrosCadastradosMesAnterior = totalMembros - novosMembrosMes;
  let textoComparativoTotal = '';
  if (membrosCadastradosMesAnterior > 0 && novosMembrosMes > 0) {
    const pctTotal = ((novosMembrosMes / membrosCadastradosMesAnterior) * 100).toFixed(1).replace('.', ',');
    textoComparativoTotal = `+${pctTotal}% em relação ao mês anterior`;
  } else if (novosMembrosMes > 0) {
    textoComparativoTotal = `+${novosMembrosMes} no mês atual`;
  } else {
    textoComparativoTotal = `Estável em relação ao mês anterior`;
  }

  const gerarDadosCadastrosPorMes = () => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const dados: { mes: string; cadastros: number; mesNum: number; anoNum: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      dados.push({
        mes: `${meses[data.getMonth()]}/${data.getFullYear().toString().slice(-2)}`,
        cadastros: 0,
        mesNum: data.getMonth() + 1,
        anoNum: data.getFullYear(),
      });
    }

    membrosFiltrados.forEach(membro => {
      const dataCadastro = parseDataMembro(membro);
      if (dataCadastro) {
        const mesIdx = dados.findIndex(
          d => d.mesNum === dataCadastro.getMonth() + 1 && d.anoNum === dataCadastro.getFullYear()
        );
        if (mesIdx !== -1) dados[mesIdx].cadastros++;
      }
    });

    return dados;
  };

  const dadosCadastros = gerarDadosCadastrosPorMes();

  return (
    <div className="space-y-6">
      {/* 1. CARDS PRINCIPAIS — KPIs COLORIDOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Membros (Azul) */}
        <div className="bg-[#ebf5ff] border border-[#d0e6ff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-white text-[#2563eb] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dbeafe]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 block truncate">
                Total de Membros
              </span>
              <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                {totalMembros}
              </p>
              <p className="text-[11px] font-bold text-teal-700 mt-1 truncate">
                {textoComparativoTotal}
              </p>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-[#dbeafe] text-[#2563eb] flex items-center justify-center flex-shrink-0 self-start">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>

        {/* Membros Ativos (Verde) */}
        <div className="bg-[#ecfdf3] border border-[#cff7de] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-white text-[#16a34a] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dcfce7]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 block truncate">
                Membros Ativos
              </span>
              <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                {ativos}
              </p>
              <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                {percentualAtivo}% do total
              </p>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-[#dcfce7] text-[#16a34a] flex items-center justify-center flex-shrink-0 self-start">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Membros Inativos (Laranja / Âmbar) */}
        <div className="bg-[#fff6ea] border border-[#fde4c4] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-white text-[#ea580c] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ffedd5]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 block truncate">
                Membros Inativos
              </span>
              <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                {inativos}
              </p>
              <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                {percentualInativo}% do total
              </p>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center flex-shrink-0 self-start">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </div>
        </div>

        {/* Novos Membros no Mês (Roxo / Violeta) */}
        <div className="bg-[#f3f0ff] border border-[#e3dbff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-white text-[#7c3aed] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ede9fe]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 block truncate">
                Novos Membros no Mês
              </span>
              <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                {novosMembrosMes}
              </p>
              <p className="text-[11px] font-bold text-[#7c3aed] mt-1 truncate">
                {textoComparativoNovos}
              </p>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center flex-shrink-0 self-start font-bold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. GRÁFICO — CADASTROS POR MÊS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-blue-700"></span>
            <h3 className="text-base font-bold text-slate-900">
              Cadastros por Mês (Últimos 12 Meses)
            </h3>
          </div>
        </div>

        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosCadastros} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="mes"
                stroke="#64748b"
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
                itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                cursor={{ fill: '#f1f5f9' }}
                formatter={(value: any) => [`${value} novos membros`, 'Cadastros']}
              />
              <Bar
                dataKey="cadastros"
                fill="#0f766e"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total de Cadastros</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{totalMembros}</p>
          </div>
          <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Pico em 1 Mês</p>
            <p className="text-xl font-black text-emerald-800 mt-0.5">
              {Math.max(0, ...dadosCadastros.map((d: any) => d.cadastros))}
            </p>
          </div>
          <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-200">
            <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">Média Mensal (12m)</p>
            <p className="text-xl font-black text-blue-800 mt-0.5">
              {(totalMembros / 12).toFixed(1)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
