'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { useUserContext } from '@/hooks/useUserContext';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  FileText, TrendingUp, TrendingDown, DollarSign, Wallet,
  Building2, ArrowRight, AlertCircle, CheckCircle,
  ChevronUp, ChevronDown, Users, BarChart2, QrCode, Bell,
  Clock, CalendarDays, MessageSquare, Award, Activity, Shield, Star, ChevronRight,
} from 'lucide-react';

// helpers
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const extractYoutubeId = (url: string): string => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m ? m[1] : '';
};

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// types
interface CongregacaoItem {
  id: string;
  nome: string;
  membrosAtivos: number;
  membrosTotal: number;
}

interface HealthScore {
  congregacaoId: string;
  congregacaoNome: string;
  scoreFinanceiro: number;
  scoreSecretaria: number;
  scoreAuditoria: number;
  scoreEventos: number;
  scoreFinal: number;
  classificacao: 'excelente' | 'saudavel' | 'atencao' | 'critica';
}
interface DashData {
  totalMembros: number;
  membrosBatizados: number;
  membrosAtivos: number;
  totalFluxos: number;
  fluxosPendentes: number;
  cartasEmitidas: number;
  totalCongregacoes: number;
  totalDepartamentos: number;
  entradasMes: number;
  saidasMes: number;
  saldoMes: number;
  variacao: number;
  historico6m: { mes: string; entradas: number; saidas: number }[];
  porTipo: { name: string; value: number }[];
  // v2 additions
  porForma: { name: string; value: number }[];
  pixMes: number;
  ebdTurmas: number;
  ebdMediaPresenca: number | null;
  totalUsuarios: number;
  membrosVisitantes: number;
  ultimasCartas: { id: string; tipo: string; created_at: string; membro_nome: string }[];
  ultimosFluxos: { id: string; status: string; tipo_fluxo: string }[];
  cartaPedidosPendentes: { id: string; status: string; tipo_carta: string }[];
  congregacoesData: CongregacaoItem[];
  healthScores: HealthScore[];
  pendencias: { semFechamento: number; pareceresP: number; cartasP: number; eventosProx: number; pixVencidos: number };
  mensagemPresidencia: { titulo: string; conteudo_texto: string | null; video_url: string | null; video_tipo: string } | null;
  crescimentoMembros: { mes: string; total: number }[];
  nomeMinisterio: string;
}

const EMPTY: DashData = {
  totalMembros: 0, membrosBatizados: 0, membrosAtivos: 0,
  totalFluxos: 0, fluxosPendentes: 0, cartasEmitidas: 0,
  totalCongregacoes: 0, totalDepartamentos: 0,
  entradasMes: 0, saidasMes: 0, saldoMes: 0, variacao: 0,
  historico6m: [], porTipo: [], porForma: [], pixMes: 0,
  ebdTurmas: 0, ebdMediaPresenca: null,
  totalUsuarios: 0, membrosVisitantes: 0,
  ultimasCartas: [], ultimosFluxos: [], cartaPedidosPendentes: [],
  congregacoesData: [], healthScores: [],
  pendencias: { semFechamento: 0, pareceresP: 0, cartasP: 0, eventosProx: 0, pixVencidos: 0 },
  mensagemPresidencia: null,
  crescimentoMembros: [],
  nomeMinisterio: '',
};

// component
export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const userCtx = useUserContext();
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [dataAtual, setDataAtual] = useState('');
  const [usuarioLogado, setUsuarioLogado] = useState<{ nome: string; email: string; nivel: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dash, setDash] = useState<DashData>(EMPTY);
  const [loadingDash, setLoadingDash] = useState(true);

  // data/hora
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
      const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()} - ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };
    setDataAtual(fmt());
    const t = setInterval(() => setDataAtual(fmt()), 60000);
    return () => clearInterval(t);
  }, []);

  // auth + dados
  useEffect(() => {
    const run = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push('/login'); return; }

      const { data: mu } = await supabase
        .from('ministry_users')
        .select('role, permissions')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      const nivel = mu?.role ? String(mu.role) : 'viewer';

      // Redireciona roles sem dashboard geral para a sua tela inicial
      const perms: string[] = Array.isArray((mu as any)?.permissions) ? (mu as any).permissions : [];
      const isSuperOrCoord = perms.some((p: string) => ['SUPERINTENDENTE','COORDENADOR'].includes(String(p).toUpperCase()));
      if (isSuperOrCoord) { router.replace('/ebd/dashboard'); return; }
      const isFinanceiro = perms.some((p: string) => ['FINANCEIRO','FINANCEIRO_LOCAL'].includes(String(p).toUpperCase()));
      if (isFinanceiro) { router.replace('/tesouraria'); return; }
      const isOperador = perms.some((p: string) => String(p).toUpperCase() === 'OPERADOR');
      if (isOperador) { router.replace('/secretaria/membros'); return; }
      const isSupervisor = perms.some((p: string) => String(p).toUpperCase() === 'SUPERVISOR');
      if (isSupervisor) { router.replace('/secretaria/membros'); return; }
      setUsuarioLogado({
        nome: authData.user.user_metadata?.full_name || authData.user.email || 'Usuário',
        email: authData.user.email || '',
        nivel,
      });
      setAuthLoading(false);

      const ministryId = await resolveMinistryId(supabase);
      if (!ministryId) { setLoadingDash(false); return; }

      const temFinanceiro = userCtx.podeAcessar('tesouraria');

      // Escopo por nível: admin_local/financeiro_local → congregacao; supervisor → supervisao
      const scopeCongId  = userCtx.congregacaoId;  // não-null só para admin_local / financeiro_local
      const scopeSupId   = userCtx.supervisaoId;    // não-null só para supervisor

      const agora    = new Date();
      const anoAtual = agora.getFullYear();
      const mesAtual = agora.getMonth() + 1;
      const mesRef   = `${anoAtual}-${String(mesAtual).padStart(2,'0')}`;

      const dAnterior   = new Date(anoAtual, mesAtual - 2, 1);
      const mesAnterior = `${dAnterior.getFullYear()}-${String(dAnterior.getMonth() + 1).padStart(2,'0')}`;

      const ultimos6: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(anoAtual, mesAtual - 1 - i, 1);
        ultimos6.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`);
      }

      // Helper: aplica filtro de congregação ou supervisão conforme o nível
      const withScopeMember = (q: ReturnType<typeof supabase.from>) => {
        if (scopeCongId) return (q as any).eq('congregacao_id', scopeCongId);
        // supervisor: filtra membros cuja congregação pertence à supervisão dele
        // (feito via campo supervisao_id dos membros)
        if (scopeSupId)  return (q as any).eq('supervisao_id', scopeSupId);
        return q;
      };
      const withScopeLanc = (q: ReturnType<typeof supabase.from>) => {
        if (scopeCongId) return (q as any).eq('congregacao_id', scopeCongId);
        return q;
      };

      const [
        membrosRes, fluxosRes, cartasRes, congsRes, deptsRes,
        lancMesRes, lancAnteriorRes, lancHistRes,
        ebdTurmasRes, ebdChamadasRes, usuariosRes,
        visitantesRes, ultimasCartasRes, ultimosFluxosRes, cartaPedidosRes,
      ] = await Promise.all([
        withScopeMember(supabase.from('members').select('status2, batizado, gender').eq('ministry_id', ministryId)),
        supabase.from('flow_instances').select('status, tipo_fluxo, created_at').eq('ministry_id', ministryId).order('created_at', { ascending: false }).limit(10),
        supabase.from('cartas_ministeriais').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId),
        scopeCongId
          ? supabase.from('congregacoes').select('id, nome', { count: 'exact', head: true }).eq('id', scopeCongId).eq('is_active', true)
          : scopeSupId
            ? supabase.from('congregacoes').select('id, nome', { count: 'exact', head: true }).eq('supervisao_id', scopeSupId).eq('is_active', true)
            : supabase.from('congregacoes').select('id, nome', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('is_active', true),
        supabase.from('departamentos').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId),
        temFinanceiro
          ? withScopeLanc(supabase.from('tesouraria_lancamentos').select('tipo_movimento, tipo_recebimento, valor, forma_pagamento, congregacao_id').eq('ministry_id', ministryId).like('data_lancamento', `${mesRef}%`))
          : Promise.resolve({ data: [] }),
        temFinanceiro
          ? withScopeLanc(supabase.from('tesouraria_lancamentos').select('tipo_movimento, valor').eq('ministry_id', ministryId).like('data_lancamento', `${mesAnterior}%`))
          : Promise.resolve({ data: [] }),
        temFinanceiro
          ? withScopeLanc(supabase.from('tesouraria_lancamentos').select('tipo_movimento, valor, data_lancamento').eq('ministry_id', ministryId).gte('data_lancamento', `${ultimos6[0]}-01`))
          : Promise.resolve({ data: [] }),
        supabase.from('ebd_turmas').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('ativo', true),
        supabase.from('ebd_chamadas').select('presentes, total_alunos').eq('ministry_id', ministryId).gte('data_chamada', new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)).limit(100),
        supabase.from('ministry_users').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('status', 'ativo'),
        supabase.from('members').select('id').eq('ministry_id', ministryId).is('congregacao_id', null),
        supabase.from('cartas_ministeriais').select('id, tipo, created_at, membro_nome').eq('ministry_id', ministryId).order('created_at', { ascending: false }).limit(5),
        supabase.from('flow_instances').select('id, status, tipo_fluxo').eq('ministry_id', ministryId).neq('status', 'concluido').limit(5),
        supabase.from('carta_pedidos').select('id, status, tipo_carta').eq('ministry_id', ministryId).neq('status', 'rejeitado').order('created_at', { ascending: false }).limit(3),
      ]);

      // membros
      const membros          = membrosRes.data ?? [];
      const totalMembros     = membros.length;
      const membrosBatizados = membros.filter((m: any) => m.batizado === true || m.batizado === 'true' || m.batizado === 1).length;
      const membrosAtivos    = membros.filter((m: any) => (m.status2 ?? 'ativo') === 'ativo').length;

      // fluxos
      const fluxos          = fluxosRes.data ?? [];
      const totalFluxos     = fluxos.length;
      const fluxosPendentes = fluxos.filter((f: any) => f.status === 'pendente' || f.status === 'em_andamento').length;

      // últimas cartas
      const ultimasCartas = (ultimasCartasRes.data ?? []).map((c: any) => ({
        id: c.id,
        tipo: c.tipo,
        created_at: c.created_at,
        membro_nome: c.membro_nome,
      }));

      // últimos fluxos pendentes
      const ultimosFluxos = (ultimosFluxosRes.data ?? []).filter((f: any) => f.status !== 'concluido').slice(0, 3).map((f: any) => ({
        id: f.id,
        status: f.status,
        tipo_fluxo: f.tipo_fluxo,
      }));

      // cartas de pedidos pendentes
      const cartaPedidosPendentes = (cartaPedidosRes.data ?? []).slice(0, 3).map((p: any) => ({
        id: p.id,
        status: p.status,
        tipo_carta: p.tipo_carta,
      }));

      // visitantes
      const membrosVisitantes = (visitantesRes.data ?? []).length;

      // lancamentos mês
      const lancMes   = lancMesRes.data   ?? [];
      const lancAnter = lancAnteriorRes.data ?? [];

      const entradasMes = lancMes.filter((l: any) => l.tipo_movimento === 'entrada').reduce((s: number, l: any) => s + Number(l.valor), 0);
      const saidasMes   = lancMes.filter((l: any) => l.tipo_movimento === 'saida').reduce((s: number, l: any) => s + Number(l.valor), 0);
      const saldoMes    = entradasMes - saidasMes;

      const entradasAnterior = lancAnter.filter((l: any) => l.tipo_movimento === 'entrada').reduce((s: number, l: any) => s + Number(l.valor), 0);
      const variacao = entradasAnterior > 0
        ? Math.round(((entradasMes - entradasAnterior) / entradasAnterior) * 100)
        : 0;

      // por tipo
      const LABEL: Record<string, string> = {
        oferta: 'Oferta', dizimo: 'Dízimo', evento: 'Evento',
        campanha: 'Campanha', contribuicao: 'Contribuição', missoes: 'Missões', outros: 'Outros',
      };
      const tipoMap: Record<string, number> = {};
      for (const l of lancMes.filter((l: any) => l.tipo_movimento === 'entrada')) {
        const t = l.tipo_recebimento ?? 'outros';
        tipoMap[t] = (tipoMap[t] ?? 0) + Number(l.valor);
      }
      const porTipo = Object.entries(tipoMap)
        .map(([k, v]) => ({ name: LABEL[k] ?? k, value: v }))
        .sort((a, b) => b.value - a.value);

      // histórico 6 meses
      const histMap: Record<string, { entradas: number; saidas: number }> = {};
      for (const ref of ultimos6) histMap[ref] = { entradas: 0, saidas: 0 };
      for (const l of lancHistRes.data ?? []) {
        const ref = (l.data_lancamento as string).slice(0, 7);
        if (histMap[ref]) {
          if (l.tipo_movimento === 'entrada') histMap[ref].entradas += Number(l.valor);
          else histMap[ref].saidas += Number(l.valor);
        }
      }
      const historico6m = ultimos6.map(ref => ({
        mes: MESES_ABREV[parseInt(ref.split('-')[1], 10) - 1],
        entradas: histMap[ref].entradas,
        saidas: histMap[ref].saidas,
      }));

      // EBD
      const chamadas = ebdChamadasRes.data ?? [];
      const ebdMediaPresenca = chamadas.length > 0
        ? Math.round(chamadas.reduce((s: number, c: any) => s + Number(c.presentes ?? 0), 0) / chamadas.length)
        : null;

      // ── DASHBOARD 2.0 — novas queries ──────────────────────────────────────
      const todayStr         = agora.toISOString().slice(0, 10);
      const in30daysStr      = new Date(agora.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const twelveMonthsAgo  = new Date(anoAtual, mesAtual - 13, 1).toISOString().slice(0, 10);

      const [
        congListRes, allMembersRes, eventosProxRes,
        memberGrowthRes, cartasPendCountRes, pareceresRes, ministerioRes,
      ] = await Promise.all([
        supabase.from('congregacoes').select('id, nome').eq('ministry_id', ministryId).eq('is_active', true).order('nome').limit(50),
        supabase.from('members').select('congregacao_id, status2').eq('ministry_id', ministryId).limit(10000),
        supabase.from('eventos').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('status', 'programado').gte('data_inicio', todayStr).lte('data_inicio', in30daysStr),
        supabase.from('members').select('created_at').eq('ministry_id', ministryId).gte('created_at', twelveMonthsAgo).limit(5000),
        supabase.from('carta_pedidos').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('status', 'pendente'),
        supabase.from('flow_instances').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).in('status', ['pendente', 'em_analise']),
        supabase.from('ministries').select('nome').eq('id', ministryId).maybeSingle(),
      ]);

      // PIX vencidos (best-effort — campo status pode não existir)
      let pixVencidos = 0;
      try {
        const r = await (supabase as any).from('tesouraria_lancamentos')
          .select('id', { count: 'exact', head: true })
          .eq('ministry_id', ministryId)
          .eq('forma_pagamento', 'pix')
          .eq('tipo_movimento', 'entrada')
          .eq('status', 'vencido');
        pixVencidos = r.count ?? 0;
      } catch { /* silent */ }

      // Mensagem da presidência (best-effort — tabela pode não existir)
      let mensagemPresidencia: DashData['mensagemPresidencia'] = null;
      try {
        const r = await (supabase as any).from('ministerio_mensagens')
          .select('titulo, conteudo_texto, video_url, video_tipo')
          .eq('ministry_id', ministryId)
          .eq('ativo', true)
          .lte('data_inicio', todayStr)
          .gte('data_fim', todayStr)
          .order('ordem', { ascending: true })
          .limit(1)
          .maybeSingle();
        mensagemPresidencia = r.data ?? null;
      } catch { /* silent */ }

      // ── Congregações para ranking e saúde ──────────────────────────────────
      const congList   = congListRes.data ?? [];
      const allMembers = allMembersRes.data ?? [];

      const membersByCong: Record<string, { ativos: number; total: number }> = {};
      for (const m of allMembers) {
        const cid = (m as any).congregacao_id ?? '__none__';
        if (!membersByCong[cid]) membersByCong[cid] = { ativos: 0, total: 0 };
        membersByCong[cid].total++;
        const st = (m as any).status2;
        if (!st || st === 'ativo') membersByCong[cid].ativos++;
      }

      const congregacoesData: CongregacaoItem[] = congList.map((c: any) => ({
        id: c.id,
        nome: c.nome,
        membrosAtivos: membersByCong[c.id]?.ativos ?? 0,
        membrosTotal:  membersByCong[c.id]?.total  ?? 0,
      }));

      // Lançamentos por congregação (para score financeiro)
      const lancsByCongt: Record<string, { entradas: number; saidas: number; temLanc: boolean }> = {};
      for (const l of lancMes) {
        const cid = (l as any).congregacao_id ?? '__none__';
        if (!lancsByCongt[cid]) lancsByCongt[cid] = { entradas: 0, saidas: 0, temLanc: true };
        if ((l as any).tipo_movimento === 'entrada') lancsByCongt[cid].entradas += Number((l as any).valor);
        else                                          lancsByCongt[cid].saidas   += Number((l as any).valor);
      }

      // Score composto por congregação
      const eventosProxCount = eventosProxRes.count ?? 0;
      const healthScores: HealthScore[] = congList.map((c: any): HealthScore => {
        const m  = membersByCong[c.id] ?? { ativos: 0, total: 0 };
        const lf = lancsByCongt[c.id] ?? { entradas: 0, saidas: 0, temLanc: false };

        const taxa           = m.total > 0 ? m.ativos / m.total : 0;
        const scoreSecretaria = taxa >= 0.8 ? 100 : taxa >= 0.6 ? 80 : taxa >= 0.4 ? 55 : taxa >= 0.2 ? 30 : 10;

        const temLanc        = lf.temLanc || lf.entradas > 0 || lf.saidas > 0;
        const saldoPos       = lf.entradas >= lf.saidas;
        const scoreFinanceiro = Math.min(100, (temLanc ? 40 : 0) + (saldoPos && temLanc ? 35 : 0) + 25);

        const scoreAuditoria  = 70; // simplified: sem per-congregação audit data
        const scoreEventos    = eventosProxCount > 0 ? 80 : 30;

        const scoreFinal = Math.round(
          scoreFinanceiro * 0.4 + scoreSecretaria * 0.3 + scoreAuditoria * 0.2 + scoreEventos * 0.1,
        );
        const classificacao: HealthScore['classificacao'] =
          scoreFinal >= 90 ? 'excelente' : scoreFinal >= 80 ? 'saudavel' : scoreFinal >= 60 ? 'atencao' : 'critica';

        return { congregacaoId: c.id, congregacaoNome: c.nome, scoreFinanceiro, scoreSecretaria, scoreAuditoria, scoreEventos, scoreFinal, classificacao };
      });

      // ── PIX e por forma de pagamento ───────────────────────────────────────
      const pixMes = lancMes
        .filter((l: any) => (l as any).forma_pagamento === 'pix' && l.tipo_movimento === 'entrada')
        .reduce((s: number, l: any) => s + Number(l.valor), 0);

      const FORMA_LABEL: Record<string, string> = {
        pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão',
        transferencia: 'Transferência', cheque: 'Cheque',
      };
      const formaMap: Record<string, number> = {};
      for (const l of lancMes.filter((l: any) => l.tipo_movimento === 'entrada')) {
        const f = (l as any).forma_pagamento ?? 'dinheiro';
        formaMap[f] = (formaMap[f] ?? 0) + Number(l.valor);
      }
      const porForma = Object.entries(formaMap)
        .map(([k, v]) => ({ name: FORMA_LABEL[k] ?? k, value: v }))
        .sort((a, b) => b.value - a.value);

      // ── Crescimento de membros (12 meses) ──────────────────────────────────
      const ultimos12: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(anoAtual, mesAtual - 1 - i, 1);
        ultimos12.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      const monthlyNew: Record<string, number> = {};
      for (const m of memberGrowthRes.data ?? []) {
        const ref = (m as any).created_at.slice(0, 7);
        monthlyNew[ref] = (monthlyNew[ref] ?? 0) + 1;
      }
      let runningTotal = Math.max(0, membros.length - (memberGrowthRes.data?.length ?? 0));
      const crescimentoMembros = ultimos12.map(ref => {
        runningTotal += monthlyNew[ref] ?? 0;
        return { mes: MESES_ABREV[parseInt(ref.split('-')[1], 10) - 1], total: runningTotal };
      });

      // ── Pendências ─────────────────────────────────────────────────────────
      const congIdsComLanc = new Set(Object.keys(lancsByCongt).filter(k => k !== '__none__'));
      const semFechamento = Math.max(0, (congsRes.count ?? 0) - congIdsComLanc.size);
      const pendencias = {
        semFechamento,
        pareceresP: pareceresRes.count ?? 0,
        cartasP: cartasPendCountRes.count ?? 0,
        eventosProx: eventosProxCount,
        pixVencidos,
      };

      setDash({
        totalMembros, membrosBatizados, membrosAtivos,
        totalFluxos, fluxosPendentes,
        cartasEmitidas: cartasRes.count ?? 0,
        totalCongregacoes: congsRes.count ?? 0,
        totalDepartamentos: deptsRes.count ?? 0,
        entradasMes, saidasMes, saldoMes, variacao,
        historico6m, porTipo,
        porForma, pixMes,
        ebdTurmas: ebdTurmasRes.count ?? 0,
        ebdMediaPresenca,
        totalUsuarios: usuariosRes.count ?? 0,
        membrosVisitantes,
        ultimasCartas,
        ultimosFluxos,
        cartaPedidosPendentes,
        congregacoesData,
        healthScores,
        pendencias,
        mensagemPresidencia,
        crescimentoMembros,
        nomeMinisterio: (ministerioRes.data as any)?.nome ?? '',
      });
      setLoadingDash(false);
    };

    run();
  }, [router, supabase]);

  const handleLogout = () => supabase.auth.signOut().finally(() => router.push('/'));

  if (authLoading || userCtx.loading) return (
    <div className="flex h-screen items-center justify-center bg-[#0F172A] text-white font-semibold">
      Carregando...
    </div>
  );

  const temFinanceiro = userCtx.podeAcessar('tesouraria');
  const nivel = usuarioLogado?.nivel ?? 'viewer';
  const isPresidencia = nivel === 'presidencia';
  const isAdmin = nivel === 'administrador';

  const healthClass = (s: number) =>
    s >= 90 ? { label: 'Excelente', color: '#2563EB', bg: 'bg-blue-900/40', text: 'text-blue-300' }
    : s >= 80 ? { label: 'Saudável', color: '#16A34A', bg: 'bg-green-900/40', text: 'text-green-400' }
    : s >= 60 ? { label: 'Atenção', color: '#D97706', bg: 'bg-amber-900/40', text: 'text-amber-400' }
    : { label: 'Crítica', color: '#DC2626', bg: 'bg-red-900/40', text: 'text-red-400' };

  const NIVEL_LABEL: Record<string, string> = {
    administrador: 'Administrador', financeiro: 'Financeiro',
    admin_local: 'Admin Local', financeiro_local: 'Fin. Local',
    supervisor: 'Supervisor', viewer: 'Visualizador',
    presidencia: 'Presidência', conselho_fiscal: 'Conselho Fiscal',
  };

  const QUICK_ACTIONS = [
    { label: 'Cadastrar Membro', icon: '👤', href: '/secretaria/membros',     modulo: 'secretaria' },
    { label: 'Lançar Entrada',   icon: '💰', href: '/tesouraria',             modulo: 'tesouraria' },
    { label: 'Lançar Saída',     icon: '💸', href: '/tesouraria',             modulo: 'tesouraria' },
    { label: 'Emitir Carta',     icon: '📄', href: '/secretaria/cartas',      modulo: 'secretaria' },
    { label: 'Chamada EBD',      icon: '📚', href: '/secretaria/ebd/chamada', modulo: 'ebd'        },
    { label: 'Novo Usuário',     icon: '🔑', href: '/usuarios',               modulo: 'usuarios'   },
    { label: 'Configurações',    icon: '⚙️',  href: '/configuracoes',          modulo: 'configuracoes' },
  ].filter(a => userCtx.podeAcessar(a.modulo));

  const excelentes = dash.healthScores.filter(h => h.classificacao === 'excelente');
  const saudaveis  = dash.healthScores.filter(h => h.classificacao === 'saudavel');
  const atencao    = dash.healthScores.filter(h => h.classificacao === 'atencao');
  const criticas   = dash.healthScores.filter(h => h.classificacao === 'critica');

  const rankingMembros     = [...dash.congregacoesData].sort((a, b) => b.membrosAtivos - a.membrosAtivos).slice(0, 8);
  const rankingHealthSorted = [...dash.healthScores].sort((a, b) => b.scoreFinal - a.scoreFinal).slice(0, 8);
  const maxMembros         = rankingMembros[0]?.membrosAtivos ?? 1;

  // ── Ranking por Membros Ativos ────────────────────────────────────────
  const RankingMembros = () => (
    <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award size={16} className="text-[#2563EB]" />
        <h3 className="text-sm font-bold text-white">Ranking — Membros Ativos</h3>
      </div>
      {loadingDash ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />)}</div>
      ) : rankingMembros.length === 0 ? (
        <div className="py-8 text-center text-white/20 text-xs">Sem dados de congregações</div>
      ) : (
        <div className="space-y-3">
          {rankingMembros.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="w-5 text-xs font-bold text-white/30 text-center shrink-0">#{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white/80 truncate">{c.nome}</span>
                  <span className="text-xs font-bold text-[#2563EB] ml-2 shrink-0">{c.membrosAtivos}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-[#2563EB] transition-all"
                    style={{ width: `${maxMembros > 0 ? (c.membrosAtivos / maxMembros) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Ranking por Saúde Ministerial ─────────────────────────────────────
  const RankingSaude = () => (
    <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-[#D4A017]" />
        <h3 className="text-sm font-bold text-white">Ranking — Saúde Ministerial</h3>
      </div>
      {loadingDash ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />)}</div>
      ) : rankingHealthSorted.length === 0 ? (
        <div className="py-8 text-center text-white/20 text-xs">Sem dados de congregações</div>
      ) : (
        <div className="space-y-3">
          {rankingHealthSorted.map((h, idx) => {
            const cls = healthClass(h.scoreFinal);
            return (
              <div key={h.congregacaoId} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-white/30 text-center shrink-0">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white/80 truncate">{h.congregacaoNome}</span>
                    <span className={`text-xs font-bold ml-2 shrink-0 ${cls.text}`}>{h.scoreFinal}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${h.scoreFinal}%`, backgroundColor: cls.color }} />
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cls.bg} ${cls.text}`}>{cls.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0F172A]">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 overflow-auto">

        {/* ── CABEÇALHO EXECUTIVO INSTITUCIONAL ───────────────────────── */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#1E3A5F] via-[#1a4577] to-[#2563EB] px-6 py-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">
                  {dash.nomeMinisterio || 'Painel Executivo'}
                </h1>
                <p className="text-xs text-blue-200 mt-0.5">{dataAtual}</p>
              </div>
            </div>
            {usuarioLogado && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-white leading-none">{usuarioLogado.nome}</p>
                  <p className="text-xs text-blue-200 mt-0.5">{usuarioLogado.email}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-white border border-white/30">
                  {NIVEL_LABEL[nivel] ?? nivel}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── ATALHOS RÁPIDOS ──────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.href + a.label}
                onClick={() => router.push(a.href)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E293B] border border-white/10 hover:border-[#2563EB]/60 hover:bg-[#253047] transition shrink-0 text-white/70 hover:text-white text-sm font-medium"
              >
                <span>{a.icon}</span>
                <span className="whitespace-nowrap">{a.label}</span>
              </button>
            ))}
          </div>

          {/* ── MENSAGEM DA PRESIDÊNCIA ───────────────────────────────────── */}
          {dash.mensagemPresidencia && (isAdmin || isPresidencia) && (
            <div className="bg-[#1E293B] border border-[#D4A017]/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} className="text-[#D4A017]" />
                <span className="text-sm font-bold text-[#D4A017]">Mensagem da Presidência</span>
              </div>
              {dash.mensagemPresidencia.video_tipo === 'youtube' && dash.mensagemPresidencia.video_url ? (
                <div className="aspect-video w-full max-w-2xl rounded-xl overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYoutubeId(dash.mensagemPresidencia.video_url)}`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={dash.mensagemPresidencia.titulo}
                  />
                </div>
              ) : dash.mensagemPresidencia.video_tipo === 'upload' && dash.mensagemPresidencia.video_url ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={dash.mensagemPresidencia.video_url} controls className="w-full max-w-2xl rounded-xl" />
              ) : (
                <div>
                  <h3 className="text-white font-semibold mb-1">{dash.mensagemPresidencia.titulo}</h3>
                  {dash.mensagemPresidencia.conteudo_texto && (
                    <p className="text-white/70 text-sm leading-relaxed">{dash.mensagemPresidencia.conteudo_texto}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── KPIs ROW 1 (4 cards) ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Congregações */}
            <div
              className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 hover:border-[#0D9488]/50 transition cursor-pointer"
              onClick={() => router.push('/secretaria/congregacoes')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Congregações</span>
                <div className="w-9 h-9 rounded-xl bg-[#0D9488]/20 flex items-center justify-center">
                  <Building2 size={18} className="text-[#0D9488]" />
                </div>
              </div>
              {loadingDash ? <div className="h-8 w-20 bg-white/10 rounded animate-pulse" /> : (
                <>
                  <p className="text-3xl font-bold text-white">{dash.totalCongregacoes}</p>
                  <p className="text-xs text-[#0D9488] mt-1 font-medium">{dash.totalDepartamentos} departamentos</p>
                </>
              )}
            </div>

            {/* Membros Ativos */}
            <div
              className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 hover:border-[#2563EB]/50 transition cursor-pointer"
              onClick={() => router.push('/secretaria/membros')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Membros Ativos</span>
                <div className="w-9 h-9 rounded-xl bg-[#2563EB]/20 flex items-center justify-center">
                  <Users size={18} className="text-[#2563EB]" />
                </div>
              </div>
              {loadingDash ? <div className="h-8 w-20 bg-white/10 rounded animate-pulse" /> : (
                <>
                  <p className="text-3xl font-bold text-white">{dash.membrosAtivos}</p>
                  <p className="text-xs text-[#2563EB] mt-1 font-medium">
                    {dash.totalMembros > 0 ? Math.round((dash.membrosAtivos / dash.totalMembros) * 100) : 0}% do total
                  </p>
                </>
              )}
            </div>

            {/* Receita ou Crescimento (sem financeiro) */}
            {temFinanceiro ? (
              <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 hover:border-green-500/50 transition">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Receita Mês</span>
                  <div className="w-9 h-9 rounded-xl bg-green-900/40 flex items-center justify-center">
                    <TrendingUp size={18} className="text-green-400" />
                  </div>
                </div>
                {loadingDash ? <div className="h-8 w-24 bg-white/10 rounded animate-pulse" /> : (
                  <>
                    <p className="text-2xl font-bold text-green-400">{fmtBRL(dash.entradasMes)}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {dash.variacao >= 0
                        ? <ChevronUp size={12} className="text-green-400" />
                        : <ChevronDown size={12} className="text-red-400" />}
                      <span className={`text-xs font-medium ${dash.variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {dash.variacao >= 0 ? '+' : ''}{dash.variacao}% vs mês ant.
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 hover:border-[#D4A017]/50 transition cursor-pointer" onClick={() => router.push('/secretaria/membros')}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Crescimento</span>
                  <div className="w-9 h-9 rounded-xl bg-[#D4A017]/20 flex items-center justify-center">
                    <BarChart2 size={18} className="text-[#D4A017]" />
                  </div>
                </div>
                {loadingDash ? <div className="h-8 w-20 bg-white/10 rounded animate-pulse" /> : (
                  <>
                    <p className="text-3xl font-bold text-[#D4A017]">
                      {dash.crescimentoMembros.length > 1
                        ? (() => {
                            const last = dash.crescimentoMembros[dash.crescimentoMembros.length - 1]?.total ?? 0;
                            const prev = dash.crescimentoMembros[dash.crescimentoMembros.length - 2]?.total ?? last;
                            const pct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
                            return `${pct > 0 ? '+' : ''}${pct}%`;
                          })()
                        : '—'}
                    </p>
                    <p className="text-xs text-white/40 mt-1">vs mês anterior</p>
                  </>
                )}
              </div>
            )}

            {/* Despesa ou Batizados (sem financeiro) */}
            {temFinanceiro ? (
              <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 hover:border-red-500/50 transition">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Despesa Mês</span>
                  <div className="w-9 h-9 rounded-xl bg-red-900/40 flex items-center justify-center">
                    <TrendingDown size={18} className="text-red-400" />
                  </div>
                </div>
                {loadingDash ? <div className="h-8 w-24 bg-white/10 rounded animate-pulse" /> : (
                  <>
                    <p className="text-2xl font-bold text-red-400">{fmtBRL(dash.saidasMes)}</p>
                    <p className="text-xs text-white/40 mt-1">Despesas registradas</p>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 hover:border-purple-500/50 transition">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Batizados</span>
                  <div className="w-9 h-9 rounded-xl bg-purple-900/40 flex items-center justify-center">
                    <Star size={18} className="text-purple-400" />
                  </div>
                </div>
                {loadingDash ? <div className="h-8 w-20 bg-white/10 rounded animate-pulse" /> : (
                  <>
                    <p className="text-3xl font-bold text-white">{dash.membrosBatizados}</p>
                    <p className="text-xs text-purple-400 mt-1 font-medium">
                      {dash.totalMembros > 0 ? Math.round((dash.membrosBatizados / dash.totalMembros) * 100) : 0}% do total
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── KPIs ROW 2 (3 cards — somente financeiro) ───────────────── */}
          {temFinanceiro && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Saldo */}
              <div className={`rounded-2xl p-5 border ${dash.saldoMes >= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Saldo Mês</span>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dash.saldoMes >= 0 ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                    <Wallet size={18} className={dash.saldoMes >= 0 ? 'text-green-400' : 'text-red-400'} />
                  </div>
                </div>
                {loadingDash ? <div className="h-8 w-24 bg-white/10 rounded animate-pulse" /> : (
                  <>
                    <p className={`text-2xl font-bold ${dash.saldoMes >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtBRL(dash.saldoMes)}</p>
                    <span className={`text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded-full ${dash.saldoMes >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      {dash.saldoMes >= 0 ? '● Superávit' : '● Déficit'}
                    </span>
                  </>
                )}
              </div>

              {/* Crescimento de receita */}
              <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 hover:border-[#D4A017]/50 transition">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Crescimento</span>
                  <div className="w-9 h-9 rounded-xl bg-[#D4A017]/20 flex items-center justify-center">
                    <BarChart2 size={18} className="text-[#D4A017]" />
                  </div>
                </div>
                {loadingDash ? <div className="h-8 w-20 bg-white/10 rounded animate-pulse" /> : (
                  <>
                    <p className={`text-3xl font-bold ${dash.variacao >= 0 ? 'text-[#D4A017]' : 'text-red-400'}`}>
                      {dash.variacao >= 0 ? '+' : ''}{dash.variacao}%
                    </p>
                    <p className="text-xs text-white/40 mt-1">vs mês anterior</p>
                  </>
                )}
              </div>

              {/* Arrecadação PIX */}
              <div
                className="bg-[#1E293B] border border-white/10 rounded-2xl p-5 hover:border-[#0D9488]/50 transition cursor-pointer"
                onClick={() => router.push('/tesouraria')}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Arrecadação PIX</span>
                  <div className="w-9 h-9 rounded-xl bg-[#0D9488]/20 flex items-center justify-center">
                    <QrCode size={18} className="text-[#0D9488]" />
                  </div>
                </div>
                {loadingDash ? <div className="h-8 w-24 bg-white/10 rounded animate-pulse" /> : (
                  <>
                    <p className="text-2xl font-bold text-[#0D9488]">{fmtBRL(dash.pixMes)}</p>
                    <p className="text-xs text-white/40 mt-1">
                      {dash.entradasMes > 0 ? `${Math.round((dash.pixMes / dash.entradasMes) * 100)}% do total` : 'Mês atual'}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── CENTRAL DE PENDÊNCIAS ────────────────────────────────────── */}
          <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">Central de Pendências</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {([
                { label: 'Sem Fechamento', value: dash.pendencias.semFechamento, Icon: Building2,    href: '/tesouraria',                          isAlert: true  },
                { label: 'Pareceres',      value: dash.pendencias.pareceresP,    Icon: FileText,     href: '/presidencia/prestacao-contas-oficial', isAlert: true  },
                { label: 'Cartas',         value: dash.pendencias.cartasP,       Icon: FileText,     href: '/secretaria/cartas/pedidos',            isAlert: true  },
                { label: 'Eventos Próx.',  value: dash.pendencias.eventosProx,   Icon: CalendarDays, href: '/eventos',                             isAlert: false },
                { label: 'PIX Vencidos',   value: dash.pendencias.pixVencidos,   Icon: QrCode,       href: '/tesouraria',                          isAlert: true  },
              ] as const).map(({ label, value, Icon, href, isAlert }) => {
                const hasAlert = isAlert && value > 0;
                const hasInfo  = !isAlert && value > 0;
                return (
                  <button
                    key={label}
                    onClick={() => router.push(href)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition hover:scale-[1.02] ${
                      hasAlert ? 'bg-red-900/20 border-red-500/30 hover:border-red-500/60'
                      : hasInfo ? 'bg-[#2563EB]/10 border-[#2563EB]/30 hover:border-[#2563EB]/60'
                      : 'bg-[#253047] border-white/5 hover:border-white/20'
                    }`}
                  >
                    <Icon size={20} className={hasAlert ? 'text-red-400' : hasInfo ? 'text-[#2563EB]' : 'text-white/30'} />
                    <span className={`text-xs font-medium ${hasAlert ? 'text-red-300' : hasInfo ? 'text-blue-300' : 'text-white/50'}`}>{label}</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                      hasAlert ? 'bg-red-900/60 text-red-400'
                      : hasInfo ? 'bg-[#2563EB]/20 text-blue-300'
                      : 'bg-green-900/30 text-green-400'
                    }`}>
                      {loadingDash ? '…' : !isAlert && value === 0 ? '✓ 0' : value}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── SAÚDE MINISTERIAL + ATIVIDADES RECENTES ──────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Saúde Ministerial */}
            <div className="lg:col-span-2 bg-[#1E293B] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-[#0D9488]" />
                <h3 className="text-sm font-bold text-white">Saúde Ministerial</h3>
                {!loadingDash && dash.healthScores.length > 0 && (
                  <span className="ml-auto text-xs text-white/40">
                    Média: {Math.round(dash.healthScores.reduce((s, h) => s + h.scoreFinal, 0) / dash.healthScores.length)}/100
                  </span>
                )}
              </div>
              {loadingDash ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}</div>
              ) : dash.healthScores.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-white/20 gap-2">
                  <Activity size={24} />
                  <span className="text-xs">Sem dados de congregações</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: 'Excelente', list: excelentes, dot: 'bg-blue-400',  text: 'text-blue-300'  },
                      { label: 'Saudável',  list: saudaveis,  dot: 'bg-green-400', text: 'text-green-400' },
                      { label: 'Atenção',   list: atencao,    dot: 'bg-amber-400', text: 'text-amber-400' },
                      { label: 'Crítica',   list: criticas,   dot: 'bg-red-400',   text: 'text-red-400'   },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                        <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                        <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
                        <span className="ml-auto text-xs font-bold text-white">{s.list.length}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {[...dash.healthScores].sort((a, b) => b.scoreFinal - a.scoreFinal).slice(0, 8).map(h => {
                      const cls = healthClass(h.scoreFinal);
                      return (
                        <div key={h.congregacaoId} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white/80 truncate">{h.congregacaoNome}</p>
                          </div>
                          <div className="w-14 bg-white/10 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all"
                              style={{ width: `${h.scoreFinal}%`, backgroundColor: cls.color }} />
                          </div>
                          <span className={`text-xs font-bold w-7 text-right ${cls.text}`}>{h.scoreFinal}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => router.push('/secretaria/congregacoes')}
                    className="mt-3 w-full text-xs text-[#0D9488] font-semibold hover:underline flex items-center justify-center gap-1"
                  >
                    Ver congregações <ChevronRight size={12} />
                  </button>
                </>
              )}
            </div>

            {/* Atividades Recentes */}
            <div className="lg:col-span-3 bg-[#1E293B] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-white/40" />
                <h3 className="text-sm font-bold text-white">Atividades Recentes</h3>
              </div>
              <div className="flex gap-2 mb-3 flex-wrap">
                {[
                  { label: 'Cartas',  count: dash.ultimasCartas.length,          href: '/secretaria/cartas' },
                  { label: 'Fluxos',  count: dash.ultimosFluxos.length,          href: '/secretaria/fluxos' },
                  { label: 'Pedidos', count: dash.cartaPedidosPendentes.length,  href: '/secretaria/cartas/pedidos' },
                ].map(tab => (
                  <button
                    key={tab.label}
                    onClick={() => router.push(tab.href)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 text-white/60 hover:bg-white/15 hover:text-white transition"
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="ml-1.5 bg-[#2563EB] text-white text-[10px] px-1.5 py-0.5 rounded-full">{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>
              {loadingDash ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}</div>
              ) : (
                <div className="space-y-2">
                  {dash.ultimasCartas.slice(0, 2).map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition"
                      onClick={() => router.push('/secretaria/cartas')}>
                      <FileText size={14} className="text-[#2563EB] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 truncate">{c.membro_nome}</p>
                        <p className="text-xs text-white/40 capitalize">{c.tipo}</p>
                      </div>
                      <span className="text-xs text-white/30 shrink-0">
                        {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  ))}
                  {dash.ultimosFluxos.slice(0, 2).map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition"
                      onClick={() => router.push('/secretaria/fluxos')}>
                      <AlertCircle size={14} className={f.status === 'pendente' ? 'text-amber-400 shrink-0' : 'text-blue-400 shrink-0'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 truncate capitalize">{f.tipo_fluxo}</p>
                        <p className="text-xs text-white/40">{f.status}</p>
                      </div>
                    </div>
                  ))}
                  {dash.cartaPedidosPendentes.slice(0, 2).map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition"
                      onClick={() => router.push('/secretaria/cartas/pedidos')}>
                      <FileText size={14} className="text-[#0D9488] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 truncate capitalize">{p.tipo_carta}</p>
                        <p className="text-xs text-white/40">Pedido {p.status}</p>
                      </div>
                    </div>
                  ))}
                  {dash.ultimasCartas.length === 0 && dash.ultimosFluxos.length === 0 && dash.cartaPedidosPendentes.length === 0 && (
                    <div className="py-8 flex flex-col items-center justify-center text-white/20 gap-2">
                      <CheckCircle size={24} />
                      <span className="text-xs">Sem atividades recentes</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── GRÁFICOS FINANCEIROS ──────────────────────────────────────── */}
          {temFinanceiro && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* AreaChart — Receitas × Despesas */}
              <div className="lg:col-span-2 bg-[#1E293B] border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Receitas × Despesas</h3>
                    <p className="text-xs text-white/40 mt-0.5">Últimos 6 meses</p>
                  </div>
                  <button
                    onClick={() => router.push('/tesouraria')}
                    className="flex items-center gap-1 text-xs text-[#2563EB] font-semibold hover:underline"
                  >
                    Detalhes <ArrowRight size={12} />
                  </button>
                </div>
                {loadingDash ? (
                  <div className="h-48 flex items-center justify-center text-white/20 text-sm">Carregando...</div>
                ) : dash.historico6m.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-white/20 gap-2">
                    <DollarSign size={32} />
                    <span className="text-sm">Sem lançamentos</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={dash.historico6m} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gEnt2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gSai2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#ffffff50' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#ffffff40' }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v: number | undefined, name: string | undefined) => [fmtBRL(v ?? 0), name === 'entradas' ? 'Entradas' : 'Saídas']}
                        contentStyle={{ fontSize: 12, borderRadius: 8, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      />
                      <Legend iconType="circle" iconSize={8}
                        formatter={(v) => (v === 'entradas' ? 'Entradas' : 'Saídas')}
                        wrapperStyle={{ fontSize: 11, color: '#ffffff80' }}
                      />
                      <Area type="monotone" dataKey="entradas" stroke="#22c55e" strokeWidth={2} fill="url(#gEnt2)" />
                      <Area type="monotone" dataKey="saidas"   stroke="#ef4444" strokeWidth={2} fill="url(#gSai2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Donut — Arrecadação por forma de pagamento */}
              <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-white">Arrecadação Digital</h3>
                  <p className="text-xs text-white/40 mt-0.5">Por forma de pagamento</p>
                </div>
                {loadingDash ? (
                  <div className="h-48 flex items-center justify-center text-white/20 text-sm">Carregando...</div>
                ) : dash.porForma.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-white/20 gap-2">
                    <QrCode size={28} />
                    <span className="text-sm">Sem lançamentos no mês</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={dash.porForma} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3}>
                        {dash.porForma.map((_, i) => (
                          <Cell key={i} fill={['#0D9488','#2563EB','#D4A017','#16A34A','#DC2626'][i % 5]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number | undefined) => fmtBRL(v ?? 0)}
                        contentStyle={{ fontSize: 12, borderRadius: 8, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#ffffff80' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* ── RANKINGS ─────────────────────────────────────────────────── */}
          {(dash.congregacoesData.length > 0 || loadingDash) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {isPresidencia || isAdmin ? (
                <>
                  <RankingSaude />
                  <RankingMembros />
                </>
              ) : (
                <>
                  <RankingMembros />
                  <RankingSaude />
                </>
              )}
            </div>
          )}

          {/* ── CRESCIMENTO DE MEMBROS (12 meses) ───────────────────────── */}
          {dash.crescimentoMembros.length > 2 && (
            <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Crescimento de Membros</h3>
                  <p className="text-xs text-white/40 mt-0.5">Últimos 12 meses</p>
                </div>
                <button
                  onClick={() => router.push('/secretaria/membros')}
                  className="flex items-center gap-1 text-xs text-[#2563EB] font-semibold hover:underline"
                >
                  Ver membros <ArrowRight size={12} />
                </button>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dash.crescimentoMembros} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#ffffff50' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#ffffff40' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2.5}
                    dot={{ fill: '#2563EB', r: 3 }} activeDot={{ r: 5 }} name="Membros" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
