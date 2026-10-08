'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useUserContext } from '@/hooks/useUserContext';
import { useCurrentMinistry } from '@/providers/CurrentMinistryProvider';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';
import { ProductExperienceService } from '@/lib/services/product-experience';
import { ExperienceCenter } from '@/services/experience/ExperienceCenter';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet,
  Building2, Users, Award, CalendarDays,
  Cake, MessageCircle, FileText, Key,
  Clock, ClipboardList, LogOut,
  ChevronRight, Sparkles,
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
interface AniversarianteHoje {
  id: string;
  nome: string;
  foto_url?: string | null;
  celular?: string | null;
  cargo?: string | null;
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
  aniversariantesHoje: AniversarianteHoje[];
  totalAniversariantesMes: number;
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
  aniversariantesHoje: [],
  totalAniversariantesMes: 0,
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
  const { ministry: currentMinistry } = useCurrentMinistry();
  const [dataAtual, setDataAtual] = useState('');
  const [usuarioLogado, setUsuarioLogado] = useState<{ nome: string; email: string; nivel: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dash, setDash] = useState<DashData>(EMPTY);
  const [loadingDash, setLoadingDash] = useState(true);
  const [onboardingProgress, setOnboardingProgress] = useState<{
    progressPercent: number;
    isCompleted: boolean;
    stepsRemaining: number;
    showAssistant: boolean;
    trialDaysRemaining: number;
  } | null>(null);
  const [widgetVersion, setWidgetVersion] = useState(0);

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
      console.log('[DASHBOARD_AUTH] user.id:', authData?.user?.id || null);

      if (!authData.user) { router.push('/login'); return; }

      const { data: mu } = await supabase
        .from('ministry_users')
        .select('role, permissions')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      console.log('[DASHBOARD_AUTH] resultado da consulta em ministry_users:', mu);

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
        safeQuery(withScopeMember(supabase.from('members').select('id, name, status, role, tipo_cadastro, custom_fields, data_nascimento, foto_url, celular, whatsapp').eq('ministry_id', ministryId))),
        safeQuery(Promise.resolve({ data: [], count: 0 })),
        safeQuery(
          scopeCongId
            ? supabase.from('cartas_registros').select('id, members!inner(congregacao_id)', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('members.congregacao_id', scopeCongId)
            : supabase.from('cartas_registros').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId)
        ),
        safeQuery(
          (async () => {
            const orgService = await obterEstruturaOrganizacionalService(ministryId, supabase);
            let opts = orgService.getOptionsFormatadas(1);
            if (scopeCongId) {
              opts = opts.filter((o) => o.id === scopeCongId);
            }
            return { count: opts.length, data: opts };
          })()
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
        safeQuery(supabase.from('ebd_aulas').select('total_presentes').eq('ministry_id', ministryId).gte('data_aula', new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)).limit(100)),
        safeQuery(supabase.from('ministry_users').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('is_active', true)),
        safeQuery(supabase.from('members').select('id').eq('ministry_id', ministryId).eq('role', 'visitante')),
        safeQuery(
          scopeCongId
            ? supabase.from('cartas_registros').select('id, template_title, issued_at, members!inner(name, congregacao_id)').eq('ministry_id', ministryId).eq('members.congregacao_id', scopeCongId).order('issued_at', { ascending: false }).limit(5)
            : supabase.from('cartas_registros').select('id, template_title, issued_at, members(name)').eq('ministry_id', ministryId).order('issued_at', { ascending: false }).limit(5)
        ),
        safeQuery(Promise.resolve({ data: [], count: 0 })),
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

      // Aniversariantes do Dia e do Mês
      const hojeMonth = agora.getMonth() + 1;
      const hojeDay   = agora.getDate();
      const aniversariantesHoje: AniversarianteHoje[] = [];
      let totalAniversariantesMes = 0;

      for (const m of todosOsMembros) {
        const cf = m.custom_fields && typeof m.custom_fields === 'object' ? m.custom_fields : {};
        const dtStr = String(m.data_nascimento || cf.dataNascimento || cf.data_nascimento || '').trim();
        if (!dtStr) continue;

        let mMonth: number | null = null;
        let mDay: number | null = null;

        if (dtStr.includes('-')) {
          const parts = dtStr.split('T')[0].split('-');
          if (parts.length === 3) {
            mMonth = parseInt(parts[1], 10);
            mDay   = parseInt(parts[2], 10);
          }
        } else if (dtStr.includes('/')) {
          const parts = dtStr.split('/');
          if (parts.length >= 2) {
            mDay   = parseInt(parts[0], 10);
            mMonth = parseInt(parts[1], 10);
          }
        }

        if (mMonth === hojeMonth) {
          totalAniversariantesMes++;
          if (mDay === hojeDay) {
            aniversariantesHoje.push({
              id: m.id,
              nome: m.name || cf.nome || 'Membro',
              foto_url: m.foto_url || cf.fotoUrl || null,
              celular: m.celular || m.whatsapp || cf.celular || cf.whatsapp || null,
              cargo: m.role || cf.cargoMinisterial || null,
            });
          }
        }
      }

      // fluxos
      const fluxos          = fluxosRes.data ?? [];
      const totalFluxos     = fluxos.length;
      const fluxosPendentes = fluxos.filter((f: any) => f.status === 'pendente' || f.status === 'em_andamento').length;

      // últimas cartas
      const ultimasCartas = (ultimasCartasRes.data ?? []).map((c: any) => ({
        id: c.id,
        tipo: c.template_title ?? '',
        created_at: c.issued_at ?? '',
        membro_nome: c.members?.name ?? '',
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
        ? Math.round(chamadas.reduce((s: number, c: any) => s + Number(c.total_presentes ?? c.presentes_count ?? c.presentes ?? 0), 0) / chamadas.length)
        : null;

      // ── DASHBOARD 2.0 — novas queries ──────────────────────────────────────
      const todayStr         = agora.toISOString().slice(0, 10);
      const in30daysStr      = new Date(agora.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const twelveMonthsAgo  = new Date(anoAtual, mesAtual - 13, 1).toISOString().slice(0, 10);

      const [
        congListRes, allMembersRes, eventosProxRes,
        memberGrowthRes, cartasPendCountRes, pareceresRes,
      ] = await Promise.all([
        safeQuery(
          (async () => {
            const orgService = await obterEstruturaOrganizacionalService(ministryId, supabase);
            const opts = orgService.getOptionsFormatadas(1);
            return { data: opts.map((o) => ({ id: o.id, nome: o.nome })) };
          })()
        ),
        safeQuery(supabase.from('members').select('congregacao_id, status').eq('ministry_id', ministryId).limit(10000)),
        safeQuery(supabase.from('eventos').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('status', 'programado').gte('data_inicio', todayStr).lte('data_inicio', in30daysStr)),
        safeQuery(supabase.from('members').select('created_at').eq('ministry_id', ministryId).gte('created_at', twelveMonthsAgo).limit(5000)),
        safeQuery(supabase.from('carta_pedidos').select('id', { count: 'exact', head: true }).eq('ministry_id', ministryId).eq('status', 'pendente')),
        safeQuery(Promise.resolve({ count: 0 })),
      ]);

      // PIX vencidos (consulta fin_payment_charges por cobranças PIX vencidas/expiradas)
      let pixVencidos = 0;
      try {
        const r = await supabase.from('fin_payment_charges')
          .select('id', { count: 'exact', head: true })
          .eq('ministry_id', ministryId)
          .in('status', ['overdue', 'vencido', 'vencida', 'expirado', 'expirada']);
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
        nomeMinisterio: currentMinistry?.nome || currentMinistry?.name || '',
        aniversariantesHoje,
        totalAniversariantesMes,
      });

      // Busca o status do onboarding
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const uid = session.user.id;
          const tourCompleted = ProductExperienceService.isTourCompleted(uid);
          const showAssistant = ProductExperienceService.shouldShowAssistant(uid);

          const res = await fetch(`/api/v1/onboarding/status?tourCompleted=${tourCompleted}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const statusData = await res.json();
            const stepsRemaining = (statusData.steps || []).filter((s: any) => !s.completed).length;

            setOnboardingProgress({
              progressPercent: statusData.progressPercent,
              isCompleted: statusData.isCompleted,
              stepsRemaining,
              showAssistant,
              trialDaysRemaining: statusData.trialDaysRemaining || 0
            });
          }
        }
      } catch (err) {
        console.error('Erro ao buscar status do onboarding:', err);
      }

      setLoadingDash(false);
    };

    run();
  }, [router, supabase, userCtx.loading, userCtx.ministryId]);

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

  const congBarData = [...dash.congregacoesData]
    .sort((a, b) => b.membrosAtivos - a.membrosAtivos)
    .slice(0, 8)
    .map(c => ({
      nome: obterIniciais(c.nome),
      total: c.membrosAtivos,
    }));

  return (
    <div className="flex-1 overflow-auto bg-[#F8FAFC]">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-gradient-to-r from-[#1E3A5F] via-[#1E3A5F] to-[#2563EB] shadow-xs border-b border-blue-900/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-[1600px] mx-auto">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-blue-200/90 uppercase">
                  Painel Principal
                </span>
                <span className="text-blue-300/40">•</span>
                <p className="text-[11px] text-blue-200/80">{dataAtual}</p>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight mt-0.5">
                {dash.nomeMinisterio ? `"${dash.nomeMinisterio}"` : 'Gestão Eklésia'}
              </h1>
            </div>

            {usuarioLogado && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-white leading-tight">{usuarioLogado.nome}</p>
                  <p className="text-[11px] text-blue-200/80 leading-tight">{usuarioLogado.email}</p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-400/95 text-amber-950 shrink-0 shadow-2xs">
                  {NIVEL_LABEL[nivel] ?? nivel}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-red-500/90 text-white rounded-lg text-xs font-semibold transition border border-white/15 hover:border-red-500"
                  title="Encerrar sessão"
                >
                  <LogOut size={13} />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">

          {/* ── BANNER DE BOAS-VINDAS ──────────────────────────────────────── */}
          <div
            className="relative overflow-hidden rounded-2xl border border-blue-100/80 bg-cover bg-right md:bg-center bg-no-repeat p-6 sm:p-7 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 min-h-[110px]"
            style={{ backgroundImage: `url('/images/bg_dash01.png?v=4')` }}
          >
            <div className="space-y-1 z-10 max-w-xl">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E3A5F] tracking-tight">
                Olá, {usuarioLogado ? (usuarioLogado.nome && usuarioLogado.nome !== usuarioLogado.email ? usuarioLogado.nome.split(' ')[0] : 'Administrador') : 'Administrador'}!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Bem-vindo ao <strong className="text-[#1E3A5F] font-bold">Gestão Eklésia</strong>. Aqui está um resumo da sua igreja hoje.
              </p>
            </div>
          </div>

          {/* ── EXPERIENCE WIDGET DE MAIOR PRIORIDADE ─────────────────────── */}
          {onboardingProgress && (() => {
            const uid = userCtx.userId || '';
            if (!uid) return null;

            const ctx = {
              userId: uid,
              trialDaysRemaining: onboardingProgress.trialDaysRemaining,
              progressPercent: onboardingProgress.progressPercent,
              hasCongregacao: dash.totalCongregacoes > 0
            };

            const activeWidgets = ExperienceCenter.getInstance().getActiveWidgets(ctx);
            if (activeWidgets.length === 0) return null;

            const widget = activeWidgets[0];
            return (
              <div key={widgetVersion}>
                {widget.render(ctx, () => {
                  ExperienceCenter.getInstance().dismissWidget(uid, widget.id);
                  setWidgetVersion(prev => prev + 1);
                })}
              </div>
            );
          })()}

          {/* ── CARD DE IMPLANTAÇÃO ───────────────────────────────────────── */}
          {onboardingProgress && onboardingProgress.showAssistant && !onboardingProgress.isCompleted && (() => {
            const uid = userCtx.userId || '';

            const handleCancelarImplantacao = () => {
              if (uid) {
                ProductExperienceService.hideAssistant(uid);
                setOnboardingProgress(prev => prev ? { ...prev, showAssistant: false } : null);
              }
            };

            return (
              <div className="relative bg-gradient-to-r from-amber-50/80 to-amber-100/40 border border-amber-200/80 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <button
                  onClick={handleCancelarImplantacao}
                  title="Cancelar / Ocultar aviso de implantação"
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-amber-200/50 transition text-xs font-bold flex items-center gap-1"
                >
                  <span className="text-[11px]">Ocultar</span>
                  <span className="text-xs font-bold leading-none">✕</span>
                </button>
                <div className="space-y-1.5 flex-1 pr-16 md:pr-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 font-bold">
                      <Sparkles size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Implantação do Ministério</h3>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                      {onboardingProgress.progressPercent}% Concluído
                    </span>
                  </div>
                  <div className="w-full max-w-md bg-amber-200/50 h-2 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-amber-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, onboardingProgress.progressPercent)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 font-medium pt-0.5">
                    {onboardingProgress.stepsRemaining} {onboardingProgress.stepsRemaining === 1 ? 'etapa restante' : 'etapas restantes'} para configuração completa.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <button
                    onClick={handleCancelarImplantacao}
                    className="px-3.5 py-2 bg-white border border-amber-300/80 hover:bg-amber-50 text-slate-700 rounded-xl text-xs font-semibold transition shadow-2xs"
                  >
                    Não exibir mais
                  </button>
                  <button
                    onClick={() => router.push('/boas-vindas?show=true')}
                    className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#152943] text-white rounded-xl text-xs font-semibold transition shadow-2xs flex items-center gap-1.5"
                  >
                    <span>Continuar Implantação</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })()}



          {/* ── KPIs PRINCIPAIS (4 cards executivos com identidade visual) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Total de Membros — Royal Blue */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-[#1E56A0] via-[#2563EB] to-[#3B82F6] shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[140px]"
              onClick={() => router.push('/secretaria/membros')}
            >
              {/* Decorative background icon */}
              <Users className="absolute -right-3 -bottom-3 w-28 h-28 text-white/10 pointer-events-none" />

              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                    <Users size={18} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">Total de Membros</span>
                </div>
              </div>

              <div className="mt-3 z-10 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-extrabold text-white leading-none">
                    {loadingDash ? <span className="inline-block h-8 w-16 bg-white/20 rounded animate-pulse" /> : dash.membrosAtivos}
                  </div>
                  <p className="text-xs text-blue-100 mt-1.5 font-medium">
                    {dash.totalMembros > 0
                      ? `${Math.round((dash.membrosAtivos / dash.totalMembros) * 100)}% do total cadastrado`
                      : '100% do total cadastrado'}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition">
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>

            {/* Total de Congregações — Navy Slate */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-[#1B2A47] via-[#243B61] to-[#324D7B] shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[140px]"
              onClick={() => router.push('/secretaria/congregacoes')}
            >
              <Building2 className="absolute -right-3 -bottom-3 w-28 h-28 text-white/10 pointer-events-none" />

              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                    <Building2 size={18} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">Total de Congregações</span>
                </div>
              </div>

              <div className="mt-3 z-10 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-extrabold text-white leading-none">
                    {loadingDash ? <span className="inline-block h-8 w-16 bg-white/20 rounded animate-pulse" /> : dash.totalCongregacoes}
                  </div>
                  <p className="text-xs text-blue-100 mt-1.5 font-medium">
                    {dash.totalDepartamentos} departamentos
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition">
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>

            {/* Batizados — Amber / Warm Orange */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-[#D97706] via-[#EA580C] to-[#F59E0B] shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[140px]"
              onClick={() => router.push('/secretaria/membros')}
            >
              <Award className="absolute -right-3 -bottom-3 w-28 h-28 text-white/10 pointer-events-none" />

              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                    <Award size={18} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">Batizados</span>
                </div>
              </div>

              <div className="mt-3 z-10 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-extrabold text-white leading-none">
                    {loadingDash ? <span className="inline-block h-8 w-16 bg-white/20 rounded animate-pulse" /> : dash.membrosBatizados}
                  </div>
                  <p className="text-xs text-amber-100 mt-1.5 font-medium">
                    {dash.totalMembros > 0
                      ? `${Math.round((dash.membrosBatizados / dash.totalMembros) * 100)}% do total`
                      : '40% do total'}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition">
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>

            {/* Turmas EBD — Emerald / Teal */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-[#0D9488] via-[#059669] to-[#10B981] shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[140px]"
              onClick={() => router.push('/secretaria/ebd')}
            >
              <CalendarDays className="absolute -right-3 -bottom-3 w-28 h-28 text-white/10 pointer-events-none" />

              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                    <CalendarDays size={18} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">Turmas EBD</span>
                </div>
              </div>

              <div className="mt-3 z-10 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-extrabold text-white leading-none">
                    {loadingDash ? <span className="inline-block h-8 w-16 bg-white/20 rounded animate-pulse" /> : dash.ebdTurmas}
                  </div>
                  <p className="text-xs text-teal-100 mt-1.5 font-medium">
                    {dash.ebdMediaPresenca !== null ? `Média ${dash.ebdMediaPresenca} presentes` : 'turmas ativas'}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition">
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>

          </div>

          {/* ── RESUMO INSTITUCIONAL ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#1E3A5F]">Resumo institucional</h3>
                <p className="text-xs text-slate-400">Secretaria e indicadores gerais</p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold">
                  <CalendarDays size={14} className="text-slate-500" />
                  <span>{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, str => str.toUpperCase())}</span>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-1.5 bg-[#1E3A5F] hover:bg-[#152943] text-white rounded-lg text-xs font-semibold transition shadow-2xs"
                >
                  Atualizar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              {([
                { label: 'Cartas emitidas',  sub: 'Neste mês',             value: dash.cartasEmitidas,         icon: FileText,      color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Fluxos pendentes', sub: 'Aguardando análise',    value: dash.fluxosPendentes,        icon: Clock,         color: 'text-amber-600 bg-amber-50' },
                { label: 'Pedidos carta',    sub: 'Em processamento',      value: dash.pendencias.cartasP,     icon: ClipboardList, color: 'text-amber-600 bg-amber-50' },
                { label: 'Visitantes',       sub: 'Neste mês',             value: dash.membrosVisitantes,      icon: Users,         color: 'text-blue-600 bg-blue-50' },
                { label: 'Usuários ativos',  sub: 'Com acesso ao sistema', value: dash.totalUsuarios,          icon: Key,           color: 'text-amber-500 bg-amber-50' },
                { label: 'Eventos próximos', sub: 'Nos próximos 30 dias',  value: dash.pendencias.eventosProx, icon: CalendarDays,  color: 'text-rose-500 bg-rose-50' },
              ] as const).map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-4 border border-slate-100/90 flex flex-col justify-between transition">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700 leading-tight">{item.label}</p>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color}`}>
                        <Icon size={15} />
                      </div>
                    </div>
                    <div>
                      {loadingDash
                        ? <div className="h-7 w-12 bg-slate-200 rounded animate-pulse" />
                        : <p className="text-2xl font-bold text-slate-900">{item.value}</p>}
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── GRÁFICOS: FATIA + BARRAS + BARRAS ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Card: Aniversariantes do Dia */}
            <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                      <Cake className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1E3A5F]">Aniversariantes do Dia</h3>
                      <p className="text-xs text-slate-400">
                        {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/secretaria/membros?view=aniversariantes"
                    className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 shrink-0"
                  >
                    <span>Ver lista</span>
                    <ChevronRight size={13} />
                  </Link>
                </div>

                {loadingDash ? (
                  <div className="h-44 flex items-center justify-center text-slate-300 text-sm">Carregando...</div>
                ) : dash.aniversariantesHoje.length > 0 ? (
                  <div className="space-y-2.5 my-2 max-h-[190px] overflow-y-auto pr-1">
                    {dash.aniversariantesHoje.map((aniv) => {
                      const initials = obterIniciais(aniv.nome) || 'MB';
                      const celClean = (aniv.celular || '').replace(/\D/g, '');
                      const waUrl = celClean
                        ? `https://wa.me/55${celClean}?text=${encodeURIComponent(`Parabéns, ${aniv.nome}! Que Deus abençoe rica e abundantemente sua vida neste dia tão especial! 🎉🎂`)}`
                        : null;

                      return (
                        <div
                          key={aniv.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-teal-50/40 border border-teal-100/70 hover:bg-teal-50/80 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {aniv.foto_url ? (
                              <img
                                src={aniv.foto_url}
                                alt={aniv.nome}
                                className="w-8 h-8 rounded-full object-cover border border-teal-300 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{aniv.nome}</p>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded">
                                Hoje! 🎉
                              </span>
                            </div>
                          </div>

                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1 shrink-0 shadow-2xs"
                              title="Enviar parabéns pelo WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 italic shrink-0">Sem contato</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-center p-3 my-1 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <div className="p-2.5 rounded-full bg-amber-50 text-amber-500 mb-2">
                      <Cake className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Nenhum aniversariante hoje</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px]">
                      Nenhum membro faz aniversário neste dia. {dash.totalAniversariantesMes} comemoram neste mês.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px]">
                  Total este mês: <strong className="text-teal-700 font-bold">{dash.totalAniversariantesMes}</strong>
                </span>
                <Link
                  href="/secretaria/membros?view=aniversariantes"
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-800"
                >
                  Abrir lista
                </Link>
              </div>
            </div>

            {/* Bar: Top Congregações por membros */}
            <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E3A5F]">Membros por congregação</h3>
                  <p className="text-xs text-slate-400">Top congregações</p>
                </div>
              </div>
              <div className="mt-3">
                {loadingDash ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Carregando...</div>
                ) : congBarData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={congBarData} margin={{ top: 8, right: 4, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} textAnchor="middle" interval={0} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                      <Bar dataKey="total" fill="#1E3A5F" radius={[6, 6, 0, 0]} name="Membros" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Bar: Crescimento mensal */}
            <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E3A5F]">Crescimento mensal</h3>
                  <p className="text-xs text-slate-400">Últimos 12 meses</p>
                </div>
              </div>
              <div className="mt-3">
                {loadingDash ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Carregando...</div>
                ) : dash.crescimentoMembros.length < 2 ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sem dados suficientes</div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={dash.crescimentoMembros} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                      <Bar dataKey="total" fill="#2563EB" radius={[6, 6, 0, 0]} name="Membros" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* -- SEÇÃO FINANCEIRA (somente para temFinanceiro) -------------- */}
          {temFinanceiro && (
            <>
              {/* KPIs Financeiros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receita do Mês</p>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <TrendingUp size={18} />
                    </div>
                  </div>
                  {loadingDash ? <div className="h-8 w-28 bg-slate-100 rounded animate-pulse" /> : (
                    <>
                      <p className="text-2xl font-bold text-emerald-600">{fmtBRL(dash.entradasMes)}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {dash.variacao >= 0 ? `▲ +${dash.variacao}%` : `▼ ${dash.variacao}%`} vs mês anterior
                      </p>
                    </>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Despesa do Mês</p>
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <TrendingDown size={18} />
                    </div>
                  </div>
                  {loadingDash ? <div className="h-8 w-28 bg-slate-100 rounded animate-pulse" /> : (
                    <>
                      <p className="text-2xl font-bold text-rose-600">{fmtBRL(dash.saidasMes)}</p>
                      <p className="text-xs text-slate-400 mt-1">Registradas no mês</p>
                    </>
                  )}
                </div>

                <div className={`bg-white rounded-2xl shadow-2xs border p-5 flex flex-col justify-between ${dash.saldoMes >= 0 ? 'border-emerald-200/80' : 'border-rose-200/80'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo do Mês</p>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dash.saldoMes >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <Wallet size={18} />
                    </div>
                  </div>
                  {loadingDash ? <div className="h-8 w-28 bg-slate-100 rounded animate-pulse" /> : (
                    <>
                      <p className={`text-2xl font-bold ${dash.saldoMes >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {fmtBRL(dash.saldoMes)}
                      </p>
                      <span className={`text-[11px] font-semibold mt-1 inline-block px-2 py-0.5 rounded-full w-fit ${dash.saldoMes >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'}`}>
                        {dash.saldoMes >= 0 ? '● Superávit' : '● Déficit'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Gráficos Financeiros */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Bar grouped: Receitas × Despesas */}
                <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5">
                  <h3 className="text-sm font-bold text-[#1E3A5F]">Receitas × Despesas</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Últimos 6 meses</p>
                  {loadingDash ? (
                    <div className="h-56 flex items-center justify-center text-slate-300 text-sm">Carregando...</div>
                  ) : dash.historico6m.every(m => m.entradas === 0 && m.saidas === 0) ? (
                    <div className="h-56 flex items-center justify-center text-slate-300 text-sm">Sem lançamentos</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dash.historico6m} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(v: number | undefined) => fmtBRL(v ?? 0)}
                          contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11, color: '#64748b' }}
                          formatter={(v: string) => v === 'entradas' ? 'Entradas' : 'Saídas'}
                        />
                        <Bar dataKey="entradas" fill="#10B981" radius={[4, 4, 0, 0]} name="entradas" />
                        <Bar dataKey="saidas"   fill="#F43F5E" radius={[4, 4, 0, 0]} name="saidas"   />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Pie: Arrecadação por tipo */}
                <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5">
                  <h3 className="text-sm font-bold text-[#1E3A5F]">Arrecadação por Tipo</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Entradas do mês atual</p>
                  {loadingDash ? (
                    <div className="h-56 flex items-center justify-center text-slate-300 text-sm">Carregando...</div>
                  ) : dash.porTipo.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-slate-300 text-sm">Sem lançamentos no mês</div>
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
                            <Cell key={i} fill={['#1E3A5F','#2563EB','#D97706','#10B981','#F43F5E','#0D9488','#64748B'][i % 7]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number | undefined) => fmtBRL(v ?? 0)}
                          contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
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

