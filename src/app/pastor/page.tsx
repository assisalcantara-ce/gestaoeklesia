'use client';

/**
 * /pastor — Tela Início do App do Pastor
 *
 * Dashboard executivo mobile-first para presidência.
 * Consome exclusivamente /api/v1/pastor/dashboard (dados reais).
 * Acesso restrito: presidencia/administrador com has_modulo_presidencial.
 * Design: navy/dourado, 4 cards executivos, resumo mensal, bottom nav.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import PastorBottomNav from '@/components/pastor/PastorBottomNav';
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Users,
  DollarSign,
  Heart,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  RefreshCw,
  Lock,
  Church,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  ministerio: { nome: string; cidade: string };
}

// ─── Utils ────────────────────────────────────────────────────────────────────

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

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function VarBadge({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return null;
  if (pct > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
        <TrendingUp size={11} />
        +{pct}%
      </span>
    );
  if (pct < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-400">
        <TrendingDown size={11} />
        {pct}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
      <Minus size={11} />
      0%
    </span>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
  badge?: React.ReactNode;
  onClick?: () => void;
}

function MetricCard({ icon, iconBg, label, value, sub, badge, onClick }: MetricCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-[#111e35]/80 rounded-2xl p-4 border border-slate-700/40 flex flex-col gap-3 text-left hover:border-slate-600/60 active:scale-[0.97] transition-all cursor-pointer w-full backdrop-blur-sm"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-400 leading-tight">{label}</p>
        <p className="text-2xl font-black text-white leading-tight mt-0.5 truncate">{value}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <p className="text-[10px] text-slate-500 leading-tight">{sub}</p>
          {badge}
        </div>
      </div>
    </button>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function PastorInicioPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [authState, setAuthState] = useState<'loading' | 'authorized' | 'unauthorized' | 'forbidden'>('loading');
  const [userName, setUserName] = useState<string>('Pastor');
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // 1. Verificar autenticação e permissão
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

        // Busca perfil do usuário para verificar role no cliente
        const { data: mu } = await supabase
          .from('ministry_users')
          .select('role, display_name')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;

        const role = String(mu?.role || '').toLowerCase();
        if (!['presidencia', 'administrador'].includes(role)) {
          setAuthState('forbidden');
          return;
        }

        // Busca nome de exibição
        const nome = mu?.display_name || session.user.email?.split('@')[0] || 'Pastor';
        setUserName(nome.split(' ')[0]);
        setAuthState('authorized');
      } catch {
        if (!cancelled) setAuthState('unauthorized');
      }
    }
    checkAuth();
    return () => { cancelled = true; };
  }, [supabase]);

  // 2. Carregar dados do dashboard quando autorizado
  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const res = await fetch('/api/v1/pastor/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (res.status === 401) { setDataError('Sessão expirada. Faça login novamente.'); return; }
      if (res.status === 403) { setDataError('Acesso negado. Este recurso requer o Módulo Presidencial.'); return; }
      if (!res.ok) { setDataError('Erro ao carregar dados. Tente novamente.'); return; }

      const json: DashboardData = await res.json();
      setData(json);
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

  // ─── Estados de Auth ───────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0a1628] gap-4">
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
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0a1628] gap-4 px-8 text-center">
        <Lock size={40} className="text-slate-500" />
        <h2 className="text-lg font-bold text-white">Acesso Necessário</h2>
        <p className="text-sm text-slate-400">Faça login para acessar o App do Pastor.</p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 bg-amber-500 hover:bg-amber-400 text-[#0a1628] font-bold px-8 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer"
        >
          Fazer Login
        </button>
      </div>
    );
  }

  if (authState === 'forbidden') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0a1628] gap-4 px-8 text-center">
        <Lock size={40} className="text-rose-500" />
        <h2 className="text-lg font-bold text-white">Acesso Restrito</h2>
        <p className="text-sm text-slate-400">
          O App do Pastor é exclusivo para <span className="text-amber-400 font-semibold">Presidência</span> e{' '}
          <span className="text-amber-400 font-semibold">Administradores</span>.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-8 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer"
        >
          Ir para o ERP
        </button>
      </div>
    );
  }

  // ─── Interface Principal ───────────────────────────────────────────────────

  const almasVarPct = data?.indicadoresEspirituais?.comparativoMesAnterior?.almasVarPct ?? null;
  const saldoPositivo = (data?.financeiro.saldoMes ?? 0) >= 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a1628] text-slate-100 pb-24 select-none">

      {/* ── Header ── */}
      <header className="relative overflow-hidden">
        {/* Gradiente de fundo */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1f3c] via-[#0f2444] to-[#0a1628] z-0" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none z-0" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/5 rounded-full blur-3xl pointer-events-none z-0" />

        <div
          className="relative z-10 flex items-start justify-between px-5 pt-safe"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}
        >
          {/* Logo + Título */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-900/40 flex items-center justify-center shrink-0">
              <BookOpen size={22} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest leading-tight">
                Gestão Eklésia
              </p>
              <h1 className="text-sm font-black text-white leading-tight">
                App do Pastor
              </h1>
            </div>
          </div>

          {/* Notificações */}
          <button
            onClick={() => router.push('/pastor/mais')}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:border-white/20 transition-all active:scale-95 cursor-pointer"
            title="Mais opções"
          >
            <Bell size={18} />
          </button>
        </div>

        {/* Banner ministerial */}
        <div className="relative z-10 px-5 pt-4 pb-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a2f50] to-[#0f1e35] border border-white/10 shadow-xl">
            {/* Decoração */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 p-5 flex items-center gap-4">
              {/* Ícone da Igreja */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Church size={28} className="text-amber-400" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider leading-tight">
                  {saudacao()}, {userName}!
                </p>
                <h2 className="text-base font-black text-white leading-tight truncate">
                  {data?.ministerio.nome || 'Ministério'}
                </h2>
                {data?.ministerio.cidade && (
                  <p className="text-xs text-slate-400 leading-tight mt-0.5 truncate">
                    {data.ministerio.cidade}
                  </p>
                )}
                {data?.periodo && (
                  <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    {data.periodo.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <main className="flex-1 px-5 space-y-6">

        {/* Estado de erro nos dados */}
        {dataError && !dataLoading && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
            <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-rose-300">{dataError}</p>
            </div>
            <button
              onClick={loadDashboard}
              className="shrink-0 text-rose-400 hover:text-rose-300 cursor-pointer"
              title="Tentar novamente"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        )}

        {/* Skeleton / Loading dos dados */}
        {dataLoading && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-[#111e35]/60 rounded-2xl p-4 border border-slate-700/30 h-32 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ── 4 Cards Executivos ── */}
        {!dataLoading && (
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Resumo Executivo
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {/* Card 1: Pendências */}
              <MetricCard
                icon={<AlertCircle size={20} className="text-amber-400" />}
                iconBg="bg-amber-500/15 border border-amber-500/25"
                label="Pendências"
                value={data ? String(data.pendencias.total) : '—'}
                sub="Para deliberar"
                onClick={() => router.push('/pastor/decisoes')}
              />

              {/* Card 2: Membros */}
              <MetricCard
                icon={<Users size={20} className="text-blue-400" />}
                iconBg="bg-blue-500/15 border border-blue-500/25"
                label="Membros"
                value={data ? formatCompact(data.membrosAtivos) : '—'}
                sub="Membros cadastrados"
                onClick={() => router.push('/membros')}
              />

              {/* Card 3: Saldo do mês */}
              <MetricCard
                icon={<DollarSign size={20} className={saldoPositivo ? 'text-emerald-400' : 'text-rose-400'} />}
                iconBg={saldoPositivo
                  ? 'bg-emerald-500/15 border border-emerald-500/25'
                  : 'bg-rose-500/15 border border-rose-500/25'
                }
                label="Saldo do mês"
                value={data
                  ? (data.financeiro.saldoMes >= 0 ? '' : '-') +
                    formatBRL(Math.abs(data.financeiro.saldoMes)).replace('R$', 'R$\u00A0')
                  : '—'
                }
                sub="Entradas – Saídas"
                onClick={() => router.push('/pastor/financeiro')}
              />

              {/* Card 4: Almas alcançadas */}
              <MetricCard
                icon={<Heart size={20} className="text-rose-400" />}
                iconBg="bg-rose-500/15 border border-rose-500/25"
                label="Almas alcançadas"
                value={
                  data
                    ? data.indicadoresEspirituais?.temDados
                      ? String(data.indicadoresEspirituais.almasAlcancadas)
                      : '—'
                    : '—'
                }
                sub="No mês"
                badge={
                  data?.indicadoresEspirituais?.temDados ? (
                    <VarBadge pct={almasVarPct} />
                  ) : undefined
                }
                onClick={() => router.push('/pastor/indicadores')}
              />
            </div>
          </section>
        )}

        {/* ── Resumo do Mês ── */}
        {!dataLoading && data && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Resumo do Mês
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                {data.periodo.label}
              </span>
            </div>

            <div
              onClick={() => router.push('/pastor/indicadores')}
              className="bg-[#111e35]/80 rounded-2xl p-4 border border-slate-700/40 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-600/60 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <TrendingUp size={20} className="text-emerald-400" />
                </div>
                <div>
                  {data.indicadoresEspirituais?.temDados ? (
                    <>
                      {almasVarPct !== null && almasVarPct > 0 ? (
                        <p className="text-sm font-bold text-emerald-400">
                          +{almasVarPct}% crescimento de membros
                        </p>
                      ) : almasVarPct !== null && almasVarPct < 0 ? (
                        <p className="text-sm font-bold text-rose-400">
                          {almasVarPct}% vs. mês anterior
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-slate-300">
                          {data.indicadoresEspirituais?.almasAlcancadas ?? 0} almas alcançadas
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {data.indicadoresEspirituais?.cultosRealizados ?? 0} cultos •{' '}
                        {data.indicadoresEspirituais?.reconciliacoes ?? 0} reconciliações
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-400">
                        Sem registros consolidados
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Acolhimento ainda não registrado
                      </p>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-500 shrink-0" />
            </div>
          </section>
        )}

        {/* ── Pendências por Tipo ── */}
        {!dataLoading && data && data.pendencias.total > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Pendências
              </h2>
              <button
                onClick={() => router.push('/pastor/decisoes')}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 cursor-pointer"
              >
                Ver todas <ChevronRight size={13} />
              </button>
            </div>

            <div className="space-y-2">
              {data.pendencias.dirigentes > 0 && (
                <PendingRow
                  label="Propostas de Dirigentes"
                  count={data.pendencias.dirigentes}
                  onClick={() => router.push('/pastor/decisoes')}
                />
              )}
              {data.pendencias.cartas > 0 && (
                <PendingRow
                  label="Cartas Ministeriais"
                  count={data.pendencias.cartas}
                  onClick={() => router.push('/pastor/decisoes')}
                />
              )}
              {data.pendencias.agenda > 0 && (
                <PendingRow
                  label="Solicitações de Agenda"
                  count={data.pendencias.agenda}
                  onClick={() => router.push('/pastor/decisoes')}
                />
              )}
            </div>
          </section>
        )}

        {/* ── Estado Vazio (sem dados) ── */}
        {!dataLoading && !dataError && !data && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
              <Church size={28} className="text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-400">
              Nenhum dado disponível
            </p>
            <button
              onClick={loadDashboard}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} /> Recarregar
            </button>
          </div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <PastorBottomNav />
    </div>
  );
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────

function PendingRow({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-[#111e35]/60 rounded-xl p-3.5 border border-slate-700/30 flex items-center justify-between gap-3 hover:border-slate-600/50 active:scale-[0.99] transition-all cursor-pointer"
    >
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-black text-white bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full">
          {count}
        </span>
        <ChevronRight size={16} className="text-slate-500" />
      </div>
    </button>
  );
}
