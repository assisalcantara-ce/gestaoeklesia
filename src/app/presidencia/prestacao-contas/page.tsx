'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { FileText, Printer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }

interface RawLanc {
  congregacao_id: string | null;
  tipo_movimento: string;
  valor: number;
  categoria_id: string | null;
}

interface RawLancSimples {
  tipo_movimento: string;
  valor: number;
}

interface FinCategoria {
  id: string;
  nome: string;
  tipo_movimento: string;
}

interface CatAggregate {
  id: string | null;
  nome: string;
  total: number;
  count: number;
}

interface RawFechamento {
  congregacao_id: string | null;
  mes_referencia: string;
  status: string;
  fechado_em: string | null;
  saldo_final: number | null;
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

const mesAtual = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return `${MESES_LABEL[Number(m) - 1]} de ${y}`;
}

function monthShort(ym: string) {
  const [y, m] = ym.split('-');
  return `${MESES_LABEL[Number(m) - 1].slice(0, 3)}/${y}`;
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

function aggregateByCat(
  lancs: RawLanc[],
  cats: FinCategoria[],
  tipo: 'entrada' | 'saida',
): CatAggregate[] {
  const opposite = tipo === 'entrada' ? 'saida' : 'entrada';
  const map = new Map<string | null, CatAggregate>();
  map.set(null, { id: null, nome: 'Sem categoria', total: 0, count: 0 });
  cats
    .filter(c => c.tipo_movimento !== opposite)
    .forEach(c => map.set(c.id, { id: c.id, nome: c.nome, total: 0, count: 0 }));

  lancs
    .filter(l => l.tipo_movimento === tipo)
    .forEach(l => {
      const key = l.categoria_id ?? null;
      const entry = map.get(key) ?? map.get(null)!;
      entry.total += Number(l.valor);
      entry.count++;
    });

  const semCat = map.get(null)!;
  if (semCat.total === 0) map.delete(null);

  return Array.from(map.values())
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);
}

// ── Print HTML builder ────────────────────────────────────────────────────────

interface PrintData {
  ministryNome: string;
  congNome: string;
  filtroMes: string;
  mesAntKey: string;
  saldoAnterior: number;
  saldoAtual: number;
  resumoMes: Resumo;
  resumoMesAnt: Resumo;
  receitasCat: CatAggregate[];
  despesasCat: CatAggregate[];
  varReceita: number | null;
  varSaidas: number | null;
  varSaldo: number | null;
  countEntradas: number;
  countSaidas: number;
  generatedAt: Date;
}

function buildPrintHtml(d: PrintData): string {
  const styles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333; padding: 24px; background: #fff; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; margin-bottom: 18px; border-bottom: 2px solid #123b63; }
    .ministry { font-size: 20px; font-weight: bold; color: #123b63; }
    .tag { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 4px; }
    .cong { font-size: 12px; color: #555; margin-top: 3px; }
    .period { font-size: 15px; font-weight: bold; color: #123b63; text-align: right; }
    .generated { font-size: 9px; color: #9ca3af; margin-top: 4px; text-align: right; }
    .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 16px 0 8px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
    .scard { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
    .scard-label { font-size: 9px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
    .scard-value { font-size: 15px; font-weight: bold; }
    .scard-sub { font-size: 9px; color: #9ca3af; margin-top: 3px; }
    .border-gray { border-left: 4px solid #9ca3af; }
    .border-green { border-left: 4px solid #22c55e; }
    .border-red { border-left: 4px solid #ef4444; }
    .border-blue { border-left: 4px solid #3b82f6; }
    .border-orange { border-left: 4px solid #f97316; }
    .color-gray { color: #374151; }
    .color-green { color: #15803d; }
    .color-red { color: #dc2626; }
    .color-blue { color: #1d4ed8; }
    .color-orange { color: #c2410c; }
    .section-hdr { padding: 8px 12px; font-size: 11px; font-weight: bold; margin-top: 4px; }
    .hdr-green { background: #f0fdf4; color: #166534; border-left: 4px solid #22c55e; }
    .hdr-red { background: #fef2f2; color: #991b1b; border-left: 4px solid #ef4444; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px; }
    thead th { background: #f9fafb; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; padding: 7px 10px; border-bottom: 2px solid #e5e7eb; font-weight: bold; }
    th:not(:first-child) { text-align: right; }
    td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
    td:not(:first-child) { text-align: right; }
    tr.even td { background: #f9fafb; }
    tfoot td { border-top: 2px solid #d1d5db; background: #f3f4f6; font-weight: bold; padding: 8px 10px; }
    .comp { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
    .ccard { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; background: #f9fafb; }
    .ccard-label { font-size: 9px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
    .ccard-atual { font-size: 14px; font-weight: bold; }
    .ccard-ant { font-size: 9px; color: #9ca3af; margin-top: 3px; }
    .ccard-var { font-size: 11px; font-weight: bold; margin-top: 4px; }
    .var-pos { color: #15803d; }
    .var-neg { color: #dc2626; }
    .var-nil { color: #9ca3af; }
    .footer { text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 14px; }
    .empty { color: #9ca3af; text-align: center; padding: 12px 10px; font-size: 11px; }
    @page { size: A4 portrait; margin: 1.5cm; }
    @media print { body { padding: 0; } }
  `;

  const varHtml = (pct: number | null) => {
    if (pct === null) return `<span class="var-nil">sem dados anteriores</span>`;
    const cls = pct > 0 ? 'var-pos' : pct < 0 ? 'var-neg' : 'var-nil';
    return `<span class="${cls}">${pct > 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;
  };

  const catRows = (cats: CatAggregate[], total: number, colorClass: string) =>
    cats.length === 0
      ? `<tr><td colspan="4" class="empty">Nenhum registro no período</td></tr>`
      : cats.map((c, i) => {
          const pct = total > 0 ? (c.total / total) * 100 : 0;
          return `<tr class="${i % 2 === 1 ? 'even' : ''}">
            <td>${esc(c.nome)}</td>
            <td>${c.count}</td>
            <td class="${colorClass}">${esc(fmtBRL(c.total))}</td>
            <td>${pct.toFixed(1)}%</td>
          </tr>`;
        }).join('');

  const saldoAtualBorder = d.saldoAtual >= 0 ? 'border-blue' : 'border-orange';
  const saldoAtualColor  = d.saldoAtual >= 0 ? 'color-blue' : 'color-orange';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Prestação de Contas — ${esc(d.congNome)} — ${esc(monthLabel(d.filtroMes))}</title>
  <style>${styles}</style>
</head>
<body>

<div class="page-header">
  <div>
    <div class="tag">Prestação de Contas Mensal</div>
    <div class="ministry">${esc(d.ministryNome || 'Ministério')}</div>
    <div class="cong">${esc(d.congNome)}</div>
  </div>
  <div>
    <div class="period">${esc(monthLabel(d.filtroMes))}</div>
    <div class="generated">Gerado em ${esc(fmtDate(d.generatedAt))}</div>
  </div>
</div>

<div class="section-title">Resumo do Período</div>
<div class="summary">
  <div class="scard border-gray">
    <div class="scard-label">Saldo Anterior</div>
    <div class="scard-value color-gray">${esc(fmtBRL(d.saldoAnterior))}</div>
    <div class="scard-sub">acumulado até ${esc(monthShort(d.mesAntKey))}</div>
  </div>
  <div class="scard border-green">
    <div class="scard-label">(+) Entradas</div>
    <div class="scard-value color-green">${esc(fmtBRL(d.resumoMes.entradas))}</div>
    <div class="scard-sub">${d.countEntradas} lançamento${d.countEntradas !== 1 ? 's' : ''}</div>
  </div>
  <div class="scard border-red">
    <div class="scard-label">(−) Saídas</div>
    <div class="scard-value color-red">${esc(fmtBRL(d.resumoMes.saidas))}</div>
    <div class="scard-sub">${d.countSaidas} lançamento${d.countSaidas !== 1 ? 's' : ''}</div>
  </div>
  <div class="scard ${saldoAtualBorder}">
    <div class="scard-label">(=) Saldo Atual</div>
    <div class="scard-value ${saldoAtualColor}">${esc(fmtBRL(d.saldoAtual))}</div>
    <div class="scard-sub">em ${esc(monthShort(d.filtroMes))}</div>
  </div>
</div>

<div class="section-hdr hdr-green">Receitas por Categoria — ${esc(monthLabel(d.filtroMes))}</div>
<table>
  <thead><tr>
    <th style="text-align:left">Categoria</th>
    <th>Qtd</th><th>Total</th><th>%</th>
  </tr></thead>
  <tbody>${catRows(d.receitasCat, d.resumoMes.entradas, 'color-green')}</tbody>
  <tfoot><tr>
    <td colspan="2">TOTAL RECEITAS</td>
    <td class="color-green">${esc(fmtBRL(d.resumoMes.entradas))}</td>
    <td>100%</td>
  </tr></tfoot>
</table>

<div class="section-hdr hdr-red">Despesas por Categoria — ${esc(monthLabel(d.filtroMes))}</div>
<table>
  <thead><tr>
    <th style="text-align:left">Categoria</th>
    <th>Qtd</th><th>Total</th><th>%</th>
  </tr></thead>
  <tbody>${catRows(d.despesasCat, d.resumoMes.saidas, 'color-red')}</tbody>
  <tfoot><tr>
    <td colspan="2">TOTAL DESPESAS</td>
    <td class="color-red">${esc(fmtBRL(d.resumoMes.saidas))}</td>
    <td>100%</td>
  </tr></tfoot>
</table>

<div class="section-title">Comparativo — ${esc(monthShort(d.filtroMes))} vs ${esc(monthShort(d.mesAntKey))}</div>
<div class="comp">
  <div class="ccard">
    <div class="ccard-label">Receitas</div>
    <div class="ccard-atual color-green">${esc(fmtBRL(d.resumoMes.entradas))}</div>
    <div class="ccard-ant">${esc(monthShort(d.mesAntKey))}: ${esc(fmtBRL(d.resumoMesAnt.entradas))}</div>
    <div class="ccard-var">${varHtml(d.varReceita)}</div>
  </div>
  <div class="ccard">
    <div class="ccard-label">Despesas</div>
    <div class="ccard-atual color-red">${esc(fmtBRL(d.resumoMes.saidas))}</div>
    <div class="ccard-ant">${esc(monthShort(d.mesAntKey))}: ${esc(fmtBRL(d.resumoMesAnt.saidas))}</div>
    <div class="ccard-var">${varHtml(d.varSaidas)}</div>
  </div>
  <div class="ccard">
    <div class="ccard-label">Saldo do Mês</div>
    <div class="ccard-atual ${d.resumoMes.saldo >= 0 ? 'color-blue' : 'color-orange'}">${esc(fmtBRL(d.resumoMes.saldo))}</div>
    <div class="ccard-ant">${esc(monthShort(d.mesAntKey))}: ${esc(fmtBRL(d.resumoMesAnt.saldo))}</div>
    <div class="ccard-var">${varHtml(d.varSaldo)}</div>
  </div>
</div>

<div class="footer">
  Relatório gerado automaticamente pelo <strong>Gestão Eklesia</strong> em ${esc(fmtDate(d.generatedAt))}
  &nbsp;•&nbsp; Dados baseados nos lançamentos registrados no sistema
</div>

</body>
</html>`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const anoAtualNum = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => anoAtualNum - 2 + i);
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

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-400">—</span>;
  const pos = pct > 0;
  const neg = pct < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${pos ? 'text-green-700' : neg ? 'text-red-600' : 'text-gray-400'}`}>
      {pos ? <TrendingUp size={13} /> : neg ? <TrendingDown size={13} /> : <Minus size={13} />}
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrestacaoContasPage() {
  const { ctx, bloqueado } = useRequireModulo('consolidado_financeiro');
  const supabase = useMemo(() => createClient(), []);

  const [filtroMes, setFiltroMes]   = useState(mesAtual);
  const [filtroCong, setFiltroCong] = useState('');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [ministryNome, setMinistryNome] = useState('');
  const [loading, setLoading]       = useState(false);
  const [generated, setGenerated]   = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  // Data
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [lancMes, setLancMes]           = useState<RawLanc[]>([]);
  const [lancAnterior, setLancAnterior] = useState<RawLancSimples[]>([]);
  const [lancMesAnt, setLancMesAnt]     = useState<RawLancSimples[]>([]);
  const [categorias, setCategorias]     = useState<FinCategoria[]>([]);
  const [fechMes, setFechMes]           = useState<RawFechamento[]>([]);

  // Resolve ministry id
  useEffect(() => {
    if (ctx.loading || bloqueado) return;
    if (ctx.ministryId) { setMinistryId(ctx.ministryId); return; }
    resolveMinistryId(supabase).then(id => setMinistryId(id ?? null));
  }, [ctx.loading, ctx.ministryId, bloqueado, supabase]);

  // Load congregacoes + ministry name
  useEffect(() => {
    if (!ministryId) return;
    const load = async () => {
      const [resCongs, resMin] = await Promise.all([
        supabase.from('congregacoes').select('id, nome').eq('ministry_id', ministryId).eq('is_active', true).order('nome'),
        supabase.from('ministries').select('nome').eq('id', ministryId).maybeSingle(),
      ]);
      setCongregacoes((resCongs.data ?? []) as Congregacao[]);
      setMinistryNome((resMin.data as { nome?: string } | null)?.nome ?? '');
    };
    void load();
  }, [ministryId, supabase]);

  // ── Gerar relatório ───────────────────────────────────────────────────────

  const gerarRelatorio = useCallback(async () => {
    if (!ministryId) return;
    setLoading(true);
    setGenerated(false);
    try {
      const mesAnt = prevMonth(filtroMes);
      const [inicioMes, fimMes]       = dateRange(filtroMes);
      const [inicioMesAnt, fimMesAnt] = dateRange(mesAnt);

      // ─ Queries com filtro opcional de congregação ─────────────────────────

      let qMes = supabase
        .from('tesouraria_lancamentos')
        .select('congregacao_id, tipo_movimento, valor, categoria_id')
        .eq('ministry_id', ministryId)
        .gte('data_lancamento', inicioMes)
        .lt('data_lancamento', fimMes);

      let qAnt = supabase
        .from('tesouraria_lancamentos')
        .select('tipo_movimento, valor')
        .eq('ministry_id', ministryId)
        .lt('data_lancamento', inicioMes);

      let qMesAnt = supabase
        .from('tesouraria_lancamentos')
        .select('tipo_movimento, valor')
        .eq('ministry_id', ministryId)
        .gte('data_lancamento', inicioMesAnt)
        .lt('data_lancamento', fimMesAnt);

      if (filtroCong === '__sede__') {
        qMes    = qMes.is('congregacao_id', null);
        qAnt    = qAnt.is('congregacao_id', null);
        qMesAnt = qMesAnt.is('congregacao_id', null);
      } else if (filtroCong) {
        qMes    = qMes.eq('congregacao_id', filtroCong);
        qAnt    = qAnt.eq('congregacao_id', filtroCong);
        qMesAnt = qMesAnt.eq('congregacao_id', filtroCong);
      }

      const [resLancMes, resLancAnt, resLancMesAnt, resCats] = await Promise.all([
        qMes,
        qAnt,
        qMesAnt,
        supabase
          .from('fin_categorias')
          .select('id, nome, tipo_movimento')
          .or(`ministry_id.is.null,ministry_id.eq.${ministryId}`)
          .eq('is_ativa', true),
      ]);

      setLancMes((resLancMes.data ?? []) as RawLanc[]);
      setLancAnterior((resLancAnt.data ?? []) as RawLancSimples[]);
      setLancMesAnt((resLancMesAnt.data ?? []) as RawLancSimples[]);
      setCategorias((resCats.data ?? []) as FinCategoria[]);

      const resFechs = await supabase
        .from('tesouraria_fechamentos')
        .select('congregacao_id, mes_referencia, status, fechado_em, saldo_final')
        .eq('ministry_id', ministryId)
        .eq('mes_referencia', filtroMes);
      setFechMes((resFechs.data ?? []) as RawFechamento[]);

      setGeneratedAt(new Date());
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }, [ministryId, filtroMes, filtroCong, supabase]);

  // ── Derivados ─────────────────────────────────────────────────────────────

  const resumoMes    = useMemo(() => computeResumo(lancMes),      [lancMes]);
  const resumoAnt    = useMemo(() => computeResumo(lancAnterior), [lancAnterior]);
  const resumoMesAnt = useMemo(() => computeResumo(lancMesAnt),   [lancMesAnt]);

  const saldoAnterior = resumoAnt.saldo;
  const saldoAtual    = saldoAnterior + resumoMes.entradas - resumoMes.saidas;

  const receitasCat = useMemo(
    () => aggregateByCat(lancMes, categorias, 'entrada'),
    [lancMes, categorias],
  );
  const despesasCat = useMemo(
    () => aggregateByCat(lancMes, categorias, 'saida'),
    [lancMes, categorias],
  );

  const varReceita = resumoMesAnt.entradas > 0
    ? ((resumoMes.entradas - resumoMesAnt.entradas) / resumoMesAnt.entradas) * 100
    : null;
  const varSaidas = resumoMesAnt.saidas > 0
    ? ((resumoMes.saidas - resumoMesAnt.saidas) / resumoMesAnt.saidas) * 100
    : null;
  const varSaldo = Math.abs(resumoMesAnt.saldo) > 0
    ? ((resumoMes.saldo - resumoMesAnt.saldo) / Math.abs(resumoMesAnt.saldo)) * 100
    : null;

  const congNome = useMemo(() => {
    if (filtroCong === '__sede__') return 'Sede / Caixa Geral';
    if (!filtroCong) return 'Todas as Congregações';
    return congregacoes.find(c => c.id === filtroCong)?.nome ?? '—';
  }, [filtroCong, congregacoes]);

  const countEntradas = lancMes.filter(l => l.tipo_movimento === 'entrada').length;
  const countSaidas   = lancMes.filter(l => l.tipo_movimento !== 'entrada').length;

  const mesAntKey = prevMonth(filtroMes);

  // ── Print handler ─────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    if (!generated || !generatedAt) return;

    const pw = window.open('', '_blank', 'width=900,height=700,toolbar=0,menubar=0');
    if (!pw) {
      alert('Por favor, permita popups para este site para usar a impressão.');
      return;
    }

    const html = buildPrintHtml({
      ministryNome,
      congNome,
      filtroMes,
      mesAntKey,
      saldoAnterior,
      saldoAtual,
      resumoMes,
      resumoMesAnt,
      receitasCat,
      despesasCat,
      varReceita,
      varSaidas,
      varSaldo,
      countEntradas,
      countSaidas,
      generatedAt,
    });

    pw.document.write(html);
    pw.document.close();
    pw.focus();
    setTimeout(() => {
      pw.print();
    }, 700);
  }, [
    generated, generatedAt, ministryNome, congNome, filtroMes, mesAntKey,
    saldoAnterior, saldoAtual, resumoMes, resumoMesAnt,
    receitasCat, despesasCat, varReceita, varSaidas, varSaldo,
    countEntradas, countSaidas,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (ctx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;

  return (
    <PageLayout
      title="Prestação de Contas"
      description="Relatório financeiro mensal automatizado por congregação"
      activeMenu="prestacao-contas"
    >
      {/* ── Painel de Controle ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-semibold text-[#123b63] uppercase tracking-wide mb-4">
          Parâmetros do Relatório
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Período</label>
            <MonthPicker value={filtroMes} onChange={setFiltroMes} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Congregação</label>
            <select
              value={filtroCong}
              onChange={e => setFiltroCong(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-[200px]"
            >
              <option value="">Todas as congregações</option>
              <option value="__sede__">Sede / Caixa Geral</option>
              {congregacoes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void gerarRelatorio()}
            disabled={loading || !ministryId}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#123b63] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d7a] disabled:opacity-50 transition"
          >
            <FileText size={15} />
            {loading ? 'Gerando…' : 'Gerar Relatório'}
          </button>
          {generated && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 border border-[#123b63] text-[#123b63] rounded-lg text-sm font-medium hover:bg-[#123b63]/5 transition"
            >
              <Printer size={15} />
              Imprimir / PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="py-16 text-center text-gray-400">
          <div className="inline-block w-8 h-8 border-4 border-[#123b63]/20 border-t-[#123b63] rounded-full animate-spin mb-3" />
          <p className="text-sm">Processando lançamentos…</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !generated && (
        <div className="py-16 text-center text-gray-400">
          <FileText size={44} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm">Selecione o período e a congregação, depois clique em <strong>Gerar Relatório</strong></p>
        </div>
      )}

      {/* ── Relatório ── */}
      {!loading && generated && (
        <div className="space-y-4">

          {/* Cabeçalho do relatório */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                  Prestação de Contas Mensal
                </p>
                <h1 className="text-2xl font-bold text-[#123b63]">
                  {ministryNome || 'Ministério'}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">{congNome}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[#123b63]">{monthLabel(filtroMes)}</p>
                {generatedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Gerado em {fmtDate(generatedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Resumo do Período
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-400">
                <p className="text-xs text-gray-500 mb-1">Saldo Anterior</p>
                <p className={`text-xl font-bold ${saldoAnterior >= 0 ? 'text-gray-700' : 'text-orange-600'}`}>
                  {fmtBRL(saldoAnterior)}
                </p>
                <p className="text-xs text-gray-400 mt-1">acumulado até {monthShort(mesAntKey)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-400">
                <p className="text-xs text-gray-500 mb-1">(+) Entradas</p>
                <p className="text-xl font-bold text-green-700">{fmtBRL(resumoMes.entradas)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {countEntradas} lançamento{countEntradas !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-400">
                <p className="text-xs text-gray-500 mb-1">(−) Saídas</p>
                <p className="text-xl font-bold text-red-600">{fmtBRL(resumoMes.saidas)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {countSaidas} lançamento{countSaidas !== 1 ? 's' : ''}
                </p>
              </div>
              <div className={`rounded-lg p-4 border-l-4 ${saldoAtual >= 0 ? 'bg-blue-50 border-blue-500' : 'bg-orange-50 border-orange-500'}`}>
                <p className="text-xs text-gray-500 mb-1">(=) Saldo Atual</p>
                <p className={`text-xl font-bold ${saldoAtual >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
                  {fmtBRL(saldoAtual)}
                </p>
                <p className="text-xs text-gray-400 mt-1">em {monthShort(filtroMes)}</p>
              </div>
            </div>
          </div>

          {/* Receitas por Categoria */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-3.5 bg-green-50 border-b border-green-100">
              <h3 className="font-semibold text-green-800">
                Receitas por Categoria — {monthLabel(filtroMes)}
              </h3>
            </div>
            {receitasCat.length === 0 ? (
              <p className="px-6 py-6 text-sm text-gray-400 text-center">
                Nenhuma receita registrada no período
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Categoria</th>
                    <th className="text-right px-4 py-3">Qtd</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-6 py-3">% s/ Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receitasCat.map((c, i) => {
                    const pct = resumoMes.entradas > 0
                      ? (c.total / resumoMes.entradas) * 100
                      : 0;
                    return (
                      <tr
                        key={c.id ?? 'sem'}
                        className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                      >
                        <td className="px-6 py-3 font-medium text-gray-700">{c.nome}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{c.count}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">
                          {fmtBRL(c.total)}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-500">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-green-50">
                    <td className="px-6 py-3 font-bold text-gray-800" colSpan={2}>
                      TOTAL RECEITAS
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">
                      {fmtBRL(resumoMes.entradas)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500 font-semibold">100%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Despesas por Categoria */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-3.5 bg-red-50 border-b border-red-100">
              <h3 className="font-semibold text-red-800">
                Despesas por Categoria — {monthLabel(filtroMes)}
              </h3>
            </div>
            {despesasCat.length === 0 ? (
              <p className="px-6 py-6 text-sm text-gray-400 text-center">
                Nenhuma despesa registrada no período
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Categoria</th>
                    <th className="text-right px-4 py-3">Qtd</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-6 py-3">% s/ Total</th>
                  </tr>
                </thead>
                <tbody>
                  {despesasCat.map((c, i) => {
                    const pct = resumoMes.saidas > 0
                      ? (c.total / resumoMes.saidas) * 100
                      : 0;
                    return (
                      <tr
                        key={c.id ?? 'sem'}
                        className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                      >
                        <td className="px-6 py-3 font-medium text-gray-700">{c.nome}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{c.count}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {fmtBRL(c.total)}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-500">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-red-50">
                    <td className="px-6 py-3 font-bold text-gray-800" colSpan={2}>
                      TOTAL DESPESAS
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      {fmtBRL(resumoMes.saidas)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500 font-semibold">100%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Comparativo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Comparativo — {monthShort(filtroMes)} vs {monthShort(mesAntKey)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: 'Receitas',
                  atual: resumoMes.entradas,
                  ant: resumoMesAnt.entradas,
                  pct: varReceita,
                  colorClass: 'text-green-700',
                  bg: 'bg-green-50',
                },
                {
                  label: 'Despesas',
                  atual: resumoMes.saidas,
                  ant: resumoMesAnt.saidas,
                  pct: varSaidas,
                  colorClass: 'text-red-600',
                  bg: 'bg-red-50',
                },
                {
                  label: 'Saldo do Mês',
                  atual: resumoMes.saldo,
                  ant: resumoMesAnt.saldo,
                  pct: varSaldo,
                  colorClass: resumoMes.saldo >= 0 ? 'text-blue-700' : 'text-orange-600',
                  bg: 'bg-blue-50',
                },
              ].map(row => (
                <div key={row.label} className={`${row.bg} rounded-lg p-4`}>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
                    {row.label}
                  </p>
                  <p className={`text-lg font-bold ${row.colorClass}`}>
                    {fmtBRL(row.atual)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {monthShort(mesAntKey)}: {fmtBRL(row.ant)}
                  </p>
                  <div className="mt-2">
                    <DeltaBadge pct={row.pct} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Situação dos Fechamentos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-3.5 bg-blue-50 border-b border-blue-100">
              <h3 className="font-semibold text-blue-800 text-sm">
                Situação dos Fechamentos — {monthLabel(filtroMes)}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Congregação</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo Final</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fechado em</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dias em Atraso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { id: null as string | null, nome: 'Sede / Caixa Geral' },
                    ...congregacoes.map(c => ({ id: c.id, nome: c.nome })),
                  ].map((cx, i) => {
                    const fec = fechMes.find(f =>
                      cx.id === null ? f.congregacao_id === null : f.congregacao_id === cx.id,
                    );
                    const isFechado = fec?.status === 'fechado';
                    const [y, mo] = filtroMes.split('-').map(Number);
                    const fimMesRef = new Date(y, mo, 0);
                    const diasAtraso = isFechado ? 0 : Math.max(0, Math.floor((Date.now() - fimMesRef.getTime()) / 86400000));
                    return (
                      <tr key={cx.id ?? '__sede__'} className={`hover:bg-gray-50/60 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-6 py-3 font-medium text-gray-700">{cx.nome}</td>
                        <td className="px-6 py-3 text-right font-semibold text-gray-700">
                          {fec?.saldo_final != null ? fmtBRL(Number(fec.saldo_final)) : '—'}
                        </td>
                        <td className="px-6 py-3 text-center text-gray-500 text-xs">
                          {fec?.fechado_em ? fmtDate(new Date(fec.fechado_em)) : '—'}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {isFechado
                            ? <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">✓ Fechado</span>
                            : <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-semibold">Pendente</span>
                          }
                        </td>
                        <td className="px-6 py-3 text-right">
                          {isFechado
                            ? <span className="text-gray-400">—</span>
                            : <span className="font-semibold text-red-600 text-xs">{diasAtraso} dias</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rodapé do relatório */}
          <p className="text-center text-xs text-gray-400 py-3 border-t border-gray-100">
            Relatório gerado automaticamente pelo <strong>Gestão Eklesia</strong>
            {generatedAt && ` em ${fmtDate(generatedAt)}`}
            {' '}• Dados baseados nos lançamentos registrados no sistema
          </p>

        </div>
      )}
    </PageLayout>
  );
}
