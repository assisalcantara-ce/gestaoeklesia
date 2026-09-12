'use client';

import { useState } from 'react';
import {
  TrendingUp,
  Users,
  Sparkles,
  Info,
  Printer,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { GrowthTrendItem, ExecutiveMetrics } from '@/services/secretary-reports-service';
import ReportPrintHeader from './ReportPrintHeader';

interface GrowthMovementTabProps {
  growthTrends: GrowthTrendItem[];
  metrics: ExecutiveMetrics;
  congregacaoNome?: string | null;
}

export default function GrowthMovementTab({
  growthTrends,
  metrics,
  congregacaoNome,
}: GrowthMovementTabProps) {
  const [periodoFiltro, setPeriodoFiltro] = useState<'12_meses' | 'ano_atual'>('12_meses');

  const currentYearPrefix = String(new Date().getFullYear());

  // Filtrar conforme seleção
  const dadosExibicao =
    periodoFiltro === 'ano_atual'
      ? growthTrends.filter((g) => g.mesKey.startsWith(currentYearPrefix))
      : growthTrends;

  const totalNovosCadastros = dadosExibicao.reduce((acc, cur) => acc + cur.novosCadastros, 0);
  const mediaMensal = dadosExibicao.length > 0 ? (totalNovosCadastros / dadosExibicao.length).toFixed(1) : '0';
  const melhorMes = dadosExibicao.reduce(
    (acc, cur) => (cur.novosCadastros > acc.novosCadastros ? cur : acc),
    { mesKey: '', label: '—', novosCadastros: 0 }
  );

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO DE IMPRESSÃO A4 (hidden em tela, visível em print) ─────── */}
      <ReportPrintHeader
        title="Relatório de Evolução de Novos Membros e Situação da Base"
        periodoOuData={periodoFiltro === 'ano_atual' ? `Ano ${currentYearPrefix}` : 'Últimos 12 Meses'}
        congregacaoNome={congregacaoNome}
      />

      {/* ─── CONTROLES DE TELA (PRINT:HIDDEN) ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#123b63]" />
              Evolução de Novos Cadastros na Membresia
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Acompanhamento cronológico de novas adesões e visão da situação atual da membresia.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value as any)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#123b63]"
            >
              <option value="12_meses">Últimos 12 Meses</option>
              <option value="ano_atual">Ano Atual ({currentYearPrefix})</option>
            </select>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir A4
            </button>
          </div>
        </div>
      </div>

      {/* ─── CARDS DE INDICADORES DE ENTRADA ──────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          Adesões Registradas no Período
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total de Novos Cadastros
            </span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{totalNovosCadastros}</p>
            <p className="text-xs text-gray-500 mt-1">
              {periodoFiltro === 'ano_atual' ? `Em todo o ano de ${currentYearPrefix}` : 'Nos últimos 12 meses'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Média Mensal
            </span>
            <p className="text-3xl font-extrabold text-[#123b63] mt-2">{mediaMensal}</p>
            <p className="text-xs text-gray-500 mt-1">Novos membros por mês</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Mês Mais Movimentado
            </span>
            <p className="text-2xl font-extrabold text-indigo-600 mt-2">
              {melhorMes.novosCadastros > 0 ? `${melhorMes.novosCadastros} (${melhorMes.label})` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Pico de novas adesões no intervalo</p>
          </div>
        </div>
      </div>

      {/* ─── GRÁFICO DE EVOLUÇÃO HISTÓRICA MENSAL ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-gray-900 mb-1">
          Evolução Cronológica de Novas Inclusões
        </h4>
        <p className="text-xs text-gray-500 mb-5">
          Volume de cadastros realizados mês a mês com base na data oficial de registro.
        </p>

        <div style={{ height: 280 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosExibicao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip
                formatter={(val: any) => [`${val} novo(s) membro(s)`, 'Cadastros']}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
              />
              <Bar dataKey="novosCadastros" fill="#123b63" radius={[4, 4, 0, 0]} name="Novos Cadastros" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── SITUAÇÃO ATUAL DA BASE DE MEMBROS (SNAPSHOT) ────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#123b63]" />
            <h4 className="text-sm font-bold text-gray-900">
              Situação Atual da Base de Membresia (Snapshot Oficial)
            </h4>
          </div>
          <span className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">
            Posição Atual
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
            <p className="text-xs font-semibold text-emerald-800">Membros Ativos</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{metrics.membrosAtivos}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Em plena comunhão</p>
          </div>

          <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50">
            <p className="text-xs font-semibold text-gray-700">Membros Inativos</p>
            <p className="text-2xl font-bold text-gray-700 mt-1">{metrics.membrosInativos}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Afastados/inativos</p>
          </div>

          <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50">
            <p className="text-xs font-semibold text-blue-800">Transferidos</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{metrics.membrosTransferidos}</p>
            <p className="text-[11px] text-blue-600 mt-0.5">Com carta emitida</p>
          </div>

          <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/50">
            <p className="text-xs font-semibold text-purple-800">Falecidos (Em Memória)</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{metrics.membrosFalecidos}</p>
            <p className="text-[11px] text-purple-600 mt-0.5">Histórico preservado</p>
          </div>
        </div>

        {/* NOTA DE TRANSPARÊNCIA HISTÓRICA */}
        <div className="mt-4 p-3 rounded-xl bg-blue-50/50 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-800">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            <strong>Transparência Administrativa:</strong> Os indicadores acima representam a situação cadastral <em>atual</em> da membresia. O cálculo de saídas por período histórico depende da inclusão de datas específicas de desligamento ou transferência nas fichas.
          </p>
        </div>
      </div>
    </div>
  );
}
