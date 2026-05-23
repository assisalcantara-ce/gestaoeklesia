'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES_LABEL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const mesAtual = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

const mesProximo = (mes: string): string => {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const mesLabel = (mes: string): string => {
  const [, m] = mes.split('-').map(Number);
  return MESES_LABEL[m - 1] ?? mes;
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinConta {
  id: string;
  nome: string;
  tipo: string;
  congregacao_id: string | null;
  saldo_inicial: number;
  is_ativa: boolean;
  is_padrao: boolean;
}

interface FinCategoria {
  id: string;
  nome: string;
  tipo_movimento: string; // entrada | saida | ambos
  cor: string | null;
  icone: string | null;
}

interface Lancamento {
  tipo_movimento: string;
  valor: number;
  tipo_recebimento: string;
  conta_id: string | null;
  categoria_id: string | null;
  congregacao_id: string | null;
}

interface MesDados {
  mes: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

interface ContaSaldo {
  id: string | null;
  nome: string;
  tipo: string;
  saldo_inicial: number;
  entradas: number;
  saidas: number;
  saldo_estimado: number;
  is_ativa: boolean;
}

interface CategoriaTotal {
  id: string | null;
  nome: string;
  cor: string | null;
  icone: string | null;
  tipo_movimento: string;
  total: number;
  percentual: number;
}

interface Fechamento {
  mes_referencia: string;
  status: string;
}

// ── Cores para PieChart ───────────────────────────────────────────────────────

const PIE_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
];

// ── MonthPicker ───────────────────────────────────────────────────────────────

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - 2 + i);
  const [ano, mes] = value.split('-');
  const update = (m: string, a: string) => onChange(`${a}-${m}`);
  return (
    <div className="flex gap-1">
      <select
        value={mes}
        onChange={e => update(e.target.value, ano)}
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
      >
        {Array.from({ length: 12 }, (_, i) => {
          const v = String(i + 1).padStart(2, '0');
          return <option key={v} value={v}>{MESES_LABEL[i]}</option>;
        })}
      </select>
      <select
        value={ano}
        onChange={e => update(mes, e.target.value)}
        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
      >
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, colorClass = 'text-[#123b63]', borderColor = 'border-blue-400'
}: {
  icon: string; label: string; value: string; sub?: string;
  colorClass?: string; borderColor?: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${borderColor} p-5`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { ctx, bloqueado } = useRequireModulo('financeiro');
  const supabase = useMemo(() => createClient(), []);

  const [filtroMes, setFiltroMes] = useState(mesAtual);
  const [ministryId, setMinistryId] = useState<string | null>(null);

  // Data state
  const [contas, setContas] = useState<FinConta[]>([]);
  const [categorias, setCategorias] = useState<FinCategoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [grafico12m, setGrafico12m] = useState<MesDados[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);

  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingMes, setLoadingMes] = useState(false);
  const [loadingGrafico, setLoadingGrafico] = useState(false);

  // ── Scope (FINANCEIRO_LOCAL → filtra por congregacao_id) ─────────────────
  const isFinanceiroLocal = ctx.nivel === 'financeiro_local';
  const congregacaoId = ctx.congregacaoId;

  // ── Resolve ministry id ───────────────────────────────────────────────────
  useEffect(() => {
    if (ctx.loading || bloqueado) return;
    if (ctx.ministryId) { setMinistryId(ctx.ministryId); return; }
    resolveMinistryId(supabase).then(id => setMinistryId(id ?? null));
  }, [ctx.loading, ctx.ministryId, bloqueado, supabase]);

  // ── Load contas, categorias, fechamentos (base estável) ───────────────────
  const loadBase = useCallback(async () => {
    if (!ministryId) return;
    setLoadingBase(true);
    try {
      const [resContas, resCats, resFech] = await Promise.all([
        supabase
          .from('fin_contas')
          .select('id, nome, tipo, congregacao_id, saldo_inicial, is_ativa, is_padrao')
          .eq('ministry_id', ministryId),
        supabase
          .from('fin_categorias')
          .select('id, nome, tipo_movimento, cor, icone')
          .or(`ministry_id.is.null,ministry_id.eq.${ministryId}`)
          .eq('is_ativa', true),
        supabase
          .from('tesouraria_fechamentos')
          .select('mes_referencia, status')
          .eq('ministry_id', ministryId)
          .order('mes_referencia', { ascending: false })
          .limit(24),
      ]);
      setContas((resContas.data ?? []) as FinConta[]);
      setCategorias((resCats.data ?? []) as FinCategoria[]);
      setFechamentos((resFech.data ?? []) as Fechamento[]);
    } finally {
      setLoadingBase(false);
    }
  }, [ministryId, supabase]);

  // ── Load lançamentos do mês selecionado ───────────────────────────────────
  const loadLancamentos = useCallback(async (mes: string) => {
    if (!ministryId) return;
    setLoadingMes(true);
    try {
      let q = supabase
        .from('tesouraria_lancamentos')
        .select('tipo_movimento, valor, tipo_recebimento, conta_id, categoria_id, congregacao_id')
        .eq('ministry_id', ministryId)
        .gte('data_lancamento', `${mes}-01`)
        .lt('data_lancamento', `${mesProximo(mes)}-01`);
      if (isFinanceiroLocal && congregacaoId) {
        q = q.eq('congregacao_id', congregacaoId);
      }
      const { data } = await q;
      setLancamentos((data ?? []) as Lancamento[]);
    } finally {
      setLoadingMes(false);
    }
  }, [ministryId, supabase, isFinanceiroLocal, congregacaoId]);

  // ── Load gráfico 12 meses ─────────────────────────────────────────────────
  const loadGrafico = useCallback(async () => {
    if (!ministryId) return;
    setLoadingGrafico(true);
    try {
      const hoje = new Date();
      const meses: MesDados[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${MESES_LABEL[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(2)}`;
        meses.push({ mes, label, entradas: 0, saidas: 0, saldo: 0 });
      }
      let q = supabase
        .from('tesouraria_lancamentos')
        .select('data_lancamento, tipo_movimento, valor')
        .eq('ministry_id', ministryId)
        .gte('data_lancamento', `${meses[0].mes}-01`);
      if (isFinanceiroLocal && congregacaoId) {
        q = q.eq('congregacao_id', congregacaoId);
      }
      const { data } = await q;
      if (data) {
        (data as { data_lancamento: string; tipo_movimento: string; valor: number }[]).forEach(l => {
          const idx = meses.findIndex(x => x.mes === l.data_lancamento.slice(0, 7));
          if (idx >= 0) {
            if (l.tipo_movimento === 'entrada') meses[idx].entradas += Number(l.valor);
            else meses[idx].saidas += Number(l.valor);
          }
        });
        let acum = 0;
        meses.forEach(m => { m.saldo = m.entradas - m.saidas; acum += m.saldo; m.saldo = acum; });
      }
      setGrafico12m(meses);
    } finally {
      setLoadingGrafico(false);
    }
  }, [ministryId, supabase, isFinanceiroLocal, congregacaoId]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { if (ministryId) { loadBase(); loadGrafico(); } }, [ministryId, loadBase, loadGrafico]);
  useEffect(() => { if (ministryId) loadLancamentos(filtroMes); }, [filtroMes, ministryId, loadLancamentos]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    let entradas = 0, saidas = 0, dizimos = 0;
    lancamentos.forEach(l => {
      const v = Number(l.valor);
      if (l.tipo_movimento === 'entrada') {
        entradas += v;
        if (l.tipo_recebimento === 'dizimo') dizimos += v;
      } else {
        saidas += v;
      }
    });
    return { entradas, saidas, saldo: entradas - saidas, dizimos };
  }, [lancamentos]);

  const contasSaldo = useMemo((): ContaSaldo[] => {
    const map = new Map<string | null, ContaSaldo>();
    // Inicializa contas cadastradas
    contas.forEach(c => {
      map.set(c.id, {
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        saldo_inicial: Number(c.saldo_inicial),
        entradas: 0,
        saidas: 0,
        saldo_estimado: Number(c.saldo_inicial),
        is_ativa: c.is_ativa,
      });
    });
    // Bucket "sem conta"
    map.set(null, { id: null, nome: 'Sem conta vinculada', tipo: '—', saldo_inicial: 0, entradas: 0, saidas: 0, saldo_estimado: 0, is_ativa: true });
    // Acumula lançamentos do mês
    lancamentos.forEach(l => {
      const key = l.conta_id ?? null;
      const entry = map.get(key) ?? map.get(null)!;
      const v = Number(l.valor);
      if (l.tipo_movimento === 'entrada') entry.entradas += v;
      else entry.saidas += v;
      entry.saldo_estimado = entry.saldo_inicial + entry.entradas - entry.saidas;
    });
    // Remove "sem conta" se vazio
    const semConta = map.get(null)!;
    if (semConta.entradas === 0 && semConta.saidas === 0) map.delete(null);
    return Array.from(map.values());
  }, [contas, lancamentos]);

  const categoriasEntrada = useMemo((): CategoriaTotal[] => {
    const map = new Map<string | null, CategoriaTotal>();
    map.set(null, { id: null, nome: 'Sem categoria', cor: null, icone: null, tipo_movimento: 'entrada', total: 0, percentual: 0 });
    categorias.filter(c => c.tipo_movimento !== 'saida').forEach(c => {
      map.set(c.id, { id: c.id, nome: c.nome, cor: c.cor, icone: c.icone, tipo_movimento: c.tipo_movimento, total: 0, percentual: 0 });
    });
    let totalGeral = 0;
    lancamentos.filter(l => l.tipo_movimento === 'entrada').forEach(l => {
      const v = Number(l.valor);
      totalGeral += v;
      const entry = map.get(l.categoria_id ?? null) ?? map.get(null)!;
      entry.total += v;
    });
    if (totalGeral > 0) map.forEach(c => { c.percentual = (c.total / totalGeral) * 100; });
    const semCat = map.get(null)!;
    if (semCat.total === 0) map.delete(null);
    return Array.from(map.values()).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [categorias, lancamentos]);

  const categoriasSaida = useMemo((): CategoriaTotal[] => {
    const map = new Map<string | null, CategoriaTotal>();
    map.set(null, { id: null, nome: 'Sem categoria', cor: null, icone: null, tipo_movimento: 'saida', total: 0, percentual: 0 });
    categorias.filter(c => c.tipo_movimento !== 'entrada').forEach(c => {
      map.set(c.id, { id: c.id, nome: c.nome, cor: c.cor, icone: c.icone, tipo_movimento: c.tipo_movimento, total: 0, percentual: 0 });
    });
    let totalGeral = 0;
    lancamentos.filter(l => l.tipo_movimento === 'saida').forEach(l => {
      const v = Number(l.valor);
      totalGeral += v;
      const entry = map.get(l.categoria_id ?? null) ?? map.get(null)!;
      entry.total += v;
    });
    if (totalGeral > 0) map.forEach(c => { c.percentual = (c.total / totalGeral) * 100; });
    const semCat = map.get(null)!;
    if (semCat.total === 0) map.delete(null);
    return Array.from(map.values()).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [categorias, lancamentos]);

  // ── Alerta de fechamento ──────────────────────────────────────────────────
  const alertaFechamento = useMemo(() => {
    const atual = mesAtual();
    const [y, m] = atual.split('-').map(Number);
    const mesAnterior = m === 1
      ? `${y - 1}-12`
      : `${y}-${String(m - 1).padStart(2, '0')}`;
    const fech = fechamentos.find(f => f.mes_referencia === mesAnterior);
    if (!fech || fech.status === 'aberto') return mesAnterior;
    return null;
  }, [fechamentos]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (ctx.loading) return <div className="p-8 text-gray-500">Carregando...</div>;
  if (bloqueado) return null;

  const loading = loadingBase || loadingMes;
  const contasAtivas = contas.filter(c => c.is_ativa).length;

  return (
    <PageLayout
      title="Dashboard Financeiro"
      description={`Visão executiva consolidada · ${mesLabel(filtroMes)} ${filtroMes.split('-')[0]}`}
      activeMenu="financeiro"
      headerExtra={
        <MonthPicker value={filtroMes} onChange={setFiltroMes} />
      }
    >
      {/* Alerta de fechamento pendente */}
      {alertaFechamento && (
        <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-sm text-yellow-800">
            O mês <strong>{mesLabel(alertaFechamento)} {alertaFechamento.split('-')[0]}</strong> ainda está em aberto.
            Acesse <a href="/tesouraria" className="underline font-semibold">Tesouraria</a> para fechar o período.
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KpiCard
          icon="💚" label="Entradas do mês"
          value={fmtBRL(resumo.entradas)}
          colorClass="text-green-700"
          borderColor="border-green-400"
        />
        <KpiCard
          icon="🔴" label="Saídas do mês"
          value={fmtBRL(resumo.saidas)}
          colorClass="text-red-700"
          borderColor="border-red-400"
        />
        <KpiCard
          icon="⚖️" label="Saldo do mês"
          value={fmtBRL(resumo.saldo)}
          colorClass={resumo.saldo >= 0 ? 'text-teal-700' : 'text-red-700'}
          borderColor={resumo.saldo >= 0 ? 'border-teal-400' : 'border-red-400'}
        />
        <KpiCard
          icon="🙏" label="Dízimos recebidos"
          value={fmtBRL(resumo.dizimos)}
          colorClass="text-purple-700"
          borderColor="border-purple-400"
        />
        <KpiCard
          icon="🏦" label="Contas/caixas ativos"
          value={String(contasAtivas)}
          colorClass="text-[#123b63]"
          borderColor="border-blue-400"
        />
        <KpiCard
          icon="📊" label="Resultado s/ entradas"
          value={resumo.entradas > 0 ? `${((resumo.saldo / resumo.entradas) * 100).toFixed(1)}%` : '—'}
          colorClass={resumo.saldo >= 0 ? 'text-teal-700' : 'text-red-700'}
          borderColor="border-gray-300"
        />
      </div>

      {/* Gráficos */}
      {!loadingGrafico && grafico12m.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Entradas x Saídas 12 meses */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">📈 Entradas × Saídas — Últimos 12 meses</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={grafico12m} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <ChartTooltip formatter={(v: number | string | undefined) => fmtBRL(Number(v ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição entradas por categoria */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">🥧 Entradas por categoria — {mesLabel(filtroMes)}</h3>
            {categoriasEntrada.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-16">Sem entradas no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoriasEntrada.map(c => ({ ...c }))}
                    dataKey="total"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(props: PieLabelRenderProps) => {
                      const nome = String(props.name ?? '');
                      const pct = Number(props.percent ?? 0) * 100;
                      return `${nome.length > 12 ? nome.slice(0, 12) + '…' : nome} ${pct.toFixed(0)}%`;
                    }}
                    labelLine={false}
                  >
                    {categoriasEntrada.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip formatter={(v: number | string | undefined) => fmtBRL(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Linha 2 gráficos: saídas + saldo acumulado */}
      {!loadingGrafico && grafico12m.length > 0 && categoriasSaida.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">🥧 Saídas por categoria — {mesLabel(filtroMes)}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoriasSaida.map(c => ({ ...c }))}
                  dataKey="total"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(props: PieLabelRenderProps) => {
                    const nome = String(props.name ?? '');
                    const pct = Number(props.percent ?? 0) * 100;
                    return `${nome.length > 12 ? nome.slice(0, 12) + '…' : nome} ${pct.toFixed(0)}%`;
                  }}
                  labelLine={false}
                >
                  {categoriasSaida.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip formatter={(v: number | string | undefined) => fmtBRL(Number(v ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">📋 Top saídas por categoria</h3>
            <div className="space-y-2 overflow-y-auto max-h-[200px]">
              {categoriasSaida.map((c, i) => (
                <div key={c.id ?? 'null'} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="flex-1 text-sm text-gray-700 truncate">{c.icone ? `${c.icone} ` : ''}{c.nome}</span>
                  <span className="text-sm font-semibold text-red-700">{fmtBRL(c.total)}</span>
                  <span className="text-xs text-gray-400 w-10 text-right">{c.percentual.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visão por conta/caixa */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">🏦 Visão por conta / caixa — {mesLabel(filtroMes)}</h3>
        {loading ? (
          <p className="text-gray-400 text-sm text-center py-8">Carregando...</p>
        ) : contasSaldo.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Nenhuma conta cadastrada.</p>
            <p className="text-gray-400 text-xs mt-1">Acesse <a href="/tesouraria" className="underline">Tesouraria</a> para configurar caixas e contas bancárias.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left pb-2 pr-4">Conta / Caixa</th>
                  <th className="text-left pb-2 pr-4">Tipo</th>
                  <th className="text-right pb-2 pr-4">Saldo inicial</th>
                  <th className="text-right pb-2 pr-4 text-green-700">Entradas</th>
                  <th className="text-right pb-2 pr-4 text-red-700">Saídas</th>
                  <th className="text-right pb-2">Saldo estimado</th>
                </tr>
              </thead>
              <tbody>
                {contasSaldo.map(c => (
                  <tr key={c.id ?? 'null'} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-800">
                      {c.nome}
                      {!c.is_ativa && <span className="ml-2 text-xs text-gray-400">(inativa)</span>}
                    </td>
                    <td className="py-2 pr-4 text-gray-500 capitalize">{c.tipo.replace('_', ' ')}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{fmtBRL(c.saldo_inicial)}</td>
                    <td className="py-2 pr-4 text-right text-green-700 font-medium">{fmtBRL(c.entradas)}</td>
                    <td className="py-2 pr-4 text-right text-red-700 font-medium">{fmtBRL(c.saidas)}</td>
                    <td className={`py-2 text-right font-bold ${c.saldo_estimado >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                      {fmtBRL(c.saldo_estimado)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-bold">
                  <td colSpan={3} className="pt-2 text-gray-600 text-xs uppercase">Totais do mês</td>
                  <td className="pt-2 text-right text-green-700">{fmtBRL(resumo.entradas)}</td>
                  <td className="pt-2 text-right text-red-700">{fmtBRL(resumo.saidas)}</td>
                  <td className={`pt-2 text-right ${resumo.saldo >= 0 ? 'text-teal-700' : 'text-red-700'}`}>{fmtBRL(resumo.saldo)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Visão por categoria */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">📥 Entradas por categoria</h3>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Carregando...</p>
          ) : categoriasEntrada.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sem entradas no período</p>
          ) : (
            <div className="space-y-2">
              {categoriasEntrada.map((c, i) => (
                <div key={c.id ?? 'null'} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.cor ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="flex-1 text-sm text-gray-700 truncate">{c.icone ? `${c.icone} ` : ''}{c.nome}</span>
                  <div className="w-24 bg-gray-100 rounded-full h-2 mx-2 hidden sm:block">
                    <div className="bg-green-400 h-2 rounded-full" style={{ width: `${Math.min(c.percentual, 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{c.percentual.toFixed(0)}%</span>
                  <span className="text-sm font-semibold text-green-700 w-24 text-right">{fmtBRL(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">📤 Saídas por categoria</h3>
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Carregando...</p>
          ) : categoriasSaida.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sem saídas no período</p>
          ) : (
            <div className="space-y-2">
              {categoriasSaida.map((c, i) => (
                <div key={c.id ?? 'null'} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.cor ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="flex-1 text-sm text-gray-700 truncate">{c.icone ? `${c.icone} ` : ''}{c.nome}</span>
                  <div className="w-24 bg-gray-100 rounded-full h-2 mx-2 hidden sm:block">
                    <div className="bg-red-400 h-2 rounded-full" style={{ width: `${Math.min(c.percentual, 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{c.percentual.toFixed(0)}%</span>
                  <span className="text-sm font-semibold text-red-700 w-24 text-right">{fmtBRL(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status de fechamentos */}
      {fechamentos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">🔒 Status de fechamentos — últimos meses</h3>
          <div className="flex flex-wrap gap-2">
            {fechamentos.slice(0, 12).map(f => (
              <span
                key={f.mes_referencia}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  f.status === 'fechado'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {mesLabel(f.mes_referencia)} {f.mes_referencia.split('-')[0]} · {f.status === 'fechado' ? '✅ Fechado' : '⏳ Aberto'}
              </span>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
