'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  CalendarDays, CheckCircle, Copy, Download, MapPin,
  Pencil, Plus, Search, Trash2, Users, X,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoEvento   = 'culto_especial' | 'conferencia' | 'retiro' | 'evangelismo' | 'treinamento' | 'social' | 'outro';
type StatusEvento = 'programado' | 'em_andamento' | 'realizado' | 'cancelado';
type StatusInscricao = 'confirmado' | 'cancelado' | 'lista_espera';
type AbaEvento = 'eventos' | 'inscricoes';

interface Congregacao { id: string; nome: string; }
interface Membro { id: string; nome_completo: string; }

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
  criado_por: string | null;
  created_at: string;
  nome_display?: string;
}

interface UserScopeEvento { canWrite: boolean; canDelete: boolean; }

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
};

type FormInscricao = {
  member_id: string;
  nome_externo: string;
  email_externo: string;
  telefone: string;
  status: StatusInscricao;
  observacoes: string;
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
  { value: 'programado',   label: 'Programado',   cor: 'bg-blue-100 text-blue-700'    },
  { value: 'em_andamento', label: 'Em Andamento', cor: 'bg-yellow-100 text-yellow-700' },
  { value: 'realizado',    label: 'Realizado',    cor: 'bg-green-100 text-green-700'   },
  { value: 'cancelado',    label: 'Cancelado',    cor: 'bg-red-100 text-red-700'       },
];

const STATUS_INSCRICAO: { value: StatusInscricao; label: string; cor: string }[] = [
  { value: 'confirmado',   label: 'Confirmado',      cor: 'bg-green-100 text-green-700'   },
  { value: 'cancelado',    label: 'Cancelado',       cor: 'bg-red-100 text-red-700'       },
  { value: 'lista_espera', label: 'Lista de Espera', cor: 'bg-yellow-100 text-yellow-700' },
];

const FORM_EVENTO_INICIAL: FormEvento = {
  congregacao_id: '', titulo: '', descricao: '', tipo: 'culto_especial',
  data_inicio: '', data_fim: '', local_nome: '', local_endereco: '',
  capacidade: '', is_publico: true, aceita_inscricao: false,
  valor_inscricao: '0', status: 'programado',
};

const FORM_INSCRICAO_INICIAL: FormInscricao = {
  member_id: '', nome_externo: '', email_externo: '', telefone: '',
  status: 'confirmado', observacoes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtBRL = (v: number) =>
  v === 0 ? 'Gratuito' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusEventoCor   = (s: StatusEvento)   => STATUS_EVENTO.find(x => x.value === s)?.cor   ?? 'bg-gray-100 text-gray-600';
const statusEventoLabel = (s: StatusEvento)   => STATUS_EVENTO.find(x => x.value === s)?.label ?? s;
const tipoLabel         = (t: TipoEvento)     => TIPOS_EVENTO.find(x => x.value === t)?.label  ?? t;
const statusInscricaoCor   = (s: StatusInscricao) => STATUS_INSCRICAO.find(x => x.value === s)?.cor   ?? 'bg-gray-100 text-gray-600';
const statusInscricaoLabel = (s: StatusInscricao) => STATUS_INSCRICAO.find(x => x.value === s)?.label ?? s;

const mesAtualEvento = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

const mesProximoEvento = (mes: string): string => {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const exportarCSVInscricoes = (inscricoes: Inscricao[], tituloEvento: string) => {
  const header = ['Nome', 'E-mail', 'Telefone', 'Status', 'Presente', 'Check-in'];
  const rows = inscricoes.map(i => [
    i.nome_display ?? i.nome_externo ?? '—',
    i.email_externo ?? '—',
    i.telefone ?? '—',
    statusInscricaoLabel(i.status),
    i.presente ? 'Sim' : 'Não',
    i.checkin_em ? fmtDateTime(i.checkin_em) : '—',
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inscricoes_${tituloEvento.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EventosPage() {
  const { user }            = useRequireSupabaseAuth();
  const { ctx, bloqueado }  = useRequireModulo('eventos');
  const supabase            = createClient();

  // ── Estado global ────────────────────────────────────────────────────────
  const [ministryId,    setMinistryId]    = useState<string | null>(null);
  const [congregacoes,  setCongregacoes]  = useState<Congregacao[]>([]);
  const [scope,         setScope]         = useState<UserScopeEvento>({ canWrite: false, canDelete: false });
  const [loadingData,   setLoadingData]   = useState(true);

  // ── Aba ──────────────────────────────────────────────────────────────────
  const [aba, setAba] = useState<AbaEvento>('eventos');

  // ── Aba Eventos ──────────────────────────────────────────────────────────
  const [eventos,        setEventos]        = useState<Evento[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [filtroMesEv,    setFiltroMesEv]    = useState(mesAtualEvento());
  const [filtroStatus,   setFiltroStatus]   = useState<'' | StatusEvento>('');
  const [filtroCongEv,   setFiltroCongEv]   = useState('');
  const [showForm,       setShowForm]       = useState(false);
  const [editandoId,     setEditandoId]     = useState<string | null>(null);
  const [formEvento,     setFormEvento]     = useState<FormEvento>(FORM_EVENTO_INICIAL);
  const [salvando,       setSalvando]       = useState(false);

  // ── Aba Inscrições ───────────────────────────────────────────────────────
  const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
  const [inscricoes,        setInscricoes]        = useState<Inscricao[]>([]);
  const [loadingInsc,       setLoadingInsc]       = useState(false);
  const [buscaInsc,         setBuscaInsc]         = useState('');
  const [filtroStatusInsc,  setFiltroStatusInsc]  = useState<'' | StatusInscricao>('');
  const [showFormInsc,      setShowFormInsc]      = useState(false);
  const [formInsc,          setFormInsc]          = useState<FormInscricao>(FORM_INSCRICAO_INICIAL);
  const [buscaMembro,       setBuscaMembro]       = useState('');
  const [resultadosMembro,  setResultadosMembro]  = useState<Membro[]>([]);
  const [membroSelecionado, setMembroSelecionado] = useState<Membro | null>(null);

  // ── Modal ────────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; type: 'success'|'error'|'info' }>
    ({ open: false, title: '', message: '', type: 'success' });

  const showModal = (title: string, message: string, type: 'success'|'error'|'info' = 'success') =>
    setModal({ open: true, title, message, type });

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || ctx.loading) return;
    (async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      if (!mid) { setLoadingData(false); return; }
      setMinistryId(mid);

      const { data: congs } = await supabase
        .from('congregacoes')
        .select('id, nome')
        .eq('ministry_id', mid)
        .order('nome');
      setCongregacoes((congs ?? []) as Congregacao[]);

      const { data: mu } = await supabase
        .from('ministry_users')
        .select('permissions, role')
        .eq('user_id', user.id)
        .eq('ministry_id', mid)
        .single();

      const { data: owner } = await supabase
        .from('ministries')
        .select('id')
        .eq('id', mid)
        .eq('user_id', user.id)
        .maybeSingle();

      const isOwner = !!owner;
      const perms: string[] = (mu as { permissions?: string[] } | null)?.permissions ?? [];
      const role: string    = (mu as { role?: string } | null)?.role ?? '';
      const isAdmin  = perms.includes('ADMINISTRADOR') || role === 'admin' || isOwner;
      const isSecret = perms.includes('SECRETARIO');

      setScope({ canWrite: isAdmin || isSecret, canDelete: isAdmin });
      setLoadingData(false);
    })();
  }, [user, ctx.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carregar eventos ──────────────────────────────────────────────────────

  const carregarEventos = useCallback(async (mes: string, status: string, cong: string) => {
    if (!ministryId) return;
    setLoadingEventos(true);
    const congMap = new Map((congregacoes as Congregacao[]).map(c => [c.id, c.nome]));

    let q = supabase
      .from('eventos')
      .select('*')
      .eq('ministry_id', ministryId)
      .gte('data_inicio', `${mes}-01`)
      .lt('data_inicio', `${mesProximoEvento(mes)}-01T00:00:00`)
      .order('data_inicio', { ascending: true });

    if (status) q = q.eq('status', status);
    if (cong)   q = q.eq('congregacao_id', cong);

    const { data, error } = await q;
    if (error) { showModal('Erro', error.message, 'error'); setLoadingEventos(false); return; }

    setEventos(((data ?? []) as Evento[]).map(e => ({
      ...e,
      congregacao_nome: e.congregacao_id ? (congMap.get(e.congregacao_id) ?? 'Sede') : 'Sede',
    })));
    setLoadingEventos(false);
  }, [ministryId, supabase, congregacoes]);

  useEffect(() => {
    if (!ministryId || loadingData) return;
    carregarEventos(filtroMesEv, filtroStatus, filtroCongEv);
  }, [filtroMesEv, filtroStatus, filtroCongEv, ministryId, loadingData, carregarEventos]);

  // ── Carregar inscrições ───────────────────────────────────────────────────

  const carregarInscricoes = useCallback(async (eventoId: string) => {
    setLoadingInsc(true);
    const { data, error } = await supabase
      .from('eventos_inscricoes')
      .select('*, members(nome_completo)')
      .eq('evento_id', eventoId)
      .order('created_at', { ascending: false });

    if (error) { showModal('Erro', error.message, 'error'); setLoadingInsc(false); return; }

    setInscricoes(((data ?? []) as (Inscricao & { members?: { nome_completo: string } | null })[]).map(i => ({
      ...i,
      nome_display: i.member_id ? (i.members?.nome_completo ?? '—') : (i.nome_externo ?? '—'),
    })));
    setLoadingInsc(false);
  }, [supabase]);

  useEffect(() => {
    if (aba !== 'inscricoes' || !eventoSelecionado) return;
    carregarInscricoes(eventoSelecionado.id);
  }, [aba, eventoSelecionado, carregarInscricoes]);

  // ── Buscar membro ─────────────────────────────────────────────────────────

  const buscarMembro = useCallback(async (q: string) => {
    if (!ministryId || q.length < 3) { setResultadosMembro([]); return; }
    const { data } = await supabase
      .from('members')
      .select('id, nome_completo')
      .eq('ministry_id', ministryId)
      .ilike('nome_completo', `%${q}%`)
      .limit(8);
    setResultadosMembro((data ?? []) as Membro[]);
  }, [ministryId, supabase]);

  useEffect(() => { buscarMembro(buscaMembro); }, [buscaMembro, buscarMembro]);

  // ── Memos ──────────────────────────────────────────────────────────────

  const totais = useMemo(() => ({
    programado:   eventos.filter(e => e.status === 'programado').length,
    em_andamento: eventos.filter(e => e.status === 'em_andamento').length,
    realizado:    eventos.filter(e => e.status === 'realizado').length,
    cancelado:    eventos.filter(e => e.status === 'cancelado').length,
  }), [eventos]);

  const insPorStatus = useMemo(() => ({
    confirmados: inscricoes.filter(i => i.status === 'confirmado').length,
    presentes:   inscricoes.filter(i => i.presente).length,
    listaEspera: inscricoes.filter(i => i.status === 'lista_espera').length,
    cancelados:  inscricoes.filter(i => i.status === 'cancelado').length,
  }), [inscricoes]);

  const inscricoesFiltradas = useMemo(() => {
    let list = inscricoes;
    if (filtroStatusInsc) list = list.filter(i => i.status === filtroStatusInsc);
    if (buscaInsc) {
      const q = buscaInsc.toLowerCase();
      list = list.filter(i => (i.nome_display ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [inscricoes, filtroStatusInsc, buscaInsc]);

  // ── Handlers Evento ──────────────────────────────────────────────────────

  const handleSaveEvento = async () => {
    if (!ministryId || !formEvento.titulo || !formEvento.data_inicio) {
      showModal('Campo obrigatório', 'Preencha pelo menos o título e a data de início.', 'error');
      return;
    }
    setSalvando(true);
    const payload = {
      ministry_id:      ministryId,
      congregacao_id:   formEvento.congregacao_id || null,
      titulo:           formEvento.titulo,
      descricao:        formEvento.descricao || null,
      tipo:             formEvento.tipo,
      data_inicio:      formEvento.data_inicio,
      data_fim:         formEvento.data_fim || null,
      local_nome:       formEvento.local_nome || null,
      local_endereco:   formEvento.local_endereco || null,
      capacidade:       formEvento.capacidade ? parseInt(formEvento.capacidade) : null,
      is_publico:       formEvento.is_publico,
      aceita_inscricao: formEvento.aceita_inscricao,
      valor_inscricao:  parseFloat(formEvento.valor_inscricao) || 0,
      status:           formEvento.status,
      criado_por:       user?.id ?? null,
      updated_at:       new Date().toISOString(),
    };

    let error;
    if (editandoId) {
      ({ error } = await supabase.from('eventos').update(payload).eq('id', editandoId));
    } else {
      ({ error } = await supabase.from('eventos').insert(payload));
    }

    setSalvando(false);
    if (error) { showModal('Erro ao salvar', error.message, 'error'); return; }
    showModal('Sucesso', editandoId ? 'Evento atualizado.' : 'Evento criado com sucesso.', 'success');
    setShowForm(false);
    setEditandoId(null);
    setFormEvento(FORM_EVENTO_INICIAL);
    carregarEventos(filtroMesEv, filtroStatus, filtroCongEv);
  };

  const handleEditEvento = (e: Evento) => {
    setEditandoId(e.id);
    setFormEvento({
      congregacao_id:   e.congregacao_id ?? '',
      titulo:           e.titulo,
      descricao:        e.descricao ?? '',
      tipo:             e.tipo,
      data_inicio:      e.data_inicio.slice(0, 16),
      data_fim:         e.data_fim ? e.data_fim.slice(0, 16) : '',
      local_nome:       e.local_nome ?? '',
      local_endereco:   e.local_endereco ?? '',
      capacidade:       e.capacidade?.toString() ?? '',
      is_publico:       e.is_publico,
      aceita_inscricao: e.aceita_inscricao,
      valor_inscricao:  e.valor_inscricao.toString(),
      status:           e.status,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEvento = async (id: string) => {
    if (!confirm('Excluir este evento? Todas as inscrições serão removidas.')) return;
    const { error } = await supabase.from('eventos').delete().eq('id', id);
    if (error) { showModal('Erro ao excluir', error.message, 'error'); return; }
    showModal('Excluído', 'Evento removido.', 'success');
    carregarEventos(filtroMesEv, filtroStatus, filtroCongEv);
  };

  // ── Handlers Inscrições ──────────────────────────────────────────────────

  const handleSaveInscricao = async () => {
    if (!ministryId || !eventoSelecionado) return;
    const temMembro  = !!membroSelecionado;
    const temExterno = !!formInsc.nome_externo.trim();
    if (!temMembro && !temExterno) {
      showModal('Campo obrigatório', 'Selecione um membro ou informe o nome do participante.', 'error');
      return;
    }
    const payload = {
      evento_id:     eventoSelecionado.id,
      ministry_id:   ministryId,
      member_id:     membroSelecionado?.id ?? null,
      nome_externo:  temExterno ? formInsc.nome_externo.trim() : null,
      email_externo: formInsc.email_externo || null,
      telefone:      formInsc.telefone || null,
      status:        formInsc.status,
      observacoes:   formInsc.observacoes || null,
      criado_por:    user?.id ?? null,
    };
    const { error } = await supabase.from('eventos_inscricoes').insert(payload);
    if (error) {
      if (error.code === '23505') {
        showModal('Duplicado', 'Este membro já está inscrito neste evento.', 'error');
      } else {
        showModal('Erro', error.message, 'error');
      }
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
    const { error } = await supabase
      .from('eventos_inscricoes')
      .update({
        presente,
        checkin_em:  presente ? new Date().toISOString() : null,
        checkin_por: presente ? (user?.id ?? null) : null,
      })
      .eq('id', insc.id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    if (eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (ctx.loading || loadingData) return <div className="p-8 text-gray-500">Carregando...</div>;
  if (bloqueado) return null;

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <PageLayout title="Eventos" description="Gerenciamento de eventos e inscrições" activeMenu="eventos">
      <NotificationModal
        isOpen={modal.open}
        onClose={() => setModal(m => ({ ...m, open: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* ── Tabs ── */}
      <div className="flex gap-2 mb-6">
        {(['eventos', 'inscricoes'] as AbaEvento[]).map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors
              ${aba === a ? 'bg-[#123b63] text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
          >
            {a === 'eventos' ? 'Eventos' : 'Inscrições'}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ABA: EVENTOS
      ═══════════════════════════════════════════════════════════════════ */}
      {aba === 'eventos' && (
        <div className="space-y-6">

          {/* Cards de contagem */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATUS_EVENTO.map(s => (
              <div key={s.value} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
                <p className="text-3xl font-bold text-[#123b63]">
                  {totais[s.value as keyof typeof totais]}
                </p>
              </div>
            ))}
          </div>

          {/* Barra de filtros */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
            <input
              type="month"
              value={filtroMesEv}
              onChange={e => setFiltroMesEv(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value as '' | StatusEvento)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos os status</option>
              {STATUS_EVENTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {congregacoes.length > 0 && (
              <select
                value={filtroCongEv}
                onChange={e => setFiltroCongEv(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas as congregações</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {scope.canWrite && (
              <button
                onClick={() => { setEditandoId(null); setFormEvento(FORM_EVENTO_INICIAL); setShowForm(v => !v); }}
                className="ml-auto flex items-center gap-2 bg-[#123b63] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#0e2d4f]"
              >
                <Plus className="w-4 h-4" />
                Novo Evento
              </button>
            )}
          </div>

          {/* Formulário inline */}
          {showForm && scope.canWrite && (
            <div className="bg-white rounded-xl border border-[#123b63]/30 p-6 shadow-md space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-[#123b63]">{editandoId ? 'Editar Evento' : 'Novo Evento'}</h3>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
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
                  <label className="text-xs text-gray-500 block mb-1">Data/hora início *</label>
                  <input type="datetime-local" value={formEvento.data_inicio} onChange={e => setFormEvento(f => ({ ...f, data_inicio: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data/hora fim</label>
                  <input type="datetime-local" value={formEvento.data_fim} onChange={e => setFormEvento(f => ({ ...f, data_fim: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Local (nome)</label>
                  <input value={formEvento.local_nome} onChange={e => setFormEvento(f => ({ ...f, local_nome: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Templo Central" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Endereço</label>
                  <input value={formEvento.local_endereco} onChange={e => setFormEvento(f => ({ ...f, local_endereco: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Rua, nº, cidade" />
                </div>
                {congregacoes.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Congregação</label>
                    <select value={formEvento.congregacao_id} onChange={e => setFormEvento(f => ({ ...f, congregacao_id: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option value="">Sede (geral)</option>
                      {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select value={formEvento.status} onChange={e => setFormEvento(f => ({ ...f, status: e.target.value as StatusEvento }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {STATUS_EVENTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Capacidade (vagas)</label>
                  <input type="number" min="0" value={formEvento.capacidade} onChange={e => setFormEvento(f => ({ ...f, capacidade: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Deixe em branco = sem limite" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Valor inscrição (R$)</label>
                  <input type="number" min="0" step="0.01" value={formEvento.valor_inscricao} onChange={e => setFormEvento(f => ({ ...f, valor_inscricao: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formEvento.aceita_inscricao} onChange={e => setFormEvento(f => ({ ...f, aceita_inscricao: e.target.checked }))} />
                  Aceita inscrições
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formEvento.is_publico} onChange={e => setFormEvento(f => ({ ...f, is_publico: e.target.checked }))} />
                  Evento público
                </label>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Descrição</label>
                <textarea value={formEvento.descricao} onChange={e => setFormEvento(f => ({ ...f, descricao: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Detalhes do evento..." />
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleSaveEvento} disabled={salvando}
                  className="px-5 py-2 rounded-lg bg-[#123b63] text-white text-sm hover:bg-[#0e2d4f] disabled:opacity-50">
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
              <p className="text-gray-500">Nenhum evento encontrado para o período selecionado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {eventos.map(e => (
                <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap gap-2 items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusEventoCor(e.status)}`}>
                          {statusEventoLabel(e.status)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {tipoLabel(e.tipo)}
                        </span>
                        {e.valor_inscricao > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                            {fmtBRL(e.valor_inscricao)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-[#123b63] text-base leading-tight">{e.titulo}</h3>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {fmtDateTime(e.data_inicio)}
                          {e.data_fim && ` → ${fmtDate(e.data_fim)}`}
                        </span>
                        {e.local_nome && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {e.local_nome}
                          </span>
                        )}
                        {e.congregacao_nome && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {e.congregacao_nome}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {e.is_publico && e.slug && (
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/eventos/e/${e.slug}`;
                            navigator.clipboard.writeText(url).then(() =>
                              showModal('Link copiado!', url, 'success')
                            ).catch(() => showModal('Link público', url, 'info'));
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
                          title="Copiar link público"
                        >
                          <Copy className="w-3 h-3" />
                          Link público
                        </button>
                      )}
                      {e.aceita_inscricao && (
                        <button
                          onClick={() => { setEventoSelecionado(e); setAba('inscricoes'); }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-[#123b63] text-[#123b63] hover:bg-[#123b63]/5"
                        >
                          Ver inscrições
                        </button>
                      )}
                      {scope.canWrite && (
                        <button onClick={() => handleEditEvento(e)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {scope.canDelete && (
                        <button onClick={() => handleDeleteEvento(e.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ABA: INSCRIÇÕES
      ═══════════════════════════════════════════════════════════════════ */}
      {aba === 'inscricoes' && (
        <div className="space-y-6">

          {/* Seletor de evento */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <label className="text-xs text-gray-500 block mb-1">Selecionar evento</label>
            <select
              value={eventoSelecionado?.id ?? ''}
              onChange={e => {
                const ev = eventos.find(x => x.id === e.target.value) ?? null;
                setEventoSelecionado(ev);
                setInscricoes([]);
                setShowFormInsc(false);
                setBuscaInsc('');
                setFiltroStatusInsc('');
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— selecione um evento —</option>
              {eventos.map(e => (
                <option key={e.id} value={e.id}>
                  {fmtDate(e.data_inicio)} | {e.titulo} ({statusEventoLabel(e.status)})
                </option>
              ))}
            </select>
            {eventos.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Nenhum evento disponível para o mês atual. Ajuste o filtro de mês na aba Eventos.
              </p>
            )}
          </div>

          {eventoSelecionado && (
            <>
              {/* Header do evento */}
              <div className="bg-[#123b63]/5 rounded-xl border border-[#123b63]/20 p-5">
                <div className="flex flex-wrap gap-3 items-start justify-between">
                  <div>
                    <h2 className="font-bold text-[#123b63] text-lg">{eventoSelecionado.titulo}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {fmtDateTime(eventoSelecionado.data_inicio)}
                      {eventoSelecionado.local_nome && ` · ${eventoSelecionado.local_nome}`}
                    </p>
                    {eventoSelecionado.is_publico && eventoSelecionado.slug && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/eventos/e/${eventoSelecionado.slug}`;
                          navigator.clipboard.writeText(url)
                            .then(() => showModal('Link copiado!', url, 'success'))
                            .catch(() => showModal('Link público', url, 'info'));
                        }}
                        className="mt-2 text-xs flex items-center gap-1 text-emerald-700 hover:underline"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar link público
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-white rounded-lg border border-gray-200 px-4 py-2">
                      <p className="text-2xl font-bold text-[#123b63]">{insPorStatus.confirmados}</p>
                      <p className="text-xs text-gray-500">Confirmados</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 px-4 py-2">
                      <p className="text-2xl font-bold text-green-600">{insPorStatus.presentes}</p>
                      <p className="text-xs text-gray-500">Presentes</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 px-4 py-2">
                      <p className="text-2xl font-bold text-amber-600">{insPorStatus.listaEspera}</p>
                      <p className="text-xs text-gray-500">Lista de espera</p>
                    </div>
                    {eventoSelecionado.capacidade && (
                      <div className="bg-white rounded-lg border border-gray-200 px-4 py-2">
                        <p className="text-2xl font-bold text-gray-600">{eventoSelecionado.capacidade}</p>
                        <p className="text-xs text-gray-500">Vagas totais</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    value={buscaInsc}
                    onChange={e => setBuscaInsc(e.target.value)}
                    placeholder="Buscar participante..."
                    className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <select
                  value={filtroStatusInsc}
                  onChange={e => setFiltroStatusInsc(e.target.value as '' | StatusInscricao)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todos os status</option>
                  {STATUS_INSCRICAO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {scope.canWrite && (
                  <button
                    onClick={() => setShowFormInsc(v => !v)}
                    className="flex items-center gap-2 bg-[#123b63] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#0e2d4f]"
                  >
                    <Plus className="w-4 h-4" /> Inscrever
                  </button>
                )}
                <button
                  onClick={() => exportarCSVInscricoes(inscricoes, eventoSelecionado.titulo)}
                  className="flex items-center gap-2 border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" /> CSV
                </button>
              </div>

              {/* Formulário inscrição */}
              {showFormInsc && scope.canWrite && (
                <div className="bg-white rounded-xl border border-[#123b63]/30 p-6 shadow-md space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-[#123b63]">Nova Inscrição</h3>
                    <button onClick={() => setShowFormInsc(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>

                  {/* Busca de membro */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Buscar membro cadastrado</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        value={buscaMembro}
                        onChange={e => { setBuscaMembro(e.target.value); setMembroSelecionado(null); }}
                        placeholder="Digite 3+ letras do nome..."
                        className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    {resultadosMembro.length > 0 && !membroSelecionado && (
                      <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto">
                        {resultadosMembro.map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setMembroSelecionado(m);
                              setBuscaMembro(m.nome_completo);
                              setResultadosMembro([]);
                              setFormInsc(f => ({ ...f, nome_externo: '' }));
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          >
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
                        disabled={!!membroSelecionado}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:opacity-50" />
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

                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Observações</label>
                    <textarea value={formInsc.observacoes} onChange={e => setFormInsc(f => ({ ...f, observacoes: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowFormInsc(false)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button onClick={handleSaveInscricao}
                      className="px-5 py-2 rounded-lg bg-[#123b63] text-white text-sm hover:bg-[#0e2d4f]">
                      Confirmar inscrição
                    </button>
                  </div>
                </div>
              )}

              {/* Tabela de inscrições */}
              {loadingInsc ? (
                <p className="text-sm text-gray-400 text-center py-8">Buscando inscrições...</p>
              ) : inscricoesFiltradas.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Nenhuma inscrição encontrada.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Nome</th>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Contato</th>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Presença</th>
                        <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Check-in</th>
                        {scope.canWrite && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inscricoesFiltradas.map(i => (
                        <tr key={i.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-[#123b63]">{i.nome_display}</td>
                          <td className="px-4 py-3 text-gray-500">
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
                            {scope.canWrite ? (
                              <button
                                onClick={() => handleCheckin(i)}
                                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium transition-colors
                                  ${i.presente
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                              >
                                <CheckCircle className="w-3 h-3" />
                                {i.presente ? 'Presente' : 'Ausente'}
                              </button>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${i.presente ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {i.presente ? 'Presente' : 'Ausente'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {i.checkin_em ? fmtDateTime(i.checkin_em) : '—'}
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
                    <span className="text-green-600 font-medium">{insPorStatus.presentes} presentes</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </PageLayout>
  );
}
