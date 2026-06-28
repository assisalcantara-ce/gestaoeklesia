'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  Plus, Pencil, Trash2, Calendar, MapPin, Tag, Eye, Clock, X,
  AlertTriangle, ShieldCheck, Lock, Check, Archive, User,
  ChevronLeft, ChevronRight, Filter, LayoutDashboard,
  BookOpen, TrendingUp, ChevronDown, ChevronUp,
  CheckCircle2, Ban, Flame
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

// ─── Dicionários ─────────────────────────────────────────────────────────────

const TIPOS_INFO_LEGADO = {
  culto: { label: 'Culto', corBg: 'bg-red-50 text-red-700 border-red-200' },
  reuniao: { label: 'Reunião', corBg: 'bg-purple-50 text-purple-700 border-purple-200' },
  aula: { label: 'Aula', corBg: 'bg-blue-50 text-blue-700 border-blue-200' },
  evento: { label: 'Evento', corBg: 'bg-green-50 text-green-700 border-green-200' },
  tarefa: { label: 'Tarefa', corBg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  outro: { label: 'Outro', corBg: 'bg-gray-50 text-gray-700 border-gray-200' },
};

const CATEGORIAS_LABEL = {
  culto: 'Cultos',
  reuniao: 'Reuniões',
  evento: 'Eventos',
  missoes: 'Missões',
  departamento: 'Departamentos',
  administrativo: 'Administrativo',
};

const VISIBILIDADE_INFO = {
  privado: 'Privado',
  lideranca: 'Liderança',
  igreja: 'Membros da Igreja',
  ministerio: 'Ministério Geral',
  publico: 'Público Geral',
};

const STATUS_INFO = {
  agendado: { label: 'Agendado', cor: 'bg-blue-100 text-blue-800' },
  cancelado: { label: 'Cancelado', cor: 'bg-red-100 text-red-800' },
  concluido: { label: 'Concluído', cor: 'bg-green-100 text-green-800' },
};

const STATUS_PLAN_INFO = {
  rascunho: { label: 'Rascunho', cor: 'bg-amber-100 text-amber-800 border-amber-200' },
  publicado: { label: 'Publicado', cor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  arquivado: { label: 'Arquivado', cor: 'bg-slate-100 text-slate-800 border-slate-200' },
};

const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

// ─── Quick filter type ────────────────────────────────────────────────────────
type QuickFilter = 'todos' | 'oficiais' | 'locais' | 'bloqueados';

export default function AgendaPage() {
  const { user } = useRequireSupabaseAuth();
  const { ctx, bloqueado } = useRequireModulo('agenda');
  const supabase = useMemo(() => createClient(), []);
  const dialog = useAppDialog();
  const { registrarAcao } = useAuditLog();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendario' | 'planejamento'>('dashboard');

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

  // Filtros
  const [filtroMes, setFiltroMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filtroTipoId, setFiltroTipoId] = useState<string>('');
  const [filtroCongregacao, setFiltroCongregacao] = useState<string>('');
  const [filtroVisibilidade, setFiltroVisibilidade] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
    const { data } = await supabase
      .from('agenda_tipos')
      .select('*')
      .eq('ministry_id', mid)
      .eq('ativo', true)
      .order('ordem')
      .order('nome');

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
        OrganizationalService.getEstrutura(supabase).then(setOrgStructure);
      }
    });
  }, [user, bloqueado, supabase, loadCongregacoes, loadTipos]);

  useEffect(() => {
    if (ministryId) {
      loadEventos(ministryId);
      loadPlanningData(ministryId, currentYear);
    }
  }, [ministryId, loadEventos, loadPlanningData, currentYear]);

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
  };

  // Abrir Modal de Cadastro
  const openForm = (evt: AgendaEvento | null = null) => {
    if (!isEscritaPermitida) {
      flash('erro', 'Ações de escrita estão bloqueadas porque este planejamento anual já está publicado/arquivado.');
      return;
    }
    // Eventos gerenciados por outros módulos não podem ser editados diretamente
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
      const tzOffset = now.getTimezoneOffset() * 60000;
      const initialDate = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
      const defaultTipoId = tipos.length > 0 ? tipos[0].id : '';

      setForm({
        titulo: '',
        descricao: '',
        tipo_id: defaultTipoId,
        data_inicio: initialDate,
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

      flash('ok', editEvento ? 'Compromisso atualizado com sucesso!' : 'Compromisso criado com sucesso!');
      setShowModal(false);
      loadEventos(ministryId);
      loadPlanningData(ministryId, currentYear);
    } catch (err: any) {
      console.error(err);
      flash('erro', 'Erro ao salvar o compromisso.');
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
        flash('ok', 'Compromisso excluído com sucesso!');
        if (ministryId) {
          loadEventos(ministryId);
          loadPlanningData(ministryId, currentYear);
        }
      } catch (err: any) {
        console.error(err);
        flash('erro', 'Erro ao excluir o compromisso.');
      }
    }
  };

  // Cancelar Evento (Rápido)
  const handleCancelQuick = async (evt: AgendaEvento) => {
    if (!isEscritaPermitida || evt.bloqueado) return;
    const ok = await dialog.confirm({
      title: 'Cancelar Compromisso',
      message: `Deseja realmente alterar o status do compromisso "${evt.titulo}" para Cancelado?`,
      confirmText: 'Sim, Cancelar',
      cancelText: 'Voltar',
      type: 'warning',
    });

    if (ok) {
      try {
        const { error } = await supabase
          .from('agenda_eventos')
          .update({ status: 'cancelado' })
          .eq('id', evt.id);

        if (error) throw error;
        flash('ok', 'Compromisso cancelado!');
        if (ministryId) loadEventos(ministryId);
      } catch (err: any) {
        console.error(err);
        flash('erro', 'Erro ao cancelar o compromisso.');
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

        flash('ok', `Planejamento de ${activePlanning.ano} publicado com sucesso!`);
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

  const getCongName = (id: string | null) => {
    if (!id) return orgHelper ? `Todas as ${orgHelper.label('divisao1')}s` : 'Todas as Congregações';
    return congregacoes.find(c => c.id === id)?.nome ?? (orgHelper ? orgHelper.label('divisao1') : 'Congregação');
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

  const getEscopoLabel = (escopoVal: string) => {
    if (!orgHelper) return escopoVal;
    if (escopoVal === 'organizacao') return orgHelper.label('organizacao');
    if (escopoVal === 'divisao1') return orgHelper.label('divisao1');
    if (escopoVal === 'divisao2') return orgHelper.label('divisao2');
    if (escopoVal === 'divisao3') return orgHelper.label('divisao3');
    return escopoVal;
  };


  const eventosOficiais = useMemo(() => eventos.filter(e => e.calendario_oficial), [eventos]);
  const eventosLocais = useMemo(() => eventos.filter(e => !e.calendario_oficial && !e.bloqueado), [eventos]);
  const eventosBloqueados = useMemo(() => eventos.filter(e => e.bloqueado), [eventos]);

  const proximoEvento = useMemo(() => {
    const now = new Date();
    return eventos
      .filter(e => e.status === 'agendado' && new Date(e.data_inicio) >= now)
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())[0] ?? null;
  }, [eventos]);

  // Aplicar quick filter + advanced filters na listagem
  const eventosFiltrados = useMemo(() => {
    let result = eventos;
    if (quickFilter === 'oficiais') result = result.filter(e => e.calendario_oficial);
    if (quickFilter === 'locais') result = result.filter(e => !e.calendario_oficial);
    if (quickFilter === 'bloqueados') result = result.filter(e => e.bloqueado);
    return result;
  }, [eventos, quickFilter]);

  // Timeline: próximos 5 eventos a partir de hoje em todos os meses
  const timelineEventos = useMemo(() => {
    const now = new Date();
    return eventos
      .filter(e => e.status === 'agendado' && new Date(e.data_inicio) >= now)
      .slice(0, 5);
  }, [eventos]);

  if (ctx.loading) return <div className="p-8">Carregando permissões do módulo...</div>;
  if (bloqueado) return null;

  // ─── Tabs config ─────────────────────────────────────────────────────────
  const TABS = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'calendario', label: 'Calendário', icon: Calendar },
    { id: 'planejamento', label: 'Planejamento', icon: BookOpen },
  ] as const;

  return (
    <PageLayout title="Agenda" description="Gestão de compromissos, cultos e reuniões ministeriais" activeMenu="agenda">

      {/* ─── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}

        {/* Spacer + Novo Compromisso */}
        <div className="ml-auto pb-1">
          {isEscritaPermitida && (
            <button
              onClick={() => openForm(null)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              Novo Compromisso
            </button>
          )}
        </div>
      </div>

      {/* ─── Feedback ─────────────────────────────────────────────────────── */}
      {msg && (
        <div className={`p-3.5 mb-5 rounded-xl border flex items-center gap-3 text-sm font-medium transition-all duration-300 ${
          msg.tipo === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {msg.tipo === 'ok'
            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            : <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          }
          {msg.texto}
        </div>
      )}

      {/* ─── Banner de Planejamento Travado ───────────────────────────────── */}
      {isEdicaoBloqueada && (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 p-3.5 rounded-xl mb-5 flex items-center gap-3 text-sm font-semibold">
          <Lock className="h-4 w-4 shrink-0 text-amber-600" />
          Calendário {currentYear} — {activePlanning?.status === 'publicado' ? 'Publicado' : 'Arquivado'} · Modo somente-leitura ativo.
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 1: DASHBOARD                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">

          {/* Cards executivos */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

            {/* Planejamento */}
            <div className="col-span-2 md:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Planejamento</span>
              <p className="text-lg font-black text-slate-800">{currentYear}</p>
              {activePlanning ? (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border w-fit ${STATUS_PLAN_INFO[activePlanning.status].cor}`}>
                  {STATUS_PLAN_INFO[activePlanning.status].label}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-semibold">Não iniciado</span>
              )}
            </div>

            {/* Total de Eventos */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Este Mês</span>
              <p className="text-2xl font-black text-slate-800">{eventos.length}</p>
              <span className="text-[10px] text-slate-400 font-medium">Compromissos</span>
            </div>

            {/* Oficiais */}
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Oficiais
              </span>
              <p className="text-2xl font-black text-indigo-700">{eventosOficiais.length}</p>
              <span className="text-[10px] text-slate-400 font-medium">Calendário oficial</span>
            </div>

            {/* Locais */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Locais</span>
              <p className="text-2xl font-black text-emerald-700">{eventosLocais.length}</p>
              <span className="text-[10px] text-slate-400 font-medium">Congregacionais</span>
            </div>

            {/* Bloqueados / Via Módulo */}
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <Lock className="h-3 w-3" /> Gerenciados
              </span>
              <p className="text-2xl font-black text-rose-600">{eventosBloqueados.length}</p>
              <span className="text-[10px] text-slate-400 font-medium">Por outros módulos</span>
            </div>

            {/* Próximo Evento */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                <Flame className="h-3 w-3" /> Próximo
              </span>
              {proximoEvento ? (
                <>
                  <p className="text-sm font-bold text-slate-800 line-clamp-1">{proximoEvento.titulo}</p>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {new Date(proximoEvento.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium mt-1">Nenhum agendado</span>
              )}
            </div>

          </div>

          {/* Timeline — Próximos Compromissos */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Próximos Compromissos
              </h2>
              <button
                onClick={() => setActiveTab('calendario')}
                className="text-xs text-blue-600 font-semibold hover:underline"
              >
                Ver calendário →
              </button>
            </div>

            {loading ? (
              <div className="text-sm text-slate-400 text-center py-6">Carregando...</div>
            ) : timelineEventos.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-6 flex flex-col items-center gap-2">
                <Calendar className="h-8 w-8 text-slate-200" />
                <span>Nenhum compromisso futuro para o mês selecionado.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {timelineEventos.map((evt) => {
                  const d = new Date(evt.data_inicio);
                  const corCustom = evt.agenda_tipos?.cor;
                  const nomeTipo = evt.agenda_tipos?.nome ?? TIPOS_INFO_LEGADO[evt.tipo]?.label ?? 'Outro';
                  const badgeStyle = corCustom
                    ? { backgroundColor: `${corCustom}18`, color: corCustom, borderColor: `${corCustom}30` }
                    : { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' };

                  return (
                    <div key={evt.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition group">
                      {/* Data pill */}
                      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-blue-400 uppercase leading-none">
                          {d.toLocaleDateString('pt-BR', { month: 'short' })}
                        </span>
                        <span className="text-lg font-black text-blue-700 leading-tight">{d.getDate()}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span style={badgeStyle} className="text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0">
                            {nomeTipo}
                          </span>
                          {evt.calendario_oficial && (
                            <span title="Calendário Oficial">
                              <ShieldCheck className="h-3 w-3 text-indigo-500 shrink-0" />
                            </span>
                          )}
                          {evt.bloqueado && (
                            <span title="Gerenciado por outro módulo">
                              <Lock className="h-3 w-3 text-rose-400 shrink-0" />
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 truncate">{evt.titulo}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {evt.local && <> · <MapPin className="h-3 w-3" /> {evt.local}</>}
                        </p>
                      </div>

                      {/* Ação rápida */}
                      {isEscritaPermitida && !evt.bloqueado && (
                        <button
                          onClick={() => openForm(evt)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo do Planejamento */}
          {activePlanning && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-500" />
                  Planejamento Anual {currentYear}
                </h2>
                <button
                  onClick={() => setActiveTab('planejamento')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Gerenciar →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xl font-black text-slate-800">{planningEventCount}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Compromissos no Ano</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold border inline-block ${STATUS_PLAN_INFO[activePlanning.status].cor}`}>
                    {STATUS_PLAN_INFO[activePlanning.status].label}
                  </span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Status</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-700 truncate">
                    {activePlanning.published_at
                      ? new Date(activePlanning.published_at).toLocaleDateString('pt-BR')
                      : '—'
                    }
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Publicado em</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 2: CALENDÁRIO                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calendario' && (
        <>
          {/* Barra de controle: navegação + filtros rápidos + avançados */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
            {/* Linha 1: Navegação de mês */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-600"
                  title="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-base font-bold text-slate-800 min-w-[140px] text-center">
                  {MESES_PT[currentMonth - 1]} de {currentYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-600"
                  title="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium hidden md:inline">
                  {eventosFiltrados.length} compromisso{eventosFiltrados.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setShowAdvancedFilters(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition ${
                    showAdvancedFilters || filtroTipoId || filtroCongregacao || filtroVisibilidade
                      ? 'border-blue-300 text-blue-600 bg-blue-50'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                  {showAdvancedFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>

            {/* Linha 2: Quick filters em pills */}
            <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50/60 border-b border-slate-100 overflow-x-auto">
              {([
                { key: 'todos', label: 'Todos', count: eventos.length },
                { key: 'oficiais', label: '🔵 Oficiais', count: eventosOficiais.length },
                { key: 'locais', label: '🟢 Locais', count: eventosLocais.length },
                { key: 'bloqueados', label: '🔴 Gerenciados', count: eventosBloqueados.length },
              ] as { key: QuickFilter; label: string; count: number }[]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setQuickFilter(f.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    quickFilter === f.key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {f.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    quickFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Linha 3: Filtros Avançados (recolhíveis) */}
            {showAdvancedFilters && (
              <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Tipo de Compromisso</label>
                  <select
                    value={filtroTipoId}
                    onChange={(e) => setFiltroTipoId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
                  >
                    <option value="">Todos os tipos</option>
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
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                    {orgHelper ? orgHelper.label('divisao1') : 'Congregação'}
                  </label>
                  <select
                    value={filtroCongregacao}
                    onChange={(e) => setFiltroCongregacao(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
                  >
                    <option value="">Todas</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Visibilidade</label>
                  <select
                    value={filtroVisibilidade}
                    onChange={(e) => setFiltroVisibilidade(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
                  >
                    <option value="">Todas</option>
                    <option value="privado">Privado</option>
                    <option value="lideranca">Liderança</option>
                    <option value="igreja">Membros</option>
                    <option value="ministerio">Ministério</option>
                    <option value="publico">Público</option>
                  </select>
                </div>

                {(filtroTipoId || filtroCongregacao || filtroVisibilidade) && (
                  <div className="md:col-span-3 flex justify-end">
                    <button
                      onClick={() => { setFiltroTipoId(''); setFiltroCongregacao(''); setFiltroVisibilidade(''); }}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Limpar filtros avançados
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lista de Compromissos */}
          {loading ? (
            <div className="bg-white p-12 text-center text-slate-400 rounded-2xl shadow-sm border border-slate-100 text-sm">
              Carregando compromissos...
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="bg-white p-16 text-center text-slate-400 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3">
              <Calendar className="h-10 w-10 text-slate-200" />
              <p className="text-base font-semibold text-slate-500">
                {quickFilter !== 'todos'
                  ? 'Nenhum compromisso para este filtro no mês selecionado.'
                  : 'Nenhum compromisso agendado para este mês.'}
              </p>
              {isEscritaPermitida && quickFilter === 'todos' && (
                <button
                  onClick={() => openForm(null)}
                  className="mt-1 px-4 py-2 text-sm text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-xl font-bold transition"
                >
                  + Adicionar primeiro compromisso
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {eventosFiltrados.map((evt) => {
                const dateObj = new Date(evt.data_inicio);
                const diaSemana = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
                const diaNum = dateObj.getDate();
                const hora = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const isCanceled = evt.status === 'cancelado';

                const statusInfo = STATUS_INFO[evt.status];
                const corCustom = evt.agenda_tipos?.cor;
                const nomeTipo = evt.agenda_tipos?.nome ?? TIPOS_INFO_LEGADO[evt.tipo]?.label ?? 'Outro';

                const badgeStyle = corCustom
                  ? { backgroundColor: `${corCustom}15`, color: corCustom, borderColor: `${corCustom}30` }
                  : { backgroundColor: '#f3f4f6', color: '#374151', borderColor: '#e5e7eb' };

                const origemLabel = evt.origem && evt.origem !== 'manual' && evt.origem !== ''
                  ? ORIGEM_LABELS[evt.origem as keyof typeof ORIGEM_LABELS] ?? evt.origem
                  : null;

                return (
                  <div
                    key={evt.id}
                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition group flex flex-col sm:flex-row gap-0 overflow-hidden ${
                      isCanceled ? 'border-slate-100 opacity-60' : 'border-slate-100'
                    } ${evt.calendario_oficial ? 'border-l-4 border-l-indigo-400' : ''}`}
                  >
                    {/* Coluna de Data */}
                    <div className="flex sm:flex-col items-center justify-center gap-3 sm:gap-1 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-100 px-5 py-4 sm:w-20 shrink-0">
                      <span className="text-xs font-bold text-slate-400 uppercase">{diaSemana}</span>
                      <span className="text-2xl font-black text-slate-800">{diaNum}</span>
                      <span className="text-xs text-slate-400">{hora}</span>
                    </div>

                    {/* Conteúdo Principal */}
                    <div className="flex-1 p-4 min-w-0">
                      {/* Badges linha */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span style={badgeStyle} className="text-[10px] px-2 py-0.5 rounded-full font-bold border">
                          {nomeTipo}
                        </span>
                        {evt.calendario_oficial && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                            <ShieldCheck className="h-2.5 w-2.5" /> Oficial
                          </span>
                        )}
                        {evt.bloqueado && (
                          <span
                            className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5"
                            title={origemLabel ? `Gerenciado pelo módulo ${origemLabel}` : 'Alterações devem ser feitas na origem'}
                          >
                            <Lock className="h-2.5 w-2.5" />
                            {origemLabel ? `Via ${origemLabel}` : 'Bloqueado'}
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusInfo.cor}`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                          {getEscopoLabel(evt.escopo)}
                        </span>
                      </div>

                      {/* Título */}
                      <h3 className={`text-base font-bold text-slate-800 ${isCanceled ? 'line-through text-slate-400' : ''}`}>
                        {evt.titulo}
                      </h3>

                      {/* Descrição */}
                      {evt.descricao && (
                        <p className="text-slate-500 text-sm mt-0.5 line-clamp-1">{evt.descricao}</p>
                      )}

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400 font-medium">
                        {evt.local && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {evt.local}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3 shrink-0" />
                          {getCongName(evt.church_id)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3 shrink-0" />
                          {VISIBILIDADE_INFO[evt.visibilidade]}
                        </span>
                      </div>
                    </div>

                    {/* Ações */}
                    {isEscritaPermitida && !evt.bloqueado && (
                      <div className="flex sm:flex-col items-center justify-end gap-1.5 px-3 py-4 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100">
                        {evt.status === 'agendado' && (
                          <button
                            onClick={() => handleCancelQuick(evt)}
                            className="p-2 text-amber-500 hover:bg-amber-50 border border-amber-100 rounded-xl transition"
                            title="Cancelar"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openForm(evt)}
                          className="p-2 text-slate-500 hover:bg-slate-50 border border-slate-200 hover:text-blue-600 rounded-xl transition"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {evt.status === 'agendado' && (
                          <button
                            onClick={() => handleDelete(evt)}
                            className="p-2 text-rose-500 hover:bg-rose-50 border border-rose-100 hover:text-rose-700 rounded-xl transition"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ABA 3: PLANEJAMENTO ANUAL                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'planejamento' && (
        <div className="space-y-5">

          {/* Cabeçalho com seletor de ano */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Exercício do Planejamento Anual</h2>
                <p className="text-sm text-slate-400 mt-0.5">Ciclo de vida e publicação do calendário oficial.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFiltroMes(`${currentYear - 1}-01`)}
                  className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg transition"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                <span className="text-lg font-black text-slate-700 px-2">{currentYear}</span>
                <button
                  onClick={() => setFiltroMes(`${currentYear + 1}-01`)}
                  className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg transition"
                >
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </button>
              </div>
            </div>
          </div>

          {activePlanning ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Métricas */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide border-b border-slate-100 pb-3">
                  Resumo do Exercício
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status Geral</span>
                    <span className={`text-sm px-3 py-1 rounded-full font-bold border inline-block ${STATUS_PLAN_INFO[activePlanning.status].cor}`}>
                      {STATUS_PLAN_INFO[activePlanning.status].label}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Total de Compromissos</span>
                    <p className="text-2xl font-black text-slate-800">{planningEventCount}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Metadados de Publicação</span>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>
                      {activePlanning.published_at
                        ? `Publicado em ${new Date(activePlanning.published_at).toLocaleString('pt-BR')}`
                        : 'Ainda não publicado'}
                    </span>
                  </div>
                  {responsibleEmail && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Por: {responsibleEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações de Estado */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide border-b border-slate-100 pb-3 mb-5">
                  Ações do Planejamento
                </h3>

                <div className="space-y-3">
                  {activePlanning.status === 'rascunho' && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-1 flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Publicar Calendário Oficial
                      </p>
                      <p className="text-xs text-blue-600 mb-3">
                        Tornará o calendário somente-leitura para edições normais. Alterações subsequentes requerem exceção formal.
                      </p>
                      <button
                        onClick={handlePublishPlanning}
                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-sm shadow-md shadow-blue-500/10"
                      >
                        <Check className="h-4 w-4" />
                        Publicar Agora
                      </button>
                    </div>
                  )}

                  {activePlanning.status === 'publicado' && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-sm font-semibold text-indigo-800 mb-1 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Calendário Oficial Publicado
                      </p>
                      <p className="text-xs text-indigo-600">
                        Este calendário está ativo e protegido. Para alterações, utilize o fluxo de Solicitações.
                      </p>
                    </div>
                  )}

                  {activePlanning.status !== 'arquivado' && (
                    <button
                      onClick={handleArchivePlanning}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl transition text-sm"
                    >
                      <Archive className="h-4 w-4 text-slate-400" />
                      Arquivar Planejamento
                    </button>
                  )}

                  {activePlanning.status === 'arquivado' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-sm font-semibold text-slate-500 flex items-center justify-center gap-2">
                      <Lock className="h-4 w-4" />
                      Este planejamento foi arquivado de forma definitiva.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <Calendar className="h-12 w-12 text-slate-200" />
              <p className="text-base font-semibold text-slate-500">
                Nenhum planejamento inicializado para {currentYear}.
              </p>
              <p className="text-xs">
                Ele será criado automaticamente quando o primeiro compromisso for inserido na aba Calendário.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL DE FORMULÁRIO                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editEvento ? 'Editar Compromisso' : 'Novo Compromisso'}
                </h2>
                {editEvento && (
                  <p className="text-xs text-slate-400 mt-0.5">Atualizando: {editEvento.titulo}</p>
                )}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">

                {/* Grupo 1: Essencial */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Título *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Reunião Geral de Obreiros"
                      value={form.titulo}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Tipo *</label>
                      <select
                        value={form.tipo_id}
                        required
                        onChange={(e) => handleTipoChange(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
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
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as AgendaEvento['status'] })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        <option value="agendado">Agendado</option>
                        <option value="cancelado">Cancelado</option>
                        <option value="concluido">Concluído</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Início *</label>
                      <input
                        type="datetime-local"
                        required
                        value={form.data_inicio}
                        onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Fim</label>
                      <input
                        type="datetime-local"
                        value={form.data_fim}
                        onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Local</label>
                    <input
                      type="text"
                      placeholder="Templo Central, Sala 3 ou link..."
                      value={form.local}
                      onChange={(e) => setForm({ ...form, local: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Toggle Campos Avançados */}
                <button
                  type="button"
                  onClick={() => setShowAdvancedFormFields(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border border-dashed border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 transition"
                >
                  <span>Configurações avançadas (Escopo, Visibilidade, Bloqueio...)</span>
                  {showAdvancedFormFields
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />
                  }
                </button>

                {/* Campos Avançados */}
                {showAdvancedFormFields && (
                  <div className="space-y-3 border border-slate-100 rounded-xl p-4 bg-slate-50/50">

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Descrição</label>
                      <textarea
                        placeholder="Detalhamento do compromisso, pauta, etc."
                        value={form.descricao}
                        onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Escopo</label>
                        <select
                          value={form.escopo}
                          onChange={(e) => setForm({ ...form, escopo: e.target.value as AgendaEvento['escopo'] })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        >
                          <option value="organizacao">{orgHelper ? orgHelper.label('organizacao') : 'Organização'}</option>
                          {orgHelper?.ativa('divisao3') && <option value="divisao3">{orgHelper.label('divisao3')}</option>}
                          {orgHelper?.ativa('divisao2') && <option value="divisao2">{orgHelper.label('divisao2')}</option>}
                          {orgHelper?.ativa('divisao1') && <option value="divisao1">{orgHelper.label('divisao1')}</option>}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Visibilidade</label>
                        <select
                          value={form.visibilidade}
                          onChange={(e) => setForm({ ...form, visibilidade: e.target.value as AgendaEvento['visibilidade'] })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
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
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">
                        {orgHelper ? orgHelper.label('divisao1') : 'Congregação'}
                      </label>
                      <select
                        value={form.church_id}
                        onChange={(e) => setForm({ ...form, church_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">Todas (Consolidado)</option>
                        {congregacoes.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Regra de Posicionamento</label>
                      <select
                        value={form.regra_posicionamento}
                        onChange={(e) => setForm({ ...form, regra_posicionamento: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">Nenhuma (Data Fixa)</option>
                        <option value="primeiro_domingo">Primeiro Domingo</option>
                        <option value="segundo_domingo">Segundo Domingo</option>
                        <option value="terceiro_domingo">Terceiro Domingo</option>
                        <option value="ultimo_domingo">Último Domingo</option>
                        <option value="sem_regra">Sem Regra de Posicionamento</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-6 pt-1">
                      <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.calendario_oficial}
                          onChange={(e) => setForm({ ...form, calendario_oficial: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                        />
                        Calendário Oficial
                      </label>
                      <label className={`flex items-center gap-2 text-sm font-semibold ${isAdmin ? 'text-slate-700 cursor-pointer' : 'text-slate-300 cursor-not-allowed select-none'}`}>
                        <input
                          type="checkbox"
                          disabled={!isAdmin}
                          checked={form.gera_bloqueio}
                          onChange={(e) => setForm({ ...form, gera_bloqueio: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 disabled:opacity-40"
                        />
                        Gera Bloqueio
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-white transition text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl transition text-sm shadow-md shadow-blue-500/10 disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : (editEvento ? 'Salvar Alterações' : 'Criar Compromisso')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
