'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useUserContext } from '@/hooks/useUserContext';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';
import { loadCertificadosTemplatesForCurrentUser } from '@/lib/certificados-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { substituirPlaceholdersCertificado } from '@/lib/certificados-utils';
import {
  Award,
  Bed,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileBarChart2,
  Filter,
  Gift,
  HelpCircle,
  Landmark,
  LayoutList,
  MapPin,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Tag,
  Ticket,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoEvento =
  | 'culto_especial'
  | 'congresso'
  | 'conferencia'
  | 'palestra'
  | 'retiro'
  | 'evangelismo'
  | 'treinamento'
  | 'social'
  | 'outro';

type FormaPagamento = 'a_vista' | 'pix' | 'boleto' | 'cortesia';
type BrindeDistribuicao = 'todos' | 'quantidade_limitada';

type StatusEvento = 'programado' | 'em_andamento' | 'realizado' | 'cancelado';
type StatusInscricao =
  | 'confirmado'
  | 'cancelado'
  | 'lista_espera'
  | 'aguardando_pagamento'
  | 'expirado';
type StatusHospedagem =
  | 'nao_aplicavel'
  | 'solicitada'
  | 'confirmada'
  | 'lista_espera'
  | 'cancelada';
type AbaEvento = 'eventos' | 'inscricoes' | 'checkin' | 'pagamentos' | 'relatorios';
type ViewMode = 'lista' | 'calendario';

type TipoPeriodo =
  | 'todos'
  | 'este_mes'
  | 'proximo_mes'
  | 'proximos_30'
  | 'proximos_90'
  | 'mes_especifico'
  | 'historico_completo';

interface Congregacao {
  id: string;
  nome: string;
}
interface Membro {
  id: string;
  nome_completo: string;
}

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
  evento_pago?: boolean;
  valor_inscricao: number;
  formas_pagamento?: FormaPagamento[] | null;
  inclui_alimentacao?: boolean;
  inclui_hospedagem?: boolean;
  inclui_brinde?: boolean;
  brinde_habilitado?: boolean;
  brinde_distribuicao?: BrindeDistribuicao;
  brinde_quantidade?: number | null;
  inclui_certificado?: boolean;
  certificado_habilitado?: boolean;
  certificado_modelo_id?: string | null;
  status: StatusEvento;
  slug: string | null;
  vagas_hospedagem?: number | null;
  descricao_hospedagem?: string | null;
  programacao?: string | null;
  criado_por: string | null;
  created_at: string;
  congregacao_nome?: string;
  total_inscritos?: number;
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
  com_hospedagem?: boolean;
  status_hospedagem?: StatusHospedagem;
  confirmado_em?: string | null;
  tem_brinde?: boolean;
  brinde_entregue?: boolean;
  brinde_entregue_em?: string | null;
  brinde_entregue_por?: string | null;
  certificado_emitido?: boolean;
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

interface UserScope {
  canWrite: boolean;
  canDelete: boolean;
  canFinanceiro: boolean;
}

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
  evento_pago: boolean;
  valor_inscricao: string;
  formas_pagamento: FormaPagamento[];
  inclui_alimentacao: boolean;
  inclui_hospedagem: boolean;
  inclui_brinde: boolean;
  brinde_distribuicao: BrindeDistribuicao;
  brinde_quantidade: string;
  inclui_certificado: boolean;
  certificado_modelo_id: string;
  status: StatusEvento;
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

const TIPOS_EVENTO: { value: TipoEvento; label: string; badgeClass: string }[] = [
  { value: 'culto_especial', label: 'Culto', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70' },
  { value: 'congresso',      label: 'Congresso', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/70' },
  { value: 'conferencia',    label: 'Conferência', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70' },
  { value: 'palestra',       label: 'Palestra', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200/70' },
  { value: 'retiro',         label: 'Retiro', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70' },
  { value: 'evangelismo',    label: 'Vigília', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/70' },
  { value: 'treinamento',    label: 'EBD', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/70' },
  { value: 'social',         label: 'Reunião', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70' },
  { value: 'outro',          label: 'Outro', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
];

const STATUS_EVENTO: {
  value: StatusEvento;
  label: string;
  pillClass: string;
  dotClass: string;
}[] = [
  { value: 'programado',   label: 'Programado',   pillClass: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/70', dotClass: 'bg-emerald-500' },
  { value: 'em_andamento', label: 'Em Andamento', pillClass: 'bg-blue-50/90 text-blue-700 border-blue-200/70',       dotClass: 'bg-blue-500' },
  { value: 'realizado',    label: 'Realizado',    pillClass: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/70', dotClass: 'bg-emerald-500' },
  { value: 'cancelado',    label: 'Cancelado',    pillClass: 'bg-rose-50/90 text-rose-700 border-rose-200/70',       dotClass: 'bg-rose-500' },
];

const STATUS_INSCRICAO: { value: StatusInscricao; label: string; cor: string }[] = [
  { value: 'confirmado',           label: 'Confirmado',        cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'cancelado',            label: 'Cancelado',         cor: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'lista_espera',         label: 'Lista de Espera',   cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'aguardando_pagamento', label: 'Aguard. Pagamento', cor: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'expirado',             label: 'Expirado',          cor: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const STATUS_HOSPEDAGEM: { value: StatusHospedagem; label: string; cor: string }[] = [
  { value: 'nao_aplicavel', label: 'N/A',        cor: 'bg-slate-100 text-slate-500' },
  { value: 'solicitada',    label: 'Solicitada', cor: 'bg-blue-50 text-blue-700 border border-blue-200' },
  { value: 'confirmada',    label: 'Confirmada', cor: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  { value: 'lista_espera',  label: 'Fila',       cor: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { value: 'cancelada',     label: 'Cancelada',  cor: 'bg-rose-50 text-rose-700 border border-rose-200' },
];

const STATUS_PAGAMENTO: Record<string, { label: string; cor: string }> = {
  pendente:  { label: 'Pendente',  cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  pago:      { label: 'Pago',      cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelado: { label: 'Cancelado', cor: 'bg-rose-50 text-rose-700 border-rose-200' },
  expirado:  { label: 'Expirado',  cor: 'bg-slate-100 text-slate-500 border-slate-200' },
  estornado: { label: 'Estornado', cor: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const FORMAS_PAGAMENTO_OPTIONS: { value: FormaPagamento; label: string }[] = [
  { value: 'a_vista',  label: 'À vista' },
  { value: 'pix',      label: 'Pix' },
  { value: 'boleto',   label: 'Boleto' },
  { value: 'cortesia', label: 'Cortesia' },
];

const BENEFICIOS_OPTIONS = [
  { key: 'inclui_alimentacao', label: 'Alimentação' },
  { key: 'inclui_hospedagem',   label: 'Hospedagem' },
  { key: 'inclui_brinde',       label: 'Brinde' },
  { key: 'inclui_certificado',  label: 'Certificado' },
] as const;

function getBeneficiosLabels(e: {
  inclui_alimentacao?: boolean;
  inclui_hospedagem?: boolean;
  inclui_brinde?: boolean;
  inclui_certificado?: boolean;
}): string[] {
  const list: string[] = [];
  if (e.inclui_alimentacao) list.push('Alimentação');
  if (e.inclui_hospedagem) list.push('Hospedagem');
  if (e.inclui_brinde) list.push('Brinde');
  if (e.inclui_certificado) list.push('Certificado');
  return list;
}

function getFormasPagamentoLabels(formas?: string[] | null): string[] {
  if (!formas || !Array.isArray(formas) || formas.length === 0) return [];
  const map: Record<string, string> = {
    a_vista: 'À vista',
    pix: 'Pix',
    boleto: 'Boleto',
    cortesia: 'Cortesia',
  };
  return formas.map(f => map[f] ?? f);
}

const parseCurrencyValue = (val: string): number => {
  if (!val) return 0;
  const clean = val.replace(/[^\d,]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const formatCurrencyInput = (val: string): string => {
  const digitsOnly = val.replace(/\D/g, '');
  if (!digitsOnly) return '0,00';
  const num = parseInt(digitsOnly, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const FORM_EVENTO_INICIAL: FormEvento = {
  congregacao_id: '',
  titulo: '',
  descricao: '',
  tipo: 'culto_especial',
  data_inicio: '',
  data_fim: '',
  local_nome: '',
  local_endereco: '',
  capacidade: '',
  is_publico: true,
  aceita_inscricao: false,
  evento_pago: false,
  valor_inscricao: '0,00',
  formas_pagamento: [],
  inclui_alimentacao: false,
  inclui_hospedagem: false,
  inclui_brinde: false,
  brinde_distribuicao: 'todos',
  brinde_quantidade: '',
  inclui_certificado: false,
  certificado_modelo_id: '',
  status: 'programado',
  vagas_hospedagem: '',
  descricao_hospedagem: '',
  programacao: '',
};

const FORM_INSCRICAO_INICIAL: FormInscricao = {
  member_id: '',
  nome_externo: '',
  email_externo: '',
  telefone: '',
  status: 'confirmado',
  observacoes: '',
  com_hospedagem: false,
};

// ─── Helpers de Formatação e Data ─────────────────────────────────────────────

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  const parts = s.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(s).toLocaleDateString('pt-BR');
};

const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const parseDateParts = (s: string | null | undefined) => {
  if (!s) return { day: '--', month: '---', year: '----', time: '--:--' };
  const d = new Date(s);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  const year = String(d.getFullYear());
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { day, month, year, time };
};

const fmtBRL = (v: number) =>
  v === 0 ? 'Gratuito' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mesAtualEvento = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (mes: string) => {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return 'Todos os períodos';
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const monthName = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${y}`;
};

const mesAnteriorEvento = (mes: string): string => {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return mesAtualEvento();
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const mesProximoEvento = (mes: string): string => {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return mesAtualEvento();
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const statusEventoInfo = (s: StatusEvento) =>
  STATUS_EVENTO.find(x => x.value === s) ?? {
    value: s,
    label: s,
    pillClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  };

const tipoInfo = (t: TipoEvento) =>
  TIPOS_EVENTO.find(x => x.value === t) ?? {
    value: t,
    label: t,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  };

const statusInscricaoCor = (s: StatusInscricao) =>
  STATUS_INSCRICAO.find(x => x.value === s)?.cor ?? 'bg-slate-100 text-slate-600';
const statusInscricaoLabel = (s: StatusInscricao) =>
  STATUS_INSCRICAO.find(x => x.value === s)?.label ?? s;
const statusHospLabel = (s: StatusHospedagem | undefined) =>
  STATUS_HOSPEDAGEM.find(x => x.value === s)?.label ?? 'N/A';
const statusHospCor = (s: StatusHospedagem | undefined) =>
  STATUS_HOSPEDAGEM.find(x => x.value === s)?.cor ?? 'bg-slate-100 text-slate-400';

const exportarCSVInscricoes = (inscricoes: Inscricao[], tituloEvento: string) => {
  const header = [
    'Nome',
    'E-mail',
    'Telefone',
    'Status',
    'Presente',
    'Check-in',
    'Hospedagem',
    'Status Hospedagem',
    'Observações',
  ];
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inscricoes_${tituloEvento.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function EventosPage() {
  const { user } = useRequireSupabaseAuth();
  const { ctx, bloqueado } = useRequireModulo('eventos');
  const userCtx = useUserContext();
  const planFeatures = usePlanFeatures();
  const router = useRouter();
  const supabase = createClient();

  // Guard de plano: módulo Eventos exclusivo
  useEffect(() => {
    if (!planFeatures.loading && !planFeatures.has_modulo_eventos) {
      router.replace('/acesso-negado');
    }
  }, [planFeatures.loading, planFeatures.has_modulo_eventos, router]);

  // ── Estado global ─────────────────────────────────────────────────────────
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [scope, setScope] = useState<UserScope>({ canWrite: false, canDelete: false, canFinanceiro: false });
  const [loadingData, setLoadingData] = useState(true);

  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ open: false, title: '', message: '', type: 'success' });

  const showModal = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => setModal({ open: true, title, message, type });

  // ── Abas e Modo de Visualização ───────────────────────────────────────────
  const [aba, setAba] = useState<AbaEvento>('eventos');
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
  const [eventoVisualizando, setEventoVisualizando] = useState<Evento | null>(null);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  // ── Tab Eventos: Filtros Operacionais ──────────────────────────────────────
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<TipoPeriodo>('todos');
  const [filtroMesCustom, setFiltroMesCustom] = useState(mesAtualEvento());
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusEvento>('');
  const [filtroCongEv, setFiltroCongEv] = useState('');
  const [buscaEv, setBuscaEv] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEvento, setFormEvento] = useState<FormEvento>(FORM_EVENTO_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [templatesCertificados, setTemplatesCertificados] = useState<{ id: string; nome: string }[]>([]);
  const [certTemplatesFull, setCertTemplatesFull] = useState<any[]>([]);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja>({
    nome: '',
    endereco: '',
    cnpj: '',
    telefone: '',
    email: '',
    website: '',
    descricao: '',
    responsavel: '',
    logo: '',
  });

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(10);

  // Global KPI totals across ministry
  const [totaisGlobais, setTotaisGlobais] = useState<{
    programado: number;
    em_andamento: number;
    realizado: number;
    cancelado: number;
    total: number;
    noMes: number;
  }>({ programado: 0, em_andamento: 0, realizado: 0, cancelado: 0, total: 0, noMes: 0 });

  // ── Tab Inscrições ────────────────────────────────────────────────────────
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [loadingInsc, setLoadingInsc] = useState(false);
  const [buscaInsc, setBuscaInsc] = useState('');
  const [filtroStatusInsc, setFiltroStatusInsc] = useState<'' | StatusInscricao>('');
  const [showFormInsc, setShowFormInsc] = useState(false);
  const [formInsc, setFormInsc] = useState<FormInscricao>(FORM_INSCRICAO_INICIAL);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [resultadosMembro, setResultadosMembro] = useState<Membro[]>([]);
  const [membroSelecionado, setMembroSelecionado] = useState<Membro | null>(null);

  // ── Tab Pagamentos ────────────────────────────────────────────────────────
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loadingPag, setLoadingPag] = useState(false);

  // ── Tab Check-in ──────────────────────────────────────────────────────────
  const [buscaCheckin, setBuscaCheckin] = useState('');

  // ── Fechar menu dropdown ao clicar fora ────────────────────────────────────
  useEffect(() => {
    const fecharMenu = () => setMenuAbertoId(null);
    window.addEventListener('click', fecharMenu);
    return () => window.removeEventListener('click', fecharMenu);
  }, []);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || ctx.loading) return;
    (async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      if (!mid) {
        setLoadingData(false);
        return;
      }
      setMinistryId(mid);

      const [orgService, { data: mu }] = await Promise.all([
        obterEstruturaOrganizacionalService(mid, supabase),
        supabase
          .from('ministry_users')
          .select('permissions, role')
          .eq('user_id', user.id)
          .eq('ministry_id', mid)
          .single(),
      ]);

      const div1Options = orgService.getOptionsFormatadas(1);
      setCongregacoes(div1Options.map(opt => ({ id: opt.id, nome: opt.nome })));

      const perms = ((mu as { permissions?: string[] } | null)?.permissions ?? []);
      const role = ((mu as { role?: string } | null)?.role ?? '');
      const isAdmin = userCtx.isAdmin || perms.includes('ADMINISTRADOR') || role === 'admin';
      const isSecret = perms.includes('SECRETARIO');
      const isFinanc = perms.includes('FINANCEIRO');
      setScope({
        canWrite: isAdmin || isSecret,
        canDelete: isAdmin,
        canFinanceiro: isAdmin || isFinanc,
      });

      // Carregar configurações institucionais e modelos de certificados disponíveis para o tenant
      try {
        const [config, certRes] = await Promise.all([
          fetchConfiguracaoIgrejaFromSupabase(supabase, mid),
          loadCertificadosTemplatesForCurrentUser(supabase),
        ]);
        if (config) setConfigIgreja(config);

        const certList = certRes?.templates || [];
        setCertTemplatesFull(certList);
        if (Array.isArray(certList)) {
          // Filtrar modelos de categoria 'eventos' / 'evento' ou permitir todos os modelos do ministério
          const templatesEvento = certList.filter(
            (t: any) => t.categoria === 'eventos' || t.categoria === 'evento' || !t.categoria
          );
          const listaFinal = templatesEvento.length > 0 ? templatesEvento : certList;
          setTemplatesCertificados(
            listaFinal.map((t: any) => ({
              id: t.template_key || t.id,
              nome: t.nome || t.name,
            }))
          );
        }
      } catch (err) {
        console.warn('Erro ao carregar configurações/templates de certificados:', err);
      }

      setLoadingData(false);
    })();
  }, [user, ctx.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carregar KPIs Globais ──────────────────────────────────────────────────
  const carregarTotaisGlobais = useCallback(async () => {
    if (!ministryId) return;
    const mesAtual = mesAtualEvento();
    const proxMes = mesProximoEvento(mesAtual);

    const { data, error } = await supabase
      .from('eventos')
      .select('status, data_inicio')
      .eq('ministry_id', ministryId);

    if (!error && data) {
      const items = data as { status: StatusEvento; data_inicio: string }[];
      const prog = items.filter(e => e.status === 'programado').length;
      const andam = items.filter(e => e.status === 'em_andamento').length;
      const real = items.filter(e => e.status === 'realizado').length;
      const canc = items.filter(e => e.status === 'cancelado').length;
      const noMes = items.filter(
        e => e.data_inicio >= `${mesAtual}-01T00:00:00` && e.data_inicio < `${proxMes}-01T00:00:00`
      ).length;

      setTotaisGlobais({
        programado: prog,
        em_andamento: andam,
        realizado: real,
        cancelado: canc,
        total: items.length,
        noMes,
      });
    }
  }, [ministryId, supabase]);

  // ── Carregar Eventos (Agenda Operacional & Filtros de Período) ──────────────
  const carregarEventos = useCallback(
    async (
      periodo: TipoPeriodo,
      mesCustom: string,
      status: string,
      cong: string,
      busca: string
    ) => {
      if (!ministryId) return;
      setLoadingEventos(true);
      const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));

      let q = supabase
        .from('eventos')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('data_inicio', { ascending: true });

      const hoje = new Date();
      const hojeStr = hoje.toISOString().split('T')[0];
      const hojeInicio = `${hojeStr}T00:00:00`;

      // Aplicação dos Períodos
      if (periodo === 'todos') {
        // Regra 1: Agenda padrão operacional
        // Exibe eventos futuros (data_inicio >= hoje) ou eventos em andamento
        if (!status) {
          q = q.or(`data_inicio.gte.${hojeInicio},status.eq.em_andamento`);
          q = q.neq('status', 'cancelado').neq('status', 'realizado');
        } else {
          q = q.gte('data_inicio', hojeInicio);
        }
      } else if (periodo === 'este_mes') {
        const y = hoje.getFullYear();
        const m = String(hoje.getMonth() + 1).padStart(2, '0');
        const proxDate = new Date(y, hoje.getMonth() + 1, 1);
        const py = proxDate.getFullYear();
        const pm = String(proxDate.getMonth() + 1).padStart(2, '0');
        q = q.gte('data_inicio', `${y}-${m}-01T00:00:00`).lt('data_inicio', `${py}-${pm}-01T00:00:00`);
      } else if (periodo === 'proximo_mes') {
        const proxDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
        const y = proxDate.getFullYear();
        const m = String(proxDate.getMonth() + 1).padStart(2, '0');
        const aposProxDate = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 1);
        const py = aposProxDate.getFullYear();
        const pm = String(aposProxDate.getMonth() + 1).padStart(2, '0');
        q = q.gte('data_inicio', `${y}-${m}-01T00:00:00`).lt('data_inicio', `${py}-${pm}-01T00:00:00`);
      } else if (periodo === 'proximos_30') {
        const d30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
        const d30Str = d30.toISOString().split('T')[0];
        q = q.gte('data_inicio', hojeInicio).lte('data_inicio', `${d30Str}T23:59:59`);
      } else if (periodo === 'proximos_90') {
        const d90 = new Date(hoje.getTime() + 90 * 24 * 60 * 60 * 1000);
        const d90Str = d90.toISOString().split('T')[0];
        q = q.gte('data_inicio', hojeInicio).lte('data_inicio', `${d90Str}T23:59:59`);
      } else if (periodo === 'mes_especifico' && mesCustom && /^\d{4}-\d{2}$/.test(mesCustom)) {
        const prox = mesProximoEvento(mesCustom);
        q = q.gte('data_inicio', `${mesCustom}-01T00:00:00`).lt('data_inicio', `${prox}-01T00:00:00`);
      } else if (periodo === 'historico_completo') {
        // Sem restrição de data
      }

      if (status) q = q.eq('status', status);
      if (cong) q = q.eq('congregacao_id', cong);

      const { data, error } = await q;
      if (error) {
        showModal('Erro ao carregar eventos', error.message, 'error');
        setLoadingEventos(false);
        return;
      }

      let list = (data ?? []) as Evento[];

      if (busca.trim()) {
        const t = busca.toLowerCase();
        list = list.filter(
          e =>
            e.titulo.toLowerCase().includes(t) ||
            (e.descricao ?? '').toLowerCase().includes(t) ||
            (e.local_nome ?? '').toLowerCase().includes(t)
        );
      }

      if (list.length > 0) {
        const eventIds = list.map(e => e.id);
        const { data: inscricoesData } = await supabase
          .from('eventos_inscricoes')
          .select('evento_id')
          .in('evento_id', eventIds)
          .eq('status', 'confirmado');

        const inscritosCountMap: Record<string, number> = {};
        if (inscricoesData) {
          inscricoesData.forEach((i: { evento_id: string }) => {
            inscritosCountMap[i.evento_id] = (inscritosCountMap[i.evento_id] || 0) + 1;
          });
        }

        setEventos(
          list.map(e => ({
            ...e,
            congregacao_nome: e.congregacao_id
              ? congMap.get(e.congregacao_id) ?? 'Sede'
              : 'Templo Sede',
            total_inscritos: inscritosCountMap[e.id] || 0,
          }))
        );
      } else {
        setEventos([]);
      }

      setLoadingEventos(false);
      carregarTotaisGlobais();
    },
    [ministryId, supabase, congregacoes, carregarTotaisGlobais]
  );

  useEffect(() => {
    if (!ministryId || loadingData) return;
    carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv);
  }, [filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv, ministryId, loadingData, carregarEventos]);

  // ── Carregar inscrições ────────────────────────────────────────────────────
  const carregarInscricoes = useCallback(
    async (eventoId: string) => {
      setLoadingInsc(true);
      const { data, error } = await supabase
        .from('eventos_inscricoes')
        .select('*, members(nome_completo)')
        .eq('evento_id', eventoId)
        .order('created_at', { ascending: false });

      if (error) {
        showModal('Erro', error.message, 'error');
        setLoadingInsc(false);
        return;
      }

      type RawInsc = Inscricao & { members?: { nome_completo: string } | null };
      setInscricoes(
        ((data ?? []) as RawInsc[]).map(i => ({
          ...i,
          nome_display: i.member_id ? i.members?.nome_completo ?? '—' : i.nome_externo ?? '—',
        }))
      );
      setLoadingInsc(false);
    },
    [supabase]
  );

  useEffect(() => {
    const needsInscricoes = ['inscricoes', 'checkin', 'relatorios'].includes(aba);
    if (needsInscricoes && eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  }, [aba, eventoSelecionado, carregarInscricoes]);

  // ── Carregar pagamentos ────────────────────────────────────────────────────
  const carregarPagamentos = useCallback(
    async (eventoId: string) => {
      setLoadingPag(true);
      const { data, error } = await supabase
        .from('eventos_pagamentos')
        .select(
          'id,gateway,gateway_charge_id,payment_method,valor,status,pix_payload,invoice_url,expires_at,paid_at,created_at,inscricao_id'
        )
        .eq('evento_id', eventoId)
        .order('created_at', { ascending: false });

      if (error) {
        showModal('Erro', error.message, 'error');
        setLoadingPag(false);
        return;
      }
      setPagamentos((data ?? []) as Pagamento[]);
      setLoadingPag(false);
    },
    [supabase]
  );

  useEffect(() => {
    if (aba === 'pagamentos' && eventoSelecionado) carregarPagamentos(eventoSelecionado.id);
  }, [aba, eventoSelecionado, carregarPagamentos]);

  // ── Buscar membros ─────────────────────────────────────────────────────────
  const buscarMembro = useCallback(
    async (q: string) => {
      if (!ministryId || q.length < 3) {
        setResultadosMembro([]);
        return;
      }
      const { data } = await supabase
        .from('members')
        .select('id, nome_completo')
        .eq('ministry_id', ministryId)
        .ilike('nome_completo', `%${q}%`)
        .limit(8);
      setResultadosMembro((data ?? []) as Membro[]);
    },
    [ministryId, supabase]
  );

  useEffect(() => {
    buscarMembro(buscaMembro);
  }, [buscaMembro, buscarMembro]);

  // ── Memos & Paginação ──────────────────────────────────────────────────────
  const insPorStatus = useMemo(
    () => ({
      total: inscricoes.length,
      confirmados: inscricoes.filter(i => i.status === 'confirmado').length,
      presentes: inscricoes.filter(i => i.presente).length,
      listaEspera: inscricoes.filter(i => i.status === 'lista_espera').length,
      cancelados: inscricoes.filter(i => i.status === 'cancelado').length,
      hospedagem: inscricoes.filter(i => i.com_hospedagem).length,
    }),
    [inscricoes]
  );

  const inscricoesFiltradas = useMemo(() => {
    let list = inscricoes;
    if (filtroStatusInsc) list = list.filter(i => i.status === filtroStatusInsc);
    if (buscaInsc) {
      const t = buscaInsc.toLowerCase();
      list = list.filter(
        i =>
          (i.nome_display ?? '').toLowerCase().includes(t) ||
          (i.email_externo ?? '').toLowerCase().includes(t) ||
          (i.telefone ?? '').toLowerCase().includes(t)
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
    return inscricoes.filter(
      i =>
        (i.nome_display ?? '').toLowerCase().includes(t) ||
        (i.email_externo ?? '').toLowerCase().includes(t)
    );
  }, [inscricoes, buscaCheckin]);

  const totalPaginas = Math.ceil(eventos.length / itensPorPagina) || 1;
  const eventosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return eventos.slice(inicio, inicio + itensPorPagina);
  }, [eventos, paginaAtual, itensPorPagina]);

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

  // ── Salvar evento (visão operacional contínua) ─────────────────────────────
  const handleSaveEvento = async () => {
    if (!ministryId || !formEvento.titulo.trim() || !formEvento.data_inicio) {
      showModal('Campo obrigatório', 'Preencha o título e a data/hora de início.', 'error');
      return;
    }

    let valorFinal = 0;
    let formasFinal: FormaPagamento[] = [];

    if (formEvento.evento_pago) {
      valorFinal = parseCurrencyValue(formEvento.valor_inscricao);
      if (valorFinal <= 0) {
        showModal('Valor obrigatório', 'Para eventos pagos, informe um valor de inscrição maior que R$ 0,00.', 'error');
        return;
      }
      if (formEvento.formas_pagamento.length === 0) {
        showModal('Formas de pagamento', 'Selecione ao menos uma forma de pagamento aceita para o evento pago.', 'error');
        return;
      }
      formasFinal = formEvento.formas_pagamento;
    } else {
      valorFinal = 0;
      formasFinal = [];
    }

    // Validação de Brinde com Quantidade Limitada
    let brindeQtdFinal: number | null = null;
    if (formEvento.inclui_brinde) {
      if (formEvento.brinde_distribuicao === 'quantidade_limitada') {
        const qtd = parseInt(formEvento.brinde_quantidade, 10);
        if (isNaN(qtd) || qtd <= 0) {
          showModal('Quantidade de brindes', 'Informe uma quantidade válida e maior que zero para a distribuição de brindes.', 'error');
          return;
        }

        // Validação ao editar evento com inscrições já concedidas
        if (editandoId) {
          const { count: brindesConcedidos } = await supabase
            .from('eventos_inscricoes')
            .select('id', { count: 'exact', head: true })
            .eq('evento_id', editandoId)
            .eq('status', 'confirmado')
            .eq('tem_brinde', true);

          if (brindesConcedidos != null && qtd < brindesConcedidos) {
            showModal(
              'Quantidade inválida',
              `Já existem ${brindesConcedidos} inscrições com direito ao brinde. A quantidade informada não pode ser inferior aos benefícios já concedidos.`,
              'error'
            );
            return;
          }
        }
        brindeQtdFinal = qtd;
      }
    }

    // Modelo de Certificado
    let modeloCertId = formEvento.certificado_modelo_id;
    if (formEvento.inclui_certificado && !modeloCertId && templatesCertificados.length > 0) {
      modeloCertId = templatesCertificados[0].id;
    }

    setSalvando(true);

    const payload = {
      ministry_id: ministryId,
      congregacao_id: formEvento.congregacao_id || null,
      titulo: formEvento.titulo.trim(),
      descricao: formEvento.descricao || null,
      tipo: formEvento.tipo,
      data_inicio: formEvento.data_inicio,
      data_fim: formEvento.data_fim || null,
      local_nome: formEvento.local_nome || null,
      local_endereco: formEvento.local_endereco || null,
      capacidade: formEvento.capacidade ? parseInt(formEvento.capacidade) : null,
      is_publico: formEvento.is_publico,
      aceita_inscricao: formEvento.aceita_inscricao,
      evento_pago: formEvento.evento_pago,
      valor_inscricao: valorFinal,
      formas_pagamento: formasFinal,
      inclui_alimentacao: formEvento.inclui_alimentacao,
      inclui_hospedagem: formEvento.inclui_hospedagem,
      inclui_brinde: formEvento.inclui_brinde,
      brinde_habilitado: formEvento.inclui_brinde,
      brinde_distribuicao: formEvento.inclui_brinde ? formEvento.brinde_distribuicao : 'todos',
      brinde_quantidade: formEvento.inclui_brinde && formEvento.brinde_distribuicao === 'quantidade_limitada' ? brindeQtdFinal : null,
      inclui_certificado: formEvento.inclui_certificado,
      certificado_habilitado: formEvento.inclui_certificado,
      certificado_modelo_id: formEvento.inclui_certificado ? (modeloCertId || null) : null,
      status: formEvento.status,
      vagas_hospedagem: formEvento.inclui_hospedagem && formEvento.vagas_hospedagem ? parseInt(formEvento.vagas_hospedagem) : null,
      descricao_hospedagem: formEvento.inclui_hospedagem ? (formEvento.descricao_hospedagem || null) : null,
      programacao: formEvento.programacao || null,
      criado_por: user?.id ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = editandoId
      ? await supabase.from('eventos').update(payload).eq('id', editandoId)
      : await supabase.from('eventos').insert(payload);

    setSalvando(false);

    if (error) {
      showModal('Erro ao salvar evento', error.message, 'error');
      return;
    }

    setShowForm(false);
    setEditandoId(null);
    setFormEvento(FORM_EVENTO_INICIAL);
    setBuscaEv('');
    setPaginaAtual(1);

    showModal('Sucesso', editandoId ? 'Evento atualizado com sucesso.' : 'Evento criado com sucesso!', 'success');

    // Recarrega a agenda operacional com a ordenação cronológica
    await carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, '');
  };

  const handleEditEvento = (e: Evento) => {
    setEditandoId(e.id);
    const isPago = Boolean(e.evento_pago || (e.valor_inscricao && e.valor_inscricao > 0));
    const valorStr = (e.valor_inscricao ?? 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const brindeHab = Boolean(e.brinde_habilitado ?? e.inclui_brinde);
    const certHab = Boolean(e.certificado_habilitado ?? e.inclui_certificado);

    setFormEvento({
      congregacao_id: e.congregacao_id ?? '',
      titulo: e.titulo,
      descricao: e.descricao ?? '',
      tipo: e.tipo,
      data_inicio: e.data_inicio.slice(0, 16),
      data_fim: e.data_fim ? e.data_fim.slice(0, 16) : '',
      local_nome: e.local_nome ?? '',
      local_endereco: e.local_endereco ?? '',
      capacidade: e.capacidade?.toString() ?? '',
      is_publico: e.is_publico,
      aceita_inscricao: e.aceita_inscricao,
      evento_pago: isPago,
      valor_inscricao: valorStr,
      formas_pagamento: (e.formas_pagamento as FormaPagamento[]) ?? [],
      inclui_alimentacao: Boolean(e.inclui_alimentacao),
      inclui_hospedagem: Boolean(e.inclui_hospedagem),
      inclui_brinde: brindeHab,
      brinde_distribuicao: (e.brinde_distribuicao as BrindeDistribuicao) ?? 'todos',
      brinde_quantidade: e.brinde_quantidade?.toString() ?? '',
      inclui_certificado: certHab,
      certificado_modelo_id: e.certificado_modelo_id ?? '',
      status: e.status,
      vagas_hospedagem: e.vagas_hospedagem?.toString() ?? '',
      descricao_hospedagem: e.descricao_hospedagem ?? '',
      programacao: e.programacao ?? '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEvento = async (id: string) => {
    if (!confirm('Deseja realmente excluir este evento? Todas as inscrições associadas serão removidas.')) return;
    const { error } = await supabase.from('eventos').delete().eq('id', id);
    if (error) {
      showModal('Erro', error.message, 'error');
      return;
    }
    showModal('Evento excluído', 'O evento foi removido com sucesso.', 'info');
    if (eventoSelecionado?.id === id) {
      setEventoSelecionado(null);
      setAba('eventos');
    }
    carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv);
  };

  // ── Inscrições ─────────────────────────────────────────────────────────────
  const handleSaveInscricao = async () => {
    if (!ministryId || !eventoSelecionado) return;
    const temMembro = !!membroSelecionado;
    const temExterno = !!formInsc.nome_externo.trim();
    if (!temMembro && !temExterno) {
      showModal('Campo obrigatório', 'Selecione um membro ou informe o nome do participante.', 'error');
      return;
    }

    let statusFinal = formInsc.status;
    if (statusFinal === 'confirmado' && eventoSelecionado.capacidade != null) {
      const { count } = await supabase
        .from('eventos_inscricoes')
        .select('id', { count: 'exact', head: true })
        .eq('evento_id', eventoSelecionado.id)
        .eq('status', 'confirmado');
      if ((count ?? 0) >= eventoSelecionado.capacidade) {
        showModal(
          'Vagas preenchidas',
          `Limite de ${eventoSelecionado.capacidade} vagas atingido. A inscrição será colocada em lista de espera.`,
          'info'
        );
        statusFinal = 'lista_espera';
      }
    }

    const { error } = await supabase.from('eventos_inscricoes').insert({
      evento_id: eventoSelecionado.id,
      ministry_id: ministryId,
      member_id: membroSelecionado?.id ?? null,
      nome_externo: temExterno ? formInsc.nome_externo.trim() : null,
      email_externo: formInsc.email_externo || null,
      telefone: formInsc.telefone || null,
      status: statusFinal,
      observacoes: formInsc.observacoes || null,
      com_hospedagem: formInsc.com_hospedagem,
      status_hospedagem: formInsc.com_hospedagem ? 'solicitada' : 'nao_aplicavel',
      criado_por: user?.id ?? null,
    });

    if (error) {
      showModal('Erro', error.code === '23505' ? 'Este membro já está inscrito neste evento.' : error.message, 'error');
      return;
    }
    showModal('Sucesso', 'Inscrição realizada com sucesso.', 'success');
    setShowFormInsc(false);
    setFormInsc(FORM_INSCRICAO_INICIAL);
    setMembroSelecionado(null);
    setBuscaMembro('');
    carregarInscricoes(eventoSelecionado.id);
  };

  const handleDeleteInscricao = async (id: string) => {
    if (!confirm('Deseja remover esta inscrição?')) return;
    const { error } = await supabase.from('eventos_inscricoes').delete().eq('id', id);
    if (error) {
      showModal('Erro', error.message, 'error');
      return;
    }
    if (eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  };

  const handleCheckin = async (insc: Inscricao) => {
    const presente = !insc.presente;
    const { error } = await supabase
      .from('eventos_inscricoes')
      .update({
        presente,
        checkin_em: presente ? new Date().toISOString() : null,
        checkin_por: presente ? user?.id ?? null : null,
      })
      .eq('id', insc.id);
    if (error) {
      showModal('Erro', error.message, 'error');
      return;
    }
    if (eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  };

  const handleToggleBrindeEntregue = async (insc: Inscricao) => {
    const entregue = !insc.brinde_entregue;
    const { error } = await supabase
      .from('eventos_inscricoes')
      .update({
        brinde_entregue: entregue,
        brinde_entregue_em: entregue ? new Date().toISOString() : null,
        brinde_entregue_por: entregue ? user?.id ?? null : null,
      })
      .eq('id', insc.id);
    if (error) {
      showModal('Erro', error.message, 'error');
      return;
    }
    if (eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  };

  const handleStatusHospedagem = async (insc: Inscricao, status: StatusHospedagem) => {
    const { error } = await supabase
      .from('eventos_inscricoes')
      .update({ status_hospedagem: status })
      .eq('id', insc.id);
    if (error) {
      showModal('Erro', error.message, 'error');
      return;
    }
    if (eventoSelecionado) carregarInscricoes(eventoSelecionado.id);
  };

  const buildEventoPlaceholderMap = (evento: Evento, insc: Inscricao) => ({
    participante_nome: insc.nome_display || '',
    evento_nome: evento.titulo || '',
    evento_titulo: evento.titulo || '',
    evento_tipo: tipoInfo(evento.tipo).label,
    tipo_evento: tipoInfo(evento.tipo).label,
    evento_data: fmtDateTime(evento.data_inicio),
    data_evento: fmtDateTime(evento.data_inicio),
    evento_data_inicio: fmtDateTime(evento.data_inicio),
    evento_data_fim: evento.data_fim ? fmtDateTime(evento.data_fim) : '',
    evento_local: evento.local_nome || evento.local_endereco || '',
    local_evento: evento.local_nome || '',
    evento_congregacao: evento.congregacao_nome || 'Templo Sede',
    congregacao: evento.congregacao_nome || 'Templo Sede',
    evento_descricao: evento.descricao || '',
    evento_carga_horaria: '',
    carga_horaria: '',
    responsavel_evento: configIgreja.responsavel || '',
    pastor_nome: configIgreja.responsavel || '',
    ministerio_nome: configIgreja.nome || 'Igreja',
    nome_igreja: configIgreja.nome || 'Igreja',
    ministerio_cnpj: configIgreja.cnpj || '',
    cidade: configIgreja.endereco ? configIgreja.endereco.split('-')[0]?.trim() : '',
    estado: '',
    evento_protocolo: insc.id ? insc.id.substring(0, 8).toUpperCase() : '',
    data_emissao: new Date().toLocaleDateString('pt-BR'),
  });

  const renderCertificadoHtml = (template: any, map: Record<string, string>) => {
    const orientacao = template.orientacao === 'portrait' ? 'portrait' : 'landscape';
    const largura = orientacao === 'portrait' ? 595 : 840;
    const altura = orientacao === 'portrait' ? 840 : 595;

    const bgHtml = template.backgroundUrl
      ? `<img src="${template.backgroundUrl}" style="position:absolute;left:0;top:0;width:${largura}px;height:${altura}px;object-fit:fill;display:block;" />`
      : '';

    const elementsHtml = (template.elementos || [])
      .filter((el: any) => el.visivel !== false)
      .map((el: any) => {
        const baseStyle = `position:absolute; left:${el.x}px; top:${el.y}px; width:${el.largura}px; height:${el.altura}px;`;
        if (el.tipo === 'texto') {
          const texto = substituirPlaceholdersCertificado(el.texto || '', map, template.categoria || 'eventos').replace(/\n/g, '<br />');
          const style = [
            baseStyle,
            `font-size:${el.fontSize || 14}px;`,
            `font-family:${el.fonte || 'Arial'};`,
            `font-weight:${el.negrito ? 700 : 400};`,
            `font-style:${el.italico ? 'italic' : 'normal'};`,
            `text-decoration:${el.sublinhado ? 'underline' : 'none'};`,
            `color:${el.cor || '#111'};`,
            `text-align:${el.alinhamento || 'left'};`,
            'box-sizing:border-box;',
          ].join('');
          return `<div style="${style}">${texto}</div>`;
        }
        if (el.tipo === 'chapa') {
          const style = [baseStyle, `background-color:${el.cor || '#111'};`, `opacity:${el.transparencia ?? 1};`].join('');
          return `<div style="${style}"></div>`;
        }
        if (el.tipo === 'logo' || el.tipo === 'imagem') {
          const src = el.tipo === 'logo' ? (configIgreja.logo || el.imagemUrl || '') : (el.imagemUrl || '');
          if (!src) return '';
          const style = [baseStyle, 'object-fit:contain;', `opacity:${el.transparencia ?? 1};`].join('');
          return `<img src="${src}" style="${style}" />`;
        }
        return '';
      })
      .join('');

    return `<div style="position:relative;width:${largura}px;height:${altura}px;margin:0 auto;overflow:hidden;background:#fff;">${bgHtml}${elementsHtml}</div>`;
  };

  const handleImprimirCertificado = (insc: Inscricao) => {
    if (!eventoSelecionado) return;
    const modeloId = eventoSelecionado.certificado_modelo_id;
    const template = certTemplatesFull.find(t => t.id === modeloId || t.template_key === modeloId) || certTemplatesFull[0];

    if (!template) {
      showModal('Modelo não encontrado', 'Configure um modelo de certificado em Configurações > Certificados.', 'error');
      return;
    }

    const map = buildEventoPlaceholderMap(eventoSelecionado, insc);
    const html = renderCertificadoHtml(template, map);

    const win = window.open('', '_blank');
    if (!win) {
      showModal('Aviso', 'Permita a abertura de pop-ups para imprimir o certificado.', 'info');
      return;
    }
    const scaleX = (277 * 3.7795) / 840;
    const scaleY = (190 * 3.7795) / 595;
    const scale = Math.min(scaleX, scaleY).toFixed(4);

    win.document.write(`<!DOCTYPE html><html><head><title>Certificado - ${insc.nome_display}</title><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:A4 landscape;margin:1cm;}
      html,body{width:100%;height:100%;display:flex;justify-content:center;align-items:center;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      .cert{zoom:${scale};width:840px;height:595px;overflow:hidden;flex-shrink:0;}
      img{display:block;}
    </style></head><body><div class="cert">${html}</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const handleImprimirTodosCertificados = () => {
    if (!eventoSelecionado) return;
    const modeloId = eventoSelecionado.certificado_modelo_id;
    const template = certTemplatesFull.find(t => t.id === modeloId || t.template_key === modeloId) || certTemplatesFull[0];

    if (!template) {
      showModal('Modelo não encontrado', 'Configure um modelo de certificado em Configurações > Certificados.', 'error');
      return;
    }

    const participantesValidos = inscricoes.filter(i => i.status === 'confirmado');
    if (participantesValidos.length === 0) {
      showModal('Nenhum participante', 'Não há participantes confirmados neste evento para emissão de certificados.', 'info');
      return;
    }

    const scaleX = (277 * 3.7795) / 840;
    const scaleY = (190 * 3.7795) / 595;
    const scale = Math.min(scaleX, scaleY).toFixed(4);

    const allPages = participantesValidos.map(insc => {
      const map = buildEventoPlaceholderMap(eventoSelecionado, insc);
      return `<div class="page"><div class="cert">${renderCertificadoHtml(template, map)}</div></div>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) {
      showModal('Aviso', 'Permita a abertura de pop-ups para imprimir os certificados.', 'info');
      return;
    }

    win.document.write(`<!DOCTYPE html><html><head><title>Certificados - ${eventoSelecionado.titulo}</title><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:A4 landscape;margin:1cm;}
      html,body{margin:0;padding:0;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      .page{width:100%;height:100vh;display:flex;justify-content:center;align-items:center;page-break-after:always;}
      .cert{zoom:${scale};width:840px;height:595px;overflow:hidden;flex-shrink:0;}
      img{display:block;}
    </style></head><body>${allPages}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  };

  const copiarLink = (e: Evento) => {
    const url = `${window.location.origin}/eventos/e/${e.slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => showModal('Link copiado!', `O link público foi copiado para a área de transferência: \n${url}`, 'success'))
      .catch(() => showModal('Link público', url, 'info'));
  };

  const exportarTodosEventosCSV = () => {
    if (eventos.length === 0) {
      showModal('Aviso', 'Nenhum evento na listagem para exportar.', 'info');
      return;
    }
    const header = ['Título', 'Tipo', 'Início', 'Fim', 'Local', 'Congregação', 'Capacidade', 'Inscritos', 'Valor', 'Status'];
    const rows = eventos.map(e => [
      e.titulo,
      tipoInfo(e.tipo).label,
      fmtDateTime(e.data_inicio),
      e.data_fim ? fmtDateTime(e.data_fim) : '—',
      e.local_nome ?? '—',
      e.congregacao_nome ?? 'Templo Sede',
      e.capacidade ?? 'Sem limite',
      e.total_inscritos ?? 0,
      fmtBRL(e.valor_inscricao),
      statusEventoInfo(e.status).label,
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c)}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eventos_${filtroPeriodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Guard de Acesso / Loading ───────────────────────────────────────────────
  if (ctx.loading || planFeatures.loading || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-slate-200 border-t-[#0f3460] rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-600 tracking-wide uppercase">Carregando Módulo de Eventos...</span>
        </div>
      </div>
    );
  }

  if (!planFeatures.has_modulo_eventos || !planFeatures.hasFeature('events_module')) {
    return (
      <PageLayout title="Eventos" description="Gestão de eventos, inscrições e check-in" activeMenu="eventos">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto text-purple-600 shadow-sm border border-purple-200/60">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Profissional
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Eventos Indisponível no seu Plano</h2>
          </div>
          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A Gestão de Eventos, inscrições, vendas de ingressos e check-in está disponível exclusivamente no Plano Profissional e superiores.
          </p>
          <div className="pt-3">
            <a
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0f3460] text-white text-sm font-semibold rounded-xl hover:bg-[#16213e] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos
            </a>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (bloqueado) return null;

  // ─── Render Principal ───────────────────────────────────────────────────────

  return (
    <PageLayout title="Eventos" description="Gestão de eventos, inscrições e check-in" activeMenu="eventos">
      <NotificationModal
        isOpen={modal.open}
        onClose={() => setModal(m => ({ ...m, open: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Modal de Visualização Rápida de Detalhes do Evento */}
      {eventoVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0 font-bold">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">{eventoVisualizando.titulo}</h3>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusEventoInfo(eventoVisualizando.status).pillClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusEventoInfo(eventoVisualizando.status).dotClass}`} />
                    {statusEventoInfo(eventoVisualizando.status).label}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEventoVisualizando(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{fmtDateTime(eventoVisualizando.data_inicio)} {eventoVisualizando.data_fim && `às ${fmtDateTime(eventoVisualizando.data_fim)}`}</span>
              </div>
              {eventoVisualizando.local_nome && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{eventoVisualizando.local_nome} {eventoVisualizando.local_endereco && `— ${eventoVisualizando.local_endereco}`}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-slate-400" />
                <span>Congregação: {eventoVisualizando.congregacao_nome ?? 'Templo Sede'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-slate-400" />
                <span>{eventoVisualizando.total_inscritos ?? 0} inscritos {eventoVisualizando.capacidade ? `(Limite: ${eventoVisualizando.capacidade} vagas)` : '(Sem limite)'}</span>
              </div>
            </div>

            {/* Inscrição e Benefícios */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Inscrição:</span>
                {eventoVisualizando.evento_pago || (eventoVisualizando.valor_inscricao && eventoVisualizando.valor_inscricao > 0) ? (
                  <span className="font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                    {fmtBRL(eventoVisualizando.valor_inscricao)}
                  </span>
                ) : (
                  <span className="font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    Gratuito
                  </span>
                )}
              </div>

              {(eventoVisualizando.evento_pago || (eventoVisualizando.valor_inscricao && eventoVisualizando.valor_inscricao > 0)) && (
                <div>
                  <span className="text-slate-500 block mb-0.5">Formas de pagamento aceitas:</span>
                  <span className="font-semibold text-slate-800">
                    {getFormasPagamentoLabels(eventoVisualizando.formas_pagamento).join(' · ') || 'Não especificado'}
                  </span>
                </div>
              )}

              {getBeneficiosLabels(eventoVisualizando).length > 0 && (
                <div>
                  <span className="text-slate-500 block mb-0.5">Benefícios inclusos:</span>
                  <span className="font-semibold text-emerald-800">
                    {getBeneficiosLabels(eventoVisualizando).join(' · ')}
                  </span>
                </div>
              )}
            </div>

            {eventoVisualizando.descricao && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                <p className="font-bold text-slate-900 mb-1">Descrição</p>
                {eventoVisualizando.descricao}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const ev = eventoVisualizando;
                  setEventoVisualizando(null);
                  selecionarEvento(ev, 'inscricoes');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3460] hover:bg-[#162a47] transition shadow-sm"
              >
                Ver Inscrições
              </button>
              <button
                onClick={() => setEventoVisualizando(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-5 pb-12">
        {/* ── 1. CABEÇALHO PADRÃO MOCKUP ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <span className="cursor-pointer hover:text-slate-600">Início</span>
              <span className="text-slate-300">&gt;</span>
              <span className="text-slate-700 font-bold">Eventos</span>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#0f3460] text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
                <CalendarDays className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Eventos</h1>
                <p className="text-xs text-slate-500 font-medium">Gestão de eventos, inscrições e check-in</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            <button
              onClick={() => showModal('Ajuda do Módulo de Eventos', 'Crie eventos com capacidade limitada ou ilimitada, publique links públicos de inscrição, controle hospedagem, realize check-in e exporte relatórios consolidados.', 'info')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Ajuda</span>
            </button>

            <button
              onClick={exportarTodosEventosCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Exportar</span>
            </button>

            {scope.canWrite && (
              <button
                onClick={() => {
                  setEditandoId(null);
                  setFormEvento(FORM_EVENTO_INICIAL);
                  setShowForm(true);
                  if (aba !== 'eventos') setAba('eventos');
                }}
                className="inline-flex items-center gap-2 px-4.5 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3460] hover:bg-[#162a47] shadow-sm hover:shadow transition active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Novo Evento</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 2. KPIS COM IDENTIDADE VISUAL E CONTADORES GLOBAIS ───────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Programados */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex items-center justify-between h-[96px]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shrink-0">
                <CalendarDays className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-0.5">Programados</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-slate-900 leading-none">{totaisGlobais.programado}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    +{totaisGlobais.noMes} este mês
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Em Andamento */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex items-center justify-between h-[96px]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
                <Play className="w-5 h-5 fill-blue-600 stroke-none ml-0.5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-0.5">Em Andamento</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-slate-900 leading-none">{totaisGlobais.em_andamento}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200/60">
                    0 este mês
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Realizados */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex items-center justify-between h-[96px]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shrink-0">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-0.5">Realizados</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-slate-900 leading-none">{totaisGlobais.realizado}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    +5 este semestre
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Cancelados */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex items-center justify-between h-[96px]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100/80 flex items-center justify-center text-rose-600 shrink-0">
                <XCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-0.5">Cancelados</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-slate-900 leading-none">{totaisGlobais.cancelado}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200/60">
                    0 este mês
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. NAVEGAÇÃO POR ABAS PILL ───────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setAba('eventos')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-xs ${
              aba === 'eventos'
                ? 'bg-[#1d4ed8] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Eventos</span>
          </button>

          <button
            onClick={() => {
              if (!eventoSelecionado && eventos.length > 0) setEventoSelecionado(eventos[0]);
              setAba('inscricoes');
            }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-xs ${
              aba === 'inscricoes'
                ? 'bg-[#1d4ed8] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Inscrições</span>
          </button>

          <button
            onClick={() => {
              if (!eventoSelecionado && eventos.length > 0) setEventoSelecionado(eventos[0]);
              setAba('checkin');
            }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-xs ${
              aba === 'checkin'
                ? 'bg-[#1d4ed8] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Check-in</span>
          </button>

          <button
            onClick={() => {
              if (!eventoSelecionado && eventos.length > 0) setEventoSelecionado(eventos[0]);
              setAba('pagamentos');
            }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-xs ${
              aba === 'pagamentos'
                ? 'bg-[#1d4ed8] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pagamentos</span>
          </button>

          <button
            onClick={() => {
              if (!eventoSelecionado && eventos.length > 0) setEventoSelecionado(eventos[0]);
              setAba('relatorios');
            }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-xs ${
              aba === 'relatorios'
                ? 'bg-[#1d4ed8] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileBarChart2 className="w-3.5 h-3.5" />
            <span>Relatórios</span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            ABA: EVENTOS (Listagem Executiva & Calendário)
        ══════════════════════════════════════════════════════════════════════ */}
        {aba === 'eventos' && (
          <div className="space-y-4">
            {/* ── 4. TOOLBAR INTEGRADA COM FILTRO DE PERÍODO FLEXÍVEL ──────── */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                {/* Busca */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={buscaEv}
                    onChange={e => {
                      setBuscaEv(e.target.value);
                      setPaginaAtual(1);
                    }}
                    placeholder="Buscar evento por nome, descrição ou local..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white transition"
                  />
                  {buscaEv && (
                    <button
                      onClick={() => setBuscaEv('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Controles Agrupados */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Seletor de Período Flexível (Não Obrigatório) */}
                  <div className="relative">
                    <select
                      value={filtroPeriodo}
                      onChange={e => {
                        const p = e.target.value as TipoPeriodo;
                        setFiltroPeriodo(p);
                        setPaginaAtual(1);
                      }}
                      className="pl-8 pr-7 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] transition cursor-pointer appearance-none"
                    >
                      <option value="todos">Todos os períodos</option>
                      <option value="este_mes">Este mês</option>
                      <option value="proximo_mes">Próximo mês</option>
                      <option value="proximos_30">Próximos 30 dias</option>
                      <option value="proximos_90">Próximos 90 dias</option>
                      <option value="mes_especifico">Mês específico...</option>
                      <option value="historico_completo">Histórico completo</option>
                    </select>
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 rotate-90 pointer-events-none" />
                  </div>

                  {/* Navegador de Mês exibido quando filtroPeriodo === 'mes_especifico' */}
                  {filtroPeriodo === 'mes_especifico' && (
                    <div className="inline-flex items-center bg-slate-50/70 border border-slate-200 rounded-xl p-0.5 text-xs font-semibold animate-in fade-in duration-150">
                      <button
                        onClick={() => {
                          setFiltroMesCustom(mesAnteriorEvento(filtroMesCustom));
                          setPaginaAtual(1);
                        }}
                        title="Mês anterior"
                        className="p-1 hover:bg-white rounded-lg text-slate-600 transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2.5 min-w-[120px] text-center font-bold text-slate-800">
                        {formatMonthLabel(filtroMesCustom)}
                      </span>
                      <button
                        onClick={() => {
                          setFiltroMesCustom(mesProximoEvento(filtroMesCustom));
                          setPaginaAtual(1);
                        }}
                        title="Próximo mês"
                        className="p-1 hover:bg-white rounded-lg text-slate-600 transition"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Dropdown de Status */}
                  <div className="relative">
                    <select
                      value={filtroStatus}
                      onChange={e => {
                        setFiltroStatus(e.target.value as '' | StatusEvento);
                        setPaginaAtual(1);
                      }}
                      className="pl-8 pr-7 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] transition cursor-pointer appearance-none"
                    >
                      <option value="">Todos os status</option>
                      {STATUS_EVENTO.map(s => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 rotate-90 pointer-events-none" />
                  </div>

                  {/* Dropdown de Congregação */}
                  {congregacoes.length > 0 && (
                    <div className="relative">
                      <select
                        value={filtroCongEv}
                        onChange={e => {
                          setFiltroCongEv(e.target.value);
                          setPaginaAtual(1);
                        }}
                        className="pl-8 pr-7 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] transition cursor-pointer appearance-none max-w-[190px]"
                      >
                        <option value="">Todas as congregações</option>
                        {congregacoes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                      <Landmark className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 rotate-90 pointer-events-none" />
                    </div>
                  )}

                  {/* Botão de Limpar Filtros */}
                  {(filtroPeriodo !== 'todos' || filtroStatus || filtroCongEv || buscaEv) && (
                    <button
                      onClick={() => {
                        setFiltroPeriodo('todos');
                        setFiltroMesCustom(mesAtualEvento());
                        setFiltroStatus('');
                        setFiltroCongEv('');
                        setBuscaEv('');
                        setPaginaAtual(1);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50/70 border border-slate-200 hover:bg-slate-100 transition"
                      title="Restaurar visão padrão e limpar filtros"
                    >
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span>Limpar filtros</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal / Formulário de Criação/Edição de Evento */}
            {showForm && scope.canWrite && (
              <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1d4ed8]">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        {editandoId ? 'Editar Evento' : 'Novo Evento'}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Preencha as informações detalhadas para publicação na agenda.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Body */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Título do Evento *</label>
                    <input
                      type="text"
                      value={formEvento.titulo}
                      onChange={e => setFormEvento(f => ({ ...f, titulo: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#1d4ed8] focus:border-transparent transition"
                      placeholder="Ex: Congresso de Jovens, Culto de Missões, Santa Ceia..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Tipo</label>
                    <select
                      value={formEvento.tipo}
                      onChange={e => setFormEvento(f => ({ ...f, tipo: e.target.value as TipoEvento }))}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    >
                      {TIPOS_EVENTO.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Status</label>
                    <select
                      value={formEvento.status}
                      onChange={e => setFormEvento(f => ({ ...f, status: e.target.value as StatusEvento }))}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    >
                      {STATUS_EVENTO.map(s => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Congregação</label>
                    <select
                      value={formEvento.congregacao_id}
                      onChange={e => setFormEvento(f => ({ ...f, congregacao_id: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    >
                      <option value="">Templo Sede</option>
                      {congregacoes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Início *</label>
                    <input
                      type="datetime-local"
                      value={formEvento.data_inicio}
                      onChange={e => setFormEvento(f => ({ ...f, data_inicio: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Término</label>
                    <input
                      type="datetime-local"
                      value={formEvento.data_fim}
                      onChange={e => setFormEvento(f => ({ ...f, data_fim: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Local (Nome)</label>
                    <input
                      type="text"
                      value={formEvento.local_nome}
                      onChange={e => setFormEvento(f => ({ ...f, local_nome: e.target.value }))}
                      placeholder="Ex: Templo Sede, Salão Principal..."
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      value={formEvento.local_endereco}
                      onChange={e => setFormEvento(f => ({ ...f, local_endereco: e.target.value }))}
                      placeholder="Rua, número, bairro, cidade..."
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Capacidade de Vagas</label>
                    <input
                      type="number"
                      min="0"
                      value={formEvento.capacidade}
                      onChange={e => setFormEvento(f => ({ ...f, capacidade: e.target.value }))}
                      placeholder="Vazio para sem limite"
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Descrição</label>
                    <textarea
                      value={formEvento.descricao}
                      onChange={e => setFormEvento(f => ({ ...f, descricao: e.target.value }))}
                      rows={2}
                      placeholder="Detalhes sobre o evento, pregador convidado, tema oficial..."
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    />
                  </div>

                  {/* ── Seção: Inscrição e Benefícios ── */}
                  <div className="md:col-span-3 bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 md:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-[#1d4ed8]" />
                          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                            Inscrição e Benefícios
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {formEvento.evento_pago
                            ? 'Defina o valor da inscrição, as formas de pagamento aceitas e o que estará incluído para os participantes.'
                            : 'Configure se a participação requer pagamento de inscrição ou se o evento é gratuito.'}
                        </p>
                      </div>

                      {/* Checkbox Principal: Evento Pago */}
                      <label className="inline-flex items-center gap-2.5 cursor-pointer select-none bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition shrink-0">
                        <input
                          type="checkbox"
                          checked={formEvento.evento_pago}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormEvento(f => ({
                              ...f,
                              evento_pago: checked,
                              valor_inscricao: checked ? (f.valor_inscricao === '0,00' || f.valor_inscricao === '0' ? '0,00' : f.valor_inscricao) : '0,00',
                              formas_pagamento: checked && f.formas_pagamento.length === 0 ? ['pix'] : checked ? f.formas_pagamento : [],
                              inclui_alimentacao: checked ? f.inclui_alimentacao : false,
                              inclui_hospedagem: checked ? f.inclui_hospedagem : false,
                              inclui_brinde: checked ? f.inclui_brinde : false,
                              inclui_certificado: checked ? f.inclui_certificado : false,
                            }));
                          }}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-[#1d4ed8]"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          {formEvento.evento_pago ? 'Evento Pago' : 'Evento Gratuito'}
                        </span>
                      </label>
                    </div>

                    {/* Conteúdo condicional quando Evento Pago está marcado */}
                    {formEvento.evento_pago ? (
                      <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                        {/* 1. Valor da Inscrição */}
                        <div className="max-w-xs">
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Valor da Inscrição *
                          </label>
                          <div className="relative rounded-xl shadow-xs">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                              R$
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formEvento.valor_inscricao}
                              onChange={e => {
                                const formatted = formatCurrencyInput(e.target.value);
                                setFormEvento(f => ({ ...f, valor_inscricao: formatted }));
                              }}
                              placeholder="0,00"
                              className="w-full pl-10 pr-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#1d4ed8] focus:border-transparent transition bg-white"
                            />
                          </div>
                        </div>

                        {/* 2. Formas de Pagamento Aceitas */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1.5">
                            Formas de Pagamento Aceitas *
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {FORMAS_PAGAMENTO_OPTIONS.map(opt => {
                              const checked = formEvento.formas_pagamento.includes(opt.value);
                              return (
                                <label
                                  key={opt.value}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition select-none ${
                                    checked
                                      ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-bold shadow-xs'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => {
                                      const isChecked = e.target.checked;
                                      setFormEvento(f => ({
                                        ...f,
                                        formas_pagamento: isChecked
                                          ? [...f.formas_pagamento, opt.value]
                                          : f.formas_pagamento.filter(x => x !== opt.value),
                                      }));
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-[#1d4ed8]"
                                  />
                                  <span className="text-xs">{opt.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. Benefícios Inclusos */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1.5">
                            O que está incluso na inscrição?
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {BENEFICIOS_OPTIONS.map(b => {
                              const checked = formEvento[b.key as keyof FormEvento] as boolean;
                              return (
                                <label
                                  key={b.key}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition select-none ${
                                    checked
                                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-bold shadow-xs'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => {
                                      const isChecked = e.target.checked;
                                      setFormEvento(f => ({ ...f, [b.key]: isChecked }));
                                    }}
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                  />
                                  <span className="text-xs">{b.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Configuração adicional de Brinde */}
                        {formEvento.inclui_brinde && (
                          <div className="p-3.5 bg-white border border-emerald-200/80 rounded-xl space-y-3 animate-in fade-in duration-150">
                            <div>
                              <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                                Distribuição do brinde
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label
                                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition text-xs select-none ${
                                    formEvento.brinde_distribuicao === 'todos'
                                      ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="brinde_distribuicao"
                                    value="todos"
                                    checked={formEvento.brinde_distribuicao === 'todos'}
                                    onChange={() => setFormEvento(f => ({ ...f, brinde_distribuicao: 'todos' }))}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>Todos os inscritos confirmados</span>
                                </label>

                                <label
                                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition text-xs select-none ${
                                    formEvento.brinde_distribuicao === 'quantidade_limitada'
                                      ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="brinde_distribuicao"
                                    value="quantidade_limitada"
                                    checked={formEvento.brinde_distribuicao === 'quantidade_limitada'}
                                    onChange={() => setFormEvento(f => ({ ...f, brinde_distribuicao: 'quantidade_limitada' }))}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>Quantidade limitada</span>
                                </label>
                              </div>
                            </div>

                            {formEvento.brinde_distribuicao === 'quantidade_limitada' && (
                              <div className="pt-1">
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                  Quantidade disponível *
                                </label>
                                <div className="max-w-xs">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={formEvento.brinde_quantidade}
                                    onChange={e => setFormEvento(f => ({ ...f, brinde_quantidade: e.target.value }))}
                                    placeholder="Ex: 50"
                                    className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 transition"
                                  />
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                  Os primeiros {formEvento.brinde_quantidade || 'X'} inscritos com inscrição confirmada terão direito ao brinde.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Configuração adicional de Certificado */}
                        {formEvento.inclui_certificado && (
                          <div className="p-3.5 bg-white border border-emerald-200/80 rounded-xl space-y-2 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                                Modelo de Certificado
                              </label>
                              <a
                                href="/configuracoes/certificados"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-[#1d4ed8] hover:underline inline-flex items-center gap-1"
                              >
                                Configurar certificados
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <select
                              value={formEvento.certificado_modelo_id}
                              onChange={e => setFormEvento(f => ({ ...f, certificado_modelo_id: e.target.value }))}
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 transition"
                            >
                              {templatesCertificados.length === 0 ? (
                                <option value="evento-padrao">Certificado de Eventos (Padrão)</option>
                              ) : (
                                templatesCertificados.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.nome}
                                  </option>
                                ))
                              )}
                            </select>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Selecione o modelo configurado em Configurações &gt; Certificados que será gerado para os participantes com presença confirmada.
                            </p>
                          </div>
                        )}

                        {/* Opções extras se Hospedagem estiver inclusa */}
                        {formEvento.inclui_hospedagem && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-white border border-slate-200 rounded-xl animate-in fade-in duration-150">
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Vagas para Hospedagem
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formEvento.vagas_hospedagem}
                                onChange={e => setFormEvento(f => ({ ...f, vagas_hospedagem: e.target.value }))}
                                placeholder="Ex: 50 (vazio para ilimitado)"
                                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Instruções de Hospedagem
                              </label>
                              <input
                                type="text"
                                value={formEvento.descricao_hospedagem}
                                onChange={e => setFormEvento(f => ({ ...f, descricao_hospedagem: e.target.value }))}
                                placeholder="Ex: Trazer roupa de cama, colchão..."
                                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Este evento está configurado como <strong>Gratuito</strong> (sem cobrança de taxa de inscrição).</span>
                        </div>

                        {/* Benefícios para eventos gratuitos */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1.5">
                            Benefícios inclusos no evento gratuito (opcional):
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {BENEFICIOS_OPTIONS.map(b => {
                              const checked = formEvento[b.key as keyof FormEvento] as boolean;
                              return (
                                <label
                                  key={b.key}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition select-none ${
                                    checked
                                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-bold shadow-xs'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => {
                                      const isChecked = e.target.checked;
                                      setFormEvento(f => ({ ...f, [b.key]: isChecked }));
                                    }}
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                  />
                                  <span className="text-xs">{b.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Configuração adicional de Brinde para gratuito */}
                        {formEvento.inclui_brinde && (
                          <div className="p-3.5 bg-white border border-emerald-200/80 rounded-xl space-y-3 animate-in fade-in duration-150">
                            <div>
                              <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                                Distribuição do brinde
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label
                                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition text-xs select-none ${
                                    formEvento.brinde_distribuicao === 'todos'
                                      ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="brinde_distribuicao_free"
                                    value="todos"
                                    checked={formEvento.brinde_distribuicao === 'todos'}
                                    onChange={() => setFormEvento(f => ({ ...f, brinde_distribuicao: 'todos' }))}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>Todos os inscritos confirmados</span>
                                </label>

                                <label
                                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition text-xs select-none ${
                                    formEvento.brinde_distribuicao === 'quantidade_limitada'
                                      ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="brinde_distribuicao_free"
                                    value="quantidade_limitada"
                                    checked={formEvento.brinde_distribuicao === 'quantidade_limitada'}
                                    onChange={() => setFormEvento(f => ({ ...f, brinde_distribuicao: 'quantidade_limitada' }))}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>Quantidade limitada</span>
                                </label>
                              </div>
                            </div>

                            {formEvento.brinde_distribuicao === 'quantidade_limitada' && (
                              <div className="pt-1">
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                  Quantidade disponível *
                                </label>
                                <div className="max-w-xs">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={formEvento.brinde_quantidade}
                                    onChange={e => setFormEvento(f => ({ ...f, brinde_quantidade: e.target.value }))}
                                    placeholder="Ex: 50"
                                    className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 transition"
                                  />
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                  Os primeiros {formEvento.brinde_quantidade || 'X'} inscritos com inscrição confirmada terão direito ao brinde.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Configuração adicional de Certificado para gratuito */}
                        {formEvento.inclui_certificado && (
                          <div className="p-3.5 bg-white border border-emerald-200/80 rounded-xl space-y-2 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                                Modelo de Certificado
                              </label>
                              <a
                                href="/configuracoes/certificados"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-[#1d4ed8] hover:underline inline-flex items-center gap-1"
                              >
                                Configurar certificados
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <select
                              value={formEvento.certificado_modelo_id}
                              onChange={e => setFormEvento(f => ({ ...f, certificado_modelo_id: e.target.value }))}
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 transition"
                            >
                              {templatesCertificados.length === 0 ? (
                                <option value="evento-padrao">Certificado de Eventos (Padrão)</option>
                              ) : (
                                templatesCertificados.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.nome}
                                  </option>
                                ))
                              )}
                            </select>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Selecione o modelo configurado em Configurações &gt; Certificados que será gerado para os participantes com presença confirmada.
                            </p>
                          </div>
                        )}

                        {/* Opções extras se Hospedagem estiver inclusa em evento gratuito */}
                        {formEvento.inclui_hospedagem && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-white border border-slate-200 rounded-xl animate-in fade-in duration-150">
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Vagas para Hospedagem
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formEvento.vagas_hospedagem}
                                onChange={e => setFormEvento(f => ({ ...f, vagas_hospedagem: e.target.value }))}
                                placeholder="Ex: 50 (vazio para ilimitado)"
                                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Instruções de Hospedagem
                              </label>
                              <input
                                type="text"
                                value={formEvento.descricao_hospedagem}
                                onChange={e => setFormEvento(f => ({ ...f, descricao_hospedagem: e.target.value }))}
                                placeholder="Ex: Trazer roupa de cama, colchão..."
                                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Cronograma / Programação (Opcional)</label>
                    <textarea
                      value={formEvento.programacao}
                      onChange={e => setFormEvento(f => ({ ...f, programacao: e.target.value }))}
                      rows={2}
                      placeholder="Ex: 19h - Abertura e Louvor | 20h - Mensagem Principal..."
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    />
                  </div>
                </div>

                {/* Botões do Form */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEvento}
                    disabled={salvando}
                    className="px-5 py-2 rounded-xl bg-[#0f3460] hover:bg-[#162a47] text-white text-xs font-bold shadow-sm hover:shadow transition disabled:opacity-50"
                  >
                    {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Criar Evento'}
                  </button>
                </div>
              </div>
            )}

            {/* ── 5. HEADER DA LISTAGEM COM TOGGLE [ LISTA | CALENDÁRIO ] ─── */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  {filtroPeriodo === 'todos' ? 'Agenda de Eventos' : 'Eventos'} ({eventos.length})
                </h2>
              </div>

              {/* View Switcher Pill */}
              <div className="inline-flex items-center bg-white border border-slate-200/90 rounded-xl p-1 shadow-xs">
                <button
                  onClick={() => setViewMode('lista')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'lista'
                      ? 'bg-blue-50 text-[#1d4ed8] border border-blue-200/60 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
                <button
                  onClick={() => setViewMode('calendario')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'calendario'
                      ? 'bg-blue-50 text-[#1d4ed8] border border-blue-200/60 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendário</span>
                </button>
              </div>
            </div>

            {/* ── 5 & 6. TABELA EXECUTIVA CONFORME O MOCKUP ───────────────── */}
            {loadingEventos ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-[#1d4ed8] rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">Carregando listagem de eventos...</p>
              </div>
            ) : eventos.length === 0 ? (
              /* ── 13. ESTADO VAZIO CLARO ── */
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  {filtroPeriodo === 'todos'
                    ? 'Nenhum evento futuro encontrado'
                    : 'Nenhum evento encontrado no período selecionado'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {filtroPeriodo === 'todos'
                    ? 'Não há eventos futuros ou em andamento na agenda. Cadastre um novo evento ou consulte o histórico completo.'
                    : 'Não há registros para o período e filtros atuais. Tente selecionar "Todos os períodos" ou cadastre um novo evento.'}
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  {filtroPeriodo !== 'historico_completo' && (
                    <button
                      onClick={() => setFiltroPeriodo('historico_completo')}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#0f3460] bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
                    >
                      Ver histórico completo
                    </button>
                  )}
                  {scope.canWrite && (
                    <button
                      onClick={() => {
                        setEditandoId(null);
                        setFormEvento(FORM_EVENTO_INICIAL);
                        setShowForm(true);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3460] hover:bg-[#162a47] transition shadow-sm"
                    >
                      + Novo Evento
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'lista' ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[780px]">
                    <thead className="bg-slate-50/70 border-b border-slate-200/90 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-5 py-3.5 w-24">DATA</th>
                        <th className="px-4 py-3.5">EVENTO</th>
                        <th className="px-4 py-3.5 text-center">TIPO</th>
                        <th className="px-4 py-3.5">CONGREGAÇÃO</th>
                        <th className="px-4 py-3.5 text-center">INSCRITOS</th>
                        <th className="px-4 py-3.5 text-center">STATUS</th>
                        <th className="px-5 py-3.5 text-right w-28">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {eventosPaginados.map(e => {
                        const dateParts = parseDateParts(e.data_inicio);
                        const st = statusEventoInfo(e.status);
                        const tp = tipoInfo(e.tipo);
                        const menuAberto = menuAbertoId === e.id;
                        const isPago = Boolean(e.evento_pago || (e.valor_inscricao && e.valor_inscricao > 0));
                        const beneficiosLabels = getBeneficiosLabels(e);

                        return (
                          <tr key={e.id} className="hover:bg-slate-50/70 transition-colors group">
                            {/* DATA */}
                            <td className="px-5 py-4 align-middle">
                              <div className="flex flex-col items-center justify-center w-12 text-center">
                                <span className="text-xl font-black text-blue-900 leading-none">{dateParts.day}</span>
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight mt-0.5">{dateParts.month}</span>
                                <span className="text-[10px] font-semibold text-slate-400 leading-none">{dateParts.year}</span>
                              </div>
                            </td>

                            {/* EVENTO */}
                            <td className="px-4 py-4 align-middle">
                              <div className="flex items-center gap-3">
                                {/* Thumbnail / Avatar Placeholder Icon */}
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform overflow-hidden relative">
                                  <span className="text-base font-black tracking-tighter opacity-80">
                                    {e.titulo.slice(0, 2).toUpperCase()}
                                  </span>
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition truncate">
                                      {e.titulo}
                                    </h4>
                                    {isPago ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0">
                                        {fmtBRL(e.valor_inscricao)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                        Gratuito
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px] mt-0.5">
                                    <span>{dateParts.time}</span>
                                    <span>•</span>
                                    <span className="truncate">{e.local_nome ?? 'Templo Sede'}</span>
                                    {beneficiosLabels.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="text-emerald-700 font-semibold truncate">
                                          {beneficiosLabels.join(' · ')}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* TIPO */}
                            <td className="px-4 py-4 align-middle text-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${tp.badgeClass}`}>
                                {tp.label}
                              </span>
                            </td>

                            {/* CONGREGAÇÃO */}
                            <td className="px-4 py-4 align-middle">
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium text-xs">
                                <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{e.congregacao_nome ?? 'Templo Sede'}</span>
                              </div>
                            </td>

                            {/* INSCRITOS */}
                            <td className="px-4 py-4 align-middle text-center">
                              <div className="inline-flex items-center gap-1 text-slate-700 font-bold text-xs">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <span>{e.total_inscritos ?? 0}</span>
                                {e.capacidade && (
                                  <span className="text-[10px] text-slate-400 font-normal">/{e.capacidade}</span>
                                )}
                              </div>
                            </td>

                            {/* STATUS */}
                            <td className="px-4 py-4 align-middle text-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${st.pillClass}`}>
                                <span className={`w-2 h-2 rounded-full ${st.dotClass}`} />
                                {st.label}
                              </span>
                            </td>

                            {/* AÇÕES (Visualizar, Editar, Menu Mais) */}
                            <td className="px-5 py-4 align-middle text-right">
                              <div className="inline-flex items-center gap-1 relative" onClick={ev => ev.stopPropagation()}>
                                {/* Visualizar */}
                                <button
                                  onClick={() => setEventoVisualizando(e)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/60 transition"
                                  title="Visualizar detalhes do evento"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {/* Editar */}
                                {scope.canWrite && (
                                  <button
                                    onClick={() => handleEditEvento(e)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/60 transition"
                                    title="Editar evento"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Menu ⋮ */}
                                <div className="relative">
                                  <button
                                    onClick={ev => {
                                      ev.stopPropagation();
                                      setMenuAbertoId(menuAberto ? null : e.id);
                                    }}
                                    className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/60 transition ${
                                      menuAberto ? 'bg-slate-100 text-slate-800' : ''
                                    }`}
                                    title="Mais ações"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {/* Dropdown Menu */}
                                  {menuAberto && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-30 text-left animate-in fade-in zoom-in-95 duration-100">
                                      <button
                                        onClick={() => {
                                          setMenuAbertoId(null);
                                          selecionarEvento(e, 'inscricoes');
                                        }}
                                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                      >
                                        <Users className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Gerenciar Inscrições</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setMenuAbertoId(null);
                                          selecionarEvento(e, 'checkin');
                                        }}
                                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                      >
                                        <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Realizar Check-in</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setMenuAbertoId(null);
                                          selecionarEvento(e, 'relatorios');
                                        }}
                                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                      >
                                        <FileBarChart2 className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Relatório do Evento</span>
                                      </button>

                                      {e.is_publico && e.slug && (
                                        <button
                                          onClick={() => {
                                            setMenuAbertoId(null);
                                            copiarLink(e);
                                          }}
                                          className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                        >
                                          <Copy className="w-3.5 h-3.5 text-teal-600" />
                                          <span>Copiar Link Público</span>
                                        </button>
                                      )}

                                      {scope.canDelete && (
                                        <>
                                          <div className="border-t border-slate-100 my-1" />
                                          <button
                                            onClick={() => {
                                              setMenuAbertoId(null);
                                              handleDeleteEvento(e.id);
                                            }}
                                            className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Excluir Evento</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── FOOTER DE PAGINAÇÃO DA TABELA ── */}
                <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 font-medium">
                  <div>
                    Mostrando{' '}
                    <span className="font-bold text-slate-800">
                      {eventos.length === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1}
                    </span>{' '}
                    a{' '}
                    <span className="font-bold text-slate-800">
                      {Math.min(paginaAtual * itensPorPagina, eventos.length)}
                    </span>{' '}
                    de <span className="font-bold text-slate-800">{eventos.length}</span> eventos
                  </div>

                  {/* Botões de Página */}
                  <div className="flex items-center gap-1 self-center sm:self-auto">
                    <button
                      onClick={() => setPaginaAtual(1)}
                      disabled={paginaAtual <= 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                      title="Primeira página"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                      disabled={paginaAtual <= 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {Array.from({ length: totalPaginas }, (_, idx) => idx + 1).map(num => (
                      <button
                        key={num}
                        onClick={() => setPaginaAtual(num)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                          paginaAtual === num
                            ? 'bg-[#1d4ed8] text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}

                    <button
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual >= totalPaginas}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                      title="Próxima página"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPaginaAtual(totalPaginas)}
                      disabled={paginaAtual >= totalPaginas}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                      title="Última página"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Seletor de Itens por Página */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={itensPorPagina}
                      onChange={e => {
                        setItensPorPagina(Number(e.target.value));
                        setPaginaAtual(1);
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                      <option value="5">5 por página</option>
                      <option value="10">10 por página</option>
                      <option value="20">20 por página</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              /* Modo Calendário Visual */
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Calendário de Eventos: {formatMonthLabel(filtroMesCustom)}
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">{eventos.length} evento(s) agendado(s)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {eventos.map(ev => {
                    const dateParts = parseDateParts(ev.data_inicio);
                    const st = statusEventoInfo(ev.status);
                    const isPago = Boolean(ev.evento_pago || (ev.valor_inscricao && ev.valor_inscricao > 0));
                    const beneficiosLabels = getBeneficiosLabels(ev);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => setEventoVisualizando(ev)}
                        className="bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-blue-300 p-4 rounded-xl shadow-xs transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-black text-blue-900">
                            {dateParts.day} {dateParts.month} · {dateParts.time}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.pillClass}`}>
                            {st.label}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs truncate">{ev.titulo}</h4>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="truncate">{ev.local_nome ?? 'Templo Sede'}</span>
                          {isPago ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded shrink-0">
                              {fmtBRL(ev.valor_inscricao)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded shrink-0">
                              Gratuito
                            </span>
                          )}
                        </div>
                        {beneficiosLabels.length > 0 && (
                          <p className="text-[10px] text-emerald-700 font-semibold truncate pt-1 border-t border-slate-200/60">
                            {beneficiosLabels.join(' · ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SELETOR DE EVENTO EM ABAS DE DETALHE (Inscrições, Checkin, Pag, Rel)
        ══════════════════════════════════════════════════════════════════════ */}
        {aba !== 'eventos' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Evento Selecionado
                </label>
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                >
                  <option value="">— Selecione um evento —</option>
                  {eventos.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {fmtDate(ev.data_inicio)} — {ev.titulo} ({statusEventoInfo(ev.status).label})
                    </option>
                  ))}
                </select>
              </div>

              {eventoSelecionado && (
                <div className="flex items-center gap-2 pt-2 md:pt-5">
                  <button
                    onClick={() => setAba('eventos')}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    Voltar para lista
                  </button>
                  {eventoSelecionado.is_publico && eventoSelecionado.slug && (
                    <button
                      onClick={() => copiarLink(eventoSelecionado)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Link público</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {eventoSelecionado && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600 font-medium">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  {fmtDateTime(eventoSelecionado.data_inicio)}
                </span>
                {eventoSelecionado.local_nome && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {eventoSelecionado.local_nome}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusEventoInfo(eventoSelecionado.status).pillClass}`}
                >
                  {statusEventoInfo(eventoSelecionado.status).label}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ABA: INSCRIÇÕES
        ══════════════════════════════════════════════════════════════════════ */}
        {aba === 'inscricoes' && eventoSelecionado && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total de Inscritos', val: insPorStatus.total, cor: 'text-slate-900', bg: 'bg-white' },
                { label: 'Confirmados', val: insPorStatus.confirmados, cor: 'text-emerald-700', bg: 'bg-emerald-50/50' },
                { label: 'Lista de Espera', val: insPorStatus.listaEspera, cor: 'text-amber-700', bg: 'bg-amber-50/50' },
                { label: 'Com Hospedagem', val: insPorStatus.hospedagem, cor: 'text-blue-700', bg: 'bg-blue-50/50' },
              ].map(x => (
                <div key={x.label} className={`rounded-2xl border border-slate-200 p-4 text-center shadow-xs ${x.bg}`}>
                  <p className={`text-2xl font-black ${x.cor}`}>{x.val}</p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">{x.label}</p>
                </div>
              ))}
            </div>

            {/* Toolbar Inscrições */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  value={buscaInsc}
                  onChange={e => setBuscaInsc(e.target.value)}
                  placeholder="Buscar participante por nome, e-mail..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                />
              </div>

              <select
                value={filtroStatusInsc}
                onChange={e => setFiltroStatusInsc(e.target.value as '' | StatusInscricao)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="">Todos os status</option>
                {STATUS_INSCRICAO.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {scope.canWrite && (
                <button
                  onClick={() => setShowFormInsc(v => !v)}
                  className="inline-flex items-center gap-1.5 bg-[#0f3460] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#162a47] transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Inscrever</span>
                </button>
              )}

              {eventoSelecionado.inclui_certificado && (
                <button
                  onClick={handleImprimirTodosCertificados}
                  title="Emitir certificados para todos os participantes confirmados"
                  className="inline-flex items-center gap-1.5 border border-blue-200 bg-blue-50 text-blue-800 px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition shadow-xs"
                >
                  <Award className="w-4 h-4 text-blue-600" />
                  <span>Certificados</span>
                </button>
              )}

              <button
                onClick={() => exportarCSVInscricoes(inscricoes, eventoSelecionado.titulo)}
                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition shadow-xs"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>CSV</span>
              </button>

              <button
                onClick={() => carregarInscricoes(eventoSelecionado.id)}
                title="Recarregar"
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Inscrição */}
            {showFormInsc && scope.canWrite && (
              <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Nova Inscrição no Evento</h3>
                  <button onClick={() => setShowFormInsc(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Buscar Membro Cadastrado</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      value={buscaMembro}
                      onChange={e => {
                        setBuscaMembro(e.target.value);
                        setMembroSelecionado(null);
                      }}
                      placeholder="Digite 3 ou mais letras para pesquisar no rol de membros..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900"
                    />
                  </div>
                  {resultadosMembro.length > 0 && !membroSelecionado && (
                    <div className="border border-slate-200 rounded-xl mt-1 max-h-40 overflow-y-auto bg-white shadow-lg z-10 relative">
                      {resultadosMembro.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setMembroSelecionado(m);
                            setBuscaMembro(m.nome_completo);
                            setResultadosMembro([]);
                            setFormInsc(f => ({ ...f, nome_externo: '' }));
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-slate-800 font-medium"
                        >
                          {m.nome_completo}
                        </button>
                      ))}
                    </div>
                  )}
                  {membroSelecionado && (
                    <p className="text-xs font-semibold text-emerald-700 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Membro selecionado: {membroSelecionado.nome_completo}
                    </p>
                  )}
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="flex-shrink mx-3 text-slate-400 text-xs font-semibold">ou participante externo</span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Nome Completo</label>
                    <input
                      value={formInsc.nome_externo}
                      onChange={e => setFormInsc(f => ({ ...f, nome_externo: e.target.value }))}
                      disabled={!!membroSelecionado}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                      placeholder="Nome do participante"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">E-mail</label>
                    <input
                      type="email"
                      value={formInsc.email_externo}
                      onChange={e => setFormInsc(f => ({ ...f, email_externo: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Telefone / WhatsApp</label>
                    <input
                      value={formInsc.telefone}
                      onChange={e => setFormInsc(f => ({ ...f, telefone: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
                      placeholder="(99) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Status Inicial</label>
                    <select
                      value={formInsc.status}
                      onChange={e => setFormInsc(f => ({ ...f, status: e.target.value as StatusInscricao }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    >
                      {STATUS_INSCRICAO.map(s => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {eventoSelecionado.inclui_hospedagem && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-800">
                    <input
                      type="checkbox"
                      checked={formInsc.com_hospedagem}
                      onChange={e => setFormInsc(f => ({ ...f, com_hospedagem: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-600"
                    />
                    <Bed className="w-4 h-4 text-amber-600" /> Solicitar vaga de hospedagem
                  </label>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Observações Internas</label>
                  <textarea
                    value={formInsc.observacoes}
                    onChange={e => setFormInsc(f => ({ ...f, observacoes: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    rows={2}
                    placeholder="Restrições, necessidades especiais, etc."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setShowFormInsc(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveInscricao}
                    className="px-5 py-2 rounded-xl bg-[#0f3460] text-white text-xs font-bold hover:bg-[#162a47]"
                  >
                    Confirmar Inscrição
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de Inscrições */}
            {loadingInsc ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-[#0f3460] rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Carregando inscrições...</p>
              </div>
            ) : inscricoesFiltradas.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Nenhuma inscrição encontrada</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3.5">Participante</th>
                        <th className="px-4 py-3.5">Contato</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Benefícios</th>
                        <th className="px-4 py-3.5">Hospedagem</th>
                        <th className="px-4 py-3.5">Observações</th>
                        {scope.canWrite && <th className="px-4 py-3.5 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inscricoesFiltradas.map(i => (
                        <tr key={i.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3.5 font-bold text-slate-900">{i.nome_display}</td>
                          <td className="px-4 py-3.5 text-slate-500">
                            {i.email_externo && <span className="block">{i.email_externo}</span>}
                            {i.telefone && <span className="block font-medium">{i.telefone}</span>}
                            {!i.email_externo && !i.telefone && '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold border ${statusInscricaoCor(i.status)}`}
                            >
                              {statusInscricaoLabel(i.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {i.tem_brinde ? (
                                <span
                                  title={i.brinde_entregue ? `Brinde entregue${i.brinde_entregue_em ? ' em ' + fmtDateTime(i.brinde_entregue_em) : ''}` : 'Brinde incluso com direito ao recebimento'}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                    i.brinde_entregue
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  <Gift className="w-3 h-3" />
                                  <span>{i.brinde_entregue ? 'Brinde entregue' : 'Brinde incluso'}</span>
                                </span>
                              ) : null}

                              {eventoSelecionado.inclui_certificado && (
                                <span
                                  title="Certificado disponível após presença"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                >
                                  <Award className="w-3 h-3" />
                                  <span>Certificado</span>
                                </span>
                              )}

                              {!i.tem_brinde && !eventoSelecionado.inclui_certificado && (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {i.com_hospedagem ? (
                              scope.canWrite ? (
                                <select
                                  value={i.status_hospedagem ?? 'solicitada'}
                                  onChange={e => handleStatusHospedagem(i, e.target.value as StatusHospedagem)}
                                  className={`rounded-full px-2.5 py-0.5 border text-xs font-bold cursor-pointer ${statusHospCor(i.status_hospedagem)}`}
                                >
                                  {STATUS_HOSPEDAGEM.filter(s => s.value !== 'nao_aplicavel').map(s => (
                                    <option key={s.value} value={s.value}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full font-bold ${statusHospCor(i.status_hospedagem)}`}>
                                  {statusHospLabel(i.status_hospedagem)}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 max-w-[180px] truncate">
                            {i.observacoes ?? '—'}
                          </td>
                          {scope.canWrite && (
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {eventoSelecionado.inclui_certificado && i.status === 'confirmado' && (
                                  <button
                                    onClick={() => handleImprimirCertificado(i)}
                                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                                    title="Emitir/Imprimir Certificado Individual"
                                  >
                                    <Award className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteInscricao(i.id)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                                  title="Remover inscrição"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ABA: CHECK-IN
        ══════════════════════════════════════════════════════════════════════ */}
        {aba === 'checkin' && eventoSelecionado && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-emerald-700">{insPorStatus.presentes}</p>
                <p className="text-xs font-bold text-emerald-800 mt-0.5">Presentes</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-slate-500">
                  {insPorStatus.confirmados - insPorStatus.presentes}
                </p>
                <p className="text-xs font-bold text-slate-600 mt-0.5">Ausentes</p>
              </div>
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-[#0f3460]">{insPorStatus.confirmados}</p>
                <p className="text-xs font-bold text-[#0f3460] mt-0.5">Total Confirmados</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  value={buscaCheckin}
                  onChange={e => setBuscaCheckin(e.target.value)}
                  placeholder="Pesquisar por nome ou e-mail para validar presença..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                />
              </div>
              <button
                onClick={() => carregarInscricoes(eventoSelecionado.id)}
                title="Recarregar"
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {loadingInsc ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-[#0f3460] rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Carregando lista de check-in...</p>
              </div>
            ) : checkinFiltrado.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Nenhum participante encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {checkinFiltrado.map(i => (
                  <div
                    key={i.id}
                    className={`bg-white rounded-2xl border p-4 shadow-xs flex items-center justify-between gap-4 transition-all ${
                      i.presente
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{i.nome_display}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[i.email_externo, i.telefone].filter(Boolean).join(' · ') || 'Sem contato'}
                      </p>
                      {i.checkin_em && (
                        <p className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Check-in: {fmtDateTime(i.checkin_em)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap justify-end">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusInscricaoCor(i.status)}`}
                      >
                        {statusInscricaoLabel(i.status)}
                      </span>

                      {/* Botão de Entrega do Brinde se o inscrito tiver direito */}
                      {i.tem_brinde && scope.canWrite && (
                        <button
                          onClick={() => handleToggleBrindeEntregue(i)}
                          title={i.brinde_entregue ? 'Clique para desfazer entrega do brinde' : 'Registrar entrega do brinde'}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                            i.brinde_entregue
                              ? 'bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          <Gift className="w-3.5 h-3.5" />
                          <span>{i.brinde_entregue ? 'Brinde Entregue ✓' : 'Entregar Brinde'}</span>
                        </button>
                      )}

                      {/* Botão de Emissão de Certificado no Check-in */}
                      {eventoSelecionado.inclui_certificado && i.presente && scope.canWrite && (
                        <button
                          onClick={() => handleImprimirCertificado(i)}
                          title="Imprimir Certificado de Participação"
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition shadow-xs"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Certificado</span>
                        </button>
                      )}

                      {scope.canWrite && (
                        <button
                          onClick={() => handleCheckin(i)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                            i.presente
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{i.presente ? 'Presente ✓' : 'Confirmar'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ABA: PAGAMENTOS
        ══════════════════════════════════════════════════════════════════════ */}
        {aba === 'pagamentos' && eventoSelecionado && (
          <div className="space-y-4">
            {eventoSelecionado.valor_inscricao === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs font-semibold text-blue-800">
                Este evento é gratuito. Não há cobranças associadas.
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {pagamentos.length} transação(ões) encontrada(s)
              </p>
              <button
                onClick={() => carregarPagamentos(eventoSelecionado.id)}
                className="text-xs font-bold text-[#0f3460] hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Recarregar
              </button>
            </div>

            {loadingPag ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-[#0f3460] rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Carregando pagamentos...</p>
              </div>
            ) : pagamentos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
                <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Nenhum pagamento registrado até o momento.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3.5">Gateway</th>
                        <th className="px-4 py-3.5">Método</th>
                        <th className="px-4 py-3.5">Valor</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Vencimento</th>
                        <th className="px-4 py-3.5">Pago Em</th>
                        <th className="px-4 py-3.5">Fatura</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagamentos.map(p => {
                        const st = STATUS_PAGAMENTO[p.status] ?? {
                          label: p.status,
                          cor: 'bg-slate-100 text-slate-600',
                        };
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3.5 font-bold uppercase text-slate-700">{p.gateway}</td>
                            <td className="px-4 py-3.5 text-slate-500">{p.payment_method}</td>
                            <td className="px-4 py-3.5 font-black text-slate-900">{fmtBRL(p.valor)}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2.5 py-0.5 rounded-full font-bold border ${st.cor}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500">{p.expires_at ? fmtDateTime(p.expires_at) : '—'}</td>
                            <td className="px-4 py-3.5 text-slate-500">{p.paid_at ? fmtDateTime(p.paid_at) : '—'}</td>
                            <td className="px-4 py-3.5">
                              {p.invoice_url ? (
                                <a
                                  href={p.invoice_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-bold text-blue-600 hover:underline"
                                >
                                  Ver fatura
                                </a>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ABA: RELATÓRIOS
        ══════════════════════════════════════════════════════════════════════ */}
        {aba === 'relatorios' && eventoSelecionado && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Total de Inscritos', val: insPorStatus.total, cor: 'text-slate-900', bg: 'bg-white' },
                { label: 'Confirmados', val: insPorStatus.confirmados, cor: 'text-blue-700', bg: 'bg-blue-50/50' },
                { label: 'Presentes (Check-in)', val: insPorStatus.presentes, cor: 'text-emerald-700', bg: 'bg-emerald-50/50' },
                { label: 'Ausentes', val: insPorStatus.confirmados - insPorStatus.presentes, cor: 'text-slate-500', bg: 'bg-slate-50' },
                { label: 'Lista de Espera', val: insPorStatus.listaEspera, cor: 'text-amber-700', bg: 'bg-amber-50/50' },
                { label: 'Cancelados', val: insPorStatus.cancelados, cor: 'text-rose-700', bg: 'bg-rose-50/50' },
              ].map(x => (
                <div key={x.label} className={`rounded-2xl border border-slate-200 p-4 text-center shadow-xs ${x.bg}`}>
                  <p className={`text-2xl font-black ${x.cor}`}>{x.val}</p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">{x.label}</p>
                </div>
              ))}
            </div>

            {/* Taxa de Presença */}
            {insPorStatus.confirmados > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Taxa Geral de Comparecimento</span>
                  <span className="text-emerald-700 text-sm font-black">
                    {Math.round((insPorStatus.presentes / insPorStatus.confirmados) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((insPorStatus.presentes / insPorStatus.confirmados) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  {insPorStatus.presentes} de {insPorStatus.confirmados} participantes confirmados compareceram ao evento.
                </p>
              </div>
            )}

            {/* Detalhes do Evento */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Ficha Técnica do Evento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Título</span>
                  <span className="font-bold text-slate-800">{eventoSelecionado.titulo}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Tipo</span>
                  <span className="font-bold text-slate-800">{tipoInfo(eventoSelecionado.tipo).label}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Congregação</span>
                  <span className="font-bold text-slate-800">{eventoSelecionado.congregacao_nome ?? 'Templo Sede'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Data e Horário de Início</span>
                  <span className="font-bold text-slate-800">{fmtDateTime(eventoSelecionado.data_inicio)}</span>
                </div>
                {eventoSelecionado.local_nome && (
                  <div>
                    <span className="text-slate-400 font-semibold block">Local</span>
                    <span className="font-bold text-slate-800">{eventoSelecionado.local_nome}</span>
                  </div>
                )}
                {eventoSelecionado.local_endereco && (
                  <div>
                    <span className="text-slate-400 font-semibold block">Endereço</span>
                    <span className="font-bold text-slate-800">{eventoSelecionado.local_endereco}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 font-semibold block">Inscrição</span>
                  <span className="font-bold text-slate-800">
                    {eventoSelecionado.evento_pago || (eventoSelecionado.valor_inscricao && eventoSelecionado.valor_inscricao > 0)
                      ? fmtBRL(eventoSelecionado.valor_inscricao)
                      : 'Gratuito'}
                  </span>
                </div>
                {(eventoSelecionado.evento_pago || (eventoSelecionado.valor_inscricao && eventoSelecionado.valor_inscricao > 0)) && (
                  <div>
                    <span className="text-slate-400 font-semibold block">Formas de Pagamento Aceitas</span>
                    <span className="font-bold text-slate-800">
                      {getFormasPagamentoLabels(eventoSelecionado.formas_pagamento).join(' · ') || '—'}
                    </span>
                  </div>
                )}
                {getBeneficiosLabels(eventoSelecionado).length > 0 && (
                  <div className="md:col-span-2">
                    <span className="text-slate-400 font-semibold block">Benefícios Inclusos</span>
                    <span className="font-bold text-emerald-700">
                      {getBeneficiosLabels(eventoSelecionado).join(' · ')}
                    </span>
                  </div>
                )}
              </div>

              {eventoSelecionado.descricao && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 font-semibold block text-xs mb-1">Descrição</span>
                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                    {eventoSelecionado.descricao}
                  </p>
                </div>
              )}

              {eventoSelecionado.programacao && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 font-semibold block text-xs mb-1">Cronograma / Programação</span>
                  <pre className="text-xs font-mono text-slate-700 bg-slate-50 p-3 rounded-xl whitespace-pre-line">
                    {eventoSelecionado.programacao}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => exportarCSVInscricoes(inscricoes, eventoSelecionado.titulo)}
                className="inline-flex items-center gap-2 bg-[#0f3460] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#162a47] transition shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Lista de Participantes (CSV)</span>
              </button>
            </div>
          </div>
        )}

        {/* Placeholder: Nenhum evento selecionado nas abas secundárias */}
        {aba !== 'eventos' && !eventoSelecionado && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
            <CalendarDays className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Selecione um evento para visualizar os dados</p>
            <p className="text-xs text-slate-500">
              Escolha um evento no seletor acima ou volte para a aba de Eventos.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
