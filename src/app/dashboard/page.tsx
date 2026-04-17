'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { useUserContext } from '@/hooks/useUserContext';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  FileText, TrendingUp, TrendingDown, DollarSign,
  BookOpen, Building2, ArrowRight, AlertCircle, CheckCircle,
  ChevronUp, ChevronDown,
} from 'lucide-react';

// helpers
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const CORES_TIPO = ['#3b82f6','#22c55e','#a855f7','#f97316','#ec4899','#14b8a6','#6b7280'];

// types
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
  ebdTurmas: number;
  ebdMediaPresenca: number | null;
  totalUsuarios: number;
  membrosVisitantes: number;
  ultimasCartas: { id: string; tipo: string; created_at: string; membro_nome: string }[];
  ultimosFluxos: { id: string; status: string; tipo_fluxo: string }[];
  cartaPedidosPendentes: { id: string; status: string; tipo_carta: string }[];
}

const EMPTY: DashData = {
  totalMembros: 0, membrosBatizados: 0, membrosAtivos: 0,
  totalFluxos: 0, fluxosPendentes: 0, cartasEmitidas: 0,
  totalCongregacoes: 0, totalDepartamentos: 0,
  entradasMes: 0, saidasMes: 0, saldoMes: 0, variacao: 0,
  historico6m: [], porTipo: [],
  ebdTurmas: 0, ebdMediaPresenca: null,
  totalUsuarios: 0,
  membrosVisitantes: 0,
  ultimasCartas: [],
  ultimosFluxos: [],
  cartaPedidosPendentes: [],
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
        .select('role')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      const nivel = mu?.role ? String(mu.role) : 'viewer';
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
          ? withScopeLanc(supabase.from('tesouraria_lancamentos').select('tipo_movimento, tipo_recebimento, valor').eq('ministry_id', ministryId).like('data_lancamento', `${mesRef}%`))
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

      setDash({
        totalMembros, membrosBatizados, membrosAtivos,
        totalFluxos, fluxosPendentes,
        cartasEmitidas: cartasRes.count ?? 0,
        totalCongregacoes: congsRes.count ?? 0,
        totalDepartamentos: deptsRes.count ?? 0,
        entradasMes, saidasMes, saldoMes, variacao,
        historico6m, porTipo,
        ebdTurmas: ebdTurmasRes.count ?? 0,
        ebdMediaPresenca,
        totalUsuarios: usuariosRes.count ?? 0,
        membrosVisitantes,
        ultimasCartas,
        ultimosFluxos,
        cartaPedidosPendentes,
      });
      setLoadingDash(false);
    };

    run();
  }, [router, supabase]);

  const handleLogout = () => supabase.auth.signOut().finally(() => router.push('/'));

  const NIVEL_LABEL: Record<string, string> = {
    administrador: 'Administrador', financeiro: 'Financeiro',
    admin_local: 'Admin Local', financeiro_local: 'Fin. Local',
    supervisor: 'Supervisor', viewer: 'Visualizador',
  };
  const NIVEL_COR: Record<string, string> = {
    administrador: 'bg-red-100 text-red-800', financeiro: 'bg-emerald-100 text-emerald-800',
    admin_local: 'bg-blue-100 text-blue-800', financeiro_local: 'bg-teal-100 text-teal-800',
    supervisor: 'bg-indigo-100 text-indigo-800', viewer: 'bg-gray-100 text-gray-600',
  };

  if (authLoading || userCtx.loading) return (
    <div className="flex h-screen items-center justify-center text-[#123b63] font-semibold">
      Carregando...
    </div>
  );

  const temFinanceiro = userCtx.podeAcessar('tesouraria');
  const saldoPositivo = dash.saldoMes >= 0;

  return (
    <div className="flex h-screen bg-[#f4f6f9]">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 overflow-auto">
        {/* HEADER */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#123b63]">Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">{dataAtual}</p>
          </div>
          {usuarioLogado && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#123b63] leading-none">{usuarioLogado.nome}</p>
                <p className="text-xs text-gray-500 mt-1">{usuarioLogado.email}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${NIVEL_COR[usuarioLogado.nivel] ?? 'bg-gray-100 text-gray-700'}`}>
                {NIVEL_LABEL[usuarioLogado.nivel] ?? usuarioLogado.nivel}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-semibold"
              >
                Sair
              </button>
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">

          {/* ROW 1: Cards Secundários de Contexto (TOPO) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Membros por Status */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 shadow-sm border border-blue-200">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Membros Ativos</p>
              {loadingDash ? (
                <div className="h-8 w-20 bg-blue-200 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-[#123b63]">{dash.membrosAtivos}</p>
                  <p className="text-xs text-blue-700 mt-2 font-medium">{dash.totalMembros > 0 ? Math.round((dash.membrosAtivos / dash.totalMembros) * 100) : 0}% do total</p>
                </>
              )}
            </div>

            {/* Membros Batizados */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-5 shadow-sm border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-3">Batizados</p>
              {loadingDash ? (
                <div className="h-8 w-20 bg-emerald-200 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-emerald-700">{dash.membrosBatizados}</p>
                  <p className="text-xs text-emerald-700 mt-2 font-medium">{dash.totalMembros > 0 ? Math.round((dash.membrosBatizados / dash.totalMembros) * 100) : 0}% do total</p>
                </>
              )}
            </div>

            {/* Visitantes */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-5 shadow-sm border border-purple-200">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">Visitantes</p>
              {loadingDash ? (
                <div className="h-8 w-20 bg-purple-200 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-purple-700">{dash.membrosVisitantes}</p>
                  <p className="text-xs text-purple-700 mt-2 font-medium">Sem congregação</p>
                </>
              )}
            </div>

            {/* Total de Usuários */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-5 shadow-sm border border-amber-200">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">Usuários Ativos</p>
              {loadingDash ? (
                <div className="h-8 w-20 bg-amber-200 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-amber-700">{dash.totalUsuarios}</p>
                  <p className="text-xs text-amber-700 mt-2 font-medium">Admins e operadores</p>
                </>
              )}
            </div>
          </div>

          {/* ROW 2: KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Entradas do mês — só financeiro */}
            {temFinanceiro && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Entradas (mês)</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <TrendingUp size={18} className="text-emerald-600" />
                </div>
              </div>
              {loadingDash ? (
                <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-emerald-700">{fmtBRL(dash.entradasMes)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {dash.variacao >= 0
                      ? <ChevronUp size={14} className="text-emerald-500" />
                      : <ChevronDown size={14} className="text-red-500" />}
                    <span className={`text-xs font-medium ${dash.variacao >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {dash.variacao >= 0 ? '+' : ''}{dash.variacao}% vs mês ant.
                    </span>
                  </div>
                </>
              )}
            </div>
            )}

            {/* Saídas do mês — só financeiro */}
            {temFinanceiro && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saídas (mês)</span>
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                  <TrendingDown size={18} className="text-red-500" />
                </div>
              </div>
              {loadingDash ? (
                <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-red-600">{fmtBRL(dash.saidasMes)}</p>
                  <p className="text-xs text-gray-400 mt-1">Despesas registradas</p>
                </>
              )}
            </div>
            )}

            {/* Saldo — só financeiro */}
            {temFinanceiro && (
            <div className={`rounded-2xl p-5 shadow-sm border ${saldoPositivo ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Saldo (mês)</span>
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <DollarSign size={18} className="text-white" />
                </div>
              </div>
              {loadingDash ? (
                <div className="h-8 w-24 bg-white/20 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-white">{fmtBRL(dash.saldoMes)}</p>
                  <p className="text-xs text-white/70 mt-1">{saldoPositivo ? 'Superávit' : 'Déficit'} no período</p>
                </>
              )}
            </div>
            )}

          </div>

          {/* ROW 3: Atividades Recentes + Pendências */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Últimas Cartas Emitidas */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#123b63]">Cartas Recentes</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Últimas emitidas</p>
                </div>
                <button
                  onClick={() => router.push('/secretaria/cartas')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Ver mais
                </button>
              </div>
              {loadingDash ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : dash.ultimasCartas.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <FileText size={24} className="opacity-30" />
                  <span className="text-xs">Nenhuma carta emitida</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {dash.ultimasCartas.map(carta => (
                    <div key={carta.id} className="p-3 rounded-lg bg-gray-50 hover:bg-blue-50 transition border border-transparent hover:border-blue-200 cursor-pointer" onClick={() => router.push('/secretaria/cartas')}>
                      <p className="text-xs font-semibold text-gray-700 truncate">{carta.membro_nome}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400 capitalize bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{carta.tipo}</span>
                        <span className="text-xs text-gray-400">{new Date(carta.created_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fluxos Pendentes */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#123b63]">Fluxos Pendentes</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Aguardando ação</p>
                </div>
                <button
                  onClick={() => router.push('/secretaria/fluxos')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Ver mais
                </button>
              </div>
              {loadingDash ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : dash.ultimosFluxos.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <CheckCircle size={24} className="opacity-30" />
                  <span className="text-xs">Sem fluxos pendentes!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {dash.ultimosFluxos.map(fluxo => (
                    <div key={fluxo.id} className="p-3 rounded-lg bg-gray-50 hover:bg-purple-50 transition border border-transparent hover:border-purple-200 cursor-pointer" onClick={() => router.push('/secretaria/fluxos')}>
                      <p className="text-xs font-semibold text-gray-700 capitalize truncate">{fluxo.tipo_fluxo}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          fluxo.status === 'pendente' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {fluxo.status === 'pendente' ? '⏳ Pendente' : '⚙️ Em andamento'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cartas de Pedidos */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#123b63]">Pedidos de Cartas</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Status dos pedidos</p>
                </div>
                <button
                  onClick={() => router.push('/secretaria/cartas/pedidos')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Ver mais
                </button>
              </div>
              {loadingDash ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : dash.cartaPedidosPendentes.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <CheckCircle size={24} className="opacity-30" />
                  <span className="text-xs">Nenhum pedido pendente</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {dash.cartaPedidosPendentes.map(pedido => (
                    <div key={pedido.id} className="p-3 rounded-lg bg-gray-50 hover:bg-sky-50 transition border border-transparent hover:border-sky-200 cursor-pointer" onClick={() => router.push('/secretaria/cartas/pedidos')}>
                      <p className="text-xs font-semibold text-gray-700 capitalize truncate">{pedido.tipo_carta}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          pedido.status === 'pendente' ? 'bg-amber-50 text-amber-700' : 
                          pedido.status === 'autorizado' ? 'bg-emerald-50 text-emerald-700' : 
                          'bg-red-50 text-red-700'
                        }`}>
                          {pedido.status === 'pendente' ? '⏳ Pendente' : 
                           pedido.status === 'autorizado' ? '✓ Autorizado' : 
                           '✗ Rejeitado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ROW 3: Gráfico área + Pizza — só financeiro */}
          {temFinanceiro && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Gráfico área: entradas x saídas 6 meses */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#123b63]">Tesouraria — Últimos 6 Meses</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Entradas e saídas por mês</p>
                </div>
                <button
                  onClick={() => router.push('/tesouraria')}
                  className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline"
                >
                  Ver detalhes <ArrowRight size={12} />
                </button>
              </div>
              {loadingDash ? (
                <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Carregando...</div>
              ) : dash.historico6m.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <DollarSign size={32} className="opacity-30" />
                  <span className="text-sm">Nenhum lançamento registrado</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dash.historico6m} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSai" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number | undefined, name: string | undefined) => [
                        fmtBRL(v ?? 0),
                        name === 'entradas' ? 'Entradas' : 'Saídas',
                      ]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => (v === 'entradas' ? 'Entradas' : 'Saídas')}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Area type="monotone" dataKey="entradas" stroke="#22c55e" strokeWidth={2} fill="url(#gEnt)" />
                    <Area type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} fill="url(#gSai)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pizza: entradas por tipo */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-[#123b63]">Entradas por Tipo</h3>
                <p className="text-xs text-gray-400 mt-0.5">Mês atual</p>
              </div>
              {loadingDash ? (
                <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Carregando...</div>
              ) : dash.porTipo.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <BookOpen size={28} className="opacity-30" />
                  <span className="text-sm">Sem lançamentos no mês</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={dash.porTipo}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {dash.porTipo.map((_, i) => (
                        <Cell key={i} fill={CORES_TIPO[i % CORES_TIPO.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number | undefined) => fmtBRL(v ?? 0)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          )}

          {/* ROW 4: Secretaria + EBD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Fluxos */}
            <div
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
              onClick={() => router.push('/secretaria/fluxos')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fluxos Totais</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <FileText size={18} className="text-purple-600" />
                </div>
              </div>
              {loadingDash ? (
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-[#123b63]">{dash.totalFluxos}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {dash.fluxosPendentes > 0
                      ? <AlertCircle size={12} className="text-amber-500" />
                      : <CheckCircle size={12} className="text-emerald-500" />}
                    <span className="text-xs text-gray-400">{dash.fluxosPendentes} pendentes</span>
                  </div>
                </>
              )}
            </div>

            {/* Cartas */}
            <div
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
              onClick={() => router.push('/secretaria/cartas')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cartas Emitidas</span>
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
                  <FileText size={18} className="text-sky-600" />
                </div>
              </div>
              {loadingDash ? (
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-[#123b63]">{dash.cartasEmitidas}</p>
                  <p className="text-xs text-gray-400 mt-1">Total acumulado</p>
                </>
              )}
            </div>

            {/* Congregações */}
            <div
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
              onClick={() => router.push('/secretaria/congregacoes')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Congregações</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Building2 size={18} className="text-amber-600" />
                </div>
              </div>
              {loadingDash ? (
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-[#123b63]">{dash.totalCongregacoes}</p>
                  <p className="text-xs text-gray-400 mt-1">{dash.totalDepartamentos} departamentos</p>
                </>
              )}
            </div>

            {/* EBD */}
            <div
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
              onClick={() => router.push('/secretaria/ebd')}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">EBD</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <BookOpen size={18} className="text-indigo-600" />
                </div>
              </div>
              {loadingDash ? (
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-[#123b63]">{dash.ebdTurmas}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {dash.ebdMediaPresenca !== null
                      ? `Média: ${dash.ebdMediaPresenca} presentes`
                      : 'Turmas ativas'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ROW 5: Barra de receitas (só financeiro) + Atalhos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Barra horizontal: top categorias — só financeiro */}
            {temFinanceiro && (
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#123b63]">Composição das Receitas</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Mês atual — por categoria</p>
                </div>
                <button
                  onClick={() => router.push('/tesouraria')}
                  className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline"
                >
                  Tesouraria <ArrowRight size={12} />
                </button>
              </div>
              {loadingDash ? (
                <div className="h-40 flex items-center justify-center text-gray-300 text-sm">Carregando...</div>
              ) : dash.porTipo.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <DollarSign size={28} className="opacity-30" />
                  <span className="text-sm">Sem entradas neste mês</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dash.porTipo} layout="vertical" margin={{ left: 8, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={72}
                    />
                    <Tooltip
                      formatter={(v: number | undefined) => fmtBRL(v ?? 0)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {dash.porTipo.map((_, i) => (
                        <Cell key={i} fill={CORES_TIPO[i % CORES_TIPO.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            )}

            {/* Atalhos rápidos */}
            <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 ${temFinanceiro ? '' : 'lg:col-span-3'}`}>
              <h3 className="text-sm font-bold text-[#123b63] mb-1">Acesso Rápido</h3>

              {[
                { label: 'Cadastrar Membro',  sub: 'Secretaria',    icon: '👤', href: '/secretaria/membros',      modulo: 'secretaria' },
                { label: 'Lançar Entrada',    sub: 'Tesouraria',    icon: '💰', href: '/tesouraria',              modulo: 'tesouraria' },
                { label: 'Emitir Carta',      sub: 'Secretaria',    icon: '📄', href: '/secretaria/cartas',       modulo: 'secretaria' },
                { label: 'Chamada EBD',       sub: 'EBD',           icon: '📚', href: '/secretaria/ebd/chamada',  modulo: 'ebd'        },
                { label: 'Novo Usuário',      sub: 'Administração', icon: '🔑', href: '/usuarios',                modulo: 'usuarios'   },
              ].filter(item => userCtx.podeAcessar(item.modulo)).map(item => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition text-left group"
                >
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 group-hover:text-[#123b63] truncate">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.sub}</p>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
