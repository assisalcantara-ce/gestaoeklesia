'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useUserContext } from '@/hooks/useUserContext';
import { useAuth } from '@/providers/AuthProvider';
import { useCurrentMinistry } from '@/providers/CurrentMinistryProvider';
import { useAuditLog } from '@/hooks/useAuditLog';
import { createClient } from '@/lib/supabase-client';
import {
  PresidenciaService,
  type ProcessoDecisao,
  type PresidenciaResumo,
} from '@/services/presidencia-service';
import {
  DirigentesService,
  type UserContextAuth,
} from '@/services/dirigentes-service';
import type { CongregacaoLiderancaView } from '@/types/dirigentes';
import {
  Crown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  XCircle,
  FileText,
  Users,
  Building,
  Filter,
  Search,
  Eye,
  RefreshCw,
  Calendar,
  Check,
  X,
  FileCheck,
  Briefcase,
  ChevronRight,
  Coins,
  Scale,
} from 'lucide-react';

const INITIAL_RESUMO: PresidenciaResumo = {
  totalPendencias: 0,
  dirigentesPropostas: 0,
  dirigentesAprovadosAguardandoPosse: 0,
  cartasMudanca: 0,
  cartasDesligamento: 0,
  outrasCartas: 0,
  totalLiderancasAtivas: 0,
};

function formatDataPtBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTempoMandato(meses: number): string {
  if (meses <= 0) return 'Recém-empossado';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  if (restoMeses === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${anos}a ${restoMeses}m`;
}

export default function PresidenciaPage() {
  const { ctx, bloqueado } = useRequireModulo('presidencia');
  const planFeatures = usePlanFeatures();
  const userCtx = useUserContext();
  const { user } = useAuth();
  const { ministry: currentMinistry } = useCurrentMinistry();
  const { registrarAcao } = useAuditLog();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('fila-decisoes');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dados da Central
  const [fila, setFila] = useState<ProcessoDecisao[]>([]);
  const [resumo, setResumo] = useState<PresidenciaResumo>(INITIAL_RESUMO);

  // Histórico de resoluções
  const [historico, setHistorico] = useState<ProcessoDecisao[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Governança / Lideranças ativas
  const [liderancas, setLiderancas] = useState<CongregacaoLiderancaView[]>([]);
  const [loadingLiderancas, setLoadingLiderancas] = useState(false);

  // Filtros da Fila
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  // Modais de Ação
  const [modalDeliberarDirigente, setModalDeliberarDirigente] = useState<ProcessoDecisao | null>(null);
  const [modalEfetivarDirigente, setModalEfetivarDirigente] = useState<ProcessoDecisao | null>(null);
  const [modalDeliberarCarta, setModalDeliberarCarta] = useState<ProcessoDecisao | null>(null);
  const [modalDetalhesProcesso, setModalDetalhesProcesso] = useState<ProcessoDecisao | null>(null);

  // Estados de formulário dos modais
  const [justificativaDecisao, setJustificativaDecisao] = useState('');
  const [dataEfetiva, setDataEfetiva] = useState(new Date().toISOString().slice(0, 10));
  const [divergenciasPatrimonio, setDivergenciasPatrimonio] = useState('');
  const [observacoesEfetivacao, setObservacoesEfetivacao] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Notificações
  const [notif, setNotif] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showNotif = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setNotif({ isOpen: true, type, title, message });
  };

  const ministryId = currentMinistry?.id || userCtx.ministryId;

  // Monta objeto auth para os serviços institucionais
  const userAuth: UserContextAuth = useMemo(
    () => ({
      userId: userCtx.userId || user?.id || '',
      userName:
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        'Presidência Institucional',
      ministryId: ministryId || '',
      nivel: userCtx.nivel,
      isAdmin: userCtx.isAdmin,
    }),
    [userCtx, user, ministryId]
  );

  // Carrega dados da Fila de Decisões e Resumo
  const carregarCentral = useCallback(
    async (isManualRefresh = false) => {
      if (!ministryId) return;
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const { fila: filaRes, resumo: resumoRes } =
          await PresidenciaService.carregarCentralDecisoes(supabase, ministryId);
        setFila(filaRes);
        setResumo(resumoRes);
      } catch (err: any) {
        console.error('Erro ao carregar Central de Decisões:', err);
        showNotif('error', 'Falha ao Carregar', err.message || 'Erro ao consultar fila decisória.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase, ministryId]
  );

  // Carrega histórico quando aba é ativada
  const carregarHistorico = useCallback(async () => {
    if (!ministryId) return;
    setLoadingHistorico(true);
    try {
      const hist = await PresidenciaService.carregarHistoricoDecisoes(supabase, ministryId);
      setHistorico(hist);
    } catch (err: any) {
      console.error('Erro ao carregar histórico de deliberações:', err);
    } finally {
      setLoadingHistorico(false);
    }
  }, [supabase, ministryId]);

  // Carrega lideranças vigentes quando aba é ativada
  const carregarLiderancas = useCallback(async () => {
    if (!ministryId) return;
    setLoadingLiderancas(true);
    try {
      const lids = await DirigentesService.carregarVisaoGeral(supabase, ministryId);
      setLiderancas(lids);
    } catch (err: any) {
      console.error('Erro ao carregar governança de congregações:', err);
    } finally {
      setLoadingLiderancas(false);
    }
  }, [supabase, ministryId]);

  useEffect(() => {
    if (ministryId && !ctx.loading && !planFeatures.loading) {
      carregarCentral();
    }
  }, [ministryId, ctx.loading, planFeatures.loading, carregarCentral]);

  useEffect(() => {
    if (activeTab === 'historico' && historico.length === 0) {
      carregarHistorico();
    } else if (activeTab === 'governanca' && liderancas.length === 0) {
      carregarLiderancas();
    }
  }, [activeTab, historico.length, liderancas.length, carregarHistorico, carregarLiderancas]);

  // Filtro em memória da fila unificada
  const filaFiltrada = useMemo(() => {
    return fila.filter((proc) => {
      // 1. Filtro por Categoria / Status
      if (filtroCategoria === 'dirigente_proposta') {
        if (!(proc.origem === 'dirigente_movimentacao' && proc.status === 'proposta')) return false;
      } else if (filtroCategoria === 'dirigente_aprovado') {
        if (!(proc.origem === 'dirigente_movimentacao' && proc.status === 'aprovada')) return false;
      } else if (filtroCategoria === 'carta_mudanca') {
        if (proc.tipoCategoria !== 'carta_mudanca') return false;
      } else if (filtroCategoria === 'carta_desligamento') {
        if (proc.tipoCategoria !== 'carta_desligamento') return false;
      } else if (filtroCategoria === 'outras_cartas') {
        if (
          proc.origem !== 'carta_pedido' ||
          proc.tipoCategoria === 'carta_mudanca' ||
          proc.tipoCategoria === 'carta_desligamento'
        )
          return false;
      }

      // 2. Busca textual
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const matchPessoa = (proc.pessoaNome || '').toLowerCase().includes(q);
        const matchCong = (proc.congregacaoNome || '').toLowerCase().includes(q);
        const matchSolicitante = (proc.solicitanteNome || '').toLowerCase().includes(q);
        const matchTipo = (proc.tipoLabel || '').toLowerCase().includes(q);
        const matchCargo = (proc.pessoaCargo || '').toLowerCase().includes(q);
        if (!matchPessoa && !matchCong && !matchSolicitante && !matchTipo && !matchCargo) {
          return false;
        }
      }

      return true;
    });
  }, [fila, filtroCategoria, busca]);

  // ─── Ações da Presidência ──────────────────────────────────────────

  // 1. Deliberar Proposta de Dirigente (Aprovar / Rejeitar)
  const handleDeliberarProposta = async (decisao: 'aprovar' | 'rejeitar') => {
    if (!modalDeliberarDirigente) return;
    if (decisao === 'rejeitar' && !justificativaDecisao.trim()) {
      showNotif('warning', 'Justificativa Obrigatória', 'Informe o parecer/motivo do indeferimento institucional.');
      return;
    }

    setSubmittingAction(true);
    try {
      await PresidenciaService.deliberarPropostaDirigente(supabase, userAuth, {
        movimentacaoId: modalDeliberarDirigente.id,
        decisao,
        justificativa: justificativaDecisao.trim() || undefined,
      });

      await registrarAcao({
        acao: 'atualizar_status',
        modulo: 'presidencia',
        area: 'central_decisoes',
        tabela_afetada: 'dirigentes_movimentacoes',
        registro_id: modalDeliberarDirigente.id,
        descricao: `Presidência ${
          decisao === 'aprovar' ? 'aprovou' : 'rejeitou'
        } proposta de liderança para ${modalDeliberarDirigente.pessoaNome} na congregação ${
          modalDeliberarDirigente.congregacaoNome
        }`,
        dados_novos: {
          status: decisao === 'aprovar' ? 'aprovada' : 'rejeitada',
          justificativa: justificativaDecisao.trim() || null,
        },
        status: 'sucesso',
      });

      showNotif(
        'success',
        decisao === 'aprovar' ? 'Proposta Aprovada' : 'Proposta Indeferida',
        decisao === 'aprovar'
          ? 'A proposta foi homologada pela Presidência e agora aguarda a efetivação da posse e alinhamento patrimonial.'
          : 'A proposta foi rejeitada e a justificativa foi devidamente registrada.'
      );

      setModalDeliberarDirigente(null);
      setJustificativaDecisao('');
      carregarCentral();
      carregarHistorico();
    } catch (err: any) {
      console.error('Erro ao deliberar proposta de dirigente:', err);
      showNotif('error', 'Falha na Operação', err.message || 'Erro ao registrar decisão institucional.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // 2. Efetivar Posse de Dirigente (Execução Atômica e Histórico Ministerial)
  const handleEfetivarPosse = async () => {
    if (!modalEfetivarDirigente) return;
    if (!dataEfetiva) {
      showNotif('warning', 'Data Obrigatória', 'Informe a data real de posse/efetivação.');
      return;
    }

    setSubmittingAction(true);
    try {
      await PresidenciaService.efetivarPosseDirigente(supabase, userAuth, {
        movimentacaoId: modalEfetivarDirigente.id,
        dataEfetiva,
        divergenciasPatrimoniais: divergenciasPatrimonio.trim() || undefined,
        observacoes: observacoesEfetivacao.trim() || undefined,
      });

      await registrarAcao({
        acao: 'atualizar_status',
        modulo: 'presidencia',
        area: 'central_decisoes',
        tabela_afetada: 'dirigentes_movimentacoes',
        registro_id: modalEfetivarDirigente.id,
        descricao: `Presidência efetivou a posse ministerial de ${modalEfetivarDirigente.pessoaNome} na congregação ${modalEfetivarDirigente.congregacaoNome}`,
        dados_novos: {
          data_efetiva: dataEfetiva,
          divergencias_patrimoniais: divergenciasPatrimonio.trim() || null,
        },
        status: 'sucesso',
      });

      showNotif(
        'success',
        'Posse Ministerial Efetivada',
        'A movimentação foi concluída com sucesso. As designações ativas foram atualizadas e os registros de posse e saída foram gravados de forma atômica no histórico ministerial individual dos obreiros.'
      );

      setModalEfetivarDirigente(null);
      setDivergenciasPatrimonio('');
      setObservacoesEfetivacao('');
      carregarCentral();
      carregarHistorico();
      carregarLiderancas();
    } catch (err: any) {
      console.error('Erro ao efetivar posse de dirigente:', err);
      showNotif('error', 'Falha na Efetivação', err.message || 'Erro ao efetivar posse ministerial.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // 3. Deliberar Pedido de Carta Ministerial (Autorizar / Rejeitar)
  const handleDeliberarCarta = async (decisao: 'autorizar' | 'rejeitar') => {
    if (!modalDeliberarCarta) return;
    if (decisao === 'rejeitar' && !justificativaDecisao.trim()) {
      showNotif('warning', 'Motivo Obrigatório', 'Informe a justificativa do indeferimento da carta ministerial.');
      return;
    }

    setSubmittingAction(true);
    try {
      await PresidenciaService.deliberarCartaPedido(supabase, userAuth, {
        pedido_id: modalDeliberarCarta.id,
        decisao,
        motivo_rejeicao: justificativaDecisao.trim() || undefined,
      });

      await registrarAcao({
        acao: 'atualizar_status',
        modulo: 'presidencia',
        area: 'central_decisoes',
        tabela_afetada: 'carta_pedidos',
        registro_id: modalDeliberarCarta.id,
        descricao: `Presidência ${
          decisao === 'autorizar' ? 'autorizou e firmou' : 'rejeitou'
        } o pedido de ${modalDeliberarCarta.tipoLabel} para ${modalDeliberarCarta.pessoaNome}`,
        dados_novos: {
          status: decisao === 'autorizar' ? 'autorizado' : 'rejeitado',
          motivo_rejeicao: justificativaDecisao.trim() || null,
        },
        status: 'sucesso',
      });

      showNotif(
        'success',
        decisao === 'autorizar' ? 'Carta Autorizada e Firmada' : 'Pedido Indeferido',
        decisao === 'autorizar'
          ? 'A carta ministerial foi deferida pela Presidência e está liberada para emissão e impressão oficial pela Secretaria.'
          : 'O pedido de carta ministerial foi indeferido com justificativa registrada.'
      );

      setModalDeliberarCarta(null);
      setJustificativaDecisao('');
      carregarCentral();
      carregarHistorico();
    } catch (err: any) {
      console.error('Erro ao deliberar pedido de carta:', err);
      showNotif('error', 'Falha na Decisão', err.message || 'Erro ao processar deliberação da carta.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // ─── Telas de Bloqueio de Plano ou Permissão ───────────────────────

  if (ctx.loading || planFeatures.loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#123b63]" />
        <p className="text-sm font-medium">Carregando Central de Decisões Institucionais...</p>
      </div>
    );
  }

  if (!planFeatures.has_modulo_presidencial || !planFeatures.hasFeature('presidency_module')) {
    return (
      <PageLayout
        title="Presidência"
        description="Central de Decisões Institucionais e Governança Ministerial"
        activeMenu="presidencia-geral"
      >
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600 shadow-sm border border-red-200/60">
            <Crown className="w-8 h-8" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Profissional
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Presidência Indisponível no seu Plano</h2>
          </div>
          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A Central de Decisões Institucionais e Governança Ministerial está disponível nos planos corporativos.
          </p>
          <div className="pt-3">
            <Link
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos
            </Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (bloqueado) return null;

  const tabs = [
    {
      id: 'fila-decisoes',
      label: `Fila de Decisões (${resumo.totalPendencias})`,
      icon: '📋',
    },
    {
      id: 'historico',
      label: 'Histórico de Resoluções',
      icon: '📜',
    },
    {
      id: 'governanca',
      label: 'Corpo Pastoral & Dirigentes',
      icon: '👥',
    },
    {
      id: 'modulos',
      label: 'Módulos Institucionais',
      icon: '🏛️',
    },
  ];

  return (
    <PageLayout
      title="Central de Decisões Institucionais"
      description="Gabinete Presidencial — Homologação de Lideranças, Deliberações e Despachos Oficiais"
      activeMenu="presidencia-geral"
    >
      {/* ─── INDICADORES INSTITUCIONAIS REAIS (TOPO) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total de Decisões Pendentes */}
        <div
          className={`p-5 rounded-2xl border transition-all duration-200 shadow-xs flex items-center justify-between ${
            resumo.totalPendencias > 0
              ? 'bg-gradient-to-br from-amber-50/90 to-amber-100/50 border-amber-300/80 shadow-amber-500/10'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total de Pendências
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-3xl font-extrabold tracking-tight ${
                  resumo.totalPendencias > 0 ? 'text-amber-900' : 'text-slate-800'
                }`}
              >
                {resumo.totalPendencias}
              </span>
              <span className="text-xs font-medium text-slate-500">processos</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {resumo.totalPendencias > 0
                ? 'Exigem deliberação da Presidência'
                : 'Nenhum processo pendente'}
            </p>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              resumo.totalPendencias > 0
                ? 'bg-amber-200/80 text-amber-900'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {resumo.totalPendencias > 0 ? (
              <Clock className="w-6 h-6 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>
        </div>

        {/* Card 2: Propostas de Dirigentes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Propostas de Dirigentes
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-[#123b63]">
                {resumo.dirigentesPropostas}
              </span>
              <span className="text-xs font-medium text-slate-500">em análise</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Mudanças aguardando deliberação</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#123b63] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Dirigentes Aguardando Posse */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Aprovados Aguardando Posse
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-indigo-700">
                {resumo.dirigentesAprovadosAguardandoPosse}
              </span>
              <span className="text-xs font-medium text-slate-500">efetivação</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Termo patrimonial e data de posse</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Cartas Ministeriais Pendentes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cartas Ministeriais
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-amber-700">
                {resumo.cartasMudanca + resumo.cartasDesligamento + resumo.outrasCartas}
              </span>
              <span className="text-xs font-medium text-slate-500">assinatura</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {resumo.cartasMudanca} mudança • {resumo.cartasDesligamento} desligamento
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ─── ABAS DA CENTRAL DE DECISÕES ─── */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {/* ─── ABA 1: FILA UNIFICADA DE DECISÕES ─── */}
        {activeTab === 'fila-decisoes' && (
          <div className="space-y-5">
            {/* Barra de Filtros e Busca */}
            <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
              {/* Filtro de Categoria */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5" /> Filtrar:
                </span>
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'dirigente_proposta', label: `Dirigentes: Propostas (${resumo.dirigentesPropostas})` },
                  { id: 'dirigente_aprovado', label: `Dirigentes: Posse (${resumo.dirigentesAprovadosAguardandoPosse})` },
                  { id: 'carta_mudanca', label: `Cartas de Mudança (${resumo.cartasMudanca})` },
                  { id: 'carta_desligamento', label: `Cartas de Desligamento (${resumo.cartasDesligamento})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFiltroCategoria(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      filtroCategoria === f.id
                        ? 'bg-[#123b63] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Busca e Atualizar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar pessoa, congregação..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  {busca && (
                    <button
                      onClick={() => setBusca('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => carregarCentral(true)}
                  disabled={refreshing}
                  title="Atualizar lista de deliberações"
                  className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-[#123b63] hover:border-slate-300 rounded-lg transition shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Fila de Decisões Institucionais */}
            {loading ? (
              <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-[#123b63]" />
                <p className="text-sm font-medium">Carregando processos em pauta...</p>
              </div>
            ) : filaFiltrada.length === 0 ? (
              <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {busca ? 'Nenhum processo localizado' : 'Nenhuma pendência na Fila de Decisões'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  {busca
                    ? 'Tente ajustar os termos da pesquisa ou selecione outro filtro de categoria.'
                    : 'Todas as propostas de dirigentes e cartas ministeriais enviadas pela Secretaria já foram deliberadas ou homologadas.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Tipo de Processo</th>
                      <th className="py-3 px-4">Pessoa Envolvida</th>
                      <th className="py-3 px-4">Congregação</th>
                      <th className="py-3 px-4">Data / Prazo</th>
                      <th className="py-3 px-4">Status Institucional</th>
                      <th className="py-3 px-4 text-right">Ação Decisória</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filaFiltrada.map((item) => (
                      <tr
                        key={`${item.origem}-${item.id}`}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Tipo de Processo */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                item.tipoCategoria === 'dirigente'
                                  ? 'bg-blue-100 text-[#123b63]'
                                  : item.tipoCategoria === 'carta_mudanca'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.tipoCategoria === 'carta_desligamento'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {item.tipoCategoria === 'dirigente' ? (
                                <Briefcase className="w-4 h-4" />
                              ) : item.tipoCategoria === 'carta_mudanca' ? (
                                <ArrowRight className="w-4 h-4" />
                              ) : item.tipoCategoria === 'carta_desligamento' ? (
                                <AlertTriangle className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 leading-snug">{item.tipoLabel}</p>
                              <span className="text-[10px] text-slate-400 capitalize">
                                Solicitado por: {item.solicitanteNome || 'Secretaria'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Pessoa Envolvida */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 leading-tight">{item.pessoaNome}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            {item.pessoaCargo && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10px]">
                                {item.pessoaCargo}
                              </span>
                            )}
                            {item.pessoaMatricula && (
                              <span>Matr.: {item.pessoaMatricula}</span>
                            )}
                          </div>
                        </td>

                        {/* Congregação */}
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {item.congregacaoNome}
                          </p>
                          {item.destinoNome && item.destinoNome !== item.congregacaoNome && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Destino: {item.destinoNome}
                            </p>
                          )}
                          {item.requerTermoPatrimonial && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold mt-0.5">
                              <Scale className="w-3 h-3" /> Requer termo patrimonial
                            </span>
                          )}
                        </td>

                        {/* Data / Prazo */}
                        <td className="py-3 px-4 text-slate-600">
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Envio: {formatDataPtBr(item.dataSolicitacao)}
                          </p>
                          {item.dataPrevista && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Prevista: {formatDataPtBr(item.dataPrevista)}
                            </p>
                          )}
                        </td>

                        {/* Status Institucional */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${item.statusBadge.bg} ${item.statusBadge.text} ${item.statusBadge.border}`}
                          >
                            {item.statusLabel}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setModalDetalhesProcesso(item)}
                              title="Visualizar Detalhes"
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Se proposta de dirigente: Deliberar */}
                            {item.origem === 'dirigente_movimentacao' && item.status === 'proposta' && (
                              <button
                                onClick={() => {
                                  setModalDeliberarDirigente(item);
                                  setJustificativaDecisao('');
                                }}
                                className="px-3 py-1.5 bg-[#123b63] text-white rounded-lg font-bold hover:bg-[#1a4f85] transition shadow-xs flex items-center gap-1.5 cursor-pointer text-xs"
                              >
                                <span>Deliberar</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Se dirigente aprovado: Efetivar Posse */}
                            {item.origem === 'dirigente_movimentacao' && item.status === 'aprovada' && (
                              <button
                                onClick={() => {
                                  setModalEfetivarDirigente(item);
                                  setDataEfetiva(new Date().toISOString().slice(0, 10));
                                  setDivergenciasPatrimonio('');
                                  setObservacoesEfetivacao('');
                                }}
                                className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 transition shadow-xs flex items-center gap-1.5 cursor-pointer text-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Efetivar Posse</span>
                              </button>
                            )}

                            {/* Se carta ministerial pendente: Decidir Carta */}
                            {item.origem === 'carta_pedido' && (
                              <button
                                onClick={() => {
                                  setModalDeliberarCarta(item);
                                  setJustificativaDecisao('');
                                }}
                                className="px-3 py-1.5 bg-amber-700 text-white rounded-lg font-bold hover:bg-amber-800 transition shadow-xs flex items-center gap-1.5 cursor-pointer text-xs"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>Despachar Carta</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── ABA 2: HISTÓRICO DE RESOLUÇÕES ─── */}
        {activeTab === 'historico' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Despachos e Resoluções Presidenciais
                </h3>
                <p className="text-xs text-slate-500">
                  Histórico de processos concluídos, posses formalizadas e cartas deliberadas.
                </p>
              </div>
              <button
                onClick={carregarHistorico}
                disabled={loadingHistorico}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistorico ? 'animate-spin' : ''}`} />
                Atualizar Histórico
              </button>
            </div>

            {loadingHistorico ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#123b63] mb-2" />
                <p className="text-xs">Carregando resoluções...</p>
              </div>
            ) : historico.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-500">
                Nenhuma deliberação registrada no histórico recente.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                      <th className="py-2.5 px-4">Processo</th>
                      <th className="py-2.5 px-4">Pessoa</th>
                      <th className="py-2.5 px-4">Congregação</th>
                      <th className="py-2.5 px-4">Resultado / Status</th>
                      <th className="py-2.5 px-4">Data Deliberação</th>
                      <th className="py-2.5 px-4 text-right">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historico.map((item) => (
                      <tr key={`hist-${item.origem}-${item.id}`} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {item.tipoLabel}
                        </td>
                        <td className="py-2.5 px-4">
                          <p className="font-bold text-slate-900">{item.pessoaNome}</p>
                          {item.pessoaCargo && (
                            <span className="text-[10px] text-slate-500">{item.pessoaCargo}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{item.congregacaoNome}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${item.statusBadge.bg} ${item.statusBadge.text} ${item.statusBadge.border}`}
                          >
                            {item.statusLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {formatDataPtBr(item.dataPrevista || item.dataSolicitacao)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => setModalDetalhesProcesso(item)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── ABA 3: GOVERNANÇA DO CORPO PASTORAL & DIRIGENTES ─── */}
        {activeTab === 'governanca' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Lideranças Vigentes nas Congregações
                </h3>
                <p className="text-xs text-slate-500">
                  Visão executiva do corpo de dirigentes ativos e tempo de mandato em cada congregação.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/secretaria/dirigentes"
                  className="px-3 py-1.5 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#1a4f85] transition flex items-center gap-1.5"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  Módulo de Dirigentes
                </Link>
                <button
                  onClick={carregarLiderancas}
                  disabled={loadingLiderancas}
                  className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLiderancas ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loadingLiderancas ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#123b63] mb-2" />
                <p className="text-xs">Carregando lideranças vigentes...</p>
              </div>
            ) : liderancas.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-500">
                Nenhuma congregação ativa cadastrada.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                      <th className="py-2.5 px-4">Congregação</th>
                      <th className="py-2.5 px-4">Dirigente Vigente</th>
                      <th className="py-2.5 px-4">Cargo Ministerial</th>
                      <th className="py-2.5 px-4">Tempo de Mandato</th>
                      <th className="py-2.5 px-4">Patrimônio</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {liderancas.map((lid) => (
                      <tr key={lid.congregacao_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {lid.congregacao_nome}
                        </td>
                        <td className="py-2.5 px-4">
                          {lid.dirigente_atual_nome ? (
                            <span className="font-semibold text-slate-800">
                              {lid.dirigente_atual_nome}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold italic text-[11px]">
                              Sem dirigente formal
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {lid.dirigente_atual_cargo || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {formatTempoMandato(lid.tempo_mandato_meses)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {lid.total_bens_patrimonio > 0 ? (
                            <span>
                              {lid.total_bens_patrimonio} bens (
                              {formatCurrency(lid.valor_patrimonio_estimado)})
                            </span>
                          ) : (
                            <span className="text-slate-400">Sem bens</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {lid.movimentacao_em_andamento ? (
                            <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[10px] font-bold">
                              Mudança em Trâmite
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bold">
                              Regular
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── ABA 4: MÓDULOS INSTITUCIONAIS ─── */}
        {activeTab === 'modulos' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Acessos Rápidos do Gabinete Presidencial
              </h3>
              <p className="text-xs text-slate-500">
                Navegação direta para auditorias, prestações de contas oficiais e conselho fiscal.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <Link
                href="/presidencia/consolidado"
                className="p-5 rounded-2xl border border-slate-200 hover:border-[#123b63] transition shadow-xs hover:shadow-md bg-white group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#123b63] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Coins className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">Consolidado Financeiro</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Visão consolidada de entradas, saídas e saldos de todas as congregações do ministério.
                </p>
              </Link>

              <Link
                href="/presidencia/prestacao-contas-oficial"
                className="p-5 rounded-2xl border border-slate-200 hover:border-[#123b63] transition shadow-xs hover:shadow-md bg-white group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">Prestação de Contas Oficial</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Relatórios institucionais para assembleia geral e órgãos deliberativos.
                </p>
              </Link>

              <Link
                href="/presidencia/conselho-fiscal"
                className="p-5 rounded-2xl border border-slate-200 hover:border-[#123b63] transition shadow-xs hover:shadow-md bg-white group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Scale className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">Conselho Fiscal</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Pareceres fiscais, auditoria interna e homologação das contas ministeriais.
                </p>
              </Link>
            </div>
          </div>
        )}
      </Tabs>

      {/* ─── MODAL 1: DELIBERAÇÃO DE PROPOSTA DE DIRIGENTE (APROVAR / REJEITAR) ─── */}
      {modalDeliberarDirigente && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-1 bg-blue-100 text-[#123b63] font-bold text-xs rounded-full">
                  Deliberação Presidencial
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  Proposta de Mudança de Liderança
                </h3>
              </div>
              <button
                onClick={() => setModalDeliberarDirigente(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações da Proposta */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-semibold block">Congregação de Destino:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {modalDeliberarDirigente.congregacaoNome}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Data Prevista:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDataPtBr(modalDeliberarDirigente.dataPrevista)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200/80 pt-2 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-semibold block">Novo Dirigente Indicado:</span>
                  <span className="font-bold text-slate-900">
                    {modalDeliberarDirigente.pessoaNome}
                  </span>
                  {modalDeliberarDirigente.pessoaCargo && (
                    <span className="block text-slate-500 font-medium">
                      Cargo: {modalDeliberarDirigente.pessoaCargo}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Dirigente Anterior:</span>
                  <span className="font-semibold text-slate-700">
                    {modalDeliberarDirigente.detalhesRaw?.dirigente_anterior_nome || 'Não designado'}
                  </span>
                </div>
              </div>

              {modalDeliberarDirigente.motivoOuDescricao && (
                <div className="border-t border-slate-200/80 pt-2">
                  <span className="text-slate-400 font-semibold block">Motivo / Justificativa da Secretaria:</span>
                  <p className="text-slate-700 font-medium italic mt-0.5">
                    &ldquo;{modalDeliberarDirigente.motivoOuDescricao}&rdquo;
                  </p>
                </div>
              )}

              {modalDeliberarDirigente.requerTermoPatrimonial && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 shrink-0 text-amber-700" />
                  <span>
                    A congregação possui patrimônio cadastrado. A efetivação exigirá conferência prévia.
                  </span>
                </div>
              )}
            </div>

            {/* Parecer Presidencial */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Parecer / Observações da Presidência:
              </label>
              <textarea
                value={justificativaDecisao}
                onChange={(e) => setJustificativaDecisao(e.target.value)}
                rows={3}
                placeholder="Insira observações institucionais ou a justificativa formal em caso de indeferimento..."
                className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                * Obrigatório apenas em caso de indeferimento/rejeição da proposta.
              </span>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalDeliberarDirigente(null)}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeliberarProposta('rejeitar')}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Rejeitar Proposta</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeliberarProposta('aprovar')}
                disabled={submittingAction}
                className="px-5 py-2 text-xs font-bold text-white bg-[#123b63] hover:bg-[#1a4f85] rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Aprovar Proposta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: EFETIVAÇÃO DE POSSE DE DIRIGENTE (ATÔMICA) ─── */}
      {modalEfetivarDirigente && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 font-bold text-xs rounded-full">
                  Posse Ministerial
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  Efetivação de Liderança na Congregação
                </h3>
              </div>
              <button
                onClick={() => setModalEfetivarDirigente(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações da Homologação */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <p>
                <strong className="text-slate-500">Congregação:</strong>{' '}
                <span className="font-bold text-slate-900">{modalEfetivarDirigente.congregacaoNome}</span>
              </p>
              <p>
                <strong className="text-slate-500">Dirigente Homologado:</strong>{' '}
                <span className="font-bold text-slate-900">{modalEfetivarDirigente.pessoaNome}</span>
                {modalEfetivarDirigente.pessoaCargo && ` (${modalEfetivarDirigente.pessoaCargo})`}
              </p>
              <p>
                <strong className="text-slate-500">Aprovado em:</strong>{' '}
                {formatDataPtBr(modalEfetivarDirigente.detalhesRaw?.data_aprovacao)} por{' '}
                <span className="font-semibold text-slate-800">
                  {modalEfetivarDirigente.detalhesRaw?.aprovador_nome || 'Presidência'}
                </span>
              </p>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 mt-2 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-700 mt-0.5" />
                <span>
                  A efetivação executará a operação atômica no banco, transferindo formalmente a designação e registrando os eventos de posse e saída no histórico ministerial individual dos obreiros.
                </span>
              </div>
            </div>

            {/* Formulário de Efetivação */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data Efetiva da Posse:
                </label>
                <input
                  type="date"
                  value={dataEfetiva}
                  onChange={(e) => setDataEfetiva(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {modalEfetivarDirigente.requerTermoPatrimonial && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ressalvas ou Divergências Patrimoniais (se houver):
                  </label>
                  <input
                    type="text"
                    value={divergenciasPatrimonio}
                    onChange={(e) => setDivergenciasPatrimonio(e.target.value)}
                    placeholder="Ex: 2 cadeiras com avaria constatadas na conferência..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações de Posse:
                </label>
                <textarea
                  value={observacoesEfetivacao}
                  onChange={(e) => setObservacoesEfetivacao(e.target.value)}
                  rows={2}
                  placeholder="Observações complementares registradas na ata ministerial..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalEfetivarDirigente(null)}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEfetivarPosse}
                disabled={submittingAction}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Posse e Gravar Histórico</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: DELIBERAÇÃO DE CARTA MINISTERIAL (AUTORIZAR / REJEITAR) ─── */}
      {modalDeliberarCarta && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full">
                  Despacho Presidencial
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  {modalDeliberarCarta.tipoLabel}
                </h3>
              </div>
              <button
                onClick={() => setModalDeliberarCarta(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informações da Carta */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-semibold block">Membro Solicitante:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {modalDeliberarCarta.pessoaNome}
                  </span>
                  {modalDeliberarCarta.pessoaCargo && (
                    <span className="text-slate-500 block">Cargo: {modalDeliberarCarta.pessoaCargo}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Congregação de Origem:</span>
                  <span className="font-semibold text-slate-800">
                    {modalDeliberarCarta.congregacaoNome}
                  </span>
                </div>
              </div>

              {modalDeliberarCarta.destinoNome && (
                <div className="border-t border-slate-200/80 pt-2">
                  <span className="text-slate-400 font-semibold block">Destino Informado:</span>
                  <span className="font-bold text-slate-800">{modalDeliberarCarta.destinoNome}</span>
                </div>
              )}

              {modalDeliberarCarta.motivoOuDescricao && (
                <div className="border-t border-slate-200/80 pt-2">
                  <span className="text-slate-400 font-semibold block">Observações do Pedido:</span>
                  <p className="text-slate-700 italic mt-0.5">
                    &ldquo;{modalDeliberarCarta.motivoOuDescricao}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Campo de Justificativa / Parecer */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Despacho / Parecer Presidencial:
              </label>
              <textarea
                value={justificativaDecisao}
                onChange={(e) => setJustificativaDecisao(e.target.value)}
                rows={3}
                placeholder="Insira observações institucionais ou a justificativa formal em caso de indeferimento..."
                className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                * Obrigatório caso o pedido seja indeferido.
              </span>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalDeliberarCarta(null)}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeliberarCarta('rejeitar')}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Indeferir Pedido</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeliberarCarta('autorizar')}
                disabled={submittingAction}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Autorizar e Assinar Carta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: DETALHES COMPLETOS DO PROCESSO (LEITURA) ─── */}
      {modalDetalhesProcesso && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-full">
                  Ficha do Processo
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2">
                  {modalDetalhesProcesso.tipoLabel}
                </h3>
              </div>
              <button
                onClick={() => setModalDetalhesProcesso(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
              <p>
                <strong>Pessoa:</strong> {modalDetalhesProcesso.pessoaNome}
                {modalDetalhesProcesso.pessoaCargo && ` (${modalDetalhesProcesso.pessoaCargo})`}
              </p>
              <p>
                <strong>Congregação:</strong> {modalDetalhesProcesso.congregacaoNome}
              </p>
              {modalDetalhesProcesso.destinoNome && (
                <p>
                  <strong>Destino:</strong> {modalDetalhesProcesso.destinoNome}
                </p>
              )}
              <p>
                <strong>Solicitante:</strong> {modalDetalhesProcesso.solicitanteNome || 'Secretaria'}
              </p>
              <p>
                <strong>Data de Envio:</strong> {formatDataPtBr(modalDetalhesProcesso.dataSolicitacao)}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${modalDetalhesProcesso.statusBadge.bg} ${modalDetalhesProcesso.statusBadge.text} ${modalDetalhesProcesso.statusBadge.border}`}
                >
                  {modalDetalhesProcesso.statusLabel}
                </span>
              </p>
              {modalDetalhesProcesso.motivoOuDescricao && (
                <div className="pt-2 border-t border-slate-200">
                  <strong>Motivo / Observações:</strong>
                  <p className="mt-0.5 italic">&ldquo;{modalDetalhesProcesso.motivoOuDescricao}&rdquo;</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalDetalhesProcesso(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE NOTIFICAÇÃO ─── */}
      <NotificationModal
        isOpen={notif.isOpen}
        type={notif.type}
        title={notif.title}
        message={notif.message}
        onClose={() => setNotif((prev) => ({ ...prev, isOpen: false }))}
      />
    </PageLayout>
  );
}
