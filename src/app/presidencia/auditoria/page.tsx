'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  Shield, AlertTriangle, CheckCircle2, Activity, ClipboardList,
  Download, Printer, ChevronUp, ChevronDown, TrendingDown,
  XCircle, AlertCircle, Info,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }

interface RawLanc {
  id: string;
  congregacao_id: string | null;
  tipo_movimento: string;
  valor: number;
  categoria_id: string | null;
  data_lancamento: string;
  descricao: string | null;
  created_at: string;
}

interface Fechamento {
  id: string;
  congregacao_id: string | null;
  mes_referencia: string;
  saldo_inicial: number;
  total_entradas: number;
  total_saidas: number;
  saldo_final: number;
  status: string;
  fechado_em: string | null;
  created_at: string;
}

interface PixAlerta {
  id: string;
  destination_id: string;
  valor_pago: number | null;
  payer_name: string | null;
  paid_at: string | null;
  created_at: string;
}

interface EventoAlerta {
  id: string;
  valor: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface FpDestino { id: string; congregacao_id: string | null; label: string; }

interface AuditLog {
  id: string;
  executado_em: string;
  tipo_auditoria: string;
  resultado: string;
  total_alertas: number;
  created_at: string;
}

type Classificacao = 'Excelente' | 'Boa' | 'Atenção' | 'Crítica';

interface ScoreEntry {
  id: string | null;
  nome: string;
  score: number;
  classificacao: Classificacao;
  totalAlertas: number;
  alertasDetalhes: string[];
}

type TabId = 'alertas' | 'validacoes' | 'score' | 'log';
type SortCol = 'score' | 'nome' | 'alertas';

// ── Constantes ────────────────────────────────────────────────────────────────

const LOOKBACK_MESES = 3;   // meses anteriores para checar fechamento
const INATIVIDADE_DIAS = 30; // dias sem lançamento = alerta

const MESES_BR = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('pt-BR');

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MESES_BR[Number(m) - 1]}/${y}`;
}

function classificar(score: number): Classificacao {
  if (score >= 90) return 'Excelente';
  if (score >= 70) return 'Boa';
  if (score >= 50) return 'Atenção';
  return 'Crítica';
}

function classBadge(c: Classificacao): string {
  switch (c) {
    case 'Excelente': return 'bg-green-100 text-green-800';
    case 'Boa':       return 'bg-blue-100  text-blue-800';
    case 'Atenção':   return 'bg-yellow-100 text-yellow-800';
    case 'Crítica':   return 'bg-red-100   text-red-700';
  }
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-700';
  if (score >= 70) return 'text-blue-700';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

/** Retorna os meses anteriores (YYYY-MM) que devem ter fechamento */
function getMesesParaVerificar(): string[] {
  const result: string[] = [];
  const hoje = new Date();
  for (let i = 1; i <= LOOKBACK_MESES; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: {
  label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-6 py-8 text-center text-sm text-gray-400">{msg}</td>
    </tr>
  );
}

function SortBtn({ col, current, dir, onClick }: {
  col: SortCol; current: SortCol; dir: 'asc' | 'desc'; onClick: () => void;
}) {
  const active = col === current;
  return (
    <button onClick={onClick} className="inline-flex items-center gap-0.5 hover:text-[#123b63]">
      {active
        ? dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        : <ChevronDown size={12} className="opacity-30" />}
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AuditoriaFinanceiraPage() {
  const { ctx, bloqueado } = useRequireModulo('consolidado_financeiro');
  const supabase = useMemo(() => createClient(), []);

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('alertas');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [logTableExists, setLogTableExists] = useState(true);

  // Raw data
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [lancamentos, setLancamentos] = useState<RawLanc[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [pixSemLanc, setPixSemLanc] = useState<PixAlerta[]>([]);
  const [eventoSemLanc, setEventoSemLanc] = useState<EventoAlerta[]>([]);
  const [destinos, setDestinos] = useState<FpDestino[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Score sort
  const [sortBy, setSortBy] = useState<SortCol>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Resolve ministry id
  useEffect(() => {
    if (ctx.loading || bloqueado) return;
    if (ctx.ministryId) { setMinistryId(ctx.ministryId); return; }
    resolveMinistryId(supabase).then(id => setMinistryId(id ?? null));
  }, [ctx.loading, ctx.ministryId, bloqueado, supabase]);

  // Load audit logs on mount / after auditoria runs
  const loadLogs = useCallback(async (mid: string) => {
    try {
      const { data, error } = await supabase
        .from('financial_audit_logs')
        .select('id, executado_em, tipo_auditoria, resultado, total_alertas, created_at')
        .eq('ministry_id', mid)
        .order('executado_em', { ascending: false })
        .limit(50);
      if (error) { setLogTableExists(false); return; }
      setAuditLogs((data ?? []) as AuditLog[]);
    } catch {
      setLogTableExists(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (ministryId) void loadLogs(ministryId);
  }, [ministryId, loadLogs]);

  // ── Main Audit Loader ─────────────────────────────────────────────────────

  const rodarAuditoria = useCallback(async () => {
    if (!ministryId) return;
    setLoading(true);
    setGenerated(false);
    try {
      const [
        resCongs,
        resLancs,
        resFechs,
        resPix,
        resEvts,
        resDest,
      ] = await Promise.all([
        // 1. Congregações ativas
        supabase
          .from('congregacoes')
          .select('id, nome')
          .eq('ministry_id', ministryId)
          .eq('is_active', true)
          .order('nome'),

        // 2. Lançamentos — campos mínimos necessários para todos os cálculos
        supabase
          .from('tesouraria_lancamentos')
          .select('id, congregacao_id, tipo_movimento, valor, categoria_id, data_lancamento, descricao, created_at')
          .eq('ministry_id', ministryId)
          .order('data_lancamento', { ascending: false })
          .limit(2000),

        // 3. Fechamentos mensais
        supabase
          .from('tesouraria_fechamentos')
          .select('id, congregacao_id, mes_referencia, saldo_inicial, total_entradas, total_saidas, saldo_final, status, fechado_em, created_at')
          .eq('ministry_id', ministryId)
          .order('mes_referencia', { ascending: false }),

        // 4. PIX pago sem lançamento financeiro
        supabase
          .from('fin_payment_charges')
          .select('id, destination_id, valor_pago, payer_name, paid_at, created_at')
          .eq('ministry_id', ministryId)
          .eq('status', 'pago')
          .is('tesouraria_lancamento_id', null)
          .limit(200),

        // 5. Eventos pagos sem lançamento financeiro
        supabase
          .from('eventos_pagamentos')
          .select('id, valor, status, paid_at, created_at')
          .eq('ministry_id', ministryId)
          .eq('status', 'pago')
          .is('tesouraria_lancamento_id', null)
          .limit(200),

        // 6. Destinos PIX (para resolver congregação → label)
        supabase
          .from('fin_payment_destinations')
          .select('id, congregacao_id, label')
          .eq('ministry_id', ministryId),
      ]);

      const congs  = (resCongs.data  ?? []) as Congregacao[];
      const lancs  = (resLancs.data  ?? []) as RawLanc[];
      const fechs  = (resFechs.data  ?? []) as Fechamento[];
      const pixs   = (resPix.data    ?? []) as PixAlerta[];
      const evts   = (resEvts.data   ?? []) as EventoAlerta[];
      const dests  = (resDest.data   ?? []) as FpDestino[];

      setCongregacoes(congs);
      setLancamentos(lancs);
      setFechamentos(fechs);
      setPixSemLanc(pixs);
      setEventoSemLanc(evts);
      setDestinos(dests);

      const now = new Date();
      setGeneratedAt(now);
      setGenerated(true);

      // Calcular total de alertas para o log (por congregação)
      const allCongIdsAudit = [null as string | null, ...congs.map(c => c.id)];
      let congsSemFechamCount = 0;
      for (const mes of getMesesParaVerificar()) {
        for (const cid of allCongIdsAudit) {
          if (!fechs.some(f =>
            f.mes_referencia === mes &&
            (cid === null ? f.congregacao_id === null : f.congregacao_id === cid)
          )) congsSemFechamCount++;
        }
      }

      const hoje = Date.now();
      const ultimoLancMap = new Map<string, Date>();
      lancs.forEach(l => {
        const key = l.congregacao_id ?? '__sede__';
        const d = new Date(l.data_lancamento);
        const ex = ultimoLancMap.get(key);
        if (!ex || d > ex) ultimoLancMap.set(key, d);
      });

      const allCongIds = [null as string | null, ...congs.map(c => c.id)];
      const congSemMov = allCongIds.filter(id => {
        const ult = ultimoLancMap.get(id ?? '__sede__');
        return !ult || (hoje - ult.getTime()) > INATIVIDADE_DIAS * 86400000;
      });

      const lancsAux  = lancs.filter(l => !l.categoria_id);
      const divFechs  = fechs.filter(f => {
        const esp = Number(f.saldo_inicial) + Number(f.total_entradas) - Number(f.total_saidas);
        return Math.abs(esp - Number(f.saldo_final)) > 0.01;
      });
      const fechIncons = fechs.filter(f => {
        if (f.status !== 'fechado' || !f.fechado_em) return false;
        const fechadoEm = new Date(f.fechado_em);
        return lancs.some(l => new Date(l.created_at) > fechadoEm && l.data_lancamento.substring(0, 7) === f.mes_referencia);
      });

      const totalAlertas =
        congsSemFechamCount +
        congSemMov.length +
        lancsAux.length +
        pixs.length +
        evts.length +
        divFechs.length +
        fechIncons.length;

      // Registrar no log
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('financial_audit_logs').insert({
          ministry_id:   ministryId,
          executado_em:  now.toISOString(),
          usuario_id:    user?.id ?? null,
          tipo_auditoria: 'manual',
          resultado:     'concluido',
          total_alertas: totalAlertas,
        });
        await loadLogs(ministryId);
      } catch {
        setLogTableExists(false);
      }
    } finally {
      setLoading(false);
    }
  }, [ministryId, supabase, loadLogs]);

  // ── Derived Data (useMemo) ────────────────────────────────────────────────

  const congNomeMap = useMemo(() => {
    const m = new Map<string, string>();
    m.set('__sede__', 'Sede / Caixa Geral');
    congregacoes.forEach(c => m.set(c.id, c.nome));
    return m;
  }, [congregacoes]);

  const destinoMap = useMemo(() => {
    const m = new Map<string, FpDestino>();
    destinos.forEach(d => m.set(d.id, d));
    return m;
  }, [destinos]);

  const saldoPorCong = useMemo(() => {
    const m = new Map<string, { entradas: number; saidas: number; saldo: number }>();
    lancamentos.forEach(l => {
      const key = l.congregacao_id ?? '__sede__';
      const prev = m.get(key) ?? { entradas: 0, saidas: 0, saldo: 0 };
      const v = Number(l.valor);
      if (l.tipo_movimento === 'entrada') { prev.entradas += v; prev.saldo += v; }
      else                               { prev.saidas  += v; prev.saldo -= v; }
      m.set(key, prev);
    });
    return m;
  }, [lancamentos]);

  const ultimoLancPorCong = useMemo(() => {
    const m = new Map<string, Date>();
    lancamentos.forEach(l => {
      const key = l.congregacao_id ?? '__sede__';
      const d = new Date(l.data_lancamento);
      const ex = m.get(key);
      if (!ex || d > ex) m.set(key, d);
    });
    return m;
  }, [lancamentos]);

  const lancSemCategoriaPorCong = useMemo(() => {
    const m = new Map<string, number>();
    lancamentos.filter(l => !l.categoria_id).forEach(l => {
      const key = l.congregacao_id ?? '__sede__';
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return m;
  }, [lancamentos]);

  // Aba 1 — Alertas

  const congsSemFechamento = useMemo(() => {
    const meses = getMesesParaVerificar();
    const allCongs: Array<{ id: string | null; nome: string }> = [
      { id: null, nome: 'Sede / Caixa Geral' },
      ...congregacoes.map(c => ({ id: c.id, nome: c.nome })),
    ];
    const resultado: Array<{ congId: string | null; congNome: string; mes: string; diasAtraso: number }> = [];
    for (const mes of meses) {
      const [y, mo] = mes.split('-').map(Number);
      const fimMes = new Date(y, mo, 0);
      const diasAtraso = Math.max(0, Math.floor((Date.now() - fimMes.getTime()) / 86400000));
      for (const cong of allCongs) {
        const temFechamento = fechamentos.some(f =>
          f.mes_referencia === mes &&
          (cong.id === null ? f.congregacao_id === null : f.congregacao_id === cong.id),
        );
        if (!temFechamento) {
          resultado.push({ congId: cong.id, congNome: cong.nome, mes, diasAtraso });
        }
      }
    }
    return resultado;
  }, [fechamentos, congregacoes]);

  const congSemMovimento = useMemo(() => {
    const hoje = Date.now();
    return [null as string | null, ...congregacoes.map(c => c.id)]
      .map(id => {
        const key = id ?? '__sede__';
        const ult = ultimoLancPorCong.get(key);
        const dias = ult ? Math.floor((hoje - ult.getTime()) / 86400000) : null;
        return { id, nome: congNomeMap.get(key) ?? key, ultimoLanc: ult ?? null, dias };
      })
      .filter(c => !c.ultimoLanc || (c.dias !== null && c.dias > INATIVIDADE_DIAS));
  }, [congregacoes, ultimoLancPorCong, congNomeMap]);

  const congSaldoNegativo = useMemo(() =>
    [null as string | null, ...congregacoes.map(c => c.id)]
      .map(id => {
        const key = id ?? '__sede__';
        return { id, nome: congNomeMap.get(key) ?? key, saldo: saldoPorCong.get(key)?.saldo ?? 0 };
      })
      .filter(c => c.saldo < 0),
    [congregacoes, saldoPorCong, congNomeMap],
  );

  const lancSemCategoriaLista = useMemo(
    () => lancamentos.filter(l => !l.categoria_id),
    [lancamentos],
  );

  // Aba 2 — Validações

  const divergenciasFechamento = useMemo(() =>
    fechamentos
      .filter(f => {
        const esp = Number(f.saldo_inicial) + Number(f.total_entradas) - Number(f.total_saidas);
        return Math.abs(esp - Number(f.saldo_final)) > 0.01;
      })
      .map(f => {
        const esp = Number(f.saldo_inicial) + Number(f.total_entradas) - Number(f.total_saidas);
        return { ...f, esperado: esp, diferenca: Number(f.saldo_final) - esp };
      }),
    [fechamentos],
  );

  const fechamentosInconsistentes = useMemo(() =>
    fechamentos
      .filter(f => f.status === 'fechado' && f.fechado_em)
      .map(f => {
        const fechadoEm = new Date(f.fechado_em!);
        const posteriores = lancamentos.filter(
          l => new Date(l.created_at) > fechadoEm && l.data_lancamento.substring(0, 7) === f.mes_referencia,
        );
        return { ...f, posteriores };
      })
      .filter(f => f.posteriores.length > 0),
    [fechamentos, lancamentos],
  );

  // Aba 3 — Score

  const temInconsistencia = divergenciasFechamento.length > 0 || fechamentosInconsistentes.length > 0;

  const scoresPorCong = useMemo(() => {
    const allIds: Array<string | null> = [null, ...congregacoes.map(c => c.id)];
    const entries: ScoreEntry[] = allIds.map(id => {
      const key = id ?? '__sede__';
      const nome = congNomeMap.get(key) ?? key;
      let score = 100;
      const alertas: string[] = [];

      const saldo = saldoPorCong.get(key)?.saldo ?? 0;
      if (saldo < 0) { score -= 10; alertas.push('Saldo negativo'); }

      const ult = ultimoLancPorCong.get(key);
      const dias = ult ? Math.floor((Date.now() - ult.getTime()) / 86400000) : null;
      if (!ult || (dias !== null && dias > INATIVIDADE_DIAS)) { score -= 5; alertas.push('Sem movimentação'); }

      const semCat = lancSemCategoriaPorCong.get(key) ?? 0;
      if (semCat > 0) {
        const pen = Math.min(semCat * 3, 15);
        score -= pen;
        alertas.push(`${semCat} lanç. sem categoria`);
      }

      // Penalidade de fechamento: verificar SE ESSA congregação específica tem atraso
      const temFecAtrasadoCong = congsSemFechamento.some(c =>
        id === null ? c.congId === null : c.congId === id
      );
      if (temFecAtrasadoCong)  { score -= 5; alertas.push('Fechamento em atraso'); }
      if (temInconsistencia)   { score -= 5; alertas.push('Inconsistência detectada'); }

      const finalScore = Math.max(0, score);
      return { id, nome, score: finalScore, classificacao: classificar(finalScore), totalAlertas: alertas.length, alertasDetalhes: alertas };
    });

    return [...entries].sort((a, b) => {
      const cmp =
        sortBy === 'score'   ? a.score - b.score :
        sortBy === 'nome'    ? a.nome.localeCompare(b.nome) :
        /* alertas */          a.totalAlertas - b.totalAlertas;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    congregacoes, congNomeMap, saldoPorCong, ultimoLancPorCong, lancSemCategoriaPorCong,
    congsSemFechamento, temInconsistencia, sortBy, sortDir,
  ]);

  // KPIs
  const totalCongs     = congregacoes.length + 1; // +1 sede
  const congsSaudaveis = scoresPorCong.filter(s => s.score >= 90).length;
  const congsPendentes = scoresPorCong.filter(s => s.score >= 50 && s.score < 90).length;
  const congsCriticas  = scoresPorCong.filter(s => s.score < 50).length;
  const scoreMedio     = generated && scoresPorCong.length > 0
    ? Math.round(scoresPorCong.reduce((a, s) => a + s.score, 0) / scoresPorCong.length)
    : 0;

  const totalAlertas = generated
    ? congsSemFechamento.length + congSemMovimento.length + congSaldoNegativo.length +
      lancSemCategoriaLista.length + pixSemLanc.length + eventoSemLanc.length
    : 0;

  // ── Sort handler ──────────────────────────────────────────────────────────

  const handleSort = (col: SortCol) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    if (!generated) return;
    const rows = [
      ['Congregação', 'Score', 'Classificação', 'Alertas', 'Detalhes'],
      ...scoresPorCong.map(s => [
        s.nome, String(s.score), s.classificacao, String(s.totalAlertas), s.alertasDetalhes.join('; '),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `auditoria-financeira-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generated, scoresPorCong]);

  // ── Print ─────────────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    if (!generated) return;
    const pw = window.open('', '_blank', 'width=960,height=720,toolbar=0,menubar=0');
    if (!pw) { alert('Permita popups para usar a impressão.'); return; }

    const esc = (s: string) =>
      String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const scoreRows = scoresPorCong.map((s, i) => {
      return `<tr class="${i%2===1?'even':''}">
        <td>${esc(s.nome)}</td>
        <td style="font-weight:bold;text-align:right">${s.score}</td>
        <td style="text-align:center"><span class="badge ${s.classificacao.toLowerCase().replace('ã','a').replace('é','e')}">${esc(s.classificacao)}</span></td>
        <td style="text-align:right">${s.totalAlertas}</td>
        <td style="font-size:9px;color:#6b7280">${esc(s.alertasDetalhes.join(', '))}</td>
      </tr>`;
    }).join('');

    const alertRows = lancSemCategoriaLista.slice(0, 50).map((l, i) =>
      `<tr class="${i%2===1?'even':''}">
        <td>${esc(fmtDate(l.data_lancamento))}</td>
        <td>${esc(congNomeMap.get(l.congregacao_id ?? '__sede__') ?? '—')}</td>
        <td style="text-align:right;color:${l.tipo_movimento==='entrada'?'#15803d':'#dc2626'}">${esc(fmtBRL(Number(l.valor)))}</td>
        <td>${esc(l.descricao ?? '—')}</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Auditoria Financeira</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#333;padding:20px;background:#fff}
        h1{font-size:18px;font-weight:bold;color:#123b63;margin-bottom:2px}
        h2{font-size:12px;font-weight:bold;color:#123b63;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb;text-transform:uppercase;letter-spacing:.04em}
        .sub{font-size:10px;color:#6b7280;margin-bottom:12px}
        .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:14px}
        .kpi{border:1px solid #e5e7eb;border-radius:5px;padding:7px 10px}
        .kpi-label{font-size:8px;text-transform:uppercase;color:#9ca3af;margin-bottom:2px}
        .kpi-value{font-size:15px;font-weight:bold}
        table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px}
        th{background:#f9fafb;padding:5px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;border-bottom:2px solid #e5e7eb;font-weight:bold}
        td{padding:5px 8px;border-bottom:1px solid #f3f4f6}
        tr.even td{background:#f9fafb}
        .badge{display:inline-block;padding:1px 5px;border-radius:9999px;font-size:8.5px;font-weight:bold}
        .excelente{background:#dcfce7;color:#166534}
        .boa{background:#dbeafe;color:#1e40af}
        .atencao,.ateno{background:#fef9c3;color:#854d0e}
        .critica,.crtica{background:#fee2e2;color:#991b1b}
        .footer{text-align:center;font-size:8px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:10px}
        @page{size:A4;margin:1.5cm}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Auditoria Financeira Automática</h1>
      <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${totalCongs} congregações · ${totalAlertas} alertas encontrados</div>
      <div class="kpis">
        <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value">${totalCongs}</div></div>
        <div class="kpi"><div class="kpi-label">Saudáveis</div><div class="kpi-value" style="color:#15803d">${congsSaudaveis}</div></div>
        <div class="kpi"><div class="kpi-label">Pendências</div><div class="kpi-value" style="color:#d97706">${congsPendentes}</div></div>
        <div class="kpi"><div class="kpi-label">Críticas</div><div class="kpi-value" style="color:#dc2626">${congsCriticas}</div></div>
        <div class="kpi"><div class="kpi-label">Score Médio</div><div class="kpi-value" style="color:#1d4ed8">${scoreMedio}</div></div>
      </div>
      <h2>Ranking de Saúde Financeira</h2>
      <table><thead><tr><th>Congregação</th><th style="text-align:right">Score</th><th style="text-align:center">Classificação</th><th style="text-align:right">Alertas</th><th>Detalhes</th></tr></thead>
      <tbody>${scoreRows}</tbody></table>
      ${congsSemFechamento.length > 0 ? `
      <h2>Congregações sem Fechamento (${congsSemFechamento.length})</h2>
      <table><thead><tr><th>Congregação</th><th>Mês de Referência</th><th style="text-align:right">Dias em Atraso</th></tr></thead>
      <tbody>${congsSemFechamento.map((m,i)=>`<tr class="${i%2===1?'even':''}"><td>${esc(m.congNome)}</td><td>${esc(monthLabel(m.mes))}</td><td style="text-align:right;color:#dc2626">${m.diasAtraso} dias</td></tr>`).join('')}</tbody></table>` : ''}
      ${lancSemCategoriaLista.length > 0 ? `
      <h2>Lançamentos sem Categoria (${lancSemCategoriaLista.length}${lancSemCategoriaLista.length>50?' – primeiros 50':''})</h2>
      <table><thead><tr><th>Data</th><th>Congregação</th><th style="text-align:right">Valor</th><th>Descrição</th></tr></thead>
      <tbody>${alertRows}</tbody></table>` : ''}
      <div class="footer">Relatório gerado pelo <strong>Gestão Eklesia</strong> — Auditoria Financeira Automática</div>
    </body></html>`;

    pw.document.write(html);
    pw.document.close();
    pw.focus();
    setTimeout(() => pw.print(), 700);
  }, [
    generated, scoresPorCong, lancSemCategoriaLista, congNomeMap,
    congsSemFechamento, totalCongs, totalAlertas, congsSaudaveis, congsPendentes,
    congsCriticas, scoreMedio,
  ]);

  // ── Tab definitions ───────────────────────────────────────────────────────

  const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'alertas',    label: 'Alertas',             icon: <AlertTriangle size={15} />, badge: generated ? totalAlertas : undefined },
    { id: 'validacoes', label: 'Validações Automáticas', icon: <CheckCircle2 size={15} />, badge: generated ? divergenciasFechamento.length + fechamentosInconsistentes.length + pixSemLanc.length + eventoSemLanc.length : undefined },
    { id: 'score',      label: 'Score de Saúde',      icon: <Activity size={15} /> },
    { id: 'log',        label: 'Log de Auditoria',    icon: <ClipboardList size={15} /> },
  ];

  // ── Guards ────────────────────────────────────────────────────────────────

  if (ctx.loading) return <div className="p-8 text-gray-400">Carregando...</div>;
  if (bloqueado) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageLayout
      title="Auditoria Financeira"
      description="Identificação automática de inconsistências e riscos financeiros em todas as congregações"
      activeMenu="auditoria-financeira"
    >
      {/* ── Painel de Controle ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#123b63] uppercase tracking-wide">
            Auditoria Automática
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Analisa lançamentos, fechamentos, cobranças digitais e saúde financeira de todas as congregações
          </p>
        </div>
        <div className="flex items-center gap-3">
          {generated && (
            <>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                <Download size={14} /> Exportar CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-1.5 border border-[#123b63] text-[#123b63] rounded-lg text-sm hover:bg-[#123b63]/5 transition"
              >
                <Printer size={14} /> Imprimir / PDF
              </button>
            </>
          )}
          <button
            onClick={() => void rodarAuditoria()}
            disabled={loading || !ministryId}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#123b63] text-white rounded-lg text-sm font-medium hover:bg-[#1a4d7a] disabled:opacity-50 transition"
          >
            <Shield size={15} />
            {loading ? 'Analisando…' : generated ? 'Reanalisar' : 'Rodar Auditoria'}
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="py-16 text-center text-gray-400">
          <div className="inline-block w-8 h-8 border-4 border-[#123b63]/20 border-t-[#123b63] rounded-full animate-spin mb-3" />
          <p className="text-sm">Analisando registros financeiros…</p>
        </div>
      )}

      {/* ── Estado vazio ── */}
      {!loading && !generated && (
        <div className="py-16 text-center text-gray-400">
          <Shield size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Clique em <strong>Rodar Auditoria</strong> para analisar todas as congregações</p>
        </div>
      )}

      {/* ── Resultado ── */}
      {!loading && generated && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <KpiCard label="Total de Congregações" value={totalCongs} />
            <KpiCard label="Saudáveis" value={congsSaudaveis} color="text-green-700"
              sub={totalCongs > 0 ? `${Math.round(congsSaudaveis/totalCongs*100)}%` : undefined} />
            <KpiCard label="Com Pendências" value={congsPendentes} color="text-yellow-600" />
            <KpiCard label="Críticas" value={congsCriticas} color="text-red-600" />
            <KpiCard label="Score Médio" value={scoreMedio} color={scoreColor(scoreMedio)}
              sub={classificar(scoreMedio)} />
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-[#123b63] border-b-2 border-[#123b63] -mb-px bg-[#123b63]/3'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      tab.badge > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── ABA 1: ALERTAS ── */}
            {activeTab === 'alertas' && (
              <div className="p-6 space-y-8">

                {/* 1. Fechamentos em atraso */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <AlertTriangle size={15} className="text-orange-500" />
                    Congregações sem Fechamento
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${congsSemFechamento.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {congsSemFechamento.length === 0 ? '✓ Em dia' : `${congsSemFechamento.length} pendente(s)`}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Verifica os últimos {LOOKBACK_MESES} meses por congregação (Sede + filiais).
                  </p>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3">Congregação</th>
                          <th className="text-left px-5 py-3">Mês de Referência</th>
                          <th className="text-right px-5 py-3">Dias em Atraso</th>
                          <th className="text-right px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {congsSemFechamento.length === 0
                          ? <EmptyRow cols={4} msg="Todas as congregações possuem fechamentos em dia" />
                          : congsSemFechamento.map((m, i) => (
                              <tr key={`${m.congId ?? '__sede__'}-${m.mes}`} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                <td className="px-5 py-3 font-medium">{m.congNome}</td>
                                <td className="px-5 py-3">{monthLabel(m.mes)}</td>
                                <td className="px-5 py-3 text-right font-semibold text-red-600">{m.diasAtraso} dias</td>
                                <td className="px-5 py-3 text-right">
                                  <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                    Sem fechamento
                                  </span>
                                </td>
                              </tr>
                            ))
                        }
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 2. Sem movimentação */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <AlertCircle size={15} className="text-yellow-500" />
                    Congregações sem Movimentação
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${congSemMovimento.length > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {congSemMovimento.length === 0 ? '✓ OK' : congSemMovimento.length}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">Sem lançamentos há mais de {INATIVIDADE_DIAS} dias.</p>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3">Congregação</th>
                          <th className="text-right px-5 py-3">Último Lançamento</th>
                          <th className="text-right px-5 py-3">Dias sem Movimentação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {congSemMovimento.length === 0
                          ? <EmptyRow cols={3} msg="Todas as congregações têm movimentação recente" />
                          : congSemMovimento.map((c, i) => (
                              <tr key={c.id ?? '__sede__'} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                <td className="px-5 py-3 font-medium">{c.nome}</td>
                                <td className="px-5 py-3 text-right text-gray-500">
                                  {c.ultimoLanc ? fmtDate(c.ultimoLanc.toISOString()) : 'Nenhum registro'}
                                </td>
                                <td className="px-5 py-3 text-right font-semibold text-yellow-600">
                                  {c.dias !== null ? `${c.dias} dias` : '—'}
                                </td>
                              </tr>
                            ))
                        }
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 3. Saldo negativo */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <TrendingDown size={15} className="text-red-500" />
                    Congregações com Saldo Negativo
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${congSaldoNegativo.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {congSaldoNegativo.length === 0 ? '✓ OK' : congSaldoNegativo.length}
                    </span>
                  </h3>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3">Congregação</th>
                          <th className="text-right px-5 py-3">Saldo Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {congSaldoNegativo.length === 0
                          ? <EmptyRow cols={2} msg="Nenhuma congregação com saldo negativo" />
                          : congSaldoNegativo.map((c, i) => (
                              <tr key={c.id ?? '__sede__'} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                <td className="px-5 py-3 font-medium">{c.nome}</td>
                                <td className="px-5 py-3 text-right font-bold text-red-600">{fmtBRL(c.saldo)}</td>
                              </tr>
                            ))
                        }
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 4. Lançamentos sem categoria */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <XCircle size={15} className="text-purple-500" />
                    Lançamentos sem Categoria
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${lancSemCategoriaLista.length > 0 ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {lancSemCategoriaLista.length === 0 ? '✓ OK' : lancSemCategoriaLista.length}
                    </span>
                  </h3>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3">Data</th>
                          <th className="text-left px-5 py-3">Congregação</th>
                          <th className="text-right px-5 py-3">Valor</th>
                          <th className="text-left px-5 py-3">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lancSemCategoriaLista.length === 0
                          ? <EmptyRow cols={4} msg="Todos os lançamentos possuem categoria" />
                          : lancSemCategoriaLista.slice(0, 100).map((l, i) => (
                              <tr key={l.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                <td className="px-5 py-3 text-gray-600">{fmtDate(l.data_lancamento)}</td>
                                <td className="px-5 py-3 font-medium">{congNomeMap.get(l.congregacao_id ?? '__sede__') ?? '—'}</td>
                                <td className={`px-5 py-3 text-right font-semibold ${l.tipo_movimento === 'entrada' ? 'text-green-700' : 'text-red-600'}`}>
                                  {fmtBRL(Number(l.valor))}
                                </td>
                                <td className="px-5 py-3 text-gray-500">{l.descricao ?? '—'}</td>
                              </tr>
                            ))
                        }
                        {lancSemCategoriaLista.length > 100 && (
                          <tr>
                            <td colSpan={4} className="px-5 py-2 text-center text-xs text-gray-400">
                              ... e mais {lancSemCategoriaLista.length - 100} registros
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 5. Despesas sem comprovante */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Info size={15} className="text-gray-400" />
                    Despesas sem Comprovante
                    <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 font-medium">
                      Em breve
                    </span>
                  </h3>
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg px-6 py-4 text-sm text-gray-500">
                    O sistema ainda não possui campo de anexo/comprovante nos lançamentos.
                    Este alerta será ativado automaticamente quando a funcionalidade de
                    <strong> comprovantes digitais</strong> for implementada na Tesouraria.
                  </div>
                </section>
              </div>
            )}

            {/* ── ABA 2: VALIDAÇÕES ── */}
            {activeTab === 'validacoes' && (
              <div className="p-6 space-y-8">

                {/* 1. Divergência de saldo */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <AlertTriangle size={15} className="text-orange-500" />
                    Divergência de Saldo nos Fechamentos
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${divergenciasFechamento.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {divergenciasFechamento.length === 0 ? '✓ Sem divergências' : `${divergenciasFechamento.length} divergência(s)`}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Compara: Saldo Inicial + Entradas − Saídas vs. Saldo Final registrado.
                  </p>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3">Mês</th>
                          <th className="text-right px-5 py-3">Saldo Inicial</th>
                          <th className="text-right px-5 py-3">Entradas</th>
                          <th className="text-right px-5 py-3">Saídas</th>
                          <th className="text-right px-5 py-3">Saldo Esperado</th>
                          <th className="text-right px-5 py-3">Saldo Registrado</th>
                          <th className="text-right px-5 py-3">Diferença</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divergenciasFechamento.length === 0
                          ? <EmptyRow cols={7} msg="Nenhuma divergência encontrada nos fechamentos" />
                          : divergenciasFechamento.map((f, i) => (
                              <tr key={f.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                <td className="px-5 py-3 font-medium">{monthLabel(f.mes_referencia)}</td>
                                <td className="px-5 py-3 text-right">{fmtBRL(Number(f.saldo_inicial))}</td>
                                <td className="px-5 py-3 text-right text-green-700">{fmtBRL(Number(f.total_entradas))}</td>
                                <td className="px-5 py-3 text-right text-red-600">{fmtBRL(Number(f.total_saidas))}</td>
                                <td className="px-5 py-3 text-right font-medium">{fmtBRL(f.esperado)}</td>
                                <td className="px-5 py-3 text-right font-medium">{fmtBRL(Number(f.saldo_final))}</td>
                                <td className={`px-5 py-3 text-right font-bold ${Math.abs(f.diferenca) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                                  {f.diferenca > 0 ? '+' : ''}{fmtBRL(f.diferenca)}
                                </td>
                              </tr>
                            ))
                        }
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 2. PIX pago sem lançamento */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <AlertCircle size={15} className="text-blue-500" />
                    PIX Pago sem Lançamento Financeiro
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${pixSemLanc.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {pixSemLanc.length === 0 ? '✓ OK' : `${pixSemLanc.length} pendente(s)`}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Cobranças com <code className="bg-gray-100 px-1 rounded">status = &apos;pago&apos;</code> sem registro correspondente em lançamentos da tesouraria.
                  </p>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3">Destino / Congregação</th>
                          <th className="text-left px-5 py-3">Pagador</th>
                          <th className="text-right px-5 py-3">Valor</th>
                          <th className="text-right px-5 py-3">Pago em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pixSemLanc.length === 0
                          ? <EmptyRow cols={4} msg="Nenhuma cobrança PIX paga sem lançamento" />
                          : pixSemLanc.map((p, i) => {
                              const dest = destinoMap.get(p.destination_id);
                              const congNome = dest?.congregacao_id
                                ? congNomeMap.get(dest.congregacao_id) ?? '—'
                                : 'Sede';
                              return (
                                <tr key={p.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                  <td className="px-5 py-3">
                                    <p className="font-medium">{dest?.label ?? '—'}</p>
                                    <p className="text-xs text-gray-400">{congNome}</p>
                                  </td>
                                  <td className="px-5 py-3 text-gray-600">{p.payer_name ?? '—'}</td>
                                  <td className="px-5 py-3 text-right font-semibold text-green-700">
                                    {p.valor_pago != null ? fmtBRL(Number(p.valor_pago)) : '—'}
                                  </td>
                                  <td className="px-5 py-3 text-right text-gray-500">
                                    {p.paid_at ? fmtDate(p.paid_at) : '—'}
                                  </td>
                                </tr>
                              );
                            })
                        }
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 3. Evento pago sem lançamento */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <AlertCircle size={15} className="text-purple-500" />
                    Evento Pago sem Lançamento Financeiro
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${eventoSemLanc.length > 0 ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {eventoSemLanc.length === 0 ? '✓ OK' : `${eventoSemLanc.length} pendente(s)`}
                    </span>
                  </h3>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3">ID do Pagamento</th>
                          <th className="text-right px-5 py-3">Valor</th>
                          <th className="text-right px-5 py-3">Pago em</th>
                          <th className="text-right px-5 py-3">Criado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventoSemLanc.length === 0
                          ? <EmptyRow cols={4} msg="Nenhum pagamento de evento sem lançamento" />
                          : eventoSemLanc.map((e, i) => (
                              <tr key={e.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                <td className="px-5 py-3 font-mono text-xs text-gray-500">{e.id.substring(0, 8)}…</td>
                                <td className="px-5 py-3 text-right font-semibold text-green-700">{fmtBRL(Number(e.valor))}</td>
                                <td className="px-5 py-3 text-right text-gray-500">{e.paid_at ? fmtDate(e.paid_at) : '—'}</td>
                                <td className="px-5 py-3 text-right text-gray-500">{fmtDate(e.created_at)}</td>
                              </tr>
                            ))
                        }
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 4. Fechamento inconsistente */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <XCircle size={15} className="text-red-500" />
                    Fechamentos Inconsistentes
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${fechamentosInconsistentes.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {fechamentosInconsistentes.length === 0 ? '✓ OK' : `${fechamentosInconsistentes.length}`}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Meses com status &quot;fechado&quot; que possuem lançamentos criados <strong>após</strong> a data de fechamento.
                  </p>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-5 py-3">Mês Fechado</th>
                          <th className="text-right px-5 py-3">Fechado em</th>
                          <th className="text-right px-5 py-3">Lançamentos Posteriores</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fechamentosInconsistentes.length === 0
                          ? <EmptyRow cols={3} msg="Nenhum fechamento inconsistente encontrado" />
                          : fechamentosInconsistentes.map((f, i) => (
                              <tr key={f.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                <td className="px-5 py-3 font-medium">{monthLabel(f.mes_referencia)}</td>
                                <td className="px-5 py-3 text-right text-gray-500">{f.fechado_em ? fmtDateTime(f.fechado_em) : '—'}</td>
                                <td className="px-5 py-3 text-right font-bold text-red-600">{f.posteriores.length}</td>
                              </tr>
                            ))
                        }
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ── ABA 3: SCORE DE SAÚDE ── */}
            {activeTab === 'score' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Ranking de Saúde Financeira</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Score inicial 100 pts. Descontos: saldo negativo (−10), sem movimentação (−5), 
                      sem categoria (−3/lanç., máx. −15), fechamento atrasado (−5), inconsistência (−5).
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {(['Excelente', 'Boa', 'Atenção', 'Crítica'] as Classificacao[]).map(cls => (
                      <span key={cls} className={`px-2.5 py-1 rounded-full font-medium ${classBadge(cls)}`}>
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-5 py-3">
                          <button onClick={() => handleSort('nome')} className="flex items-center gap-1 hover:text-[#123b63]">
                            Congregação
                            <SortBtn col="nome" current={sortBy} dir={sortDir} onClick={() => handleSort('nome')} />
                          </button>
                        </th>
                        <th className="text-right px-5 py-3">
                          <button onClick={() => handleSort('score')} className="flex items-center gap-1 hover:text-[#123b63] ml-auto">
                            Score
                            <SortBtn col="score" current={sortBy} dir={sortDir} onClick={() => handleSort('score')} />
                          </button>
                        </th>
                        <th className="text-center px-5 py-3">Classificação</th>
                        <th className="text-right px-5 py-3">
                          <button onClick={() => handleSort('alertas')} className="flex items-center gap-1 hover:text-[#123b63] ml-auto">
                            Alertas
                            <SortBtn col="alertas" current={sortBy} dir={sortDir} onClick={() => handleSort('alertas')} />
                          </button>
                        </th>
                        <th className="text-left px-5 py-3">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoresPorCong.map((s, i) => (
                        <tr key={s.id ?? '__sede__'} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                          <td className="px-5 py-3 font-medium">{s.nome}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`text-lg font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                            <span className="text-xs text-gray-400 ml-1">/100</span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${classBadge(s.classificacao)}`}>
                              {s.classificacao}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold">
                            {s.totalAlertas > 0
                              ? <span className="text-red-600">{s.totalAlertas}</span>
                              : <span className="text-green-600">0</span>
                            }
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-500">
                            {s.alertasDetalhes.length === 0
                              ? <span className="text-green-600 font-medium">Sem pendências</span>
                              : s.alertasDetalhes.join(' · ')
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── ABA 4: LOG DE AUDITORIA ── */}
            {activeTab === 'log' && (
              <div className="p-6">
                {!logTableExists ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-6 py-4 text-sm text-yellow-800">
                    <strong>Migration pendente:</strong> A tabela <code>financial_audit_logs</code> ainda não existe no banco de dados.
                    Aplique a migration <code>20260524210000_financial_audit_logs.sql</code> no Supabase para habilitar o log de auditoria.
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      Histórico de Execuções
                    </h3>
                    <div className="rounded-lg border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-5 py-3">Executado em</th>
                            <th className="text-center px-5 py-3">Tipo</th>
                            <th className="text-center px-5 py-3">Resultado</th>
                            <th className="text-right px-5 py-3">Alertas encontrados</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.length === 0
                            ? <EmptyRow cols={4} msg="Nenhuma auditoria executada ainda. Clique em 'Rodar Auditoria' para começar." />
                            : auditLogs.map((log, i) => (
                                <tr key={log.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                                  <td className="px-5 py-3 text-gray-600">{fmtDateTime(log.executado_em)}</td>
                                  <td className="px-5 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.tipo_auditoria === 'automatico' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {log.tipo_auditoria === 'automatico' ? 'Automático' : 'Manual'}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.resultado === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {log.resultado === 'concluido' ? '✓ Concluído' : '✗ Erro'}
                                    </span>
                                  </td>
                                  <td className={`px-5 py-3 text-right font-semibold ${log.total_alertas > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {log.total_alertas}
                                  </td>
                                </tr>
                              ))
                          }
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {generatedAt && (
            <p className="text-center text-xs text-gray-400 py-3 mt-2">
              Auditoria gerada em {fmtDateTime(generatedAt.toISOString())} •
              {lancamentos.length >= 2000 && ' Análise limitada aos 2.000 lançamentos mais recentes •'}
              {' '}Dados do sistema Gestão Eklesia
            </p>
          )}
        </>
      )}
    </PageLayout>
  );
}
