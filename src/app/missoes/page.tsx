'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import type { ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { Pencil, Trash2, Printer } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Projeto {
  id: string;
  ministry_id: string;
  nome: string;
  descricao?: string | null;
  pais_regiao?: string | null;
  status: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  meta_arrecadacao?: number | null;
  created_at?: string | null;
}

interface Missionario {
  id: string;
  ministry_id: string;
  nome: string;
  foto_url?: string | null;
  campo_atuacao?: string | null;
  tipo: string;
  data_envio?: string | null;
  contato?: string | null;
  status: string;
  member_id?: string | null;
  valor_sustento_mensal?: number | null;
  created_at?: string | null;
}

interface Evento {
  id: string;
  ministry_id: string;
  titulo: string;
  tipo: string;
  data_evento: string;
  local?: string | null;
  projeto_id?: string | null;
  descricao?: string | null;
  created_at?: string | null;
}

interface Arrecadacao {
  id: string;
  ministry_id: string;
  projeto_id?: string | null;
  data: string;
  valor: number;
  forma: string;
  descricao?: string | null;
  congregacao_id?: string | null;
  tesouraria_lancamento_id?: string | null;
  created_at?: string | null;
}

interface CongregacaoOption { id: string; nome: string; }
interface MemberOption { id: string; nome: string; }

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_PROJETO = [
  { value: 'planejado',    label: 'Planejado',    color: 'bg-gray-100 text-gray-600' },
  { value: 'em_andamento', label: 'Em andamento', color: 'bg-blue-100 text-blue-700' },
  { value: 'concluido',    label: 'Concluído',    color: 'bg-emerald-100 text-emerald-700' },
  { value: 'suspenso',     label: 'Suspenso',     color: 'bg-orange-100 text-orange-700' },
];

const TIPO_MISSIONARIO = [
  { value: 'sustentado', label: 'Sustentado' },
  { value: 'voluntario', label: 'Voluntário' },
  { value: 'enviado',    label: 'Enviado' },
];

const STATUS_MISSIONARIO = [
  { value: 'ativo',     label: 'Ativo',     color: 'bg-emerald-100 text-emerald-700' },
  { value: 'afastado',  label: 'Afastado',  color: 'bg-yellow-100 text-yellow-700' },
  { value: 'retornou',  label: 'Retornou',  color: 'bg-gray-100 text-gray-600' },
];

const TIPO_EVENTO = [
  { value: 'culto_missionario', label: 'Culto Missionário' },
  { value: 'conferencia',       label: 'Conferência' },
  { value: 'retiro',            label: 'Retiro' },
  { value: 'campanha',          label: 'Campanha' },
  { value: 'outro',             label: 'Outro' },
];

const FORMA_ARRECADACAO = [
  { value: 'oferta',             label: 'Oferta' },
  { value: 'dizimo_especifico',  label: 'Dízimo específico' },
  { value: 'doacao',             label: 'Doação' },
  { value: 'campanha',           label: 'Campanha' },
  { value: 'outro',              label: 'Outro' },
];

const TABS = [
  { id: 'projetos',      label: 'Projetos Missionários', icon: '🌍' },
  { id: 'missionarios',  label: 'Missionários',          icon: '✈️' },
  { id: 'eventos',       label: 'Eventos',               icon: '📅' },
  { id: 'arrecadacoes',  label: 'Arrecadações',          icon: '💰' },
  { id: 'relatorio',     label: 'Relatório',             icon: '🖨️' },
];

const EMPTY_PROJETO = { nome: '', descricao: '', pais_regiao: '', status: 'planejado', data_inicio: '', data_fim: '', meta_arrecadacao: '' };
const EMPTY_MISSIONARIO = { nome: '', campo_atuacao: '', tipo: 'sustentado', data_envio: '', contato: '', status: 'ativo', member_id: '', valor_sustento_mensal: '' };
const EMPTY_EVENTO = { titulo: '', tipo: 'culto_missionario', data_evento: '', local: '', projeto_id: '', descricao: '' };
const FORMA_PAGAMENTO = [
  { value: 'dinheiro',      label: 'Dinheiro'      },
  { value: 'pix',           label: 'PIX'           },
  { value: 'cartao',        label: 'Cartão'        },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cheque',        label: 'Cheque'        },
];

const EMPTY_ARRECADACAO = { projeto_id: '', data: new Date().toISOString().slice(0, 10), valor: '', forma: 'oferta', forma_pagamento: 'dinheiro', descricao: '', congregacao_id: '' };

// ─── Utilitários ──────────────────────────────────────────────────────────────

const fmtCurrency = (v?: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';

const fmtDate = (v?: string | null) => {
  if (!v) return '-';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

// Todas as arrecadações de Missões aparecem como tipo 'missoes' na Tesouraria
const formaParaTipoTesouraria = (_forma: string): string => 'missoes';

// Máscara de moeda BR: digitando apenas dígitos, formata como 1.250,00
const maskCurrency = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseCurrency = (masked: string): number =>
  parseFloat(masked.replace(/\./g, '').replace(',', '.')) || 0;

// Máscara de telefone: (xx) xxxxx-xxxx ou (xx) xxxx-xxxx
const maskPhone = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
};

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63] focus:border-transparent';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';
const errCls = 'text-xs text-red-600 mt-1';

// ─── Componentes de formulário inline ─────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className={errCls}>{error}</p>}
    </div>
  );
}

function StatusBadge({ value, options }: { value: string; options: { value: string; label: string; color: string }[] }) {
  const opt = options.find((o) => o.value === value);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${opt?.color ?? 'bg-gray-100 text-gray-500'}`}>{opt?.label ?? value}</span>;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{fmtCurrency(value)} arrecadado</span>
        <span>{pct}% de {fmtCurrency(max)}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-[#123b63]'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MissoesPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState('projetos');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Dados
  const [projetos,      setProjetos]      = useState<Projeto[]>([]);
  const [missionarios,  setMissionarios]  = useState<Missionario[]>([]);
  const [eventos,       setEventos]       = useState<Evento[]>([]);
  const [arrecadacoes,  setArrecadacoes]  = useState<Arrecadacao[]>([]);
  const [congregacoes,  setCongregacoes]  = useState<CongregacaoOption[]>([]);
  const [members,       setMembers]       = useState<MemberOption[]>([]);
  const [configIgreja,  setConfigIgreja]  = useState<ConfiguracaoIgreja | null>(null);

  // Filtros do relatório
  const [relDtInicio,  setRelDtInicio]  = useState('');
  const [relDtFim,     setRelDtFim]     = useState('');
  const [relProjetoId, setRelProjetoId] = useState('');
  const [relCongId,    setRelCongId]    = useState('');

  // Notificação
  const [notification, setNotification] = useState<{
    isOpen: boolean; title: string; message: string;
    type: 'success' | 'error' | 'warning' | 'info'; autoClose: number | undefined;
  }>({ isOpen: false, title: '', message: '', type: 'success', autoClose: 3000 });

  const showNotif = (type: typeof notification.type, title: string, message: string, autoClose: number | undefined = 3000) =>
    setNotification({ isOpen: true, title, message, type, autoClose });

  // Formulários
  const [formProjeto,      setFormProjeto]      = useState<typeof EMPTY_PROJETO>({ ...EMPTY_PROJETO });
  const [formMissionario,  setFormMissionario]  = useState<typeof EMPTY_MISSIONARIO>({ ...EMPTY_MISSIONARIO });
  const [formEvento,       setFormEvento]       = useState<typeof EMPTY_EVENTO>({ ...EMPTY_EVENTO });
  const [formArrecadacao,  setFormArrecadacao]  = useState<typeof EMPTY_ARRECADACAO>({ ...EMPTY_ARRECADACAO });

  const [editProjetoId,     setEditProjetoId]     = useState<string | null>(null);
  const [editMissionarioId, setEditMissionarioId] = useState<string | null>(null);
  const [editEventoId,      setEditEventoId]      = useState<string | null>(null);
  const [editArrecadacaoId, setEditArrecadacaoId] = useState<string | null>(null);

  const [errProjeto,      setErrProjeto]      = useState<Record<string, string>>({});
  const [errMissionario,  setErrMissionario]  = useState<Record<string, string>>({});
  const [errEvento,       setErrEvento]       = useState<Record<string, string>>({});
  const [errArrecadacao,  setErrArrecadacao]  = useState<Record<string, string>>({});

  // ── Carregamento inicial ──────────────────────────────────────────────────

  useEffect(() => {
    if (loading) return;
    const init = async () => {
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      if (!mid) { setLoadingData(false); return; }
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      await Promise.all([
        loadProjetos(mid),
        loadMissionarios(mid),
        loadEventos(mid),
        loadArrecadacoes(mid),
        loadCongregacoes(mid),
        loadMembers(mid),
      ]);
      setLoadingData(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const loadProjetos = async (mid: string) => {
    const { data, error } = await supabase.from('missoes_projetos').select('*').eq('ministry_id', mid).order('created_at', { ascending: false });
    if (!error) setProjetos((data || []) as Projeto[]);
  };
  const loadMissionarios = async (mid: string) => {
    const { data, error } = await supabase.from('missoes_missionarios').select('*').eq('ministry_id', mid).order('nome');
    if (!error) setMissionarios((data || []) as Missionario[]);
  };
  const loadEventos = async (mid: string) => {
    const { data, error } = await supabase.from('missoes_eventos').select('*').eq('ministry_id', mid).order('data_evento', { ascending: false });
    if (!error) setEventos((data || []) as Evento[]);
  };
  const loadArrecadacoes = async (mid: string) => {
    const { data, error } = await supabase.from('missoes_arrecadacoes').select('*').eq('ministry_id', mid).order('data', { ascending: false });
    if (!error) setArrecadacoes((data || []) as Arrecadacao[]);
  };
  const loadCongregacoes = async (mid: string) => {
    const { data } = await supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome');
    setCongregacoes((data || []) as CongregacaoOption[]);
  };
  const loadMembers = async (mid: string) => {
    const { data } = await supabase.from('members').select('id, nome').eq('ministry_id', mid).eq('status', 'ativo').order('nome');
    setMembers((data || []) as MemberOption[]);
  };

  // ── Cards de resumo ───────────────────────────────────────────────────────

  const anoAtual = new Date().getFullYear();
  const [anoFiltro, setAnoFiltro] = useState(anoAtual);

  // Anos disponíveis com base nas arrecadações registradas + ano atual
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>([anoAtual]);
    arrecadacoes.forEach((a) => { if (a.data) anos.add(new Date(a.data).getFullYear()); });
    return Array.from(anos).sort((a, b) => b - a);
  }, [arrecadacoes, anoAtual]);

  const arrecadacoesDoAno = useMemo(
    () => arrecadacoes.filter((a) => a.data && new Date(a.data).getFullYear() === anoFiltro),
    [arrecadacoes, anoFiltro]
  );

  const projetosEmAndamento = useMemo(() => projetos.filter((p) => p.status === 'em_andamento').length, [projetos]);
  const missionariosAtivos  = useMemo(() => missionarios.filter((m) => m.status === 'ativo').length, [missionarios]);
  const totalArrecadado     = useMemo(() => arrecadacoesDoAno.reduce((acc, a) => acc + (a.valor || 0), 0), [arrecadacoesDoAno]);
  const metaTotalAtivos     = useMemo(
    () => projetos.filter((p) => p.status === 'em_andamento').reduce((acc, p) => acc + (p.meta_arrecadacao || 0), 0),
    [projetos]
  );

  // ── Relatório filtrado ────────────────────────────────────────────────────

  const relFiltrado = useMemo(() => arrecadacoes.filter((a) => {
    if (relDtInicio && a.data < relDtInicio) return false;
    if (relDtFim    && a.data > relDtFim)    return false;
    if (relProjetoId && a.projeto_id !== relProjetoId) return false;
    if (relCongId    && a.congregacao_id !== relCongId) return false;
    return true;
  }), [arrecadacoes, relDtInicio, relDtFim, relProjetoId, relCongId]);

  const relTotal = useMemo(() => relFiltrado.reduce((s, a) => s + a.valor, 0), [relFiltrado]);

  const relPorForma = useMemo(() => {
    const m: Record<string, number> = {};
    relFiltrado.forEach((a) => { m[a.forma] = (m[a.forma] || 0) + a.valor; });
    return m;
  }, [relFiltrado]);

  const relPorProjeto = useMemo(() => {
    const m: Record<string, number> = {};
    relFiltrado.forEach((a) => {
      const k = a.projeto_id || '__geral__';
      m[k] = (m[k] || 0) + a.valor;
    });
    return m;
  }, [relFiltrado]);

  // ── Totais por projeto para aba Arrecadações ──────────────────────────────

  const totaisPorProjeto = useMemo(() => {
    const map: Record<string, number> = {};
    arrecadacoes.forEach((a) => {
      if (a.projeto_id) map[a.projeto_id] = (map[a.projeto_id] || 0) + a.valor;
    });
    return map;
  }, [arrecadacoes]);

  // ── Handlers: Projetos ────────────────────────────────────────────────────

  const validateProjeto = () => {
    const e: Record<string, string> = {};
    if (!formProjeto.nome.trim()) e.nome = 'Informe o nome do projeto.';
    setErrProjeto(e);
    return Object.keys(e).length === 0;
  };

  const saveProjeto = async () => {
    if (!validateProjeto() || !ministryId) return;
    const payload: Record<string, unknown> = {
      ministry_id: ministryId,
      nome: formProjeto.nome.trim(),
      descricao: formProjeto.descricao.trim() || null,
      pais_regiao: formProjeto.pais_regiao.trim() || null,
      status: formProjeto.status,
      data_inicio: formProjeto.data_inicio || null,
      data_fim: formProjeto.data_fim || null,
      meta_arrecadacao: formProjeto.meta_arrecadacao ? parseCurrency(formProjeto.meta_arrecadacao) : null,
    };
    if (editProjetoId) {
      const { error } = await supabase.from('missoes_projetos').update(payload).eq('id', editProjetoId);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
      showNotif('success', 'Atualizado', 'Projeto atualizado com sucesso.');
    } else {
      const { error } = await supabase.from('missoes_projetos').insert(payload);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
      showNotif('success', 'Cadastrado', 'Projeto registrado com sucesso.');
    }
    setFormProjeto({ ...EMPTY_PROJETO });
    setEditProjetoId(null);
    await loadProjetos(ministryId);
  };

  const editProjeto = (p: Projeto) => {
    setFormProjeto({
      nome: p.nome, descricao: p.descricao || '', pais_regiao: p.pais_regiao || '',
      status: p.status, data_inicio: p.data_inicio?.slice(0, 10) || '',
      data_fim: p.data_fim?.slice(0, 10) || '',
      meta_arrecadacao: p.meta_arrecadacao != null ? maskCurrency(String(Math.round(p.meta_arrecadacao * 100))) : '',
    });
    setEditProjetoId(p.id);
    setErrProjeto({});
  };

  const deleteProjeto = async (id: string) => {
    if (!ministryId) return;
    const { error } = await supabase.from('missoes_projetos').delete().eq('id', id);
    if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
    showNotif('success', 'Excluído', 'Projeto removido.');
    await loadProjetos(ministryId);
  };

  // ── Handlers: Missionários ────────────────────────────────────────────────

  const validateMissionario = () => {
    const e: Record<string, string> = {};
    if (!formMissionario.nome.trim()) e.nome = 'Informe o nome do missionário.';
    setErrMissionario(e);
    return Object.keys(e).length === 0;
  };

  const saveMissionario = async () => {
    if (!validateMissionario() || !ministryId) return;
    const payload: Record<string, unknown> = {
      ministry_id: ministryId,
      nome: formMissionario.nome.trim(),
      campo_atuacao: formMissionario.campo_atuacao.trim() || null,
      tipo: formMissionario.tipo,
      data_envio: formMissionario.data_envio || null,
      contato: formMissionario.contato.trim() || null,
      status: formMissionario.status,
      member_id: formMissionario.member_id || null,
      valor_sustento_mensal: formMissionario.valor_sustento_mensal ? parseCurrency(formMissionario.valor_sustento_mensal) : null,
    };
    if (editMissionarioId) {
      const { error } = await supabase.from('missoes_missionarios').update(payload).eq('id', editMissionarioId);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
      showNotif('success', 'Atualizado', 'Missionário atualizado.');
    } else {
      const { error } = await supabase.from('missoes_missionarios').insert(payload);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
      showNotif('success', 'Cadastrado', 'Missionário registrado.');
    }
    setFormMissionario({ ...EMPTY_MISSIONARIO });
    setEditMissionarioId(null);
    await loadMissionarios(ministryId);
  };

  const editMissionario = (m: Missionario) => {
    setFormMissionario({
      nome: m.nome, campo_atuacao: m.campo_atuacao || '', tipo: m.tipo,
      data_envio: m.data_envio?.slice(0, 10) || '', contato: m.contato ? maskPhone(m.contato) : '',
      status: m.status, member_id: m.member_id || '',
      valor_sustento_mensal: m.valor_sustento_mensal != null ? maskCurrency(String(Math.round(m.valor_sustento_mensal * 100))) : '',
    });
    setEditMissionarioId(m.id);
    setErrMissionario({});
  };

  const deleteMissionario = async (id: string) => {
    if (!ministryId) return;
    const { error } = await supabase.from('missoes_missionarios').delete().eq('id', id);
    if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
    showNotif('success', 'Excluído', 'Missionário removido.');
    await loadMissionarios(ministryId);
  };

  // ── Handlers: Eventos ─────────────────────────────────────────────────────

  const validateEvento = () => {
    const e: Record<string, string> = {};
    if (!formEvento.titulo.trim()) e.titulo = 'Informe o título do evento.';
    if (!formEvento.data_evento) e.data_evento = 'Informe a data.';
    setErrEvento(e);
    return Object.keys(e).length === 0;
  };

  const saveEvento = async () => {
    if (!validateEvento() || !ministryId) return;
    const payload: Record<string, unknown> = {
      ministry_id: ministryId,
      titulo: formEvento.titulo.trim(),
      tipo: formEvento.tipo,
      data_evento: formEvento.data_evento,
      local: formEvento.local.trim() || null,
      projeto_id: formEvento.projeto_id || null,
      descricao: formEvento.descricao.trim() || null,
    };
    if (editEventoId) {
      const { error } = await supabase.from('missoes_eventos').update(payload).eq('id', editEventoId);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
      showNotif('success', 'Atualizado', 'Evento atualizado.');
    } else {
      const { error } = await supabase.from('missoes_eventos').insert(payload);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
      showNotif('success', 'Cadastrado', 'Evento registrado.');
    }
    setFormEvento({ ...EMPTY_EVENTO });
    setEditEventoId(null);
    await loadEventos(ministryId);
  };

  const editEvento = (e: Evento) => {
    setFormEvento({
      titulo: e.titulo, tipo: e.tipo, data_evento: e.data_evento?.slice(0, 10) || '',
      local: e.local || '', projeto_id: e.projeto_id || '', descricao: e.descricao || '',
    });
    setEditEventoId(e.id);
    setErrEvento({});
  };

  const deleteEvento = async (id: string) => {
    if (!ministryId) return;
    const { error } = await supabase.from('missoes_eventos').delete().eq('id', id);
    if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
    showNotif('success', 'Excluído', 'Evento removido.');
    await loadEventos(ministryId);
  };

  // ── Handlers: Arrecadações ────────────────────────────────────────────────

  const validateArrecadacao = () => {
    const e: Record<string, string> = {};
    if (!formArrecadacao.data) e.data = 'Informe a data.';
    if (!formArrecadacao.valor || parseCurrency(formArrecadacao.valor) <= 0) e.valor = 'Informe um valor válido.';
    setErrArrecadacao(e);
    return Object.keys(e).length === 0;
  };

  const saveArrecadacao = async () => {
    if (!validateArrecadacao() || !ministryId) return;

    const projetoNome = projetos.find(p => p.id === formArrecadacao.projeto_id)?.nome;
    const descricaoTes = ['Missões', projetoNome, formArrecadacao.descricao.trim() || null]
      .filter(Boolean).join(' — ');
    const now = new Date().toISOString();
    const tesPayload = {
      ministry_id:      ministryId,
      congregacao_id:   formArrecadacao.congregacao_id || null,
      departamento_id:  null,
      tipo_recebimento: formaParaTipoTesouraria(formArrecadacao.forma),
      descricao:        descricaoTes,
      referencia:       projetoNome ?? null,
      valor:         Number(formArrecadacao.valor) > 0 ? parseCurrency(formArrecadacao.valor) : Number(formArrecadacao.valor),
      forma_pagamento:  formArrecadacao.forma_pagamento || 'dinheiro',
      data_lancamento:  formArrecadacao.data,
      observacoes:      'Lançamento automático — Módulo Missões',
      updated_at:       now,
    };

    const payload: Record<string, unknown> = {
      ministry_id:   ministryId,
      projeto_id:    formArrecadacao.projeto_id || null,
      data:          formArrecadacao.data,
      valor:         parseCurrency(formArrecadacao.valor),
      forma:         formArrecadacao.forma,
      descricao:     formArrecadacao.descricao.trim() || null,
      congregacao_id: formArrecadacao.congregacao_id || null,
    };

    if (editArrecadacaoId) {
      // Busca o vínculo existente com a Tesouraria
      const { data: existing } = await supabase
        .from('missoes_arrecadacoes')
        .select('tesouraria_lancamento_id')
        .eq('id', editArrecadacaoId)
        .single();

      const { error } = await supabase.from('missoes_arrecadacoes').update(payload).eq('id', editArrecadacaoId);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }

      // Sincroniza lançamento na Tesouraria
      if (existing?.tesouraria_lancamento_id) {
        await supabase.from('tesouraria_lancamentos').update(tesPayload).eq('id', existing.tesouraria_lancamento_id);
      } else {
        const { data: newLanc } = await supabase
          .from('tesouraria_lancamentos')
          .insert({ ...tesPayload, created_at: now })
          .select('id')
          .single();
        if (newLanc?.id) {
          await supabase.from('missoes_arrecadacoes').update({ tesouraria_lancamento_id: newLanc.id }).eq('id', editArrecadacaoId);
        }
      }
      showNotif('success', 'Atualizado', 'Registro e lançamento da Tesouraria atualizados.');
    } else {
      // Insere a arrecadação e recupera o id
      const { data: newArr, error } = await supabase
        .from('missoes_arrecadacoes')
        .insert(payload)
        .select('id')
        .single();
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }

      // Gera lançamento automático na Tesouraria
      if (newArr?.id) {
        const { data: newLanc, error: errLanc } = await supabase
          .from('tesouraria_lancamentos')
          .insert({ ...tesPayload, created_at: now })
          .select('id')
          .single();
        if (errLanc) {
          showNotif('warning', 'Arrecadação salva', `Registrado em Missões, mas não foi possível criar o lançamento na Tesouraria: ${errLanc.message}`, undefined);
        } else if (newLanc?.id) {
          await supabase.from('missoes_arrecadacoes').update({ tesouraria_lancamento_id: newLanc.id }).eq('id', newArr.id);
          showNotif('success', 'Registrado', 'Arrecadação registrada e lançamento gerado na Tesouraria.');
        }
      } else {
        showNotif('success', 'Registrado', 'Arrecadação registrada.');  
      }
    }
    setFormArrecadacao({ ...EMPTY_ARRECADACAO, data: new Date().toISOString().slice(0, 10) });
    setEditArrecadacaoId(null);
    await loadArrecadacoes(ministryId);
  };

  const editArrecadacao = (a: Arrecadacao) => {
    setFormArrecadacao({
      projeto_id: a.projeto_id || '', data: a.data?.slice(0, 10) || '',
      valor: maskCurrency(String(Math.round(a.valor * 100))), forma: a.forma, forma_pagamento: 'dinheiro', descricao: a.descricao || '',
      congregacao_id: a.congregacao_id || '',
    });
    setEditArrecadacaoId(a.id);
    setErrArrecadacao({});
  };

  const deleteArrecadacao = async (id: string) => {
    if (!ministryId) return;
    // Busca o vínculo com a Tesouraria antes de deletar
    const { data: rec } = await supabase
      .from('missoes_arrecadacoes')
      .select('tesouraria_lancamento_id')
      .eq('id', id)
      .single();
    const { error } = await supabase.from('missoes_arrecadacoes').delete().eq('id', id);
    if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
    // Remove o lançamento vinculado da Tesouraria
    if (rec?.tesouraria_lancamento_id) {
      await supabase.from('tesouraria_lancamentos').delete().eq('id', rec.tesouraria_lancamento_id);
    }
    showNotif('success', 'Excluído', 'Registro e lançamento da Tesouraria removidos.');
    await loadArrecadacoes(ministryId);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading || loadingData) return <div className="p-8 text-gray-500">Carregando...</div>;

  return (
    <PageLayout title="Missões" description="Gestão de atividades missionárias" activeMenu="missoes">
      <NotificationModal
        isOpen={notification.isOpen} title={notification.title} message={notification.message}
        type={notification.type} onClose={() => setNotification((p) => ({ ...p, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      {/* ── Cards de resumo ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 font-medium">Exercício</span>
        <select
          value={anoFiltro}
          onChange={(e) => setAnoFiltro(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#123b63] bg-white shadow-sm"
        >
          {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-4">
          <p className="text-xs text-gray-500">Projetos em andamento</p>
          <p className="text-2xl font-bold text-[#123b63] mt-1">{projetosEmAndamento}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-500 p-4">
          <p className="text-xs text-gray-500">Missionários ativos</p>
          <p className="text-2xl font-bold text-[#123b63] mt-1">{missionariosAtivos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-yellow-500 p-4">
          <p className="text-xs text-gray-500">Total arrecadado <span className="text-gray-300">· {anoFiltro}</span></p>
          <p className="text-xl font-bold text-[#123b63] mt-1">{fmtCurrency(totalArrecadado)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 p-4">
          <p className="text-xs text-gray-500">Meta projetos ativos</p>
          <p className="text-xl font-bold text-[#123b63] mt-1">{metaTotalAtivos > 0 ? fmtCurrency(metaTotalAtivos) : '—'}</p>
        </div>
      </div>

      {/* ── Abas ────────────────────────────────────────────────────────── */}
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id)}>

        {/* ═══════════════════ ABA: PROJETOS ═══════════════════════════ */}
        {activeTab === 'projetos' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Formulário */}
            <Section icon="📝" title={editProjetoId ? 'Editar Projeto' : 'Novo Projeto'}>
              <div className="space-y-3">
                <Field label="Nome do projeto *" error={errProjeto.nome}>
                  <input className={inputCls} value={formProjeto.nome} onChange={(e) => setFormProjeto((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex: Missão Amazônia" />
                </Field>
                <Field label="País / Região">
                  <input className={inputCls} value={formProjeto.pais_regiao} onChange={(e) => setFormProjeto((p) => ({ ...p, pais_regiao: e.target.value }))} placeholder="Ex: Brasil - AM" />
                </Field>
                <Field label="Status">
                  <select className={inputCls} value={formProjeto.status} onChange={(e) => setFormProjeto((p) => ({ ...p, status: e.target.value }))}>
                    {STATUS_PROJETO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data início">
                    <input className={inputCls} type="date" value={formProjeto.data_inicio} onChange={(e) => setFormProjeto((p) => ({ ...p, data_inicio: e.target.value }))} />
                  </Field>
                  <Field label="Data fim">
                    <input className={inputCls} type="date" value={formProjeto.data_fim} onChange={(e) => setFormProjeto((p) => ({ ...p, data_fim: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Meta de Investimento (R$)">
                  <input className={inputCls} inputMode="numeric" value={formProjeto.meta_arrecadacao} onChange={(e) => setFormProjeto((p) => ({ ...p, meta_arrecadacao: maskCurrency(e.target.value) }))} placeholder="0,00" />
                </Field>
                <Field label="Descrição">
                  <textarea className={inputCls} rows={3} value={formProjeto.descricao} onChange={(e) => setFormProjeto((p) => ({ ...p, descricao: e.target.value }))} placeholder="Descrição do projeto..." />
                </Field>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveProjeto} className="flex-1 bg-[#123b63] text-white py-2 rounded-md text-sm font-semibold hover:bg-[#0f2a45] transition">
                    {editProjetoId ? 'Salvar alterações' : 'Cadastrar projeto'}
                  </button>
                  {editProjetoId && (
                    <button onClick={() => { setFormProjeto({ ...EMPTY_PROJETO }); setEditProjetoId(null); setErrProjeto({}); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </Section>

            {/* Lista */}
            <div className="lg:col-span-2 space-y-4">
              {projetos.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">Nenhum projeto cadastrado</div>
              ) : (
                projetos.map((p) => {
                  const arrecadado = totaisPorProjeto[p.id] || 0;
                  return (
                    <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-[#123b63] text-sm">{p.nome}</h3>
                            <StatusBadge value={p.status} options={STATUS_PROJETO} />
                          </div>
                          {p.pais_regiao && <p className="text-xs text-gray-500 mt-0.5">📍 {p.pais_regiao}</p>}
                          {p.descricao && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{p.descricao}</p>}
                          {p.data_inicio && <p className="text-xs text-gray-400 mt-1">📅 {fmtDate(p.data_inicio)}{p.data_fim ? ` → ${fmtDate(p.data_fim)}` : ''}</p>}
                          {(p.meta_arrecadacao ?? 0) > 0 && <ProgressBar value={arrecadado} max={p.meta_arrecadacao!} />}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => editProjeto(p)} className="p-1.5 text-gray-400 hover:text-[#123b63] transition"><Pencil size={14} /></button>
                          <button onClick={() => deleteProjeto(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ ABA: MISSIONÁRIOS ═══════════════════════ */}
        {activeTab === 'missionarios' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Formulário */}
            <Section icon="✈️" title={editMissionarioId ? 'Editar Missionário' : 'Novo Missionário'}>
              <div className="space-y-3">
                <Field label="Nome *" error={errMissionario.nome}>
                  <input className={inputCls} value={formMissionario.nome} onChange={(e) => setFormMissionario((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" />
                </Field>
                <Field label="Campo de atuação">
                  <input className={inputCls} value={formMissionario.campo_atuacao} onChange={(e) => setFormMissionario((p) => ({ ...p, campo_atuacao: e.target.value }))} placeholder="País / Cidade" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo">
                    <select className={inputCls} value={formMissionario.tipo} onChange={(e) => setFormMissionario((p) => ({ ...p, tipo: e.target.value }))}>
                      {TIPO_MISSIONARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className={inputCls} value={formMissionario.status} onChange={(e) => setFormMissionario((p) => ({ ...p, status: e.target.value }))}>
                      {STATUS_MISSIONARIO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Data de envio">
                  <input className={inputCls} type="date" value={formMissionario.data_envio} onChange={(e) => setFormMissionario((p) => ({ ...p, data_envio: e.target.value }))} />
                </Field>
                <Field label="Contato (tel / e-mail)">
                  <input className={inputCls} value={formMissionario.contato} onChange={(e) => setFormMissionario((p) => ({ ...p, contato: maskPhone(e.target.value) }))} placeholder="(85) 99999-9999" />
                </Field>
                <Field label="Valor de sustento mensal (R$)">
                  <input className={inputCls} inputMode="numeric" value={formMissionario.valor_sustento_mensal} onChange={(e) => setFormMissionario((p) => ({ ...p, valor_sustento_mensal: maskCurrency(e.target.value) }))} placeholder="0,00" />
                </Field>
                {members.length > 0 && (
                  <Field label="Vínculo com membro (opcional)">
                    <select className={inputCls} value={formMissionario.member_id} onChange={(e) => setFormMissionario((p) => ({ ...p, member_id: e.target.value }))}>
                      <option value="">— Sem vínculo —</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </Field>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveMissionario} className="flex-1 bg-[#123b63] text-white py-2 rounded-md text-sm font-semibold hover:bg-[#0f2a45] transition">
                    {editMissionarioId ? 'Salvar alterações' : 'Cadastrar missionário'}
                  </button>
                  {editMissionarioId && (
                    <button onClick={() => { setFormMissionario({ ...EMPTY_MISSIONARIO }); setEditMissionarioId(null); setErrMissionario({}); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </Section>

            {/* Lista */}
            <div className="lg:col-span-2">
              {missionarios.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">Nenhum missionário cadastrado</div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#123b63] text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Nome</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Campo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Sustento/mês</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {missionarios.map((m, i) => (
                        <tr key={m.id} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                          <td className="px-4 py-3 font-medium text-[#123b63]">{m.nome}</td>
                          <td className="px-4 py-3 text-gray-600">{m.campo_atuacao || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{TIPO_MISSIONARIO.find((t) => t.value === m.tipo)?.label}</td>
                          <td className="px-4 py-3 text-gray-600">{fmtCurrency(m.valor_sustento_mensal)}</td>
                          <td className="px-4 py-3"><StatusBadge value={m.status} options={STATUS_MISSIONARIO} /></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => editMissionario(m)} className="p-1 text-gray-400 hover:text-[#123b63] transition"><Pencil size={13} /></button>
                              <button onClick={() => deleteMissionario(m.id)} className="p-1 text-gray-400 hover:text-red-600 transition"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ ABA: EVENTOS ════════════════════════════ */}
        {activeTab === 'eventos' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Formulário */}
            <Section icon="📅" title={editEventoId ? 'Editar Evento' : 'Novo Evento'}>
              <div className="space-y-3">
                <Field label="Título *" error={errEvento.titulo}>
                  <input className={inputCls} value={formEvento.titulo} onChange={(e) => setFormEvento((p) => ({ ...p, titulo: e.target.value }))} placeholder="Nome do evento" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo">
                    <select className={inputCls} value={formEvento.tipo} onChange={(e) => setFormEvento((p) => ({ ...p, tipo: e.target.value }))}>
                      {TIPO_EVENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Data *" error={errEvento.data_evento}>
                    <input className={inputCls} type="date" value={formEvento.data_evento} onChange={(e) => setFormEvento((p) => ({ ...p, data_evento: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Local">
                  <input className={inputCls} value={formEvento.local} onChange={(e) => setFormEvento((p) => ({ ...p, local: e.target.value }))} placeholder="Local do evento" />
                </Field>
                <Field label="Projeto vinculado (opcional)">
                  <select className={inputCls} value={formEvento.projeto_id} onChange={(e) => setFormEvento((p) => ({ ...p, projeto_id: e.target.value }))}>
                    <option value="">— Nenhum —</option>
                    {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </Field>
                <Field label="Descrição">
                  <textarea className={inputCls} rows={3} value={formEvento.descricao} onChange={(e) => setFormEvento((p) => ({ ...p, descricao: e.target.value }))} placeholder="Detalhes do evento..." />
                </Field>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveEvento} className="flex-1 bg-[#123b63] text-white py-2 rounded-md text-sm font-semibold hover:bg-[#0f2a45] transition">
                    {editEventoId ? 'Salvar alterações' : 'Registrar evento'}
                  </button>
                  {editEventoId && (
                    <button onClick={() => { setFormEvento({ ...EMPTY_EVENTO }); setEditEventoId(null); setErrEvento({}); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </Section>

            {/* Lista cronológica */}
            <div className="lg:col-span-2 space-y-3">
              {eventos.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">Nenhum evento registrado</div>
              ) : (
                eventos.map((ev) => {
                  const projeto = projetos.find((p) => p.id === ev.projeto_id);
                  const tipoLabel = TIPO_EVENTO.find((t) => t.value === ev.tipo)?.label ?? ev.tipo;
                  return (
                    <div key={ev.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-4">
                      <div className="text-center min-w-[44px]">
                        <div className="text-lg font-bold text-[#123b63]">{ev.data_evento?.slice(8, 10)}</div>
                        <div className="text-xs text-gray-400 uppercase">{new Date(ev.data_evento + 'T00:00:00').toLocaleString('pt-BR', { month: 'short' })}</div>
                        <div className="text-xs text-gray-400">{ev.data_evento?.slice(0, 4)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#123b63] text-sm">{ev.titulo}</span>
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{tipoLabel}</span>
                        </div>
                        {ev.local && <p className="text-xs text-gray-500 mt-0.5">📍 {ev.local}</p>}
                        {projeto && <p className="text-xs text-purple-600 mt-0.5">🌍 {projeto.nome}</p>}
                        {ev.descricao && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{ev.descricao}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => editEvento(ev)} className="p-1.5 text-gray-400 hover:text-[#123b63] transition"><Pencil size={13} /></button>
                        <button onClick={() => deleteEvento(ev.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ ABA: ARRECADAÇÕES ══════════════════════ */}
        {activeTab === 'arrecadacoes' && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Formulário */}
              <Section icon="💰" title={editArrecadacaoId ? 'Editar Registro' : 'Novo Registro'}>
                <div className="space-y-3">
                  <Field label="Projeto vinculado (opcional)">
                    <select className={inputCls} value={formArrecadacao.projeto_id} onChange={(e) => setFormArrecadacao((p) => ({ ...p, projeto_id: e.target.value }))}>
                      <option value="">— Geral / Sem projeto —</option>
                      {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Data *" error={errArrecadacao.data}>
                      <input className={inputCls} type="date" value={formArrecadacao.data} onChange={(e) => setFormArrecadacao((p) => ({ ...p, data: e.target.value }))} />
                    </Field>
                    <Field label="Valor (R$) *" error={errArrecadacao.valor}>
                      <input className={inputCls} inputMode="numeric" value={formArrecadacao.valor} onChange={(e) => setFormArrecadacao((p) => ({ ...p, valor: maskCurrency(e.target.value) }))} placeholder="0,00" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tipo de Registro">
                      <select className={inputCls} value={formArrecadacao.forma} onChange={(e) => setFormArrecadacao((p) => ({ ...p, forma: e.target.value }))}>
                        {FORMA_ARRECADACAO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Forma de Pagamento">
                      <select className={inputCls} value={formArrecadacao.forma_pagamento} onChange={(e) => setFormArrecadacao((p) => ({ ...p, forma_pagamento: e.target.value }))}>
                        {FORMA_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  {congregacoes.length > 0 && (
                    <Field label="Congregação de origem">
                      <select className={inputCls} value={formArrecadacao.congregacao_id} onChange={(e) => setFormArrecadacao((p) => ({ ...p, congregacao_id: e.target.value }))}>
                        <option value="">— Todas —</option>
                        {congregacoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Descrição">
                    <input className={inputCls} value={formArrecadacao.descricao} onChange={(e) => setFormArrecadacao((p) => ({ ...p, descricao: e.target.value }))} placeholder="Observação..." />
                  </Field>
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveArrecadacao} className="flex-1 bg-[#123b63] text-white py-2 rounded-md text-sm font-semibold hover:bg-[#0f2a45] transition">
                      {editArrecadacaoId ? 'Salvar alterações' : 'Registrar entrada'}
                    </button>
                    {editArrecadacaoId && (
                      <button onClick={() => { setFormArrecadacao({ ...EMPTY_ARRECADACAO, data: new Date().toISOString().slice(0, 10) }); setEditArrecadacaoId(null); setErrArrecadacao({}); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition">
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </Section>

              {/* Comparativo meta × realizado por projeto */}
              <div className="lg:col-span-2 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Meta × Realizado por projeto</h3>
                {projetos.filter((p) => (p.meta_arrecadacao ?? 0) > 0 || (totaisPorProjeto[p.id] ?? 0) > 0).length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">Nenhum projeto com meta ou arrecadação</div>
                ) : (
                  projetos
                    .filter((p) => (p.meta_arrecadacao ?? 0) > 0 || (totaisPorProjeto[p.id] ?? 0) > 0)
                    .map((p) => {
                      const arrecadado = totaisPorProjeto[p.id] || 0;
                      return (
                        <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#123b63] text-sm">{p.nome}</span>
                              <StatusBadge value={p.status} options={STATUS_PROJETO} />
                            </div>
                            <span className="text-sm font-bold text-emerald-600">{fmtCurrency(arrecadado)}</span>
                          </div>
                          {(p.meta_arrecadacao ?? 0) > 0
                            ? <ProgressBar value={arrecadado} max={p.meta_arrecadacao!} />
                            : <p className="text-xs text-gray-400 mt-1">Sem meta definida</p>
                          }
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Histórico de entradas */}
            <Section icon="📋" title="Histórico de entradas">
              {arrecadacoes.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Nenhuma arrecadação registrada</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Projeto</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Forma</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Congregação</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                        <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor</th>
                        <th className="py-2 px-3 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {arrecadacoes.map((a, i) => {
                        const projeto = projetos.find((p) => p.id === a.projeto_id);
                        const cong = congregacoes.find((c) => c.id === a.congregacao_id);
                        const formaLabel = FORMA_ARRECADACAO.find((f) => f.value === a.forma)?.label ?? a.forma;
                        return (
                          <tr key={a.id} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{fmtDate(a.data)}</td>
                            <td className="py-2 px-3 text-gray-700">{projeto?.nome ?? <span className="text-gray-400 italic">Geral</span>}</td>
                            <td className="py-2 px-3 text-gray-600">{formaLabel}</td>
                            <td className="py-2 px-3 text-gray-600">{cong?.nome ?? '—'}</td>
                            <td className="py-2 px-3 text-gray-600 max-w-[200px] truncate">{a.descricao || '—'}</td>
                            <td className="py-2 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtCurrency(a.valor)}</td>
                            <td className="py-2 px-3">
                              <div className="flex gap-1">
                                <button onClick={() => editArrecadacao(a)} className="p-1 text-gray-400 hover:text-[#123b63] transition"><Pencil size={13} /></button>
                                <button onClick={() => deleteArrecadacao(a.id)} className="p-1 text-gray-400 hover:text-red-600 transition"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-50">
                        <td colSpan={5} className="py-2 px-3 text-sm font-semibold text-gray-700 text-right">Total:</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">{fmtCurrency(totalArrecadado)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ═══════════════════ ABA: RELATÓRIO ══════════════════════════ */}
        {activeTab === 'relatorio' && (
          <>
            <style>{`
              @media print {
                body * { visibility: hidden !important; }
                #missoes-relatorio-print, #missoes-relatorio-print * { visibility: visible !important; }
                #missoes-relatorio-print { position: fixed; inset: 0; padding: 24px; background: white; }
                .no-print { display: none !important; }
              }
            `}</style>
            <div className="space-y-4">
              {/* Filtros */}
              <div className="no-print bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data início</label>
                  <input type="date" value={relDtInicio} onChange={(e) => setRelDtInicio(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data fim</label>
                  <input type="date" value={relDtFim} onChange={(e) => setRelDtFim(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Projeto</label>
                  <select value={relProjetoId} onChange={(e) => setRelProjetoId(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Todos os projetos</option>
                    {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                {congregacoes.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Congregação</label>
                    <select value={relCongId} onChange={(e) => setRelCongId(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Todas</option>
                      {congregacoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition">
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
              </div>

              {/* Corpo do relatório */}
              <div id="missoes-relatorio-print" className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">

                {/* Timbre (só na impressão) */}
                <div className="hidden print:block border-b border-gray-300 pb-4 mb-2">
                  <div className="flex items-center gap-4">
                    {configIgreja?.logo && <img src={configIgreja.logo} alt="Logo" className="h-16 w-16 object-contain" />}
                    <div className="flex-1 text-center">
                      <p className="text-xl font-bold text-gray-900">{configIgreja?.nome}</p>
                      {configIgreja?.endereco && <p className="text-xs text-gray-600 mt-0.5">{configIgreja.endereco}</p>}
                      <p className="text-xs text-gray-600 mt-0.5">
                        {configIgreja?.telefone && `Tel: ${configIgreja.telefone}`}
                        {configIgreja?.telefone && configIgreja?.email && ' | '}
                        {configIgreja?.email && `Email: ${configIgreja.email}`}
                      </p>
                    </div>
                    {configIgreja?.logo && <div className="w-16" />}
                  </div>
                </div>

                {/* Cabeçalho */}
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-bold text-[#123b63]">Relatório de Arrecadações — Missões</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {relDtInicio || relDtFim
                        ? `${relDtInicio ? fmtDate(relDtInicio) : '—'} até ${relDtFim ? fmtDate(relDtFim) : '—'}`
                        : 'Todos os períodos'}
                      {relProjetoId ? ` · ${projetos.find((p) => p.id === relProjetoId)?.nome}` : ' · Todos os projetos'}
                      {relCongId ? ` · ${congregacoes.find((c) => c.id === relCongId)?.nome}` : ''}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-[#123b63]">{fmtCurrency(relTotal)}</p>
                </div>

                {/* Resumo por forma */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Resumo por tipo de registro</h3>
                  <div className="divide-y divide-gray-100">
                    {FORMA_ARRECADACAO.map((f) => {
                      const val = relPorForma[f.value] ?? 0;
                      if (!val) return null;
                      const pct = relTotal > 0 ? ((val / relTotal) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={f.value} className="flex items-center justify-between py-2 text-sm">
                          <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-xs font-semibold">{f.label}</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-gray-400 text-xs">{pct}%</span>
                            <span className="font-semibold text-gray-800 w-28 text-right">{fmtCurrency(val)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo por projeto */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Resumo por projeto</h3>
                  <div className="divide-y divide-gray-100">
                    {Object.entries(relPorProjeto).map(([pid, val]) => {
                      const nome = pid === '__geral__' ? 'Geral (sem projeto)' : projetos.find((p) => p.id === pid)?.nome ?? pid;
                      const pct = relTotal > 0 ? ((val / relTotal) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={pid} className="flex items-center justify-between py-2 text-sm">
                          <span className="text-gray-700">{nome}</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-gray-400 text-xs">{pct}%</span>
                            <span className="font-semibold text-gray-800 w-28 text-right">{fmtCurrency(val)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detalhado */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Lançamentos detalhados</h3>
                  {relFiltrado.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhum registro no período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Projeto</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Tipo</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Congregação</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Descrição</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {relFiltrado.map((a) => (
                            <tr key={a.id}>
                              <td className="px-3 py-2 text-gray-600">{fmtDate(a.data)}</td>
                              <td className="px-3 py-2 text-gray-700">{projetos.find((p) => p.id === a.projeto_id)?.nome ?? '—'}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-xs font-semibold">
                                  {FORMA_ARRECADACAO.find((f) => f.value === a.forma)?.label ?? a.forma}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-500 text-xs">{congregacoes.find((c) => c.id === a.congregacao_id)?.nome ?? '—'}</td>
                              <td className="px-3 py-2 text-gray-500">{a.descricao || '—'}</td>
                              <td className="px-3 py-2 text-right font-semibold text-[#123b63]">{fmtCurrency(a.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[#123b63]/5 border-t border-gray-200">
                            <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-600 text-right">TOTAL</td>
                            <td className="px-3 py-2 text-right font-bold text-[#123b63]">{fmtCurrency(relTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Rodapé de impressão */}
                <div className="hidden print:block border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
                  Emitido em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} — {configIgreja?.nome}
                </div>
              </div>
            </div>
          </>
        )}

      </Tabs>
    </PageLayout>
  );
}

