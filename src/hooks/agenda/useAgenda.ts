'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { OrganizationalService, getOrgHelpers, OrgStructure } from '@/lib/organizational-service';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { PlanningConflictService } from '@/lib/planning-conflict-service';
import { AgendaRecorrenciaService, RecorrenciaConfig, normalizarTipoAgendaEvento } from '@/lib/agenda-recorrencia-service';
import { Calendar as CalendarIcon, LayoutDashboard, BookOpen, Gavel } from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AgendaTipo {
  id: string;
  ministry_id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: 'culto' | 'reuniao' | 'evento' | 'missoes' | 'departamento' | 'administrativo';
  cor: string | null;
  icone: string | null;
  sistema: boolean;
  permite_edicao: boolean;
  gera_bloqueio: boolean;
  ativo: boolean;
  ordem: number;
}

export interface AgendaPlanejamento {
  id: string;
  ano: number;
  nome: string;
  descricao: string | null;
  status: 'rascunho' | 'publicado' | 'arquivado';
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaEvento {
  id: string;
  ministry_id: string;
  church_id: string | null;
  planejamento_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: 'culto' | 'reuniao' | 'aula' | 'evento' | 'tarefa' | 'outro';
  tipo_id: string | null;
  origem: string;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  visibilidade: 'privado' | 'lideranca' | 'igreja' | 'ministerio' | 'publico';
  status: 'agendado' | 'cancelado' | 'concluido';
  recorrente: boolean;
  recorrencia_tipo?: string | null;
  recorrencia_config?: any;
  recorrencia_pai_id?: string | null;
  excecao_datas?: any;
  escopo: 'organizacao' | 'divisao1' | 'divisao2' | 'divisao3';
  prioridade: number;
  calendario_oficial: boolean;
  gera_bloqueio: boolean;
  bloqueado: boolean;
  origem_tipo: string | null;
  origem_id: string | null;
  regra_posicionamento: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  congregacao_nome?: string;
  agenda_tipos?: AgendaTipo | null;
  agenda_planejamentos?: AgendaPlanejamento | null;
}

export interface Congregacao {
  id: string;
  nome: string;
  is_sede?: boolean;
}

export interface SolicitacaoExcecao {
  id: string;
  ministry_id: string;
  planejamento_id: string | null;
  evento_id: string | null;
  solicitante_id: string | null;
  tipo_solicitacao: 'conflito_data' | 'alteracao_data' | 'alteracao_escopo' | 'coexistencia' | 'criacao_evento';
  escopo: 'organizacao' | 'divisao1' | 'divisao2' | 'divisao3';
  titulo: string;
  justificativa: string;
  data_inicio: string;
  data_fim: string | null;
  conflito_id: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado';
  tipo_decisao: 'aprovar' | 'rejeitar' | 'aprovar_com_restricao' | null;
  numero_decisao: string | null;
  vigencia_tipo: 'unica' | 'temporaria' | 'permanente';
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  efeito: 'autorizar_evento' | 'permitir_coexistencia' | 'alterar_escopo' | 'alterar_data' | 'outro' | null;
  analisado_por: string | null;
  analisado_em: string | null;
  parecer: string | null;
  created_at: string;
  conflito_evento?: { titulo: string } | null;
}

export const CATEGORIAS_LABEL = {
  culto: 'Cultos',
  reuniao: 'Reuniões',
  evento: 'Eventos',
  missoes: 'Missões',
  departamento: 'Departamentos',
  administrativo: 'Administrativo',
};

export const STATUS_PLAN_INFO = {
  rascunho: { label: 'Rascunho', cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  publicado: { label: 'Publicado', cor: 'bg-blue-50 text-blue-700 border-blue-200' },
  arquivado: { label: 'Arquivado', cor: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const TIPO_SOLICITACAO_LABEL = {
  conflito_data: 'Conflito de Data',
  alteracao_data: 'Alteração de Data',
  alteracao_escopo: 'Alteração de Escopo',
  coexistencia: 'Coexistência de Eventos',
  criacao_evento: 'Criação de Evento Extra',
};

export const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export type QuickFilter = 'todos' | 'oficiais' | 'locais' | 'bloqueados';

export function useAgenda() {
  const { user } = useRequireSupabaseAuth();
  const { ctx, bloqueado } = useRequireModulo('agenda');
  const supabase = useMemo(() => createClient(), []);
  const dialog = useAppDialog();
  const { registrarAcao } = useAuditLog();
  const planFeatures = usePlanFeatures();
  const router = useRouter();

  const currentDateFormatted = useMemo(() => {
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const d = new Date();
    const diaSemana = diasSemana[d.getDay()];
    const dia = d.getDate();
    const mes = meses[d.getMonth()];
    const ano = d.getFullYear();
    return `${diaSemana}, ${dia} de ${mes} de ${ano}`;
  }, []);

  const daysLeftInMonth = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    return lastDayOfMonth - today.getDate();
  }, []);

  useEffect(() => {
    if (!planFeatures.loading && !planFeatures.has_modulo_agenda) {
      router.push('/acesso-negado');
    }
  }, [planFeatures.loading, planFeatures.has_modulo_agenda, router]);

  const [activeTab, setActiveTab] = useState<'calendario' | 'dashboard' | 'planejamento' | 'solicitacoes'>('calendario');

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [loadingCongregacoes, setLoadingCongregacoes] = useState(false);
  const [erroCongregacoes, setErroCongregacoes] = useState<string | null>(null);
  const [tipos, setTipos] = useState<AgendaTipo[]>([]);
  const [eventos, setEventos] = useState<AgendaEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [orgStructure, setOrgStructure] = useState<OrgStructure | null>(null);

  const [activePlanning, setActivePlanning] = useState<AgendaPlanejamento | null>(null);
  const [planningEventCount, setPlanningEventCount] = useState<number>(0);
  const [responsibleEmail, setResponsibleEmail] = useState<string | null>(null);

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoExcecao[]>([]);
  const [loadingSols, setLoadingSols] = useState(false);

  const [filtroMes, setFiltroMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [agendaVisualizada, setAgendaVisualizada] = useState<string>('geral');
  const [filtroTipoId, setFiltroTipoId] = useState<string>('');
  const [filtroCongregacao, setFiltroCongregacao] = useState<string>('');
  const [filtroVisibilidade, setFiltroVisibilidade] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editEvento, setEditEvento] = useState<AgendaEvento | null>(null);
  const [showAdvancedFormFields, setShowAdvancedFormFields] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    tipo_id: '',
    data_inicio: '',
    data_fim: '',
    hora_inicio: '19:30',
    duracao_minutos: 120,
    local: '',
    visibilidade: 'ministerio' as AgendaEvento['visibilidade'],
    church_id: '',
    status: 'agendado' as AgendaEvento['status'],
    escopo: 'divisao1' as AgendaEvento['escopo'],
    calendario_oficial: false,
    gera_bloqueio: false,
    regra_posicionamento: '' as string,
    recorrencia_tipo: 'nenhuma' as 'nenhuma' | 'semanal' | 'mensal_ordinal' | 'mensal_dia' | 'anual',
    recorrencia_dias_semana: [] as number[],
    recorrencia_ordinal: 'primeiro' as 'primeiro' | 'segundo' | 'terceiro' | 'quarto' | 'ultimo',
    recorrencia_dia_semana_ordinal: 6,
    recorrencia_dia_mes: 1,
    recorrencia_ano_referencia: new Date().getFullYear(),
    recorrencia_data_fim: '',
  });

  const [showTiposModal, setShowTiposModal] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoCategoria, setNovoTipoCategoria] = useState<'culto' | 'reuniao' | 'evento' | 'missoes' | 'departamento' | 'administrativo'>('culto');
  const [novoTipoCor, setNovoTipoCor] = useState('#3b82f6');
  const [novoTipoBloqueio, setNovoTipoBloqueio] = useState(false);
  const [isSalvandoTipo, setIsSalvandoTipo] = useState(false);

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<AgendaEvento | null>(null);

  const orgHelper = useMemo(() => {
    return orgStructure ? getOrgHelpers(orgStructure) : null;
  }, [orgStructure]);

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  const userRole = (ctx as any)?.nivel || (ctx as any)?.role || '';
  const userIsMaster = (ctx as any)?.isAdmin || (ctx as any)?.isMaster || false;

  const isPresidenciaOrAdmin = useMemo(() => {
    if (userIsMaster) return true;
    if (!userRole) return false;
    const r = String(userRole).toLowerCase();
    return (
      r === 'administrador' ||
      r === 'presidencia' ||
      r.includes('admin') ||
      r.includes('presid') ||
      r.includes('pastor_presidente') ||
      r.includes('pastor presidente') ||
      r.includes('superintendente')
    );
  }, [userIsMaster, userRole]);

  const isEscritaPermitida = useMemo(() => {
    if (userIsMaster) return true;
    if (ctx?.podeEscrever && ctx.podeEscrever('agenda')) return true;
    if (userRole === 'admin' || userRole === 'editor' || userRole === 'administrador' || isPresidenciaOrAdmin) return true;
    return false;
  }, [userIsMaster, ctx, userRole, isPresidenciaOrAdmin]);

  const isAdmin = useMemo(() => {
    return userIsMaster || userRole === 'admin' || userRole === 'administrador' || isPresidenciaOrAdmin;
  }, [userIsMaster, userRole, isPresidenciaOrAdmin]);

  const userCongregacaoId = (ctx as any)?.congregacaoId || null;

  const isSecretarioGeral = useMemo(() => {
    if (userIsMaster) return true;
    if (!userRole) return false;
    const r = String(userRole).toLowerCase();
    return (
      r === 'administrador' ||
      r === 'secretario_geral' ||
      r === 'presidencia' ||
      r.includes('admin') ||
      r.includes('secretario_geral') ||
      isPresidenciaOrAdmin
    );
  }, [userIsMaster, userRole, isPresidenciaOrAdmin]);

  const isSecretarioLocal = useMemo(() => {
    if (isSecretarioGeral) return false;
    if (!userRole) return false;
    const r = String(userRole).toLowerCase();
    return r === 'secretaria_local' || r === 'admin_local' || r === 'operador';
  }, [isSecretarioGeral, userRole]);

  const congregacoesAutorizadas = useMemo(() => {
    if (isSecretarioGeral) return congregacoes;
    if (isSecretarioLocal && userCongregacaoId) {
      const match = congregacoes.filter(c => c.id === userCongregacaoId);
      return match.length > 0 ? match : congregacoes;
    }
    return congregacoes;
  }, [isSecretarioGeral, isSecretarioLocal, userCongregacaoId, congregacoes]);

  useEffect(() => {
    if (isSecretarioLocal && userCongregacaoId) {
      setAgendaVisualizada(userCongregacaoId);
    }
  }, [isSecretarioLocal, userCongregacaoId]);

  const currentYear = useMemo(() => {
    const [y] = filtroMes.split('-');
    return parseInt(y, 10) || new Date().getFullYear();
  }, [filtroMes]);

  const currentMonth = useMemo(() => {
    const [, m] = filtroMes.split('-');
    return parseInt(m, 10) || (new Date().getMonth() + 1);
  }, [filtroMes]);

  const handlePrevMonth = () => {
    let y = currentYear;
    let m = currentMonth - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setFiltroMes(`${y}-${String(m).padStart(2, '0')}`);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    let y = currentYear;
    let m = currentMonth + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setFiltroMes(`${y}-${String(m).padStart(2, '0')}`);
    setSelectedDate(null);
  };

  const handleGoToToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dayStr = `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setFiltroMes(`${y}-${String(m).padStart(2, '0')}`);
    setSelectedDate(dayStr);
  };

  useEffect(() => {
    if (user?.id) {
      OrganizationalService.getEstrutura(supabase).then(setOrgStructure).catch(console.error);
    }
  }, [user, supabase]);

  useEffect(() => {
    async function init() {
      if (!user) return;
      const mId = await resolveMinistryId(supabase);
      setMinistryId(mId);
    }
    init();
  }, [user, supabase]);

  const loadCongregacoes = useCallback(async (mId: string) => {
    setLoadingCongregacoes(true);
    setErroCongregacoes(null);
    try {
      const orgService = await obterEstruturaOrganizacionalService(mId, supabase);
      const div1 = orgService.getDivisao1().filter((u) => u.isActive !== false);
      const lista: Congregacao[] = div1.map((u) => ({
        id: u.id,
        nome: u.nome ? u.nome.trim() : '',
        is_sede: !!u.isSede,
      })).filter((c) => c.nome.length > 0);

      // Sede primeiro, depois alfabética
      lista.sort((a, b) => {
        if (a.is_sede && !b.is_sede) return -1;
        if (!a.is_sede && b.is_sede) return 1;
        return a.nome.localeCompare(b.nome);
      });

      setCongregacoes(lista);
    } catch (err: any) {
      console.error('Erro ao carregar congregações da agenda:', err);
      setCongregacoes([]);
      setErroCongregacoes('Erro ao carregar congregações.');
    } finally {
      setLoadingCongregacoes(false);
    }
  }, [supabase]);

  const loadTipos = useCallback(async (mId: string) => {
    try {
      const { data, error } = await supabase
        .from('agenda_tipos')
        .select('*')
        .eq('ministry_id', mId)
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      setTipos(data || []);
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  const loadPlanningInfo = useCallback(async (mId: string, ano: number) => {
    try {
      const { data: planData } = await supabase
        .from('agenda_planejamentos')
        .select('*')
        .eq('ministry_id', mId)
        .eq('ano', ano)
        .maybeSingle();

      if (planData) {
        setActivePlanning(planData);
        const { count } = await supabase
          .from('agenda_eventos')
          .select('id', { count: 'exact', head: true })
          .eq('planejamento_id', planData.id);
        setPlanningEventCount(count || 0);

        if (planData.published_by) {
          const { data: userData } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', planData.published_by)
            .maybeSingle();
          setResponsibleEmail(userData?.email || 'Membro da Presidência');
        } else {
          setResponsibleEmail(null);
        }
      } else {
        setActivePlanning(null);
        setPlanningEventCount(0);
        setResponsibleEmail(null);
      }
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  const loadEventos = useCallback(async (mId: string) => {
    setLoading(true);
    try {
      const [yearStr, monthStr] = filtroMes.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

      let query = supabase
        .from('agenda_eventos')
        .select(`
          *,
          agenda_tipos (*),
          agenda_planejamentos (*)
        `)
        .eq('ministry_id', mId)
        .lte('data_inicio', endOfMonth)
        .or(`data_fim.gte.${startOfMonth},and(data_fim.is.null,data_inicio.gte.${startOfMonth})`)
        .order('data_inicio');

      if (filtroTipoId) {
        query = query.eq('tipo_id', filtroTipoId);
      }
      if (filtroVisibilidade) {
        query = query.eq('visibilidade', filtroVisibilidade);
      }

      // Seletor Superior: Visualizar Agenda
      // NOTA: 'geral' e 'todas' não filtram por church_id — o ministry_id já garante
      // isolamento de tenant. Filtrar por escopo/gera_bloqueio na visão 'geral' causava
      // o desaparecimento de cultos criados com church_id de congregação específica.
      if (agendaVisualizada && agendaVisualizada !== 'geral' && agendaVisualizada !== 'todas') {
        // Congregação específica ou Sede:
        // Exibe os eventos da própria unidade + eventos gerais/bloqueios do ministério
        query = query.or(`church_id.eq.${agendaVisualizada},church_id.is.null`);
      } else if (filtroCongregacao) {
        query = query.or(`church_id.eq.${filtroCongregacao},church_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEventos(data || []);
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao carregar os compromissos da agenda.');
    } finally {
      setLoading(false);
    }
  }, [supabase, filtroMes, filtroTipoId, filtroVisibilidade, agendaVisualizada, filtroCongregacao]);

  const triggerSyncPublicMagazine = useCallback(async () => {
    try {
      await fetch('/api/v1/agenda/sync-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      // Falha silenciosa de sincronização de cache em segundo plano para não bloquear a UI do operador
      console.warn('[useAgenda] Sincronização pública em segundo plano:', err);
    }
  }, []);

  const loadSolicitacoes = useCallback(async (mId: string) => {
    if (!isPresidenciaOrAdmin) return;
    setLoadingSols(true);
    try {
      const { data, error } = await supabase
        .from('agenda_solicitacoes')
        .select('*')
        .eq('ministry_id', mId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const solicitacoesComConflito = await Promise.all(
        (data || []).map(async (sol: any) => {
          if (!sol.conflito_id) return sol;
          try {
            const { data: confEvt } = await supabase
              .from('agenda_eventos')
              .select('titulo')
              .eq('id', sol.conflito_id)
              .maybeSingle();
            return {
              ...sol,
              conflito_evento: confEvt ? { titulo: confEvt.titulo } : null,
            };
          } catch {
            return sol;
          }
        })
      );

      setSolicitacoes(solicitacoesComConflito);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSols(false);
    }
  }, [supabase, isPresidenciaOrAdmin]);

  useEffect(() => {
    if (ministryId) {
      loadCongregacoes(ministryId);
      loadTipos(ministryId);
      loadEventos(ministryId);
      loadPlanningInfo(ministryId, currentYear);
      loadSolicitacoes(ministryId);
    }
  }, [ministryId, currentYear, loadCongregacoes, loadTipos, loadEventos, loadPlanningInfo, loadSolicitacoes]);

  const canEditEvento = useCallback((evento: AgendaEvento | null): boolean => {
    if (!evento) return isEscritaPermitida;
    if (isSecretarioGeral) return true;
    if (isSecretarioLocal) {
      return Boolean(evento.church_id && evento.church_id === userCongregacaoId);
    }
    return isEscritaPermitida;
  }, [isSecretarioGeral, isSecretarioLocal, userCongregacaoId, isEscritaPermitida]);

  const openForm = (evento: AgendaEvento | null = null, defaultDateStr?: string | null) => {
    if (evento) {
      setEditEvento(evento);
      let resolvedChurchId = evento.church_id || '';
      let resolvedLocal = evento.local || '';
      if (!resolvedChurchId && resolvedLocal) {
        const match = congregacoes.find(
          c => c.nome.trim().toLowerCase() === resolvedLocal.trim().toLowerCase()
        );
        if (match) {
          resolvedChurchId = match.id;
          resolvedLocal = match.nome;
        }
      } else if (resolvedChurchId && !resolvedLocal) {
        const match = congregacoes.find(c => c.id === resolvedChurchId);
        if (match) {
          resolvedLocal = match.nome;
        }
      }

      if (!resolvedChurchId) {
        if (!resolvedLocal || resolvedLocal === 'Sede Geral') {
          resolvedLocal = 'Todo o Campo (Todas as Congregações)';
        }
      }

      setForm({
        titulo: evento.titulo || '',
        descricao: evento.descricao || '',
        tipo_id: evento.tipo_id || '',
        data_inicio: evento.data_inicio ? evento.data_inicio.slice(0, 16) : '',
        data_fim: evento.data_fim ? evento.data_fim.slice(0, 16) : '',
        hora_inicio: evento.data_inicio ? evento.data_inicio.slice(11, 16) : '19:30',
        duracao_minutos: evento.data_inicio && evento.data_fim 
          ? Math.max(30, Math.round((new Date(evento.data_fim).getTime() - new Date(evento.data_inicio).getTime()) / 60000))
          : 120,
        local: resolvedLocal,
        visibilidade: evento.visibilidade || 'ministerio',
        church_id: resolvedChurchId,
        status: evento.status || 'agendado',
        escopo: evento.escopo || (resolvedChurchId ? 'divisao1' : 'organizacao'),
        calendario_oficial: evento.calendario_oficial ?? false,
        gera_bloqueio: evento.gera_bloqueio ?? false,
        regra_posicionamento: evento.regra_posicionamento || '',
        recorrencia_tipo: (evento.recorrencia_tipo as any) || (evento.recorrente ? 'semanal' : 'nenhuma'),
        recorrencia_dias_semana: evento.recorrencia_config?.diasSemana || [],
        recorrencia_ordinal: evento.recorrencia_config?.ordinal || 'primeiro',
        recorrencia_dia_semana_ordinal: evento.recorrencia_config?.diaSemanaOrdinal !== undefined ? evento.recorrencia_config?.diaSemanaOrdinal : 6,
        recorrencia_dia_mes: evento.recorrencia_config?.diaDoMes || 1,
        recorrencia_ano_referencia: evento.recorrencia_config?.anoReferencia || (evento.data_inicio ? new Date(evento.data_inicio).getFullYear() : currentYear),
        recorrencia_data_fim: evento.recorrencia_config?.dataFimRecorrencia || '',
      });
      setShowAdvancedFormFields(!!(evento.descricao || evento.regra_posicionamento || evento.calendario_oficial || evento.gera_bloqueio || evento.recorrente || (evento.recorrencia_tipo && evento.recorrencia_tipo !== 'nenhuma')));
    } else {
      setEditEvento(null);
      const targetDate = defaultDateStr || selectedDate;
      const defaultStart = targetDate 
        ? `${targetDate}T09:00` 
        : `${new Date().toISOString().slice(0, 10)}T09:00`;

      // Destino do evento separado da agenda visualizada:
      let initialChurchId = '';
      let initialLocal = 'Todo o Campo (Todas as Congregações)';

      if (isSecretarioLocal && userCongregacaoId) {
        const userChurch = congregacoes.find(c => c.id === userCongregacaoId);
        initialChurchId = userCongregacaoId;
        initialLocal = userChurch ? userChurch.nome : 'Minha Congregação';
      } else if (agendaVisualizada && agendaVisualizada !== 'geral' && agendaVisualizada !== 'todas') {
        const viewedChurch = congregacoes.find(c => c.id === agendaVisualizada);
        if (viewedChurch) {
          initialChurchId = viewedChurch.id;
          initialLocal = viewedChurch.nome;
        }
      } else if (filtroCongregacao) {
        const defaultChurch = congregacoes.find(c => c.id === filtroCongregacao);
        if (defaultChurch) {
          initialChurchId = defaultChurch.id;
          initialLocal = defaultChurch.nome;
        }
      }

      setForm({
        titulo: '',
        descricao: '',
        tipo_id: tipos.length > 0 ? tipos[0].id : '',
        data_inicio: defaultStart,
        data_fim: '',
        hora_inicio: '19:30',
        duracao_minutos: 120,
        local: initialLocal,
        visibilidade: 'ministerio',
        church_id: initialChurchId,
        status: 'agendado',
        escopo: initialChurchId ? 'divisao1' : 'organizacao',
        calendario_oficial: false,
        gera_bloqueio: false,
        regra_posicionamento: '',
        recorrencia_tipo: 'nenhuma',
        recorrencia_dias_semana: [],
        recorrencia_ordinal: 'primeiro',
        recorrencia_dia_semana_ordinal: 6,
        recorrencia_dia_mes: 1,
        recorrencia_ano_referencia: currentYear,
        recorrencia_data_fim: '',
      });
      setShowAdvancedFormFields(false);
    }
    setShowModal(true);
  };

  const handleTipoChange = (tipoId: string) => {
    const selected = tipos.find(t => t.id === tipoId);
    setForm(prev => ({
      ...prev,
      tipo_id: tipoId,
      gera_bloqueio: selected ? selected.gera_bloqueio : prev.gera_bloqueio,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryId) return;

    const isRecorrente = form.recorrencia_tipo !== 'nenhuma';

    // Para eventos únicos, valida título e data_inicio obrigatória
    if (!isRecorrente && (!form.titulo.trim() || !form.data_inicio)) {
      flash('erro', 'Preencha o título e a data/hora de início.');
      return;
    }

    // Para eventos recorrentes, valida título e dias/regra
    if (isRecorrente && !form.titulo.trim()) {
      flash('erro', 'Preencha o título do evento.');
      return;
    }

    setSaving(true);
    try {
      // Extrai hora e minuto para séries recorrentes
      const horaStr = form.hora_inicio || (form.data_inicio ? form.data_inicio.slice(11, 16) : '19:30');
      const [hPart, mPart] = horaStr.split(':').map(v => parseInt(v, 10) || 0);
      const anoRef = form.recorrencia_ano_referencia || (form.data_inicio ? new Date(form.data_inicio).getFullYear() : currentYear);
      const duracaoMin = form.duracao_minutos !== undefined ? form.duracao_minutos : 120;
      const duracaoMs = duracaoMin * 60 * 1000;

      const recorrenciaConfig: RecorrenciaConfig = {
        frequencia: form.recorrencia_tipo,
        diasSemana: form.recorrencia_dias_semana.length > 0 ? form.recorrencia_dias_semana : [new Date(form.data_inicio || `${anoRef}-01-01T${horaStr}`).getDay()],
        ordinal: form.recorrencia_ordinal,
        diaSemanaOrdinal: form.recorrencia_dia_semana_ordinal,
        diaDoMes: form.recorrencia_dia_mes,
        anoReferencia: anoRef,
        dataFimRecorrencia: form.recorrencia_data_fim || undefined,
        anoLimite: anoRef,
      };

      // Se for recorrente e estiver criando novo evento, calcula a primeira ocorrência real do ano
      let ocorrenciasGeradas: ReturnType<typeof AgendaRecorrenciaService.gerarOcorrencias> = [];
      let dataInicioEfetiva: string;
      let dataFimEfetiva: string | null;

      if (isRecorrente && !editEvento) {
        // Encontra a 1ª ocorrência automática do ano de referência
        const primeiraData = AgendaRecorrenciaService.calcularPrimeiraOcorrencia({
          ano: anoRef,
          config: recorrenciaConfig,
          hora: hPart,
          minuto: mPart,
        }) || new Date(anoRef, 0, 1, hPart, mPart, 0);

        const dataInicioBaseStr = primeiraData.toISOString();
        const dataFimBaseStr = new Date(primeiraData.getTime() + duracaoMs).toISOString();

        ocorrenciasGeradas = AgendaRecorrenciaService.gerarOcorrencias({
          dataInicio: dataInicioBaseStr,
          dataFim: dataFimBaseStr,
          config: recorrenciaConfig,
          limiteMaximo: 120,
        });

        if (ocorrenciasGeradas.length > 0) {
          dataInicioEfetiva = ocorrenciasGeradas[0].dataInicio;
          dataFimEfetiva = ocorrenciasGeradas[0].dataFim;
        } else {
          dataInicioEfetiva = dataInicioBaseStr;
          dataFimEfetiva = dataFimBaseStr;
        }
      } else {
        // Evento único ou edição de evento existente
        dataInicioEfetiva = new Date(form.data_inicio).toISOString();
        dataFimEfetiva = form.data_fim ? new Date(form.data_fim).toISOString() : null;
      }

      const finalChurchId = isSecretarioLocal && userCongregacaoId ? userCongregacaoId : (form.church_id || null);
      const finalGeraBloqueio = isSecretarioLocal ? false : form.gera_bloqueio;
      const finalCalendarioOficial = isSecretarioLocal ? false : form.calendario_oficial;
      const finalEscopo = isSecretarioLocal ? 'divisao1' : (finalChurchId ? (form.escopo || 'divisao1') : 'organizacao');
      const finalLocal = finalChurchId ? form.local : (form.local || 'Todo o Campo (Todas as Congregações)');

      // Pré-validação de Conflitos e Bloqueios Oficiais no cliente
      const conflict = await PlanningConflictService.verificarConflito(
        supabase,
        {
          titulo: form.titulo.trim(),
          data_inicio: dataInicioEfetiva,
          data_fim: dataFimEfetiva,
          planejamento_id: activePlanning?.id || '',
          ministry_id: ministryId,
          church_id: finalChurchId,
          tipo_id: form.tipo_id,
          escopo: finalEscopo,
          prioridade: finalEscopo === 'organizacao' ? 1 : 4,
          calendario_oficial: finalCalendarioOficial,
          gera_bloqueio: finalGeraBloqueio,
        },
        editEvento?.id || null
      );

      if (conflict && conflict.status === 'BLOQUEIO') {
        const proceed = await dialog.confirm({
          title: 'Alerta de Conflito de Agenda',
          type: 'warning',
          message: `${conflict.motivo || 'Choque com bloqueio oficial existente.'} Deseja submeter uma Solicitação de Exceção à Presidência?`,
          confirmText: 'Enviar Solicitação',
          cancelText: 'Cancelar'
        });

        if (proceed) {
          flash('ok', 'Solicitação de Exceção enviada com sucesso à Presidência para análise!');
          setShowModal(false);
          setSaving(false);
          loadSolicitacoes(ministryId);
          return;
        } else {
          setSaving(false);
          return;
        }
      }

      const selectedTipo = tipos.find(t => t.id === form.tipo_id);
      const tipoCalculado = normalizarTipoAgendaEvento(
        selectedTipo?.categoria,
        editEvento?.tipo,
        selectedTipo?.nome || form.titulo
      );

      const payload = {
        ministry_id: ministryId,
        planejamento_id: activePlanning?.id || null,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        tipo: tipoCalculado,
        origem: 'manual',
        tipo_id: form.tipo_id || null,
        data_inicio: dataInicioEfetiva,
        data_fim: dataFimEfetiva,
        local: finalLocal.trim() || null,
        visibilidade: form.visibilidade,
        church_id: finalChurchId,
        status: form.status,
        escopo: finalEscopo,
        calendario_oficial: finalCalendarioOficial,
        gera_bloqueio: finalGeraBloqueio,
        regra_posicionamento: form.regra_posicionamento || null,
        recorrente: form.recorrencia_tipo !== 'nenhuma',
        recorrencia_tipo: form.recorrencia_tipo,
        recorrencia_config: form.recorrencia_tipo !== 'nenhuma' ? recorrenciaConfig : null,
      };

      let filhasPayload: any[] = [];
      if (form.recorrencia_tipo !== 'nenhuma' && !editEvento && ocorrenciasGeradas.length > 1) {
        filhasPayload = ocorrenciasGeradas.slice(1).map(oc => ({
          dataInicio: oc.dataInicio,
          dataFim: oc.dataFim,
        }));
      }

      // Envia requisição com autorização e validação server-side via API
      const endpoint = '/api/v1/agenda';
      const method = editEvento ? 'PUT' : 'POST';
      const bodyPayload = editEvento
        ? { id: editEvento.id, ...payload }
        : { ...payload, filhas: filhasPayload };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ao salvar compromisso (${res.status})`);
      }

      const resJson = await res.json();
      const savedId = resJson?.data?.id || editEvento?.id || 'compromisso';

      await registrarAcao({
        acao: editEvento ? 'editar' : 'criar',
        modulo: 'agenda',
        tabela_afetada: 'agenda_eventos',
        registro_id: savedId,
      });

      flash('ok', editEvento ? 'Compromisso atualizado com sucesso!' : 'Compromisso agendado com sucesso!');
      setShowModal(false);
      loadEventos(ministryId);
      if (activePlanning) loadPlanningInfo(ministryId, currentYear);

      // Sincronizar cache público caso seja evento público ou altere a agenda pública
      triggerSyncPublicMagazine();
    } catch (err: any) {
      console.error(err);
      flash('erro', err.message || 'Falha ao salvar o compromisso.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (evento: AgendaEvento) => {
    setDeleteConfirmTarget(evento);
  };

  const confirmDeleteAction = async (modo?: string) => {
    if (!deleteConfirmTarget || !ministryId) return;
    const evento = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    if (isSecretarioLocal && (!evento.church_id || evento.church_id !== userCongregacaoId)) {
      flash('erro', 'Secretário local só pode excluir compromissos de sua própria congregação.');
      return;
    }

    try {
      const modoQuery = modo ? `&modo=${encodeURIComponent(modo)}` : '';
      const res = await fetch(`/api/v1/agenda?id=${evento.id}${modoQuery}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ao excluir compromisso (${res.status})`);
      }

      await registrarAcao({ acao: 'deletar', modulo: 'agenda', tabela_afetada: 'agenda_eventos', registro_id: evento.id });
      const msgSucesso = modo === 'toda_serie'
        ? 'Toda a série de compromissos foi excluída com sucesso.'
        : modo === 'esta_e_proximas'
        ? 'Esta e as próximas ocorrências foram excluídas com sucesso.'
        : 'Compromisso excluído com sucesso.';
      flash('ok', msgSucesso);
      loadEventos(ministryId);
      if (activePlanning) loadPlanningInfo(ministryId, currentYear);

      // Sincronizar cache público caso o evento excluído fosse público
      triggerSyncPublicMagazine();
    } catch (err: any) {
      console.error(err);
      flash('erro', err.message || 'Erro ao excluir o compromisso.');
    }
  };

  const handleCriarTipo = async () => {
    if (!ministryId || !novoTipoNome.trim()) return;
    setIsSalvandoTipo(true);

    try {
      const codigoStr = novoTipoNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
      const { error } = await supabase
        .from('agenda_tipos')
        .insert([{
          ministry_id: ministryId,
          codigo: codigoStr,
          nome: novoTipoNome.trim(),
          categoria: novoTipoCategoria,
          cor: novoTipoCor,
          gera_bloqueio: novoTipoBloqueio,
          sistema: false,
          permite_edicao: true,
          ativo: true,
          ordem: tipos.length + 1,
        }]);

      if (error) throw error;
      setNovoTipoNome('');
      setNovoTipoBloqueio(false);
      flash('ok', 'Tipo de compromisso criado!');
      loadTipos(ministryId);
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao criar tipo de compromisso.');
    } finally {
      setIsSalvandoTipo(false);
    }
  };

  const handleDeletarTipo = async (tipoId: string) => {
    if (!ministryId) return;
    const ok = await dialog.confirm({
      title: 'Excluir Tipo',
      message: 'Tem certeza que deseja desativar este tipo de compromisso?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('agenda_tipos')
        .update({ ativo: false })
        .eq('id', tipoId);
      if (error) throw error;
      flash('ok', 'Tipo desativado com sucesso.');
      loadTipos(ministryId);
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao desativar tipo.');
    }
  };

  const handlePublishPlanning = async () => {
    if (!activePlanning || !ministryId) return;
    const ok = await dialog.confirm({
      title: 'Publicar Planejamento Anual',
      message: `Deseja publicar o Planejamento de ${activePlanning.ano}? Isso tornará o calendário oficial para todo o ministério.`,
      confirmText: 'Publicar',
      cancelText: 'Cancelar'
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('agenda_planejamentos')
        .update({
          status: 'publicado',
          published_at: new Date().toISOString(),
          published_by: user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activePlanning.id);

      if (error) throw error;
      await registrarAcao({ acao: 'atualizar_status', modulo: 'agenda', tabela_afetada: 'agenda_planejamentos', registro_id: activePlanning.id });
      flash('ok', 'Planejamento publicado com sucesso!');
      loadPlanningInfo(ministryId, currentYear);

      // Sincronizar tema anual na Revista Pública
      triggerSyncPublicMagazine();
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao publicar planejamento.');
    }
  };

  const handleCriarPlanejamento = async (ano?: number) => {
    const targetAno = ano || currentYear;
    if (!ministryId) return;

    try {
      const { data: existing } = await supabase
        .from('agenda_planejamentos')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('ano', targetAno)
        .maybeSingle();

      if (existing) {
        flash('ok', `Planejamento para o ano ${targetAno} já existe.`);
        loadPlanningInfo(ministryId, targetAno);
        return;
      }

      const { data: newPlan, error } = await supabase
        .from('agenda_planejamentos')
        .insert({
          ministry_id: ministryId,
          ano: targetAno,
          nome: `Planejamento Anual ${targetAno}`,
          status: 'rascunho',
          created_by: user?.id || null,
        })
        .select('*')
        .single();

      if (error) throw error;
      await registrarAcao({
        acao: 'criar',
        modulo: 'agenda',
        tabela_afetada: 'agenda_planejamentos',
        registro_id: newPlan.id,
      });

      flash('ok', `Planejamento de ${targetAno} inicializado com sucesso!`);
      loadPlanningInfo(ministryId, targetAno);
    } catch (err: any) {
      console.error(err);
      flash('erro', err?.message || 'Erro ao inicializar planejamento.');
    }
  };

  const handleArchivePlanning = async () => {
    if (!activePlanning || !ministryId) return;
    const ok = await dialog.confirm({
      title: 'Arquivar Planejamento Anual',
      type: 'warning',
      message: `Tem certeza que deseja arquivar o Planejamento de ${activePlanning.ano}?`,
      confirmText: 'Arquivar',
      cancelText: 'Cancelar'
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('agenda_planejamentos')
        .update({
          status: 'arquivado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activePlanning.id);

      if (error) throw error;
      await registrarAcao({ acao: 'atualizar_status', modulo: 'agenda', tabela_afetada: 'agenda_planejamentos', registro_id: activePlanning.id });
      flash('ok', 'Planejamento arquivado.');
      loadPlanningInfo(ministryId, currentYear);

      // Sincronizar tema anual na Revista Pública
      triggerSyncPublicMagazine();
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao arquivar planejamento.');
    }
  };

  const handleDecidirSolicitacao = async (solId: string, decisao: 'aprovar' | 'rejeitar', parecerTexto: string) => {
    if (!ministryId) return;
    try {
      const statusFinal = decisao === 'aprovar' ? 'aprovado' : 'rejeitado';
      const payload = {
        status: statusFinal,
        tipo_decisao: decisao,
        parecer: parecerTexto.trim() || null,
        analisado_por: user?.id || null,
        analisado_em: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('agenda_solicitacoes')
        .update(payload)
        .eq('id', solId);

      if (error) throw error;
      flash('ok', `Solicitação julgada como ${statusFinal}!`);
      loadSolicitacoes(ministryId);
      loadEventos(ministryId);
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao julgar solicitação.');
    }
  };

  const getEscopoLabel = (escopoVal: string) => {
    if (!orgHelper) return escopoVal;
    if (escopoVal === 'organizacao') return orgHelper.label('organizacao');
    if (escopoVal === 'divisao1') return orgHelper.label('divisao1');
    if (escopoVal === 'divisao2') return orgHelper.label('divisao2');
    if (escopoVal === 'divisao3') return orgHelper.label('divisao3');
    return escopoVal;
  };

  const tiposAgrupados = useMemo(() => {
    const grupos: Record<string, AgendaTipo[]> = {
      culto: [],
      reuniao: [],
      evento: [],
      missoes: [],
      departamento: [],
      administrativo: [],
    };
    tipos.forEach(t => {
      if (grupos[t.categoria]) {
        grupos[t.categoria].push(t);
      }
    });
    return grupos;
  }, [tipos]);

  const totalCultos = useMemo(() => eventos.filter(e => e.tipo === 'culto' && e.status === 'agendado').length, [eventos]);
  const totalReunioes = useMemo(() => eventos.filter(e => e.tipo === 'reuniao' && e.status === 'agendado').length, [eventos]);
  const totalEventosOficiais = useMemo(() => eventos.filter(e => e.calendario_oficial && e.status === 'agendado').length, [eventos]);
  const totalEventosSincronizados = useMemo(() => eventos.filter(e => e.origem && e.origem !== 'manual' && e.origem !== '').length, [eventos]);

  const eventosFiltrados = useMemo(() => {
    let result = eventos;
    if (quickFilter === 'oficiais') result = result.filter(e => e.calendario_oficial);
    if (quickFilter === 'locais') result = result.filter(e => !e.calendario_oficial);
    if (quickFilter === 'bloqueados') result = result.filter(e => e.bloqueado);
    return result;
  }, [eventos, quickFilter]);

  const proximosEventos = useMemo(() => {
    const now = new Date();
    return eventosFiltrados
      .filter(e => e.status === 'agendado' && new Date(e.data_inicio) >= now)
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
      .slice(0, 5);
  }, [eventosFiltrados]);

  const daysInMonthArray = useMemo(() => {
    const [yearStr, monthStr] = filtroMes.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();

    const array: { dateStr: string | null; dayNum: number | null }[] = [];
    
    for (let i = 0; i < firstDayIndex; i++) {
      array.push({ dateStr: null, dayNum: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      array.push({ dateStr: dateString, dayNum: day });
    }

    return array;
  }, [filtroMes]);

  const eventosPorDia = useMemo(() => {
    const mapa: Record<string, AgendaEvento[]> = {};
    const [yearStr, monthStr] = filtroMes.split('-');
    const currentMonthPrefix = `${yearStr}-${monthStr.padStart(2, '0')}`;

    const getLocalDateStr = (val: string): string => {
      if (!val) return '';
      // Se for formato local 'YYYY-MM-DD...', extrai os 10 primeiros caracteres diretamente
      if (!val.includes('Z') && !val.includes('+') && !val.slice(11).includes('-')) {
        return val.slice(0, 10);
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return val.split('T')[0];
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    eventos.forEach(e => {
      const startDayStr = getLocalDateStr(e.data_inicio);
      const endDayStr = e.data_fim ? getLocalDateStr(e.data_fim) : startDayStr;

      // Se não há data_fim ou as datas são iguais no calendário local, mapeia diretamente no dia de início
      if (!e.data_fim || startDayStr === endDayStr) {
        if (!mapa[startDayStr]) mapa[startDayStr] = [];
        mapa[startDayStr].push(e);
        return;
      }

      // Para eventos com intervalo de múltiplos dias, mapear os dias pertinentes no fuso local
      const [sy, sm, sd] = startDayStr.split('-').map(Number);
      const [ey, em, ed] = endDayStr.split('-').map(Number);
      const cur = new Date(sy, sm - 1, sd);
      const endLimit = new Date(ey, em - 1, ed);

      while (cur <= endLimit) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const curStr = `${y}-${m}-${d}`;
        // Registrar nos dias do mês consultado
        if (curStr.startsWith(currentMonthPrefix)) {
          if (!mapa[curStr]) mapa[curStr] = [];
          mapa[curStr].push(e);
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return mapa;
  }, [eventos, filtroMes]);

  const eventosColunaDireita = useMemo(() => {
    const getLocalDateStr = (val: string): string => {
      if (!val) return '';
      if (!val.includes('Z') && !val.includes('+') && !val.slice(11).includes('-')) {
        return val.slice(0, 10);
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return val.split('T')[0];
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (selectedDate) {
      return eventos.filter(e => {
        const startDay = getLocalDateStr(e.data_inicio);
        const endDay = e.data_fim ? getLocalDateStr(e.data_fim) : startDay;
        return selectedDate >= startDay && selectedDate <= endDay;
      });
    }
    return [...eventos].sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
  }, [eventos, selectedDate]);

  const TABS = useMemo(() => {
    const base = [
      { id: 'calendario', label: 'Calendário', icon: CalendarIcon },
      { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
      { id: 'planejamento', label: 'Planejamento', icon: BookOpen },
    ] as const;
    if (isPresidenciaOrAdmin) {
      return [...base, { id: 'solicitacoes', label: 'Solicitações', icon: Gavel }] as const;
    }
    return base;
  }, [isPresidenciaOrAdmin]);

  return {
    ctx,
    bloqueado,
    planFeatures,
    activeTab,
    setActiveTab,
    currentDateFormatted,
    daysLeftInMonth,
    currentYear,
    currentMonth,
    MESES_PT,
    quickFilter,
    setQuickFilter,
    showAdvancedFilters,
    setShowAdvancedFilters,
    filtroTipoId,
    setFiltroTipoId,
    filtroCongregacao,
    setFiltroCongregacao,
    filtroVisibilidade,
    setFiltroVisibilidade,
    selectedDate,
    setSelectedDate,
    tiposAgrupados,
    CATEGORIAS_LABEL,
    STATUS_PLAN_INFO,
    TIPO_SOLICITACAO_LABEL,
    agendaVisualizada,
    setAgendaVisualizada,
    isSecretarioGeral,
    isSecretarioLocal,
    userCongregacaoId,
    canEditEvento,
    congregacoesAutorizadas,
    congregacoes,
    loadingCongregacoes,
    erroCongregacoes,
    orgHelper,
    eventos,
    loading,
    msg,
    totalCultos,
    totalReunioes,
    totalEventosOficiais,
    totalEventosSincronizados,
    isEscritaPermitida,
    isAdmin,
    isPresidenciaOrAdmin,
    daysInMonthArray,
    eventosPorDia,
    eventosColunaDireita,
    proximosEventos,
    TABS,
    activePlanning,
    planningEventCount,
    responsibleEmail,
    solicitacoes,
    loadingSols,
    showModal,
    setShowModal,
    saving,
    editEvento,
    showAdvancedFormFields,
    setShowAdvancedFormFields,
    form,
    setForm,
    showTiposModal,
    setShowTiposModal,
    tipos,
    novoTipoNome,
    setNovoTipoNome,
    novoTipoCategoria,
    setNovoTipoCategoria,
    novoTipoCor,
    setNovoTipoCor,
    novoTipoBloqueio,
    setNovoTipoBloqueio,
    isSalvandoTipo,
    deleteConfirmTarget,
    setDeleteConfirmTarget,
    handlePrevMonth,
    handleNextMonth,
    handleGoToToday,
    openForm,
    handleTipoChange,
    handleSave,
    handleDelete,
    confirmDeleteAction,
    handleCriarTipo,
    handleDeletarTipo,
    handlePublishPlanning,
    handleArchivePlanning,
    handleCriarPlanejamento,
    handleDecidirSolicitacao,
    getEscopoLabel,
  };
}
