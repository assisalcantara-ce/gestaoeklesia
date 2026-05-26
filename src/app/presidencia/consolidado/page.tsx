'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }

interface RawLanc {
  congregacao_id: string | null;
  tipo_movimento: string;
  valor: number;
  categoria_id: string | null;
}

interface RawLancSimples {
  congregacao_id: string | null;
  tipo_movimento: string;
  valor: number;
}

interface FinCategoria {
  id: string;
  nome: string;
  tipo_movimento: string;
}

interface DestinoDigital {
  congregacao_id: string | null;
  label: string;
}

interface CongAggregate {
  id: string | null;
  nome: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

interface CatAggregate {
  id: string | null;
  nome: string;
  total: number;
}

interface Resumo {
  entradas: number;
  saidas: number;
  saldo: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
];

const mesAtual = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtBRLShort = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return fmtBRL(v);
};

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return `${MESES_LABEL[Number(m) - 1]}/${y}`;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateRange(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  const inicio = `${ym}-01`;
  const next = new Date(y, m, 1);
  const fim = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
  return [inicio, fim];
}

function computeResumo(lancs: RawLancSimples[]): Resumo {
  let entradas = 0, saidas = 0;
  lancs.forEach(l => {
    const v = Number(l.valor);
    if (l.tipo_movimento === 'entrada') entradas += v;
    else saidas += v;
  });
  return { entradas, saidas, saldo: entradas - saidas };
}

function aggregateByCong(lancs: RawLancSimples[], congs: Congregacao[]): CongAggregate[] {
  const map = new Map<string | null, CongAggregate>();
  map.set(null, { id: null, nome: 'Sede / Caixa Geral', entradas: 0, saidas: 0, saldo: 0 });
  congs.forEach(c => map.set(c.id, { id: c.id, nome: c.nome, entradas: 0, saidas: 0, saldo: 0 }));

  lancs.forEach(l => {
    const key = l.congregacao_id ?? null;
    const entry = map.get(key) ?? map.get(null)!;
    const v = Number(l.valor);
    if (l.tipo_movimento === 'entrada') entry.entradas += v;
    else entry.saidas += v;
    entry.saldo = entry.entradas - entry.saidas;
  });

  // Remove Sede se sem movimento
  const sede = map.get(null)!;
  if (sede.entradas === 0 && sede.saidas === 0) map.delete(null);

  return Array.from(map.values()).sort((a, b) => b.entradas - a.entradas);
}

function aggregateByCategoria(
  lancs: RawLanc[],
  cats: FinCategoria[],
  tipo: 'entrada' | 'saida',
): CatAggregate[] {
  const opposite = tipo === 'entrada' ? 'saida' : 'entrada';
  const map = new Map<string | null, CatAggregate>();
  map.set(null, { id: null, nome: 'Sem categoria', total: 0 });
  cats
    .filter(c => c.tipo_movimento !== opposite)
    .forEach(c => map.set(c.id, { id: c.id, nome: c.nome, total: 0 }));

  lancs
    .filter(l => l.tipo_movimento === tipo)
    .forEach(l => {
      const key = l.categoria_id ?? null;
      const entry = map.get(key) ?? map.get(null)!;
      entry.total += Number(l.valor);
    });

  const semCat = map.get(null)!;
  if (semCat.total === 0) map.delete(null);

  return Array.from(map.values())
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const anoAtualNum = new Date().getFullYear();
  const anos = Array.from({ length: 4 }, (_, i) => anoAtualNum - 1 + i);
  const [ano, mes] = value.split('-');
  return (
    <div className="flex gap-1">
      <select
        value={mes}
        onChange={e => onChange(`${ano}-${e.target.value}`)}
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
      >
        {MESES_LABEL.map((l, i) => (
          <option key={i} value={String(i + 1).padStart(2, '0')}>{l}</option>
        ))}
      </select>
      <select
        value={ano}
        onChange={e => onChange(`${e.target.value}-${mes}`)}
        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
      >
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

function KpiCard({
  icon, label, value, delta, deltaLabel, borderColor = 'border-blue-400',
}: {
  icon: string;
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  borderColor?: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${borderColor} p-5`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-[#123b63]">{value}</p>
      {delta !== undefined && deltaLabel && (
        <p className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
          delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'
        }`}>
          {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          {deltaLabel}
        </p>
      )}
    </div>
  );
}

function ComparativoCard({
  label, atual, ant, antLabel, colorClass, bg,
}: {
  label: string;
  atual: number;
  ant: number;
  antLabel: string;
  colorClass: string;
  bg: string;
}) {
  const delta = atual - ant;
  const pct = ant !== 0 ? (delta / Math.abs(ant)) * 100 : 0;
  return (
    <div className={`${bg} rounded-lg p-4`}>
      <p className="text-sm text-gray-600 font-medium mb-2">{label}</p>
      <p className={`text-xl font-bold ${colorClass}`}>{fmtBRL(atual)}</p>
      <p className="text-xs text-gray-500 mt-1">{antLabel}: {fmtBRL(ant)}</p>
      <p className={`text-xs mt-1.5 font-semibold flex items-center gap-1 ${
        delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-600' : 'text-gray-400'
      }`}>
        {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'}
        {' '}{Math.abs(pct).toFixed(1)}%
        {' '}({delta >= 0 ? '+' : ''}{fmtBRL(delta)})
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsolidadoFinanceiroPage() {
  const { ctx, bloqueado } = useRequireModulo('consolidado_financeiro');
  const supabase = useMemo(() => createClient(), []);

  const [filtroMes, setFiltroMes] = useState(mesAtual);
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visao-geral' | 'ranking' | 'categorias' | 'alertas'>('visao-geral');
  const [loading, setLoading] = useState(false);

  // Raw data
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [lancMes, setLancMes] = useState<RawLanc[]>([]);
  const [lancMesAnt, setLancMesAnt] = useState<RawLancSimples[]>([]);
  const [lancAno, setLancAno] = useState<RawLanc[]>([]);
  const [lancAnoAnt, setLancAnoAnt] = useState<RawLancSimples[]>([]);
  const [categorias, setCategorias] = useState<FinCategoria[]>([]);
  const [destinosDigitais, setDestinosDigitais] = useState<DestinoDigital[]>([]);

  // ── Resolve ministry id ───────────────────────────────────────────────────
  useEffect(() => {
    if (ctx.loading || bloqueado) return;
    if (ctx.ministryId) { setMinistryId(ctx.ministryId); return; }
    resolveMinistryId(supabase).then(id => setMinistryId(id ?? null));
  }, [ctx.loading, ctx.ministryId, bloqueado, supabase]);

  // ── Load all data ─────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!ministryId) return;
    setLoading(true);
    try {
      const mesAnt = prevMonth(filtroMes);
      const [inicioMes, fimMes]       = dateRange(filtroMes);
      const [inicioMesAnt, fimMesAnt] = dateRange(mesAnt);
      const ano     = filtroMes.slice(0, 4);
      const anoNum  = Number(ano);
      const inicioAno    = `${anoNum}-01-01`;
      const fimAno       = `${anoNum + 1}-01-01`;
      const inicioAnoAnt = `${anoNum - 1}-01-01`;
      const fimAnoAnt    = `${anoNum}-01-01`;

      const [
        resCongs,
        resLancMes,
        resLancMesAnt,
        resLancAno,
        resLancAnoAnt,
        resCats,
        resDestinos,
      ] = await Promise.all([
        supabase
          .from('congregacoes')
          .select('id, nome')
          .eq('ministry_id', ministryId)
          .eq('is_active', true)
          .order('nome'),

        supabase
          .from('tesouraria_lancamentos')
          .select('congregacao_id, tipo_movimento, valor, categoria_id')
          .eq('ministry_id', ministryId)
          .gte('data_lancamento', inicioMes)
          .lt('data_lancamento', fimMes),

        supabase
          .from('tesouraria_lancamentos')
          .select('congregacao_id, tipo_movimento, valor')
          .eq('ministry_id', ministryId)
          .gte('data_lancamento', inicioMesAnt)
          .lt('data_lancamento', fimMesAnt),

        supabase
          .from('tesouraria_lancamentos')
          .select('congregacao_id, tipo_movimento, valor, categoria_id')
          .eq('ministry_id', ministryId)
          .gte('data_lancamento', inicioAno)
          .lt('data_lancamento', fimAno),

        supabase
          .from('tesouraria_lancamentos')
          .select('congregacao_id, tipo_movimento, valor')
          .eq('ministry_id', ministryId)
          .gte('data_lancamento', inicioAnoAnt)
          .lt('data_lancamento', fimAnoAnt),

        supabase
          .from('fin_categorias')
          .select('id, nome, tipo_movimento')
          .or(`ministry_id.is.null,ministry_id.eq.${ministryId}`)
          .eq('is_ativa', true),

        supabase
          .from('fin_payment_destinations')
          .select('congregacao_id, label')
          .eq('ministry_id', ministryId)
          .eq('is_ativo', true)
          .not('gateway_id', 'is', null),
      ]);

      setCongregacoes((resCongs.data ?? []) as Congregacao[]);
      setLancMes((resLancMes.data ?? []) as RawLanc[]);
      setLancMesAnt((resLancMesAnt.data ?? []) as RawLancSimples[]);
      setLancAno((resLancAno.data ?? []) as RawLanc[]);
      setLancAnoAnt((resLancAnoAnt.data ?? []) as RawLancSimples[]);
      setCategorias((resCats.data ?? []) as FinCategoria[]);
      setDestinosDigitais((resDestinos.data ?? []) as DestinoDigital[]);
    } finally {
      setLoading(false);
    }
  }, [ministryId, filtroMes, supabase]);

  useEffect(() => { if (ministryId) loadAll(); }, [ministryId, loadAll]);

  // ── Derivados ─────────────────────────────────────────────────────────────

  const resumoMes    = useMemo(() => computeResumo(lancMes),    [lancMes]);
  const resumoMesAnt = useMemo(() => computeResumo(lancMesAnt), [lancMesAnt]);
  const resumoAno    = useMemo(() => computeResumo(lancAno),    [lancAno]);
  const resumoAnoAnt = useMemo(() => computeResumo(lancAnoAnt), [lancAnoAnt]);

  const rankingCongs = useMemo(
    () => aggregateByCong(lancMes, congregacoes),
    [lancMes, congregacoes],
  );

  const top10Receitas = useMemo(
    () => aggregateByCategoria(lancMes, categorias, 'entrada'),
    [lancMes, categorias],
  );

  const top10Despesas = useMemo(
    () => aggregateByCategoria(lancMes, categorias, 'saida'),
    [lancMes, categorias],
  );

  const congsSemRegistro = useMemo(() => {
    const comRegistro = new Set(lancMes.map(l => l.congregacao_id).filter(Boolean));
    return congregacoes.filter(c => !comRegistro.has(c.id));
  }, [congregacoes, lancMes]);

  const congsDigital = useMemo(() => {
    const map = new Map<string | null, string[]>();
    destinosDigitais.forEach(d => {
      const key = d.congregacao_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d.label);
    });
    const result: { id: string | null; nome: string; destinos: string[] }[] = [];
    map.forEach((destinos, id) => {
      if (id === null) {
        result.push({ id: null, nome: 'Sede / Caixa Geral', destinos });
      } else {
        const cong = congregacoes.find(c => c.id === id);
        result.push({ id, nome: cong?.nome ?? '—', destinos });
      }
    });
    return result.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [destinosDigitais, congregacoes]);

  const rankingComMovimento = useMemo(
    () => rankingCongs.filter(c => c.entradas > 0 || c.saidas > 0),
    [rankingCongs],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (ctx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;

  const mesAntLabel  = prevMonth(filtroMes);
  const ano          = filtroMes.slice(0, 4);
  const anoAnt       = String(Number(ano) - 1);

  const deltaEntradas = resumoMes.entradas - resumoMesAnt.entradas;
  const deltaSaidas   = resumoMes.saidas   - resumoMesAnt.saidas;
  const deltaSaldo    = resumoMes.saldo    - resumoMesAnt.saldo;

  const pctDelta = (delta: number, ref: number) =>
    ref === 0 ? '—' : `${delta >= 0 ? '+' : ''}${((delta / Math.abs(ref)) * 100).toFixed(1)}% vs ${monthLabel(mesAntLabel)}`;

  const tabs = [
    { id: 'visao-geral',  label: 'Visão Geral' },
    { id: 'ranking',      label: `Ranking (${rankingComMovimento.length})` },
    { id: 'categorias',   label: 'Top Categorias' },
    { id: 'alertas',      label: `Alertas${congsSemRegistro.length > 0 ? ` (${congsSemRegistro.length})` : ''}` },
  ];

  return (
    <PageLayout
      title="Consolidado Financeiro"
      description={`Inteligência Financeira do Campo — ${monthLabel(filtroMes)}`}
      activeMenu="consolidado-financeiro"
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[#123b63]">Visão Executiva do Campo</h2>
          <p className="text-sm text-gray-500">
            {congregacoes.length} congregação{congregacoes.length !== 1 ? 'ões' : ''} ativa{congregacoes.length !== 1 ? 's' : ''} •{' '}
            {monthLabel(filtroMes)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker value={filtroMes} onChange={v => setFiltroMes(v)} />
          <button
            onClick={() => void loadAll()}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon="📈"
          label="Receita Consolidada"
          value={fmtBRL(resumoMes.entradas)}
          delta={deltaEntradas}
          deltaLabel={pctDelta(deltaEntradas, resumoMesAnt.entradas)}
          borderColor="border-green-400"
        />
        <KpiCard
          icon="📉"
          label="Despesa Consolidada"
          value={fmtBRL(resumoMes.saidas)}
          delta={-deltaSaidas}
          deltaLabel={pctDelta(-deltaSaidas, resumoMesAnt.saidas)}
          borderColor="border-red-400"
        />
        <KpiCard
          icon="💰"
          label="Saldo do Campo"
          value={fmtBRL(resumoMes.saldo)}
          delta={deltaSaldo}
          deltaLabel={pctDelta(deltaSaldo, Math.abs(resumoMesAnt.saldo) || 1)}
          borderColor={resumoMes.saldo >= 0 ? 'border-blue-400' : 'border-orange-400'}
        />
        <KpiCard
          icon="⛪"
          label="Congregações Ativas"
          value={String(congregacoes.length)}
          borderColor="border-purple-400"
        />
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === t.id
                  ? 'border-[#123b63] text-[#123b63]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-gray-400">
          <div className="inline-block w-8 h-8 border-4 border-[#123b63]/20 border-t-[#123b63] rounded-full animate-spin mb-3" />
          <p className="text-sm">Carregando dados do campo…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* ────────────────── TAB: VISÃO GERAL ────────────────── */}
          {activeTab === 'visao-geral' && (
            <div className="space-y-6">

              {/* Comparativo mês atual x anterior */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-[#123b63] mb-4">
                  Comparativo Mensal — {monthLabel(filtroMes)} vs {monthLabel(mesAntLabel)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ComparativoCard
                    label="Receita" atual={resumoMes.entradas} ant={resumoMesAnt.entradas}
                    antLabel={monthLabel(mesAntLabel)}
                    colorClass="text-green-700" bg="bg-green-50"
                  />
                  <ComparativoCard
                    label="Despesa" atual={resumoMes.saidas} ant={resumoMesAnt.saidas}
                    antLabel={monthLabel(mesAntLabel)}
                    colorClass="text-red-600" bg="bg-red-50"
                  />
                  <ComparativoCard
                    label="Saldo" atual={resumoMes.saldo} ant={resumoMesAnt.saldo}
                    antLabel={monthLabel(mesAntLabel)}
                    colorClass={resumoMes.saldo >= 0 ? 'text-blue-700' : 'text-orange-600'} bg="bg-blue-50"
                  />
                </div>
              </div>

              {/* Comparativo ano atual x anterior */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-[#123b63] mb-4">
                  Comparativo Anual — {ano} vs {anoAnt}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ComparativoCard
                    label="Receita" atual={resumoAno.entradas} ant={resumoAnoAnt.entradas}
                    antLabel={anoAnt}
                    colorClass="text-green-700" bg="bg-green-50"
                  />
                  <ComparativoCard
                    label="Despesa" atual={resumoAno.saidas} ant={resumoAnoAnt.saidas}
                    antLabel={anoAnt}
                    colorClass="text-red-600" bg="bg-red-50"
                  />
                  <ComparativoCard
                    label="Saldo" atual={resumoAno.saldo} ant={resumoAnoAnt.saldo}
                    antLabel={anoAnt}
                    colorClass={resumoAno.saldo >= 0 ? 'text-blue-700' : 'text-orange-600'} bg="bg-blue-50"
                  />
                </div>
              </div>

              {/* Gráfico Receita x Despesa por Congregação */}
              {rankingComMovimento.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-[#123b63] mb-4">
                    Receita × Despesa por Congregação — {monthLabel(filtroMes)}
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={rankingComMovimento.slice(0, 12).map(c => ({
                        name: c.nome.length > 13 ? c.nome.slice(0, 13) + '…' : c.nome,
                        Receita: c.entradas,
                        Despesa: c.saidas,
                      }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis tickFormatter={fmtBRLShort} tick={{ fontSize: 10 }} width={56} />
                      <Tooltip formatter={(v: number | string | undefined) => fmtBRL(Number(v ?? 0))} />
                      <Bar dataKey="Receita" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="Despesa" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ────────────────── TAB: RANKING ────────────────── */}
          {activeTab === 'ranking' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-[#123b63]">Ranking de Congregações — {monthLabel(filtroMes)}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Ordenado por receita decrescente</p>
              </div>
              {rankingCongs.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">Nenhum dado para o período</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                      <th className="text-left px-5 py-3">#</th>
                      <th className="text-left px-4 py-3">Congregação</th>
                      <th className="text-right px-4 py-3 text-green-700">Receita</th>
                      <th className="text-right px-4 py-3 text-red-600">Despesa</th>
                      <th className="text-right px-4 py-3 text-blue-700">Saldo</th>
                      <th className="text-right px-4 py-3">% Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingCongs.map((c, i) => {
                      const pctReceita = resumoMes.entradas > 0
                        ? (c.entradas / resumoMes.entradas) * 100
                        : 0;
                      const semMovimento = c.entradas === 0 && c.saidas === 0;
                      return (
                        <tr key={c.id ?? '__sede__'} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-medium text-[#123b63]">{c.nome}</span>
                            {semMovimento && (
                              <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                sem registros
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-green-700">
                            {fmtBRL(c.entradas)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-red-600">
                            {fmtBRL(c.saidas)}
                          </td>
                          <td className={`px-4 py-3.5 text-right font-semibold ${
                            c.saldo >= 0 ? 'text-blue-700' : 'text-orange-600'
                          }`}>
                            {fmtBRL(c.saldo)}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-14 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-green-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(pctReceita, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">
                                {pctReceita.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-5 py-3" colSpan={2}>
                        <span className="font-bold text-[#123b63] text-sm">TOTAL CONSOLIDADO</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">
                        {fmtBRL(resumoMes.entradas)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {fmtBRL(resumoMes.saidas)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${
                        resumoMes.saldo >= 0 ? 'text-blue-700' : 'text-orange-600'
                      }`}>
                        {fmtBRL(resumoMes.saldo)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">100%</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* ────────────────── TAB: CATEGORIAS ────────────────── */}
          {activeTab === 'categorias' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Top 10 Receitas */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-[#123b63] mb-4">
                    🏆 Top 10 Receitas — {monthLabel(filtroMes)}
                  </h3>
                  {top10Receitas.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-6">Nenhuma receita registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {top10Receitas.map((c, i) => {
                        const pct = resumoMes.entradas > 0
                          ? (c.total / resumoMes.entradas) * 100
                          : 0;
                        return (
                          <div key={c.id ?? 'sem'} className="flex items-center gap-3">
                            <span className="text-xs font-mono text-gray-400 w-4 shrink-0 text-right">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700 truncate pr-2">{c.nome}</span>
                                <span className="text-sm font-semibold text-green-700 shrink-0">{fmtBRL(c.total)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full"
                                    style={{
                                      width: `${Math.min(pct, 100)}%`,
                                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Top 10 Despesas */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-[#123b63] mb-4">
                    📊 Top 10 Despesas — {monthLabel(filtroMes)}
                  </h3>
                  {top10Despesas.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-6">Nenhuma despesa registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {top10Despesas.map((c, i) => {
                        const pct = resumoMes.saidas > 0
                          ? (c.total / resumoMes.saidas) * 100
                          : 0;
                        return (
                          <div key={c.id ?? 'sem'} className="flex items-center gap-3">
                            <span className="text-xs font-mono text-gray-400 w-4 shrink-0 text-right">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700 truncate pr-2">{c.nome}</span>
                                <span className="text-sm font-semibold text-red-600 shrink-0">{fmtBRL(c.total)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full bg-red-400"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Gráfico horizontal receitas */}
              {top10Receitas.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-[#123b63] mb-4">Distribuição de Receitas por Categoria</h3>
                  <ResponsiveContainer width="100%" height={Math.max(160, top10Receitas.length * 30)}>
                    <BarChart
                      layout="vertical"
                      data={top10Receitas.map(c => ({
                        name: c.nome.length > 24 ? c.nome.slice(0, 24) + '…' : c.nome,
                        total: c.total,
                      }))}
                      margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" tickFormatter={fmtBRLShort} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number | string | undefined) => fmtBRL(Number(v ?? 0))} />
                      <Bar dataKey="total" radius={[0, 3, 3, 0]} maxBarSize={20}>
                        {top10Receitas.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ────────────────── TAB: ALERTAS ────────────────── */}
          {activeTab === 'alertas' && (
            <div className="space-y-6">

              {/* Congregações sem registros no mês */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                  <h3 className="font-semibold text-[#123b63]">
                    Congregações sem Registros no Mês — {monthLabel(filtroMes)}
                  </h3>
                  <span className={`ml-auto shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    congsSemRegistro.length > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {congsSemRegistro.length === 0
                      ? 'Todas em dia ✓'
                      : `${congsSemRegistro.length} pendente${congsSemRegistro.length !== 1 ? 's' : ''}`
                    }
                  </span>
                </div>

                {congsSemRegistro.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-600 py-2">
                    <CheckCircle2 size={16} />
                    <p className="text-sm">Todas as congregações registraram lançamentos neste mês.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-3">
                      Nenhum lançamento financeiro registrado — congregações que podem não ter prestado contas ainda.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {congsSemRegistro.map(c => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg"
                        >
                          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                          <span className="text-sm font-medium text-gray-700">{c.nome}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Congregações com arrecadação digital */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Wifi size={18} className="text-blue-500 shrink-0" />
                  <h3 className="font-semibold text-[#123b63]">Congregações com Arrecadação Digital (PIX)</h3>
                  <span className={`ml-auto shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    congsDigital.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {congsDigital.length} ativa{congsDigital.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {congsDigital.length === 0 ? (
                  <div className="flex items-center gap-2 text-gray-400 py-2">
                    <WifiOff size={16} />
                    <p className="text-sm">Nenhuma congregação com gateway PIX ativo.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {congsDigital.map(c => (
                      <div
                        key={c.id ?? '__sede__'}
                        className="p-3 bg-blue-50 border border-blue-100 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Wifi size={13} className="text-blue-500 shrink-0" />
                          <span className="text-sm font-semibold text-[#123b63]">{c.nome}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1.5">
                          {c.destinos.length} destino{c.destinos.length !== 1 ? 's' : ''} ativo{c.destinos.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {c.destinos.slice(0, 3).map((d, i) => (
                            <span key={i} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              {d}
                            </span>
                          ))}
                          {c.destinos.length > 3 && (
                            <span className="text-xs text-gray-400">+{c.destinos.length - 3}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Congregações SEM digital */}
                {congregacoes.length > 0 && (
                  (() => {
                    const congsComDigital = new Set(congsDigital.map(c => c.id));
                    const semDigital = congregacoes.filter(c => !congsComDigital.has(c.id));
                    if (semDigital.length === 0) return null;
                    return (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">
                          Sem arrecadação digital ({semDigital.length} de {congregacoes.length}):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {semDigital.map(c => (
                            <span key={c.id} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              {c.nome}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
