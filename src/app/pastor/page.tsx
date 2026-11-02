'use client';

/**
 * /pastor — Tela Início do App do Pastor (Pixel-Perfect)
 *
 * Reconstrução rigorosa com base no mockup oficial de referência visual:
 * - Fundo: composição com /img/bg_pastor.png, igreja iluminada, onda dourada e Bíblia aberta.
 * - Cabeçalho: Gestão Eklésia (dourado/branco), sininho de notificações (44x44px) com badge real.
 * - Identificação ministerial: foto oficial do tenant (logo_url dinâmico), saudação, nome do ministério, cápsula dourada de competência.
 * - Resumo Executivo: 2x2 cards com geometria idêntica (178x126px aprox), ícones estilizados, dados reais.
 * - Resumo do Mês: container card branco/off-white com bordas arredondadas e card interno.
 * - Pendências: lista com badge circular dourado (26x26px) e chevron.
 * - Bíblia aberta ao fundo iluminando rusticidade de madeira.
 * - Barra inferior fixa com 5 abas (68px + safe-area).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import { resolveNivel, temAcesso } from '@/lib/access-control';
import PastorBottomNav from '@/components/pastor/PastorBottomNav';
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Users,
  DollarSign,
  Heart,
  ChevronRight,
  ChevronDown,
  Bell,
  RefreshCw,
  Lock,
  Calendar,
  FileText,
  BarChart2,
  Church,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DashboardData {
  ok: boolean;
  periodo: { mes: number; ano: number; label: string };
  pendencias: { total: number; dirigentes: number; cartas: number; agenda: number };
  membrosAtivos: number;
  financeiro: { saldoMes: number; entradaMes: number; saidaMes: number };
  indicadoresEspirituais: {
    temDados: boolean;
    almasAlcancadas: number;
    reconciliacoes: number;
    batismosEspiritoSanto: number;
    visitantesPresentes: number;
    cultosRealizados: number;
    statusFechamento: string;
    periodo: { label: string };
    comparativoMesAnterior?: {
      temDadosAnterior: boolean;
      almasVarPct: number | null;
    };
  } | null;
  ministerio: { nome: string; cidade: string; logoUrl: string | null };
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function PastorInicioPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [authState, setAuthState] = useState<
    'loading' | 'authorized' | 'unauthorized' | 'forbidden' | 'plan_required'
  >('loading');
  const [userName, setUserName] = useState<string>('Pastor');
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);

  // 1. Verificar autenticação e permissões
  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session) {
          setAuthState('unauthorized');
          return;
        }

        setToken(session.access_token);

        const metadataName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email?.split('@')[0] ||
          'Pastor';
        setUserName(metadataName.split(' ')[0]);

        // Busca perfil do usuário em ministry_users
        const { data: mu } = await supabase
          .from('ministry_users')
          .select('role, permissions, ministry_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;

        let hasAccess = false;
        let minId = mu?.ministry_id;

        if (mu) {
          const nivel = resolveNivel(mu.role, mu.permissions);
          if (nivel === 'presidencia' || nivel === 'administrador' || (nivel && temAcesso(nivel, 'presidencia'))) {
            hasAccess = true;
          }
        }

        // Fallback para proprietário direto
        if (!hasAccess) {
          const { data: ownedMinistry } = await supabase
            .from('ministries')
            .select('id, logo_url')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (ownedMinistry) {
            hasAccess = true;
            minId = ownedMinistry.id;
            if (ownedMinistry.logo_url) {
              setTenantLogo(ownedMinistry.logo_url);
            }
          }
        }

        // Se tem ministry_id, busca logo oficial dinamicamente
        if (minId && !tenantLogo) {
          const { data: minData } = await supabase
            .from('ministries')
            .select('logo_url')
            .eq('id', minId)
            .maybeSingle();
          if (!cancelled && minData?.logo_url) {
            setTenantLogo(minData.logo_url);
          }
        }

        if (cancelled) return;

        if (!hasAccess) {
          setAuthState('forbidden');
          return;
        }

        setAuthState('authorized');
      } catch {
        if (!cancelled) setAuthState('unauthorized');
      }
    }
    checkAuth();
    return () => { cancelled = true; };
  }, [supabase, tenantLogo]);

  // 2. Carregar dados consolidados do dashboard oficial
  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const res = await fetch('/api/v1/pastor/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (res.status === 401) {
        setAuthState('unauthorized');
        setDataError('Sessão expirada. Faça login novamente.');
        return;
      }
      if (res.status === 403) {
        const errJson = await res.json().catch(() => null);
        if (errJson?.code === 'PLAN_REQUIRED' || errJson?.error?.includes('Módulo Presidencial')) {
          setAuthState('plan_required');
        } else {
          setAuthState('forbidden');
        }
        return;
      }
      if (!res.ok) {
        setDataError('Erro ao carregar dados. Tente novamente.');
        return;
      }

      const json: DashboardData = await res.json();
      setData(json);
      if (json.ministerio?.logoUrl) {
        setTenantLogo(json.ministerio.logoUrl);
      }
    } catch {
      setDataError('Sem conexão. Verifique sua rede e tente novamente.');
    } finally {
      setDataLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authState === 'authorized' && token) {
      loadDashboard();
    }
  }, [authState, token, loadDashboard]);

  // ─── Estados de Acesso / Loading ──────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#071326] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <BookOpen size={28} className="text-amber-400" />
        </div>
        <Loader2 size={24} className="text-amber-400 animate-spin" />
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    );
  }

  if (authState === 'unauthorized') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#071326] gap-4 px-8 text-center">
        <Lock size={40} className="text-slate-500" />
        <h2 className="text-lg font-bold text-white">Acesso Necessário</h2>
        <p className="text-sm text-slate-400">Faça login para acessar o App do Pastor.</p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 bg-amber-500 hover:bg-amber-400 text-[#071326] font-bold px-8 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer min-h-[44px]"
        >
          Fazer Login
        </button>
      </div>
    );
  }

  if (authState === 'forbidden') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#071326] gap-4 px-8 text-center">
        <Lock size={40} className="text-rose-500" />
        <h2 className="text-lg font-bold text-white">Acesso Restrito</h2>
        <p className="text-sm text-slate-400">
          O App do Pastor é exclusivo para <span className="text-amber-400 font-semibold">Presidência</span> e{' '}
          <span className="text-amber-400 font-semibold">Administradores</span>.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-8 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer min-h-[44px]"
        >
          Ir para o ERP
        </button>
      </div>
    );
  }

  if (authState === 'plan_required') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#071326] gap-4 px-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <BookOpen size={28} className="text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Plano Incompatível</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          O App do Pastor requer o <span className="text-amber-400 font-semibold">Módulo Presidencial</span> ativo no plano da sua igreja.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={() => router.push('/dashboard/planos')}
            className="bg-amber-500 hover:bg-amber-400 text-[#071326] font-bold px-6 py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer text-sm min-h-[44px]"
          >
            Conhecer Planos
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer text-sm min-h-[44px]"
          >
            Ir para o ERP
          </button>
        </div>
      </div>
    );
  }

  // ─── Render Principal (Mobile-First Pixel-Perfect) ──────────────────────────

  const saldoFormatado = data
    ? (data.financeiro.saldoMes < 0 ? '-' : '') +
      formatBRL(Math.abs(data.financeiro.saldoMes))
    : 'R$ 0,00';

  const periodoLabel = data?.periodo?.label || 'Novembro/2026';
  const totalPendencias = data?.pendencias?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#061224] text-slate-100 flex justify-center select-none antialiased">
      {/* Container Mobile Centralizado limitado a 430px */}
      <div className="relative w-full max-w-[430px] min-h-screen flex flex-col pb-28 overflow-x-hidden">

        {/* ── CAMADA DE BACKGROUND VISUAL RESPONSIVA ── */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Fundo escuro azul-marinho base */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#061328] via-[#091b36] to-[#050e1d]" />

          {/* Igreja iluminada no canto superior direito */}
          <div className="absolute top-0 right-0 w-[240px] h-[210px] sm:w-[260px] sm:h-[230px]">
            <Image
              src="/img/pastor_church_header_blend.png"
              alt="Igreja Iluminada"
              fill
              priority
              className="object-cover object-right-top opacity-95"
            />
          </div>

          {/* Curva dourada (golden wave) separadora sob o cabeçalho */}
          <div className="absolute top-[160px] left-0 right-0 h-[45px]">
            <Image
              src="/img/pastor_gold_wave_blend.png"
              alt="Onda Dourada"
              fill
              className="object-cover object-center opacity-85"
            />
          </div>

          {/* Bíblia sagrada aberta sobre a mesa no rodapé inferior */}
          <div className="absolute bottom-[60px] left-0 right-0 h-[220px]">
            <Image
              src="/img/pastor_bible_footer_blend.png"
              alt="Bíblia Aberta"
              fill
              className="object-cover object-bottom opacity-90"
            />
          </div>
        </div>

        {/* ── CONTEÚDO DA APLICAÇÃO (Sobreposto com z-10) ── */}
        <div className="relative z-10 flex-1 flex flex-col">

          {/* ── 1. CABEÇALHO SUPERIOR (Marca + Notificações) ── */}
          <header
            className="flex items-center justify-between px-4 pt-4"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}
          >
            {/* Logo Marca Gestão Eklésia */}
            <div className="flex items-center gap-2.5">
              <div className="relative w-[38px] h-[38px] shrink-0">
                <Image
                  src="/img/brand_symbol_gold_transparent.png"
                  alt="Gestão Eklésia"
                  width={38}
                  height={38}
                  priority
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[17px] font-bold text-[#eab308] tracking-tight leading-none">
                  Gestão Eklésia
                </span>
                <span className="text-[13px] font-medium text-white/90 leading-tight mt-0.5">
                  App do Pastor
                </span>
              </div>
            </div>

            {/* Botão de Notificações Circular (44x44px) */}
            <button
              onClick={() => router.push('/pastor/mais')}
              className="relative w-[44px] h-[44px] rounded-full bg-[#1e293b]/70 border border-slate-700/60 backdrop-blur-md flex items-center justify-center text-slate-200 hover:text-white active:scale-95 transition-all cursor-pointer shadow-md"
              aria-label="Notificações"
            >
              <Bell size={20} />
              {totalPendencias > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#1e293b]" />
              )}
            </button>
          </header>

          {/* ── 2. IDENTIFICAÇÃO DINÂMICA DO MINISTÉRIO ── */}
          <section className="px-4 pt-5 pb-3">
            <div className="flex items-center gap-3.5">
              {/* Logo Oficial do Tenant (Circular 64x64 com borda dourada de 2px) */}
              <div className="relative w-[64px] h-[64px] rounded-full overflow-hidden border-2 border-[#f59e0b] shadow-lg shrink-0 bg-[#0d1e38] flex items-center justify-center">
                {tenantLogo ? (
                  <Image
                    src={tenantLogo}
                    alt={data?.ministerio.nome || 'Logo do Ministério'}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <Church size={30} className="text-[#f59e0b]" />
                )}
              </div>

              {/* Textos: Saudação, Nome do Ministério e Cápsula de Competência */}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <span className="text-[13px] font-normal text-slate-300 leading-tight">
                  {saudacao()}, {userName}!
                </span>
                <h1 className="text-[20px] font-bold text-white tracking-tight leading-tight line-clamp-2 mt-0.5">
                  {data?.ministerio.nome || 'Ministério'}
                </h1>

                {/* Cápsula de Competência Dourada */}
                <div className="mt-2 inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-[#1a2b47]/80 border border-[#f59e0b]/60 backdrop-blur-sm shadow-sm cursor-pointer hover:border-[#f59e0b] transition-all">
                  <Calendar size={13} className="text-[#f59e0b]" />
                  <span className="text-[12px] font-semibold text-white">
                    {periodoLabel}
                  </span>
                  <ChevronDown size={14} className="text-[#f59e0b] ml-0.5" />
                </div>
              </div>
            </div>
          </section>

          {/* ── 3. RESUMO EXECUTIVO (Título + Grid 2x2) ── */}
          <section className="px-3 pt-4">
            {/* Título e Subtítulo */}
            <div className="px-1 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="text-[#f59e0b]">
                  <BarChart2 size={22} className="stroke-[2.5]" />
                </div>
                <h2 className="text-[22px] font-bold text-white tracking-tight leading-none">
                  Resumo Executivo
                </h2>
              </div>
              <p className="text-[13px] font-normal text-sky-200/80 mt-1 pl-7 leading-tight">
                Visão geral do seu ministério neste mês
              </p>
            </div>

            {/* Estados de Erro / Carregando */}
            {dataError && !dataLoading && (
              <div className="mb-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-rose-300 text-xs">
                  <AlertCircle size={16} />
                  <span>{dataError}</span>
                </div>
                <button
                  onClick={loadDashboard}
                  className="text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1"
                >
                  <RefreshCw size={13} /> Tentar
                </button>
              </div>
            )}

            {/* Grid 2 colunas x 2 linhas */}
            <div className="grid grid-cols-2 gap-2.5">

              {/* CARD 1: PENDÊNCIAS */}
              <button
                onClick={() => router.push('/pastor/decisoes')}
                className="group relative rounded-[16px] p-3 text-left border border-[#f59e0b]/25 bg-gradient-to-br from-[#1b2b48]/90 to-[#101e35]/90 backdrop-blur-md shadow-lg active:scale-[0.98] transition-all min-h-[124px] flex flex-col justify-between"
              >
                {/* Linha Superior: Ícone Amber + Número + Chevron */}
                <div className="flex items-center justify-between">
                  <div className="w-[40px] h-[40px] rounded-[12px] bg-[#d97706]/25 border border-[#f59e0b]/40 flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-[#fbbf24]" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[25px] font-extrabold text-white leading-none tracking-tight">
                      {dataLoading ? '...' : (data ? String(totalPendencias) : '—')}
                    </span>
                    <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Linha Inferior: Título e Descrição */}
                <div className="mt-2">
                  <p className="text-[13px] font-bold text-white leading-tight">
                    Pendências
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 leading-tight mt-0.5">
                    Para deliberar
                  </p>
                </div>
              </button>

              {/* CARD 2: MEMBROS */}
              <button
                onClick={() => router.push('/pastor/indicadores')}
                className="group relative rounded-[16px] p-3 text-left border border-[#3b82f6]/25 bg-gradient-to-br from-[#12284c]/90 to-[#0c1c38]/90 backdrop-blur-md shadow-lg active:scale-[0.98] transition-all min-h-[124px] flex flex-col justify-between"
              >
                {/* Linha Superior: Ícone Azul + Número + Chevron */}
                <div className="flex items-center justify-between">
                  <div className="w-[40px] h-[40px] rounded-[12px] bg-[#2563eb]/25 border border-[#3b82f6]/40 flex items-center justify-center shrink-0">
                    <Users size={20} className="text-[#60a5fa]" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[25px] font-extrabold text-white leading-none tracking-tight">
                      {dataLoading ? '...' : (data ? formatCompact(data.membrosAtivos) : '—')}
                    </span>
                    <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Linha Inferior: Título e Descrição */}
                <div className="mt-2">
                  <p className="text-[13px] font-bold text-white leading-tight">
                    Membros
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 leading-tight mt-0.5">
                    Membros cadastrados
                  </p>
                </div>
              </button>

              {/* CARD 3: SALDO DO MÊS */}
              <button
                onClick={() => router.push('/pastor/financeiro')}
                className="group relative rounded-[16px] p-3 text-left border border-[#10b981]/25 bg-gradient-to-br from-[#0c3128]/90 to-[#07221c]/90 backdrop-blur-md shadow-lg active:scale-[0.98] transition-all min-h-[124px] flex flex-col justify-between"
              >
                {/* Linha Superior: Ícone Moedas + Saldo + Chevron */}
                <div className="flex items-center justify-between">
                  <div className="w-[40px] h-[40px] rounded-[12px] bg-[#059669]/25 border border-[#10b981]/40 flex items-center justify-center shrink-0">
                    <DollarSign size={20} className="text-[#34d399]" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[21px] sm:text-[23px] font-extrabold text-white leading-none tracking-tight">
                      {dataLoading ? '...' : saldoFormatado}
                    </span>
                    <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Linha Inferior: Título e Descrição */}
                <div className="mt-2">
                  <p className="text-[13px] font-bold text-white leading-tight">
                    Saldo do mês
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 leading-tight mt-0.5">
                    Entradas – Saídas
                  </p>
                </div>
              </button>

              {/* CARD 4: ALMAS ALCANÇADAS */}
              <button
                onClick={() => router.push('/pastor/indicadores')}
                className="group relative rounded-[16px] p-3 text-left border border-[#e11d48]/25 bg-gradient-to-br from-[#3b172a]/90 to-[#290e1c]/90 backdrop-blur-md shadow-lg active:scale-[0.98] transition-all min-h-[124px] flex flex-col justify-between"
              >
                {/* Linha Superior: Ícone Coração + Almas + Chevron */}
                <div className="flex items-center justify-between">
                  <div className="w-[40px] h-[40px] rounded-[12px] bg-[#be123c]/25 border border-[#f43f5e]/40 flex items-center justify-center shrink-0">
                    <Heart size={20} className="text-[#fb7185]" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[25px] font-extrabold text-white leading-none tracking-tight">
                      {dataLoading
                        ? '...'
                        : (data?.indicadoresEspirituais?.temDados
                            ? String(data.indicadoresEspirituais.almasAlcancadas)
                            : '—')}
                    </span>
                    <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Linha Inferior: Título e Descrição */}
                <div className="mt-2">
                  <p className="text-[13px] font-bold text-white leading-tight">
                    Almas alcançadas
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 leading-tight mt-0.5">
                    No mês
                  </p>
                </div>
              </button>

            </div>
          </section>

          {/* ── 4. RESUMO DO MÊS (Card Branco/Off-White com Inner Card) ── */}
          <section className="px-3 pt-5">
            <div className="rounded-[18px] bg-gradient-to-b from-[#f8fafc] to-[#eef2f6] text-[#0f172a] p-3.5 shadow-xl border border-white">
              {/* Cabeçalho do Card */}
              <div className="flex items-center justify-between pb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart2 size={18} className="text-[#d97706] stroke-[2.5]" />
                  <h3 className="text-[17px] font-bold text-[#0c1a30] tracking-tight leading-none">
                    Resumo do Mês
                  </h3>
                </div>
                <span className="text-[12px] font-medium text-slate-500">
                  {periodoLabel}
                </span>
              </div>

              {/* Card Interno Interativo */}
              <button
                onClick={() => router.push('/pastor/indicadores')}
                className="w-full mt-1 rounded-[14px] bg-[#f0fdf4]/80 border border-emerald-200/80 p-3 flex items-center justify-between gap-3 text-left hover:bg-[#dcfce7]/80 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[40px] h-[40px] rounded-[10px] bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-300">
                    <BarChart2 size={20} className="text-emerald-600 stroke-[2.5]" />
                  </div>
                  <div>
                    {data?.indicadoresEspirituais?.temDados ? (
                      <>
                        <p className="text-[14px] font-bold text-[#064e3b] leading-tight">
                          {data.indicadoresEspirituais.almasAlcancadas} almas alcançadas
                        </p>
                        <p className="text-[12px] font-medium text-slate-600 leading-tight mt-0.5">
                          {data.indicadoresEspirituais.cultosRealizados} cultos realizados
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[14px] font-bold text-slate-900 leading-tight">
                          Sem registros consolidados
                        </p>
                        <p className="text-[12px] font-normal text-slate-500 leading-tight mt-0.5">
                          Acolhimento ainda não registrado
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </button>
            </div>
          </section>

          {/* ── 5. SEÇÃO DE PENDÊNCIAS ── */}
          <section className="px-3 pt-5 pb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <FileText size={19} className="text-[#f59e0b]" />
                <h3 className="text-[20px] font-bold text-white tracking-tight leading-none">
                  Pendências
                </h3>
              </div>
              <button
                onClick={() => router.push('/pastor/decisoes')}
                className="text-[13px] font-semibold text-[#f59e0b] hover:text-[#fbbf24] flex items-center gap-0.5 cursor-pointer active:scale-95 transition-all"
              >
                Ver todas <ChevronRight size={14} />
              </button>
            </div>

            {/* Lista de Pendências Reais */}
            <div className="space-y-2.5">
              {data && data.pendencias.cartas > 0 && (
                <button
                  onClick={() => router.push('/pastor/decisoes')}
                  className="w-full min-h-[62px] bg-[#111e35]/85 rounded-[14px] p-3 border border-slate-700/50 backdrop-blur-md flex items-center justify-between gap-3 hover:border-slate-600/70 active:scale-[0.99] transition-all cursor-pointer shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] rounded-[12px] bg-purple-600/25 border border-purple-500/40 flex items-center justify-center shrink-0">
                      <FileText size={20} className="text-purple-300" />
                    </div>
                    <span className="text-[14px] font-semibold text-white tracking-tight">
                      Cartas Ministeriais
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[26px] h-[26px] rounded-full bg-[#f59e0b] text-[#071326] text-[12px] font-black flex items-center justify-center shadow-md">
                      {data.pendencias.cartas}
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </button>
              )}

              {data && data.pendencias.dirigentes > 0 && (
                <button
                  onClick={() => router.push('/pastor/decisoes')}
                  className="w-full min-h-[62px] bg-[#111e35]/85 rounded-[14px] p-3 border border-slate-700/50 backdrop-blur-md flex items-center justify-between gap-3 hover:border-slate-600/70 active:scale-[0.99] transition-all cursor-pointer shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] rounded-[12px] bg-blue-600/25 border border-blue-500/40 flex items-center justify-center shrink-0">
                      <Users size={20} className="text-blue-300" />
                    </div>
                    <span className="text-[14px] font-semibold text-white tracking-tight">
                      Propostas de Dirigentes
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[26px] h-[26px] rounded-full bg-[#f59e0b] text-[#071326] text-[12px] font-black flex items-center justify-center shadow-md">
                      {data.pendencias.dirigentes}
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </button>
              )}

              {data && data.pendencias.agenda > 0 && (
                <button
                  onClick={() => router.push('/pastor/decisoes')}
                  className="w-full min-h-[62px] bg-[#111e35]/85 rounded-[14px] p-3 border border-slate-700/50 backdrop-blur-md flex items-center justify-between gap-3 hover:border-slate-600/70 active:scale-[0.99] transition-all cursor-pointer shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-[40px] h-[40px] rounded-[12px] bg-emerald-600/25 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <Calendar size={20} className="text-emerald-300" />
                    </div>
                    <span className="text-[14px] font-semibold text-white tracking-tight">
                      Solicitações de Agenda
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-[26px] h-[26px] rounded-full bg-[#f59e0b] text-[#071326] text-[12px] font-black flex items-center justify-center shadow-md">
                      {data.pendencias.agenda}
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </button>
              )}

              {/* Se não houver pendências ativas */}
              {data && totalPendencias === 0 && (
                <div className="w-full bg-[#111e35]/60 rounded-[14px] p-4 border border-slate-700/30 text-center">
                  <p className="text-[13px] font-medium text-slate-400">
                    Nenhuma pendência para deliberação no momento.
                  </p>
                </div>
              )}
            </div>
          </section>

        </div>

        {/* ── 6. NAVEGAÇÃO INFERIOR FIXA (5 Abas) ── */}
        <PastorBottomNav />

      </div>
    </div>
  );
}
