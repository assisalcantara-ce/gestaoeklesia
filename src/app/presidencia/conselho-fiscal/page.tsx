'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  Scale, ClipboardCheck, CheckCircle2, XCircle, AlertCircle,
  Clock, Search, Printer, Save, FileText,
  AlertTriangle, Info, Eye,
  Award, PenLine, ShieldCheck, Lock, Unlock, Fingerprint,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }

interface Fechamento {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  mes_referencia: string;
  saldo_inicial: number;
  total_entradas: number;
  total_saidas: number;
  saldo_final: number;
  status: string;
  status_conselho_fiscal: string;
  observacoes: string | null;
  fechado_em: string | null;
}

interface FiscalReview {
  id: string;
  fechamento_id: string;
  status: string;
  parecer_status: string;
  parecer: string | null;
  ressalvas: string | null;
  recomendacoes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  document_hash: string | null;
  emitido_em: string | null;
  created_at: string;
  updated_at: string;
}

interface FechamentoComReview extends Fechamento {
  review: FiscalReview | null;
  congNome: string;
}

interface ModalLanc {
  id: string;
  tipo_movimento: string;
  valor: number;
  categoria_id: string | null;
  descricao: string | null;
  data_lancamento: string;
}

type StatusConselho = 'pendente' | 'em_analise' | 'aprovado' | 'aprovado_com_ressalvas' | 'rejeitado';
type ParecerStatus  = 'rascunho' | 'aguardando_assinaturas' | 'finalizado';

interface FiscalSignature {
  id: string;
  review_id: string;
  ministry_id: string;
  usuario_id: string | null;
  nome: string;
  cargo: string;
  tipo_assinatura: string;
  hash_assinatura: string;
  ip_address: string | null;
  signed_at: string;
  created_at: string;
  revogado_em: string | null;
}

const PARECER_STATUS_CONFIG: Record<ParecerStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  rascunho:               { label: 'Rascunho',         color: 'text-gray-500',  bg: 'bg-gray-100',  icon: <FileText size={12}/> },
  aguardando_assinaturas: { label: 'Ag. assinaturas',  color: 'text-blue-700',  bg: 'bg-blue-50',   icon: <PenLine size={12}/> },
  finalizado:             { label: 'Finalizado',        color: 'text-green-700', bg: 'bg-green-100', icon: <ShieldCheck size={12}/> },
};

const TIPOS_ASSINATURA = [
  { value: 'presidente_conselho',   label: 'Presidente do Conselho Fiscal' },
  { value: 'membro_conselho',       label: 'Membro do Conselho Fiscal' },
  { value: 'relator',               label: 'Relator' },
  { value: 'presidente_ministerio', label: 'Presidente do Ministério' },
  { value: 'tesoureiro',            label: 'Tesoureiro' },
];

interface UserScope {
  isAdmin: boolean;
  isFinanceiro: boolean;
  isPresidencia: boolean;
  isConselhoFiscal: boolean;
  canWrite: boolean; // pode criar/editar parecer
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const MESES_BR = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_CONFIG: Record<StatusConselho, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pendente:              { label: 'Pendente',              color: 'text-gray-600',  bg: 'bg-gray-100',   icon: <Clock size={13} /> },
  em_analise:            { label: 'Em análise',            color: 'text-blue-700',  bg: 'bg-blue-50',    icon: <Search size={13} /> },
  aprovado:              { label: 'Aprovado',              color: 'text-green-700', bg: 'bg-green-50',   icon: <CheckCircle2 size={13} /> },
  aprovado_com_ressalvas:{ label: 'Aprov. c/ ressalvas',  color: 'text-yellow-700',bg: 'bg-yellow-50',  icon: <AlertCircle size={13} /> },
  rejeitado:             { label: 'Rejeitado',             color: 'text-red-700',   bg: 'bg-red-50',     icon: <XCircle size={13} /> },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MESES_BR[Number(m) - 1]}/${y}`;
}

function statusCfg(s: string) {
  return STATUS_CONFIG[s as StatusConselho] ?? STATUS_CONFIG['pendente'];
}

async function sha256(msg: string): Promise<string> {
  const buf  = new TextEncoder().encode(msg);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: number | string; sub?: string; color?: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color ?? 'bg-gray-100'} flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ConselhoFiscalPage() {
  const { ctx, bloqueado } = useRequireModulo('conselho_fiscal');
  const supabase = useMemo(() => createClient(), []);

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [fechamentos, setFechamentos]   = useState<FechamentoComReview[]>([]);
  const [scope, setScope] = useState<UserScope>({
    isAdmin: false, isFinanceiro: false, isPresidencia: false,
    isConselhoFiscal: false, canWrite: false,
  });

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroMes,    setFiltroMes]    = useState('');
  const [filtroCong,   setFiltroCong]   = useState('');

  // Modal de análise
  const [modal, setModal]             = useState<FechamentoComReview | null>(null);
  const [modalLancs, setModalLancs]   = useState<ModalLanc[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Formulário de parecer
  const [fStatus,        setFStatus]        = useState<StatusConselho>('em_analise');
  const [fParecer,       setFParecer]       = useState('');
  const [fRessalvas,     setFRessalvas]     = useState('');
  const [fRecomendacoes, setFRecomendacoes] = useState('');
  const [salvando,       setSalvando]       = useState(false);
  const [saveMsg,        setSaveMsg]        = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Parecer Oficial
  const [aba, setAba]                   = useState<'analise' | 'parecer_oficial'>('analise');
  const [ministryNome, setMinistryNome] = useState('');
  const [signatures, setSignatures]     = useState<Map<string, FiscalSignature[]>>(new Map());
  const [sigModal, setSigModal]         = useState<FechamentoComReview | null>(null);
  const [sigNome, setSigNome]           = useState('');
  const [sigCargo, setSigCargo]         = useState('');
  const [sigTipo, setSigTipo]           = useState('membro_conselho');
  const [assinando, setAssinando]       = useState(false);
  const [signMsg, setSignMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [emitindo, setEmitindo]         = useState<string | null>(null);

  // ── Resolve ministry id ────────────────────────────────────────────────────

  useEffect(() => {
    if (ctx.loading || bloqueado) return;
    if (ctx.ministryId) { setMinistryId(ctx.ministryId); return; }
    resolveMinistryId(supabase).then(id => setMinistryId(id ?? null));
  }, [ctx.loading, ctx.ministryId, bloqueado, supabase]);

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!ministryId) return;
    setLoading(true);

    // Detect user scope
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (uid) {
      const { data: mu } = await supabase
        .from('ministry_users')
        .select('role, permissions')
        .eq('ministry_id', ministryId)
        .eq('user_id', uid)
        .maybeSingle();
      if (mu) {
        const perms: string[] = Array.isArray(mu.permissions) ? mu.permissions : [];
        const isAdmin    = perms.includes('ADMINISTRADOR') || mu.role === 'admin';
        const isFin      = perms.includes('FINANCEIRO');
        const isPres     = perms.includes('PRESIDENCIA');
        const isCF       = perms.includes('CONSELHO_FISCAL');
        setScope({ isAdmin, isFinanceiro: isFin, isPresidencia: isPres, isConselhoFiscal: isCF, canWrite: isAdmin || isCF });
      }
    }

    // Nome do ministério e usuário autenticado (para documentos oficiais e assinatura)
    const { data: mData } = await supabase.from('ministries').select('nome').eq('id', ministryId).maybeSingle();
    setMinistryNome((mData as { nome: string } | null)?.nome ?? '');
    const userMeta = sessionData.session?.user;
    setSigNome(prev => prev || userMeta?.user_metadata?.name || userMeta?.user_metadata?.full_name || userMeta?.email || '');

    // Congregações
    const { data: congs } = await supabase
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', ministryId)
      .eq('is_active', true)
      .order('nome');
    const congList = (congs as Congregacao[]) || [];
    setCongregacoes(congList);
    const congMap = new Map(congList.map(c => [c.id, c.nome]));

    // Fechamentos (apenas fechados)
    const { data: fechs } = await supabase
      .from('tesouraria_fechamentos')
      .select('id,ministry_id,congregacao_id,mes_referencia,saldo_inicial,total_entradas,total_saidas,saldo_final,status,status_conselho_fiscal,observacoes,fechado_em')
      .eq('ministry_id', ministryId)
      .eq('status', 'fechado')
      .order('mes_referencia', { ascending: false })
      .order('congregacao_id', { ascending: true });
    const fechList = (fechs as Fechamento[]) || [];

    // Pareceres existentes
    let reviews: FiscalReview[] = [];
    try {
      const { data: revs } = await supabase
        .from('financial_fiscal_reviews')
        .select('*')
        .eq('ministry_id', ministryId);
      reviews = (revs as FiscalReview[]) || [];
    } catch { /* tabela pode não existir antes da migration */ }

    const reviewMap = new Map(reviews.map(r => [r.fechamento_id, r]));

    // Assinaturas dos pareceres
    let sigList: FiscalSignature[] = [];
    try {
      const { data: sigData } = await supabase
        .from('financial_fiscal_signatures')
        .select('*')
        .eq('ministry_id', ministryId)
        .is('revogado_em', null);          // apenas assinaturas ativas
      sigList = (sigData as FiscalSignature[]) || [];
    } catch { /* tabela pode não existir antes da migration */ }
    const sigMap = new Map<string, FiscalSignature[]>();
    for (const s of sigList) {
      if (!sigMap.has(s.review_id)) sigMap.set(s.review_id, []);
      sigMap.get(s.review_id)!.push(s);
    }
    setSignatures(sigMap);

    // Merge
    const merged: FechamentoComReview[] = fechList.map(f => ({
      ...f,
      status_conselho_fiscal: f.status_conselho_fiscal ?? 'pendente',
      review: reviewMap.get(f.id) ?? null,
      congNome: f.congregacao_id ? (congMap.get(f.congregacao_id) ?? 'Congregação') : 'Sede / Caixa Geral',
    }));

    setFechamentos(merged);
    setLoading(false);
  }, [ministryId, supabase]);

  useEffect(() => { if (ministryId) load(); }, [ministryId, load]);

  // ── Abrir modal ────────────────────────────────────────────────────────────

  const openModal = useCallback(async (f: FechamentoComReview) => {
    setModal(f);
    // Pré-preencher formulário com review existente
    const r = f.review;
    setFStatus((r?.status ?? 'em_analise') as StatusConselho);
    setFParecer(r?.parecer ?? '');
    setFRessalvas(r?.ressalvas ?? '');
    setFRecomendacoes(r?.recomendacoes ?? '');
    setSaveMsg(null);

    // Carregar lançamentos do mês/congregação
    setModalLoading(true);
    setModalLancs([]);
    try {
      let q = supabase
        .from('tesouraria_lancamentos')
        .select('id,tipo_movimento,valor,categoria_id,descricao,data_lancamento')
        .eq('ministry_id', f.ministry_id)
        .gte('data_lancamento', `${f.mes_referencia}-01`)
        .lt('data_lancamento', mesProximo(f.mes_referencia));
      if (f.congregacao_id === null) q = q.is('congregacao_id', null);
      else q = q.eq('congregacao_id', f.congregacao_id);
      const { data } = await q.order('data_lancamento', { ascending: false });
      setModalLancs((data as ModalLanc[]) || []);
    } catch { setModalLancs([]); }
    setModalLoading(false);
  }, [supabase]);

  function mesProximo(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  // ── Salvar parecer ─────────────────────────────────────────────────────────

  const salvarParecer = useCallback(async () => {
    if (!modal || !ministryId) return;
    if (!scope.canWrite) { setSaveMsg({ type: 'err', text: 'Sem permissão para emitir parecer.' }); return; }

    // Bloquear edição após emissão oficial: evita hash obsoleto
    if (modal.review?.parecer_status && modal.review.parecer_status !== 'rascunho') {
      setSaveMsg({ type: 'err', text: 'Parecer já emitido oficialmente. Use a aba "Parecer Oficial" para reabrir antes de editar.' });
      return;
    }

    // Bug #2: parecer obrigatório para status definitivos
    if ((fStatus === 'aprovado' || fStatus === 'aprovado_com_ressalvas' || fStatus === 'rejeitado') && !fParecer.trim()) {
      setSaveMsg({ type: 'err', text: 'O parecer é obrigatório para aprovação ou rejeição.' });
      return;
    }

    setSalvando(true);
    setSaveMsg(null);
    const { data: sd } = await supabase.auth.getSession();
    const uid = sd.session?.user.id ?? null;
    const now = new Date().toISOString();

    const reviewPayload = {
      ministry_id:    ministryId,
      fechamento_id:  modal.id,
      congregacao_id: modal.congregacao_id,
      mes_referencia: modal.mes_referencia,
      status:         fStatus,
      parecer:        fParecer || null,
      ressalvas:      fRessalvas || null,
      recomendacoes:  fRecomendacoes || null,
      reviewed_by:    uid,
      reviewed_at:    now,
      updated_at:     now,
    };

    let savedReview: FiscalReview | null = null;
    let reviewErr: string | null = null;

    if (modal.review?.id) {
      // Atualizar review existente
      const { error } = await supabase
        .from('financial_fiscal_reviews')
        .update(reviewPayload)
        .eq('id', modal.review.id);
      if (error) reviewErr = error.message;
      else savedReview = { ...(modal.review as FiscalReview), ...reviewPayload };
    } else {
      // Bug #1: usar .select().single() para capturar id do novo registro
      // e evitar INSERT duplicado em saves consecutivos sem fechar o modal
      const { data: inserted, error } = await supabase
        .from('financial_fiscal_reviews')
        .insert({ ...reviewPayload, created_at: now })
        .select()
        .single();
      if (error) reviewErr = error.message;
      else savedReview = inserted as FiscalReview;
    }

    if (reviewErr) {
      setSaveMsg({ type: 'err', text: reviewErr });
      setSalvando(false);
      return;
    }

    // Atualizar status_conselho_fiscal no fechamento
    await supabase
      .from('tesouraria_fechamentos')
      .update({ status_conselho_fiscal: fStatus })
      .eq('id', modal.id);

    // Log da ação
    try {
      await supabase.from('tesouraria_fechamento_logs').insert({
        fechamento_id:  modal.id,
        congregacao_id: modal.congregacao_id,
        usuario_id:     uid,
        acao:           'revisao',
      });
    } catch { /* log table pode não existir */ }

    // Bug #1: atualizar modal com review salvo para que saves subsequentes
    // usem UPDATE em vez de tentar INSERT novamente (violaria UNIQUE constraint)
    if (savedReview) {
      const reviewSnapshot = savedReview;
      setModal(prev => prev ? { ...prev, review: reviewSnapshot, status_conselho_fiscal: fStatus } : prev);
    }

    setSaveMsg({ type: 'ok', text: 'Parecer salvo com sucesso!' });
    setSalvando(false);
    load(); // Recarregar lista
  }, [modal, ministryId, scope, fStatus, fParecer, fRessalvas, fRecomendacoes, supabase, load]);

  // ── Impressão do parecer ────────────────────────────────────────────────────

  const imprimirParecer = useCallback(() => {
    if (!modal) return;
    // Bug #4: escapar conteúdo de usuário para evitar XSS na janela de impressão
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const cfg = statusCfg(fStatus);
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Parecer Fiscal — ${modal.congNome} — ${monthLabel(modal.mes_referencia)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1f2937; padding: 28px; }
  h1 { font-size: 18px; color: #123b63; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 11px; margin-bottom: 20px; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase;
    letter-spacing: .05em; color: #6b7280; border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4px; margin-bottom: 10px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
  .card-label { font-size: 9px; text-transform: uppercase; color: #9ca3af; margin-bottom: 3px; }
  .card-value { font-size: 14px; font-weight: bold; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: bold; background: #f3f4f6; color: #374151; }
  .text-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
    padding: 10px 12px; white-space: pre-wrap; font-size: 11px; line-height: 1.6; min-height: 40px; }
  .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px;
    font-size: 9px; color: #9ca3af; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
<h1>⚖️ Parecer do Conselho Fiscal</h1>
<p class="subtitle">Gerado em ${new Date().toLocaleString('pt-BR')}</p>

<div class="section">
  <p class="section-title">Identificação</p>
  <div class="grid2">
    <div class="card"><p class="card-label">Congregação / Caixa</p>
      <p class="card-value">${esc(modal.congNome)}</p></div>
    <div class="card"><p class="card-label">Mês de Referência</p>
      <p class="card-value">${monthLabel(modal.mes_referencia)}</p></div>
    <div class="card"><p class="card-label">Fechado em</p>
      <p class="card-value">${modal.fechado_em ? fmtDate(modal.fechado_em) : '—'}</p></div>
    <div class="card"><p class="card-label">Status do Conselho</p>
      <p class="status-badge">${cfg.label}</p></div>
  </div>
</div>

<div class="section">
  <p class="section-title">Resumo Financeiro</p>
  <div class="grid2">
    <div class="card"><p class="card-label">Saldo Inicial</p>
      <p class="card-value">${fmtBRL(modal.saldo_inicial)}</p></div>
    <div class="card"><p class="card-label">Total Entradas</p>
      <p class="card-value" style="color:#16a34a">${fmtBRL(modal.total_entradas)}</p></div>
    <div class="card"><p class="card-label">Total Saídas</p>
      <p class="card-value" style="color:#dc2626">${fmtBRL(modal.total_saidas)}</p></div>
    <div class="card"><p class="card-label">Saldo Final</p>
      <p class="card-value">${fmtBRL(modal.saldo_final)}</p></div>
  </div>
</div>

<div class="section">
  <p class="section-title">Parecer</p>
  <div class="text-block">${esc(fParecer) || '(não preenchido)'}</div>
</div>
${fRessalvas ? `
<div class="section">
  <p class="section-title">Ressalvas</p>
  <div class="text-block">${esc(fRessalvas)}</div>
</div>` : ''}
${fRecomendacoes ? `
<div class="section">
  <p class="section-title">Recomendações</p>
  <div class="text-block">${esc(fRecomendacoes)}</div>
</div>` : ''}

<div class="footer">
  Documento gerado pelo sistema Gestão Eklesia — Conselho Fiscal Digital.
  Este documento não substitui ata ou deliberação formal do conselho.
</div>
</body>
</html>`;
    const w = window.open('', '_blank', 'width=800,height=650');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }, [modal, fStatus, fParecer, fRessalvas, fRecomendacoes]);

  // ── Parecer Oficial ─────────────────────────────────────────────────────────────

  const emitirParecer = useCallback(async (f: FechamentoComReview) => {
    if (!f.review || !ministryId) return;
    const { data: sd } = await supabase.auth.getSession();
    const uid = sd.session?.user.id ?? null;
    const ts = new Date().toISOString();
    const rawHash = [f.review.id, f.review.status, f.review.parecer || '', f.review.ressalvas || '', f.review.recomendacoes || '', ts].join('|');
    const docHash = await sha256(rawHash);
    setEmitindo(f.review.id);
    const { error } = await supabase.from('financial_fiscal_reviews').update({
      parecer_status: 'aguardando_assinaturas',
      document_hash:  docHash,
      emitido_em:     ts,
    }).eq('id', f.review.id);
    if (!error) {
      try {
        await supabase.from('tesouraria_fechamento_logs').insert({
          fechamento_id: f.id, congregacao_id: f.congregacao_id, usuario_id: uid, acao: 'emissao_parecer',
        });
      } catch { /* log opcional */ }
      load();
    }
    setEmitindo(null);
  }, [ministryId, supabase, load]);

  const assinarParecer = useCallback(async () => {
    if (!sigModal?.review || !ministryId || !sigNome.trim() || !sigCargo.trim()) {
      setSignMsg({ type: 'err', text: 'Preencha nome e cargo antes de assinar.' });
      return;
    }
    setAssinando(true);
    setSignMsg(null);
    const { data: sd } = await supabase.auth.getSession();
    const uid = sd.session?.user.id ?? null;
    const ts = new Date().toISOString();
    let ip: string | null = null;
    try {
      const r = await fetch('/api/v1/my-ip');
      if (r.ok) { const j = await r.json(); ip = j.ip ?? null; }
    } catch { /* ip é opcional */ }
    const rawSig  = [uid || '', sigModal.review.id, ts, ip || ''].join('|');
    const sigHash = await sha256(rawSig);
    const { error } = await supabase.from('financial_fiscal_signatures').insert({
      review_id: sigModal.review.id, ministry_id: ministryId, usuario_id: uid,
      nome: sigNome.trim(), cargo: sigCargo.trim(), tipo_assinatura: sigTipo,
      hash_assinatura: sigHash, ip_address: ip, signed_at: ts,
    });
    if (error) {
      setSignMsg({ type: 'err', text: error.message });
    } else {
      try {
        await supabase.from('tesouraria_fechamento_logs').insert({
          fechamento_id: sigModal.id, congregacao_id: sigModal.congregacao_id, usuario_id: uid, acao: 'assinatura',
        });
      } catch { /* log opcional */ }
      setSignMsg({ type: 'ok', text: 'Assinatura registrada com sucesso!' });
      load();
    }
    setAssinando(false);
  }, [sigModal, ministryId, sigNome, sigCargo, sigTipo, supabase, load]);

  const finalizarParecer = useCallback(async (f: FechamentoComReview) => {
    if (!f.review || !ministryId) return;
    const { data: sd } = await supabase.auth.getSession();
    const uid = sd.session?.user.id ?? null;
    await supabase.from('financial_fiscal_reviews').update({ parecer_status: 'finalizado' }).eq('id', f.review.id);
    try {
      await supabase.from('tesouraria_fechamento_logs').insert({
        fechamento_id: f.id, congregacao_id: f.congregacao_id, usuario_id: uid, acao: 'finalizacao_parecer',
      });
    } catch { /* log opcional */ }
    load();
  }, [ministryId, supabase, load]);

  const reabrirParecer = useCallback(async (f: FechamentoComReview) => {
    if (!f.review || !ministryId) return;
    const { data: sd } = await supabase.auth.getSession();
    const uid = sd.session?.user.id ?? null;
    const agora = new Date().toISOString();
    // Revogar (soft-delete) assinaturas existentes — mantém histórico de auditoria.
    // A coluna revogado_em preserva quando cada assinatura foi invalidada.
    await supabase
      .from('financial_fiscal_signatures')
      .update({ revogado_em: agora })
      .eq('review_id', f.review.id)
      .is('revogado_em', null);
    await supabase.from('financial_fiscal_reviews').update({
      parecer_status: 'rascunho', document_hash: null, emitido_em: null,
    }).eq('id', f.review.id);
    try {
      await supabase.from('tesouraria_fechamento_logs').insert({
        fechamento_id: f.id, congregacao_id: f.congregacao_id, usuario_id: uid, acao: 'reabertura_parecer',
      });
    } catch { /* log opcional */ }
    load();
  }, [ministryId, supabase, load]);

  const imprimirParecerOficial = useCallback((f: FechamentoComReview) => {
    if (!f.review) return;
    const e = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sigs  = signatures.get(f.review.id) ?? [];
    const ps    = (f.review.parecer_status || 'rascunho') as ParecerStatus;
    const psCfg = PARECER_STATUS_CONFIG[ps] ?? PARECER_STATUS_CONFIG['rascunho'];
    const html  = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/>
<title>Parecer Oficial — ${e(f.congNome)} — ${monthLabel(f.mes_referencia)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1f2937;padding:32px}
  .logo-row{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #123b63;padding-bottom:14px;margin-bottom:20px}
  .min-name{font-size:20px;font-weight:bold;color:#123b63}
  .doc-title{font-size:13px;color:#4b5563;margin-top:3px}
  .subtitle{color:#6b7280;font-size:10px;margin-top:2px}
  .section{margin-bottom:16px}
  .section-title{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:10px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px}
  .card{border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px}
  .card-label{font-size:9px;text-transform:uppercase;color:#9ca3af;margin-bottom:3px}
  .card-value{font-size:13px;font-weight:bold}
  .text-block{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;white-space:pre-wrap;font-size:11px;line-height:1.6;min-height:36px}
  .sig-header{display:grid;grid-template-columns:1.5fr 1.5fr 1fr;font-size:9px;font-weight:bold;text-transform:uppercase;color:#6b7280;padding:4px 0;border-bottom:1px solid #e5e7eb}
  .sig-row{display:grid;grid-template-columns:1.5fr 1.5fr 1fr;font-size:10px;padding:6px 0;border-bottom:1px solid #f3f4f6}
  .hash-block{background:#f3f4f6;border:1px dashed #d1d5db;border-radius:4px;padding:8px 12px;font-family:monospace;font-size:9px;color:#6b7280;word-break:break-all;margin-top:6px}
  .footer{margin-top:28px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:9px;color:#9ca3af}
  @media print{body{padding:12px}}
</style>
</head>
<body>
<div class="logo-row">
  <div>
    <p class="min-name">${e(ministryNome || 'Ministério')}</p>
    <p class="doc-title">⚖️ PARECER OFICIAL DO CONSELHO FISCAL</p>
    <p class="subtitle">Emitido em ${f.review.emitido_em ? new Date(f.review.emitido_em).toLocaleString('pt-BR') : '—'} · Status: ${e(psCfg.label)}</p>
  </div>
</div>
<div class="section">
  <p class="section-title">Identificação</p>
  <div class="grid2">
    <div class="card"><p class="card-label">Congregação / Caixa</p><p class="card-value">${e(f.congNome)}</p></div>
    <div class="card"><p class="card-label">Mês de Referência</p><p class="card-value">${monthLabel(f.mes_referencia)}</p></div>
    <div class="card"><p class="card-label">Fechamento realizado em</p><p class="card-value">${f.fechado_em ? fmtDate(f.fechado_em) : '—'}</p></div>
    <div class="card"><p class="card-label">Resultado da análise</p><p class="card-value">${e(statusCfg(f.review.status).label)}</p></div>
  </div>
</div>
<div class="section">
  <p class="section-title">Resumo Financeiro</p>
  <div class="grid4">
    <div class="card"><p class="card-label">Saldo Inicial</p><p class="card-value">${fmtBRL(f.saldo_inicial)}</p></div>
    <div class="card"><p class="card-label">Total Entradas</p><p class="card-value" style="color:#16a34a">${fmtBRL(f.total_entradas)}</p></div>
    <div class="card"><p class="card-label">Total Saídas</p><p class="card-value" style="color:#dc2626">${fmtBRL(f.total_saidas)}</p></div>
    <div class="card"><p class="card-label">Saldo Final</p><p class="card-value">${fmtBRL(f.saldo_final)}</p></div>
  </div>
</div>
<div class="section">
  <p class="section-title">Parecer do Conselho Fiscal</p>
  <div class="text-block">${e(f.review.parecer || '(não preenchido)')}</div>
</div>
${f.review.ressalvas ? `<div class="section"><p class="section-title">Ressalvas</p><div class="text-block">${e(f.review.ressalvas)}</div></div>` : ''}
${f.review.recomendacoes ? `<div class="section"><p class="section-title">Recomendações</p><div class="text-block">${e(f.review.recomendacoes)}</div></div>` : ''}
<div class="section">
  <p class="section-title">Assinaturas Digitais (${sigs.length})</p>
  ${sigs.length === 0
    ? '<p style="color:#9ca3af;font-size:11px;font-style:italic">Nenhuma assinatura registrada ainda.</p>'
    : `<div><div class="sig-header"><span>Nome</span><span>Cargo</span><span>Data/Hora</span></div>${sigs.map(s => `<div class="sig-row"><span>${e(s.nome)}</span><span>${e(s.cargo)}</span><span>${new Date(s.signed_at).toLocaleString('pt-BR')}</span></div>`).join('')}</div>`
  }
</div>
<div class="section">
  <p class="section-title">Autenticidade e Integridade</p>
  ${f.review.document_hash
    ? `<div class="hash-block">Hash SHA-256 do documento: ${e(f.review.document_hash)}</div><p style="margin-top:6px;font-size:10px;color:#6b7280">Preparado para verificação por QR Code em versão futura.</p>`
    : '<p style="color:#9ca3af;font-size:11px">Parecer não emitido oficialmente — hash não gerado.</p>'
  }
</div>
<div class="footer">
  Documento gerado pelo sistema Gestão Eklesia — Conselho Fiscal Digital.<br/>
  Parecer Oficial · Ministério: ${e(ministryNome || '—')} · ${e(f.congNome)} · ${monthLabel(f.mes_referencia)}<br/>
  Este documento é de caráter oficial e pode ser utilizado para fins de auditoria, contabilidade e prestação de contas.
</div>
</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }, [signatures, ministryNome]);

  // ── Dados filtrados ────────────────────────────────────────────────────────

  const fechamentosFiltrados = useMemo(() => {
    return fechamentos.filter(f => {
      if (filtroStatus && f.status_conselho_fiscal !== filtroStatus) return false;
      if (filtroMes    && f.mes_referencia !== filtroMes)            return false;
      if (filtroCong) {
        if (filtroCong === '__sede__' && f.congregacao_id !== null) return false;
        if (filtroCong !== '__sede__' && f.congregacao_id !== filtroCong) return false;
      }
      return true;
    });
  }, [fechamentos, filtroStatus, filtroMes, filtroCong]);

  // KPIs
  const kpis = useMemo(() => ({
    pendente:              fechamentos.filter(f => f.status_conselho_fiscal === 'pendente').length,
    em_analise:            fechamentos.filter(f => f.status_conselho_fiscal === 'em_analise').length,
    aprovado:              fechamentos.filter(f => f.status_conselho_fiscal === 'aprovado').length,
    aprovado_com_ressalvas:fechamentos.filter(f => f.status_conselho_fiscal === 'aprovado_com_ressalvas').length,
    rejeitado:             fechamentos.filter(f => f.status_conselho_fiscal === 'rejeitado').length,
  }), [fechamentos]);

  // Alertas derivados dos lançamentos do modal
  const modalAlertas = useMemo(() => {
    if (!modalLancs.length) return { semCategoria: 0, totalLancs: 0 };
    const semCategoria = modalLancs.filter(l => !l.categoria_id).length;
    return { semCategoria, totalLancs: modalLancs.length };
  }, [modalLancs]);

  const modalDivergencia = useMemo(() => {
    if (!modal) return null;
    const esperado = modal.saldo_inicial + modal.total_entradas - modal.total_saidas;
    const diff = Math.abs(modal.saldo_final - esperado);
    return diff > 0.01 ? diff : null;
  }, [modal]);

  // Meses disponíveis para o filtro
  const mesesDisponiveis = useMemo(() =>
    [...new Set(fechamentos.map(f => f.mes_referencia))].sort().reverse(),
  [fechamentos]);

  const parecerFiltrados = useMemo(() =>
    fechamentos.filter(f =>
      f.review && (f.review.status === 'aprovado' || f.review.status === 'aprovado_com_ressalvas')
    ),
  [fechamentos]);

  const parecerKpis = useMemo(() => ({
    rascunho:              parecerFiltrados.filter(f => !f.review || f.review.parecer_status === 'rascunho').length,
    aguardando_assinaturas:parecerFiltrados.filter(f => f.review?.parecer_status === 'aguardando_assinaturas').length,
    finalizados:           parecerFiltrados.filter(f => f.review?.parecer_status === 'finalizado').length,
    emitidos:              parecerFiltrados.filter(f => f.review && f.review.parecer_status !== 'rascunho').length,
  }), [parecerFiltrados]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (ctx.loading || bloqueado) return null;

  return (
    <PageLayout
      title="Conselho Fiscal"
      description="Análise e parecer sobre fechamentos financeiros por congregação"
      activeMenu="conselho-fiscal"
    >
      {/* ─── Navegação de abas ──────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 mb-6 gap-0.5">
        {(['analise', 'parecer_oficial'] as const).map(key => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              aba === key
                ? 'border-[#123b63] text-[#123b63]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {key === 'analise' ? '⚖️ Análise' : '🏅 Parecer Oficial'}
          </button>
        ))}
      </div>

      {/* ─── Aba: Análise ─────────────────────────────────────────────────────── */}
      {aba === 'analise' && (<>

      {/* ─── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="Pendente" value={kpis.pendente}
          color="bg-gray-100 text-gray-500"
          icon={<Clock size={18} className="text-gray-500" />}
        />
        <KpiCard
          label="Em análise" value={kpis.em_analise}
          color="bg-blue-50 text-blue-600"
          icon={<Search size={18} className="text-blue-600" />}
        />
        <KpiCard
          label="Aprovado" value={kpis.aprovado}
          color="bg-green-50 text-green-600"
          icon={<CheckCircle2 size={18} className="text-green-600" />}
        />
        <KpiCard
          label="C/ ressalvas" value={kpis.aprovado_com_ressalvas}
          color="bg-yellow-50 text-yellow-600"
          icon={<AlertCircle size={18} className="text-yellow-600" />}
        />
        <KpiCard
          label="Rejeitado" value={kpis.rejeitado}
          color="bg-red-50 text-red-600"
          icon={<XCircle size={18} className="text-red-600" />}
        />
      </div>

      {/* ─── Filtros ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Mês</label>
          <select
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
          >
            <option value="">Todos</option>
            {mesesDisponiveis.map(m => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Congregação</label>
          <select
            value={filtroCong}
            onChange={e => setFiltroCong(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
          >
            <option value="">Todas</option>
            <option value="__sede__">Sede / Caixa Geral</option>
            {congregacoes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {(filtroStatus || filtroMes || filtroCong) && (
          <button
            onClick={() => { setFiltroStatus(''); setFiltroMes(''); setFiltroCong(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Limpar filtros
          </button>
        )}

        <div className="ml-auto text-xs text-gray-400 self-end">
          {fechamentosFiltrados.length} de {fechamentos.length} fechamentos
        </div>
      </div>

      {/* ─── Tabela de fechamentos ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando fechamentos...</div>
        ) : fechamentosFiltrados.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            <Scale size={32} className="mx-auto mb-3 text-gray-300" />
            {fechamentos.length === 0
              ? 'Nenhum fechamento encontrado. Feche o mês na Tesouraria para que apareça aqui.'
              : 'Nenhum fechamento corresponde aos filtros.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Congregação</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Mês</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Entradas</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Saídas</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Saldo Final</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status CF</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fechamentosFiltrados.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{f.congNome}</td>
                    <td className="px-4 py-3 text-gray-600">{monthLabel(f.mes_referencia)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{fmtBRL(f.total_entradas)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{fmtBRL(f.total_saidas)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">{fmtBRL(f.saldo_final)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={f.status_conselho_fiscal} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openModal(f)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#123b63] hover:bg-[#0f3055] text-white text-xs font-medium rounded-lg transition"
                      >
                        <Eye size={13} />
                        {scope.canWrite ? 'Analisar' : 'Visualizar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>)}

      {/* ─── Aba: Parecer Oficial ───────────────────────────────────────────── */}
      {aba === 'parecer_oficial' && (<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Prontos p/ emissão" value={parecerKpis.rascunho}
            color="bg-gray-100" icon={<FileText size={18} className="text-gray-500"/>}/>
          <KpiCard label="Ag. assinaturas" value={parecerKpis.aguardando_assinaturas}
            color="bg-blue-50" icon={<PenLine size={18} className="text-blue-600"/>}/>
          <KpiCard label="Finalizados" value={parecerKpis.finalizados}
            color="bg-green-50" icon={<ShieldCheck size={18} className="text-green-600"/>}/>
          <KpiCard label="Total emitidos" value={parecerKpis.emitidos}
            color="bg-purple-50" icon={<Award size={18} className="text-purple-600"/>}/>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Carregando pareceres...</div>
          ) : parecerFiltrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <Award size={32} className="mx-auto mb-3 text-gray-300"/>
              <p>Nenhum fechamento com análise aprovada.</p>
              <p className="mt-1 text-xs">Acesse a aba &ldquo;Análise&rdquo; para analisar e aprovar fechamentos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Congregação</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Mês</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Análise</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Parecer Oficial</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Assinaturas</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Emitido em</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {parecerFiltrados.map(f => {
                    const sigs  = signatures.get(f.review!.id) ?? [];
                    const ps    = (f.review!.parecer_status || 'rascunho') as ParecerStatus;
                    const psCfg = PARECER_STATUS_CONFIG[ps] ?? PARECER_STATUS_CONFIG['rascunho'];
                    return (
                      <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{f.congNome}</td>
                        <td className="px-4 py-3 text-gray-600">{monthLabel(f.mes_referencia)}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={f.review!.status}/></td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${psCfg.bg} ${psCfg.color}`}>
                            {psCfg.icon}{psCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Fingerprint size={13} className="text-gray-400"/>{sigs.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {f.review!.emitido_em ? fmtDate(f.review!.emitido_em) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            {scope.canWrite && ps === 'rascunho' && (
                              <button
                                onClick={() => emitirParecer(f)}
                                disabled={emitindo === f.review!.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#123b63] hover:bg-[#0f3055] disabled:opacity-60 text-white text-xs font-medium rounded-lg transition"
                              >
                                <Award size={12}/>{emitindo === f.review!.id ? 'Emitindo...' : 'Emitir Oficial'}
                              </button>
                            )}
                            {ps === 'aguardando_assinaturas' && scope.canWrite && (
                              <button
                                onClick={() => { setSigModal(f); setSignMsg(null); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
                              >
                                <PenLine size={12}/>Assinar
                              </button>
                            )}
                            {scope.isAdmin && ps === 'aguardando_assinaturas' && sigs.length > 0 && (
                              <button
                                onClick={() => finalizarParecer(f)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition"
                              >
                                <Lock size={12}/>Finalizar
                              </button>
                            )}
                            {scope.isAdmin && ps === 'finalizado' && (
                              <button
                                onClick={() => reabrirParecer(f)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg transition"
                              >
                                <Unlock size={12}/>Reabrir
                              </button>
                            )}
                            {f.review!.emitido_em && (
                              <button
                                onClick={() => imprimirParecerOficial(f)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition"
                              >
                                <Printer size={12}/>PDF Oficial
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* ─── Modal de análise ──────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#123b63] rounded-xl flex items-center justify-center">
                  <Scale size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Análise Fiscal</h2>
                  <p className="text-sm text-gray-500">{modal.congNome} — {monthLabel(modal.mes_referencia)}</p>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Resumo financeiro */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
                  <FileText size={13} /> Resumo Financeiro
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Saldo Inicial',  val: fmtBRL(modal.saldo_inicial),    color: '' },
                    { label: 'Entradas',       val: fmtBRL(modal.total_entradas),   color: 'text-green-700' },
                    { label: 'Saídas',         val: fmtBRL(modal.total_saidas),     color: 'text-red-600' },
                    { label: 'Saldo Final',    val: fmtBRL(modal.saldo_final),      color: 'font-bold' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className={`text-sm font-semibold ${color}`}>{val}</p>
                    </div>
                  ))}
                </div>
                {modal.fechado_em && (
                  <p className="text-xs text-gray-400 mt-2">Fechado em: {fmtDate(modal.fechado_em)}</p>
                )}
              </section>

              {/* Alertas automáticos */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Alertas de Auditoria
                </h3>
                {modalLoading ? (
                  <p className="text-sm text-gray-400">Carregando alertas...</p>
                ) : (
                  <div className="space-y-2">
                    {modalDivergencia !== null && (
                      <AlertRow type="error"
                        msg={`Divergência de saldo detectada: ${fmtBRL(modalDivergencia)} de diferença entre saldo calculado e registrado.`}
                      />
                    )}
                    {modalAlertas.semCategoria > 0 && (
                      <AlertRow type="warning"
                        msg={`${modalAlertas.semCategoria} lançamento(s) sem categoria de ${modalAlertas.totalLancs} no período.`}
                      />
                    )}
                    {modalDivergencia === null && modalAlertas.semCategoria === 0 && (
                      <AlertRow type="ok" msg="Nenhum alerta automático detectado neste fechamento." />
                    )}
                  </div>
                )}
              </section>

              {/* Lançamentos sem categoria (detalhe) */}
              {!modalLoading && modalAlertas.semCategoria > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
                    <Info size={13} /> Lançamentos sem Categoria
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Data</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Tipo</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-500">Valor</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Descrição</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {modalLancs.filter(l => !l.categoria_id).map(l => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{fmtDate(l.data_lancamento)}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${l.tipo_movimento === 'entrada' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {l.tipo_movimento === 'entrada' ? 'Entrada' : 'Saída'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{fmtBRL(Number(l.valor))}</td>
                            <td className="px-3 py-2 text-gray-500 truncate max-w-[160px]">{l.descricao || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Observações do fechamento */}
              {modal.observacoes && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
                    <ClipboardCheck size={13} /> Observações do Fechamento
                  </h3>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100">
                    {modal.observacoes}
                  </p>
                </section>
              )}

              {/* Formulário de parecer */}
              <section className="border-t border-gray-100 pt-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
                  <Scale size={13} /> {scope.canWrite ? 'Emitir Parecer' : 'Parecer Emitido'}
                </h3>

                {/* Status */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Status do Conselho Fiscal</label>
                  {scope.canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(STATUS_CONFIG) as StatusConselho[]).map(s => {
                        const cfg = STATUS_CONFIG[s];
                        const active = fStatus === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setFStatus(s)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition
                              ${active
                                ? `${cfg.bg} ${cfg.color} border-current`
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                          >
                            {cfg.icon} {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <StatusBadge status={modal.review?.status ?? modal.status_conselho_fiscal} />
                  )}
                </div>

                {/* Parecer */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Parecer <span className="text-gray-400 font-normal">(obrigatório para aprovação ou rejeição)</span>
                  </label>
                  {scope.canWrite ? (
                    <textarea
                      value={fParecer}
                      onChange={e => setFParecer(e.target.value)}
                      placeholder="Descreva a análise e conclusão do Conselho Fiscal..."
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30 resize-none"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100 min-h-[60px]">
                      {modal.review?.parecer || '—'}
                    </p>
                  )}
                </div>

                {/* Ressalvas */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Ressalvas</label>
                  {scope.canWrite ? (
                    <textarea
                      value={fRessalvas}
                      onChange={e => setFRessalvas(e.target.value)}
                      placeholder="Ressalvas identificadas (opcional)..."
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30 resize-none"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100 min-h-[40px]">
                      {modal.review?.ressalvas || '—'}
                    </p>
                  )}
                </div>

                {/* Recomendações */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Recomendações</label>
                  {scope.canWrite ? (
                    <textarea
                      value={fRecomendacoes}
                      onChange={e => setFRecomendacoes(e.target.value)}
                      placeholder="Recomendações para próximos períodos (opcional)..."
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30 resize-none"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100 min-h-[40px]">
                      {modal.review?.recomendacoes || '—'}
                    </p>
                  )}
                </div>

                {/* Metadata se review já existe */}
                {modal.review?.reviewed_at && (
                  <p className="text-xs text-gray-400 mb-4">
                    Última atualização: {fmtDateTime(modal.review.reviewed_at)}
                  </p>
                )}

                {/* Save message */}
                {saveMsg && (
                  <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${saveMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {saveMsg.text}
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-3 flex-wrap">
                  {scope.canWrite && (
                    <button
                      onClick={salvarParecer}
                      disabled={salvando}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#123b63] hover:bg-[#0f3055] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
                    >
                      <Save size={15} />
                      {salvando ? 'Salvando...' : 'Salvar Parecer'}
                    </button>
                  )}
                  <button
                    onClick={imprimirParecer}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition"
                  >
                    <Printer size={15} />
                    Imprimir
                  </button>
                  <button
                    onClick={() => setModal(null)}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm font-medium rounded-lg transition"
                  >
                    Fechar
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de assinatura ─────────────────────────────────────────────── */}
      {sigModal && sigModal.review && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#123b63] rounded-xl flex items-center justify-center">
                  <Fingerprint size={20} className="text-white"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Assinar Parecer Oficial</h2>
                  <p className="text-sm text-gray-500">{sigModal.congNome} — {monthLabel(sigModal.mes_referencia)}</p>
                </div>
              </div>
              <button onClick={() => setSigModal(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-5">
              {(signatures.get(sigModal.review.id) ?? []).length > 0 && (
                <section>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1">
                    <ShieldCheck size={12}/>Assinaturas registradas
                  </p>
                  <div className="space-y-2">
                    {(signatures.get(sigModal.review.id) ?? []).map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{s.nome}</p>
                          <p className="text-xs text-gray-500">{s.cargo}</p>
                        </div>
                        <p className="text-xs text-gray-400">{new Date(s.signed_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1">
                  <PenLine size={12}/>Nova Assinatura
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nome completo</label>
                    <input
                      type="text"
                      value={sigNome}
                      onChange={e => setSigNome(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Cargo / Função</label>
                    <input
                      type="text"
                      value={sigCargo}
                      onChange={e => setSigCargo(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                      placeholder="Ex: Secretário(a), Conselheiro(a)..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de assinatura</label>
                    <select
                      value={sigTipo}
                      onChange={e => setSigTipo(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]/30"
                    >
                      {TIPOS_ASSINATURA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
              </section>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-700">
                  Ao confirmar, seu nome, cargo, tipo, data, hora e hash criptográfico serão registrados permanentemente no sistema.
                </p>
              </div>
              {signMsg && (
                <div className={`px-4 py-2 rounded-lg text-sm ${signMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {signMsg.text}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={assinarParecer}
                  disabled={assinando}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#123b63] hover:bg-[#0f3055] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
                >
                  <Fingerprint size={15}/>{assinando ? 'Registrando...' : 'Confirmar Assinatura'}
                </button>
                <button
                  onClick={() => setSigModal(null)}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm font-medium rounded-lg transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

// ── Helpers locais ─────────────────────────────────────────────────────────────

function AlertRow({ type, msg }: { type: 'error' | 'warning' | 'ok'; msg: string }) {
  const styles = {
    error:   { cls: 'bg-red-50 border-red-200 text-red-700',    icon: <XCircle size={14} className="flex-shrink-0 mt-0.5" /> },
    warning: { cls: 'bg-yellow-50 border-yellow-200 text-yellow-700', icon: <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> },
    ok:      { cls: 'bg-green-50 border-green-200 text-green-700',  icon: <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> },
  }[type];
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${styles.cls}`}>
      {styles.icon} <span>{msg}</span>
    </div>
  );
}
