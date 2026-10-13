'use client';

import { useEffect, useMemo, useState } from 'react';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import type { ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import {
  Globe,
  Plane,
  Calendar,
  DollarSign,
  Printer,
  Pencil,
  Trash2,
  Plus,
  Target,
  Clock,
  Sparkles,
  MapPin,
  UserCheck,
  FileText,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

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
  { value: 'planejado',    label: 'Planejado',    color: 'bg-slate-100 text-slate-700 border border-slate-200' },
  { value: 'em_andamento', label: 'Em andamento', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  { value: 'concluido',    label: 'Concluído',    color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  { value: 'suspenso',     label: 'Suspenso',     color: 'bg-amber-50 text-amber-700 border border-amber-200' },
];

const TIPO_MISSIONARIO = [
  { value: 'sustentado', label: 'Sustentado' },
  { value: 'voluntario', label: 'Voluntário' },
  { value: 'enviado',    label: 'Enviado' },
];

const STATUS_MISSIONARIO = [
  { value: 'ativo',     label: 'Ativo',     color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  { value: 'afastado',  label: 'Afastado',  color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { value: 'retornou',  label: 'Retornou',  color: 'bg-slate-100 text-slate-700 border border-slate-200' },
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
  { id: 'projetos',      label: 'Projetos Missionários', icon: Globe },
  { id: 'missionarios',  label: 'Missionários',          icon: Plane },
  { id: 'eventos',       label: 'Eventos',               icon: Calendar },
  { id: 'arrecadacoes',  label: 'Arrecadações',          icon: DollarSign },
  { id: 'relatorio',     label: 'Relatório',             icon: Printer },
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
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

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

const inputCls = 'w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition';
const labelCls = 'block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5';
const errCls = 'text-xs font-medium text-rose-600 mt-1';

// ─── Componentes de formulário e UI ──────────────────────────────────────────

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
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${opt?.color ?? 'bg-slate-100 text-slate-700'}`}>
      {opt?.label ?? value}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1.5">
        <span className="text-teal-700">{fmtCurrency(value)} arrecadado</span>
        <span className="text-slate-500">{pct}% de {fmtCurrency(max)}</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct >= 100 ? 'bg-emerald-500' : 'bg-teal-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  headerAction,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-100/80 flex items-center justify-center font-bold flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
          </div>
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MissoesPage() {
  const { ctx, bloqueado } = useRequireModulo('missoes');
  const planFeatures = usePlanFeatures();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<string>('projetos');
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [missionarios, setMissionarios] = useState<Missionario[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [arrecadacoes, setArrecadacoes] = useState<Arrecadacao[]>([]);
  const [congregacoes, setCongregacoes] = useState<CongregacaoOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja | null>(null);

  const [notification, setNotification] = useState<{
    isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; autoClose?: number;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showNotif = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, autoClose?: number) =>
    setNotification({ isOpen: true, title, message, type, autoClose: autoClose ?? (type === 'success' ? 3000 : undefined) });

  const currentYear = new Date().getFullYear();
  const [anoFiltro, setAnoFiltro] = useState<number>(currentYear);

  // Formulário: Projetos
  const [formProjeto, setFormProjeto] = useState({ ...EMPTY_PROJETO });
  const [editProjetoId, setEditProjetoId] = useState<string | null>(null);
  const [errProjeto, setErrProjeto] = useState<Record<string, string>>({});

  // Formulário: Missionários
  const [formMissionario, setFormMissionario] = useState({ ...EMPTY_MISSIONARIO });
  const [editMissionarioId, setEditMissionarioId] = useState<string | null>(null);
  const [errMissionario, setErrMissionario] = useState<Record<string, string>>({});

  // Formulário: Eventos
  const [formEvento, setFormEvento] = useState({ ...EMPTY_EVENTO });
  const [editEventoId, setEditEventoId] = useState<string | null>(null);
  const [errEvento, setErrEvento] = useState<Record<string, string>>({});

  // Formulário: Arrecadações
  const [formArrecadacao, setFormArrecadacao] = useState({ ...EMPTY_ARRECADACAO });
  const [editArrecadacaoId, setEditArrecadacaoId] = useState<string | null>(null);
  const [errArrecadacao, setErrArrecadacao] = useState<Record<string, string>>({});

  // Filtros da aba Relatório
  const [relDtInicio, setRelDtInicio] = useState('');
  const [relDtFim, setRelDtFim] = useState('');
  const [relProjetoId, setRelProjetoId] = useState('');
  const [relCongId, setRelCongId] = useState('');

  // ── Carregamento inicial ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const mid = await resolveMinistryId(supabase);
        if (cancelled) return;
        setMinistryId(mid);
        if (mid) {
          const cfg = await fetchConfiguracaoIgrejaFromSupabase(supabase, mid);
          if (!cancelled) setConfigIgreja(cfg);
          await loadAll(mid);
        }
      } catch (err: any) {
        if (!cancelled) showNotif('error', 'Erro ao carregar dados', err?.message || 'Tente novamente.', undefined);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [supabase]);

  const loadAll = async (mid: string) => {
    await Promise.all([
      loadProjetos(mid),
      loadMissionarios(mid),
      loadEventos(mid),
      loadArrecadacoes(mid),
      loadCongregacoes(mid),
      loadMembers(mid),
    ]);
  };

  const loadProjetos = async (mid: string) => {
    const { data } = await supabase.from('missoes_projetos').select('*').eq('ministry_id', mid).order('created_at', { ascending: false });
    setProjetos(data || []);
  };

  const loadMissionarios = async (mid: string) => {
    const { data } = await supabase.from('missoes_missionarios').select('*').eq('ministry_id', mid).order('nome', { ascending: true });
    setMissionarios(data || []);
  };

  const loadEventos = async (mid: string) => {
    const { data } = await supabase.from('missoes_eventos').select('*').eq('ministry_id', mid).order('data_evento', { ascending: false });
    setEventos(data || []);
  };

  const loadArrecadacoes = async (mid: string) => {
    const { data } = await supabase.from('missoes_arrecadacoes').select('*').eq('ministry_id', mid).order('data', { ascending: false });
    setArrecadacoes(data || []);
  };

  const loadCongregacoes = async (mid: string) => {
    const { data } = await supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).order('nome', { ascending: true });
    setCongregacoes(data || []);
  };

  const loadMembers = async (mid: string) => {
    const { data } = await supabase.from('members').select('id, nome').eq('ministry_id', mid).eq('status', 'ativo').order('nome', { ascending: true });
    setMembers(data || []);
  };

  // ── Memos de estatísticas ─────────────────────────────────────────────────

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([currentYear]);
    arrecadacoes.forEach((a) => {
      const y = parseInt(a.data?.slice(0, 4), 10);
      if (y) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [arrecadacoes, currentYear]);

  const arrecadacoesDoAno = useMemo(() =>
    arrecadacoes.filter((a) => a.data?.startsWith(String(anoFiltro))),
    [arrecadacoes, anoFiltro]
  );

  const totaisPorProjeto = useMemo(() => {
    const map: Record<string, number> = {};
    arrecadacoes.forEach((a) => {
      if (a.projeto_id) map[a.projeto_id] = (map[a.projeto_id] || 0) + Number(a.valor);
    });
    return map;
  }, [arrecadacoes]);

  const totalArrecadado = useMemo(() =>
    arrecadacoesDoAno.reduce((acc, a) => acc + Number(a.valor), 0),
    [arrecadacoesDoAno]
  );

  const projetosEmAndamento = useMemo(() =>
    projetos.filter((p) => p.status === 'em_andamento').length,
    [projetos]
  );

  const missionariosAtivos = useMemo(() =>
    missionarios.filter((m) => m.status === 'ativo').length,
    [missionarios]
  );

  const metaTotalAtivos = useMemo(() =>
    projetos.filter((p) => p.status === 'em_andamento').reduce((acc, p) => acc + (p.meta_arrecadacao || 0), 0),
    [projetos]
  );

  // Relatório filtrado
  const relFiltrado = useMemo(() => {
    return arrecadacoes.filter((a) => {
      if (relDtInicio && a.data < relDtInicio) return false;
      if (relDtFim && a.data > relDtFim) return false;
      if (relProjetoId && a.projeto_id !== relProjetoId) return false;
      if (relCongId && a.congregacao_id !== relCongId) return false;
      return true;
    });
  }, [arrecadacoes, relDtInicio, relDtFim, relProjetoId, relCongId]);

  const relTotal = useMemo(() => relFiltrado.reduce((acc, a) => acc + Number(a.valor), 0), [relFiltrado]);

  const relPorForma = useMemo(() => {
    const map: Record<string, number> = {};
    relFiltrado.forEach((a) => { map[a.forma] = (map[a.forma] || 0) + Number(a.valor); });
    return map;
  }, [relFiltrado]);

  const relPorProjeto = useMemo(() => {
    const map: Record<string, number> = {};
    relFiltrado.forEach((a) => {
      const k = a.projeto_id || '__geral__';
      map[k] = (map[k] || 0) + Number(a.valor);
    });
    return map;
  }, [relFiltrado]);

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
      showNotif('success', 'Cadastrado', 'Projeto cadastrado com sucesso.');
    }
    setFormProjeto({ ...EMPTY_PROJETO });
    setEditProjetoId(null);
    await loadProjetos(ministryId);
  };

  const editProjeto = (p: Projeto) => {
    setFormProjeto({
      nome: p.nome,
      descricao: p.descricao || '',
      pais_regiao: p.pais_regiao || '',
      status: p.status,
      data_inicio: p.data_inicio?.slice(0, 10) || '',
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
    showNotif('success', 'Excluído', 'Projeto removido com sucesso.');
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
      showNotif('success', 'Atualizado', 'Missionário atualizado com sucesso.');
    } else {
      const { error } = await supabase.from('missoes_missionarios').insert(payload);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }
      showNotif('success', 'Cadastrado', 'Missionário cadastrado com sucesso.');
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
      const { data: existing } = await supabase
        .from('missoes_arrecadacoes')
        .select('tesouraria_lancamento_id')
        .eq('id', editArrecadacaoId)
        .single();

      const { error } = await supabase.from('missoes_arrecadacoes').update(payload).eq('id', editArrecadacaoId);
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }

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
      const { data: newArr, error } = await supabase
        .from('missoes_arrecadacoes')
        .insert(payload)
        .select('id')
        .single();
      if (error) { showNotif('error', 'Erro', error.message, undefined); return; }

      if (newArr?.id) {
        const { data: newLanc, error: errLanc } = await supabase
          .from('tesouraria_lancamentos')
          .insert({ ...tesPayload, created_at: now })
          .select('id')
          .single();
        if (!errLanc && newLanc?.id) {
          await supabase
            .from('missoes_arrecadacoes')
            .update({ tesouraria_lancamento_id: newLanc.id })
            .eq('id', newArr.id);
        }
      }
      showNotif('success', 'Registrado', 'Arrecadação registrada e lançada na Tesouraria.');
    }
    setFormArrecadacao({ ...EMPTY_ARRECADACAO, data: new Date().toISOString().slice(0, 10) });
    setEditArrecadacaoId(null);
    await loadArrecadacoes(ministryId);
  };

  const editArrecadacao = (a: Arrecadacao) => {
    setFormArrecadacao({
      projeto_id: a.projeto_id || '',
      data: a.data?.slice(0, 10) || '',
      valor: maskCurrency(String(Math.round(a.valor * 100))),
      forma: a.forma,
      forma_pagamento: 'dinheiro',
      descricao: a.descricao || '',
      congregacao_id: a.congregacao_id || '',
    });
    setEditArrecadacaoId(a.id);
    setErrArrecadacao({});
  };

  const deleteArrecadacao = async (id: string) => {
    if (!ministryId) return;
    const { data: rec } = await supabase
      .from('missoes_arrecadacoes')
      .select('tesouraria_lancamento_id')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('missoes_arrecadacoes').delete().eq('id', id);
    if (error) { showNotif('error', 'Erro', error.message, undefined); return; }

    if (rec?.tesouraria_lancamento_id) {
      await supabase.from('tesouraria_lancamentos').delete().eq('id', rec.tesouraria_lancamento_id);
    }
    showNotif('success', 'Excluído', 'Registro e lançamento da Tesouraria removidos.');
    await loadArrecadacoes(ministryId);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (ctx.loading || loadingData || planFeatures.loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f7fa] min-h-screen flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-500 font-semibold text-sm bg-white px-6 py-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Carregando módulo Missões...</span>
        </div>
      </div>
    );
  }

  if (!planFeatures.has_modulo_missoes || !planFeatures.hasFeature('missions_module')) {
    return (
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f7fa] min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto w-full">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto space-y-6 my-10">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 shadow-xs border border-blue-200/60">
              <Plane className="w-8 h-8" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full mb-3">
                Recurso do Plano Starter
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Módulo Missões Indisponível no seu Plano</h2>
            </div>
            <p className="text-slate-600 text-sm sm:text-base font-semibold leading-relaxed max-w-lg mx-auto">
              A Gestão de Missões está disponível a partir do Plano Starter.
            </p>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
              Faça o upgrade para gerenciar projetos missionários, sustento de missionários, campanhas e relatórios de arrecadação da sua igreja.
            </p>
            <div className="pt-3">
              <a
                href="/configuracoes"
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
              >
                Fazer Upgrade / Conhecer Planos
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (bloqueado) return null;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f7fa] min-h-screen">
      <NotificationModal
        isOpen={notification.isOpen} title={notification.title} message={notification.message}
        type={notification.type} onClose={() => setNotification((p) => ({ ...p, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto w-full">
        {/* ── Header da Página (Padrão Membros) ────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center border border-teal-800 shadow-sm flex-shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Missões</h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                Gerencie projetos, missionários, eventos, arrecadações e relatórios missionários.
              </p>
            </div>
          </div>

          {/* Seletor de Exercício */}
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-300 shadow-xs self-start sm:self-auto">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Exercício</span>
            <select
              value={anoFiltro}
              onChange={(e) => setAnoFiltro(Number(e.target.value))}
              className="text-sm font-black text-teal-800 bg-transparent focus:outline-none cursor-pointer"
            >
              {anosDisponiveis.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Cards Principais — KPIs Coloridos (Padrão Membros) ──────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Projetos em andamento (Azul) */}
          <div className="bg-[#ebf5ff] border border-[#d0e6ff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#2563eb] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dbeafe]">
                <Globe className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Projetos Ativos
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {projetosEmAndamento}
                </p>
                <p className="text-[11px] font-bold text-teal-700 mt-1 truncate">
                  {projetos.length} cadastrado{projetos.length === 1 ? '' : 's'} no total
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#dbeafe] text-[#2563eb] flex items-center justify-center flex-shrink-0 self-start">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>

          {/* Missionários Ativos (Verde) */}
          <div className="bg-[#ecfdf3] border border-[#cff7de] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#16a34a] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dcfce7]">
                <Plane className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Missionários Ativos
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {missionariosAtivos}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  {missionarios.length} no cadastro geral
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#dcfce7] text-[#16a34a] flex items-center justify-center flex-shrink-0 self-start">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>

          {/* Total Arrecadado (Âmbar / Laranja) */}
          <div className="bg-[#fff6ea] border border-[#fde4c4] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#ea580c] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ffedd5]">
                <DollarSign className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Arrecadado · {anoFiltro}
                </span>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mt-0.5 truncate">
                  {fmtCurrency(totalArrecadado)}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  {arrecadacoesDoAno.length} lançamento{arrecadacoesDoAno.length === 1 ? '' : 's'} no ano
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center flex-shrink-0 self-start">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          {/* Meta Projetos Ativos (Roxo / Violeta) */}
          <div className="bg-[#f3f0ff] border border-[#e3dbff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#7c3aed] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ede9fe]">
                <Target className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Meta Projetos Ativos
                </span>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mt-0.5 truncate">
                  {metaTotalAtivos > 0 ? fmtCurrency(metaTotalAtivos) : '—'}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  Projetos em andamento
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center flex-shrink-0 self-start">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* ── Navegação de Abas (Pills no Padrão Membros) ─────────────── */}
        <div className="flex items-center gap-2.5 mb-6 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ═══════════════════ ABA: PROJETOS ═══════════════════════════ */}
        {activeTab === 'projetos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulário */}
            <SectionCard
              icon={Globe}
              title={editProjetoId ? 'Editar Projeto' : 'Novo Projeto'}
              subtitle="Cadastre e gerencie metas e prazos"
            >
              <div className="space-y-4">
                <Field label="Nome do projeto *" error={errProjeto.nome}>
                  <input
                    className={inputCls}
                    value={formProjeto.nome}
                    onChange={(e) => setFormProjeto((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: Missão Amazônia"
                  />
                </Field>
                <Field label="País / Região">
                  <input
                    className={inputCls}
                    value={formProjeto.pais_regiao}
                    onChange={(e) => setFormProjeto((p) => ({ ...p, pais_regiao: e.target.value }))}
                    placeholder="Ex: Brasil - AM"
                  />
                </Field>
                <Field label="Status">
                  <select
                    className={inputCls}
                    value={formProjeto.status}
                    onChange={(e) => setFormProjeto((p) => ({ ...p, status: e.target.value }))}
                  >
                    {STATUS_PROJETO.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data início">
                    <input
                      className={inputCls}
                      type="date"
                      value={formProjeto.data_inicio}
                      onChange={(e) => setFormProjeto((p) => ({ ...p, data_inicio: e.target.value }))}
                    />
                  </Field>
                  <Field label="Data fim">
                    <input
                      className={inputCls}
                      type="date"
                      value={formProjeto.data_fim}
                      onChange={(e) => setFormProjeto((p) => ({ ...p, data_fim: e.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="Meta de Investimento (R$)">
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    value={formProjeto.meta_arrecadacao}
                    onChange={(e) => setFormProjeto((p) => ({ ...p, meta_arrecadacao: maskCurrency(e.target.value) }))}
                    placeholder="0,00"
                  />
                </Field>
                <Field label="Descrição">
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={formProjeto.descricao}
                    onChange={(e) => setFormProjeto((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Descrição do projeto..."
                  />
                </Field>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveProjeto}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{editProjetoId ? 'Salvar alterações' : 'Cadastrar projeto'}</span>
                  </button>
                  {editProjetoId && (
                    <button
                      onClick={() => {
                        setFormProjeto({ ...EMPTY_PROJETO });
                        setEditProjetoId(null);
                        setErrProjeto({});
                      }}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Lista de Projetos */}
            <div className="lg:col-span-2 space-y-4">
              {projetos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400 font-semibold shadow-sm">
                  <Globe className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhum projeto cadastrado no momento.</p>
                </div>
              ) : (
                projetos.map((p) => {
                  const arrecadado = totaisPorProjeto[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-base">{p.nome}</h3>
                            <StatusBadge value={p.status} options={STATUS_PROJETO} />
                          </div>
                          {p.pais_regiao && (
                            <p className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{p.pais_regiao}</span>
                            </p>
                          )}
                          {p.descricao && (
                            <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                              {p.descricao}
                            </p>
                          )}
                          {p.data_inicio && (
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{fmtDate(p.data_inicio)}{p.data_fim ? ` → ${fmtDate(p.data_fim)}` : ''}</span>
                            </p>
                          )}
                          {(p.meta_arrecadacao ?? 0) > 0 && (
                            <ProgressBar value={arrecadado} max={p.meta_arrecadacao!} />
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => editProjeto(p)}
                            title="Editar projeto"
                            className="p-2 text-slate-400 hover:text-teal-700 hover:bg-slate-50 rounded-lg transition"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProjeto(p.id)}
                            title="Excluir projeto"
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulário */}
            <SectionCard
              icon={Plane}
              title={editMissionarioId ? 'Editar Missionário' : 'Novo Missionário'}
              subtitle="Cadastro de missionários no campo"
            >
              <div className="space-y-4">
                <Field label="Nome *" error={errMissionario.nome}>
                  <input
                    className={inputCls}
                    value={formMissionario.nome}
                    onChange={(e) => setFormMissionario((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </Field>
                <Field label="Campo de atuação">
                  <input
                    className={inputCls}
                    value={formMissionario.campo_atuacao}
                    onChange={(e) => setFormMissionario((p) => ({ ...p, campo_atuacao: e.target.value }))}
                    placeholder="País / Cidade"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo">
                    <select
                      className={inputCls}
                      value={formMissionario.tipo}
                      onChange={(e) => setFormMissionario((p) => ({ ...p, tipo: e.target.value }))}
                    >
                      {TIPO_MISSIONARIO.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      className={inputCls}
                      value={formMissionario.status}
                      onChange={(e) => setFormMissionario((p) => ({ ...p, status: e.target.value }))}
                    >
                      {STATUS_MISSIONARIO.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Data de envio">
                  <input
                    className={inputCls}
                    type="date"
                    value={formMissionario.data_envio}
                    onChange={(e) => setFormMissionario((p) => ({ ...p, data_envio: e.target.value }))}
                  />
                </Field>
                <Field label="Contato (tel / e-mail)">
                  <input
                    className={inputCls}
                    value={formMissionario.contato}
                    onChange={(e) => setFormMissionario((p) => ({ ...p, contato: maskPhone(e.target.value) }))}
                    placeholder="(85) 99999-9999"
                  />
                </Field>
                <Field label="Valor de sustento mensal (R$)">
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    value={formMissionario.valor_sustento_mensal}
                    onChange={(e) => setFormMissionario((p) => ({ ...p, valor_sustento_mensal: maskCurrency(e.target.value) }))}
                    placeholder="0,00"
                  />
                </Field>
                {members.length > 0 && (
                  <Field label="Vínculo com membro (opcional)">
                    <select
                      className={inputCls}
                      value={formMissionario.member_id}
                      onChange={(e) => setFormMissionario((p) => ({ ...p, member_id: e.target.value }))}
                    >
                      <option value="">— Sem vínculo —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveMissionario}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{editMissionarioId ? 'Salvar alterações' : 'Cadastrar missionário'}</span>
                  </button>
                  {editMissionarioId && (
                    <button
                      onClick={() => {
                        setFormMissionario({ ...EMPTY_MISSIONARIO });
                        setEditMissionarioId(null);
                        setErrMissionario({});
                      }}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Tabela de Missionários */}
            <div className="lg:col-span-2">
              {missionarios.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400 font-semibold shadow-sm">
                  <Plane className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhum missionário cadastrado no momento.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Nome</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Campo</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Tipo</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Sustento/mês</th>
                          <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3.5 w-16" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {missionarios.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3.5 font-bold text-slate-900">{m.nome}</td>
                            <td className="px-4 py-3.5 text-slate-600 font-medium">{m.campo_atuacao || '—'}</td>
                            <td className="px-4 py-3.5 text-slate-600 font-medium">{TIPO_MISSIONARIO.find((t) => t.value === m.tipo)?.label}</td>
                            <td className="px-4 py-3.5 font-bold text-emerald-700">{fmtCurrency(m.valor_sustento_mensal)}</td>
                            <td className="px-4 py-3.5">
                              <StatusBadge value={m.status} options={STATUS_MISSIONARIO} />
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex gap-1 justify-end">
                                <button
                                  onClick={() => editMissionario(m)}
                                  title="Editar"
                                  className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-50 rounded-lg transition"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteMissionario(m.id)}
                                  title="Excluir"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ ABA: EVENTOS ════════════════════════════ */}
        {activeTab === 'eventos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulário */}
            <SectionCard
              icon={Calendar}
              title={editEventoId ? 'Editar Evento' : 'Novo Evento'}
              subtitle="Cultos, conferências e campanhas"
            >
              <div className="space-y-4">
                <Field label="Título *" error={errEvento.titulo}>
                  <input
                    className={inputCls}
                    value={formEvento.titulo}
                    onChange={(e) => setFormEvento((p) => ({ ...p, titulo: e.target.value }))}
                    placeholder="Nome do evento"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo">
                    <select
                      className={inputCls}
                      value={formEvento.tipo}
                      onChange={(e) => setFormEvento((p) => ({ ...p, tipo: e.target.value }))}
                    >
                      {TIPO_EVENTO.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Data *" error={errEvento.data_evento}>
                    <input
                      className={inputCls}
                      type="date"
                      value={formEvento.data_evento}
                      onChange={(e) => setFormEvento((p) => ({ ...p, data_evento: e.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="Local">
                  <input
                    className={inputCls}
                    value={formEvento.local}
                    onChange={(e) => setFormEvento((p) => ({ ...p, local: e.target.value }))}
                    placeholder="Local do evento"
                  />
                </Field>
                <Field label="Projeto vinculado (opcional)">
                  <select
                    className={inputCls}
                    value={formEvento.projeto_id}
                    onChange={(e) => setFormEvento((p) => ({ ...p, projeto_id: e.target.value }))}
                  >
                    <option value="">— Nenhum —</option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Descrição">
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={formEvento.descricao}
                    onChange={(e) => setFormEvento((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Detalhes do evento..."
                  />
                </Field>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveEvento}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{editEventoId ? 'Salvar alterações' : 'Registrar evento'}</span>
                  </button>
                  {editEventoId && (
                    <button
                      onClick={() => {
                        setFormEvento({ ...EMPTY_EVENTO });
                        setEditEventoId(null);
                        setErrEvento({});
                      }}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Lista cronológica de eventos */}
            <div className="lg:col-span-2 space-y-3">
              {eventos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400 font-semibold shadow-sm">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhum evento registrado no momento.</p>
                </div>
              ) : (
                eventos.map((ev) => {
                  const projeto = projetos.find((p) => p.id === ev.projeto_id);
                  const tipoLabel = TIPO_EVENTO.find((t) => t.value === ev.tipo)?.label ?? ev.tipo;
                  return (
                    <div
                      key={ev.id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all flex items-start gap-4"
                    >
                      <div className="bg-teal-50 border border-teal-100/90 rounded-2xl p-3 text-center min-w-[56px] flex-shrink-0">
                        <div className="text-xl font-black text-teal-800 leading-none">
                          {ev.data_evento?.slice(8, 10)}
                        </div>
                        <div className="text-[10px] font-bold text-teal-600 uppercase mt-1">
                          {new Date(ev.data_evento + 'T00:00:00').toLocaleString('pt-BR', { month: 'short' })}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {ev.data_evento?.slice(0, 4)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-base">{ev.titulo}</span>
                          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 font-bold px-2.5 py-0.5 rounded-full">
                            {tipoLabel}
                          </span>
                        </div>
                        {ev.local && (
                          <p className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{ev.local}</span>
                          </p>
                        )}
                        {projeto && (
                          <p className="text-xs font-bold text-purple-700 mt-1 flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-purple-500" />
                            <span>Projeto: {projeto.nome}</span>
                          </p>
                        )}
                        {ev.descricao && (
                          <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                            {ev.descricao}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => editEvento(ev)}
                          title="Editar"
                          className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-50 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteEvento(ev.id)}
                          title="Excluir"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulário */}
              <SectionCard
                icon={DollarSign}
                title={editArrecadacaoId ? 'Editar Registro' : 'Novo Registro'}
                subtitle="Ofertas e doações vinculadas à Tesouraria"
              >
                <div className="space-y-4">
                  <Field label="Projeto vinculado (opcional)">
                    <select
                      className={inputCls}
                      value={formArrecadacao.projeto_id}
                      onChange={(e) => setFormArrecadacao((p) => ({ ...p, projeto_id: e.target.value }))}
                    >
                      <option value="">— Geral / Sem projeto —</option>
                      {projetos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Data *" error={errArrecadacao.data}>
                      <input
                        className={inputCls}
                        type="date"
                        value={formArrecadacao.data}
                        onChange={(e) => setFormArrecadacao((p) => ({ ...p, data: e.target.value }))}
                      />
                    </Field>
                    <Field label="Valor (R$) *" error={errArrecadacao.valor}>
                      <input
                        className={inputCls}
                        inputMode="numeric"
                        value={formArrecadacao.valor}
                        onChange={(e) => setFormArrecadacao((p) => ({ ...p, valor: maskCurrency(e.target.value) }))}
                        placeholder="0,00"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tipo de Registro">
                      <select
                        className={inputCls}
                        value={formArrecadacao.forma}
                        onChange={(e) => setFormArrecadacao((p) => ({ ...p, forma: e.target.value }))}
                      >
                        {FORMA_ARRECADACAO.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Forma de Pagamento">
                      <select
                        className={inputCls}
                        value={formArrecadacao.forma_pagamento}
                        onChange={(e) => setFormArrecadacao((p) => ({ ...p, forma_pagamento: e.target.value }))}
                      >
                        {FORMA_PAGAMENTO.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {congregacoes.length > 0 && (
                    <Field label="Congregação de origem">
                      <select
                        className={inputCls}
                        value={formArrecadacao.congregacao_id}
                        onChange={(e) => setFormArrecadacao((p) => ({ ...p, congregacao_id: e.target.value }))}
                      >
                        <option value="">— Todas —</option>
                        {congregacoes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label="Descrição">
                    <input
                      className={inputCls}
                      value={formArrecadacao.descricao}
                      onChange={(e) => setFormArrecadacao((p) => ({ ...p, descricao: e.target.value }))}
                      placeholder="Observação..."
                    />
                  </Field>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveArrecadacao}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{editArrecadacaoId ? 'Salvar alterações' : 'Registrar entrada'}</span>
                    </button>
                    {editArrecadacaoId && (
                      <button
                        onClick={() => {
                          setFormArrecadacao({ ...EMPTY_ARRECADACAO, data: new Date().toISOString().slice(0, 10) });
                          setEditArrecadacaoId(null);
                          setErrArrecadacao({});
                        }}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Comparativo meta × realizado por projeto */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Meta × Realizado por projeto
                  </h3>
                </div>
                {projetos.filter((p) => (p.meta_arrecadacao ?? 0) > 0 || (totaisPorProjeto[p.id] ?? 0) > 0).length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center text-slate-400 font-semibold shadow-sm">
                    Nenhum projeto com meta ou arrecadação registrada no momento.
                  </div>
                ) : (
                  projetos
                    .filter((p) => (p.meta_arrecadacao ?? 0) > 0 || (totaisPorProjeto[p.id] ?? 0) > 0)
                    .map((p) => {
                      const arrecadado = totaisPorProjeto[p.id] || 0;
                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all"
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-slate-900 text-base">{p.nome}</span>
                              <StatusBadge value={p.status} options={STATUS_PROJETO} />
                            </div>
                            <span className="text-base font-black text-emerald-700">
                              {fmtCurrency(arrecadado)}
                            </span>
                          </div>
                          {(p.meta_arrecadacao ?? 0) > 0 ? (
                            <ProgressBar value={arrecadado} max={p.meta_arrecadacao!} />
                          ) : (
                            <p className="text-xs font-semibold text-slate-400 mt-2">Sem meta financeira definida</p>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Histórico de entradas */}
            <SectionCard
              icon={FileText}
              title="Histórico de Entradas"
              subtitle="Lançamentos realizados no módulo de Missões"
            >
              {arrecadacoes.length === 0 ? (
                <p className="text-slate-400 text-sm font-semibold text-center py-8">
                  Nenhuma arrecadação registrada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Data</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Projeto</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Forma</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Congregação</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Descrição</th>
                        <th className="py-3 px-4 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">Valor</th>
                        <th className="py-3 px-4 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {arrecadacoes.map((a) => {
                        const projeto = projetos.find((p) => p.id === a.projeto_id);
                        const cong = congregacoes.find((c) => c.id === a.congregacao_id);
                        const formaLabel = FORMA_ARRECADACAO.find((f) => f.value === a.forma)?.label ?? a.forma;
                        return (
                          <tr key={a.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3.5 px-4 text-slate-600 font-semibold whitespace-nowrap">{fmtDate(a.data)}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-800">
                              {projeto?.nome ?? <span className="text-slate-400 font-normal italic">Geral</span>}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                {formaLabel}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">{cong?.nome ?? '—'}</td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-[220px] truncate">{a.descricao || '—'}</td>
                            <td className="py-3.5 px-4 text-right font-black text-emerald-700 whitespace-nowrap">
                              {fmtCurrency(a.valor)}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex gap-1 justify-end">
                                <button
                                  onClick={() => editArrecadacao(a)}
                                  title="Editar"
                                  className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-50 rounded-lg transition"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteArrecadacao(a.id)}
                                  title="Excluir"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={5} className="py-3.5 px-4 text-sm font-bold text-slate-800 text-right uppercase tracking-wider">
                          Total Geral:
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-base text-emerald-700">
                          {fmtCurrency(totalArrecadado)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>
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
            <div className="space-y-6">
              {/* Filtros */}
              <div className="no-print bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">Data início</label>
                  <input
                    type="date"
                    value={relDtInicio}
                    onChange={(e) => setRelDtInicio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">Data fim</label>
                  <input
                    type="date"
                    value={relDtFim}
                    onChange={(e) => setRelDtFim(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">Projeto</label>
                  <select
                    value={relProjetoId}
                    onChange={(e) => setRelProjetoId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    <option value="">Todos os projetos</option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                {congregacoes.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">Congregação</label>
                    <select
                      value={relCongId}
                      onChange={(e) => setRelCongId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    >
                      <option value="">Todas</option>
                      {congregacoes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Relatório</span>
                </button>
              </div>

              {/* Corpo do relatório */}
              <div id="missoes-relatorio-print" className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-6">
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
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Relatório de Arrecadações — Missões</h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">
                      {relDtInicio || relDtFim
                        ? `${relDtInicio ? fmtDate(relDtInicio) : '—'} até ${relDtFim ? fmtDate(relDtFim) : '—'}`
                        : 'Todos os períodos'}
                      {relProjetoId ? ` · ${projetos.find((p) => p.id === relProjetoId)?.nome}` : ' · Todos os projetos'}
                      {relCongId ? ` · ${congregacoes.find((c) => c.id === relCongId)?.nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Filtrado</span>
                    <p className="text-2xl font-black text-emerald-700">{fmtCurrency(relTotal)}</p>
                  </div>
                </div>

                {/* Resumo por forma */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Resumo por tipo de registro</h3>
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                    {FORMA_ARRECADACAO.map((f) => {
                      const val = relPorForma[f.value] ?? 0;
                      if (!val) return null;
                      const pct = relTotal > 0 ? ((val / relTotal) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={f.value} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50/60 transition">
                          <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-100">
                            {f.label}
                          </span>
                          <div className="flex gap-4 items-center">
                            <span className="text-slate-400 text-xs font-semibold">{pct}%</span>
                            <span className="font-bold text-slate-800 w-28 text-right">{fmtCurrency(val)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo por projeto */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Resumo por projeto</h3>
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                    {Object.entries(relPorProjeto).map(([pid, val]) => {
                      const nome = pid === '__geral__' ? 'Geral (sem projeto)' : projetos.find((p) => p.id === pid)?.nome ?? pid;
                      const pct = relTotal > 0 ? ((val / relTotal) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={pid} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50/60 transition">
                          <span className="font-bold text-slate-800">{nome}</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-slate-400 text-xs font-semibold">{pct}%</span>
                            <span className="font-bold text-slate-800 w-28 text-right">{fmtCurrency(val)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detalhado */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Lançamentos detalhados</h3>
                  {relFiltrado.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-400">Nenhum registro no período.</p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Data</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Projeto</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Congregação</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Descrição</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {relFiltrado.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/60 transition">
                              <td className="px-4 py-3 text-slate-600 font-semibold">{fmtDate(a.data)}</td>
                              <td className="px-4 py-3 font-bold text-slate-800">{projetos.find((p) => p.id === a.projeto_id)?.nome ?? '—'}</td>
                              <td className="px-4 py-3">
                                <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-100">
                                  {FORMA_ARRECADACAO.find((f) => f.value === a.forma)?.label ?? a.forma}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500 text-xs font-medium">{congregacoes.find((c) => c.id === a.congregacao_id)?.nome ?? '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{a.descricao || '—'}</td>
                              <td className="px-4 py-3 text-right font-black text-emerald-700">{fmtCurrency(a.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200">
                            <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-700 text-right uppercase tracking-wider">TOTAL</td>
                            <td className="px-4 py-3 text-right font-black text-emerald-700">{fmtCurrency(relTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Rodapé de impressão */}
                <div className="hidden print:block border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
                  Emitido em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} — {configIgreja?.nome}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
