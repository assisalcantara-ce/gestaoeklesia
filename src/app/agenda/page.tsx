'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import DashboardContent from '@/components/dashboard/DashboardContent';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardSection from '@/components/dashboard/DashboardSection';
import DashboardActions from '@/components/dashboard/DashboardActions';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  Plus, Pencil, Trash2, Calendar as CalendarIcon, X,
  AlertTriangle, Check, Archive,
  ChevronLeft, ChevronRight, Filter, LayoutDashboard,
  BookOpen, TrendingUp, ChevronDown, ChevronUp,
  CheckCircle2, CalendarRange, Gavel, ShieldCheck, Lock, Clock, Calendar, Flame
} from 'lucide-react';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { OrganizationalService, getOrgHelpers, OrgStructure } from '@/lib/organizational-service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { PlanningConflictService } from '@/lib/planning-conflict-service';
import { ORIGEM_LABELS } from '@/lib/agenda-sync-service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface AgendaTipo {
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

interface AgendaPlanejamento {
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

interface AgendaEvento {
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

interface Congregacao {
  id: string;
  nome: string;
}

interface SolicitacaoExcecao {
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

const CATEGORIAS_LABEL = {
  culto: 'Cultos',
  reuniao: 'Reuniões',
  evento: 'Eventos',
  missoes: 'Missões',
  departamento: 'Departamentos',
  administrativo: 'Administrativo',
};

const STATUS_PLAN_INFO = {
  rascunho: { label: 'Rascunho', cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  publicado: { label: 'Publicado', cor: 'bg-blue-50 text-blue-700 border-blue-200' },
  arquivado: { label: 'Arquivado', cor: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const TIPO_SOLICITACAO_LABEL = {
  conflito_data: 'Conflito de Data',
  alteracao_data: 'Alteração de Data',
  alteracao_escopo: 'Alteração de Escopo',
  coexistencia: 'Coexistência de Eventos',
  criacao_evento: 'Criação de Evento Extra',
};

const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

type QuickFilter = 'todos' | 'oficiais' | 'locais' | 'bloqueados';

export default function AgendaPage() {
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

  // Tab inicial padrão restaurada para CALENDÁRIO conforme Sprint UX 2.0
  const [activeTab, setActiveTab] = useState<'calendario' | 'dashboard' | 'planejamento' | 'solicitacoes'>('calendario');

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [tipos, setTipos] = useState<AgendaTipo[]>([]);
  const [eventos, setEventos] = useState<AgendaEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [orgStructure, setOrgStructure] = useState<OrgStructure | null>(null);

  // Informações do Planejamento
  const [activePlanning, setActivePlanning] = useState<AgendaPlanejamento | null>(null);
  const [planningEventCount, setPlanningEventCount] = useState<number>(0);
  const [responsibleEmail, setResponsibleEmail] = useState<string | null>(null);

  // Solicitações carregadas dinamicamente se o usuário for administrador ou presidência
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoExcecao[]>([]);
  const [loadingSols, setLoadingSols] = useState(false);

  // Filtros de Agenda
  const [filtroMes, setFiltroMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filtroTipoId, setFiltroTipoId] = useState<string>('');
  const [filtroCongregacao, setFiltroCongregacao] = useState<string>('');
  const [filtroVisibilidade, setFiltroVisibilidade] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // Filtro de dia selecionado no calendário

  // Modais / Formulário
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
    local: '',
    visibilidade: 'ministerio' as AgendaEvento['visibilidade'],
    church_id: '',
    status: 'agendado' as AgendaEvento['status'],
    escopo: 'divisao1' as AgendaEvento['escopo'],
    calendario_oficial: false,
    gera_bloqueio: false,
    regra_posicionamento: '' as string,
  });

  const currentYear = parseInt(filtroMes.split('-')[0], 10);
  const currentMonth = parseInt(filtroMes.split('-')[1], 10);
  const isEdicaoBloqueada = activePlanning?.status === 'publicado' || activePlanning?.status === 'arquivado';
  const isEscritaPermitida = (ctx.nivel === 'administrador' || ctx.nivel === 'secretaria_local' || ctx.nivel === 'presidencia') && !isEdicaoBloqueada;
  const isAdmin = ctx.nivel === 'administrador';
  const isPresidenciaOrAdmin = ctx.nivel === 'administrador' || ctx.nivel === 'presidencia';
  const orgHelper = orgStructure ? getOrgHelpers(orgStructure) : null;

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  // Carrega congregações
  const loadCongregacoes = useCallback(async (mid: string) => {
    const { data } = await supabase
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', mid)
      .order('nome');
    setCongregacoes(data ?? []);
  }, [supabase]);

  // Carrega tipos de compromissos
  const loadTipos = useCallback(async (mid: string) => {
    let { data } = await supabase
      .from('agenda_tipos')
      .select('*')
      .eq('ministry_id', mid)
      .eq('ativo', true)
      .order('ordem')
      .order('nome');

    if ((!data || data.length === 0) && mid) {
      // Se não houver tipos cadastrados para o ministério, executa a RPC de sementes padrão
      const { error: rpcError } = await supabase.rpc('seed_agenda_tipos_padrao', {
        p_ministry_id: mid
      });
      if (!rpcError) {
        const { data: newData } = await supabase
          .from('agenda_tipos')
          .select('*')
          .eq('ministry_id', mid)
          .eq('ativo', true)
          .order('ordem')
          .order('nome');
        data = newData;
      }
    }

    setTipos(data ?? []);
  }, [supabase]);

  // Carrega dados do planejamento anual
  const loadPlanningData = useCallback(async (mid: string, year: number) => {
    try {
      const { data: plan, error } = await supabase
        .from('agenda_planejamentos')
        .select('*')
        .eq('ministry_id', mid)
        .eq('ano', year)
        .maybeSingle();

      if (error) throw error;

      setActivePlanning(plan ?? null);

      if (plan) {
        const { count, error: countErr } = await supabase
          .from('agenda_eventos')
          .select('id', { count: 'exact', head: true })
          .eq('planejamento_id', plan.id);

        if (!countErr) {
          setPlanningEventCount(count ?? 0);
        }

        if (plan.published_by) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', plan.published_by)
            .maybeSingle();
          setResponsibleEmail(userProfile?.display_name ?? 'Responsável');
        } else {
          setResponsibleEmail(null);
        }
      } else {
        setPlanningEventCount(0);
        setResponsibleEmail(null);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do planejamento:', err);
    }
  }, [supabase]);

  // Carrega solicitações (para a aba de solicitações integrada)
  const loadSolicitacoes = useCallback(async (mid: string) => {
    if (!isPresidenciaOrAdmin) return;
    setLoadingSols(true);
    try {
      const { data, error } = await supabase
        .from('agenda_solicitacoes')
        .select('*')
        .eq('ministry_id', mid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const resolved = await Promise.all((data as SolicitacaoExcecao[] ?? []).map(async (item) => {
        if (item.conflito_id) {
          const { data: cEvt } = await supabase
            .from('agenda_eventos')
            .select('titulo')
            .eq('id', item.conflito_id)
            .maybeSingle();
          return { ...item, conflito_evento: cEvt };
        }
        return item;
      }));
      setSolicitacoes(resolved);
    } catch (err) {
      console.error('Erro ao buscar solicitacoes:', err);
    } finally {
      setLoadingSols(false);
    }
  }, [supabase, isPresidenciaOrAdmin]);

  // Carrega eventos filtrados
  const loadEventos = useCallback(async (mid: string) => {
    setLoading(true);
    try {
      const [ano, mes] = filtroMes.split('-');
      const startOfMonth = `${ano}-${mes}-01T00:00:00.000Z`;
      
      const nextMonthInt = parseInt(mes, 10) === 12 ? 1 : parseInt(mes, 10) + 1;
      const nextMonthYear = parseInt(mes, 10) === 12 ? parseInt(ano, 10) + 1 : parseInt(ano, 10);
      const endOfMonth = `${nextMonthYear}-${String(nextMonthInt).padStart(2, '0')}-01T00:00:00.000Z`;

      let query = supabase
        .from('agenda_eventos')
        .select('*, agenda_tipos(*), agenda_planejamentos(*)')
        .eq('ministry_id', mid)
        .gte('data_inicio', startOfMonth)
        .lt('data_inicio', endOfMonth);

      if (filtroTipoId) query = query.eq('tipo_id', filtroTipoId);
      if (filtroCongregacao) query = query.eq('church_id', filtroCongregacao);
      if (filtroVisibilidade) query = query.eq('visibilidade', filtroVisibilidade);

      const { data, error } = await query.order('data_inicio', { ascending: true });

      if (error) throw error;
      setEventos((data as AgendaEvento[]) ?? []);
    } catch (err: any) {
      console.error('Erro ao buscar eventos:', err);
      flash('erro', 'Erro ao carregar os compromissos da agenda.');
    } finally {
      setLoading(false);
    }
  }, [supabase, filtroMes, filtroTipoId, filtroCongregacao, filtroVisibilidade]);

  useEffect(() => {
    if (!user || bloqueado) return;
    resolveMinistryId(supabase).then((mid) => {
      if (mid) {
        setMinistryId(mid);
        loadCongregacoes(mid);
        loadTipos(mid);
        loadSolicitacoes(mid);
        OrganizationalService.getEstrutura(supabase).then(setOrgStructure);
      }
    });
  }, [user, bloqueado, supabase, loadCongregacoes, loadTipos, loadSolicitacoes]);

  useEffect(() => {
    if (ministryId) {
      loadEventos(ministryId);
      loadPlanningData(ministryId, currentYear);
      loadSolicitacoes(ministryId);
    }
  }, [ministryId, loadEventos, loadPlanningData, loadSolicitacoes, currentYear]);

  // Navegação de meses
  const handlePrevMonth = () => {
    const [anoStr, mesStr] = filtroMes.split('-');
    let ano = parseInt(anoStr, 10);
    let mes = parseInt(mesStr, 10) - 1;
    if (mes === 0) {
      mes = 12;
      ano -= 1;
    }
    setFiltroMes(`${ano}-${String(mes).padStart(2, '0')}`);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    const [anoStr, mesStr] = filtroMes.split('-');
    let ano = parseInt(anoStr, 10);
    let mes = parseInt(mesStr, 10) + 1;
    if (mes === 13) {
      mes = 1;
      ano += 1;
    }
    setFiltroMes(`${ano}-${String(mes).padStart(2, '0')}`);
    setSelectedDate(null);
  };

  const handleGoToToday = () => {
    const now = new Date();
    setFiltroMes(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setSelectedDate(now.toISOString().split('T')[0]);
  };

  // Abrir Modal de Cadastro
  const openForm = (evt: AgendaEvento | null = null) => {
    if (!isEscritaPermitida) {
      flash('erro', 'Ações de escrita estão bloqueadas porque este planejamento anual já está publicado/arquivado.');
      return;
    }
    if (evt?.bloqueado && evt?.origem && evt.origem !== 'manual' && evt.origem !== '') {
      const moduloLabel = ORIGEM_LABELS[evt.origem as keyof typeof ORIGEM_LABELS] ?? evt.origem;
      flash('erro', `Este compromisso é gerenciado pelo módulo ${moduloLabel}. Edite-o diretamente neste módulo.`);
      return;
    }
    setEditEvento(evt);
    setShowAdvancedFormFields(false);
    if (evt) {
      const toLocalISO = (dStr: string) => {
        const d = new Date(dStr);
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      };

      setForm({
        titulo: evt.titulo,
        descricao: evt.descricao ?? '',
        tipo_id: evt.tipo_id ?? '',
        data_inicio: toLocalISO(evt.data_inicio),
        data_fim: evt.data_fim ? toLocalISO(evt.data_fim) : '',
        local: evt.local ?? '',
        visibilidade: evt.visibilidade,
        church_id: evt.church_id ?? '',
        status: evt.status,
        escopo: evt.escopo ?? 'divisao1',
        calendario_oficial: evt.calendario_oficial ?? false,
        gera_bloqueio: evt.gera_bloqueio ?? false,
        regra_posicionamento: evt.regra_posicionamento ?? '',
      });
    } else {
      const now = new Date();
      let initialDateStr = '';
      if (selectedDate) {
        // Se houver um dia selecionado no calendário, inicia o form com esse dia
        const selectD = new Date(selectedDate);
        selectD.setHours(now.getHours(), now.getMinutes());
        const tzOffset = selectD.getTimezoneOffset() * 60000;
        initialDateStr = new Date(selectD.getTime() - tzOffset).toISOString().slice(0, 16);
      } else {
        const tzOffset = now.getTimezoneOffset() * 60000;
        initialDateStr = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
      }
      const defaultTipoId = tipos.length > 0 ? tipos[0].id : '';

      setForm({
        titulo: '',
        descricao: '',
        tipo_id: defaultTipoId,
        data_inicio: initialDateStr,
        data_fim: '',
        local: '',
        visibilidade: 'ministerio',
        church_id: '',
        status: 'agendado',
        escopo: 'divisao1',
        calendario_oficial: false,
        gera_bloqueio: false,
        regra_posicionamento: '',
      });
    }
    setShowModal(true);
  };

  const handleTipoChange = (typeId: string) => {
    const selected = tipos.find(t => t.id === typeId);
    setForm(prev => ({
      ...prev,
      tipo_id: typeId,
      gera_bloqueio: selected ? selected.gera_bloqueio : false,
    }));
  };

  // Salvar Evento
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryId || !isEscritaPermitida) return;
    if (!form.titulo.trim() || !form.data_inicio || !form.tipo_id) {
      flash('erro', 'Título, Tipo e Data de Início são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const selectedType = tipos.find(t => t.id === form.tipo_id);
      if (!selectedType) {
        flash('erro', 'Tipo de compromisso selecionado é inválido.');
        setSaving(false);
        return;
      }

      const selectedYear = new Date(form.data_inicio).getFullYear();

      // Garantir existência de Planejamento Anual
      let { data: plan } = await supabase
        .from('agenda_planejamentos')
        .select('id, status')
        .eq('ministry_id', ministryId)
        .eq('ano', selectedYear)
        .maybeSingle();

      if (plan && (plan.status === 'publicado' || plan.status === 'arquivado')) {
        flash('erro', 'Não é possível adicionar eventos a um planejamento publicado ou arquivado.');
        setSaving(false);
        return;
      }

      if (!plan) {
        const { data: newPlan, error: createErr } = await supabase
          .from('agenda_planejamentos')
          .insert({
            ministry_id: ministryId,
            ano: selectedYear,
            nome: `Planejamento Anual ${selectedYear}`,
            status: 'rascunho',
            created_by: user?.id || null,
          })
          .select('id')
          .single();

        if (createErr) throw createErr;
        plan = newPlan;
      }

      const planejamentoId = plan.id;

      let calculatedPrioridade = 4;
      if (form.escopo === 'organizacao') calculatedPrioridade = 1;
      else if (form.escopo === 'divisao3') calculatedPrioridade = 2;
      else if (form.escopo === 'divisao2') calculatedPrioridade = 3;
      else if (form.escopo === 'divisao1') calculatedPrioridade = 4;

      // Validação Inteligente de Conflitos
      const checkResult = await PlanningConflictService.verificarConflito(
        supabase,
        {
          titulo: form.titulo,
          data_inicio: new Date(form.data_inicio).toISOString(),
          data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
          planejamento_id: planejamentoId,
          tipo_id: form.tipo_id,
          escopo: form.escopo,
          prioridade: calculatedPrioridade,
          calendario_oficial: form.calendario_oficial,
          gera_bloqueio: form.gera_bloqueio,
        },
        editEvento ? editEvento.id : null
      );

      if (checkResult.status === 'BLOQUEIO') {
        await registrarAcao({
          acao: 'outro',
          modulo: 'agenda',
          area: 'conflito',
          tabela_afetada: 'agenda_eventos',
          registro_id: editEvento ? editEvento.id : undefined,
          descricao: `Tentativa de agendamento bloqueada: ${checkResult.motivo}`,
          status: 'aviso'
        });

        const requestException = await dialog.confirm({
          title: 'Bloqueio de Agenda por Conflito',
          message: `${checkResult.motivo} Deseja encaminhar uma solicitação formal de exceção à Presidência?`,
          confirmText: 'Solicitar Exceção',
          cancelText: 'Cancelar',
          type: 'warning'
        });

        if (requestException) {
          const justificativa = prompt('Justificativa para a solicitação de exceção:', '');
          if (justificativa && justificativa.trim()) {
            try {
              const { error: solicitError } = await supabase
                .from('agenda_solicitacoes')
                .insert({
                  ministry_id: ministryId,
                  planejamento_id: planejamentoId,
                  solicitante_id: user?.id || null,
                  tipo_solicitacao: 'conflito_data',
                  escopo: form.escopo,
                  titulo: form.titulo.trim(),
                  justificativa: justificativa.trim(),
                  data_inicio: new Date(form.data_inicio).toISOString(),
                  data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
                  conflito_id: checkResult.conflito?.id || null,
                  status: 'pendente'
                });
              
              if (solicitError) throw solicitError;

              await registrarAcao({
                acao: 'criar',
                modulo: 'agenda',
                area: 'solicitacao_excecao',
                tabela_afetada: 'agenda_solicitacoes',
                descricao: `Solicitação de exceção criada para o evento "${form.titulo}" em virtude de conflito.`,
              });

              flash('ok', 'Solicitação de exceção encaminhada com sucesso à Presidência!');
              loadSolicitacoes(ministryId);
            } catch (err: any) {
              console.error(err);
              flash('erro', 'Erro ao registrar solicitação de exceção.');
            }
          } else {
            flash('erro', 'A justificativa é obrigatória para registrar a solicitação.');
          }
        }

        setSaving(false);
        return;
      }

      if (checkResult.status === 'AVISO') {
        const confirmSave = await dialog.confirm({
          title: 'Conflito de Agenda Detectado',
          message: checkResult.motivo || 'Existe uma duplicidade neste horário. Deseja salvar mesmo assim?',
          confirmText: 'Salvar Mesmo Assim',
          cancelText: 'Cancelar',
          type: 'warning'
        });

        if (!confirmSave) {
          setSaving(false);
          return;
        }

        await registrarAcao({
          acao: 'outro',
          modulo: 'agenda',
          area: 'conflito',
          tabela_afetada: 'agenda_eventos',
          registro_id: editEvento ? editEvento.id : undefined,
          descricao: `Aviso de conflito ignorado pelo usuário: ${checkResult.motivo}`,
          status: 'aviso'
        });
      }

      let legacyTipo: AgendaEvento['tipo'] = 'outro';
      if (selectedType.categoria === 'culto') legacyTipo = 'culto';
      else if (selectedType.categoria === 'reuniao') legacyTipo = 'reuniao';
      else if (selectedType.categoria === 'evento') legacyTipo = 'evento';
      else if (selectedType.categoria === 'missoes') legacyTipo = 'evento';
      else if (selectedType.categoria === 'departamento') legacyTipo = 'reuniao';
      else if (selectedType.categoria === 'administrativo') legacyTipo = 'tarefa';

      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        tipo: legacyTipo,
        tipo_id: form.tipo_id,
        planejamento_id: planejamentoId,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        local: form.local.trim() || null,
        visibilidade: form.visibilidade,
        church_id: form.church_id || null,
        status: form.status,
        escopo: form.escopo,
        prioridade: calculatedPrioridade,
        calendario_oficial: form.calendario_oficial,
        gera_bloqueio: form.gera_bloqueio,
        regra_posicionamento: form.regra_posicionamento || null,
        ministry_id: ministryId,
      };

      let error;
      if (editEvento) {
        const { error: err } = await supabase
          .from('agenda_eventos')
          .update(payload)
          .eq('id', editEvento.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('agenda_eventos')
          .insert({ ...payload, created_by: user?.id || null });
        error = err;
      }

      if (error) throw error;

      flash('ok', editEvento ? 'Compromisso atualizado!' : 'Compromisso criado!');
      setShowModal(false);
      loadEventos(ministryId);
      loadPlanningData(ministryId, currentYear);
    } catch (err: any) {
      console.error(err);
      flash('erro', 'Erro ao salvar compromisso.');
    } finally {
      setSaving(false);
    }
  };

  // Excluir Evento
  const handleDelete = async (evt: AgendaEvento) => {
    if (!isEscritaPermitida || evt.bloqueado) return;
    if (evt.status !== 'agendado') {
      flash('erro', 'Apenas compromissos com status "Agendado" podem ser excluídos.');
      return;
    }

    const ok = await dialog.confirm({
      title: 'Excluir Compromisso',
      message: `Tem certeza que deseja excluir o compromisso "${evt.titulo}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'warning',
    });

    if (ok) {
      try {
        const { error } = await supabase
          .from('agenda_eventos')
          .delete()
          .eq('id', evt.id);

        if (error) throw error;
        flash('ok', 'Compromisso excluído!');
        if (ministryId) {
          loadEventos(ministryId);
          loadPlanningData(ministryId, currentYear);
        }
      } catch (err: any) {
        console.error(err);
        flash('erro', 'Erro ao excluir compromisso.');
      }
    }
  };



  // Ação: Publicar Planejamento
  const handlePublishPlanning = async () => {
    if (!ministryId || !activePlanning || activePlanning.status !== 'rascunho') return;

    const ok = await dialog.confirm({
      title: 'Publicar Planejamento Anual',
      message: `Deseja realmente PUBLICAR o Planejamento Oficial de ${activePlanning.ano}? Após a publicação, a agenda anual ficará travada para alterações normais.`,
      confirmText: 'Confirmar Publicação',
      cancelText: 'Cancelar',
      type: 'info',
    });

    if (ok) {
      try {
        const { error } = await supabase
          .from('agenda_planejamentos')
          .update({
            status: 'publicado',
            published_at: new Date().toISOString(),
            published_by: user?.id || null,
          })
          .eq('id', activePlanning.id);

        if (error) throw error;

        await registrarAcao({
          acao: 'atualizar_status',
          modulo: 'agenda',
          area: 'planejamento',
          tabela_afetada: 'agenda_planejamentos',
          registro_id: activePlanning.id,
          descricao: `Publicou oficialmente o Planejamento Anual de ${activePlanning.ano}.`,
        });

        flash('ok', `Planejamento de ${activePlanning.ano} publicado!`);
        loadPlanningData(ministryId, currentYear);
        loadEventos(ministryId);
      } catch (err: any) {
        console.error(err);
        flash('erro', 'Erro ao publicar o planejamento.');
      }
    }
  };

  // Ação: Arquivar Planejamento
  const handleArchivePlanning = async () => {
    if (!ministryId || !activePlanning || activePlanning.status === 'arquivado') return;

    const ok = await dialog.confirm({
      title: 'Arquivar Planejamento Anual',
      message: `Deseja realmente ARQUIVAR o Planejamento de ${activePlanning.ano}? Esta ação moverá o calendário inteiro para modo somente-leitura histórico.`,
      confirmText: 'Arquivar',
      cancelText: 'Voltar',
      type: 'warning',
    });

    if (ok) {
      try {
        const { error } = await supabase
          .from('agenda_planejamentos')
          .update({ status: 'arquivado' })
          .eq('id', activePlanning.id);

        if (error) throw error;

        await registrarAcao({
          acao: 'atualizar_status',
          modulo: 'agenda',
          area: 'planejamento',
          tabela_afetada: 'agenda_planejamentos',
          registro_id: activePlanning.id,
          descricao: `Arquivou o Planejamento Anual de ${activePlanning.ano}.`,
        });

        flash('ok', `Planejamento de ${activePlanning.ano} arquivado!`);
        loadPlanningData(ministryId, currentYear);
        loadEventos(ministryId);
      } catch (err: any) {
        console.error(err);
        flash('erro', 'Erro ao arquivar o planejamento.');
      }
    }
  };

  // Julgamento de solicitação administrativa integrado na aba
  const handleDecidirSolicitacao = async (solId: string, tipoDecisao: 'aprovar' | 'rejeitar', parecer: string) => {
    if (!ministryId || !isPresidenciaOrAdmin) return;
    try {
      const statusFinal = tipoDecisao === 'rejeitar' ? 'rejeitado' : 'aprovado';
      const payload = {
        status: statusFinal,
        tipo_decisao: tipoDecisao,
        efeito: statusFinal === 'rejeitado' ? null : 'autorizar_evento',
        vigencia_tipo: 'unica',
        parecer: parecer.trim() || `Solicitação julgada administrativamente como: ${tipoDecisao}`,
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

  // ─── Métricas de Dashboard (KPIs Compactos Ministeriais) ───────────────────
  const totalCultos = useMemo(() => eventos.filter(e => e.tipo === 'culto' && e.status === 'agendado').length, [eventos]);
  const totalReunioes = useMemo(() => eventos.filter(e => e.tipo === 'reuniao' && e.status === 'agendado').length, [eventos]);
  const totalEventosOficiais = useMemo(() => eventos.filter(e => e.calendario_oficial && e.status === 'agendado').length, [eventos]);
  const totalEventosSincronizados = useMemo(() => eventos.filter(e => e.origem && e.origem !== 'manual' && e.origem !== '').length, [eventos]);

  // Eventos Filtrados para listagem/calendário (filtrando também quando há busca ativa ou quickFilter)
  const eventosFiltrados = useMemo(() => {
    let result = eventos;
    if (quickFilter === 'oficiais') result = result.filter(e => e.calendario_oficial);
    if (quickFilter === 'locais') result = result.filter(e => !e.calendario_oficial);
    if (quickFilter === 'bloqueados') result = result.filter(e => e.bloqueado);
    return result;
  }, [eventos, quickFilter]);

  // Próximos Eventos em ordem cronológica (sempre filtrados ou do mês)
  const proximosEventos = useMemo(() => {
    const now = new Date();
    return eventosFiltrados
      .filter(e => e.status === 'agendado' && new Date(e.data_inicio) >= now)
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
      .slice(0, 5);
  }, [eventosFiltrados]);

  // ─── LÓGICA DO CALENDÁRIO COMPACTO MENSAL ──────────────────────────────────
  const daysInMonthArray = useMemo(() => {
    const [yearStr, monthStr] = filtroMes.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Domingo

    const array: { dateStr: string | null; dayNum: number | null }[] = [];
    
    // Fill blank spaces for previous month
    for (let i = 0; i < firstDayIndex; i++) {
      array.push({ dateStr: null, dayNum: null });
    }

    // Fill days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      array.push({ dateStr: dateString, dayNum: day });
    }

    return array;
  }, [filtroMes]);

  // Eventos por dia do calendário
  const eventosPorDia = useMemo(() => {
    const mapa: Record<string, AgendaEvento[]> = {};
    eventos.forEach(e => {
      const dayStr = e.data_inicio.split('T')[0];
      if (!mapa[dayStr]) mapa[dayStr] = [];
      mapa[dayStr].push(e);
    });
    return mapa;
  }, [eventos]);

  // Eventos exibidos na coluna da direita com base na seleção do calendário
  const eventosColunaDireita = useMemo(() => {
    if (selectedDate) {
      return eventos.filter(e => e.data_inicio.startsWith(selectedDate));
    }
    // Se nenhum dia estiver clicado, exibe os eventos da semana/mês atual ordenados
    return eventos.sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
  }, [eventos, selectedDate]);

  // Abas conforme Sprint UX 2.0 (ordem: Calendário, Visão Geral, Planejamento, Solicitações se admin/presidencia)
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

  if (ctx.loading || planFeatures.loading) {
    return <div className="p-8 text-gray-500">Carregando...</div>;
  }

  if (bloqueado || !planFeatures.has_modulo_agenda) {
    return null;
  }

  return (
    <DashboardContainer>
      <DashboardHeader
        title="Agenda Ministerial"
        description="Planejamento e coordenação de datas e agendas integradas"
        contextSubtitle="Planejamento Ministerial"
        greeting="Gestão Ministerial"
        currentDate={currentDateFormatted}
        centerContent={
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
            <span className="text-slate-600 font-extrabold uppercase">
              {MESES_PT[currentMonth - 1].toUpperCase()} DE {currentYear}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 font-semibold">
              <span className="font-bold text-slate-500">{eventos.length}</span> COMPROMISSOS
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 font-semibold">
              <span className="font-bold text-slate-500">{totalCultos}</span> CULTOS
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 font-semibold">
              <span className="font-bold text-slate-500">{totalReunioes}</span> REUNIÕES
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 font-semibold">
              <span className="font-bold text-slate-500">{totalEventosSincronizados}</span> SINCRONIZAÇÕES
            </span>
          </div>
        }
        actions={
          isEscritaPermitida ? (
            <DashboardActions>
              <button
                onClick={() => openForm(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Compromisso
              </button>
            </DashboardActions>
          ) : undefined
        }
        extra={
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSelectedDate(null);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 font-bold text-xs tracking-wide uppercase transition border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        }
      />

      <DashboardContent>

        {/* ─── KPIS GLOBAIS DO MÓDULO (Executive Summary) ──────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ExecutiveMetricCard
            title="Oficiais"
            value={totalEventosOficiais}
            icon={ShieldCheck}
            color="indigo"
            subtitle="Calendário Oficial da Igreja"
          />

          <ExecutiveMetricCard
            title="Compromissos"
            value={eventos.length}
            icon={Calendar}
            color="slate"
            subtitle="Agendados para este mês"
          />

          <ExecutiveMetricCard
            title="Cultos & Reuniões"
            value={totalCultos + totalReunioes}
            icon={Flame}
            color="emerald"
            subtitle={`${totalCultos} Cultos e ${totalReunioes} Reuniões`}
          />

          <ExecutiveMetricCard
            title="Sincronizados"
            value={totalEventosSincronizados}
            icon={Lock}
            color="rose"
            subtitle="Integrados de outros módulos"
          />
        </div>

        {/* ─── CONTROL BAR ÚNICA (integrada, sem card isolado) ──────────────────── */}
      {activeTab === 'calendario' && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
          
          {/* Navegação de Mês/Ano compacta */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200/70 shadow-xs">
            <button onClick={handlePrevMonth} className="px-2 py-1 hover:bg-slate-50 rounded text-slate-700 text-xs font-black transition">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-black text-slate-800 px-1.5 min-w-[110px] text-center">
              {MESES_PT[currentMonth - 1].toUpperCase()} {currentYear}
            </span>
            <button onClick={handleNextMonth} className="px-2 py-1 hover:bg-slate-50 rounded text-slate-700 text-xs font-black transition">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filtros Rápidos (Pills compactos) */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => handleGoToToday()}
              className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/70 rounded-lg text-xs font-bold transition shrink-0 shadow-xs"
            >
              Hoje
            </button>
            {([
              { key: 'todos', label: 'Todos' },
              { key: 'oficiais', label: '🔵 Oficiais' },
              { key: 'locais', label: '🟢 Locais' },
              { key: 'bloqueados', label: '🔴 Gerenciados' },
            ] as { key: QuickFilter; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition shrink-0 ${
                  quickFilter === f.key
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-600 border-slate-200/70 hover:border-slate-300 shadow-xs'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Trigger Filtros Avançados */}
          <button
            onClick={() => setShowAdvancedFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-bold transition ${
              showAdvancedFilters || filtroTipoId || filtroCongregacao || filtroVisibilidade
                ? 'border-blue-200 text-blue-600 bg-blue-50'
                : 'border-slate-200/70 text-slate-500 bg-white hover:bg-slate-50 shadow-xs'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {showAdvancedFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      )}

      {/* Filtros Avançados Recolhíveis */}
      {activeTab === 'calendario' && showAdvancedFilters && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo de Compromisso</label>
            <select
              value={filtroTipoId}
              onChange={(e) => setFiltroTipoId(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
            >
              <option value="">Todos</option>
              {Object.entries(tiposAgrupados).map(([categoria, lista]) => {
                if (lista.length === 0) return null;
                return (
                  <optgroup key={categoria} label={CATEGORIAS_LABEL[categoria as keyof typeof CATEGORIAS_LABEL]}>
                    {lista.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {orgHelper ? orgHelper.label('divisao1') : 'Congregação'}
            </label>
            <select
              value={filtroCongregacao}
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
            >
              <option value="">Todas</option>
              {congregacoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Visibilidade</label>
            <select
              value={filtroVisibilidade}
              onChange={(e) => setFiltroVisibilidade(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
            >
              <option value="">Todas</option>
              <option value="privado">Privado</option>
              <option value="lideranca">Liderança</option>
              <option value="igreja">Membros</option>
              <option value="ministerio">Ministério</option>
              <option value="publico">Público</option>
            </select>
          </div>
        </div>
      )}

      {/* ─── Feedback Alert ──────────────────────────────────────────────── */}
      {msg && (
        <div className={`p-3 mb-4 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
          msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-150' : 'bg-rose-50 text-rose-800 border-rose-150'
        }`}>
          {msg.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
          {msg.texto}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: CALENDÁRIO MENSAL (Elemento Principal em 2 colunas)          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calendario' && (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          
          {/* LADO ESQUERDO: Calendário Mensal — superfície flat integrada */}
          <DashboardSection
            title="Calendário Mensal"
            icon={CalendarIcon}
            className="flex-1 min-w-0 !shadow-none !border-slate-200/50"
          >
            {/* Cabeçalho da grade de dias da semana */}
            <div className="grid grid-cols-7 gap-1 text-center font-black text-slate-400 text-[10px] tracking-wider mb-2">
              <span>DOM</span>
              <span>SEG</span>
              <span>TER</span>
              <span>QUA</span>
              <span>QUI</span>
              <span>SEX</span>
              <span>SÁB</span>
            </div>

            {/* Grade de Dias */}
            <div className="grid grid-cols-7 gap-1">
              {daysInMonthArray.map((day, idx) => {
                if (day.dayNum === null) {
                  return <div key={`empty-${idx}`} className="min-h-[56px] sm:min-h-[64px] bg-slate-50/50 rounded-md" />;
                }

                const dateStr = day.dateStr!;
                const diaEventos = eventosPorDia[dateStr] ?? [];
                const isSelected = selectedDate === dateStr;
                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`min-h-[56px] sm:min-h-[64px] p-1.5 rounded-md flex flex-col justify-between items-center border transition relative ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                        : isToday
                          ? 'bg-blue-50/50 border-blue-200/60 text-blue-800'
                          : 'bg-white border-slate-100/70 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {/* Número do dia */}
                    <span className="text-xs font-semibold text-center w-full block">{day.dayNum}</span>

                    {/* Dot indicators (Oficiais/Locais/Sincronizados) */}
                    <div className="flex gap-0.5 justify-center mt-auto w-full">
                      {diaEventos.slice(0, 3).map(e => {
                        let dotColor = 'bg-slate-400';
                        if (e.calendario_oficial) dotColor = 'bg-indigo-500';
                        else if (e.bloqueado) dotColor = 'bg-rose-500';
                        else dotColor = 'bg-emerald-500';

                        return (
                          <span
                            key={e.id}
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : dotColor}`}
                          />
                        );
                      })}
                      {diaEventos.length > 3 && (
                        <span className={`text-[8px] font-black leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                          +
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legenda compacta */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-bold justify-center">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Oficial
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Local
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Sincronizado/Bloqueado
              </span>
            </div>
          </DashboardSection>

          {/* LADO DIREITO: Sidebar integrada — painel de apoio conectado */}
          <DashboardSidebar className="w-full lg:w-[320px] lg:border-l lg:border-slate-200/50 lg:pl-5">
            
            {/* Próximos compromissos lateral */}
            <DashboardSection
              title={selectedDate ? `Eventos de ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Compromissos do Mês'}
              icon={CalendarRange}
              iconClassName="text-slate-400"
              className="!p-5"
              actions={
                selectedDate ? (
                  <button onClick={() => setSelectedDate(null)} className="text-[10px] text-blue-600 hover:text-blue-700 font-extrabold hover:underline">
                    Ver todos
                  </button>
                ) : undefined
              }
            >
              {loading ? (
                <div className="text-xs text-slate-400 text-center py-10">Carregando eventos...</div>
              ) : eventosColunaDireita.length === 0 ? (
                <DashboardEmptyState
                  icon={CalendarIcon}
                  title="Nenhum compromisso agendado"
                  description="Você não possui eventos ou reuniões registradas para o período visualizado. Que tal criar o primeiro?"
                  action={
                    isEscritaPermitida
                      ? {
                          label: 'Novo Compromisso',
                          onClick: () => openForm(null),
                          icon: Plus,
                        }
                      : undefined
                  }
                  extra={
                    <p className="text-[11px] text-slate-500 font-semibold">
                      Faltam {daysLeftInMonth} dias para o encerramento do mês de {MESES_PT[new Date().getMonth()]}
                    </p>
                  }
                />
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
                  {eventosColunaDireita.map(evt => {
                    const dateObj = new Date(evt.data_inicio);
                    const hora = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const diaNum = dateObj.getDate();
                    const mesAbrev = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

                    return (
                      <div
                        key={evt.id}
                        className={`flex gap-3.5 p-3 rounded-xl border bg-white hover:bg-slate-50/30 shadow-xs hover:shadow-md transition-all duration-300 hover:translate-y-[-1px] group relative ${
                          evt.calendario_oficial ? 'border-indigo-100 hover:border-indigo-200 border-l-4 border-l-indigo-500' :
                          evt.bloqueado ? 'border-rose-100 hover:border-rose-200 border-l-4 border-l-rose-500' : 
                          'border-emerald-100 hover:border-emerald-200 border-l-4 border-l-emerald-500'
                        }`}
                      >
                        {/* Mini data block elevado */}
                        <div className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 ${
                          evt.calendario_oficial ? 'bg-gradient-to-b from-indigo-50 to-white border-indigo-250/70' :
                          evt.bloqueado ? 'bg-gradient-to-b from-rose-50 to-white border-rose-250/70' :
                          'bg-gradient-to-b from-emerald-50 to-white border-emerald-250/70'
                        }`}>
                          <span className={`text-[8px] font-black leading-none tracking-wider ${
                            evt.calendario_oficial ? 'text-indigo-600' :
                            evt.bloqueado ? 'text-rose-600' :
                            'text-emerald-600'
                          }`}>{mesAbrev}</span>
                          <span className="text-base font-black text-slate-850 leading-none mt-0.5">{diaNum}</span>
                        </div>

                        {/* Detalhes */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-extrabold text-slate-400 bg-slate-50 border border-slate-200/50 px-1.5 py-0.2 rounded">{hora}</span>
                            {evt.local && <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[120px]">· {evt.local}</span>}
                          </div>
                          <p className="text-xs font-black text-slate-800 truncate leading-snug">{evt.titulo}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {evt.calendario_oficial && (
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-bold shadow-2xs">Oficial</span>
                            )}
                            {evt.bloqueado && (
                              <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full font-bold shadow-2xs">Bloqueado</span>
                            )}
                            <span className="text-[9px] bg-slate-50 text-slate-600 border border-slate-200/60 px-2 py-0.5 rounded-full font-bold shadow-2xs">{getEscopoLabel(evt.escopo)}</span>
                          </div>
                        </div>

                        {/* Ações Rápidas */}
                        {isEscritaPermitida && !evt.bloqueado && (
                          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 shrink-0 self-center transition-all duration-200 bg-white/90 backdrop-blur-xs pl-2">
                            <button
                              onClick={() => openForm(evt)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all duration-200 shadow-2xs hover:shadow-xs"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(evt)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all duration-200 shadow-2xs hover:shadow-xs"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardSection>

            {/* Linha do Tempo Ministerial (Apoio Lateral Secundário) */}
            <DashboardSection
              title="Linha do Tempo"
              icon={TrendingUp}
              iconClassName="text-slate-400"
              className="!p-5"
            >
              {proximosEventos.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <CalendarIcon className="h-8 w-8 text-slate-200" />
                  <span className="font-semibold text-slate-500">Nenhum compromisso.</span>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-100 ml-4 pl-4 space-y-4 py-1">
                  {proximosEventos.map(evt => {
                    const d = new Date(evt.data_inicio);
                    const isOficial = evt.calendario_oficial;
                    const isBlocked = evt.bloqueado;

                    let bulletColor = 'bg-emerald-500 ring-emerald-100';
                    if (isOficial) bulletColor = 'bg-indigo-500 ring-indigo-100';
                    else if (isBlocked) bulletColor = 'bg-rose-500 ring-rose-100';

                    return (
                      <div key={evt.id} className="relative group transition-all duration-200">
                        <span className={`absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ring-4 transition ${bulletColor}`} />
                        <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl p-2.5 transition">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <h4 className="font-black text-slate-800 text-xs mt-1 truncate">{evt.titulo}</h4>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardSection>
          </DashboardSidebar>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: DASHBOARD / VISÃO GERAL                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LADO ESQUERDO: Linha do Tempo Ministerial expandida */}
          <DashboardSection
            title="Linha do Tempo Ministerial"
            icon={TrendingUp}
            className="flex-1 min-w-0"
          >
            {proximosEventos.length === 0 ? (
              <DashboardEmptyState
                icon={TrendingUp}
                title="Linha do tempo livre"
                description="Seus próximos dias estão livres de atividades oficiais ou locais agendadas."
                action={
                  isEscritaPermitida
                    ? {
                        label: 'Registrar Evento',
                        onClick: () => openForm(null),
                        icon: Plus,
                      }
                    : undefined
                }
              />
            ) : (
              <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-5 py-2">
                {proximosEventos.map(evt => {
                  const d = new Date(evt.data_inicio);
                  const isOficial = evt.calendario_oficial;
                  const isBlocked = evt.bloqueado;

                  let bulletColor = 'bg-emerald-500 ring-emerald-100';
                  if (isOficial) bulletColor = 'bg-indigo-500 ring-indigo-100';
                  else if (isBlocked) bulletColor = 'bg-rose-500 ring-rose-100';

                  return (
                    <div key={evt.id} className="relative group transition-all duration-200">
                      {/* Bullet indicador */}
                      <span className={`absolute -left-[30px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ring-4 transition ${bulletColor}`} />
                      
                      <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl p-3 max-w-2xl transition">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          {evt.local && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">{evt.local}</span>
                            </>
                          )}
                        </div>
                        <h4 className="font-black text-slate-850 text-sm mt-1">{evt.titulo}</h4>
                        {evt.descricao && (
                          <p className="text-slate-500 text-xs mt-1 leading-relaxed">{evt.descricao}</p>
                        )}
                        
                        <div className="flex gap-1.5 mt-2">
                          {isOficial && (
                            <span className="text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-full font-bold">Oficial</span>
                          )}
                          {isBlocked && (
                            <span className="text-[8px] bg-rose-50 text-rose-700 border border-rose-150 px-2 py-0.5 rounded-full font-bold">Sincronizado</span>
                          )}
                          <span className="text-[8px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{getEscopoLabel(evt.escopo)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardSection>

          {/* LADO DIREITO: Visão Geral Consolidada */}
          <DashboardSidebar className="w-full lg:w-80">
            <DashboardSection
              title="Visão Geral Consolidada"
              icon={LayoutDashboard}
              className="!p-5"
            >
              <div className="space-y-4 text-xs">
                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl">
                  <h4 className="font-bold mb-1">Orientações Executivas</h4>
                  <p className="leading-relaxed text-slate-705">
                    Monitore a distribuição de datas para evitar sobrecarga de atividades nas congregações. Priorize sempre os eventos do calendário oficial.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Legenda de Cores</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
                      <span className="text-slate-600">Azul (Oficial): Eventos institucionais e prioritários.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-slate-600">Verde (Local): Atividades e reuniões locais.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-slate-600">Vermelho (Bloqueado): Datas gerenciadas por outros módulos.</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <h4 className="font-bold text-slate-800 mb-1.5">Instruções Rápidas</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-505">
                    <li>Selecione um dia no Calendário para filtrar os compromissos específicos.</li>
                    <li>Aprovação de conflitos requer análise e parecer na aba de Solicitações.</li>
                    <li>O Planejamento publicado impede novas edições normais de datas.</li>
                  </ul>
                </div>
              </div>
            </DashboardSection>
          </DashboardSidebar>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: PLANEJAMENTO ANUAL                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'planejamento' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LADO ESQUERDO: Planejamento de Exercício Vigente */}
          <DashboardSection
            title={`Planejamento de Exercício Vigente - ${currentYear}`}
            icon={Calendar}
            className="flex-1 min-w-0"
          >
            {activePlanning ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Status Block */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/40 to-white p-4 rounded-2xl border border-indigo-100/80 shadow-xs hover:shadow transition-all duration-200">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Status da Agenda</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border inline-block mt-2 ${STATUS_PLAN_INFO[activePlanning.status].cor}`}>
                      {STATUS_PLAN_INFO[activePlanning.status].label}
                    </span>
                    <div className="absolute right-2 bottom-2 text-indigo-400 pointer-events-none opacity-20">
                      <ShieldCheck className="h-12 w-12" />
                    </div>
                  </div>

                  {/* Total Eventos Block */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/40 to-white p-4 rounded-2xl border border-emerald-100/80 shadow-xs hover:shadow transition-all duration-200">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total de Eventos no Exercício</span>
                    <p className="text-2xl font-black text-emerald-800 mt-1">{planningEventCount}</p>
                    <div className="absolute right-2 bottom-2 text-emerald-450 pointer-events-none opacity-20">
                      <CalendarRange className="h-12 w-12" />
                    </div>
                  </div>
                </div>

                {/* Publication Block */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-white p-4 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow transition-all duration-200 space-y-2 text-xs text-slate-650">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Publicação</span>
                  <div className="space-y-1 relative z-10">
                    <p className="font-semibold text-slate-700">Data de Publicação: <span className="font-bold text-slate-900">{activePlanning.published_at ? new Date(activePlanning.published_at).toLocaleString('pt-BR') : 'Ainda não publicado'}</span></p>
                    {responsibleEmail && <p className="font-semibold text-slate-700">Responsável: <span className="font-bold text-slate-900">{responsibleEmail}</span></p>}
                  </div>
                  <div className="absolute right-3 bottom-3 text-slate-400 pointer-events-none opacity-20">
                    <Clock className="h-12 w-12" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
                <CalendarIcon className="h-8 w-8 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">Nenhum planejamento inicializado para o ano {currentYear}.</p>
              </div>
            )}
          </DashboardSection>

          {/* LADO DIREITO: Ações Estratégicas Anuais */}
          <DashboardSidebar className="w-full lg:w-80">
            <DashboardSection
              title="Ações Estratégicas Anuais"
              icon={BookOpen}
              className="!p-5"
            >
              {activePlanning ? (
                <div className="space-y-3">
                  {activePlanning.status === 'rascunho' && (
                    <button
                      onClick={handlePublishPlanning}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md border border-blue-700 transition duration-200"
                    >
                      <Check className="h-4 w-4" />
                      Publicar Planejamento
                    </button>
                  )}
                  {activePlanning.status !== 'arquivado' && (
                    <button
                      onClick={handleArchivePlanning}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-55 text-slate-700 font-extrabold text-xs rounded-xl shadow-xs hover:shadow border border-slate-200 hover:border-slate-300 transition duration-200"
                    >
                      <Archive className="h-4 w-4" />
                      Arquivar Planejamento
                    </button>
                  )}
                  {activePlanning.status === 'arquivado' && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <p className="text-xs text-slate-500 font-bold flex items-center justify-center gap-1.5">
                        <Lock className="h-4 w-4 text-slate-400" />
                        Este planejamento foi arquivado de forma definitiva.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
                  <CalendarIcon className="h-8 w-8 text-slate-300" />
                  <p className="text-xs font-bold text-slate-550">Nenhum rascunho ativo.</p>
                </div>
              )}
            </DashboardSection>
          </DashboardSidebar>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: SOLICITAÇÕES INTEGRADA (Sprint UX 2.0)                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'solicitacoes' && isPresidenciaOrAdmin && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LADO ESQUERDO: Solicitações de Exceção de Datas */}
          <DashboardSection
            title="Solicitações de Exceção de Datas"
            icon={Gavel}
            className="flex-1 min-w-0"
          >
            {loadingSols ? (
              <div className="text-center py-6 text-slate-400 text-xs">Carregando solicitações...</div>
            ) : solicitacoes.length === 0 ? (
              <DashboardEmptyState
                icon={Gavel}
                title="Sem solicitações pendentes"
                description="Nenhuma solicitação de alteração de datas ou exceções aguarda sua aprovação."
              />
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {solicitacoes.map(sol => {
                  const isPending = sol.status === 'pendente';
                  const statusCls = sol.status === 'aprovado' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                                    sol.status === 'rejeitado' ? 'bg-rose-50 text-rose-700 border-rose-150' :
                                    'bg-amber-50 text-amber-700 border-amber-150';

                  return (
                    <div key={sol.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${statusCls}`}>
                            {sol.status.toUpperCase()}
                          </span>
                          <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200">
                            {TIPO_SOLICITACAO_LABEL[sol.tipo_solicitacao]}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">{sol.titulo}</h4>
                        <p className="text-[11px] text-slate-500">Justificativa: "{sol.justificativa}"</p>
                        {sol.parecer && <p className="text-[10px] text-blue-600 italic">Parecer: "{sol.parecer}"</p>}
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-1.5 shrink-0 sm:self-center">
                          <button
                            onClick={() => {
                              const p = prompt('Parecer para aprovação:', '');
                              if (p !== null) handleDecidirSolicitacao(sol.id, 'aprovar', p);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition"
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => {
                              const p = prompt('Parecer para rejeição:', '');
                              if (p !== null) handleDecidirSolicitacao(sol.id, 'rejeitar', p);
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg transition"
                          >
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardSection>

          {/* LADO DIREITO: Políticas de Aprovação */}
          <DashboardSidebar className="w-full lg:w-80">
            <DashboardSection
              title="Políticas de Aprovação"
              icon={ShieldCheck}
              className="!p-5"
            >
              <div className="space-y-4 text-xs text-slate-600">
                <div className="bg-amber-50 border border-amber-255 text-amber-850 p-3 rounded-xl">
                  <h4 className="font-bold mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Limites de Conflitos
                  </h4>
                  <p className="leading-relaxed text-slate-700">
                    O sistema impede o choque de datas para eventos oficiais ou bloqueantes no mesmo local e horário. Exceções devem ser justificadas sob a chancela da Presidência.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-1.5">Processo de Aprovação</h4>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-500">
                    <li>
                      <strong>Análise de Justificativa:</strong> Verifique se a relevância do evento justifica a coexistência ou alteração.
                    </li>
                    <li>
                      <strong>Parecer Obrigatório:</strong> Forneça observações e diretrizes claras ao deferir ou indeferir a exceção.
                    </li>
                    <li>
                      <strong>Publicação:</strong> A aprovação insere automaticamente o compromisso sob regime especial no calendário.
                    </li>
                  </ol>
                </div>
              </div>
            </DashboardSection>
          </DashboardSidebar>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL DE COMPROMISSO (Formulário Otimizado e Responsivo)              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-xl border border-slate-100 flex flex-col max-h-[85vh]">

            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm">
                  {editEvento ? 'EDITAR COMPROMISSO' : 'NOVO COMPROMISSO'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Título *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reunião Geral de Obreiros"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tipo *</label>
                  <select
                    value={form.tipo_id}
                    required
                    onChange={(e) => handleTipoChange(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="" disabled>Selecione</option>
                    {Object.entries(tiposAgrupados).map(([categoria, lista]) => {
                      if (lista.length === 0) return null;
                      return (
                        <optgroup key={categoria} label={CATEGORIAS_LABEL[categoria as keyof typeof CATEGORIAS_LABEL]}>
                          {lista.map(t => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as AgendaEvento['status'] })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="agendado">Agendado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Início *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.data_inicio}
                    onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Fim</label>
                  <input
                    type="datetime-local"
                    value={form.data_fim}
                    onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Local</label>
                <input
                  type="text"
                  placeholder="Templo Central, Sala 3..."
                  value={form.local}
                  onChange={(e) => setForm({ ...form, local: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Botão para mostrar campos avançados (Toggle) */}
              <button
                type="button"
                onClick={() => setShowAdvancedFormFields(v => !v)}
                className="w-full text-center py-2 border border-dashed border-slate-200 rounded-lg text-[10px] font-bold text-slate-400 hover:bg-slate-50 transition"
              >
                {showAdvancedFormFields ? 'Ocultar Detalhes Avançados' : 'Mostrar Detalhes Avançados'}
              </button>

              {showAdvancedFormFields && (
                <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Descrição</label>
                    <textarea
                      placeholder="Pauta ou pormenores..."
                      value={form.descricao}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Escopo</label>
                      <select
                        value={form.escopo}
                        onChange={(e) => setForm({ ...form, escopo: e.target.value as AgendaEvento['escopo'] })}
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        <option value="organizacao">{orgHelper ? orgHelper.label('organizacao') : 'Organização'}</option>
                        {orgHelper?.ativa('divisao3') && <option value="divisao3">{orgHelper.label('divisao3')}</option>}
                        {orgHelper?.ativa('divisao2') && <option value="divisao2">{orgHelper.label('divisao2')}</option>}
                        {orgHelper?.ativa('divisao1') && <option value="divisao1">{orgHelper.label('divisao1')}</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Visibilidade</label>
                      <select
                        value={form.visibilidade}
                        onChange={(e) => setForm({ ...form, visibilidade: e.target.value as AgendaEvento['visibilidade'] })}
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        <option value="privado">Privado</option>
                        <option value="lideranca">Liderança</option>
                        <option value="igreja">Membros</option>
                        <option value="ministerio">Ministério</option>
                        <option value="publico">Público</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Regra de Posicionamento</label>
                    <select
                      value={form.regra_posicionamento}
                      onChange={(e) => setForm({ ...form, regra_posicionamento: e.target.value })}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">Nenhuma (Data Fixa)</option>
                      <option value="primeiro_domingo">Primeiro Domingo</option>
                      <option value="segundo_domingo">Segundo Domingo</option>
                      <option value="terceiro_domingo">Terceiro Domingo</option>
                      <option value="ultimo_domingo">Último Domingo</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.calendario_oficial}
                        onChange={(e) => setForm({ ...form, calendario_oficial: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
                      />
                      Oficial
                    </label>
                    <label className={`flex items-center gap-1.5 text-xs font-bold ${isAdmin ? 'text-slate-600 cursor-pointer' : 'text-slate-350 cursor-not-allowed select-none'}`}>
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={form.gera_bloqueio}
                        onChange={(e) => setForm({ ...form, gera_bloqueio: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300 disabled:opacity-40"
                      />
                      Gera Bloqueio
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 -mx-4 -mb-4 p-4 shrink-0 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-white transition text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition text-xs disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </DashboardContent>
    </DashboardContainer>
  );
}
