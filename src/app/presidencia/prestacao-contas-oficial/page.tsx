'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  FileText, Printer, Download, Shield, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Minus, Award, Users,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }

interface RawLanc {
  congregacao_id: string | null;
  tipo_movimento: string;
  valor: number;
  categoria_id: string | null;
}

interface FinCategoria { id: string; nome: string; tipo_movimento: string; }

interface CatAggregate { id: string | null; nome: string; total: number; count: number; }

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
}

interface FiscalReview {
  id: string;
  congregacao_id: string | null;
  mes_referencia: string;
  status: string;
  parecer: string | null;
  ressalvas: string | null;
  recomendacoes: string | null;
  reviewed_at: string | null;
  parecer_status: string | null;
  emitido_em: string | null;
}

interface FiscalSignature {
  id: string;
  nome: string;
  cargo: string;
  tipo_assinatura: string;
  signed_at: string;
}

interface AuditAlerta { descricao: string; gravidade: 'critico' | 'atencao' | 'info'; }

// ── Constantes ────────────────────────────────────────────────────────────────

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIGITAL_KEYWORDS = ['digital', 'pix', 'online', 'dízimo digital', 'oferta digital', 'campanha digital', 'evento pago'];

const mesAtual = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const STATUS_FISCAL: Record<string, { label: string; color: string }> = {
  pendente:               { label: 'Pendente',               color: 'text-gray-600 bg-gray-100' },
  em_analise:             { label: 'Em Análise',             color: 'text-blue-700 bg-blue-100' },
  aprovado:               { label: 'Aprovado',               color: 'text-green-700 bg-green-100' },
  aprovado_com_ressalvas: { label: 'Aprov. c/ Ressalvas',    color: 'text-yellow-700 bg-yellow-100' },
  rejeitado:              { label: 'Rejeitado',              color: 'text-red-700 bg-red-100' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MESES_LABEL[Number(m) - 1]} de ${y}`;
}

function dateRange(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  const inicio = `${ym}-01`;
  const next = new Date(y, m, 1);
  const fim = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
  return [inicio, fim];
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

function computeAuditScore(
  lancamentos: RawLanc[],
  fechamento: Fechamento | null,
  fiscalReview: FiscalReview | null,
): { score: number; alertas: AuditAlerta[] } {
  const alertas: AuditAlerta[] = [];
  let pontuacao = 100;

  if (!fechamento || fechamento.status !== 'fechado') {
    alertas.push({ descricao: 'Período sem fechamento financeiro oficial', gravidade: 'critico' });
    pontuacao -= 30;
  }

  if (lancamentos.length === 0) {
    alertas.push({ descricao: 'Nenhum lançamento registrado no período', gravidade: 'atencao' });
    pontuacao -= 20;
  }

  const saldo = fechamento?.saldo_final ??
    lancamentos.reduce((acc, l) => {
      return acc + (l.tipo_movimento === 'entrada' ? Number(l.valor) : -Number(l.valor));
    }, 0);

  if (saldo < 0) {
    alertas.push({ descricao: 'Saldo final negativo no período', gravidade: 'critico' });
    pontuacao -= 25;
  }

  if (!fiscalReview) {
    alertas.push({ descricao: 'Sem análise do Conselho Fiscal para este período', gravidade: 'atencao' });
    pontuacao -= 15;
  } else if (fiscalReview.status === 'rejeitado') {
    alertas.push({ descricao: 'Prestação de contas rejeitada pelo Conselho Fiscal', gravidade: 'critico' });
    pontuacao -= 25;
  } else if (fiscalReview.parecer_status !== 'finalizado') {
    alertas.push({ descricao: 'Parecer do Conselho Fiscal ainda não finalizado', gravidade: 'info' });
    pontuacao -= 5;
  }

  const entradas = lancamentos.filter(l => l.tipo_movimento === 'entrada').reduce((a, l) => a + Number(l.valor), 0);
  const saidas = lancamentos.filter(l => l.tipo_movimento === 'saida').reduce((a, l) => a + Number(l.valor), 0);

  if (fechamento && Math.abs(fechamento.total_entradas - entradas) > 0.01) {
    alertas.push({ descricao: 'Divergência entre total de entradas e fechamento', gravidade: 'atencao' });
    pontuacao -= 10;
  }
  if (fechamento && Math.abs(fechamento.total_saidas - saidas) > 0.01) {
    alertas.push({ descricao: 'Divergência entre total de saídas e fechamento', gravidade: 'atencao' });
    pontuacao -= 10;
  }

  return { score: Math.max(0, Math.min(100, pontuacao)), alertas };
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

interface PrintData {
  ministryNome: string;
  congNome: string;
  filtroMes: string;
  userName: string;
  generatedAt: Date;
  entradas: number;
  saidas: number;
  saldoInicial: number;
  saldoFinal: number;
  receitasCat: CatAggregate[];
  despesasCat: CatAggregate[];
  digitalCat: CatAggregate[];
  fechamento: Fechamento | null;
  fiscalReview: FiscalReview | null;
  signatures: FiscalSignature[];
  score: number;
  alertas: AuditAlerta[];
}

function buildCsvContent(d: PrintData): string {
  const BOM = '\uFEFF';
  const rows: string[][] = [];
  const row = (...cells: string[]) => rows.push(cells);
  const q = (s: string | number) => `"${String(s ?? '').replace(/"/g, '""')}"`;

  row('PRESTAÇÃO DE CONTAS OFICIAL — GESTÃO EKLESIA');
  row('');
  row('MINISTÉRIO', d.ministryNome);
  row('CONGREGAÇÃO', d.congNome);
  row('PERÍODO', monthLabel(d.filtroMes));
  row('EMISSÃO', d.generatedAt.toLocaleString('pt-BR'));
  row('EMISSOR', d.userName);
  row('');

  row('=== RESUMO FINANCEIRO ===');
  row('Saldo Inicial', fmtBRL(d.saldoInicial));
  row('(+) Entradas', fmtBRL(d.entradas));
  row('(-) Saídas', fmtBRL(d.saidas));
  row('(=) Saldo Final', fmtBRL(d.saldoFinal));
  row('');

  row('=== RECEITAS POR CATEGORIA ===');
  row('Categoria', 'Qtd', 'Total', '%');
  d.receitasCat.forEach(c => {
    const pct = d.entradas > 0 ? ((c.total / d.entradas) * 100).toFixed(1) : '0.0';
    row(c.nome, String(c.count), fmtBRL(c.total), pct + '%');
  });
  row('TOTAL RECEITAS', '', fmtBRL(d.entradas), '100%');
  row('');

  row('=== DESPESAS POR CATEGORIA ===');
  row('Categoria', 'Qtd', 'Total', '%');
  d.despesasCat.forEach(c => {
    const pct = d.saidas > 0 ? ((c.total / d.saidas) * 100).toFixed(1) : '0.0';
    row(c.nome, String(c.count), fmtBRL(c.total), pct + '%');
  });
  row('TOTAL DESPESAS', '', fmtBRL(d.saidas), '100%');
  row('');

  row('=== ARRECADAÇÃO DIGITAL ===');
  row('Categoria', 'Qtd', 'Total');
  if (d.digitalCat.length === 0) {
    row('Nenhum lançamento digital identificado', '', '');
  } else {
    d.digitalCat.forEach(c => row(c.nome, String(c.count), fmtBRL(c.total)));
  }
  row('');

  row('=== FECHAMENTO ===');
  row('Status', d.fechamento ? (d.fechamento.status === 'fechado' ? 'Fechado' : 'Aberto') : 'Sem fechamento');
  row('Fechado em', d.fechamento?.fechado_em ? fmtDate(d.fechamento.fechado_em) : '—');
  row('');

  row('=== AUDITORIA FINANCEIRA ===');
  row('Score', String(d.score) + '/100');
  row('Classificação', d.score >= 90 ? 'Excelente' : d.score >= 70 ? 'Boa' : d.score >= 50 ? 'Atenção' : 'Crítica');
  d.alertas.forEach(a => row('Alerta', a.gravidade.toUpperCase(), a.descricao));
  row('');

  row('=== CONSELHO FISCAL ===');
  if (!d.fiscalReview) {
    row('Sem análise do Conselho Fiscal para este período', '', '');
  } else {
    row('Status', STATUS_FISCAL[d.fiscalReview.status]?.label ?? d.fiscalReview.status);
    row('Parecer', d.fiscalReview.parecer ?? '—');
    row('Ressalvas', d.fiscalReview.ressalvas ?? '—');
    row('Recomendações', d.fiscalReview.recomendacoes ?? '—');
    row('');
    row('=== ASSINATURAS ===');
    row('Nome', 'Cargo', 'Tipo', 'Data/Hora');
    d.signatures.forEach(s => row(s.nome, s.cargo, s.tipo_assinatura, fmtDateTime(s.signed_at)));
  }

  return BOM + rows.map(r => r.map(q).join(';')).join('\r\n');
}

// ── Print HTML ────────────────────────────────────────────────────────────────

function buildPrintHtml(d: PrintData): string {
  const styles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1f2937; padding: 24px; background: #fff; }
    h1 { font-size: 18px; font-weight: bold; color: #123b63; }
    h2 { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; margin-bottom: 20px; border-bottom: 3px solid #123b63; }
    .header-right { text-align: right; }
    .subtitle { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #6b7280; margin-top: 2px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
    .kpi-label { font-size: 8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 3px; }
    .kpi-value { font-size: 16px; font-weight: bold; }
    .kpi-sub { font-size: 8px; color: #9ca3af; margin-top: 2px; }
    .bl-gray { border-left: 4px solid #9ca3af; } .cl-gray { color: #374151; }
    .bl-green { border-left: 4px solid #22c55e; } .cl-green { color: #15803d; }
    .bl-red { border-left: 4px solid #ef4444; } .cl-red { color: #dc2626; }
    .bl-blue { border-left: 4px solid #3b82f6; } .cl-blue { color: #1d4ed8; }
    .bl-orange { border-left: 4px solid #f97316; } .cl-orange { color: #c2410c; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
    thead th { background: #f9fafb; font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; font-weight: bold; }
    th:not(:first-child) { text-align: right; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
    td:not(:first-child) { text-align: right; }
    tr.even td { background: #f9fafb; }
    tfoot td { border-top: 2px solid #d1d5db; background: #f3f4f6; font-weight: bold; padding: 7px 8px; }
    .section-hdr { padding: 7px 10px; font-size: 10px; font-weight: bold; margin-top: 4px; margin-bottom: 2px; border-radius: 4px; }
    .hdr-green { background: #f0fdf4; color: #166534; border-left: 4px solid #22c55e; }
    .hdr-red   { background: #fef2f2; color: #991b1b; border-left: 4px solid #ef4444; }
    .hdr-blue  { background: #eff6ff; color: #1e40af; border-left: 4px solid #3b82f6; }
    .hdr-amber { background: #fffbeb; color: #92400e; border-left: 4px solid #f59e0b; }
    .hdr-purple{ background: #f5f3ff; color: #5b21b6; border-left: 4px solid #8b5cf6; }
    .score-box { display: flex; align-items: center; gap: 16px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-bottom: 10px; }
    .score-num { font-size: 36px; font-weight: bold; }
    .alert-item { padding: 5px 10px; font-size: 10px; border-radius: 4px; margin-bottom: 4px; }
    .alert-critico { background: #fef2f2; color: #991b1b; border-left: 3px solid #ef4444; }
    .alert-atencao { background: #fffbeb; color: #92400e; border-left: 3px solid #f59e0b; }
    .alert-info    { background: #eff6ff; color: #1e40af; border-left: 3px solid #3b82f6; }
    .sig-table td { font-size: 10px; }
    .fiscal-block { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-bottom: 10px; }
    .fiscal-label { font-size: 8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 3px; }
    .fiscal-text { font-size: 10px; color: #374151; }
    .footer { text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 16px; }
    .rodape-assinaturas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 28px; padding-top: 16px; border-top: 2px solid #123b63; }
    .sig-line { border-top: 1px solid #374151; padding-top: 6px; text-align: center; font-size: 9px; color: #6b7280; margin-top: 40px; }
    .no-data { color: #9ca3af; text-align: center; padding: 10px 8px; font-size: 10px; }
    @page { size: A4 portrait; margin: 1.5cm; }
    @media print { body { padding: 0; } }
  `;

  const catRows = (cats: CatAggregate[], total: number, colorClass: string) =>
    cats.length === 0
      ? `<tr><td colspan="4" class="no-data">Nenhum lançamento registrado</td></tr>`
      : cats.map((c, i) => {
          const pct = total > 0 ? ((c.total / total) * 100).toFixed(1) : '0.0';
          return `<tr class="${i % 2 === 1 ? 'even' : ''}">
            <td>${esc(c.nome)}</td>
            <td>${c.count}</td>
            <td class="${colorClass}">${esc(fmtBRL(c.total))}</td>
            <td>${pct}%</td>
          </tr>`;
        }).join('');

  const alertRows = d.alertas.map(a =>
    `<div class="alert-item alert-${a.gravidade}">${esc(a.descricao)}</div>`
  ).join('') || `<div class="alert-item alert-info">Nenhum alerta identificado — excelente!</div>`;

  const classLabel = d.score >= 90 ? 'Excelente' : d.score >= 70 ? 'Boa' : d.score >= 50 ? 'Atenção' : 'Crítica';
  const scoreColor = d.score >= 90 ? '#15803d' : d.score >= 70 ? '#1d4ed8' : d.score >= 50 ? '#d97706' : '#dc2626';

  const saldoFinalBorder = d.saldoFinal >= 0 ? 'bl-blue' : 'bl-orange';
  const saldoFinalColor  = d.saldoFinal >= 0 ? 'cl-blue' : 'cl-orange';

  const fiscalSection = d.fiscalReview
    ? `
      <div class="fiscal-block">
        <div style="display:flex;gap:12px;margin-bottom:10px">
          <div>
            <div class="fiscal-label">Status</div>
            <div class="fiscal-text" style="font-weight:bold">${esc(STATUS_FISCAL[d.fiscalReview.status]?.label ?? d.fiscalReview.status)}</div>
          </div>
          <div>
            <div class="fiscal-label">Parecer Oficial</div>
            <div class="fiscal-text">${esc(d.fiscalReview.parecer_status ?? '—')}</div>
          </div>
          ${d.fiscalReview.emitido_em ? `<div><div class="fiscal-label">Emitido em</div><div class="fiscal-text">${esc(fmtDateTime(d.fiscalReview.emitido_em))}</div></div>` : ''}
        </div>
        ${d.fiscalReview.parecer ? `<div class="fiscal-label">Parecer</div><div class="fiscal-text" style="margin-bottom:8px">${esc(d.fiscalReview.parecer)}</div>` : ''}
        ${d.fiscalReview.ressalvas ? `<div class="fiscal-label">Ressalvas</div><div class="fiscal-text" style="margin-bottom:8px">${esc(d.fiscalReview.ressalvas)}</div>` : ''}
        ${d.fiscalReview.recomendacoes ? `<div class="fiscal-label">Recomendações</div><div class="fiscal-text">${esc(d.fiscalReview.recomendacoes)}</div>` : ''}
      </div>
      ${d.signatures.length > 0 ? `
        <table class="sig-table">
          <thead><tr><th style="text-align:left">Nome</th><th style="text-align:left">Cargo</th><th style="text-align:left">Tipo</th><th>Data/Hora</th></tr></thead>
          <tbody>
            ${d.signatures.map((s, i) => `<tr class="${i % 2 === 1 ? 'even' : ''}">
              <td>${esc(s.nome)}</td>
              <td>${esc(s.cargo)}</td>
              <td>${esc(s.tipo_assinatura)}</td>
              <td style="text-align:right">${esc(fmtDateTime(s.signed_at))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      ` : '<p class="no-data">Nenhuma assinatura registrada</p>'}
    `
    : `<p class="no-data">Sem análise do Conselho Fiscal para este período</p>`;

  const digitalRows = d.digitalCat.length === 0
    ? `<tr><td colspan="3" class="no-data">Nenhum lançamento digital identificado neste período</td></tr>`
    : d.digitalCat.map((c, i) => `<tr class="${i % 2 === 1 ? 'even' : ''}">
        <td>${esc(c.nome)}</td>
        <td>${c.count}</td>
        <td class="cl-blue">${esc(fmtBRL(c.total))}</td>
      </tr>`).join('');

  const digitalTotal = d.digitalCat.reduce((a, c) => a + c.total, 0);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Prestação de Contas Oficial — ${esc(d.congNome)} — ${esc(monthLabel(d.filtroMes))}</title>
  <style>${styles}</style>
</head>
<body>

<div class="header">
  <div>
    <div class="subtitle">Prestação de Contas Oficial</div>
    <h1>${esc(d.ministryNome || 'Ministério')}</h1>
    <div class="meta">${esc(d.congNome)}</div>
    <div class="meta">Período: <strong>${esc(monthLabel(d.filtroMes))}</strong></div>
  </div>
  <div class="header-right">
    <div class="meta">Emitido em: ${esc(d.generatedAt.toLocaleString('pt-BR'))}</div>
    <div class="meta">Emissor: ${esc(d.userName)}</div>
  </div>
</div>

<h2>Resumo Financeiro</h2>
<div class="kpis">
  <div class="kpi bl-gray">
    <div class="kpi-label">Saldo Inicial</div>
    <div class="kpi-value cl-gray">${esc(fmtBRL(d.saldoInicial))}</div>
    <div class="kpi-sub">início do período</div>
  </div>
  <div class="kpi bl-green">
    <div class="kpi-label">(+) Entradas</div>
    <div class="kpi-value cl-green">${esc(fmtBRL(d.entradas))}</div>
  </div>
  <div class="kpi bl-red">
    <div class="kpi-label">(−) Saídas</div>
    <div class="kpi-value cl-red">${esc(fmtBRL(d.saidas))}</div>
  </div>
  <div class="kpi ${saldoFinalBorder}">
    <div class="kpi-label">(=) Saldo Final</div>
    <div class="kpi-value ${saldoFinalColor}">${esc(fmtBRL(d.saldoFinal))}</div>
  </div>
</div>

<div class="section-hdr hdr-green">Receitas por Categoria</div>
<table>
  <thead><tr><th style="text-align:left">Categoria</th><th>Qtd</th><th>Total</th><th>%</th></tr></thead>
  <tbody>${catRows(d.receitasCat, d.entradas, 'cl-green')}</tbody>
  <tfoot><tr><td colspan="2">TOTAL RECEITAS</td><td class="cl-green">${esc(fmtBRL(d.entradas))}</td><td>100%</td></tr></tfoot>
</table>

<div class="section-hdr hdr-red">Despesas por Categoria</div>
<table>
  <thead><tr><th style="text-align:left">Categoria</th><th>Qtd</th><th>Total</th><th>%</th></tr></thead>
  <tbody>${catRows(d.despesasCat, d.saidas, 'cl-red')}</tbody>
  <tfoot><tr><td colspan="2">TOTAL DESPESAS</td><td class="cl-red">${esc(fmtBRL(d.saidas))}</td><td>100%</td></tr></tfoot>
</table>

<div class="section-hdr hdr-blue">Arrecadação Digital</div>
<table>
  <thead><tr><th style="text-align:left">Categoria</th><th>Qtd</th><th>Total</th></tr></thead>
  <tbody>${digitalRows}</tbody>
  ${d.digitalCat.length > 0 ? `<tfoot><tr><td colspan="2">TOTAL DIGITAL</td><td class="cl-blue">${esc(fmtBRL(digitalTotal))}</td></tr></tfoot>` : ''}
</table>

<div class="section-hdr hdr-amber">Fechamento do Período</div>
<table>
  <thead><tr><th style="text-align:left">Status</th><th style="text-align:left">Saldo Inicial</th><th>Entradas</th><th>Saídas</th><th>Saldo Final</th><th>Fechado em</th></tr></thead>
  <tbody>
    ${d.fechamento
      ? `<tr>
          <td style="text-align:left"><strong>${d.fechamento.status === 'fechado' ? '✓ Fechado' : '⚠ Aberto'}</strong></td>
          <td style="text-align:left">${esc(fmtBRL(d.fechamento.saldo_inicial))}</td>
          <td class="cl-green">${esc(fmtBRL(d.fechamento.total_entradas))}</td>
          <td class="cl-red">${esc(fmtBRL(d.fechamento.total_saidas))}</td>
          <td class="${d.fechamento.saldo_final >= 0 ? 'cl-blue' : 'cl-orange'}">${esc(fmtBRL(d.fechamento.saldo_final))}</td>
          <td>${d.fechamento.fechado_em ? esc(fmtDate(d.fechamento.fechado_em)) : '—'}</td>
        </tr>`
      : `<tr><td colspan="6" class="no-data">Sem fechamento registrado para este período</td></tr>`}
  </tbody>
</table>

<div class="section-hdr hdr-blue" style="background:#f0f9ff;color:#0c4a6e;border-left-color:#0ea5e9">Auditoria Financeira</div>
<div class="score-box">
  <div>
    <div style="font-size:9px;text-transform:uppercase;color:#9ca3af;margin-bottom:3px">Score</div>
    <div class="score-num" style="color:${scoreColor}">${d.score}</div>
    <div style="font-size:9px;color:#6b7280">de 100 pontos</div>
  </div>
  <div style="flex:1">
    <div style="font-size:12px;font-weight:bold;color:${scoreColor};margin-bottom:6px">${classLabel}</div>
    <div style="font-size:9px;color:#9ca3af;margin-bottom:4px">${d.alertas.length} alerta(s) identificado(s)</div>
    ${alertRows}
  </div>
</div>

<div class="section-hdr hdr-purple">Conselho Fiscal</div>
${fiscalSection}

<div class="rodape-assinaturas">
  <div>
    <div class="sig-line">Tesoureiro(a)</div>
  </div>
  <div>
    <div class="sig-line">Pastor(a) Presidente</div>
  </div>
  <div>
    <div class="sig-line">Conselho Fiscal</div>
  </div>
</div>

<div class="footer">
  Documento oficial gerado pelo <strong>Gestão Eklesia</strong> em ${esc(d.generatedAt.toLocaleString('pt-BR'))}
  &nbsp;•&nbsp; Emissor: ${esc(d.userName)}
  &nbsp;•&nbsp; Este documento é válido apenas com assinaturas físicas ou digitais devidamente autenticadas
</div>

</body>
</html>`;
}

// ── Sub-component ─────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrestacaoContasOficialPage() {
  const { ctx, bloqueado } = useRequireModulo('consolidado_financeiro');
  const supabase = useMemo(() => createClient(), []);

  const [filtroMes, setFiltroMes]   = useState(mesAtual);
  const [filtroCong, setFiltroCong] = useState('');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [ministryNome, setMinistryNome] = useState('');
  const [userName, setUserName]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [generated, setGenerated]   = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [registradoMsg, setRegistradoMsg] = useState('');

  // Data states
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [lancamentos, setLancamentos]   = useState<RawLanc[]>([]);
  const [categorias, setCategorias]     = useState<FinCategoria[]>([]);
  const [fechamento, setFechamento]     = useState<Fechamento | null>(null);
  const [fiscalReview, setFiscalReview] = useState<FiscalReview | null>(null);
  const [signatures, setSignatures]     = useState<FiscalSignature[]>([]);

  // ── Computados ───────────────────────────────────────────────────────────────

  const receitasCat = useMemo(
    () => aggregateByCat(lancamentos, categorias, 'entrada'),
    [lancamentos, categorias],
  );

  const despesasCat = useMemo(
    () => aggregateByCat(lancamentos, categorias, 'saida'),
    [lancamentos, categorias],
  );

  const digitalCat = useMemo(() => {
    const kwds = DIGITAL_KEYWORDS;
    const digitalCatIds = new Set(
      categorias
        .filter(c => kwds.some(kw => c.nome.toLowerCase().includes(kw)))
        .map(c => c.id),
    );
    const filtered = lancamentos.filter(
      l => l.tipo_movimento === 'entrada' && l.categoria_id && digitalCatIds.has(l.categoria_id),
    );
    return aggregateByCat(filtered, categorias, 'entrada');
  }, [lancamentos, categorias]);

  const entradas = useMemo(
    () => lancamentos.filter(l => l.tipo_movimento === 'entrada').reduce((a, l) => a + Number(l.valor), 0),
    [lancamentos],
  );

  const saidas = useMemo(
    () => lancamentos.filter(l => l.tipo_movimento === 'saida').reduce((a, l) => a + Number(l.valor), 0),
    [lancamentos],
  );

  const saldoInicial = useMemo(
    () => (fechamento ? Number(fechamento.saldo_inicial) : 0),
    [fechamento],
  );

  const saldoFinal = useMemo(
    () => (fechamento ? Number(fechamento.saldo_final) : saldoInicial + entradas - saidas),
    [fechamento, saldoInicial, entradas, saidas],
  );

  const { score, alertas } = useMemo(
    () => computeAuditScore(lancamentos, fechamento, fiscalReview),
    [lancamentos, fechamento, fiscalReview],
  );

  const congNome = useMemo(() => {
    if (!filtroCong) return 'Todas as Congregações';
    return congregacoes.find(c => c.id === filtroCong)?.nome ?? 'Congregação';
  }, [filtroCong, congregacoes]);

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!ctx) return;
    async function init() {
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);

      const [resMins, resCongs, resUser] = await Promise.all([
        supabase.from('ministries').select('nome').eq('id', mid).single(),
        supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
        supabase.auth.getUser(),
      ]);

      setMinistryNome((resMins.data as { nome: string } | null)?.nome ?? '');
      setCongregacoes((resCongs.data ?? []) as Congregacao[]);

      const u = resUser.data.user;
      const displayName =
        u?.user_metadata?.full_name ??
        u?.user_metadata?.name ??
        u?.email ??
        'Usuário';
      setUserName(String(displayName));
    }
    init();
  }, [ctx, supabase]);

  // ── Load data ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!ministryId) return;
    setLoading(true);
    setRegistradoMsg('');

    const [inicio, fim] = dateRange(filtroMes);

    const lancQuery = supabase
      .from('tesouraria_lancamentos')
      .select('congregacao_id, tipo_movimento, valor, categoria_id')
      .eq('ministry_id', ministryId)
      .gte('data_lancamento', inicio)
      .lt('data_lancamento', fim);

    const fechQuery = supabase
      .from('tesouraria_fechamentos')
      .select('id, congregacao_id, mes_referencia, saldo_inicial, total_entradas, total_saidas, saldo_final, status, fechado_em')
      .eq('ministry_id', ministryId)
      .eq('mes_referencia', filtroMes);

    const reviewQuery = supabase
      .from('financial_fiscal_reviews')
      .select('id, congregacao_id, mes_referencia, status, parecer, ressalvas, recomendacoes, reviewed_at, parecer_status, emitido_em')
      .eq('ministry_id', ministryId)
      .eq('mes_referencia', filtroMes);

    if (filtroCong) {
      lancQuery.eq('congregacao_id', filtroCong);
      fechQuery.eq('congregacao_id', filtroCong);
      reviewQuery.eq('congregacao_id', filtroCong);
    } else {
      fechQuery.is('congregacao_id', null);
      reviewQuery.is('congregacao_id', null);
    }

    const [resLanc, resCats, resFech, resReview] = await Promise.all([
      lancQuery,
      supabase.from('financeiro_categorias').select('id, nome, tipo_movimento').eq('ministry_id', ministryId),
      fechQuery,
      reviewQuery,
    ]);

    const lancs = (resLanc.data ?? []) as RawLanc[];
    setLancamentos(lancs);
    setCategorias((resCats.data ?? []) as FinCategoria[]);

    const fechs = (resFech.data ?? []) as Fechamento[];
    setFechamento(fechs.length > 0 ? fechs[0] : null);

    const reviews = (resReview.data ?? []) as FiscalReview[];
    const review = reviews.length > 0 ? reviews[0] : null;
    setFiscalReview(review);

    if (review) {
      const resSigs = await supabase
        .from('financial_fiscal_signatures')
        .select('id, nome, cargo, tipo_assinatura, signed_at')
        .eq('review_id', review.id)
        .is('revogado_em', null)
        .order('signed_at');
      setSignatures((resSigs.data ?? []) as FiscalSignature[]);
    } else {
      setSignatures([]);
    }

    setLoading(false);
    setGenerated(true);
    setGeneratedAt(new Date());
  }, [ministryId, filtroMes, filtroCong, supabase]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const printData = useCallback((): PrintData => ({
    ministryNome,
    congNome,
    filtroMes,
    userName,
    generatedAt: generatedAt ?? new Date(),
    entradas,
    saidas,
    saldoInicial,
    saldoFinal,
    receitasCat,
    despesasCat,
    digitalCat,
    fechamento,
    fiscalReview,
    signatures,
    score,
    alertas,
  }), [
    ministryNome, congNome, filtroMes, userName, generatedAt,
    entradas, saidas, saldoInicial, saldoFinal,
    receitasCat, despesasCat, digitalCat,
    fechamento, fiscalReview, signatures, score, alertas,
  ]);

  const handleImprimir = useCallback(() => {
    const html = buildPrintHtml(printData());
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }, [printData]);

  const handleExportarExcel = useCallback(() => {
    const csv = buildCsvContent(printData());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prestacao-contas-${filtroMes}-${congNome.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [printData, filtroMes, congNome]);

  const handleRegistrarEmissao = useCallback(async () => {
    if (!ministryId) return;
    setRegistrando(true);
    setRegistradoMsg('');

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('financial_audit_logs').insert({
      ministry_id:    ministryId,
      usuario_id:     user?.id ?? null,
      tipo_auditoria: 'prestacao_contas',
      resultado:      'concluido',
      total_alertas:  alertas.length,
    });

    if (error) {
      setRegistradoMsg('Erro ao registrar emissão. Tente novamente.');
    } else {
      setRegistradoMsg('Emissão registrada no log de auditoria com sucesso.');
    }
    setRegistrando(false);
  }, [ministryId, supabase, alertas.length]);

  // ── UI Helpers ────────────────────────────────────────────────────────────────

  const scoreColor = score >= 90 ? 'text-green-700' : score >= 70 ? 'text-blue-700' : score >= 50 ? 'text-amber-600' : 'text-red-700';
  const scoreBg    = score >= 90 ? 'bg-green-50 border-green-200' : score >= 70 ? 'bg-blue-50 border-blue-200' : score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const classLabel = score >= 90 ? 'Excelente' : score >= 70 ? 'Boa' : score >= 50 ? 'Atenção' : 'Crítica';

  if (bloqueado) return null;

  return (
    <PageLayout
      title="Prestação de Contas Oficial"
      description="Documento oficial consolidado para apresentação e arquivamento"
      activeMenu="prestacao-contas-oficial"
    >
      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Período</label>
            <MonthPicker value={filtroMes} onChange={v => { setFiltroMes(v); setGenerated(false); }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Congregação</label>
            <select
              value={filtroCong}
              onChange={e => { setFiltroCong(e.target.value); setGenerated(false); }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-[180px]"
            >
              <option value="">Ministério (geral)</option>
              {congregacoes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading || !ministryId}
            className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Carregando…' : 'Gerar Relatório'}
          </button>
          {generated && (
            <>
              <button
                onClick={handleImprimir}
                className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                <Printer size={14} /> Imprimir / PDF
              </button>
              <button
                onClick={handleExportarExcel}
                className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                <Download size={14} /> Exportar Excel
              </button>
              <button
                onClick={handleRegistrarEmissao}
                disabled={registrando}
                className="flex items-center gap-1.5 px-4 py-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 disabled:opacity-50"
              >
                <FileText size={14} /> {registrando ? 'Registrando…' : 'Registrar Emissão'}
              </button>
            </>
          )}
        </div>
        {registradoMsg && (
          <p className={`mt-2 text-sm ${registradoMsg.startsWith('Erro') ? 'text-red-600' : 'text-green-700'}`}>
            {registradoMsg}
          </p>
        )}
      </div>

      {!generated && !loading && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Selecione o período e a congregação, depois clique em <strong>Gerar Relatório</strong>.</p>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-sm">Carregando dados…</div>
        </div>
      )}

      {generated && !loading && (
        <div className="space-y-4">

          {/* ── Cabeçalho Institucional ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Prestação de Contas Oficial</p>
                <h2 className="text-xl font-bold text-gray-900">{ministryNome}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{congNome}</p>
                <p className="text-sm text-gray-600 mt-1">Período: <strong>{monthLabel(filtroMes)}</strong></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Emitido em</p>
                <p className="text-sm font-medium text-gray-700">{generatedAt?.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-gray-400 mt-1">Emissor</p>
                <p className="text-sm text-gray-700">{userName}</p>
              </div>
            </div>
          </div>

          {/* ── Resumo Financeiro ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Resumo Financeiro</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border-l-4 border-gray-300 pl-3">
                <p className="text-xs text-gray-400">Saldo Inicial</p>
                <p className="text-lg font-bold text-gray-700">{fmtBRL(saldoInicial)}</p>
              </div>
              <div className="border-l-4 border-green-400 pl-3">
                <p className="text-xs text-gray-400">(+) Entradas</p>
                <p className="text-lg font-bold text-green-700">{fmtBRL(entradas)}</p>
              </div>
              <div className="border-l-4 border-red-400 pl-3">
                <p className="text-xs text-gray-400">(−) Saídas</p>
                <p className="text-lg font-bold text-red-600">{fmtBRL(saidas)}</p>
              </div>
              <div className={`border-l-4 pl-3 ${saldoFinal >= 0 ? 'border-blue-400' : 'border-orange-400'}`}>
                <p className="text-xs text-gray-400">(=) Saldo Final</p>
                <p className={`text-lg font-bold ${saldoFinal >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>{fmtBRL(saldoFinal)}</p>
              </div>
            </div>
          </div>

          {/* ── Receitas / Despesas ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Receitas */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-green-600" />
                <h3 className="text-sm font-semibold text-gray-800">Receitas por Categoria</h3>
              </div>
              {receitasCat.length === 0
                ? <p className="text-gray-400 text-sm text-center py-6">Nenhum registro</p>
                : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-gray-400 pb-1.5">Categoria</th>
                        <th className="text-right text-gray-400 pb-1.5">Total</th>
                        <th className="text-right text-gray-400 pb-1.5">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receitasCat.map((c, i) => {
                        const pct = entradas > 0 ? ((c.total / entradas) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={c.id ?? 'sem'} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                            <td className="py-1.5">{c.nome}</td>
                            <td className="text-right text-green-700 font-medium py-1.5">{fmtBRL(c.total)}</td>
                            <td className="text-right text-gray-400 py-1.5">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 font-bold">
                        <td className="pt-1.5">Total</td>
                        <td className="text-right text-green-700 pt-1.5">{fmtBRL(entradas)}</td>
                        <td className="text-right text-gray-400 pt-1.5">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                )
              }
            </div>
            {/* Despesas */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={15} className="text-red-600" />
                <h3 className="text-sm font-semibold text-gray-800">Despesas por Categoria</h3>
              </div>
              {despesasCat.length === 0
                ? <p className="text-gray-400 text-sm text-center py-6">Nenhum registro</p>
                : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-gray-400 pb-1.5">Categoria</th>
                        <th className="text-right text-gray-400 pb-1.5">Total</th>
                        <th className="text-right text-gray-400 pb-1.5">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {despesasCat.map((c, i) => {
                        const pct = saidas > 0 ? ((c.total / saidas) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={c.id ?? 'sem'} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                            <td className="py-1.5">{c.nome}</td>
                            <td className="text-right text-red-600 font-medium py-1.5">{fmtBRL(c.total)}</td>
                            <td className="text-right text-gray-400 py-1.5">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 font-bold">
                        <td className="pt-1.5">Total</td>
                        <td className="text-right text-red-600 pt-1.5">{fmtBRL(saidas)}</td>
                        <td className="text-right text-gray-400 pt-1.5">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                )
              }
            </div>
          </div>

          {/* ── Arrecadação Digital ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-800">Arrecadação Digital</h3>
              <span className="text-xs text-gray-400">(categorias identificadas como digitais)</span>
            </div>
            {digitalCat.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">Nenhum lançamento digital identificado neste período</p>
              : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-gray-400 pb-1.5">Categoria</th>
                      <th className="text-right text-gray-400 pb-1.5">Qtd</th>
                      <th className="text-right text-gray-400 pb-1.5">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {digitalCat.map((c, i) => (
                      <tr key={c.id ?? 'sem'} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                        <td className="py-1.5">{c.nome}</td>
                        <td className="text-right text-gray-500 py-1.5">{c.count}</td>
                        <td className="text-right text-blue-700 font-medium py-1.5">{fmtBRL(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-bold">
                      <td className="pt-1.5">Total Digital</td>
                      <td />
                      <td className="text-right text-blue-700 pt-1.5">
                        {fmtBRL(digitalCat.reduce((a, c) => a + c.total, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )
            }
          </div>

          {/* ── Fechamento ────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Fechamento do Período</h3>
            {fechamento
              ? (
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs text-gray-400">Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-0.5 ${fechamento.status === 'fechado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {fechamento.status === 'fechado' ? '✓ Fechado' : '⚠ Aberto'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Saldo Inicial</p>
                    <p className="text-sm font-semibold text-gray-700">{fmtBRL(Number(fechamento.saldo_inicial))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Entradas</p>
                    <p className="text-sm font-semibold text-green-700">{fmtBRL(Number(fechamento.total_entradas))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Saídas</p>
                    <p className="text-sm font-semibold text-red-600">{fmtBRL(Number(fechamento.total_saidas))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Saldo Final</p>
                    <p className={`text-sm font-semibold ${Number(fechamento.saldo_final) >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
                      {fmtBRL(Number(fechamento.saldo_final))}
                    </p>
                  </div>
                  {fechamento.fechado_em && (
                    <div>
                      <p className="text-xs text-gray-400">Fechado em</p>
                      <p className="text-sm text-gray-700">{fmtDate(fechamento.fechado_em)}</p>
                    </div>
                  )}
                </div>
              )
              : <p className="text-gray-400 text-sm">Sem fechamento registrado para este período</p>
            }
          </div>

          {/* ── Auditoria Financeira ──────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={15} className="text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-800">Auditoria Financeira</h3>
            </div>
            <div className={`flex items-center gap-4 border rounded-xl p-4 mb-4 ${scoreBg}`}>
              <div className="text-center min-w-[64px]">
                <p className={`text-4xl font-bold ${scoreColor}`}>{score}</p>
                <p className="text-xs text-gray-400">/ 100</p>
              </div>
              <div>
                <p className={`text-base font-bold ${scoreColor}`}>{classLabel}</p>
                <p className="text-xs text-gray-500 mt-0.5">{alertas.length} alerta(s) identificado(s)</p>
              </div>
            </div>
            {alertas.length === 0
              ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                  <CheckCircle2 size={14} /> Nenhum alerta — prestação de contas sem pendências
                </div>
              )
              : (
                <div className="space-y-2">
                  {alertas.map((a, i) => {
                    const cls = a.gravidade === 'critico'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : a.gravidade === 'atencao'
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800';
                    return (
                      <div key={i} className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-xs ${cls}`}>
                        <AlertTriangle size={12} />
                        <span className="font-semibold capitalize">{a.gravidade}:</span> {a.descricao}
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>

          {/* ── Conselho Fiscal ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Award size={15} className="text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-800">Conselho Fiscal</h3>
            </div>
            {fiscalReview
              ? (
                <>
                  <div className="flex flex-wrap gap-6 mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Status</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-0.5 ${STATUS_FISCAL[fiscalReview.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_FISCAL[fiscalReview.status]?.label ?? fiscalReview.status}
                      </span>
                    </div>
                    {fiscalReview.parecer_status && (
                      <div>
                        <p className="text-xs text-gray-400">Parecer Oficial</p>
                        <p className="text-sm font-medium text-gray-700 capitalize">{fiscalReview.parecer_status.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {fiscalReview.emitido_em && (
                      <div>
                        <p className="text-xs text-gray-400">Emitido em</p>
                        <p className="text-sm text-gray-700">{fmtDateTime(fiscalReview.emitido_em)}</p>
                      </div>
                    )}
                  </div>
                  {fiscalReview.parecer && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-400 mb-1">Parecer</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{fiscalReview.parecer}</p>
                    </div>
                  )}
                  {fiscalReview.ressalvas && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-400 mb-1">Ressalvas</p>
                      <p className="text-sm text-yellow-800 bg-yellow-50 rounded-lg p-3">{fiscalReview.ressalvas}</p>
                    </div>
                  )}
                  {fiscalReview.recomendacoes && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-400 mb-1">Recomendações</p>
                      <p className="text-sm text-blue-800 bg-blue-50 rounded-lg p-3">{fiscalReview.recomendacoes}</p>
                    </div>
                  )}
                  {signatures.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={13} className="text-gray-400" />
                        <p className="text-xs font-medium text-gray-500">Assinaturas ({signatures.length})</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {signatures.map(s => (
                          <div key={s.id} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2 text-xs bg-gray-50">
                            <CheckCircle2 size={12} className="text-green-600 flex-shrink-0" />
                            <div>
                              <span className="font-medium text-gray-800">{s.nome}</span>
                              <span className="text-gray-400"> · {s.cargo}</span>
                              <div className="text-gray-400">{fmtDateTime(s.signed_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )
              : (
                <div className="text-gray-400 text-sm flex items-center gap-2 py-2">
                  <Minus size={14} />
                  Sem análise do Conselho Fiscal para este período
                </div>
              )
            }
          </div>

          {/* ── Rodapé Oficial ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Rodapé Oficial</h3>
            <div className="grid grid-cols-3 gap-6 mt-2">
              {['Tesoureiro(a)', 'Pastor(a) Presidente', 'Conselho Fiscal'].map(cargo => (
                <div key={cargo} className="text-center">
                  <div className="border-t-2 border-gray-300 pt-2 mt-10">
                    <p className="text-xs text-gray-500 font-medium">{cargo}</p>
                    <p className="text-xs text-gray-400">{monthLabel(filtroMes)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </PageLayout>
  );
}
