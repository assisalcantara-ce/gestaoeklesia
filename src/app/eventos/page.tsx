'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  Bed, CalendarDays, CheckCircle, Clock, Copy, CreditCard,
  Download, FileBarChart2, Globe, Lock, MapPin, Pencil,
  Plus, Search, Trash2, Users, X,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoEvento    = 'culto_especial' | 'conferencia' | 'retiro' | 'evangelismo' | 'treinamento' | 'social' | 'outro';
type StatusEvento  = 'programado' | 'em_andamento' | 'realizado' | 'cancelado';
type StatusInscricao = 'confirmado' | 'cancelado' | 'lista_espera' | 'aguardando_pagamento' | 'expirado';
type StatusHospedagem = 'nao_aplicavel' | 'solicitada' | 'confirmada' | 'lista_espera' | 'cancelada';
type AbaEvento     = 'eventos' | 'inscricoes' | 'checkin' | 'pagamentos' | 'relatorios';

interface Congregacao { id: string; nome: string; }
interface Membro      { id: string; nome_completo: string; }

interface Evento {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: TipoEvento;
  data_inicio: string;
  data_fim: string | null;
  local_nome: string | null;
  local_endereco: string | null;
  capacidade: number | null;
  is_publico: boolean;
  aceita_inscricao: boolean;
  valor_inscricao: number;
  status: StatusEvento;
  slug: string | null;
  // Campos adicionados em 20260526200000
  inclui_hospedagem?: boolean;
  vagas_hospedagem?: number | null;
  descricao_hospedagem?: string | null;
  programacao?: string | null;
  criado_por: string | null;
  created_at: string;
  congregacao_nome?: string;
}

interface Inscricao {
  id: string;
  evento_id: string;
  ministry_id: string;
  member_id: string | null;
  nome_externo: string | null;
  email_externo: string | null;
  telefone: string | null;
  status: StatusInscricao;
  observacoes: string | null;
  presente: boolean;
  checkin_em: string | null;
  checkin_por: string | null;
  // Campos adicionados em 20260526200000
  com_hospedagem?: boolean;
  status_hospedagem?: StatusHospedagem;
  criado_por: string | null;
  created_at: string;
  nome_display?: string;
}

interface Pagamento {
  id: string;
  gateway: string;
  gateway_charge_id: string | null;
  payment_method: string;
  valor: number;
  status: string;
  pix_payload: string | null;
  invoice_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  inscricao_id: string;
}

interface UserScope { canWrite: boolean; canDelete: boolean; canFinanceiro: boolean; }

type FormEvento = {
  congregacao_id: string;
  titulo: string;
  descricao: string;
  tipo: TipoEvento;
  data_inicio: string;
  data_fim: string;
  local_nome: string;
  local_endereco: string;
  capacidade: string;
  is_publico: boolean;
  aceita_inscricao: boolean;
  valor_inscricao: string;
  status: StatusEvento;
  inclui_hospedagem: boolean;
  vagas_hospedagem: string;
  descricao_hospedagem: string;
  programacao: string;
};

type FormInscricao = {
  member_id: string;
  nome_externo: string;
  email_externo: string;
  telefone: string;
  status: StatusInscricao;
  observacoes: string;
  com_hospedagem: boolean;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_EVENTO: { value: TipoEvento; label: string }[] = [
  { value: 'culto_especial', label: 'Culto Especial' },
  { value: 'conferencia',    label: 'Conferência'    },
  { value: 'retiro',         label: 'Retiro'         },
  { value: 'evangelismo',    label: 'Evangelismo'    },
  { value: 'treinamento',    label: 'Treinamento'    },
  { value: 'social',         label: 'Social'         },
  { value: 'outro',          label: 'Outro'          },
];

const STATUS_EVENTO: { value: StatusEvento; label: string; cor: string }[] = [
  { value: 'programado',   label: 'Programado',   cor: 'bg-blue-100 text-blue-700'     },
  { value: 'em_andamento', label: 'Em Andamento', cor: 'bg-yellow-100 text-yellow-700' },
  { value: 'realizado',    label: 'Realizado',    cor: 'bg-green-100 text-green-700'   },
  { value: 'cancelado',    label: 'Cancelado',    cor: 'bg-red-100 text-red-700'       },
];

const STATUS_INSCRICAO: { value: StatusInscricao; label: string; cor: string }[] = [
  { value: 'confirmado',           label: 'Confirmado',        cor: 'bg-green-100 text-green-700'   },
  { value: 'cancelado',            label: 'Cancelado',         cor: 'bg-red-100 text-red-700'       },
  { value: 'lista_espera',         label: 'Lista de Espera',   cor: 'bg-yellow-100 text-yellow-700' },
  { value: 'aguardando_pagamento', label: 'Aguard. Pagamento', cor: 'bg-blue-100 text-blue-700'     },
  { value: 'expirado',             label: 'Expirado',          cor: 'bg-gray-100 text-gray-500'     },
];

const STATUS_HOSPEDAGEM: { value: StatusHospedagem; label: string; cor: string }[] = [
  { value: 'nao_aplicavel', label: 'N/A',        cor: 'bg-gray-100 text-gray-400'     },
  { value: 'solicitada',    label: 'Solicitada', cor: 'bg-blue-100 text-blue-700'     },
  { value: 'confirmada',    label: 'Confirmada', cor: 'bg-green-100 text-green-700'   },
  { value: 'lista_espera',  label: 'Fila',       cor: 'bg-yellow-100 text-yellow-700' },
  { value: 'cancelada',     label: 'Cancelada',  cor: 'bg-red-100 text-red-700'       },
];

const STATUS_PAGAMENTO: Record<string, { label: string; cor: string }> = {
  pendente:  { label: 'Pendente',  cor: 'bg-yellow-100 text-yellow-700' },
  pago:      { label: 'Pago',      cor: 'bg-green-100 text-green-700'   },
  cancelado: { label: 'Cancelado', cor: 'bg-red-100 text-red-700'       },
  expirado:  { label: 'Expirado',  cor: 'bg-gray-100 text-gray-500'     },
  estornado: { label: 'Estornado', cor: 'bg-purple-100 text-purple-700' },
};

const FORM_EVENTO_INICIAL: FormEvento = {
  congregacao_id: '', titulo: '', descricao: '', tipo: 'culto_especial',
  data_inicio: '', data_fim: '', local_nome: '', local_endereco: '',
  capacidade: '', is_publico: true, aceita_inscricao: false,
  valor_inscricao: '0', status: 'programado',
  inclui_hospedagem: false, vagas_hospedagem: '', descricao_hospedagem: '',
  programacao: '',
};

const FORM_INSCRICAO_INICIAL: FormInscricao = {
  member_id: '', nome_externo: '', email_externo: '', telefone: '',
  status: 'confirmado', observacoes: '', com_hospedagem: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const fmtBRL = (v: number) =>
  v === 0 ? 'Gratuito' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mesAtualEvento = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

// Retorna o mês seguinte no formato YYYY-MM (seguro: nunca lança exceção)
const mesProximoEvento = (mes: string): string => {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1); // m = 1-12 → new Date(y, m, 1) avança corretamente
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const statusEventoCor   = (s: StatusEvento)   => STATUS_EVENTO.find(x => x.value === s)?.cor    ?? 'bg-gray-100 text-gray-600';
const statusEventoLabel = (s: StatusEvento)   => STATUS_EVENTO.find(x => x.value === s)?.label  ?? s;
const tipoLabel         = (t: TipoEvento)     => TIPOS_EVENTO.find(x => x.value === t)?.label   ?? t;
const statusInscricaoCor   = (s: StatusInscricao)     => STATUS_INSCRICAO.find(x => x.value === s)?.cor   ?? 'bg-gray-100 text-gray-600';
const statusInscricaoLabel = (s: StatusInscricao)     => STATUS_INSCRICAO.find(x => x.value === s)?.label ?? s;
const statusHospLabel = (s: StatusHospedagem | undefined) => STATUS_HOSPEDAGEM.find(x => x.value === s)?.label ?? 'N/A';
const statusHospCor   = (s: StatusHospedagem | undefined) => STATUS_HOSPEDAGEM.find(x => x.value === s)?.cor   ?? 'bg-gray-100 text-gray-400';

const exportarCSVInscricoes = (inscricoes: Inscricao[], tituloEvento: string) => {
  const header = ['Nome', 'E-mail', 'Telefone', 'Status', 'Presente', 'Check-in', 'Hospedagem', 'Status Hospedagem', 'Observações'];
  const rows = inscricoes.map(i => [
    i.nome_display ?? i.nome_externo ?? '—',
    i.email_externo ?? '—',
    i.telefone ?? '—',
    statusInscricaoLabel(i.status),
    i.presente ? 'Sim' : 'Não',
    i.checkin_em ? fmtDateTime(i.checkin_em) : '—',
    i.com_hospedagem ? 'Sim' : 'Não',
    statusHospLabel(i.status_hospedagem),
    i.observacoes ?? '—',
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c)}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `inscricoes_${tituloEvento.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EventosPage() {
  const { user }           = useRequireSupabaseAuth();
  const { ctx, bloqueado } = useRequireModulo('eventos');
  const supabase           = createClient();

  // ── Estado global ─────────────────────────────────────────────────────────
  const [ministryId,   setMinistryId]   = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [scope,        setScope]        = useState<UserScope>({ canWrite: false, canDelete: false, canFinanceiro: false });
  const [loadingData,  setLoadingData]  = useState(true);

  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; type: 'success'|'error'|'info' }>
    ({ open: false, title: '', message: '', type: 'success' });
  const showModal = (title: string, message: string, type: 'success'|'error'|'info' = 'success') =>
    setModal({ open: true, title, message, type });

  // ── Abas ──────────────────────────────────────────────────────────────────
  const [aba,                setAba]               = useState<AbaEvento>('eventos');
  const [eventoSelecionado,  setEventoSelecionado] = useState<Evento | null>(null);

  // ── Tab Eventos ───────────────────────────────────────────────────────────
  const [eventos,        setEventos]        = useState<Evento[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [filtroMesEv,    setFiltroMesEv]    = useState(mesAtualEvento());
  const [filtroStatus,   setFiltroStatus]   = useState<'' | StatusEvento>('');
  const [filtroCongEv,   setFiltroCongEv]   = useState('');
  const [buscaEv,        setBuscaEv]        = useState('');
  const [showForm,       setShowForm]       = useState(false);
  const [editandoId,     setEditandoId]     = useState<string | null>(null);
  const [formEvento,     setFormEvento]     = useState<FormEvento>(FORM_EVENTO_INICIAL);
  const [salvando,       setSalvando]       = useState(false);

  // ── Tab Inscrições ────────────────────────────────────────────────────────
  const [inscricoes,        setInscricoes]       = useState<Inscricao[]>([]);
  const [loadingInsc,       setLoadingInsc]       = useState(false);
  const [buscaInsc,         setBuscaInsc]         = useState('');
  const [filtroStatusInsc,  setFiltroStatusInsc]  = useState<'' | StatusInscricao>('');
  const [showFormInsc,      setShowFormInsc]      = useState(false);
  const [formInsc,          setFormInsc]          = useState<FormInscricao>(FORM_INSCRICAO_INICIAL);
  const [buscaMembro,       setBuscaMembro]       = useState('');
  const [resultadosMembro,  setResultadosMembro]  = useState<Membro[]>([]);
  const [membroSelecionado, setMembroSelecionado] = useState<Membro | null>(null);

  // ── Tab Pagamentos ────────────────────────────────────────────────────────
  const [pagamentos,  setPagamentos]  = useState<Pagamento[]>([]);
  const [loadingPag,  setLoadingPag]  = useState(false);

  // ── Tab Check-in ──────────────────────────────────────────────────────────
  const [buscaCheckin, setBuscaCheckin] = useState('');

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || ctx.loading) return;
    (async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      if (!mid) { setLoadingData(false); return; }
      setMinistryId(mid);

      const [{ data: congs }, { data: mu }, { data: owner }] = await Promise.all([
        supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome'),
        supabase.from('ministry_users').select('permissions, role').eq('user_id', user.id).eq('ministry_id', mid).single(),
        supabase.from('ministries').select('id').eq('id', mid).eq('user_id', user.id).maybeSingle(),
      ]);

      setCongregacoes((congs ?? []) as Congregacao[]);

      const isOwner = !!owner;
      const perms   = ((mu as { permissions?: string[] } | null)?.permissions ?? []);
      const role    = ((mu as { role?: string } | null)?.role ?? '');
      const isAdmin  = perms.includes('ADMINISTRADOR') || role === 'admin' || isOwner;
      const isSecret = perms.includes('SECRETARIO');
      const isFinanc = perms.includes('FINANCEIRO');
      setScope({ canWrite: isAdmin || isSecret, canDelete: isAdmin, canFinanceiro: isAdmin || isFinanc });
      setLoadingData(false);
    })();
  }, [user, ctx.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carregar eventos (bug fix: guarda contra mes vazio/inválido) ───────────
  const carregarEventos = useCallback(async (
    mes: string, status: string, cong: string, busca: string,
  ) => {
    if (!ministryId) return;
    setLoadingEventos(true);
    const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));

    let q = supabase
      .from('eventos')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('data_inicio', { ascending: true });

    // Só aplica filtro de mês se o valor for válido (YYYY-MM).
    // Evita o erro "invalid input syntax for type timestamp with time zone: '-01'"
    // que ocorre quando o campo <input type="month"> é limpo pelo usuário.
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const prox = mesProximoEvento(mes);
      q = q
        .gte('data_inicio', `${mes}-01T00:00:00`)
        .lt('data_inicio',  `${prox}-01T00:00:00`);
    }

    if (status) q = q.eq('status', status);
    if (cong)   q = q.eq('congregacao_id', cong);

    const { data, error } = await q;
    if (error) {
      showModal('Erro ao carregar eventos', error.message, 'error');
      setLoadingEventos(false);
      return;
    }

    let list = (data ?? []) as Evento[];

    // Busca textual client-side (simples, evita ILIKE com wildcard duplo)
    if (busca.trim()) {
      const t = busca.toLowerCase();
      list = list.filter(e =>
        e.titulo.toLowerCase().includes(t) ||
        (e.descricao ?? '').toLowerCase().includes(t) ||
        (e.local_nome ?? '').toLowerCase().includes(t),
      );
    }

    setEventos(list.map(e => ({
      ...e,
      congregacao_nome: e.congregacao_id ? (congMap.get(e.congregacao_id) ?? 'Sede') : 'Sede',
    })));
    setLoadingEventos(false);
  }, [ministryId, supabase, congregacoes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ministryId || loadingData) return;
    carregarEventos(filtroMesEv, filtroStatus, filtroCongEv, buscaEv);
  }, [filtroMesEv, filtroStatus, filtroCongEv, buscaEv, ministryId, loadingData, carregarEventos]);

  // ── Carregar inscrições ────────────────────────────────────────────────────
  const carregarInscricoes = useCallback(async (eventoId: string) => {
    setLoadingInsc(true);
    const { data, error } = await supabase
      .from('eventos_inscricoes')
      .select('*, members(nome_completo)')
      .eq('evento_id', eventoId)
      .order('created_at', { ascending: false });

    if (error) { showModal('Erro', error.message, 'error'); setLoadingInsc(false); return; }

    type RawInsc = Inscricao & { members?: { nome_completo: string } | null };
    setInscricoes(((data ?? []) as RawInsc[]).map(i => ({
      ...i,
      nome_display: i.member_id ? (i.members?.nome_completo ?? '—') : (i.nome_externo ?? '—'),
    })));
    setLoadingInsc(false);
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const needsInscricoes = ['inscricoes', 'checkin', 'relatorios'].includes(aba);
    if (needsInscricoes && eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  }, [aba, eventoSelecionado, carregarInscricoes]);

  // ── Carregar pagamentos ────────────────────────────────────────────────────
  const carregarPagamentos = useCallback(async (eventoId: string) => {
    setLoadingPag(true);
    const { data, error } = await supabase
      .from('eventos_pagamentos')
      .select('id,gateway,gateway_charge_id,payment_method,valor,status,pix_payload,invoice_url,expires_at,paid_at,created_at,inscricao_id')
      .eq('evento_id', eventoId)
      .order('created_at', { ascending: false });

    if (error) { showModal('Erro', error.message, 'error'); setLoadingPag(false); return; }
    setPagamentos((data ?? []) as Pagamento[]);
    setLoadingPag(false);
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (aba === 'pagamentos' && eventoSelecionado) carregarPagamentos(eventoSelecionado.id);
  }, [aba, eventoSelecionado, carregarPagamentos]);

  // ── Buscar membros ─────────────────────────────────────────────────────────
  const buscarMembro = useCallback(async (q: string) => {
    if (!ministryId || q.length < 3) { setResultadosMembro([]); return; }
    const { data } = await supabase
      .from('members').select('id, nome_completo')
      .eq('ministry_id', ministryId).ilike('nome_completo', `%${q}%`).limit(8);
    setResultadosMembro((data ?? []) as Membro[]);
  }, [ministryId, supabase]);

  useEffect(() => { buscarMembro(buscaMembro); }, [buscaMembro, buscarMembro]);

  // ── Memos ──────────────────────────────────────────────────────────────────
  const totais = useMemo(() => ({
    programado:   eventos.filter(e => e.status === 'programado').length,
    em_andamento: eventos.filter(e => e.status === 'em_andamento').length,
    realizado:    eventos.filter(e => e.status === 'realizado').length,
    cancelado:    eventos.filter(e => e.status === 'cancelado').length,
  }), [eventos]);

  const insPorStatus = useMemo(() => ({
    total:       inscricoes.length,
    confirmados: inscricoes.filter(i => i.status === 'confirmado').length,
    presentes:   inscricoes.filter(i => i.presente).length,
    listaEspera: inscricoes.filter(i => i.status === 'lista_espera').length,
    cancelados:  inscricoes.filter(i => i.status === 'cancelado').length,
    hospedagem:  inscricoes.filter(i => i.com_hospedagem).length,
  }), [inscricoes]);

  const inscricoesFiltradas = useMemo(() => {
    let list = inscricoes;
    if (filtroStatusInsc) list = list.filter(i => i.status === filtroStatusInsc);
    if (buscaInsc) {
      const t = buscaInsc.toLowerCase();
      list = list.filter(i =>
        (i.nome_display ?? '').toLowerCase().includes(t) ||
        (i.email_externo ?? '').toLowerCase().includes(t) ||
        (i.telefone ?? '').toLowerCase().includes(t),
      );
    }
    return list;
  }, [inscricoes, filtroStatusInsc, buscaInsc]);

  const checkinFiltrado = useMemo(() => {
    const base = buscaCheckin.trim()
      ? inscricoes
      : inscricoes.filter(i => i.status === 'confirmado' || i.presente);
    if (!buscaCheckin.trim()) return base;
    const t = buscaCheckin.toLowerCase();
    return inscricoes.filter(i =>
      (i.nome_display ?? '').toLowerCase().includes(t) ||
      (i.email_externo ?? '').toLowerCase().includes(t),
    );
  }, [inscricoes, buscaCheckin]);

  // ── Helper: selecionar evento e trocar aba ─────────────────────────────────
  const selecionarEvento = (e: Evento, proximaAba: AbaEvento) => {
    setEventoSelecionado(e);
    setInscricoes([]);
    setPagamentos([]);
    setAba(proximaAba);
    setBuscaInsc('');
    setFiltroStatusInsc('');
    setBuscaCheckin('');
  };

  // ── Salvar evento ──────────────────────────────────────────────────────────
  const handleSaveEvento = async () => {
    if (!ministryId || !formEvento.titulo.trim() || !formEvento.data_inicio) {
      showModal('Campo obrigatório', 'Preencha título e data de início.', 'error');
      return;
    }
    setSalvando(true);
    const payload = {
      ministry_id:          ministryId,
      congregacao_id:       formEvento.congregacao_id || null,
      titulo:               formEvento.titulo.trim(),
      descricao:            formEvento.descricao || null,
      tipo:                 formEvento.tipo,
      data_inicio:          formEvento.data_inicio,
      data_fim:             formEvento.data_fim || null,
      local_nome:           formEvento.local_nome || null,
      local_endereco:       formEvento.local_endereco || null,
      capacidade:           formEvento.capacidade ? parseInt(formEvento.capacidade) : null,
      is_publico:           formEvento.is_publico,
      aceita_inscricao:     formEvento.aceita_inscricao,
      valor_inscricao:      parseFloat(formEvento.valor_inscricao) || 0,
      status:               formEvento.status,
      inclui_hospedagem:    formEvento.inclui_hospedagem,
      vagas_hospedagem:     formEvento.vagas_hospedagem ? parseInt(formEvento.vagas_hospedagem) : null,
      descricao_hospedagem: formEvento.descricao_hospedagem || null,
      programacao:          formEvento.programacao || null,
      criado_por:           user?.id ?? null,
      updated_at:           new Date().toISOString(),
    };

    const { error } = editandoId
      ? await supabase.from('eventos').update(payload).eq('id', editandoId)
      : await supabase.from('eventos').insert(payload);

    setSalvando(false);
    if (error) { showModal('Erro ao salvar', error.message, 'error'); return; }
    showModal('Sucesso', editandoId ? 'Evento atualizado.' : 'Evento criado!', 'success');
    setShowForm(false);
    setEditandoId(null);
    setFormEvento(FORM_EVENTO_INICIAL);
    carregarEventos(filtroMesEv, filtroStatus, filtroCongEv, buscaEv);
  };

  const handleEditEvento = (e: Evento) => {
    setEditandoId(e.id);
    setFormEvento({
      congregacao_id:       e.congregacao_id ?? '',
      titulo:               e.titulo,
      descricao:            e.descricao ?? '',
      tipo:                 e.tipo,
      data_inicio:          e.data_inicio.slice(0, 16),
      data_fim:             e.data_fim ? e.data_fim.slice(0, 16) : '',
      local_nome:           e.local_nome ?? '',
      local_endereco:       e.local_endereco ?? '',
      capacidade:           e.capacidade?.toString() ?? '',
      is_publico:           e.is_publico,
      aceita_inscricao:     e.aceita_inscricao,
      valor_inscricao:      e.valor_inscricao.toString(),
      status:               e.status,
      inclui_hospedagem:    e.inclui_hospedagem ?? false,
      vagas_hospedagem:     e.vagas_hospedagem?.toString() ?? '',
      descricao_hospedagem: e.descricao_hospedagem ?? '',
      programacao:          e.programacao ?? '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEvento = async (id: string) => {
    if (!confirm('Excluir este evento? Todas as inscrições serão removidas.')) return;
    const { error } = await supabase.from('eventos').delete().eq('id', id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    if (eventoSelecionado?.id === id) { setEventoSelecionado(null); setAba('eventos'); }
    carregarEventos(filtroMesEv, filtroStatus, filtroCongEv, buscaEv);
  };

  // ── Inscrições ─────────────────────────────────────────────────────────────
  const handleSaveInscricao = async () => {
    if (!ministryId || !eventoSelecionado) return;
    const temMembro  = !!membroSelecionado;
    const temExterno = !!formInsc.nome_externo.trim();
    if (!temMembro && !temExterno) {
      showModal('Campo obrigatório', 'Selecione um membro ou informe o nome do participante.', 'error');
      return;
    }

    let statusFinal = formInsc.status;
    if (statusFinal === 'confirmado' && eventoSelecionado.capacidade != null) {
      const { count } = await supabase
        .from('eventos_inscricoes').select('id', { count: 'exact', head: true })
        .eq('evento_id', eventoSelecionado.id).eq('status', 'confirmado');
      if ((count ?? 0) >= eventoSelecionado.capacidade) {
        showModal('Evento lotado', `Limite de ${eventoSelecionado.capacidade} vagas atingido. Inscrição irá para lista de espera.`, 'info');
        statusFinal = 'lista_espera';
      }
    }

    const { error } = await supabase.from('eventos_inscricoes').insert({
      evento_id:         eventoSelecionado.id,
      ministry_id:       ministryId,
      member_id:         membroSelecionado?.id ?? null,
      nome_externo:      temExterno ? formInsc.nome_externo.trim() : null,
      email_externo:     formInsc.email_externo || null,
      telefone:          formInsc.telefone || null,
      status:            statusFinal,
      observacoes:       formInsc.observacoes || null,
      com_hospedagem:    formInsc.com_hospedagem,
      status_hospedagem: formInsc.com_hospedagem ? 'solicitada' : 'nao_aplicavel',
      criado_por:        user?.id ?? null,
    });

    if (error) {
      showModal('Erro', error.code === '23505' ? 'Este membro já está inscrito neste evento.' : error.message, 'error');
      return;
    }
    showModal('Sucesso', 'Inscrição realizada.', 'success');
    setShowFormInsc(false);
    setFormInsc(FORM_INSCRICAO_INICIAL);
    setMembroSelecionado(null);
    setBuscaMembro('');
    carregarInscricoes(eventoSelecionado.id);
  };

  const handleDeleteInscricao = async (id: string) => {
    if (!confirm('Remover esta inscrição?')) return;
    const { error } = await supabase.from('eventos_inscricoes').delete().eq('id', id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    if (eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  };

  const handleCheckin = async (insc: Inscricao) => {
    const presente = !insc.presente;
    const { error } = await supabase.from('eventos_inscricoes').update({
      presente,
      checkin_em:  presente ? new Date().toISOString() : null,
      checkin_por: presente ? (user?.id ?? null) : null,
    }).eq('id', insc.id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    if (eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  };

  const handleStatusHospedagem = async (insc: Inscricao, status: StatusHospedagem) => {
    const { error } = await supabase.from('eventos_inscricoes')
      .update({ status_hospedagem: status }).eq('id', insc.id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    if (eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  };

  const copiarLink = (e: Evento) => {
    const url = `${window.location.origin}/eventos/e/${e.slug}`;
    navigator.clipboard.writeText(url)
      .then(() => showModal('Link copiado!', url, 'success'))
      .catch(() => showModal('Link público', url, 'info'));
  };

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (ctx.loading || loadingData) return <div className="p-8 text-gray-500">Carregando...</div>;
  if (bloqueado) return null;

  // ─── JSX ───────────────────────────────────────────────────────────────────

  const ABAS_DETALHE: { id: AbaEvento; label: string }[] = [
    { id: 'inscricoes', label: 'Inscrições'  },
    { id: 'checkin',    label: 'Check-in'    },
    { id: 'pagamentos', label: 'Pagamentos'  },
    { id: 'relatorios', label: 'Relatórios'  },
  ];

  return (
    <PageLayout title="Eventos" description="Gestão de eventos, inscrições e check-in" activeMenu="eventos">
      <NotificationModal
        isOpen={modal.open}
        onClose={() => setModal(m => ({ ...m, open: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200">
        <button
          onClick={() => setAba('eventos')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors
            ${aba === 'eventos' ? 'bg-[#123b63] text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
        >
          <CalendarDays className="w-4 h-4" /> Eventos
        </button>
        {ABAS_DETALHE.map(a => (
          <button key={a.id}
            onClick={() => {
              if (!eventoSelecionado && eventos.length > 0) setEventoSelecionado(eventos[0]);
              setAba(a.id);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors
              ${aba === a.id ? 'bg-[#123b63] text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          ABA: EVENTOS
      ════════════════════════════════════════════════════════ */}
      {aba === 'eventos' && (
        <div className="space-y-6">

          {/* Contadores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATUS_EVENTO.map(s => (
              <div key={s.value} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
                <p className="text-3xl font-bold text-[#123b63]">{totais[s.value as keyof typeof totais]}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={buscaEv} onChange={e => setBuscaEv(e.target.value)}
                placeholder="Buscar evento..." className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-1">
              <input type="month" value={filtroMesEv}
                onChange={e => setFiltroMesEv(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              {filtroMesEv && (
                <button onClick={() => setFiltroMesEv('')} title="Mostrar todos os períodos"
                  className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as '' | StatusEvento)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos os status</option>
              {STATUS_EVENTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {congregacoes.length > 0 && (
              <select value={filtroCongEv} onChange={e => setFiltroCongEv(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Todas as congregações</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {scope.canWrite && (
              <button
                onClick={() => { setEditandoId(null); setFormEvento(FORM_EVENTO_INICIAL); setShowForm(v => !v); }}
                className="ml-auto flex items-center gap-2 bg-[#123b63] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#0e2d4f]">
                <Plus className="w-4 h-4" /> Novo Evento
              </button>
            )}
          </div>

          {/* Formulário */}
          {showForm && scope.canWrite && (
            <div className="bg-white rounded-xl border border-[#123b63]/30 p-6 shadow-md space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-[#123b63] text-lg">{editandoId ? 'Editar Evento' : 'Novo Evento'}</h3>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              {/* Dados principais */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dados Principais</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Título *</label>
                    <input value={formEvento.titulo} onChange={e => setFormEvento(f => ({ ...f, titulo: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Título do evento" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                    <select value={formEvento.tipo} onChange={e => setFormEvento(f => ({ ...f, tipo: e.target.value as TipoEvento }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      {TIPOS_EVENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                    <select value={formEvento.status} onChange={e => setFormEvento(f => ({ ...f, status: e.target.value as StatusEvento }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      {STATUS_EVENTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  {congregacoes.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Congregação</label>
                      <select value={formEvento.congregacao_id} onChange={e => setFormEvento(f => ({ ...f, congregacao_id: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="">Sede / Geral</option>
                        {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Datas e local */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datas e Local</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Data/hora início *</label>
                    <input type="datetime-local" value={formEvento.data_inicio}
                      onChange={e => setFormEvento(f => ({ ...f, data_inicio: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Data/hora fim</label>
                    <input type="datetime-local" value={formEvento.data_fim}
                      onChange={e => setFormEvento(f => ({ ...f, data_fim: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Local (nome)</label>
                    <input value={formEvento.local_nome} onChange={e => setFormEvento(f => ({ ...f, local_nome: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Templo Central" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Endereço completo</label>
                    <input value={formEvento.local_endereco} onChange={e => setFormEvento(f => ({ ...f, local_endereco: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rua, nº, cidade, estado" />
                  </div>
                </div>
              </div>

              {/* Inscrições */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Inscrições e Capacidade</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Capacidade total (vagas)</label>
                    <input type="number" min="0" value={formEvento.capacidade}
                      onChange={e => setFormEvento(f => ({ ...f, capacidade: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Sem limite" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Valor inscrição (R$)</label>
                    <input type="number" min="0" step="0.01" value={formEvento.valor_inscricao}
                      onChange={e => setFormEvento(f => ({ ...f, valor_inscricao: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-5 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formEvento.aceita_inscricao}
                      onChange={e => setFormEvento(f => ({ ...f, aceita_inscricao: e.target.checked }))} />
                    Aceita inscrições
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formEvento.is_publico}
                      onChange={e => setFormEvento(f => ({ ...f, is_publico: e.target.checked }))} />
                    Evento público (link público)
                  </label>
                </div>
              </div>

              {/* Hospedagem */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Hospedagem</p>
                <label className="flex items-center gap-2 cursor-pointer text-sm mb-3">
                  <input type="checkbox" checked={formEvento.inclui_hospedagem}
                    onChange={e => setFormEvento(f => ({ ...f, inclui_hospedagem: e.target.checked }))} />
                  <Bed className="w-4 h-4 text-amber-600" />
                  Este evento oferece hospedagem
                </label>
                {formEvento.inclui_hospedagem && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Vagas de hospedagem</label>
                      <input type="number" min="0" value={formEvento.vagas_hospedagem}
                        onChange={e => setFormEvento(f => ({ ...f, vagas_hospedagem: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Sem limite" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Informações da hospedagem</label>
                      <input value={formEvento.descricao_hospedagem}
                        onChange={e => setFormEvento(f => ({ ...f, descricao_hospedagem: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: Alojamento coletivo, trazer colchonete" />
                    </div>
                  </div>
                )}
              </div>

              {/* Descrição e programação */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Descrição e Programação</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Descrição</label>
                    <textarea value={formEvento.descricao}
                      onChange={e => setFormEvento(f => ({ ...f, descricao: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3}
                      placeholder="Detalhes, tema, pregador..." />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Programação / Cronograma</label>
                    <textarea value={formEvento.programacao}
                      onChange={e => setFormEvento(f => ({ ...f, programacao: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={4}
                      placeholder={'19h00 - Abertura\n19h30 - Louvor\n20h00 - Mensagem\n21h00 - Encerramento'} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleSaveEvento} disabled={salvando}
                  className="px-6 py-2 rounded-lg bg-[#123b63] text-white text-sm hover:bg-[#0e2d4f] disabled:opacity-50">
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar evento'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de eventos */}
          {loadingEventos ? (
            <p className="text-sm text-gray-400 text-center py-8">Buscando eventos...</p>
          ) : eventos.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
              <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum evento encontrado.</p>
              {filtroMesEv && (
                <button onClick={() => setFiltroMesEv('')}
                  className="mt-2 text-xs text-[#123b63] hover:underline">
                  Remover filtro de mês e mostrar todos
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {eventos.map(e => (
                <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap gap-3 items-start justify-between">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusEventoCor(e.status)}`}>
                          {statusEventoLabel(e.status)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {tipoLabel(e.tipo)}
                        </span>
                        {e.is_publico
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 flex items-center gap-1"><Globe className="w-3 h-3" /> Público</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Privado</span>
                        }
                        {e.valor_inscricao > 0
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{fmtBRL(e.valor_inscricao)}</span>
                          : e.aceita_inscricao
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Gratuito</span>
                            : null
                        }
                        {e.aceita_inscricao && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Inscrições abertas</span>
                        )}
                        {e.inclui_hospedagem && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1">
                            <Bed className="w-3 h-3" /> Hospedagem
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-[#123b63] text-base">{e.titulo}</h3>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDateTime(e.data_inicio)}{e.data_fim && ` → ${fmtDate(e.data_fim)}`}</span>
                        {e.local_nome && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.local_nome}</span>}
                        {e.congregacao_nome && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{e.congregacao_nome}</span>}
                        {e.capacidade && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{e.capacidade} vagas</span>}
                      </div>
                      {e.descricao && <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">{e.descricao}</p>}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-1.5 shrink-0 min-w-[130px]">
                      {e.is_publico && e.slug && (
                        <button onClick={() => copiarLink(e)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-400 text-emerald-700 hover:bg-emerald-50">
                          <Copy className="w-3.5 h-3.5" /> Link público
                        </button>
                      )}
                      <button onClick={() => selecionarEvento(e, 'inscricoes')}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#123b63] text-[#123b63] hover:bg-[#123b63]/5">
                        <Users className="w-3.5 h-3.5" /> Inscrições
                      </button>
                      <button onClick={() => selecionarEvento(e, 'checkin')}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500 text-green-700 hover:bg-green-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Check-in
                      </button>
                      <button onClick={() => selecionarEvento(e, 'relatorios')}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                        <FileBarChart2 className="w-3.5 h-3.5" /> Relatório
                      </button>
                      <div className="flex gap-1 pt-1">
                        {scope.canWrite && (
                          <button onClick={() => handleEditEvento(e)}
                            className="flex-1 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 border border-gray-200 flex justify-center">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {scope.canDelete && (
                          <button onClick={() => handleDeleteEvento(e.id)}
                            className="flex-1 p-1.5 rounded-lg text-red-400 hover:bg-red-50 border border-red-200 flex justify-center">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SELETOR DE EVENTO (abas de detalhe)
      ════════════════════════════════════════════════════════ */}
      {aba !== 'eventos' && (
        <div className="mb-4 space-y-2">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <label className="text-xs text-gray-500 block mb-1">Evento</label>
            <select
              value={eventoSelecionado?.id ?? ''}
              onChange={ev => {
                const found = eventos.find(x => x.id === ev.target.value) ?? null;
                setEventoSelecionado(found);
                setInscricoes([]);
                setPagamentos([]);
                setBuscaInsc('');
                setFiltroStatusInsc('');
                setBuscaCheckin('');
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— selecione um evento —</option>
              {eventos.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {fmtDate(ev.data_inicio)} | {ev.titulo} ({statusEventoLabel(ev.status)})
                </option>
              ))}
            </select>
            {eventos.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                Nenhum evento no período atual.{' '}
                <button onClick={() => { setAba('eventos'); setFiltroMesEv(''); }} className="underline">
                  Ir à aba Eventos e remover filtro de mês
                </button>
              </p>
            )}
          </div>
          {eventoSelecionado && (
            <div className="flex flex-wrap gap-2 px-1 text-xs text-gray-500 items-center">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{fmtDateTime(eventoSelecionado.data_inicio)}</span>
              {eventoSelecionado.local_nome && <><MapPin className="w-3.5 h-3.5" /><span>{eventoSelecionado.local_nome}</span></>}
              <span className={`px-2 py-0.5 rounded-full ${statusEventoCor(eventoSelecionado.status)}`}>
                {statusEventoLabel(eventoSelecionado.status)}
              </span>
              {eventoSelecionado.is_publico && eventoSelecionado.slug && (
                <button onClick={() => copiarLink(eventoSelecionado)}
                  className="flex items-center gap-1 text-emerald-600 hover:underline ml-2">
                  <Copy className="w-3 h-3" /> Copiar link público
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ABA: INSCRIÇÕES
      ════════════════════════════════════════════════════════ */}
      {aba === 'inscricoes' && eventoSelecionado && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total inscritos', val: insPorStatus.total,       cor: 'text-[#123b63]' },
              { label: 'Confirmados',     val: insPorStatus.confirmados, cor: 'text-green-600'  },
              { label: 'Lista de espera', val: insPorStatus.listaEspera, cor: 'text-amber-600'  },
              { label: 'Com hospedagem',  val: insPorStatus.hospedagem,  cor: 'text-amber-700'  },
            ].map(x => (
              <div key={x.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                <p className={`text-2xl font-bold ${x.cor}`}>{x.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{x.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={buscaInsc} onChange={e => setBuscaInsc(e.target.value)}
                placeholder="Buscar participante..." className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <select value={filtroStatusInsc} onChange={e => setFiltroStatusInsc(e.target.value as '' | StatusInscricao)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos os status</option>
              {STATUS_INSCRICAO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {scope.canWrite && (
              <button onClick={() => setShowFormInsc(v => !v)}
                className="flex items-center gap-2 bg-[#123b63] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#0e2d4f]">
                <Plus className="w-4 h-4" /> Inscrever
              </button>
            )}
            <button onClick={() => exportarCSVInscricoes(inscricoes, eventoSelecionado.titulo)}
              className="flex items-center gap-2 border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={() => carregarInscricoes(eventoSelecionado.id)}
              title="Recarregar" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm">
              ↺
            </button>
          </div>

          {showFormInsc && scope.canWrite && (
            <div className="bg-white rounded-xl border border-[#123b63]/30 p-6 shadow-md space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-[#123b63]">Nova Inscrição</h3>
                <button onClick={() => setShowFormInsc(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Buscar membro cadastrado</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input value={buscaMembro} onChange={e => { setBuscaMembro(e.target.value); setMembroSelecionado(null); }}
                    placeholder="Digite 3+ letras..." className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                {resultadosMembro.length > 0 && !membroSelecionado && (
                  <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto">
                    {resultadosMembro.map(m => (
                      <button key={m.id}
                        onClick={() => { setMembroSelecionado(m); setBuscaMembro(m.nome_completo); setResultadosMembro([]); setFormInsc(f => ({ ...f, nome_externo: '' })); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                        {m.nome_completo}
                      </button>
                    ))}
                  </div>
                )}
                {membroSelecionado && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {membroSelecionado.nome_completo}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-400 text-center">— ou participante externo —</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nome (externo)</label>
                  <input value={formInsc.nome_externo} onChange={e => setFormInsc(f => ({ ...f, nome_externo: e.target.value }))}
                    disabled={!!membroSelecionado} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">E-mail</label>
                  <input type="email" value={formInsc.email_externo} onChange={e => setFormInsc(f => ({ ...f, email_externo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Telefone</label>
                  <input value={formInsc.telefone} onChange={e => setFormInsc(f => ({ ...f, telefone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select value={formInsc.status} onChange={e => setFormInsc(f => ({ ...f, status: e.target.value as StatusInscricao }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {STATUS_INSCRICAO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {eventoSelecionado.inclui_hospedagem && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={formInsc.com_hospedagem}
                    onChange={e => setFormInsc(f => ({ ...f, com_hospedagem: e.target.checked }))} />
                  <Bed className="w-4 h-4 text-amber-600" /> Solicitar hospedagem
                </label>
              )}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Observações</label>
                <textarea value={formInsc.observacoes} onChange={e => setFormInsc(f => ({ ...f, observacoes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowFormInsc(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSaveInscricao}
                  className="px-5 py-2 rounded-lg bg-[#123b63] text-white text-sm hover:bg-[#0e2d4f]">Confirmar</button>
              </div>
            </div>
          )}

          {loadingInsc ? (
            <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
          ) : inscricoesFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nenhuma inscrição encontrada.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Nome</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Contato</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Hospedagem</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Observações</th>
                    {scope.canWrite && <th className="px-4 py-3 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inscricoesFiltradas.map(i => (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-[#123b63]">{i.nome_display}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {i.email_externo && <span className="block">{i.email_externo}</span>}
                        {i.telefone && <span className="block">{i.telefone}</span>}
                        {!i.email_externo && !i.telefone && '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInscricaoCor(i.status)}`}>
                          {statusInscricaoLabel(i.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {i.com_hospedagem ? (
                          scope.canWrite ? (
                            <select
                              value={i.status_hospedagem ?? 'solicitada'}
                              onChange={e => handleStatusHospedagem(i, e.target.value as StatusHospedagem)}
                              className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer ${statusHospCor(i.status_hospedagem)}`}
                            >
                              {STATUS_HOSPEDAGEM.filter(s => s.value !== 'nao_aplicavel').map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusHospCor(i.status_hospedagem)}`}>
                              {statusHospLabel(i.status_hospedagem)}
                            </span>
                          )
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">
                        {i.observacoes ?? '—'}
                      </td>
                      {scope.canWrite && (
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteInscricao(i.id)}
                            className="p-1 rounded text-red-400 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                <span>{inscricoesFiltradas.length} inscrição(ões)</span>
                {eventoSelecionado.inclui_hospedagem && (
                  <span className="text-amber-600">{insPorStatus.hospedagem} com hospedagem</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ABA: CHECK-IN
      ════════════════════════════════════════════════════════ */}
      {aba === 'checkin' && eventoSelecionado && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
              <p className="text-3xl font-bold text-green-600">{insPorStatus.presentes}</p>
              <p className="text-xs text-gray-500 mt-0.5">Presentes</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
              <p className="text-3xl font-bold text-gray-400">{insPorStatus.confirmados - insPorStatus.presentes}</p>
              <p className="text-xs text-gray-500 mt-0.5">Ausentes</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
              <p className="text-3xl font-bold text-[#123b63]">{insPorStatus.confirmados}</p>
              <p className="text-xs text-gray-500 mt-0.5">Confirmados</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={buscaCheckin} onChange={e => setBuscaCheckin(e.target.value)}
                placeholder="Buscar por nome ou e-mail..." className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={() => carregarInscricoes(eventoSelecionado.id)}
              title="Recarregar" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm">
              ↺
            </button>
          </div>

          {loadingInsc ? (
            <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
          ) : checkinFiltrado.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
              <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nenhum inscrito encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {checkinFiltrado.map(i => (
                <div key={i.id}
                  className={`bg-white rounded-xl border p-4 shadow-sm flex items-center gap-4 transition-colors
                    ${i.presente ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#123b63] text-sm truncate">{i.nome_display}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[i.email_externo, i.telefone].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {i.checkin_em && (
                      <p className="text-xs text-green-600 mt-0.5">Check-in: {fmtDateTime(i.checkin_em)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusInscricaoCor(i.status)}`}>
                      {statusInscricaoLabel(i.status)}
                    </span>
                    {scope.canWrite && (
                      <button
                        onClick={() => handleCheckin(i)}
                        className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors
                          ${i.presente ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        {i.presente ? 'Presente ✓' : 'Confirmar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ABA: PAGAMENTOS
      ════════════════════════════════════════════════════════ */}
      {aba === 'pagamentos' && eventoSelecionado && (
        <div className="space-y-4">
          {eventoSelecionado.valor_inscricao === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              Este é um evento gratuito. Não há pagamentos associados.
            </div>
          )}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600 font-medium">{pagamentos.length} registro(s)</p>
            <button onClick={() => carregarPagamentos(eventoSelecionado.id)}
              className="text-xs text-[#123b63] hover:underline">↺ Recarregar</button>
          </div>
          {loadingPag ? (
            <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
          ) : pagamentos.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
              <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nenhum pagamento registrado.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Gateway</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Método</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Valor</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Vencimento</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Pago em</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Fatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagamentos.map(p => {
                    const st = STATUS_PAGAMENTO[p.status] ?? { label: p.status, cor: 'bg-gray-100 text-gray-600' };
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs uppercase font-medium text-gray-600">{p.gateway}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{p.payment_method}</td>
                        <td className="px-4 py-3 font-medium text-[#123b63]">{fmtBRL(p.valor)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cor}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{p.expires_at ? fmtDateTime(p.expires_at) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{p.paid_at ? fmtDateTime(p.paid_at) : '—'}</td>
                        <td className="px-4 py-3">
                          {p.invoice_url
                            ? <a href={p.invoice_url} target="_blank" rel="noreferrer" className="text-xs text-[#123b63] hover:underline">Ver fatura</a>
                            : <span className="text-xs text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                <span>{pagamentos.filter(p => p.status === 'pago').length} pago(s)</span>
                <span className="font-medium text-green-600">
                  {fmtBRL(pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ABA: RELATÓRIOS
      ════════════════════════════════════════════════════════ */}
      {aba === 'relatorios' && eventoSelecionado && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Total inscritos', val: insPorStatus.total,       cor: 'text-[#123b63]' },
              { label: 'Confirmados',     val: insPorStatus.confirmados, cor: 'text-blue-600'   },
              { label: 'Presentes',       val: insPorStatus.presentes,   cor: 'text-green-600'  },
              { label: 'Ausentes',        val: insPorStatus.confirmados - insPorStatus.presentes, cor: 'text-gray-500' },
              { label: 'Lista de espera', val: insPorStatus.listaEspera, cor: 'text-amber-600'  },
              { label: 'Cancelados',      val: insPorStatus.cancelados,  cor: 'text-red-500'    },
            ].map(x => (
              <div key={x.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className={`text-3xl font-bold ${x.cor}`}>{x.val}</p>
                <p className="text-xs text-gray-500 mt-1">{x.label}</p>
              </div>
            ))}
          </div>

          {eventoSelecionado.inclui_hospedagem && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
              <p className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <Bed className="w-4 h-4" /> Hospedagem
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {STATUS_HOSPEDAGEM.filter(s => s.value !== 'nao_aplicavel').map(s => {
                  const count = inscricoes.filter(i => i.com_hospedagem && i.status_hospedagem === s.value).length;
                  return (
                    <div key={s.value} className="bg-white rounded-lg border border-amber-100 p-3 text-center">
                      <p className="text-2xl font-bold text-amber-700">{count}</p>
                      <p className="text-xs text-amber-600 mt-0.5">{s.label}</p>
                    </div>
                  );
                })}
              </div>
              {eventoSelecionado.vagas_hospedagem && (
                <p className="text-xs text-amber-600 mt-2">Capacidade total: {eventoSelecionado.vagas_hospedagem} vagas</p>
              )}
            </div>
          )}

          {insPorStatus.confirmados > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 mb-2">Taxa de presença</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.round((insPorStatus.presentes / insPorStatus.confirmados) * 100)}%` }} />
                </div>
                <span className="text-sm font-bold text-green-600 w-12 text-right">
                  {Math.round((insPorStatus.presentes / insPorStatus.confirmados) * 100)}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {insPorStatus.presentes} de {insPorStatus.confirmados} confirmados fizeram check-in
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-[#123b63]">Detalhes do Evento</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <div><span className="text-xs text-gray-400 block">Tipo</span>{tipoLabel(eventoSelecionado.tipo)}</div>
              <div><span className="text-xs text-gray-400 block">Congregação</span>{eventoSelecionado.congregacao_nome ?? 'Sede'}</div>
              <div><span className="text-xs text-gray-400 block">Data início</span>{fmtDateTime(eventoSelecionado.data_inicio)}</div>
              {eventoSelecionado.data_fim && <div><span className="text-xs text-gray-400 block">Data fim</span>{fmtDate(eventoSelecionado.data_fim)}</div>}
              {eventoSelecionado.local_nome && <div><span className="text-xs text-gray-400 block">Local</span>{eventoSelecionado.local_nome}</div>}
              {eventoSelecionado.local_endereco && <div><span className="text-xs text-gray-400 block">Endereço</span>{eventoSelecionado.local_endereco}</div>}
              {eventoSelecionado.capacidade && <div><span className="text-xs text-gray-400 block">Capacidade</span>{eventoSelecionado.capacidade} vagas</div>}
              <div><span className="text-xs text-gray-400 block">Inscrição</span>{fmtBRL(eventoSelecionado.valor_inscricao)}</div>
            </div>
            {eventoSelecionado.descricao && (
              <div>
                <span className="text-xs text-gray-400 block mb-1">Descrição</span>
                <p className="text-sm text-gray-600 whitespace-pre-line">{eventoSelecionado.descricao}</p>
              </div>
            )}
            {eventoSelecionado.programacao && (
              <div>
                <span className="text-xs text-gray-400 block mb-1">Programação</span>
                <p className="text-sm text-gray-600 whitespace-pre-line">{eventoSelecionado.programacao}</p>
              </div>
            )}
          </div>

          <button onClick={() => exportarCSVInscricoes(inscricoes, eventoSelecionado.titulo)}
            className="flex items-center gap-2 bg-[#123b63] text-white px-5 py-2.5 rounded-lg text-sm hover:bg-[#0e2d4f]">
            <Download className="w-4 h-4" />
            Exportar lista completa (CSV)
          </button>
        </div>
      )}

      {/* Placeholder: nenhum evento selecionado nas abas de detalhe */}
      {aba !== 'eventos' && !eventoSelecionado && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Selecione um evento acima para visualizar os detalhes.</p>
        </div>
      )}
    </PageLayout>
  );
}
