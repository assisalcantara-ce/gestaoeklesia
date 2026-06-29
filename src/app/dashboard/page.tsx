'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useUserContext } from '@/hooks/useUserContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet,
  Building2, Users, Award, CalendarDays,
} from 'lucide-react';

// helpers
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

async function safeQuery(promise: Promise<any>, fallback: any = { data: [], count: 0 }): Promise<any> {
  try {
    const res = await promise;
    if ((res as any)?.error) {
      console.error('Erro de consulta:', (res as any).error);
      return fallback;
    }
    return res;
  } catch (err) {
    console.error('Erro de requisição:', err);
    return fallback;
  }
}

function obterIniciais(nome: string): string {
  if (!nome) return '';
  return nome
    .split(/\s+/)
    .filter(word => word.length > 0 && !['de', 'da', 'do', 'dos', 'das', 'e', 'em'].includes(word.toLowerCase()))
    .map(word => word[0].toUpperCase())
    .join('');
}

// component
export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const userCtx = useUserContext();
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
    if (userCtx.loading) return; // Aguarda o carregamento completo do contexto de usuário/permissões
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

      const ministryId = userCtx.ministryId;
      if (!ministryId) { setLoadingDash(false); return; }

      const temFinanceiro = userCtx.podeAcessar('tesouraria');

      // Escopo por nível: aplicar congregação apenas para admin_local/financeiro_local; supervisão para supervisor
      const isLocal = userCtx.nivel === 'admin_local' || userCtx.nivel === 'financeiro_local';
      const isSup = userCtx.nivel === 'supervisor';
      const scopeCongId  = isLocal ? userCtx.congregacaoId : null;
      const scopeSupId   = isSup ? userCtx.supervisaoId : null;

      const agora    = new Date();
      const anoAtual = agora.getFullYear();
      const mesAtual = agora.getMonth() + 1;
      const mesRef   = `${anoAtual}-${String(mesAtual).padStart(2,'0')}`;
      const ultimoDiaMes = new Date(anoAtual, mesAtual, 0).getDate();
      const dataFimRef   = `${mesRef}-${String(ultimoDiaMes).padStart(2,'0')}`;

      const dAnterior   = new Date(anoAtual, mesAtual - 2, 1);
      const mesAnterior = `${dAnterior.getFullYear()}-${String(dAnterior.getMonth() + 1).padStart(2,'0')}`;
      const ultimoDiaAnterior = new Date(dAnterior.getFullYear(), dAnterior.getMonth() + 1, 0).getDate();
      const dataFimAnterior   = `${mesAnterior}-${String(ultimoDiaAnterior).padStart(2,'0')}`;

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
        safeQuery(withScopeMember(supabase.from('members').select('status, role, tipo_cadastro, custom_fields').eq('ministry_id', ministryId))),
        safeQuery(supabase.from('flow_instances').select('status, tipo_fluxo, created_at').eq('ministry_id', ministryId).order('created_at', { ascending: false }).limit(10)),
        safeQuery(supabase.from('cartas_ministeriais').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId)),
        safeQuery(
          scopeCongId
            ? supabase.from('congregacoes').select('id, nome', { count: 'exact', head: true }).eq('id', scopeCongId).eq('is_active', true)
            : scopeSupId
              ? supabase.from('congregacoes').select('id, nome', { count: 'exact', head: true }).eq('supervisao_id', scopeSupId).eq('is_active', true)
              : supabase.from('congregacoes').select('id, nome', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('is_active', true)
        ),
        safeQuery(supabase.from('departamentos').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId)),
        safeQuery(
          temFinanceiro
            ? withScopeLanc(supabase.from('tesouraria_lancamentos').select('tipo_movimento, tipo_recebimento, valor, forma_pagamento, congregacao_id').eq('ministry_id', ministryId).gte('data_lancamento', `${mesRef}-01`).lte('data_lancamento', dataFimRef))
            : Promise.resolve({ data: [] })
        ),
        safeQuery(
          temFinanceiro
            ? withScopeLanc(supabase.from('tesouraria_lancamentos').select('tipo_movimento, valor').eq('ministry_id', ministryId).gte('data_lancamento', `${mesAnterior}-01`).lte('data_lancamento', dataFimAnterior))
            : Promise.resolve({ data: [] })
        ),
        safeQuery(
          temFinanceiro
            ? withScopeLanc(supabase.from('tesouraria_lancamentos').select('tipo_movimento, valor, data_lancamento').eq('ministry_id', ministryId).gte('data_lancamento', `${ultimos6[0]}-01`))
            : Promise.resolve({ data: [] })
        ),
        safeQuery(supabase.from('ebd_turmas').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('ativo', true)),
        safeQuery(supabase.from('ebd_chamadas').select('presentes, total_alunos').eq('ministry_id', ministryId).gte('data_chamada', new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)).limit(100)),
        safeQuery(supabase.from('ministry_users').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('status', 'ativo')),
        safeQuery(supabase.from('members').select('id').eq('ministry_id', ministryId).eq('role', 'visitante')),
        safeQuery(supabase.from('cartas_ministeriais').select('id, tipo, created_at, membro_nome').eq('ministry_id', ministryId).order('created_at', { ascending: false }).limit(5)),
        safeQuery(supabase.from('flow_instances').select('id, status, tipo_fluxo').eq('ministry_id', ministryId).neq('status', 'concluido').limit(5)),
        safeQuery(supabase.from('carta_pedidos').select('id, status, tipo_carta').eq('ministry_id', ministryId).neq('status', 'rejeitado').order('created_at', { ascending: false }).limit(3)),
      ]);

      // membros
      const todosOsMembros   = membrosRes.data ?? [];
      const membros          = todosOsMembros.filter((m: any) => {
        const cf = m.custom_fields && typeof m.custom_fields === 'object' ? m.custom_fields : {};
        const role = String(m.role || m.tipo_cadastro || cf.tipoCadastro || '').toLowerCase();
        return role !== 'visitante';
      });
      const totalMembros     = membros.length;
      const membrosBatizados = membros.filter((m: any) => {
        const cf = m.custom_fields && typeof m.custom_fields === 'object' ? m.custom_fields : {};
        const bat = m.batizado ?? cf.batizado ?? cf.batizadoAguas ?? cf.dataBatismoAguas;
        return bat === true || bat === 'true' || bat === 1 || (typeof bat === 'string' && bat.trim() !== '');
      }).length;
      const membrosAtivos    = membros.filter((m: any) => (m.status ?? 'active') === 'active').length;

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
        safeQuery(supabase.from('congregacoes').select('id, nome').eq('ministry_id', ministryId).eq('is_active', true).order('nome').limit(50)),
        safeQuery(supabase.from('members').select('congregacao_id, status').eq('ministry_id', ministryId).limit(10000)),
        safeQuery(supabase.from('eventos').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('status', 'programado').gte('data_inicio', todayStr).lte('data_inicio', in30daysStr)),
        safeQuery(supabase.from('members').select('created_at').eq('ministry_id', ministryId).gte('created_at', twelveMonthsAgo).limit(5000)),
        safeQuery(supabase.from('carta_pedidos').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('status', 'pendente')),
        safeQuery(supabase.from('flow_instances').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).in('status', ['pendente', 'em_analise'])),
        safeQuery(supabase.from('ministries').select('name').eq('id', ministryId).maybeSingle(), { data: { name: '' } }),
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
        const st = (m as any).status;
        if (!st || st === 'active') membersByCong[cid].ativos++;
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
        nomeMinisterio: (ministerioRes.data as any)?.name ?? '',
      });
      setLoadingDash(false);
    };

    run();
  }, [router, supabase, userCtx.loading, userCtx]);

  const handleLogout = () => supabase.auth.signOut().finally(() => router.push('/'));


  if (authLoading || userCtx.loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f4f6f9] text-[#1E3A5F] font-semibold">
      Carregando...
    </div>
  );

  const temFinanceiro = userCtx.podeAcessar('tesouraria');
  const nivel = usuarioLogado?.nivel ?? 'viewer';

  const NIVEL_LABEL: Record<string, string> = {
    administrador: 'Administrador', financeiro: 'Financeiro',
    admin_local: 'Admin Local', financeiro_local: 'Fin. Local',
    supervisor: 'Supervisor', viewer: 'Visualizador',
    presidencia: 'Presidência', conselho_fiscal: 'Conselho Fiscal',
  };

  const QUICK_ACTIONS = [
    { label: 'Cadastrar\nMembro', icon: '👤', href: '/secretaria/membros',     modulo: 'secretaria' },
    { label: 'Lançar\nEntrada',   icon: '💰', href: '/tesouraria',             modulo: 'tesouraria' },
    { label: 'Emitir\nCarta',     icon: '📄', href: '/secretaria/cartas',      modulo: 'secretaria' },
    { label: 'Chamada\nEBD',      icon: '📚', href: '/secretaria/ebd/chamada', modulo: 'ebd'        },
    { label: 'Novo\nUsuário',     icon: '🔑', href: '/usuarios',               modulo: 'usuarios'   },
    { label: 'Configurações',     icon: '⚙️',  href: '/configuracoes',          modulo: 'configuracoes' },
  ].filter(a => userCtx.podeAcessar(a.modulo));

  const statusPie = [
    { name: 'Ativos',     value: dash.membrosAtivos,                                                          color: '#16A34A' },
    { name: 'Inativos',   value: Math.max(0, dash.totalMembros - dash.membrosAtivos - dash.membrosVisitantes), color: '#6B7280' },
    { name: 'Visitantes', value: dash.membrosVisitantes,                                                      color: '#2563EB' },
  ].filter(d => d.value > 0);

  const congBarData = [...dash.congregacoesData]
    .sort((a, b) => b.membrosAtivos - a.membrosAtivos)
    .slice(0, 8)
    .map(c => ({
      nome: obterIniciais(c.nome),
      total: c.membrosAtivos,
    }));

  return (
    <div className="flex-1 overflow-auto">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 px-6 py-4 shadow-md" style={{ background: 'linear-gradient(to right, #1E3A5F, #2563EB)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-blue-200 uppercase tracking-widest">
                Seja bem-vindo(a){usuarioLogado ? `, ${usuarioLogado.nome}` : ''}
              </p>
              <h1 className="text-lg font-bold text-white leading-tight">"{dash.nomeMinisterio || 'Ministério'}"</h1>
              <p className="text-xs text-blue-200">{dataAtual}</p>
            </div>
            {usuarioLogado && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-white">{usuarioLogado.nome}</p>
                  <p className="text-xs text-blue-200">{usuarioLogado.email}</p>
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-400 text-amber-900 shrink-0">
                  {NIVEL_LABEL[nivel] ?? nivel}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── ATALHOS RÁPIDOS (centralizados) ──────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {QUICK_ACTIONS.map(a => (
                <button
                  key={a.href + a.label}
                  onClick={() => router.push(a.href)}
                  className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl hover:bg-gray-50 transition min-w-[72px]"
                >
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-[11px] font-medium text-gray-500 text-center leading-tight whitespace-pre-line">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── KPIs PRINCIPAIS (4 cards coloridos) ──────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Congregações — navy */}
            <div
              className="rounded-2xl p-5 text-white cursor-pointer hover:opacity-90 transition"
              style={{ background: '#1E3A5F' }}
              onClick={() => router.push('/secretaria/congregacoes')}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-200 leading-tight">Total de Congregações</p>
                <Building2 size={28} className="text-white/30 shrink-0" />
              </div>
              {loadingDash
                ? <div className="h-10 w-16 bg-white/20 rounded animate-pulse" />
                : <p className="text-4xl font-bold">{dash.totalCongregacoes}</p>}
              <p className="text-xs text-blue-200 mt-1">{dash.totalDepartamentos} departamentos</p>
            </div>

            {/* Membros Ativos — blue */}
            <div
              className="rounded-2xl p-5 text-white cursor-pointer hover:opacity-90 transition"
              style={{ background: 'linear-gradient(135deg,#1a4f8a,#2563EB)' }}
              onClick={() => router.push('/secretaria/membros')}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-100 leading-tight">Total de Membros</p>
                <Users size={28} className="text-white/30 shrink-0" />
              </div>
              {loadingDash
                ? <div className="h-10 w-16 bg-white/20 rounded animate-pulse" />
                : <p className="text-4xl font-bold">{dash.membrosAtivos}</p>}
              <p className="text-xs text-blue-100 mt-1">
                {dash.totalMembros > 0
                  ? `${Math.round((dash.membrosAtivos / dash.totalMembros) * 100)}% do total cadastrado`
                  : 'membros ativos'}
              </p>
            </div>

            {/* Batizados — golden */}
            <div
              className="rounded-2xl p-5 text-white cursor-pointer hover:opacity-90 transition"
              style={{ background: 'linear-gradient(135deg,#D97706,#F59E0B)' }}
              onClick={() => router.push('/secretaria/membros')}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-100 leading-tight">Batizados</p>
                <Award size={28} className="text-white/30 shrink-0" />
              </div>
              {loadingDash
                ? <div className="h-10 w-16 bg-white/20 rounded animate-pulse" />
                : <p className="text-4xl font-bold">{dash.membrosBatizados}</p>}
              <p className="text-xs text-amber-100 mt-1">
                {dash.totalMembros > 0
                  ? `${Math.round((dash.membrosBatizados / dash.totalMembros) * 100)}% do total`
                  : 'registrados'}
              </p>
            </div>

            {/* Turmas EBD — teal */}
            <div
              className="rounded-2xl p-5 text-white cursor-pointer hover:opacity-90 transition"
              style={{ background: '#0D9488' }}
              onClick={() => router.push('/secretaria/ebd')}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-100 leading-tight">Turmas EBD</p>
                <CalendarDays size={28} className="text-white/30 shrink-0" />
              </div>
              {loadingDash
                ? <div className="h-10 w-16 bg-white/20 rounded animate-pulse" />
                : <p className="text-4xl font-bold">{dash.ebdTurmas}</p>}
              <p className="text-xs text-teal-100 mt-1">
                {dash.ebdMediaPresenca !== null ? `Média ${dash.ebdMediaPresenca} presentes` : 'turmas ativas'}
              </p>
            </div>
          </div>

          {/* ── RESUMO INSTITUCIONAL ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-sm font-bold text-[#1E3A5F]">Resumo institucional</h3>
                <p className="text-xs text-gray-400">Secretaria e indicadores</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-1.5 bg-[#1E3A5F] text-white rounded-lg text-xs font-semibold hover:bg-[#16305a] transition"
              >
                Atualizar
              </button>
            </div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-3">
              Secretaria · Indicadores institucionais
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {([
                { label: 'Cartas emitidas',  value: dash.cartasEmitidas,         icon: '📄' },
                { label: 'Fluxos pendentes', value: dash.fluxosPendentes,        icon: '⏳' },
                { label: 'Pedidos carta',    value: dash.pendencias.cartasP,     icon: '📋' },
                { label: 'Visitantes',       value: dash.membrosVisitantes,      icon: '👥' },
                { label: 'Usuários ativos',  value: dash.totalUsuarios,          icon: '🔑' },
                { label: 'Eventos próximos', value: dash.pendencias.eventosProx, icon: '📅' },
              ] as const).map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">{item.label}</p>
                    <span className="text-base">{item.icon}</span>
                  </div>
                  {loadingDash
                    ? <div className="h-7 w-10 bg-gray-200 rounded animate-pulse mt-1" />
                    : <p className="text-2xl font-bold text-[#1E3A5F] mt-0.5">{item.value}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* ── GRÁFICOS: FATIA + BARRAS + BARRAS ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Pie: Situação dos Membros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-[#1E3A5F]">Situação dos Membros</h3>
              <p className="text-xs text-gray-400 mt-0.5">Distribuição geral</p>
              {loadingDash ? (
                <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Carregando...</div>
              ) : statusPie.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={statusPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar: Top Congregações por membros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-[#1E3A5F]">Membros por congregação</h3>
              <p className="text-xs text-gray-400 mt-0.5">Top congregações</p>
              {loadingDash ? (
                <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Carregando...</div>
              ) : congBarData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={congBarData} margin={{ top: 4, right: 4, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#9ca3af' }} textAnchor="middle" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="total" fill="#1E3A5F" radius={[4, 4, 0, 0]} name="Membros" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar: Crescimento mensal */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-[#1E3A5F]">Crescimento mensal</h3>
              <p className="text-xs text-gray-400 mt-0.5">Últimos 12 meses</p>
              {loadingDash ? (
                <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Carregando...</div>
              ) : dash.crescimentoMembros.length < 2 ? (
                <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Sem dados suficientes</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={dash.crescimentoMembros} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="total" fill="#2563EB" radius={[4, 4, 0, 0]} name="Membros" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* -- SEÇÃO FINANCEIRA (somente para temFinanceiro) -------------- */}
          {temFinanceiro && (
            <>
              {/* KPIs Financeiros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Receita do Mês</p>
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                      <TrendingUp size={18} className="text-green-600" />
                    </div>
                  </div>
                  {loadingDash ? <div className="h-8 w-28 bg-gray-100 rounded animate-pulse" /> : (
                    <>
                      <p className="text-2xl font-bold text-green-600">{fmtBRL(dash.entradasMes)}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {dash.variacao >= 0 ? `▲ +${dash.variacao}%` : `▼ ${dash.variacao}%`} vs mês anterior
                      </p>
                    </>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Despesa do Mês</p>
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                      <TrendingDown size={18} className="text-red-500" />
                    </div>
                  </div>
                  {loadingDash ? <div className="h-8 w-28 bg-gray-100 rounded animate-pulse" /> : (
                    <>
                      <p className="text-2xl font-bold text-red-500">{fmtBRL(dash.saidasMes)}</p>
                      <p className="text-xs text-gray-400 mt-1">Registradas no mês</p>
                    </>
                  )}
                </div>

                <div className={`bg-white rounded-2xl shadow-sm border p-5 ${dash.saldoMes >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo do Mês</p>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dash.saldoMes >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <Wallet size={18} className={dash.saldoMes >= 0 ? 'text-green-600' : 'text-red-500'} />
                    </div>
                  </div>
                  {loadingDash ? <div className="h-8 w-28 bg-gray-100 rounded animate-pulse" /> : (
                    <>
                      <p className={`text-2xl font-bold ${dash.saldoMes >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {fmtBRL(dash.saldoMes)}
                      </p>
                      <span className={`text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded-full ${dash.saldoMes >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {dash.saldoMes >= 0 ? '● Superávit' : '● Déficit'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Gráficos Financeiros */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Bar grouped: Receitas × Despesas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-[#1E3A5F]">Receitas × Despesas</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Últimos 6 meses</p>
                  {loadingDash ? (
                    <div className="h-56 flex items-center justify-center text-gray-300 text-sm">Carregando...</div>
                  ) : dash.historico6m.every(m => m.entradas === 0 && m.saidas === 0) ? (
                    <div className="h-56 flex items-center justify-center text-gray-300 text-sm">Sem lançamentos</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dash.historico6m} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(v: number | undefined) => fmtBRL(v ?? 0)}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11, color: '#6b7280' }}
                          formatter={(v: string) => v === 'entradas' ? 'Entradas' : 'Saídas'}
                        />
                        <Bar dataKey="entradas" fill="#16A34A" radius={[3, 3, 0, 0]} name="entradas" />
                        <Bar dataKey="saidas"   fill="#EF4444" radius={[3, 3, 0, 0]} name="saidas"   />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Pie: Arrecadação por tipo */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-[#1E3A5F]">Arrecadação por tipo</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Entradas do mês atual</p>
                  {loadingDash ? (
                    <div className="h-56 flex items-center justify-center text-gray-300 text-sm">Carregando...</div>
                  ) : dash.porTipo.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-gray-300 text-sm">Sem lançamentos no mês</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={dash.porTipo}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={88}
                          paddingAngle={3}
                        >
                          {dash.porTipo.map((_, i) => (
                            <Cell key={i} fill={['#1E3A5F','#2563EB','#D97706','#16A34A','#DC2626','#0D9488','#6B7280'][i % 7]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number | undefined) => fmtBRL(v ?? 0)}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
  );
}

