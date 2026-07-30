'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import DashboardContent from '@/components/dashboard/DashboardContent';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardSection from '@/components/dashboard/DashboardSection';
import DashboardActions from '@/components/dashboard/DashboardActions';
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  Plus, Calendar as CalendarIcon,
  AlertTriangle, Check, Archive,
  LayoutDashboard, BookOpen, CheckCircle2, Gavel, ShieldCheck, Lock, Clock, Calendar, Flame,
  CalendarRange, Filter
} from 'lucide-react';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { OrganizationalService, getOrgHelpers, OrgStructure } from '@/lib/organizational-service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { PlanningConflictService } from '@/lib/planning-conflict-service';

import AgendaToolbar from '@/components/agenda/AgendaToolbar';
import AgendaCalendar from '@/components/agenda/AgendaCalendar';
import AgendaTimeline from '@/components/agenda/AgendaTimeline';
import EventoFormModal from '@/components/agenda/EventoFormModal';
import ConfirmDeleteModal from '@/components/agenda/ConfirmDeleteModal';

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

  const [activeTab, setActiveTab] = useState<'calendario' | 'dashboard' | 'planejamento' | 'solicitacoes'>('calendario');

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
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
    local: '',
    visibilidade: 'ministerio' as AgendaEvento['visibilidade'],
    church_id: '',
    status: 'agendado' as AgendaEvento['status'],
    escopo: 'divisao1' as AgendaEvento['escopo'],
    calendario_oficial: false,
    gera_bloqueio: false,
    regra_posicionamento: '' as string,
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

  const userRole = (ctx as any)?.role || '';
  const userIsMaster = (ctx as any)?.isMaster || false;

  const isPresidenciaOrAdmin = useMemo(() => {
    if (!userRole) return false;
    const r = String(userRole).toLowerCase();
    return r.includes('admin') || r.includes('presid') || r.includes('pastor_presidente') || r.includes('pastor presidente') || r.includes('superintendente');
  }, [userRole]);

  const isEscritaPermitida = useMemo(() => {
    if (userIsMaster || userRole === 'admin' || userRole === 'editor' || isPresidenciaOrAdmin) return true;
    return false;
  }, [userIsMaster, userRole, isPresidenciaOrAdmin]);

  const isAdmin = useMemo(() => {
    return userIsMaster || userRole === 'admin' || isPresidenciaOrAdmin;
  }, [userIsMaster, userRole, isPresidenciaOrAdmin]);

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
    try {
      const { data } = await supabase
        .from('congregacoes')
        .select('id, nome')
        .eq('ministry_id', mId)
        .order('nome');
      setCongregacoes(data || []);
    } catch {
      setCongregacoes([]);
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
          agenda_tipos!agenda_eventos_tipo_id_fkey (*),
          agenda_planejamentos!agenda_eventos_planejamento_id_fkey (*)
        `)
        .eq('ministry_id', mId)
        .gte('data_inicio', startOfMonth)
        .lte('data_inicio', endOfMonth)
        .order('data_inicio');

      if (filtroTipoId) {
        query = query.eq('tipo_id', filtroTipoId);
      }
      if (filtroCongregacao) {
        query = query.eq('church_id', filtroCongregacao);
      }
      if (filtroVisibilidade) {
        query = query.eq('visibilidade', filtroVisibilidade);
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
  }, [supabase, filtroMes, filtroTipoId, filtroCongregacao, filtroVisibilidade]);

  const loadSolicitacoes = useCallback(async (mId: string) => {
    if (!isPresidenciaOrAdmin) return;
    setLoadingSols(true);
    try {
      const { data, error } = await supabase
        .from('agenda_solicitacoes')
        .select(`
          *,
          conflito_evento:agenda_eventos!agenda_solicitacoes_conflito_id_fkey(titulo)
        `)
        .eq('ministry_id', mId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSolicitacoes(data || []);
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

  const openForm = (evento: AgendaEvento | null = null) => {
    if (evento) {
      setEditEvento(evento);
      setForm({
        titulo: evento.titulo || '',
        descricao: evento.descricao || '',
        tipo_id: evento.tipo_id || '',
        data_inicio: evento.data_inicio ? evento.data_inicio.slice(0, 16) : '',
        data_fim: evento.data_fim ? evento.data_fim.slice(0, 16) : '',
        local: evento.local || '',
        visibilidade: evento.visibilidade || 'ministerio',
        church_id: evento.church_id || '',
        status: evento.status || 'agendado',
        escopo: evento.escopo || 'divisao1',
        calendario_oficial: evento.calendario_oficial ?? false,
        gera_bloqueio: evento.gera_bloqueio ?? false,
        regra_posicionamento: evento.regra_posicionamento || '',
      });
      setShowAdvancedFormFields(!!(evento.descricao || evento.regra_posicionamento || evento.calendario_oficial || evento.gera_bloqueio));
    } else {
      setEditEvento(null);
      const defaultStart = selectedDate 
        ? `${selectedDate}T09:00` 
        : `${new Date().toISOString().slice(0, 10)}T09:00`;

      setForm({
        titulo: '',
        descricao: '',
        tipo_id: tipos.length > 0 ? tipos[0].id : '',
        data_inicio: defaultStart,
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

    if (!form.titulo.trim() || !form.data_inicio) {
      flash('erro', 'Preencha o título e a data/hora de início.');
      return;
    }

    setSaving(true);
    try {
      if (form.gera_bloqueio || form.calendario_oficial) {
        const conflict = await PlanningConflictService.verificarConflito(
          supabase,
          {
            titulo: form.titulo.trim(),
            data_inicio: form.data_inicio,
            data_fim: form.data_fim || null,
            planejamento_id: activePlanning?.id || '',
            tipo_id: form.tipo_id,
            escopo: form.escopo,
            prioridade: 1,
            calendario_oficial: form.calendario_oficial,
            gera_bloqueio: form.gera_bloqueio,
          },
          editEvento?.id || ''
        );

        if (conflict && conflict.status === 'BLOQUEIO') {
          const proceed = await dialog.confirm({
            title: 'Alerta de Conflito de Agenda',
            type: 'warning',
            message: `Detectado choque de data com o evento "${conflict.conflito?.titulo || 'Oficial/Bloqueante'}". Deseja submeter uma Solicitação de Exceção à Presidência?`,
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
      }

      const payload = {
        ministry_id: ministryId,
        planejamento_id: activePlanning?.id || null,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        tipo_id: form.tipo_id || null,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        local: form.local.trim() || null,
        visibilidade: form.visibilidade,
        church_id: form.church_id || null,
        status: form.status,
        escopo: form.escopo,
        calendario_oficial: form.calendario_oficial,
        gera_bloqueio: form.gera_bloqueio,
        regra_posicionamento: form.regra_posicionamento || null,
        updated_at: new Date().toISOString(),
      };

      if (editEvento) {
        const { error } = await supabase
          .from('agenda_eventos')
          .update(payload)
          .eq('id', editEvento.id);
        if (error) throw error;
        await registrarAcao({ acao: 'editar', modulo: 'agenda', tabela_afetada: 'agenda_eventos', registro_id: editEvento.id });
        flash('ok', 'Compromisso atualizado com sucesso!');
      } else {
        const { data: newEvt, error } = await supabase
          .from('agenda_eventos')
          .insert([{ ...payload, created_by: user?.id || null }])
          .select()
          .single();
        if (error) throw error;
        await registrarAcao({ acao: 'criar', modulo: 'agenda', tabela_afetada: 'agenda_eventos', registro_id: newEvt.id });
        flash('ok', 'Compromisso agendado com sucesso!');
      }

      setShowModal(false);
      loadEventos(ministryId);
      if (activePlanning) loadPlanningInfo(ministryId, currentYear);
    } catch (err) {
      console.error(err);
      flash('erro', 'Falha ao salvar o compromisso.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (evento: AgendaEvento) => {
    setDeleteConfirmTarget(evento);
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirmTarget || !ministryId) return;
    const evento = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    try {
      const { error } = await supabase
        .from('agenda_eventos')
        .delete()
        .eq('id', evento.id);
      if (error) throw error;

      await registrarAcao({ acao: 'deletar', modulo: 'agenda', tabela_afetada: 'agenda_eventos', registro_id: evento.id });
      flash('ok', 'Compromisso excluído com sucesso.');
      loadEventos(ministryId);
      if (activePlanning) loadPlanningInfo(ministryId, currentYear);
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao excluir o compromisso.');
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
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao publicar planejamento.');
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
    eventos.forEach(e => {
      const dayStr = e.data_inicio.split('T')[0];
      if (!mapa[dayStr]) mapa[dayStr] = [];
      mapa[dayStr].push(e);
    });
    return mapa;
  }, [eventos]);

  const eventosColunaDireita = useMemo(() => {
    if (selectedDate) {
      return eventos.filter(e => e.data_inicio.startsWith(selectedDate));
    }
    return eventos.sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
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

  if (ctx.loading || planFeatures.loading) {
    return <div className="p-8 text-gray-500">Carregando...</div>;
  }

  if (bloqueado || !planFeatures.has_modulo_agenda || !planFeatures.hasFeature('agenda_module')) {
    return (
      <DashboardContainer>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 shadow-sm border border-blue-200/60">
            <CalendarIcon className="h-8 w-8" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Starter
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Agenda Indisponível no seu Plano</h2>
          </div>

          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A funcionalidade Agenda do Ministério está disponível a partir do Plano Starter.
          </p>

          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
            Faça o upgrade para liberar o calendário ministerial completo, sincronização com cultos e reuniões, além do planejamento anual de atividades da sua igreja.
          </p>

          <div className="pt-3">
            <a
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos
            </a>
          </div>
        </div>
      </DashboardContainer>
    );
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

        <AgendaToolbar
          activeTab={activeTab}
          currentMonth={currentMonth}
          currentYear={currentYear}
          MESES_PT={MESES_PT}
          quickFilter={quickFilter}
          showAdvancedFilters={showAdvancedFilters}
          filtroTipoId={filtroTipoId}
          filtroCongregacao={filtroCongregacao}
          filtroVisibilidade={filtroVisibilidade}
          tiposAgrupados={tiposAgrupados}
          CATEGORIAS_LABEL={CATEGORIAS_LABEL}
          congregacoes={congregacoes}
          orgHelper={orgHelper}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onGoToToday={handleGoToToday}
          onQuickFilterChange={setQuickFilter}
          onToggleAdvancedFilters={() => setShowAdvancedFilters(v => !v)}
          onFiltroTipoChange={setFiltroTipoId}
          onFiltroCongregacaoChange={setFiltroCongregacao}
          onFiltroVisibilidadeChange={setFiltroVisibilidade}
        />

        {msg && (
          <div className={`p-3 mb-4 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-150' : 'bg-rose-50 text-rose-800 border-rose-150'
          }`}>
            {msg.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
            {msg.texto}
          </div>
        )}

        {activeTab === 'calendario' && (
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            <AgendaCalendar
              daysInMonthArray={daysInMonthArray}
              eventosPorDia={eventosPorDia}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            <DashboardSidebar className="w-full lg:w-[320px] lg:border-l lg:border-slate-200/50 lg:pl-5">
              <AgendaTimeline
                mode="sidebar"
                selectedDate={selectedDate}
                loading={loading}
                eventosColunaDireita={eventosColunaDireita}
                proximosEventos={proximosEventos}
                isEscritaPermitida={isEscritaPermitida}
                daysLeftInMonth={daysLeftInMonth}
                MESES_PT={MESES_PT}
                getEscopoLabel={getEscopoLabel}
                onClearSelectedDate={() => setSelectedDate(null)}
                onOpenForm={openForm}
                onDeleteEvento={handleDelete}
              />
            </DashboardSidebar>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <AgendaTimeline
              mode="full"
              proximosEventos={proximosEventos}
              isEscritaPermitida={isEscritaPermitida}
              getEscopoLabel={getEscopoLabel}
              onOpenForm={openForm}
            />

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

        {activeTab === 'planejamento' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <DashboardSection
              title={`Planejamento de Exercício Vigente - ${currentYear}`}
              icon={Calendar}
              className="flex-1 min-w-0"
            >
              {activePlanning ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/40 to-white p-4 rounded-2xl border border-indigo-100/80 shadow-xs hover:shadow transition-all duration-200">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Status da Agenda</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border inline-block mt-2 ${STATUS_PLAN_INFO[activePlanning.status].cor}`}>
                        {STATUS_PLAN_INFO[activePlanning.status].label}
                      </span>
                      <div className="absolute right-2 bottom-2 text-indigo-400 pointer-events-none opacity-20">
                        <ShieldCheck className="h-12 w-12" />
                      </div>
                    </div>

                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/40 to-white p-4 rounded-2xl border border-emerald-100/80 shadow-xs hover:shadow transition-all duration-200">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total de Eventos no Exercício</span>
                      <p className="text-2xl font-black text-emerald-800 mt-1">{planningEventCount}</p>
                      <div className="absolute right-2 bottom-2 text-emerald-450 pointer-events-none opacity-20">
                        <CalendarRange className="h-12 w-12" />
                      </div>
                    </div>
                  </div>

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

              <DashboardSection
                title="Configurações de Tipos"
                icon={Filter}
                className="!p-5 mt-4"
              >
                <p className="text-[11px] text-slate-550 font-bold mb-3 leading-relaxed">
                  Personalize as cores, regras de bloqueio e categorias dos compromissos da igreja.
                </p>
                <button
                  onClick={() => setShowTiposModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-750 font-extrabold text-xs rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition duration-200"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-500" />
                  Gerenciar Tipos
                </button>
              </DashboardSection>
            </DashboardSidebar>
          </div>
        )}

        {activeTab === 'solicitacoes' && isPresidenciaOrAdmin && (
          <div className="flex flex-col lg:flex-row gap-6">
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

        <EventoFormModal
          showModal={showModal}
          editEvento={editEvento}
          form={form}
          saving={saving}
          showAdvancedFormFields={showAdvancedFormFields}
          tiposAgrupados={tiposAgrupados}
          CATEGORIAS_LABEL={CATEGORIAS_LABEL}
          orgHelper={orgHelper}
          isAdmin={isAdmin}
          onCloseModal={() => setShowModal(false)}
          onSave={handleSave}
          onFormChange={(fields) => setForm(prev => ({ ...prev, ...fields }))}
          onTipoChange={handleTipoChange}
          onToggleAdvancedFields={() => setShowAdvancedFormFields(v => !v)}
          onOpenTiposModal={() => setShowTiposModal(true)}
          showTiposModal={showTiposModal}
          tipos={tipos}
          novoTipoNome={novoTipoNome}
          novoTipoCategoria={novoTipoCategoria}
          novoTipoCor={novoTipoCor}
          novoTipoBloqueio={novoTipoBloqueio}
          isSalvandoTipo={isSalvandoTipo}
          onCloseTiposModal={() => setShowTiposModal(false)}
          onNovoTipoNomeChange={setNovoTipoNome}
          onNovoTipoCategoriaChange={setNovoTipoCategoria}
          onNovoTipoCorChange={setNovoTipoCor}
          onNovoTipoBloqueioChange={setNovoTipoBloqueio}
          onCriarTipo={handleCriarTipo}
          onDeletarTipo={handleDeletarTipo}
        />

        <ConfirmDeleteModal
          isOpen={!!deleteConfirmTarget}
          title="Excluir Compromisso"
          message={`Tem certeza que deseja excluir o compromisso "${deleteConfirmTarget?.titulo || ''}"? Esta ação não poderá ser desfeita.`}
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={confirmDeleteAction}
          onCancel={() => setDeleteConfirmTarget(null)}
        />
      </DashboardContent>
    </DashboardContainer>
  );
}
