'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { substituirPlaceholdersCertificado, isTemplateCategoriaEventos } from '@/lib/certificados-utils';
import { formatarEnderecoCongregacao, buildEventoPlaceholderMap } from '@/lib/evento-status-utils';
import { getFontesCertificadosHeadHtml, getFontesReadyPrintScript, buildTextoEstiloRenderizacao } from '@/lib/certificados-fontes';
import { formatCpf, validarCpf } from '@/lib/mascaras';
import { QRCodeSVG } from 'qrcode.react';
import { buildAccentInsensitiveRegex } from '@/lib/search-normalizer';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Bed,
  Building2,
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
  Lock,
  MapPin,
  MessageCircle,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
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
  is_sede?: boolean;
  endereco?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  campo_id?: string | null;
  supervisao_id?: string | null;
}

interface Membro {
  id: string;
  nome_completo: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  congregacao_id?: string | null;
  congregacao_nome?: string;
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
  whatsapp_grupo_url?: string | null;
  certificado_envio_auto_checkin?: boolean;
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
  congregacao_id?: string | null;
  congregacao_nome?: string;
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
  whatsapp_grupo_url: string;
  certificado_envio_auto_checkin: boolean;
};

type FormInscricao = {
  member_id: string;
  nome_externo: string;
  cpf: string;
  email_externo: string;
  telefone: string;
  congregacao_id: string;
  status: StatusInscricao;
  observacoes: string;
  com_hospedagem: boolean;
  status_hospedagem?: StatusHospedagem;
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
  { value: 'pix',      label: 'Pix' },
  { value: 'boleto',   label: 'Boleto' },
];

const FORMAS_PAGAMENTO_BALCAO_OPTIONS: { value: 'a_vista' | 'pix' | 'cortesia'; label: string; desc: string }[] = [
  { value: 'a_vista',  label: 'À vista',  desc: 'Pagamento presencial recebido no ato (dinheiro/cartão)' },
  { value: 'pix',      label: 'PIX',      desc: 'PIX presencial com confirmação imediata no balcão' },
  { value: 'cortesia', label: 'Cortesia', desc: 'Isenção / cortesia autorizada (R$ 0,00)' },
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
  aceita_inscricao: true,
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
  whatsapp_grupo_url: '',
  certificado_envio_auto_checkin: false,
};

const FORM_INSCRICAO_INICIAL: FormInscricao = {
  member_id: '',
  nome_externo: '',
  cpf: '',
  email_externo: '',
  telefone: '',
  congregacao_id: '',
  status: 'confirmado',
  observacoes: '',
  com_hospedagem: false,
};

// Formatação amigável para telefone no padrão brasileiro
function formatarTelefoneMembro(valor: string | null | undefined): string {
  if (!valor) return '';
  const digits = String(valor).replace(/\D/g, '');
  if (!digits) return String(valor).trim();
  const cleanDigits = (digits.startsWith('55') && digits.length > 11) ? digits.slice(2, 13) : digits.slice(0, 11);
  if (cleanDigits.length <= 2) return cleanDigits;
  if (cleanDigits.length <= 6) return `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2)}`;
  if (cleanDigits.length <= 10) {
    return `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2, 6)}-${cleanDigits.slice(6)}`;
  }
  return `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2, 7)}-${cleanDigits.slice(7)}`;
}

// Extração robusta e priorizada de WhatsApp / Telefone / Celular do cadastro de membro
function extrairTelefoneMembro(m: any): string {
  if (!m) return '';
  const cf = (m.custom_fields && typeof m.custom_fields === 'object') ? m.custom_fields : {};

  const buscarEmObjeto = (obj: Record<string, any>, prefixos: string[]): string | null => {
    // 1. Busca exata de chaves
    for (const p of prefixos) {
      if (typeof obj[p] === 'string' && obj[p].trim()) return obj[p].trim();
    }
    // 2. Busca case-insensitive
    const lowerPrefixes = prefixos.map(p => p.toLowerCase());
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && val.trim()) {
        const lowerKey = key.toLowerCase();
        if (lowerPrefixes.some(lp => lowerKey === lp || lowerKey.includes(lp))) {
          return val.trim();
        }
      }
    }
    return null;
  };

  // Prioridade 1: WhatsApp (coluna nativa whatsapp, ou custom_fields whatsapp/zap)
  const whats = (typeof m.whatsapp === 'string' && m.whatsapp.trim())
    ? m.whatsapp.trim()
    : buscarEmObjeto(cf, ['whatsapp', 'WhatsApp', 'zap', 'telefone_whatsapp', 'contato_whatsapp']);

  if (whats) return whats;

  // Prioridade 2: Celular / Telefone / Phone (coluna nativa celular, phone, telefone ou custom_fields)
  const celular = (typeof m.celular === 'string' && m.celular.trim()) ? m.celular.trim() : null;
  const phone = (typeof m.phone === 'string' && m.phone.trim()) ? m.phone.trim() : null;
  const telefone = (typeof m.telefone === 'string' && m.telefone.trim()) ? m.telefone.trim() : null;
  const telCf = buscarEmObjeto(cf, ['celular', 'telefone', 'phone', 'contato', 'fone']);

  return celular || phone || telefone || telCf || '';
}

function extrairEmailMembro(m: any): string {
  if (!m) return '';
  if (typeof m.email === 'string' && m.email.trim()) return m.email.trim();
  const cf = (m.custom_fields && typeof m.custom_fields === 'object') ? m.custom_fields : {};
  if (typeof cf.email === 'string' && cf.email.trim()) return cf.email.trim();
  for (const [k, v] of Object.entries(cf)) {
    if (k.toLowerCase().includes('email') && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

function extrairCpfMembro(m: any): string {
  if (!m) return '';
  if (typeof m.cpf === 'string' && m.cpf.trim()) return m.cpf.trim();
  const cf = (m.custom_fields && typeof m.custom_fields === 'object') ? m.custom_fields : {};
  if (typeof cf.cpf === 'string' && cf.cpf.trim()) return cf.cpf.trim();
  for (const [k, v] of Object.entries(cf)) {
    if (k.toLowerCase().includes('cpf') && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

// Normaliza nome completo para formato Title Case (Nome Próprio), preservando partículas e acentos
function formatarNomeProprio(nome: string | null | undefined): string {
  if (!nome || typeof nome !== 'string') return '';
  const preposicoes = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'para', 'com', 'por', 'a', 'o', 'as', 'os']);
  const partes = nome.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  return partes
    .map((parte, idx) => {
      if (idx > 0 && preposicoes.has(parte)) {
        return parte;
      }
      return parte.charAt(0).toUpperCase() + parte.slice(1);
    })
    .join(' ');
}

// Extrai congregação explicitamente informada ou vinculada à inscrição
function extrairCongregacaoInscricao(
  rawObs: string | null | undefined,
  member: any,
  congregacoesList: Congregacao[]
): { congregacao_id?: string; congregacao_nome: string } {
  // 1. Prioridade: Congregação salva nas observações estruturadas (ex: "Congregação: Templo Central / Sede")
  if (rawObs) {
    const match = rawObs.match(/Congregação:\s*([^|]+)/i);
    if (match && match[1]) {
      const nomeOuId = match[1].trim();
      const achada = congregacoesList.find(
        c => c.id === nomeOuId || c.nome.toLowerCase() === nomeOuId.toLowerCase()
      );
      if (achada) {
        return { congregacao_id: achada.id, congregacao_nome: achada.nome };
      }
      if (nomeOuId) {
        return { congregacao_nome: nomeOuId };
      }
    }
  }

  // 2. Prioridade: Relacionamento de membro cadastrado
  if (member) {
    if (member.congregacoes && member.congregacoes.nome) {
      return {
        congregacao_id: member.congregacoes.id || member.congregacao_id,
        congregacao_nome: member.congregacoes.nome,
      };
    }
    if (member.congregacao_id) {
      const achada = congregacoesList.find(c => c.id === member.congregacao_id);
      if (achada) {
        return { congregacao_id: achada.id, congregacao_nome: achada.nome };
      }
    }
  }

  return { congregacao_nome: 'Não informada' };
}

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

const isEventoPago = (ev?: { evento_pago?: boolean | null; valor_inscricao?: number | string | null } | null): boolean => {
  if (!ev) return false;
  const valor = typeof ev.valor_inscricao === 'number' ? ev.valor_inscricao : Number(ev.valor_inscricao) || 0;
  return Boolean(ev.evento_pago || valor > 0);
};

// Retorna a data no fuso de Brasília (America/Sao_Paulo / UTC-3) no formato YYYY-MM-DD
const hojeBrasiliaDataStr = (d: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
};

const mesAtualEvento = () => {
  const [y, m] = hojeBrasiliaDataStr().split('-');
  return `${y}-${m}`;
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
    'Congregação',
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
    i.congregacao_nome ?? 'Não informada',
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
  const [menuEventoAtivo, setMenuEventoAtivo] = useState<Evento | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{
    top: number;
    left: number;
    openUpwards: boolean;
    maxHeight: number;
  } | null>(null);

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
  const [previewCertificadoAberto, setPreviewCertificadoAberto] = useState(false);
  const [previewCertificadoData, setPreviewCertificadoData] = useState<{
    template: any;
    html: string;
    evento: any;
  } | null>(null);
  const [carregandoPreviewCert, setCarregandoPreviewCert] = useState(false);

  const optionsCertificados = useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>();
    for (const t of templatesCertificados) {
      if (t.id) map.set(t.id, t);
    }
    // Preservar modelo já selecionado no evento, mesmo se for UUID ou modelo arquivado
    if (formEvento.certificado_modelo_id) {
      const match = certTemplatesFull.find(t =>
        t.id === formEvento.certificado_modelo_id ||
        t.template_key === formEvento.certificado_modelo_id ||
        t.db_id === formEvento.certificado_modelo_id
      );
      if (match) {
        const canonicalKey = match.template_key || match.id || formEvento.certificado_modelo_id;
        const nome = match.nome || match.name || 'Certificado de Eventos';
        map.set(canonicalKey, { id: canonicalKey, nome });
        if (formEvento.certificado_modelo_id !== canonicalKey) {
          map.set(formEvento.certificado_modelo_id, { id: formEvento.certificado_modelo_id, nome });
        }
      } else if (!map.has(formEvento.certificado_modelo_id)) {
        map.set(formEvento.certificado_modelo_id, {
          id: formEvento.certificado_modelo_id,
          nome: 'Certificado Selecionado',
        });
      }
    }
    return Array.from(map.values());
  }, [templatesCertificados, formEvento.certificado_modelo_id, certTemplatesFull]);
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
  const [filtroCongInsc, setFiltroCongInsc] = useState('');
  const [showFormInsc, setShowFormInsc] = useState(false);
  const [editingInscId, setEditingInscId] = useState<string | null>(null);
  const [formInsc, setFormInsc] = useState<FormInscricao>(FORM_INSCRICAO_INICIAL);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [resultadosMembro, setResultadosMembro] = useState<Membro[]>([]);
  const [membroSelecionado, setMembroSelecionado] = useState<Membro | null>(null);
  const [duplicidadeAvisoInsc, setDuplicidadeAvisoInsc] = useState<string | null>(null);
  const [duplicidadeChecandoInsc, setDuplicidadeChecandoInsc] = useState(false);
  const inputBuscaMembroRef = useRef<HTMLInputElement>(null);

  // Auto-foco imediato no campo Nome/Buscar Inscrito ao abrir o modal
  useEffect(() => {
    if (showFormInsc) {
      const timer = setTimeout(() => {
        inputBuscaMembroRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showFormInsc]);

  const [inscricaoParaExcluir, setInscricaoParaExcluir] = useState<Inscricao | null>(null);
  const [excluindoInsc, setExcluindoInsc] = useState(false);

  // ── Tab Pagamentos ────────────────────────────────────────────────────────
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loadingPag, setLoadingPag] = useState(false);

  // ── Tab Check-in ──────────────────────────────────────────────────────────
  const [buscaCheckin, setBuscaCheckin] = useState('');

  // ── Modal Atendimento de Balcão (Inscrição Presencial) ────────────────────
  const [showBalcaoModal, setShowBalcaoModal] = useState(false);
  const [balcaoEventoId, setBalcaoEventoId] = useState<string>('');
  const [balcaoMembro, setBalcaoMembro] = useState<Membro | null>(null);
  const [balcaoBuscaMembro, setBalcaoBuscaMembro] = useState('');
  const [balcaoResultadosMembro, setBalcaoResultadosMembro] = useState<Membro[]>([]);
  const [balcaoNome, setBalcaoNome] = useState('');
  const [balcaoCpf, setBalcaoCpf] = useState('');
  const [balcaoEmail, setBalcaoEmail] = useState('');
  const [balcaoTelefone, setBalcaoTelefone] = useState('');
  const [balcaoCongregacaoId, setBalcaoCongregacaoId] = useState<string>('');
  const [balcaoHospedagem, setBalcaoHospedagem] = useState(false);
  const [balcaoFormaPagamento, setBalcaoFormaPagamento] = useState<'a_vista' | 'pix' | 'cortesia'>('a_vista');
  const [balcaoJustificativa, setBalcaoJustificativa] = useState('');
  const [balcaoSalvando, setBalcaoSalvando] = useState(false);
  const [balcaoDuplicidadeAviso, setBalcaoDuplicidadeAviso] = useState<string | null>(null);
  const [balcaoDuplicidadeChecando, setBalcaoDuplicidadeChecando] = useState(false);
  const [balcaoSucesso, setBalcaoSucesso] = useState<{
    inscricaoId: string;
    evento: Evento;
    nomeParticipante: string;
    emailParticipante?: string;
    telefoneParticipante?: string;
    formaPagamento: string;
    valorPago: number;
    comHospedagem: boolean;
    temBrinde?: boolean;
    dataHora: string;
  } | null>(null);

  // ── Modal Link Público de Check-in ────────────────────────────────────────
  const [showLinkCheckinModal, setShowLinkCheckinModal] = useState(false);
  const [gerandoRelatorioPdf, setGerandoRelatorioPdf] = useState(false);
  const [linkCheckinUrl, setLinkCheckinUrl] = useState('');
  const [linkCheckinExpiraEm, setLinkCheckinExpiraEm] = useState<string | null>(null);
  const [loadingLinkCheckin, setLoadingLinkCheckin] = useState(false);
  const [linkCheckinCopiado, setLinkCheckinCopiado] = useState(false);

  // ── Controle do menu dropdown de ações dos eventos (Portal) ───────────────
  const fecharMenuAcoes = useCallback(() => {
    setMenuAbertoId(null);
    setMenuEventoAtivo(null);
    setDropdownCoords(null);
  }, []);

  const toggleMenuAcoes = useCallback((evento: Evento, btnElement: HTMLElement) => {
    if (menuAbertoId === evento.id) {
      fecharMenuAcoes();
      return;
    }

    const btnRect = btnElement.getBoundingClientRect();
    const menuWidth = 208; // w-52 = 208px

    // Estima a altura do menu conforme as opções ativas para este evento:
    let estimatedHeight = 136; // 3 itens base + padding
    if (evento.is_publico && evento.slug) estimatedHeight += 40;
    if (scope.canDelete) estimatedHeight += 46;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;

    // Abre para cima se o espaço abaixo for insuficiente e houver mais espaço acima
    const openUpwards = spaceBelow < (estimatedHeight + 12) && spaceAbove > spaceBelow;

    let top: number;
    let availableHeight: number;
    if (openUpwards) {
      availableHeight = Math.max(140, spaceAbove - 16);
      top = Math.max(8, btnRect.top - Math.min(estimatedHeight, availableHeight) - 6);
    } else {
      availableHeight = Math.max(140, spaceBelow - 16);
      top = Math.min(viewportHeight - 8, btnRect.bottom + 6);
    }

    const idealLeft = btnRect.right - menuWidth;
    const left = Math.max(8, Math.min(viewportWidth - menuWidth - 8, idealLeft));

    setDropdownCoords({
      top,
      left,
      openUpwards,
      maxHeight: Math.min(estimatedHeight + 10, availableHeight),
    });
    setMenuEventoAtivo(evento);
    setMenuAbertoId(evento.id);
  }, [menuAbertoId, scope.canDelete, fecharMenuAcoes]);

  useEffect(() => {
    if (!menuAbertoId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fecharMenuAcoes();
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest?.('[data-menu-portal]')) {
        return;
      }
      fecharMenuAcoes();
    };

    const handleResize = () => {
      fecharMenuAcoes();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [menuAbertoId, fecharMenuAcoes]);

  // ── Carregar Templates de Certificados do Tenant Dinamicamente ─────────────
  const carregarTemplatesCertificados = useCallback(async (midParam?: string) => {
    const targetMid = midParam || ministryId;
    if (!targetMid) return;
    try {
      const { data: certRows, error: certErr } = await supabase
        .from('certificados_templates')
        .select('id, template_key, name, template_data, is_active, created_at, updated_at')
        .eq('ministry_id', targetMid)
        .order('name');

      let rows = (certRows as any[]) || [];

      // Se ainda não houver templates salvos no banco para o tenant (primeiro acesso),
      // acionar a rotina oficial de carga/semeadura como fallback seguro
      if (rows.length === 0 && !certErr) {
        try {
          const syncRes = await loadCertificadosTemplatesForCurrentUser(supabase);
          if (syncRes?.templates && Array.isArray(syncRes.templates)) {
            const { data: refetched } = await supabase
              .from('certificados_templates')
              .select('id, template_key, name, template_data, is_active, created_at, updated_at')
              .eq('ministry_id', targetMid)
              .order('name');
            rows = (refetched as any[]) || syncRes.templates.map((t: any) => ({
              id: t.id,
              template_key: t.template_key || t.id,
              name: t.nome || t.name,
              template_data: t,
              is_active: t.ativo !== false,
            }));
          }
        } catch {
          // fallback silencioso
        }
      }

      const fullTemplates = rows.map((r: any) => {
        const td = typeof r.template_data === 'string'
          ? (() => { try { return JSON.parse(r.template_data); } catch { return {}; } })()
          : (r.template_data || {});
        const key = r.template_key || td.id || r.id;
        const nome = td.nome || r.name || 'Certificado';
        const rawCat = td.categoria || td.category || td.tipo || '';
        const categoria = rawCat.toString().trim().toLowerCase();
        return {
          ...td,
          db_id: r.id,
          template_key: key,
          id: key,
          nome,
          categoria,
          ativo: r.is_active ?? td.ativo ?? true,
        };
      });

      setCertTemplatesFull(fullTemplates);

      // Filtrar estritamente templates pertencentes à categoria 'eventos' / 'evento'
      const elegiveis = fullTemplates.filter((t: any) => isTemplateCategoriaEventos(t));

      setTemplatesCertificados(
        elegiveis.map((t: any) => ({
          id: t.id,
          nome: t.nome,
        }))
      );
    } catch (err) {
      console.warn('Erro ao carregar configurações/templates de certificados:', err);
    }
  }, [ministryId, supabase]);

  // Sincronização automática ao focar a aba (ex: após configurar certificados em outra aba)
  useEffect(() => {
    const handleFocus = () => {
      if (ministryId) {
        carregarTemplatesCertificados(ministryId);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [ministryId, carregarTemplatesCertificados]);

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

      const [orgService, { data: mu }, { data: congsDb }, { data: camposSedeDb }] = await Promise.all([
        obterEstruturaOrganizacionalService(mid, supabase),
        supabase
          .from('ministry_users')
          .select('permissions, role')
          .eq('user_id', user.id)
          .eq('ministry_id', mid)
          .single(),
        supabase
          .from('congregacoes')
          .select('id, nome, endereco, cidade, municipio, uf, cep, campo_id, supervisao_id')
          .eq('ministry_id', mid),
        supabase
          .from('campos')
          .select('id')
          .eq('ministry_id', mid)
          .eq('is_sede', true),
      ]);

      const congsMap = new Map<string, any>();
      (congsDb || []).forEach((c: any) => {
        congsMap.set(c.id, c);
      });

      const sedeCamposSet = new Set((camposSedeDb || []).map((c: any) => c.id));
      const div1Registros = orgService.getRegistros(1);
      const div1Map = new Map<string, any>();
      div1Registros.forEach(r => div1Map.set(r.id, r));

      const div1Options = orgService.getOptionsFormatadas(1);
      const listaCongregacoes: Congregacao[] = div1Options.map(opt => {
        const dbItem = congsMap.get(opt.id) || {};
        const orgItem = div1Map.get(opt.id);
        const campoId = dbItem.campo_id || opt.campo_id || orgItem?.parentId;
        const isSedeOficial = Boolean(
          orgItem?.isSede ||
          (campoId && sedeCamposSet.has(campoId))
        );

        return {
          id: opt.id,
          nome: opt.nome,
          is_sede: isSedeOficial,
          endereco: dbItem.endereco || null,
          cidade: dbItem.cidade || null,
          municipio: dbItem.municipio || null,
          uf: dbItem.uf || null,
          cep: dbItem.cep || null,
          campo_id: campoId || null,
          supervisao_id: dbItem.supervisao_id || opt.supervisao_id || null,
        };
      });
      setCongregacoes(listaCongregacoes);

      const perms = ((mu as { permissions?: string[] } | null)?.permissions ?? []);
      const role = ((mu as { role?: string } | null)?.role ?? '');
      const isAdmin = userCtx.isAdmin || perms.includes('ADMINISTRADOR') || role === 'admin';
      const isSecret =
        perms.includes('SECRETARIO') ||
        perms.includes('SECRETARIO_GERAL') ||
        perms.includes('SECRETARIA') ||
        userCtx.nivel === 'secretario_geral' ||
        userCtx.nivel === 'secretaria_local' ||
        userCtx.nivel === 'auxiliar_secretaria';
      const isFinanc =
        perms.includes('FINANCEIRO') ||
        perms.includes('TESOUREIRO_GERAL') ||
        perms.includes('TESOURARIA_LOCAL') ||
        perms.includes('FINANCEIRO_LOCAL') ||
        userCtx.nivel === 'tesoureiro_geral' ||
        userCtx.nivel === 'financeiro' ||
        userCtx.nivel === 'tesouraria_local' ||
        userCtx.nivel === 'financeiro_local';
      setScope({
        canWrite: isAdmin || isSecret,
        canDelete: isAdmin,
        canFinanceiro: isAdmin || isFinanc,
      });

      // Carregar configurações institucionais e modelos de certificados disponíveis para o tenant
      try {
        const config = await fetchConfiguracaoIgrejaFromSupabase(supabase, mid);
        if (config) setConfigIgreja(config);
        await carregarTemplatesCertificados(mid);
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

      // Referência temporal no fuso de Brasília (America/Sao_Paulo / UTC-3)
      const hojeStr = hojeBrasiliaDataStr();
      const hojeInicio = `${hojeStr}T00:00:00`;

      // Aplicação dos Períodos
      if (periodo === 'todos') {
        // Regra 1: Agenda padrão operacional
        // Exibe eventos futuros (data_inicio >= hojeInicio), eventos em andamento,
        // ou eventos com status programado que ainda estejam no ar/vigentes por data_fim
        if (!status) {
          q = q.or(`data_inicio.gte.${hojeInicio},status.eq.em_andamento,status.eq.programado,data_fim.gte.${hojeInicio}`);
          q = q.neq('status', 'cancelado').neq('status', 'realizado');
        } else {
          q = q.or(`data_inicio.gte.${hojeInicio},data_fim.gte.${hojeInicio},status.eq.${status}`);
        }
      } else if (periodo === 'este_mes') {
        const [y, m] = hojeStr.split('-');
        const mesAtualStr = `${y}-${m}`;
        const proxMesStr = mesProximoEvento(mesAtualStr);
        q = q.gte('data_inicio', `${mesAtualStr}-01T00:00:00`).lt('data_inicio', `${proxMesStr}-01T00:00:00`);
      } else if (periodo === 'proximo_mes') {
        const [y, m] = hojeStr.split('-');
        const mesAtualStr = `${y}-${m}`;
        const proxMesStr = mesProximoEvento(mesAtualStr);
        const aposProxMesStr = mesProximoEvento(proxMesStr);
        q = q.gte('data_inicio', `${proxMesStr}-01T00:00:00`).lt('data_inicio', `${aposProxMesStr}-01T00:00:00`);
      } else if (periodo === 'proximos_30') {
        const [y, m, d] = hojeStr.split('-').map(Number);
        const d30 = new Date(y, m - 1, d + 30);
        const d30Str = hojeBrasiliaDataStr(d30);
        q = q.gte('data_inicio', hojeInicio).lte('data_inicio', `${d30Str}T23:59:59`);
      } else if (periodo === 'proximos_90') {
        const [y, m, d] = hojeStr.split('-').map(Number);
        const d90 = new Date(y, m - 1, d + 90);
        const d90Str = hojeBrasiliaDataStr(d90);
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
        .select('*, members(name, email, phone, celular, whatsapp, congregacao_id, custom_fields, congregacoes(id, nome))')
        .eq('evento_id', eventoId)
        .order('created_at', { ascending: false });

      if (error) {
        showModal('Erro', error.message, 'error');
        setLoadingInsc(false);
        return;
      }

      type RawInsc = Inscricao & {
        members?: {
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          celular?: string | null;
          whatsapp?: string | null;
          congregacao_id?: string | null;
          custom_fields?: any;
          congregacoes?: { id?: string; nome?: string } | null;
        } | null;
      };
      setInscricoes(
        ((data ?? []) as RawInsc[]).map(i => {
          const rawMemberTel = i.members ? extrairTelefoneMembro(i.members) : '';
          const memberEmail = i.members ? extrairEmailMembro(i.members) : '';
          const { congregacao_id: congIdExtraida, congregacao_nome: congNomeExtraido } =
            extrairCongregacaoInscricao(i.observacoes, i.members, congregacoes);
          return {
            ...i,
            nome_display: i.member_id ? i.members?.name ?? i.nome_externo ?? '—' : i.nome_externo ?? '—',
            email_externo: i.email_externo || memberEmail || null,
            telefone: i.telefone || (rawMemberTel ? formatarTelefoneMembro(rawMemberTel) : null),
            congregacao_id: congIdExtraida || null,
            congregacao_nome: congNomeExtraido || 'Não informada',
          };
        })
      );
      setLoadingInsc(false);
    },
    [supabase, congregacoes]
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

  // ── Buscar membros ─────────────────────────────────────────────────────────
  const buscarMembro = useCallback(
    async (q: string) => {
      if (!ministryId || q.length < 3) {
        setResultadosMembro([]);
        return;
      }
      const regex = buildAccentInsensitiveRegex(q);
      let query = supabase
        .from('members')
        .select('id, name, email, phone, celular, whatsapp, cpf, congregacao_id, custom_fields')
        .eq('ministry_id', ministryId);

      if (regex) {
        query = query.filter('name', 'imatch', regex);
      } else {
        query = query.ilike('name', `%${q}%`);
      }

      const { data } = await query.limit(8);

      const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));

      setResultadosMembro(
        ((data ?? []) as any[]).map(m => {
          const rawTel = extrairTelefoneMembro(m);
          const email = extrairEmailMembro(m);
          const rawCpf = extrairCpfMembro(m);
          const congNome = m.congregacao_id ? congMap.get(m.congregacao_id) : undefined;

          return {
            id: m.id,
            nome_completo: m.name ?? '',
            email,
            telefone: formatarTelefoneMembro(rawTel),
            cpf: rawCpf ? formatCpf(rawCpf) : '',
            congregacao_id: m.congregacao_id || null,
            congregacao_nome: congNome,
          };
        })
      );
    },
    [ministryId, supabase, congregacoes]
  );

  useEffect(() => {
    buscarMembro(buscaMembro);
  }, [buscaMembro, buscarMembro]);

  const buscarMembroBalcao = useCallback(
    async (q: string) => {
      if (!ministryId || q.length < 3) {
        setBalcaoResultadosMembro([]);
        return;
      }
      const regex = buildAccentInsensitiveRegex(q);
      let query = supabase
        .from('members')
        .select('id, name, email, phone, celular, whatsapp, cpf, congregacao_id, custom_fields')
        .eq('ministry_id', ministryId);

      if (regex) {
        query = query.filter('name', 'imatch', regex);
      } else {
        query = query.ilike('name', `%${q}%`);
      }

      const { data } = await query.limit(8);

      const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));

      setBalcaoResultadosMembro(
        ((data ?? []) as any[]).map(m => {
          const rawTel = extrairTelefoneMembro(m);
          const email = extrairEmailMembro(m);
          const rawCpf = extrairCpfMembro(m);
          const congNome = m.congregacao_id ? congMap.get(m.congregacao_id) : undefined;

          return {
            id: m.id,
            nome_completo: m.name ?? '',
            email,
            telefone: formatarTelefoneMembro(rawTel),
            cpf: rawCpf ? formatCpf(rawCpf) : '',
            congregacao_id: m.congregacao_id || null,
            congregacao_nome: congNome,
          };
        })
      );
    },
    [ministryId, supabase, congregacoes]
  );

  useEffect(() => {
    buscarMembroBalcao(balcaoBuscaMembro);
  }, [balcaoBuscaMembro, buscarMembroBalcao]);

  // ── Verificação em tempo real de duplicidade no formulário de inscrição ───────
  useEffect(() => {
    if (!showFormInsc || !eventoSelecionado) {
      setDuplicidadeAvisoInsc(null);
      return;
    }

    const memberId = membroSelecionado?.id || formInsc.member_id || null;
    const cpfLimpo = (formInsc.cpf || '').replace(/\D/g, '');

    if (!memberId && (!cpfLimpo || cpfLimpo.length !== 11)) {
      setDuplicidadeAvisoInsc(null);
      return;
    }

    let cancelado = false;
    const checar = async () => {
      setDuplicidadeChecandoInsc(true);
      try {
        const res = await fetch('/api/v1/eventos/inscricao/verificar-duplicidade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento_id: eventoSelecionado.id,
            member_id: memberId,
            cpf: cpfLimpo.length === 11 ? cpfLimpo : null,
            ignore_inscricao_id: editingInscId || null,
          }),
        });
        if (!cancelado && res.ok) {
          const data = await res.json();
          if (data.duplicado) {
            setDuplicidadeAvisoInsc(data.mensagem || 'Este participante já possui uma inscrição ativa neste evento.');
          } else {
            setDuplicidadeAvisoInsc(null);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar duplicidade de inscrição:', err);
      } finally {
        if (!cancelado) setDuplicidadeChecandoInsc(false);
      }
    };

    const timer = setTimeout(checar, 250);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [showFormInsc, eventoSelecionado, membroSelecionado, formInsc.member_id, formInsc.cpf, editingInscId]);

  // ── Verificação em tempo real de duplicidade no modal de Balcão ───────────────
  useEffect(() => {
    if (!showBalcaoModal || !balcaoEventoId) {
      setBalcaoDuplicidadeAviso(null);
      return;
    }

    const memberId = balcaoMembro?.id || null;
    const cpfLimpo = (balcaoCpf || '').replace(/\D/g, '');

    if (!memberId && (!cpfLimpo || cpfLimpo.length !== 11)) {
      setBalcaoDuplicidadeAviso(null);
      return;
    }

    let cancelado = false;
    const checar = async () => {
      setBalcaoDuplicidadeChecando(true);
      try {
        const res = await fetch('/api/v1/eventos/inscricao/verificar-duplicidade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento_id: balcaoEventoId,
            member_id: memberId,
            cpf: cpfLimpo.length === 11 ? cpfLimpo : null,
          }),
        });
        if (!cancelado && res.ok) {
          const data = await res.json();
          if (data.duplicado) {
            setBalcaoDuplicidadeAviso(data.mensagem || 'Este participante já possui uma inscrição ativa neste evento.');
          } else {
            setBalcaoDuplicidadeAviso(null);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar duplicidade no balcão:', err);
      } finally {
        if (!cancelado) setBalcaoDuplicidadeChecando(false);
      }
    };

    const timer = setTimeout(checar, 250);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [showBalcaoModal, balcaoEventoId, balcaoMembro, balcaoCpf]);

  // ── Memos & Paginação ──────────────────────────────────────────────────────
  const eventosPagos = useMemo(
    () => eventos.filter(e => isEventoPago(e)),
    [eventos]
  );

  useEffect(() => {
    if (aba === 'pagamentos') {
      if (eventoSelecionado && !isEventoPago(eventoSelecionado)) {
        const primeiroPago = eventosPagos[0] || null;
        setEventoSelecionado(primeiroPago);
      } else if (!eventoSelecionado && eventosPagos.length > 0) {
        setEventoSelecionado(eventosPagos[0]);
      }
    }
  }, [aba, eventoSelecionado, eventosPagos]);

  // Se o modal de balcão estiver aberto com um evento gratuito ou se o evento selecionado mudar para gratuito, fecha o balcão
  useEffect(() => {
    if (showBalcaoModal && balcaoEventoId) {
      const evAtual = eventos.find(e => e.id === balcaoEventoId);
      if (evAtual && !isEventoPago(evAtual)) {
        setShowBalcaoModal(false);
        setAba('inscricoes');
      }
    }
  }, [showBalcaoModal, balcaoEventoId, eventos]);

  useEffect(() => {
    if (aba === 'pagamentos' && eventoSelecionado && isEventoPago(eventoSelecionado)) {
      carregarPagamentos(eventoSelecionado.id);
    }
  }, [aba, eventoSelecionado, carregarPagamentos]);

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
    if (filtroCongInsc) {
      const congAlvo = congregacoes.find(c => c.id === filtroCongInsc);
      const nomeAlvo = congAlvo?.nome.toLowerCase();
      list = list.filter(i => {
        if (i.congregacao_id && i.congregacao_id === filtroCongInsc) return true;
        if (nomeAlvo && i.congregacao_nome && i.congregacao_nome.toLowerCase() === nomeAlvo) return true;
        return false;
      });
    }
    if (buscaInsc) {
      const t = buscaInsc.toLowerCase();
      list = list.filter(
        i =>
          (i.nome_display ?? '').toLowerCase().includes(t) ||
          (i.email_externo ?? '').toLowerCase().includes(t) ||
          (i.telefone ?? '').toLowerCase().includes(t) ||
          (i.congregacao_nome ?? '').toLowerCase().includes(t)
      );
    }
    return list;
  }, [inscricoes, filtroStatusInsc, filtroCongInsc, congregacoes, buscaInsc]);

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

  // ── Gestão de Endereço Automático e Vínculo de Congregação ────────────────
  const ultimoEnderecoAutoPreenchido = useRef<string>('');

  const resolverEnderecoPorCongregacao = useCallback(
    (congId: string): string => {
      // 1. Templo Sede (quando congregação_id estiver vazia)
      if (!congId) {
        const sedeCong = congregacoes.find(c => c.is_sede);
        if (sedeCong) {
          const endSede = formatarEnderecoCongregacao(sedeCong);
          if (endSede) return endSede;
        }
        // Fallback: endereço institucional cadastrado no tenant
        return (configIgreja.endereco || '').trim();
      }

      // 2. Congregação específica selecionada
      const cong = congregacoes.find(c => c.id === congId);
      if (!cong) return '';

      const endCong = formatarEnderecoCongregacao(cong);
      if (endCong) return endCong;

      // Se for identificada oficialmente como sede e não tiver endereço específico, usa fallback do tenant
      if (cong.is_sede) {
        return (configIgreja.endereco || '').trim();
      }

      // Congregação comum sem endereço: vazio para preenchimento manual
      return '';
    },
    [congregacoes, configIgreja.endereco]
  );

  const handleCongregacaoChange = (novaCongId: string) => {
    const novoEndereco = resolverEnderecoPorCongregacao(novaCongId);
    const enderecoAtual = (formEvento.local_endereco || '').trim();
    const ultimoAuto = (ultimoEnderecoAutoPreenchido.current || '').trim();

    // Se o operador editou manualmente o endereço para algo diferente do último auto-preenchido
    const foiEditadoManualmente = enderecoAtual !== '' && enderecoAtual !== ultimoAuto;

    if (foiEditadoManualmente && novoEndereco !== enderecoAtual) {
      const confirmar = window.confirm(
        'O endereço foi alterado manualmente. Deseja substituí-lo pelo endereço cadastrado da congregação selecionada?'
      );
      if (confirmar) {
        setFormEvento(f => ({ ...f, congregacao_id: novaCongId, local_endereco: novoEndereco }));
        ultimoEnderecoAutoPreenchido.current = novoEndereco;
      } else {
        setFormEvento(f => ({ ...f, congregacao_id: novaCongId }));
      }
    } else {
      setFormEvento(f => ({ ...f, congregacao_id: novaCongId, local_endereco: novoEndereco }));
      ultimoEnderecoAutoPreenchido.current = novoEndereco;
    }
  };

  const handleAbrirNovoEvento = () => {
    setEditandoId(null);
    const endInicial = resolverEnderecoPorCongregacao('');
    ultimoEnderecoAutoPreenchido.current = endInicial;
    if (ministryId) {
      carregarTemplatesCertificados(ministryId);
    }
    setFormEvento({
      ...FORM_EVENTO_INICIAL,
      congregacao_id: '',
      local_endereco: endInicial,
      certificado_modelo_id: templatesCertificados.length === 1 ? templatesCertificados[0].id : '',
    });
    setShowForm(true);
    if (aba !== 'eventos') setAba('eventos');
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

    // Modelo de Certificado: validação e resolução precisa
    let modeloCertId = formEvento.certificado_modelo_id;
    if (formEvento.inclui_certificado) {
      if (!modeloCertId && templatesCertificados.length === 1) {
        modeloCertId = templatesCertificados[0].id;
      } else if (!modeloCertId && templatesCertificados.length > 1) {
        showModal('Modelo de Certificado obrigatório', 'Por favor, selecione qual modelo de certificado deseja utilizar para este evento.', 'error');
        return;
      } else if (!modeloCertId && templatesCertificados.length === 0) {
        showModal('Nenhum modelo disponível', 'Não há modelos de certificado disponíveis na categoria Eventos. Cadastre um modelo em Configurações > Certificados antes de habilitar a emissão de certificados.', 'error');
        return;
      }
    }

    // Resolução oficial do nome do local para preservar compatibilidade com APIs/DB/Relatórios
    let localNomeFinal = '';
    if (formEvento.congregacao_id) {
      const congSel = congregacoes.find(c => c.id === formEvento.congregacao_id);
      localNomeFinal = congSel?.nome || formEvento.local_nome || 'Congregação';
    } else {
      const sedeCong = congregacoes.find(c => c.is_sede);
      localNomeFinal = sedeCong?.nome || configIgreja?.nome || 'Templo Sede';
    }

    setSalvando(true);

    let payload: Record<string, any> = {
      ministry_id: ministryId,
      congregacao_id: formEvento.congregacao_id || null,
      titulo: formEvento.titulo.trim(),
      descricao: formEvento.descricao || null,
      tipo: formEvento.tipo,
      data_inicio: formEvento.data_inicio,
      data_fim: formEvento.data_fim || null,
      local_nome: localNomeFinal,
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
      certificado_envio_auto_checkin: formEvento.inclui_certificado ? Boolean(formEvento.certificado_envio_auto_checkin) : false,
      status: formEvento.status,
      vagas_hospedagem: formEvento.inclui_hospedagem && formEvento.vagas_hospedagem ? parseInt(formEvento.vagas_hospedagem) : null,
      descricao_hospedagem: formEvento.inclui_hospedagem ? (formEvento.descricao_hospedagem || null) : null,
      programacao: formEvento.programacao || null,
      whatsapp_grupo_url: formEvento.whatsapp_grupo_url?.trim() || null,
      criado_por: user?.id ?? null,
      updated_at: new Date().toISOString(),
    };

    let { error } = editandoId
      ? await supabase.from('eventos').update(payload).eq('id', editandoId)
      : await supabase.from('eventos').insert(payload);

    // Compatibilidade resiliente caso colunas novas ainda estejam em processo de aplicação na migration
    if (error && (error.message?.includes('whatsapp_grupo_url') || error.message?.includes('certificado_envio_auto_checkin') || error.code === '42703')) {
      console.warn('Coluna opcional ausente no banco remoto. Reenviando payload sem ela:', error.message);
      delete payload.whatsapp_grupo_url;
      delete payload.certificado_envio_auto_checkin;
      const retryResult = editandoId
        ? await supabase.from('eventos').update(payload).eq('id', editandoId)
        : await supabase.from('eventos').insert(payload);
      error = retryResult.error;
    }

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

    if (editandoId && eventoSelecionado?.id === editandoId) {
      setEventoSelecionado(prev => prev ? ({ ...prev, ...payload, id: editandoId } as Evento) : null);
    }

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
    const endEvento = e.local_endereco ?? '';
    ultimoEnderecoAutoPreenchido.current = endEvento;

    if (ministryId) {
      carregarTemplatesCertificados(ministryId);
    }

    let certModeloIdFinal = e.certificado_modelo_id ?? '';
    const matchCert = certTemplatesFull.find(t =>
      t.id === certModeloIdFinal ||
      t.template_key === certModeloIdFinal ||
      t.db_id === certModeloIdFinal
    );
    if (matchCert) {
      certModeloIdFinal = matchCert.id || matchCert.template_key || certModeloIdFinal;
    }

    setFormEvento({
      congregacao_id: e.congregacao_id ?? '',
      titulo: e.titulo,
      descricao: e.descricao ?? '',
      tipo: e.tipo,
      data_inicio: e.data_inicio.slice(0, 16),
      data_fim: e.data_fim ? e.data_fim.slice(0, 16) : '',
      local_nome: e.local_nome ?? '',
      local_endereco: endEvento,
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
      certificado_modelo_id: certModeloIdFinal,
      certificado_envio_auto_checkin: Boolean(e.certificado_envio_auto_checkin),
      status: e.status,
      vagas_hospedagem: e.vagas_hospedagem?.toString() ?? '',
      descricao_hospedagem: e.descricao_hospedagem ?? '',
      programacao: e.programacao ?? '',
      whatsapp_grupo_url: e.whatsapp_grupo_url ?? '',
    });
    setShowForm(true);
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
  const abrirNovaInscricao = () => {
    // Para eventos pagos, inscrições administrativas devem ser realizadas exclusivamente via Balcão
    if (eventoSelecionado && isEventoPago(eventoSelecionado)) {
      abrirBalcao(eventoSelecionado.id);
      return;
    }
    setEditingInscId(null);
    setFormInsc(FORM_INSCRICAO_INICIAL);
    setMembroSelecionado(null);
    setBuscaMembro('');
    setShowFormInsc(true);
  };

  const abrirEditarInscricao = (insc: Inscricao) => {
    setEditingInscId(insc.id);
    const cpfExtraido = (insc as any).cpf || '';
    const rawObs = insc.observacoes || '';
    let congIdExtraida = '';
    const matchCong = rawObs.match(/Congregação:\s*([^|]+)/i);
    if (matchCong && matchCong[1]) {
      const nomeOuId = matchCong[1].trim();
      const achada = congregacoes.find(c => c.nome.toLowerCase() === nomeOuId.toLowerCase() || c.id === nomeOuId);
      if (achada) congIdExtraida = achada.id;
    }

    setFormInsc({
      member_id: insc.member_id || '',
      nome_externo: insc.nome_externo || (!insc.member_id ? insc.nome_display || '' : ''),
      cpf: cpfExtraido ? formatCpf(cpfExtraido) : '',
      email_externo: insc.email_externo || '',
      telefone: insc.telefone || '',
      congregacao_id: congIdExtraida,
      status: insc.status || 'confirmado',
      observacoes: insc.observacoes || '',
      com_hospedagem: Boolean(insc.com_hospedagem),
    });
    if (insc.member_id) {
      setMembroSelecionado({
        id: insc.member_id,
        nome_completo: insc.nome_display || '',
        cpf: cpfExtraido ? formatCpf(cpfExtraido) : '',
      });
      setBuscaMembro(insc.nome_display || '');
    } else {
      setMembroSelecionado(null);
      setBuscaMembro(insc.nome_display || insc.nome_externo || '');
    }
    setShowFormInsc(true);
  };

  const handleSaveInscricao = async () => {
    if (!ministryId || !eventoSelecionado) return;

    // Inscrições administrativas novas em eventos pagos devem ser realizadas obrigatoriamente pelo Balcão
    if (!editingInscId && isEventoPago(eventoSelecionado)) {
      showModal(
        'Inscrição em Evento Pago',
        'Inscrições administrativas em eventos pagos devem ser realizadas exclusivamente através do Balcão para garantir o registro do pagamento ou cortesia.',
        'info'
      );
      setShowFormInsc(false);
      abrirBalcao(eventoSelecionado.id);
      return;
    }

    const temMembro = !!membroSelecionado;
    const nomeDigitado = (formInsc.nome_externo || buscaMembro).trim();
    if (!temMembro && !nomeDigitado) {
      showModal('Campo obrigatório', 'Informe o nome do participante ou selecione um membro cadastrado.', 'error');
      return;
    }

    // Validação de CPF caso preenchido
    const cpfLimpo = formInsc.cpf.replace(/\D/g, '');
    if (cpfLimpo) {
      if (!validarCpf(cpfLimpo)) {
        showModal('CPF inválido', 'O CPF informado não é válido. Por favor, verifique os dígitos.', 'error');
        return;
      }
    }

    // Normalização do nome para Title Case (Nome Próprio)
    const nomeNormalizado = formatarNomeProprio(temMembro ? membroSelecionado.nome_completo : nomeDigitado);

    // Regra: manter status padrão Confirmado para o modal administrativo
    let statusFinal: StatusInscricao = 'confirmado';
    if (!editingInscId && statusFinal === 'confirmado' && eventoSelecionado.capacidade != null) {
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

    // Preparar observação estruturada com congregação e CPF quando aplicável
    const congSelecionada = congregacoes.find(c => c.id === formInsc.congregacao_id);
    const congNomeFinal = congSelecionada?.nome || (temMembro ? membroSelecionado.congregacao_nome : null);

    let obsLimpa = (formInsc.observacoes || '')
      .split('|')
      .map(p => p.trim())
      .filter(p => !p.toLowerCase().startsWith('congregação:') && !p.toLowerCase().startsWith('cpf:'))
      .join(' | ');

    const tagsAdicionais = [
      formInsc.cpf.trim() ? `CPF: ${formInsc.cpf.trim()}` : null,
      congNomeFinal ? `Congregação: ${congNomeFinal}` : null,
    ].filter(Boolean);

    const observacoesFinais = [
      obsLimpa.trim() || null,
      tagsAdicionais.length > 0 ? tagsAdicionais.join(' | ') : null,
    ].filter(Boolean).join(' | ') || null;

    if (editingInscId) {
      // Atualização de inscrição existente
      const { error } = await supabase
        .from('eventos_inscricoes')
        .update({
          member_id: membroSelecionado?.id ?? null,
          nome_externo: temMembro ? null : nomeNormalizado,
          email_externo: formInsc.email_externo || null,
          telefone: formInsc.telefone || null,
          status: statusFinal,
          observacoes: observacoesFinais,
          com_hospedagem: formInsc.com_hospedagem,
          status_hospedagem: formInsc.com_hospedagem ? (formInsc.status_hospedagem ?? 'solicitada') : 'nao_aplicavel',
        })
        .eq('id', editingInscId);

      if (error) {
        showModal('Erro', error.message, 'error');
        return;
      }
      showModal('Sucesso', 'Inscrição atualizada com sucesso.', 'success');
    } else {
      // 0. Verificação defensiva de duplicidade antes da inserção
      const memberIdParaCheck = membroSelecionado?.id ?? null;
      const cpfLimpoParaCheck = formInsc.cpf.replace(/\D/g, '');

      if (memberIdParaCheck || (cpfLimpoParaCheck && cpfLimpoParaCheck.length === 11)) {
        try {
          const resCheck = await fetch('/api/v1/eventos/inscricao/verificar-duplicidade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evento_id: eventoSelecionado.id,
              member_id: memberIdParaCheck,
              cpf: cpfLimpoParaCheck.length === 11 ? cpfLimpoParaCheck : null,
            }),
          });
          if (resCheck.ok) {
            const dataCheck = await resCheck.json();
            if (dataCheck.duplicado) {
              showModal('Inscrição já existente', dataCheck.mensagem || 'Este participante já possui uma inscrição ativa neste evento.', 'error');
              return;
            }
          }
        } catch {
          // prossegue para validação no banco
        }
      }

      // Inserção de nova inscrição
      const insertPayload: Record<string, any> = {
        evento_id: eventoSelecionado.id,
        ministry_id: ministryId,
        member_id: membroSelecionado?.id ?? null,
        nome_externo: temMembro ? null : nomeNormalizado,
        email_externo: formInsc.email_externo || null,
        telefone: formInsc.telefone || null,
        status: statusFinal,
        observacoes: observacoesFinais,
        com_hospedagem: formInsc.com_hospedagem,
        status_hospedagem: formInsc.com_hospedagem ? 'solicitada' : 'nao_aplicavel',
        criado_por: user?.id ?? null,
      };
      if (cpfLimpoParaCheck && cpfLimpoParaCheck.length === 11) {
        insertPayload.cpf_normalizado = cpfLimpoParaCheck;
      }

      let { error } = await supabase.from('eventos_inscricoes').insert(insertPayload);

      // Fallback resiliente caso a coluna cpf_normalizado ainda não exista no schema cache do Supabase
      if (error && error.message && error.message.includes('cpf_normalizado') && insertPayload.cpf_normalizado) {
        delete insertPayload.cpf_normalizado;
        const retry = await supabase.from('eventos_inscricoes').insert(insertPayload);
        error = retry.error;
      }

      if (error) {
        showModal('Erro', error.code === '23505' ? 'Este participante já possui uma inscrição ativa neste evento.' : error.message, 'error');
        return;
      }
      showModal('Sucesso', 'Inscrição realizada com sucesso.', 'success');
    }

    setShowFormInsc(false);
    setEditingInscId(null);
    setFormInsc(FORM_INSCRICAO_INICIAL);
    setMembroSelecionado(null);
    setBuscaMembro('');
    carregarInscricoes(eventoSelecionado.id);
    carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv);
  };

  const handleDeleteInscricao = (insc: Inscricao) => {
    setInscricaoParaExcluir(insc);
  };

  const confirmarExclusaoInscricao = async () => {
    if (!inscricaoParaExcluir) return;
    setExcluindoInsc(true);
    const { error } = await supabase.from('eventos_inscricoes').delete().eq('id', inscricaoParaExcluir.id);
    setExcluindoInsc(false);
    if (error) {
      showModal('Erro', error.message, 'error');
      return;
    }
    const nomeRemovido = inscricaoParaExcluir.nome_display ?? inscricaoParaExcluir.nome_externo ?? 'Participante';
    setInscricaoParaExcluir(null);
    showModal('Inscrição removida', `A inscrição de "${nomeRemovido}" foi removida com sucesso.`, 'success');
    if (eventoSelecionado) {
      carregarInscricoes(eventoSelecionado.id);
      carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv);
    }
  };

  // ── Ações do Balcão (Atendimento Presencial) ─────────────────────────────
  const abrirBalcao = (eventoIdPreferido?: string) => {
    let idPadrao = eventoIdPreferido || (eventoSelecionado ? eventoSelecionado.id : '');
    let evAlvo = eventos.find(e => e.id === idPadrao);

    // Balcão destina-se exclusivamente a eventos pagos. Se o evento preferido for gratuito, busca o primeiro pago
    if (!evAlvo || !isEventoPago(evAlvo)) {
      const primeiroPagoAberto = eventosPagos.find(e => e.aceita_inscricao && e.status !== 'cancelado');
      evAlvo = primeiroPagoAberto || eventosPagos[0];
      idPadrao = evAlvo?.id ?? '';
    }

    if (!idPadrao || !evAlvo || !isEventoPago(evAlvo)) {
      showModal(
        'Balcão Indisponível',
        'O Balcão é exclusivo para eventos pagos. Para eventos gratuitos, utilize a opção "Inscrever" na aba Inscrições.',
        'info'
      );
      setAba('inscricoes');
      return;
    }

    setBalcaoEventoId(idPadrao);
    setBalcaoMembro(null);
    setBalcaoBuscaMembro('');
    setBalcaoResultadosMembro([]);
    setBalcaoNome('');
    setBalcaoCpf('');
    setBalcaoEmail('');
    setBalcaoTelefone('');
    setBalcaoCongregacaoId('');
    setBalcaoHospedagem(false);
    setBalcaoFormaPagamento('a_vista');
    setBalcaoJustificativa('');
    setBalcaoSucesso(null);
    setShowBalcaoModal(true);
  };

  const handleSalvarInscricaoBalcao = async () => {
    if (!ministryId) return;

    if (!balcaoEventoId) {
      showModal('Selecione um evento', 'Escolha o evento para o qual deseja realizar a inscrição.', 'error');
      return;
    }

    const evento = eventos.find(e => e.id === balcaoEventoId);
    if (!evento) {
      showModal('Evento não encontrado', 'O evento selecionado não foi localizado.', 'error');
      return;
    }

    if (!isEventoPago(evento)) {
      showModal(
        'Operação não permitida',
        'O Balcão é restrito a eventos pagos. Realize inscrições em eventos gratuitos através do botão Inscrever na aba Inscrições.',
        'error'
      );
      setShowBalcaoModal(false);
      setAba('inscricoes');
      return;
    }

    const temMembro = !!balcaoMembro;
    const nomeDigitado = (balcaoMembro?.nome_completo || balcaoNome || balcaoBuscaMembro).trim();

    if (!temMembro && !nomeDigitado) {
      showModal(
        'Participante obrigatório',
        'Busque e selecione um membro do rol ou digite o nome completo do participante.',
        'error'
      );
      return;
    }

    // Validação de CPF quando preenchido
    const cpfLimpo = balcaoCpf.replace(/\D/g, '');
    if (cpfLimpo.length > 0 && !validarCpf(balcaoCpf)) {
      showModal('CPF Inválido', 'Por favor, informe um CPF válido para continuar ou deixe em branco se não aplicável.', 'error');
      return;
    }

    const nomeFinalNormalizado = formatarNomeProprio(temMembro ? balcaoMembro.nome_completo : nomeDigitado);

    setBalcaoSalvando(true);

    try {
      // 1. Validar capacidade máxima se configurada
      if (evento.capacidade != null && evento.capacidade > 0) {
        const { count, error: countErr } = await supabase
          .from('eventos_inscricoes')
          .select('id', { count: 'exact', head: true })
          .eq('evento_id', evento.id)
          .eq('status', 'confirmado');

        if (!countErr && count != null && count >= evento.capacidade) {
          showModal(
            'Capacidade esgotada',
            `Este evento já atingiu o limite de ${evento.capacidade} vagas confirmadas. Não é possível cadastrar novas inscrições no balcão.`,
            'error'
          );
          setBalcaoSalvando(false);
          return;
        }
      }

      // 2. Preparar observação descritiva para rastreabilidade e dados complementares (CPF / Congregação)
      const formaTexto = evento.evento_pago
        ? balcaoFormaPagamento === 'cortesia'
          ? 'Cortesia'
          : balcaoFormaPagamento === 'pix'
          ? 'PIX'
          : 'À vista'
        : 'Gratuito';

      const congSel = congregacoes.find(c => c.id === balcaoCongregacaoId);
      const congNomeFinal = congSel?.nome || (temMembro ? balcaoMembro?.congregacao_nome : null);

      const obsPartes = [
        '[Balcão] Inscrição presencial',
        `Pagamento: ${formaTexto}`,
        balcaoCpf.trim() ? `CPF: ${balcaoCpf.trim()}` : null,
        congNomeFinal ? `Congregação: ${congNomeFinal}` : null,
        balcaoJustificativa.trim() ? `Obs/Justificativa: ${balcaoJustificativa.trim()}` : null,
      ].filter(Boolean);

      // Verificação defensiva de duplicidade antes de inserir
      const memberIdParaCheck = temMembro ? balcaoMembro.id : null;
      if (memberIdParaCheck || (cpfLimpo && cpfLimpo.length === 11)) {
        try {
          const resCheck = await fetch('/api/v1/eventos/inscricao/verificar-duplicidade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evento_id: evento.id,
              member_id: memberIdParaCheck,
              cpf: cpfLimpo.length === 11 ? cpfLimpo : null,
            }),
          });
          if (resCheck.ok) {
            const dataCheck = await resCheck.json();
            if (dataCheck.duplicado) {
              showModal('Inscrição já existente', dataCheck.mensagem || 'Este participante já possui uma inscrição ativa neste evento.', 'error');
              setBalcaoSalvando(false);
              return;
            }
          }
        } catch {
          // prossegue
        }
      }

      // 3. Inserir inscrição confirmada
      const balcaoPayload: Record<string, any> = {
        evento_id: evento.id,
        ministry_id: ministryId,
        member_id: temMembro ? balcaoMembro.id : null,
        nome_externo: temMembro ? null : nomeFinalNormalizado,
        email_externo: balcaoEmail.trim() || null,
        telefone: balcaoTelefone.trim() || null,
        status: 'confirmado',
        confirmado_em: new Date().toISOString(),
        com_hospedagem: balcaoHospedagem,
        status_hospedagem: balcaoHospedagem ? 'confirmada' : 'nao_aplicavel',
        observacoes: obsPartes.join(' | '),
        criado_por: user?.id ?? null,
      };
      if (cpfLimpo && cpfLimpo.length === 11) {
        balcaoPayload.cpf_normalizado = cpfLimpo;
      }

      // 3. Execução Atômica via RPC transacional do Balcão
      const valorCobrado = evento.evento_pago
        ? balcaoFormaPagamento === 'cortesia'
          ? 0
          : (typeof evento.valor_inscricao === 'number' ? evento.valor_inscricao : Number(evento.valor_inscricao) || 0)
        : 0;

      const { data: rpcRes, error: rpcError } = await (supabase.rpc as any)('registrar_inscricao_balcao_rpc', {
        p_ministry_id: ministryId,
        p_evento_id: evento.id,
        p_forma_pagamento: evento.evento_pago ? balcaoFormaPagamento : 'a_vista',
        p_member_id: temMembro ? balcaoMembro.id : null,
        p_nome_externo: temMembro ? null : nomeFinalNormalizado,
        p_email_externo: balcaoEmail.trim() || null,
        p_telefone: balcaoTelefone.trim() || null,
        p_cpf: cpfLimpo || null,
        p_congregacao_id: balcaoCongregacaoId || null,
        p_com_hospedagem: balcaoHospedagem,
        p_observacoes: obsPartes.join(' | ') || null,
        p_justificativa_cortesia: balcaoFormaPagamento === 'cortesia' ? balcaoJustificativa.trim() : null,
      });

      if (rpcError) {
        if (rpcError.code === '23505' || rpcError.message?.includes('DUPLICIDADE')) {
          showModal('Inscrição duplicada', 'Este participante já possui uma inscrição registrada para este evento.', 'error');
        } else {
          showModal('Erro ao registrar inscrição no Balcão', rpcError.message, 'error');
        }
        setBalcaoSalvando(false);
        return;
      }

      const novaInscId = rpcRes?.inscricao_id;
      const temBrinde = !!rpcRes?.tem_brinde;

      // 4. Sucesso e dados para comprovante
      const nomePart = nomeFinalNormalizado;

      setBalcaoSucesso({
        inscricaoId: novaInscId,
        evento,
        nomeParticipante: nomePart,
        emailParticipante: balcaoEmail.trim() || undefined,
        telefoneParticipante: balcaoTelefone.trim() || undefined,
        formaPagamento: formaTexto,
        valorPago: valorCobrado,
        comHospedagem: balcaoHospedagem,
        temBrinde,
        dataHora: new Date().toLocaleString('pt-BR'),
      });

      // 6. Atualizar listas em segundo plano
      carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv);
      if (eventoSelecionado?.id === evento.id) {
        carregarInscricoes(evento.id);
        if (evento.evento_pago) carregarPagamentos(evento.id);
      }
    } catch (err: any) {
      showModal('Erro inesperado', err?.message || 'Falha ao processar atendimento no balcão.', 'error');
    } finally {
      setBalcaoSalvando(false);
    }
  };

  const handleImprimirComprovanteBalcao = () => {
    if (!balcaoSucesso) return;
    const win = window.open('', '_blank', 'width=600,height=700');
    if (!win) {
      showModal('Aviso', 'Permita a abertura de pop-ups para imprimir o comprovante.', 'info');
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprovante de Inscrição - Balcão</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; background: #fff; line-height: 1.5; font-size: 13px; }
          .ticket { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; max-width: 480px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
          .header h1 { font-size: 18px; margin: 0 0 4px 0; color: #0f172a; }
          .header p { margin: 0; color: #64748b; font-size: 12px; }
          .badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: bold; font-size: 11px; padding: 4px 10px; border-radius: 9999px; border: 1px solid #a7f3d0; margin-top: 8px; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #f1f5f9; }
          .label { color: #64748b; font-weight: 500; }
          .value { font-weight: 600; color: #0f172a; text-align: right; }
          .total-box { margin-top: 16px; background: #f8fafc; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; }
          .total-box .total-label { font-size: 13px; font-weight: bold; color: #334155; }
          .total-box .total-val { font-size: 18px; font-weight: 800; color: #1d4ed8; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <h1>${configIgreja.nome || 'Gestão Eklésia'}</h1>
            <p>Comprovante de Inscrição Presencial (Balcão)</p>
            <div class="badge">✓ INSCRIÇÃO CONFIRMADA</div>
          </div>
          
          <div class="row">
            <span class="label">Evento:</span>
            <span class="value">${balcaoSucesso.evento.titulo}</span>
          </div>
          <div class="row">
            <span class="label">Data/Hora Evento:</span>
            <span class="value">${new Date(balcaoSucesso.evento.data_inicio).toLocaleString('pt-BR')}</span>
          </div>
          ${balcaoSucesso.evento.local_nome ? `
          <div class="row">
            <span class="label">Local:</span>
            <span class="value">${balcaoSucesso.evento.local_nome}</span>
          </div>` : ''}
          <div class="row">
            <span class="label">Participante:</span>
            <span class="value">${balcaoSucesso.nomeParticipante}</span>
          </div>
          ${balcaoSucesso.telefoneParticipante ? `
          <div class="row">
            <span class="label">Telefone:</span>
            <span class="value">${balcaoSucesso.telefoneParticipante}</span>
          </div>` : ''}
          <div class="row">
            <span class="label">Forma de Pagamento:</span>
            <span class="value">${balcaoSucesso.formaPagamento}</span>
          </div>
          ${balcaoSucesso.comHospedagem ? `
          <div class="row">
            <span class="label">Hospedagem:</span>
            <span class="value">Inclusa</span>
          </div>` : ''}
          ${balcaoSucesso.temBrinde ? `
          <div class="row">
            <span class="label">Brinde do Evento:</span>
            <span class="value">Contemplado 🎁</span>
          </div>` : ''}
          <div class="row">
            <span class="label">Cód. Inscrição:</span>
            <span class="value">#${balcaoSucesso.inscricaoId.substring(0, 8).toUpperCase()}</span>
          </div>
          <div class="row">
            <span class="label">Data do Atendimento:</span>
            <span class="value">${balcaoSucesso.dataHora}</span>
          </div>

          <div class="total-box">
            <span class="total-label">Valor Pago:</span>
            <span class="total-val">${balcaoSucesso.valorPago > 0 ? `R$ ${balcaoSucesso.valorPago.toFixed(2).replace('.', ',')}` : 'R$ 0,00 (Cortesia / Gratuito)'}</span>
          </div>

          <div class="footer">
            <p>Guarde este comprovante para apresentação no dia do evento.</p>
            <p style="margin-top: 4px;">Atendimento realizado via Gestão Eklésia</p>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  };

  // ── Ações do Link Público de Check-in ────────────────────────────────────
  const abrirModalLinkCheckin = async () => {
    if (!eventoSelecionado) return;
    setShowLinkCheckinModal(true);
    setLoadingLinkCheckin(true);
    setLinkCheckinCopiado(false);

    try {
      const res = await fetch(`/api/v1/eventos/${eventoSelecionado.id}/checkin/token`);
      const data = await res.json();
      if (res.ok && data.url) {
        setLinkCheckinUrl(data.url);
        setLinkCheckinExpiraEm(data.expira_em);
      } else {
        showModal('Erro ao obter link', data.error || 'Não foi possível gerar o link de check-in.', 'error');
        setShowLinkCheckinModal(false);
      }
    } catch (err: any) {
      showModal('Erro', err?.message || 'Falha na requisição do link de check-in.', 'error');
      setShowLinkCheckinModal(false);
    } finally {
      setLoadingLinkCheckin(false);
    }
  };

  const regerarLinkCheckin = async () => {
    if (!eventoSelecionado) return;
    if (!confirm('Deseja regerar o link de check-in? O link anterior deixará de funcionar imediatamente na entrada do evento.')) return;

    setLoadingLinkCheckin(true);
    setLinkCheckinCopiado(false);

    try {
      const res = await fetch(`/api/v1/eventos/${eventoSelecionado.id}/checkin/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gerar' }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setLinkCheckinUrl(data.url);
        setLinkCheckinExpiraEm(data.expira_em);
        showModal('Link regerado', 'Novo link de check-in gerado com sucesso.', 'success');
      } else {
        showModal('Erro', data.error || 'Falha ao regerar link.', 'error');
      }
    } catch (err: any) {
      showModal('Erro', err?.message || 'Falha ao regerar link.', 'error');
    } finally {
      setLoadingLinkCheckin(false);
    }
  };

  const copiarLinkCheckin = () => {
    if (!linkCheckinUrl) return;
    navigator.clipboard.writeText(linkCheckinUrl).then(() => {
      setLinkCheckinCopiado(true);
      setTimeout(() => setLinkCheckinCopiado(false), 2500);
    });
  };

  // Atualização em segundo plano na aba Check-in
  useEffect(() => {
    if (aba === 'checkin' && eventoSelecionado) {
      const interval = setInterval(() => {
        carregarInscricoes(eventoSelecionado.id);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [aba, eventoSelecionado, carregarInscricoes]);

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
    if (eventoSelecionado) {
      carregarInscricoes(eventoSelecionado.id);
      carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv);
    }
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
    if (eventoSelecionado) {
      carregarInscricoes(eventoSelecionado.id);
      carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv);
    }
  };

  const handleStatusHospedagem = useCallback(async (insc: Inscricao, status: StatusHospedagem) => {
    const { error } = await supabase
      .from('eventos_inscricoes')
      .update({ status_hospedagem: status })
      .eq('id', insc.id);
    if (error) {
      showModal('Erro', error.message, 'error');
      return;
    }
    if (eventoSelecionado) {
      carregarInscricoes(eventoSelecionado.id);
      carregarEventos(filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv);
    }
  }, [supabase, showModal, eventoSelecionado, carregarInscricoes, carregarEventos, filtroPeriodo, filtroMesCustom, filtroStatus, filtroCongEv, buscaEv]);
  void handleStatusHospedagem;


  const renderCertificadoHtml = (
    template: any,
    map: Record<string, string>,
    configParam?: ConfiguracaoIgreja
  ) => {
    const configAtiva = configParam || configIgreja;
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
          const textoBruto = substituirPlaceholdersCertificado(el.texto || '', map, template.categoria || 'eventos');
          const isNomeParticipante = (el.texto || '').includes('participante_nome') ||
            (el.texto || '').includes('nome') ||
            (el.texto || '').includes('NOME') ||
            el.id === 'b8a21a5e-e4c7-480f-8260-bc8d8a1c686f';

          const { containerStyle, innerStyle } = buildTextoEstiloRenderizacao(
            el,
            textoBruto,
            isNomeParticipante
          );

          const textoHtml = textoBruto.replace(/\n/g, '<br />');
          return `<div style="${containerStyle}"><div style="${innerStyle}">${textoHtml}</div></div>`;
        }
        if (el.tipo === 'chapa' || el.tipo === 'forma') {
          const style = [baseStyle, `background-color:${el.cor || '#111'};`, `opacity:${el.transparencia ?? 1};`].join('');
          return `<div style="${style}"></div>`;
        }
        if (el.tipo === 'linha') {
          const style = [baseStyle, `border-top: 2px solid ${el.cor || '#111'};`, `opacity:${el.transparencia ?? 1};`].join('');
          return `<div style="${style}"></div>`;
        }
        if (el.tipo === 'logo' || el.tipo === 'imagem' || el.tipo === 'foto-membro') {
          const src = el.tipo === 'logo' ? (configAtiva.logo || el.imagemUrl || '') : (el.imagemUrl || '');
          if (!src) return '';
          const style = [baseStyle, 'object-fit:contain;', `opacity:${el.transparencia ?? 1};`].join('');
          return `<img src="${src}" style="${style}" />`;
        }
        if (el.tipo === 'assinatura_presidente' || el.tipo === 'assinatura_secretario_geral') {
          const isPresidente = el.tipo === 'assinatura_presidente';
          const sigSrc = isPresidente
            ? (configAtiva.assinatura_presidente || el.imagemUrl || '')
            : (configAtiva.assinatura_secretario_geral || el.imagemUrl || '');
          const rotulo = isPresidente ? 'Assinatura do Presidente' : 'Assinatura do Secretário-Geral';

          if (sigSrc) {
            const style = [
              baseStyle,
              'object-fit:contain;',
              `opacity:${el.transparencia ?? 1};`,
              'display:block;',
            ].join('');
            return `<img src="${sigSrc}" alt="${rotulo}" style="${style}" />`;
          }

          // Fallback visual/diagnóstico claro no contexto administrativo quando a assinatura não está cadastrada
          const diagStyle = [
            baseStyle,
            'border:1px dashed #0d9488;',
            'background:rgba(240, 253, 250, 0.7);',
            'color:#0f766e;',
            'display:flex;',
            'flex-direction:column;',
            'align-items:center;',
            'justify-content:center;',
            'font-size:10px;',
            'font-weight:600;',
            'text-align:center;',
            'padding:2px;',
            'box-sizing:border-box;',
            `opacity:${el.transparencia ?? 1};`,
          ].join('');
          return `<div style="${diagStyle}"><span>✍️ ${isPresidente ? 'Assinatura Presidente' : 'Assinatura Secretário'}</span><span style="font-size:8px;font-weight:normal;color:#115e59;">(Não cadastrada nas configurações)</span></div>`;
        }
        if (el.tipo === 'qrcode') {
          const qrVal = map.evento_protocolo || map.participante_nome || 'CERTIFICADO';
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${el.largura}x${el.altura}&data=${encodeURIComponent(qrVal)}`;
          const style = [baseStyle, 'object-fit:contain;', `opacity:${el.transparencia ?? 1};`].join('');
          return `<img src="${qrUrl}" style="${style}" />`;
        }
        return '';
      })
      .join('');

    return `<div style="position:relative;width:${largura}px;height:${altura}px;margin:0 auto;overflow:hidden;background:#fff;">${bgHtml}${elementsHtml}</div>`;
  };

  const recuperarTemplateCertificado = useCallback(async (
    modeloId?: string | null,
    midParam?: string | null
  ) => {
    if (!modeloId) return null;

    const targetMid = midParam || ministryId;

    // 1. Sempre priorizar buscar a versão mais recente e fresca diretamente no Supabase
    try {
      let q = supabase.from('certificados_templates').select('*');
      if (targetMid) {
        q = q.eq('ministry_id', targetMid);
      }
      const { data: rows } = await q.or(`template_key.eq.${modeloId},id.eq.${modeloId}`).limit(1);
      if (rows && rows.length > 0) {
        const r = rows[0];
        const td = typeof r.template_data === 'string'
          ? (() => { try { return JSON.parse(r.template_data); } catch { return {}; } })()
          : (r.template_data || {});
        const key = r.template_key || td.id || r.id;
        const freshTemplate = {
          ...td,
          db_id: r.id,
          template_key: key,
          id: key,
          nome: td.nome || r.name || 'Certificado de Eventos',
          categoria: td.categoria || 'eventos',
          ativo: r.is_active !== false,
        };
        // Atualizar cache local com a versão recém-recuperada
        setCertTemplatesFull(prev => {
          const exists = prev.some(t => t.id === key || t.db_id === r.id);
          if (exists) {
            return prev.map(t => (t.id === key || t.db_id === r.id) ? freshTemplate : t);
          }
          return [...prev, freshTemplate];
        });
        return freshTemplate;
      }
    } catch {
      // fallback para cache em memória
    }

    // 2. Tentar encontrar em certTemplatesFull em memória caso busca remota falhe
    const templateEmMemoria = certTemplatesFull.find(t =>
      t.id === modeloId ||
      t.template_key === modeloId ||
      t.chave === modeloId ||
      t.db_id === modeloId
    );
    if (templateEmMemoria) return templateEmMemoria;

    // 3. Fallback estrito: somente templates comprovadamente da categoria eventos
    return certTemplatesFull.find(t => isTemplateCategoriaEventos(t)) || null;
  }, [certTemplatesFull, ministryId, supabase]);

  const abrirPreviewCertificado = useCallback(async (
    modeloIdParam?: string | null,
    eventoContexto?: Partial<Evento> | FormEvento | null
  ) => {
    const rawId = modeloIdParam || formEvento.certificado_modelo_id || eventoSelecionado?.certificado_modelo_id;
    if (!rawId) {
      showModal('Selecione um modelo', 'Por favor, selecione um modelo de certificado no campo "Modelo de Certificado" antes de pré-visualizar.', 'info');
      return;
    }

    setCarregandoPreviewCert(true);

    try {
      const template = await recuperarTemplateCertificado(rawId, ministryId);

      if (!template) {
        showModal(
          'Modelo não encontrado',
          `O modelo de certificado associado ("${rawId}") não foi encontrado no banco de dados deste ministério. Cadastre ou verifique o modelo em Configurações > Certificados.`,
          'error'
        );
        return;
      }

      // Preparar dados do evento para os placeholders
      const evObj: Partial<Evento> = {
        id: (eventoContexto as any)?.id || 'evento-preview',
        titulo: eventoContexto?.titulo || 'ESCOLA DE OBREIROS 2026',
        data_inicio: (eventoContexto as any)?.data_inicio || '2026-10-23T19:00:00',
        data_fim: (eventoContexto as any)?.data_fim || '2026-10-23T21:30:00',
        local_nome: (eventoContexto as any)?.local_nome || 'ASSEMBLEIA DE DEUS ANANINDEUA',
        local_endereco: (eventoContexto as any)?.local_endereco || 'BR 316, KM02, 230, ANANINDEUA - PA',
        tipo: ((eventoContexto as any)?.tipo as TipoEvento) || 'conferencia',
        ministry_id: ministryId || '',
      };

      const inscDemo: any = {
        id: 'insc-demo',
        nome_display: 'Carlos Eduardo Oliveira (Participante Demonstrativo)',
        cpf: '123.456.789-00',
        telefone: '(91) 98765-4321',
        email: 'participante.exemplo@eklesia.com',
        data_confirmacao: new Date().toISOString(),
        data_inscricao: new Date().toISOString(),
        numero_protocolo: 'EVT-2026-DEMO',
        status: 'confirmado',
      };

      // Sempre garantir configurações institucionais frescas (com assinaturas atualizadas)
      let configParaPreview = configIgreja;
      if (ministryId) {
        try {
          const cfgFresh = await fetchConfiguracaoIgrejaFromSupabase(supabase, ministryId);
          if (cfgFresh) {
            configParaPreview = cfgFresh;
            setConfigIgreja(cfgFresh);
          }
        } catch {
          // fallback silencioso para config atual
        }
      }

      const map = buildEventoPlaceholderMap(evObj as Evento, inscDemo as Inscricao, configParaPreview);
      const html = renderCertificadoHtml(template, map, configParaPreview);

      setPreviewCertificadoData({
        template,
        html,
        evento: evObj,
      });
      setPreviewCertificadoAberto(true);
    } catch (err: any) {
      showModal('Erro ao carregar pré-visualização', err?.message || 'Falha ao recuperar modelo.', 'error');
    } finally {
      setCarregandoPreviewCert(false);
    }
  }, [formEvento.certificado_modelo_id, eventoSelecionado, ministryId, recuperarTemplateCertificado, configIgreja, renderCertificadoHtml]);

  const handleImprimirTestePreview = () => {
    if (!previewCertificadoData) return;
    const { template, html, evento } = previewCertificadoData;
    const orientacao = template.orientacao === 'portrait' ? 'portrait' : 'landscape';
    const largura = orientacao === 'portrait' ? 595 : 840;
    const altura = orientacao === 'portrait' ? 840 : 595;
    const pageW = orientacao === 'portrait' ? 190 : 277;
    const pageH = orientacao === 'portrait' ? 277 : 190;
    const scaleX = (pageW * 3.7795) / largura;
    const scaleY = (pageH * 3.7795) / altura;
    const scale = Math.min(scaleX, scaleY).toFixed(4);

    const win = window.open('', '_blank');
    if (!win) {
      showModal('Aviso', 'Permita a abertura de pop-ups para imprimir o teste do certificado.', 'info');
      return;
    }

    win.document.write(`<!DOCTYPE html><html><head><title>Teste de Certificado - ${evento?.titulo || 'Evento'}</title>${getFontesCertificadosHeadHtml()}<style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:A4 ${orientacao};margin:1cm;}
      html,body{width:100%;height:100%;display:flex;justify-content:center;align-items:center;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      .cert{zoom:${scale};width:${largura}px;height:${altura}px;overflow:hidden;flex-shrink:0;}
      img{display:block;}
    </style></head><body><div class="cert">${html}</div>${getFontesReadyPrintScript()}</body></html>`);
    win.document.close();
    win.focus();
  };

  const handleImprimirCertificado = async (insc: Inscricao) => {
    if (!eventoSelecionado) return;
    const modeloId = eventoSelecionado.certificado_modelo_id;
    const targetMid = eventoSelecionado.ministry_id || ministryId;
    const template = await recuperarTemplateCertificado(modeloId, targetMid);

    if (!template) {
      showModal('Modelo não encontrado', 'O modelo de certificado configurado para este evento não foi encontrado. Configure o modelo em Configurações > Certificados.', 'error');
      return;
    }

    // Carregar configuração institucional fresca para garantir assinaturas atualizadas
    let configParaUso = configIgreja;
    if (targetMid) {
      try {
        const cfgFresh = await fetchConfiguracaoIgrejaFromSupabase(supabase, targetMid);
        if (cfgFresh) {
          configParaUso = cfgFresh;
          setConfigIgreja(cfgFresh);
        }
      } catch {
        // fallback silencioso
      }
    }

    const orientacao = template.orientacao === 'portrait' ? 'portrait' : 'landscape';
    const largura = orientacao === 'portrait' ? 595 : 840;
    const altura = orientacao === 'portrait' ? 840 : 595;
    const pageW = orientacao === 'portrait' ? 190 : 277;
    const pageH = orientacao === 'portrait' ? 277 : 190;
    const scaleX = (pageW * 3.7795) / largura;
    const scaleY = (pageH * 3.7795) / altura;
    const scale = Math.min(scaleX, scaleY).toFixed(4);

    const map = buildEventoPlaceholderMap(eventoSelecionado, insc, configParaUso);
    const html = renderCertificadoHtml(template, map, configParaUso);

    const win = window.open('', '_blank');
    if (!win) {
      showModal('Aviso', 'Permita a abertura de pop-ups para imprimir o certificado.', 'info');
      return;
    }

    win.document.write(`<!DOCTYPE html><html><head><title>Certificado - ${insc.nome_display}</title>${getFontesCertificadosHeadHtml()}<style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:A4 ${orientacao};margin:1cm;}
      html,body{width:100%;height:100%;display:flex;justify-content:center;align-items:center;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      .cert{zoom:${scale};width:${largura}px;height:${altura}px;overflow:hidden;flex-shrink:0;}
      img{display:block;}
    </style></head><body><div class="cert">${html}</div>${getFontesReadyPrintScript()}</body></html>`);
    win.document.close();
    win.focus();
  };

  const handleImprimirTodosCertificados = async () => {
    if (!eventoSelecionado) return;
    const modeloId = eventoSelecionado.certificado_modelo_id;
    const targetMid = eventoSelecionado.ministry_id || ministryId;
    const template = await recuperarTemplateCertificado(modeloId, targetMid);

    if (!template) {
      showModal('Modelo não encontrado', 'O modelo de certificado configurado para este evento não foi encontrado. Configure o modelo em Configurações > Certificados.', 'error');
      return;
    }

    const participantesValidos = inscricoes.filter(i => i.status === 'confirmado');
    if (participantesValidos.length === 0) {
      // Abre a pré-visualização demonstrativa do modelo
      abrirPreviewCertificado(modeloId, eventoSelecionado);
      return;
    }

    // Carregar configuração institucional fresca para garantir assinaturas atualizadas
    let configParaUso = configIgreja;
    if (targetMid) {
      try {
        const cfgFresh = await fetchConfiguracaoIgrejaFromSupabase(supabase, targetMid);
        if (cfgFresh) {
          configParaUso = cfgFresh;
          setConfigIgreja(cfgFresh);
        }
      } catch {
        // fallback silencioso
      }
    }

    const orientacao = template.orientacao === 'portrait' ? 'portrait' : 'landscape';
    const largura = orientacao === 'portrait' ? 595 : 840;
    const altura = orientacao === 'portrait' ? 840 : 595;
    const pageW = orientacao === 'portrait' ? 190 : 277;
    const pageH = orientacao === 'portrait' ? 277 : 190;
    const scaleX = (pageW * 3.7795) / largura;
    const scaleY = (pageH * 3.7795) / altura;
    const scale = Math.min(scaleX, scaleY).toFixed(4);

    const allPages = participantesValidos.map(insc => {
      const map = buildEventoPlaceholderMap(eventoSelecionado, insc, configParaUso);
      return `<div class="page"><div class="cert">${renderCertificadoHtml(template, map, configParaUso)}</div></div>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) {
      showModal('Aviso', 'Permita a abertura de pop-ups para imprimir os certificados.', 'info');
      return;
    }

    win.document.write(`<!DOCTYPE html><html><head><title>Certificados - ${eventoSelecionado.titulo}</title>${getFontesCertificadosHeadHtml()}<style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:A4 ${orientacao};margin:1cm;}
      html,body{margin:0;padding:0;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      .page{width:100%;height:100vh;display:flex;justify-content:center;align-items:center;page-break-after:always;}
      .cert{zoom:${scale};width:${largura}px;height:${altura}px;overflow:hidden;flex-shrink:0;}
      img{display:block;}
    </style></head><body>${allPages}${getFontesReadyPrintScript()}</body></html>`);
    win.document.close();
    win.focus();
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
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-800">
                      {getBeneficiosLabels(eventoVisualizando).join(' · ')}
                    </span>
                    {eventoVisualizando.inclui_certificado && (
                      <button
                        type="button"
                        onClick={() => abrirPreviewCertificado(eventoVisualizando.certificado_modelo_id, eventoVisualizando)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer ml-2"
                      >
                        <Eye className="w-3 h-3 text-blue-600" />
                        <span>Ver Certificado</span>
                      </button>
                    )}
                  </div>
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
              {eventoVisualizando.inclui_certificado && (
                <button
                  type="button"
                  onClick={() => abrirPreviewCertificado(eventoVisualizando.certificado_modelo_id, eventoVisualizando)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  <span>Visualizar Certificado</span>
                </button>
              )}
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

      {/* ── Modal de Pré-Visualização do Certificado em Tempo Real ── */}
      {previewCertificadoAberto && previewCertificadoData && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewCertificadoAberto(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shadow-xs">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {previewCertificadoData.template.nome || 'Certificado de Eventos'}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Modo Somente Leitura
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Modelo vinculado: <span className="font-mono text-slate-700 font-semibold">{previewCertificadoData.template.template_key || previewCertificadoData.template.id}</span> · Categoria: <strong className="text-emerald-700 uppercase">Eventos</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewCertificadoAberto(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                title="Fechar visualização"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Banner Informativo */}
            <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Visualizando o layout oficial persistido no banco com as variáveis dinâmicas do evento <strong>{previewCertificadoData.evento?.titulo}</strong>.
                </span>
              </div>
              <a
                href="/configuracoes/certificados"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#1d4ed8] hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Abrir no Editor
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Área de Visualização do Certificado */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/90 flex items-center justify-center min-h-[380px]">
              <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-slate-300 max-w-full">
                <div
                  className="cert-preview-wrapper select-none"
                  dangerouslySetInnerHTML={{ __html: previewCertificadoData.html }}
                />
              </div>
            </div>

            {/* Rodapé com Ações */}
            <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50/80">
              <span className="text-[11px] text-slate-500 font-medium">
                Dimensões: {previewCertificadoData.template.orientacao === 'portrait' ? '595 × 840 px (Retrato)' : '840 × 595 px (Paisagem)'} · Formato A4
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleImprimirTestePreview}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Imprimir Teste</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCertificadoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3460] hover:bg-[#162a47] transition shadow-xs cursor-pointer"
                >
                  Concluir
                </button>
              </div>
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
                onClick={handleAbrirNovoEvento}
                className="inline-flex items-center gap-2 px-4.5 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3460] hover:bg-[#162a47] shadow-sm hover:shadow transition active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Novo Evento</span>
              </button>
            )}
          </div>
        </div>

        {/* ── NOVO HERO INSTITUCIONAL DE EVENTOS ──────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-3xl border border-blue-100/90 shadow-xs bg-[#e8f1fd] bg-no-repeat bg-cover bg-center min-h-[170px] sm:min-h-[195px] md:min-h-[220px] flex items-center"
          style={{
            backgroundImage: "url('/img/bg_eventos.png')",
            backgroundPosition: 'center',
          }}
        >
          <div className="relative z-10 p-6 sm:p-8 md:p-10 max-w-xl lg:max-w-2xl bg-gradient-to-r from-white/90 via-white/60 to-transparent sm:from-transparent sm:via-transparent sm:to-transparent rounded-2xl sm:rounded-none">
            <div className="flex items-center gap-3.5 sm:gap-4 mb-2 sm:mb-2.5">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-[1.12]">
                Bem-vindo ao<br />
                módulo de <span className="text-[#1d4ed8]">Eventos!</span>
              </h2>
              <div className="hidden sm:inline-flex items-center justify-center p-2.5 rounded-2xl bg-white/90 backdrop-blur-xs border border-blue-200/80 shadow-xs text-[#1d4ed8] shrink-0 self-center">
                <CalendarDays className="w-7 h-7 stroke-[2.2]" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-md md:max-w-lg">
              Organize congressos, conferências, encontros e demais eventos da sua igreja. Acompanhe as inscrições, o check-in e toda a movimentação em um só lugar.
            </p>
          </div>
        </div>

        {/* ── 2. KPIS COM IDENTIDADE VISUAL E CONTADORES GLOBAIS ───────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Programados */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden min-h-[106px]">
            <div className="p-4 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#edf5ff] border border-blue-100 flex items-center justify-center text-[#1d4ed8] shrink-0">
                <CalendarDays className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-0.5">Programados</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{totaisGlobais.programado}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#eaf8f0] text-[#059669] border border-emerald-100">
                    +{totaisGlobais.noMes} este mês
                  </span>
                </div>
              </div>
            </div>
            <div className="text-blue-500 px-1 pb-1">
              <svg className="w-full h-2" viewBox="0 0 200 8" preserveAspectRatio="none">
                <path d="M0,4 Q50,0 100,4 T200,4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
          </div>

          {/* Card: Em Andamento */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden min-h-[106px]">
            <div className="p-4 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#eaf8f0] border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Play className="w-5 h-5 fill-emerald-600 stroke-none ml-0.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-0.5">Em Andamento</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{totaisGlobais.em_andamento}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/60">
                    0 este mês
                  </span>
                </div>
              </div>
            </div>
            <div className="text-emerald-500 px-1 pb-1">
              <svg className="w-full h-2" viewBox="0 0 200 8" preserveAspectRatio="none">
                <path d="M0,4 Q50,0 100,4 T200,4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
          </div>

          {/* Card: Realizados */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden min-h-[106px]">
            <div className="p-4 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#eaf8f0] border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-0.5">Realizados</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{totaisGlobais.realizado}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#eaf8f0] text-[#059669] border border-emerald-100">
                    +5 este semestre
                  </span>
                </div>
              </div>
            </div>
            <div className="text-emerald-500 px-1 pb-1">
              <svg className="w-full h-2" viewBox="0 0 200 8" preserveAspectRatio="none">
                <path d="M0,4 Q50,0 100,4 T200,4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
          </div>

          {/* Card: Cancelados */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden min-h-[106px]">
            <div className="p-4 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#feeaec] border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <XCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-0.5">Cancelados</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{totaisGlobais.cancelado}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/60">
                    0 este mês
                  </span>
                </div>
              </div>
            </div>
            <div className="text-rose-500 px-1 pb-1">
              <svg className="w-full h-2" viewBox="0 0 200 8" preserveAspectRatio="none">
                <path d="M0,4 Q50,0 100,4 T200,4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
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
              if (eventoSelecionado && !isEventoPago(eventoSelecionado)) {
                setEventoSelecionado(eventosPagos.length > 0 ? eventosPagos[0] : null);
              } else if (!eventoSelecionado && eventosPagos.length > 0) {
                setEventoSelecionado(eventosPagos[0]);
              }
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

          {scope.canWrite && isEventoPago(eventoSelecionado) && (
            <button
              onClick={() => abrirBalcao(eventoSelecionado?.id)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 active:scale-95"
              title="Atendimento e Inscrição Presencial (Exclusivo para eventos com taxa de inscrição)"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Balcão</span>
            </button>
          )}
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
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
                  {/* Cabeçalho Fixo */}
                  <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-white shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100/80 border border-blue-200 text-[#0f3460] flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 leading-tight">
                          {editandoId ? 'Editar Evento' : 'Novo Evento'}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          Preencha as informações detalhadas para publicação na agenda.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Corpo com rolagem interna */}
                  <div className="p-6 overflow-y-auto space-y-5 flex-1">
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
                      onChange={e => handleCongregacaoChange(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                    >
                      <option value="">Templo Sede</option>
                      {congregacoes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.is_sede ? '(Sede)' : ''}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 block">Endereço Completo</label>
                      {formEvento.local_endereco !== resolverEnderecoPorCongregacao(formEvento.congregacao_id) && (
                        <button
                          type="button"
                          onClick={() => {
                            const endCadastrado = resolverEnderecoPorCongregacao(formEvento.congregacao_id);
                            setFormEvento(f => ({ ...f, local_endereco: endCadastrado }));
                            ultimoEnderecoAutoPreenchido.current = endCadastrado;
                          }}
                          className="text-[11px] font-semibold text-[#1d4ed8] hover:underline"
                        >
                          Usar endereço da congregação
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formEvento.local_endereco}
                      onChange={e => setFormEvento(f => ({ ...f, local_endereco: e.target.value }))}
                      placeholder="Preenchido automaticamente ao selecionar congregação ou digite aqui..."
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
                          {formEvento.aceita_inscricao
                            ? (formEvento.evento_pago
                                ? 'Inscrições ativas pelo link público. Defina o valor da inscrição, formas de pagamento e benefícios inclusos.'
                                : 'Inscrições ativas e gratuitas pelo link público. Configure os benefícios inclusos para os inscritos.')
                            : 'Inscrições fechadas no momento. Ative a opção "Inscrições Abertas" para permitir cadastros pelo link público.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Toggle: Inscrições Abertas */}
                        <label className={`inline-flex items-center gap-2 cursor-pointer select-none px-3.5 py-2 rounded-xl border shadow-xs transition ${
                          formEvento.aceita_inscricao
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={formEvento.aceita_inscricao}
                            onChange={e => {
                              const checked = e.target.checked;
                              setFormEvento(f => ({ ...f, aceita_inscricao: checked }));
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-[#1d4ed8]"
                          />
                          <span className="text-xs font-bold">
                            {formEvento.aceita_inscricao ? 'Inscrições Abertas' : 'Inscrições Fechadas'}
                          </span>
                        </label>

                        {/* Checkbox Principal: Evento Pago */}
                        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition">
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
                                Modelo de Certificado <span className="text-rose-500">*</span>
                              </label>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => ministryId && carregarTemplatesCertificados(ministryId)}
                                  title="Atualizar lista de modelos de certificados"
                                  className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 inline-flex items-center gap-1 transition"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Atualizar
                                </button>
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
                            </div>

                            {optionsCertificados.length === 0 ? (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-bold">Nenhum modelo de certificado encontrado na categoria &quot;Eventos&quot;.</p>
                                  <p className="text-amber-800 text-[11px] mt-0.5">
                                    Cadastre ou configure um modelo em{' '}
                                    <a
                                      href="/configuracoes/certificados"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline font-bold text-[#1d4ed8] hover:text-[#1e40af]"
                                    >
                                      Configurações &gt; Certificados
                                    </a>{' '}
                                    classificado como <strong>Eventos</strong> para poder associá-lo a este evento.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <select
                                  value={formEvento.certificado_modelo_id}
                                  onChange={e => setFormEvento(f => ({ ...f, certificado_modelo_id: e.target.value }))}
                                  className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 transition"
                                >
                                  {(!formEvento.certificado_modelo_id || optionsCertificados.length > 1) && (
                                    <option value="">Selecione um modelo de certificado...</option>
                                  )}
                                  {optionsCertificados.map(t => (
                                    <option key={t.id} value={t.id}>
                                      {t.nome}
                                    </option>
                                  ))}
                                </select>

                                {formEvento.certificado_modelo_id && (
                                  <button
                                    type="button"
                                    onClick={() => abrirPreviewCertificado(formEvento.certificado_modelo_id, formEvento)}
                                    disabled={carregandoPreviewCert}
                                    title="Pré-visualizar o layout completo do modelo de certificado selecionado"
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 disabled:opacity-50 transition shadow-2xs whitespace-nowrap cursor-pointer shrink-0"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                                    <span>{carregandoPreviewCert ? 'Carregando...' : 'Pré-visualizar certificado'}</span>
                                  </button>
                                )}
                              </div>
                            )}

                            <p className="text-[11px] text-slate-500 font-medium">
                              Selecione o modelo configurado em Configurações &gt; Certificados que será gerado para os participantes com presença confirmada.
                            </p>

                            <div className="pt-2 border-t border-slate-100 opacity-60">
                              <label className="flex items-center gap-2 cursor-not-allowed select-none text-xs font-semibold text-slate-500">
                                <input
                                  type="checkbox"
                                  disabled
                                  checked={false}
                                  className="w-4 h-4 rounded text-slate-400 border-slate-300 cursor-not-allowed"
                                />
                                <span>Enviar certificado por e-mail automaticamente após o check-in</span>
                                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded ml-1">Em breve</span>
                              </label>
                              <p className="text-[10px] text-slate-400 pl-6 mt-0.5">
                                Recurso em homologação da fila de processamento. Inicialmente desativado até a conclusão dos testes de disparo.
                              </p>
                            </div>
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
                                Modelo de Certificado <span className="text-rose-500">*</span>
                              </label>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => ministryId && carregarTemplatesCertificados(ministryId)}
                                  title="Atualizar lista de modelos de certificados"
                                  className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 inline-flex items-center gap-1 transition"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Atualizar
                                </button>
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
                            </div>

                            {optionsCertificados.length === 0 ? (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-bold">Nenhum modelo de certificado encontrado na categoria &quot;Eventos&quot;.</p>
                                  <p className="text-amber-800 text-[11px] mt-0.5">
                                    Cadastre ou configure um modelo em{' '}
                                    <a
                                      href="/configuracoes/certificados"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline font-bold text-[#1d4ed8] hover:text-[#1e40af]"
                                    >
                                      Configurações &gt; Certificados
                                    </a>{' '}
                                    classificado como <strong>Eventos</strong> para poder associá-lo a este evento.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <select
                                  value={formEvento.certificado_modelo_id}
                                  onChange={e => setFormEvento(f => ({ ...f, certificado_modelo_id: e.target.value }))}
                                  className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 transition"
                                >
                                  {(!formEvento.certificado_modelo_id || optionsCertificados.length > 1) && (
                                    <option value="">Selecione um modelo de certificado...</option>
                                  )}
                                  {optionsCertificados.map(t => (
                                    <option key={t.id} value={t.id}>
                                      {t.nome}
                                    </option>
                                  ))}
                                </select>

                                {formEvento.certificado_modelo_id && (
                                  <button
                                    type="button"
                                    onClick={() => abrirPreviewCertificado(formEvento.certificado_modelo_id, formEvento)}
                                    disabled={carregandoPreviewCert}
                                    title="Pré-visualizar o layout completo do modelo de certificado selecionado"
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 disabled:opacity-50 transition shadow-2xs whitespace-nowrap cursor-pointer shrink-0"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                                    <span>{carregandoPreviewCert ? 'Carregando...' : 'Pré-visualizar certificado'}</span>
                                  </button>
                                )}
                              </div>
                            )}

                            <p className="text-[11px] text-slate-500 font-medium">
                              Selecione o modelo configurado em Configurações &gt; Certificados que será gerado para os participantes com presença confirmada.
                            </p>

                            <div className="pt-2 border-t border-slate-100 opacity-60">
                              <label className="flex items-center gap-2 cursor-not-allowed select-none text-xs font-semibold text-slate-500">
                                <input
                                  type="checkbox"
                                  disabled
                                  checked={false}
                                  className="w-4 h-4 rounded text-slate-400 border-slate-300 cursor-not-allowed"
                                />
                                <span>Enviar certificado por e-mail automaticamente após o check-in</span>
                                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded ml-1">Em breve</span>
                              </label>
                              <p className="text-[10px] text-slate-400 pl-6 mt-0.5">
                                Recurso em homologação da fila de processamento. Inicialmente desativado até a conclusão dos testes de disparo.
                              </p>
                            </div>
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

                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Link do Grupo de WhatsApp do Evento (Opcional)
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={formEvento.whatsapp_grupo_url}
                        onChange={e => setFormEvento(f => ({ ...f, whatsapp_grupo_url: e.target.value }))}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      />
                      {formEvento.whatsapp_grupo_url && (
                        <a
                          href={formEvento.whatsapp_grupo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute right-2.5 top-2.5 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                          title="Testar link do grupo"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Testar</span>
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Link de convite do grupo do evento (ex: https://chat.whatsapp.com/...). Pode ser disponibilizado para os inscritos e na página do evento.
                    </p>
                  </div>
                </div>
              </div>

              {/* Rodapé Fixo */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvento}
                  disabled={salvando}
                  className="px-5 py-2 rounded-xl bg-[#0f3460] hover:bg-[#162a47] text-white text-xs font-bold shadow-sm hover:shadow transition disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar Evento'}
                </button>
              </div>
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
                      onClick={handleAbrirNovoEvento}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3460] hover:bg-[#162a47] transition shadow-sm"
                    >
                      + Novo Evento
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'lista' ? (
              <>
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
                              {e.status !== 'cancelado' && e.status !== 'realizado' && (
                                <span className={`block text-[10px] font-semibold mt-1 ${
                                  e.aceita_inscricao ? 'text-emerald-700' : 'text-slate-400'
                                }`}>
                                  {e.aceita_inscricao ? 'Inscrições abertas' : 'Inscrições fechadas'}
                                </span>
                              )}
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
                                      toggleMenuAcoes(e, ev.currentTarget);
                                    }}
                                    className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/60 transition cursor-pointer ${
                                      menuAberto ? 'bg-slate-100 text-slate-800 border-slate-300' : ''
                                    }`}
                                    title="Mais ações"
                                    aria-label="Mais ações"
                                    aria-haspopup="true"
                                    aria-expanded={menuAberto}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
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

              {/* ── Menu de Ações (Portal para evitar recorte por overflow da tabela) ── */}
              {menuAbertoId && menuEventoAtivo && dropdownCoords && typeof document !== 'undefined' && createPortal(
                <div data-menu-portal="true">
                  {/* Overlay invisível para capturar clique fora */}
                  <div
                    className="fixed inset-0 z-[99998] bg-transparent"
                    onClick={fecharMenuAcoes}
                    aria-hidden="true"
                  />

                  {/* Menu flutuante sobreposto */}
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    style={{
                      position: 'fixed',
                      top: `${dropdownCoords.top}px`,
                      left: `${dropdownCoords.left}px`,
                      zIndex: 99999,
                      maxHeight: `${dropdownCoords.maxHeight}px`,
                    }}
                    className="w-52 bg-white rounded-xl border border-slate-200 shadow-2xl py-1 text-left overflow-y-auto animate-in fade-in zoom-in-95 duration-100 focus:outline-none"
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        fecharMenuAcoes();
                        selecionarEvento(menuEventoAtivo, 'inscricoes');
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition text-left"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Gerenciar Inscrições</span>
                    </button>

                    <button
                      role="menuitem"
                      onClick={() => {
                        fecharMenuAcoes();
                        selecionarEvento(menuEventoAtivo, 'checkin');
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition text-left"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Realizar Check-in</span>
                    </button>

                    <button
                      role="menuitem"
                      onClick={() => {
                        fecharMenuAcoes();
                        selecionarEvento(menuEventoAtivo, 'relatorios');
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition text-left"
                    >
                      <FileBarChart2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Relatório do Evento</span>
                    </button>

                    {menuEventoAtivo.inclui_certificado && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          const ev = menuEventoAtivo;
                          fecharMenuAcoes();
                          abrirPreviewCertificado(ev.certificado_modelo_id, ev);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition text-left"
                      >
                        <Award className="w-3.5 h-3.5 text-blue-600" />
                        <span>Visualizar Certificado</span>
                      </button>
                    )}

                    {scope.canWrite && (
                      <button
                        role="menuitem"
                        onClick={async () => {
                          const ev = menuEventoAtivo;
                          fecharMenuAcoes();
                          const novoStatus = !ev.aceita_inscricao;
                          const { error } = await supabase
                            .from('eventos')
                            .update({ aceita_inscricao: novoStatus })
                            .eq('id', ev.id);
                          if (error) {
                            showModal('Erro', 'Não foi possível alterar o status das inscrições.', 'error');
                          } else {
                            setEventos(prev => prev.map(item => item.id === ev.id ? { ...item, aceita_inscricao: novoStatus } : item));
                            if (eventoSelecionado?.id === ev.id) {
                              setEventoSelecionado(prev => prev ? { ...prev, aceita_inscricao: novoStatus } : null);
                            }
                            showModal(
                              'Sucesso',
                              novoStatus ? 'Inscrições abertas com sucesso!' : 'Inscrições encerradas com sucesso!',
                              'success'
                            );
                          }
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition text-left"
                      >
                        {menuEventoAtivo.aceita_inscricao ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Encerrar Inscrições</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Abrir Inscrições</span>
                          </>
                        )}
                      </button>
                    )}

                    {menuEventoAtivo.is_publico && menuEventoAtivo.slug && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          fecharMenuAcoes();
                          copiarLink(menuEventoAtivo);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition text-left"
                      >
                        <Copy className="w-3.5 h-3.5 text-teal-600" />
                        <span>Copiar Link Público</span>
                      </button>
                    )}

                    {scope.canDelete && (
                      <>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          role="menuitem"
                          onClick={() => {
                            fecharMenuAcoes();
                            handleDeleteEvento(menuEventoAtivo.id);
                          }}
                          className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition text-left"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir Evento</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>,
                document.body
              )}
              </>
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
                  {aba === 'pagamentos' ? 'Evento Pago Selecionado' : 'Evento Selecionado'}
                </label>
                <select
                  value={(aba === 'pagamentos' && !eventoSelecionado?.evento_pago) ? '' : (eventoSelecionado?.id ?? '')}
                  onChange={ev => {
                    const lista = aba === 'pagamentos' ? eventosPagos : eventos;
                    const found = lista.find(x => x.id === ev.target.value) ?? null;
                    setEventoSelecionado(found);
                    setInscricoes([]);
                    setPagamentos([]);
                    setBuscaInsc('');
                    setFiltroStatusInsc('');
                    setBuscaCheckin('');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1d4ed8] transition"
                >
                  {aba === 'pagamentos' ? (
                    <>
                      <option value="">
                        {eventosPagos.length === 0
                          ? '— Nenhum evento pago encontrado —'
                          : '— Selecione um evento pago —'}
                      </option>
                      {eventosPagos.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {fmtDate(ev.data_inicio)} — {ev.titulo} ({fmtBRL(ev.valor_inscricao)})
                        </option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value="">— Selecione um evento —</option>
                      {eventos.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {fmtDate(ev.data_inicio)} — {ev.titulo} ({statusEventoInfo(ev.status).label})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {eventoSelecionado && (aba !== 'pagamentos' || eventoSelecionado.evento_pago) && (
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

            {eventoSelecionado && (aba !== 'pagamentos' || eventoSelecionado.evento_pago) && (
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
                {eventoSelecionado.evento_pago && (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[11px]">
                    <CreditCard className="w-3 h-3" />
                    {fmtBRL(eventoSelecionado.valor_inscricao)}
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
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
              >
                <option value="">Todos os status</option>
                {STATUS_INSCRICAO.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                value={filtroCongInsc}
                onChange={e => setFiltroCongInsc(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 max-w-[200px] truncate focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
              >
                <option value="">Todas as congregações</option>
                {congregacoes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>

              {scope.canWrite && (
                isEventoPago(eventoSelecionado) ? (
                  <button
                    onClick={() => abrirBalcao(eventoSelecionado.id)}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                    title="Realizar inscrição presencial e recebimento pelo Balcão"
                  >
                    <Store className="w-4 h-4" />
                    <span>Inscrever (Balcão)</span>
                  </button>
                ) : (
                  <button
                    onClick={abrirNovaInscricao}
                    className="inline-flex items-center gap-1.5 bg-[#0f3460] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#162a47] transition shadow-xs cursor-pointer"
                    title="Realizar inscrição no evento gratuito"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Inscrever</span>
                  </button>
                )
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
                onClick={() => exportarCSVInscricoes(inscricoesFiltradas, eventoSelecionado.titulo)}
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

            {/* Modal de Inscrição no Evento com Backdrop (Criação e Edição) */}
            {showFormInsc && scope.canWrite && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl border border-slate-200/90 w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] h-[640px] flex flex-col shadow-2xl relative">
                  {/* Cabeçalho Fixo e Estável */}
                  <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0f3460] flex items-center justify-center shrink-0">
                        {editingInscId ? <Pencil className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                          {editingInscId ? 'Editar Inscrição no Evento' : 'Nova Inscrição no Evento'}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium truncate max-w-sm sm:max-w-md">
                          {eventoSelecionado.titulo}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowFormInsc(false);
                        setEditingInscId(null);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Corpo Rolável Interno Estável */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {/* Campo de Busca de Membro com Dropdown Flutuante */}
                    <div className="relative">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Buscar Membro Cadastrado
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          ref={inputBuscaMembroRef}
                          value={buscaMembro}
                          onChange={e => {
                            const val = e.target.value;
                            setBuscaMembro(val);
                            if (membroSelecionado) {
                              setMembroSelecionado(null);
                            }
                            setFormInsc(f => ({ ...f, nome_externo: val }));
                          }}
                          placeholder="Digite 3 ou mais letras para buscar no rol de membros ou digite o nome completo..."
                          className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0f3460]/20"
                        />
                      </div>

                      {/* Dropdown Flutuante de Resultados — não empurra nem redimensiona o modal */}
                      {resultadosMembro.length > 0 && !membroSelecionado && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 border border-slate-200 rounded-xl max-h-48 overflow-y-auto bg-white shadow-2xl z-30 divide-y divide-slate-100">
                          {resultadosMembro.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setMembroSelecionado(m);
                                setBuscaMembro(m.nome_completo);
                                setResultadosMembro([]);
                                setFormInsc(f => ({
                                  ...f,
                                  member_id: m.id,
                                  nome_externo: '',
                                  cpf: m.cpf || f.cpf,
                                  email_externo: m.email || f.email_externo,
                                  telefone: m.telefone || f.telefone,
                                  congregacao_id: m.congregacao_id || f.congregacao_id,
                                }));
                              }}
                              className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-blue-50 text-slate-800 font-medium cursor-pointer transition flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{m.nome_completo}</p>
                                {(m.cpf || m.email || m.telefone) && (
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {[m.cpf ? `CPF: ${m.cpf}` : null, m.email, m.telefone].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                                Selecionar
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {membroSelecionado && (
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mt-2 bg-emerald-50/70 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                          <span className="flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">Membro selecionado: {membroSelecionado.nome_completo}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setMembroSelecionado(null);
                              setBuscaMembro('');
                              setFormInsc(f => ({ ...f, member_id: '', nome_externo: '' }));
                              setTimeout(() => inputBuscaMembroRef.current?.focus(), 50);
                            }}
                            className="text-slate-500 hover:text-slate-700 text-[11px] font-normal underline cursor-pointer shrink-0 ml-2"
                          >
                            Alterar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">CPF</label>
                        <input
                          value={formInsc.cpf}
                          onChange={e => setFormInsc(f => ({ ...f, cpf: formatCpf(e.target.value) }))}
                          maxLength={14}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
                          placeholder="000.000.000-00"
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
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Congregação</label>
                        <select
                          value={formInsc.congregacao_id}
                          onChange={e => setFormInsc(f => ({ ...f, congregacao_id: e.target.value }))}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f3460]/20"
                        >
                          <option value="">— Selecione a congregação —</option>
                          {congregacoes.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {eventoSelecionado.inclui_hospedagem && (
                      <div className="space-y-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-800">
                          <input
                            type="checkbox"
                            checked={formInsc.com_hospedagem}
                            onChange={e => setFormInsc(f => ({ ...f, com_hospedagem: e.target.checked }))}
                            className="w-4 h-4 rounded text-amber-600"
                          />
                          <Bed className="w-4 h-4 text-amber-600" /> Solicitar vaga de hospedagem
                        </label>
                        {formInsc.com_hospedagem && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[11px] font-semibold text-amber-900">Status da Hospedagem:</span>
                            <select
                              value={formInsc.status_hospedagem ?? 'solicitada'}
                              onChange={e => setFormInsc(f => ({ ...f, status_hospedagem: e.target.value as StatusHospedagem }))}
                              className={`rounded-lg px-2.5 py-1 border text-xs font-bold bg-white cursor-pointer ${statusHospCor(formInsc.status_hospedagem)}`}
                            >
                              {STATUS_HOSPEDAGEM.filter(s => s.value !== 'nao_aplicavel').map(s => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
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

                    {/* Alerta em tempo real de inscrição duplicada */}
                    {duplicidadeAvisoInsc && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold text-rose-900">Inscrição já existente no evento</p>
                          <p className="text-rose-700 leading-relaxed">{duplicidadeAvisoInsc}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rodapé Fixo de Ações com Posição Estável */}
                  <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-3xl shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFormInsc(false);
                        setEditingInscId(null);
                        setDuplicidadeAvisoInsc(null);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(duplicidadeAvisoInsc) || duplicidadeChecandoInsc}
                      onClick={handleSaveInscricao}
                      className="px-5 py-2.5 rounded-xl bg-[#0f3460] text-white text-xs font-bold hover:bg-[#162a47] transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {duplicidadeChecandoInsc ? 'Verificando...' : editingInscId ? 'Salvar Alterações' : 'Confirmar Inscrição'}
                    </button>
                  </div>
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
                        <th className="px-4 py-3.5">Congregação</th>
                        <th className="px-4 py-3.5">Contato</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Benefícios</th>
                        {scope.canWrite && <th className="px-4 py-3.5 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inscricoesFiltradas.map(i => (
                        <tr key={i.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3.5 font-bold text-slate-900">{i.nome_display}</td>
                          <td className="px-4 py-3.5 text-slate-600 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className={i.congregacao_nome && i.congregacao_nome !== 'Não informada' ? 'text-slate-700 font-semibold' : 'text-slate-400 italic'}>
                                {i.congregacao_nome || 'Não informada'}
                              </span>
                            </span>
                          </td>
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
                          {scope.canWrite && (
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => abrirEditarInscricao(i)}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-[#0f3460] hover:bg-slate-100 transition cursor-pointer"
                                  title="Editar inscrição"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {eventoSelecionado.inclui_certificado && i.status === 'confirmado' && (
                                  <button
                                    onClick={() => handleImprimirCertificado(i)}
                                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                    title="Emitir/Imprimir Certificado Individual"
                                  >
                                    <Award className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInscricao(i)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
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

            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  value={buscaCheckin}
                  onChange={e => setBuscaCheckin(e.target.value)}
                  placeholder="Pesquisar por nome ou e-mail para validar presença..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={abrirModalLinkCheckin}
                  className="inline-flex items-center gap-2 bg-[#0f3460] hover:bg-[#162a47] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs whitespace-nowrap active:scale-95"
                  title="Gerar link público temporário com QR Code para leitura na entrada do evento"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Link público de Check-in</span>
                </button>
                <button
                  onClick={() => carregarInscricoes(eventoSelecionado.id)}
                  title="Recarregar lista"
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
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
        {aba === 'pagamentos' && eventoSelecionado && eventoSelecionado.evento_pago && (
          <div className="space-y-4">
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
                <p className="text-xs font-bold text-slate-700">Nenhum pagamento registrado até o momento para este evento.</p>
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

              {eventoSelecionado.whatsapp_grupo_url && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 font-semibold block text-xs mb-1.5">Comunicação e Grupo</span>
                  <a
                    href={eventoSelecionado.whatsapp_grupo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-2xs"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>Entrar no Grupo do WhatsApp do Evento</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={gerandoRelatorioPdf}
                onClick={async () => {
                  if (!eventoSelecionado) return;
                  setGerandoRelatorioPdf(true);
                  try {
                    const res = await fetch(`/api/v1/eventos/${eventoSelecionado.id}/relatorio/pdf`);
                    if (!res.ok) {
                      const errData = await res.json().catch(() => ({}));
                      throw new Error(errData.error || `Erro ao gerar PDF (${res.status})`);
                    }
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                  } catch (err: any) {
                    showModal('Erro ao gerar relatório', err?.message || 'Falha ao processar PDF institucional.', 'error');
                  } finally {
                    setGerandoRelatorioPdf(false);
                  }
                }}
                className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                title="Gerar e imprimir Relatório Gerencial completo do evento em PDF"
              >
                {gerandoRelatorioPdf ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Gerando PDF Gerencial...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Gerar Relatório PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={() => exportarCSVInscricoes(inscricoes, eventoSelecionado.titulo)}
                className="inline-flex items-center gap-2 bg-[#0f3460] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#162a47] transition shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Lista de Participantes (CSV)</span>
              </button>
            </div>
          </div>
        )}

        {/* Placeholder: Nenhum evento selecionado nas abas secundárias */}
        {aba !== 'eventos' && (!eventoSelecionado || (aba === 'pagamentos' && !eventoSelecionado.evento_pago)) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
            {aba === 'pagamentos' ? (
              <>
                <CreditCard className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">
                  {eventosPagos.length === 0
                    ? 'Nenhum evento pago encontrado.'
                    : 'Selecione um evento pago para visualizar as transações'}
                </p>
                <p className="text-xs text-slate-500">
                  {eventosPagos.length === 0
                    ? 'Crie ou edite um evento habilitando a opção "Evento pago" para gerenciar cobranças e pagamentos.'
                    : 'Escolha um evento no seletor acima ou volte para a aba de Eventos.'}
                </p>
              </>
            ) : (
              <>
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Selecione um evento para visualizar os dados</p>
                <p className="text-xs text-slate-500">
                  Escolha um evento no seletor acima ou volte para a aba de Eventos.
                </p>
              </>
            )}
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════════
            MODAL: ATENDIMENTO DE BALCÃO (INSCRIÇÃO PRESENCIAL)
        ══════════════════════════════════════════════════════════════════════ */}
        {showBalcaoModal && scope.canWrite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-white to-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      Atendimento de Balcão
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Inscrição presencial com confirmação imediata
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBalcaoModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {balcaoSucesso ? (
                  /* ── TELA DE SUCESSO E COMPROVANTE ── */
                  <div className="space-y-5 animate-in zoom-in-95 duration-150">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2 shadow-xs">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-emerald-900">Inscrição Confirmada com Sucesso!</h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        O participante foi registrado e confirmado no evento.
                      </p>
                    </div>

                    {/* Voucher Ticket */}
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 bg-slate-50/60 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Evento</span>
                          <span className="text-sm font-black text-slate-900">{balcaoSucesso.evento.titulo}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Confirmado
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 font-medium block">Participante</span>
                          <span className="font-bold text-slate-800">{balcaoSucesso.nomeParticipante}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Forma de Pagamento</span>
                          <span className="font-bold text-slate-800">{balcaoSucesso.formaPagamento}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Data do Evento</span>
                          <span className="font-medium text-slate-700">
                            {new Date(balcaoSucesso.evento.data_inicio).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Cód. Inscrição</span>
                          <span className="font-mono font-bold text-blue-700">
                            #{balcaoSucesso.inscricaoId.substring(0, 8).toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Benefícios contemplados */}
                      {(balcaoSucesso.comHospedagem || balcaoSucesso.temBrinde) && (
                        <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-2">
                          {balcaoSucesso.comHospedagem && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Bed className="w-3 h-3" /> Hospedagem Solicitada
                            </span>
                          )}
                          {balcaoSucesso.temBrinde && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
                              <Gift className="w-3 h-3" /> Brinde Garantido
                            </span>
                          )}
                        </div>
                      )}

                      {/* Total Box */}
                      <div className="mt-3 bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">Valor Cobrado / Registrado</span>
                        <span className="text-base font-black text-[#1d4ed8]">
                          {balcaoSucesso.valorPago > 0
                            ? `R$ ${balcaoSucesso.valorPago.toFixed(2).replace('.', ',')}`
                            : 'R$ 0,00 (Gratuito / Cortesia)'}
                        </span>
                      </div>
                    </div>

                    {/* Botões do Sucesso */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={handleImprimirComprovanteBalcao}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir Comprovante</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirBalcao(balcaoEventoId)}
                        className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Novo Atendimento</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── FORMULÁRIO DE INSCRIÇÃO PRESENCIAL ── */
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleSalvarInscricaoBalcao();
                    }}
                    className="space-y-4.5"
                  >
                    {/* 1. SELEÇÃO DO EVENTO */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        Evento *
                      </label>
                      <select
                        value={balcaoEventoId}
                        onChange={e => setBalcaoEventoId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white transition"
                      >
                        <option value="">Selecione um evento pago...</option>
                        {eventosPagos.map(ev => (
                          <option key={ev.id} value={ev.id}>
                            {ev.titulo} — {new Date(ev.data_inicio).toLocaleDateString('pt-BR')} (
                            R$ {typeof ev.valor_inscricao === 'number' ? ev.valor_inscricao.toFixed(2).replace('.', ',') : ev.valor_inscricao}
                            )
                          </option>
                        ))}
                      </select>

                      {/* Card informativo do evento selecionado */}
                      {(() => {
                        const evSel = eventos.find(e => e.id === balcaoEventoId);
                        if (!evSel) return null;
                        const benfs = getBeneficiosLabels(evSel);
                        return (
                          <div className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${evSel.evento_pago ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                                {evSel.evento_pago ? `Valor: R$ ${typeof evSel.valor_inscricao === 'number' ? evSel.valor_inscricao.toFixed(2).replace('.', ',') : evSel.valor_inscricao}` : 'Evento Gratuito'}
                              </span>
                              {evSel.capacidade != null && (
                                <span className="text-slate-500 font-medium">
                                  Capacidade: {evSel.capacidade} vagas
                                </span>
                              )}
                            </div>
                            {benfs.length > 0 && (
                              <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-semibold">
                                <span>Benefícios:</span>
                                <span>{benfs.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 2. IDENTIFICAÇÃO DO PARTICIPANTE */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Participante *
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={balcaoBuscaMembro}
                            onChange={e => {
                              const val = e.target.value;
                              setBalcaoBuscaMembro(val);
                              if (balcaoMembro) setBalcaoMembro(null);
                              setBalcaoNome(val);
                            }}
                            placeholder="Buscar membro do rol ou digitar nome completo do participante..."
                            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white transition"
                          />
                        </div>
                        {balcaoResultadosMembro.length > 0 && !balcaoMembro && (
                          <div className="border border-slate-200 rounded-xl mt-1.5 max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white shadow-lg z-10 relative">
                            {balcaoResultadosMembro.map(m => (
                              <button
                                type="button"
                                key={m.id}
                                onClick={() => {
                                  setBalcaoMembro(m);
                                  setBalcaoBuscaMembro(m.nome_completo);
                                  setBalcaoNome(m.nome_completo);
                                  setBalcaoCpf(m.cpf || '');
                                  setBalcaoEmail(m.email || '');
                                  setBalcaoTelefone(m.telefone || '');
                                  setBalcaoCongregacaoId(m.congregacao_id || '');
                                  setBalcaoResultadosMembro([]);
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 text-xs font-medium text-slate-800 transition flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <span className="font-semibold text-slate-900 block">{m.nome_completo}</span>
                                  {(m.congregacao_nome || m.cpf || m.telefone || m.email) && (
                                    <p className="text-[11px] text-slate-400">
                                      {[
                                        m.congregacao_nome,
                                        m.cpf ? `CPF: ${m.cpf}` : null,
                                        m.telefone,
                                        m.email,
                                      ].filter(Boolean).join(' • ')}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-blue-600 uppercase">Selecionar</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {balcaoMembro && (
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 mt-1.5 bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-1.5 shadow-2xs">
                            <span className="flex items-center gap-1.5 truncate">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="truncate">
                                Membro vinculado: <strong>{balcaoMembro.nome_completo}</strong>
                                {balcaoMembro.congregacao_nome && ` (${balcaoMembro.congregacao_nome})`}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setBalcaoMembro(null);
                                setBalcaoBuscaMembro('');
                                setBalcaoNome('');
                                setBalcaoCpf('');
                                setBalcaoEmail('');
                                setBalcaoTelefone('');
                                setBalcaoCongregacaoId('');
                              }}
                              className="text-emerald-700 hover:text-emerald-900 font-bold underline text-[11px] ml-2 shrink-0 cursor-pointer"
                            >
                              Trocar
                            </button>
                          </div>
                        )}
                        {balcaoBuscaMembro.length >= 3 && balcaoResultadosMembro.length === 0 && !balcaoMembro && (
                          <p className="text-[11px] text-slate-400 italic mt-1">
                            Nenhum membro encontrado com esse nome. O participante será cadastrado com os dados preenchidos abaixo.
                          </p>
                        )}
                      </div>

                      {/* Campos Complementares do Participante (CPF, E-mail, Telefone/WhatsApp, Congregação) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            CPF
                          </label>
                          <input
                            type="text"
                            value={balcaoCpf}
                            onChange={e => setBalcaoCpf(formatCpf(e.target.value))}
                            maxLength={14}
                            placeholder="000.000.000-00"
                            className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white transition"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            E-mail
                          </label>
                          <input
                            type="email"
                            value={balcaoEmail}
                            onChange={e => setBalcaoEmail(e.target.value)}
                            placeholder="exemplo@email.com"
                            className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white transition"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Telefone / WhatsApp
                          </label>
                          <input
                            type="tel"
                            value={balcaoTelefone}
                            onChange={e => setBalcaoTelefone(formatarTelefoneMembro(e.target.value))}
                            maxLength={15}
                            placeholder="(00) 00000-0000"
                            className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white transition"
                          />
                        </div>
                        {congregacoes.length > 0 && (
                          <div className="sm:col-span-2 md:col-span-3">
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Congregação / Igreja de Origem
                            </label>
                            <select
                              value={balcaoCongregacaoId}
                              onChange={e => setBalcaoCongregacaoId(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white transition"
                            >
                              <option value="">— Selecione a congregação se aplicável —</option>
                              {congregacoes.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.nome}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. BENEFÍCIO DE HOSPEDAGEM (Se o evento permitir) */}
                    {(() => {
                      const ev = eventos.find(e => e.id === balcaoEventoId);
                      if (!ev?.inclui_hospedagem) return null;
                      return (
                        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={balcaoHospedagem}
                              onChange={e => setBalcaoHospedagem(e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-[#1d4ed8]"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Bed className="w-3.5 h-3.5 text-slate-500" />
                                Incluir vaga de hospedagem
                              </span>
                              {ev.descricao_hospedagem && (
                                <p className="text-[11px] text-slate-500 mt-0.5">{ev.descricao_hospedagem}</p>
                              )}
                            </div>
                          </label>
                        </div>
                      );
                    })()}

                    {/* 4. FORMA DE PAGAMENTO PRESENCIAL (Se evento for pago) */}
                    {(() => {
                      const ev = eventos.find(e => e.id === balcaoEventoId);
                      if (!ev?.evento_pago) return null;
                      return (
                        <div className="space-y-2.5">
                          <label className="text-xs font-bold text-slate-700 block">
                            Forma de Pagamento no Balcão *
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {FORMAS_PAGAMENTO_BALCAO_OPTIONS.map(opt => {
                              const selected = balcaoFormaPagamento === opt.value;
                              return (
                                <label
                                  key={opt.value}
                                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                                    selected
                                      ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400'
                                      : 'bg-white border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="balcaoFormaPagamento"
                                    value={opt.value}
                                    checked={selected}
                                    onChange={() => setBalcaoFormaPagamento(opt.value)}
                                    className="mt-0.5 w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                                  />
                                  <div>
                                    <span className="text-xs font-bold text-slate-900 block">{opt.label}</span>
                                    <span className="text-[11px] text-slate-500 font-medium leading-relaxed block mt-0.5">
                                      {opt.desc}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          {/* Aviso explicativo para PIX */}
                          {balcaoFormaPagamento === 'pix' && (
                            <div className="p-2.5 bg-blue-50/70 border border-blue-200/70 rounded-xl flex items-center gap-2 text-xs text-blue-800 animate-in fade-in duration-150">
                              <span className="font-bold shrink-0">Info:</span>
                              <span>O pagamento será registrado como confirmado via PIX no ato do atendimento presencial.</span>
                            </div>
                          )}

                          {/* Justificativa / Observação */}
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              {balcaoFormaPagamento === 'cortesia'
                                ? 'Motivo / Autorização da Cortesia *'
                                : 'Observações do Atendimento (Opcional)'}
                            </label>
                            <input
                              type="text"
                              value={balcaoJustificativa}
                              onChange={e => setBalcaoJustificativa(e.target.value)}
                              placeholder={
                                balcaoFormaPagamento === 'cortesia'
                                  ? 'Ex: Convidado da mesa, palestrante, isenção pastoral...'
                                  : balcaoFormaPagamento === 'pix'
                                  ? 'Ex: Comprovante PIX conferido no balcão'
                                  : 'Ex: Pago em dinheiro no balcão da secretaria'
                              }
                              className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:bg-white transition"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Resumo Final */}
                    {(() => {
                      const ev = eventos.find(e => e.id === balcaoEventoId);
                      if (!ev) return null;
                      const valorFinal = ev.evento_pago
                        ? balcaoFormaPagamento === 'cortesia'
                          ? 0
                          : typeof ev.valor_inscricao === 'number' ? ev.valor_inscricao : Number(ev.valor_inscricao) || 0
                        : 0;

                      return (
                        <div className="space-y-3">
                          {/* Aviso em tempo real de inscrição duplicada no Balcão */}
                          {balcaoDuplicidadeAviso && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <div className="text-xs space-y-0.5">
                                <p className="font-bold text-rose-900">Participante já inscrito neste evento</p>
                                <p className="text-rose-700 leading-relaxed">{balcaoDuplicidadeAviso}</p>
                              </div>
                            </div>
                          )}

                          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/90 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Total a receber:</span>
                              <span className="text-[11px] text-slate-500">
                                {ev.evento_pago
                                  ? balcaoFormaPagamento === 'cortesia'
                                    ? 'Cortesia autorizada (R$ 0,00)'
                                    : balcaoFormaPagamento === 'pix'
                                    ? 'Pagamento via PIX presencial'
                                    : 'Pagamento à vista presencial'
                                  : 'Inscrição gratuita'}
                              </span>
                            </div>
                            <span className="text-lg font-black text-slate-900">
                              R$ {valorFinal.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBalcaoModal(false);
                          setBalcaoDuplicidadeAviso(null);
                        }}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={balcaoSalvando || Boolean(balcaoDuplicidadeAviso) || balcaoDuplicidadeChecando}
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      >
                        {balcaoSalvando ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Processando...</span>
                          </>
                        ) : balcaoDuplicidadeChecando ? (
                          <span>Verificando...</span>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Confirmar Inscrição no Balcão</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════════
            MODAL: LINK PÚBLICO DE CHECK-IN (QR CODE PORTARIA)
        ══════════════════════════════════════════════════════════════════════ */}
        {showLinkCheckinModal && eventoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100/80 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      Link Público de Check-in
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Acesso rápido para equipe da portaria via smartphone
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkCheckinModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4.5 flex-1">
                {loadingLinkCheckin ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">Gerando link seguro de check-in...</p>
                  </div>
                ) : linkCheckinUrl ? (
                  <div className="space-y-4">
                    {/* Identificação do Evento */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Evento</span>
                        <span className="text-xs font-bold text-slate-800 truncate block">{eventoSelecionado.titulo}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        Ativo
                      </span>
                    </div>

                    {/* QR Code do Link para a Equipe da Entrada */}
                    <div className="p-5 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center space-y-3 shadow-xs">
                      <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-sm">
                        <QRCodeSVG
                          value={linkCheckinUrl}
                          size={180}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800">
                          Aponte a câmera do celular para abrir
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-xs">
                          A equipe da portaria pode escanear este QR Code para começar a validar a entrada dos participantes.
                        </p>
                      </div>
                    </div>

                    {/* Input do Link e Botão Copiar */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        URL do Check-in
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={linkCheckinUrl}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={copiarLinkCheckin}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                            linkCheckinCopiado
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          {linkCheckinCopiado ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Avisos de Segurança e Expiração */}
                    <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-slate-600 space-y-1">
                      <p className="font-semibold text-blue-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        Acesso seguro e restrito
                      </p>
                      <p className="leading-relaxed text-slate-600">
                        O link funciona sem login e expira automaticamente caso o evento seja encerrado ou cancelado.
                        {linkCheckinExpiraEm && (
                          <span className="block mt-0.5 text-slate-500 font-medium">
                            Válido até {new Date(linkCheckinExpiraEm).toLocaleString('pt-BR')}.
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Botões do Rodapé */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => window.open(linkCheckinUrl, '_blank')}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0f3460] hover:bg-[#162a47] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Abrir Leitor no Navegador</span>
                      </button>
                      <button
                        type="button"
                        onClick={regerarLinkCheckin}
                        className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
                        title="Inativa o link atual e cria uma nova chave de acesso"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Regerar Chave</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Nenhum link ativo encontrado.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════════
            MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE INSCRIÇÃO
        ══════════════════════════════════════════════════════════════════════ */}
        {inscricaoParaExcluir && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header com destaque de perigo/alerta */}
              <div className="px-6 py-4.5 bg-gradient-to-r from-rose-50 via-white to-white border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100/80 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      Excluir Inscrição
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Esta ação removerá o participante deste evento
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={excluindoInsc}
                  onClick={() => setInscricaoParaExcluir(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tem certeza de que deseja remover a inscrição deste participante? Todos os registros associados a esta inscrição no evento serão desvinculados.
                </p>

                {/* Card de Detalhes do Participante */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 font-medium">Participante:</span>
                    <span className="font-bold text-slate-900 text-right">
                      {inscricaoParaExcluir.nome_display ?? inscricaoParaExcluir.nome_externo ?? 'Não informado'}
                    </span>
                  </div>

                  {inscricaoParaExcluir.email_externo && (
                    <div className="flex items-start justify-between gap-2 border-t border-slate-200/50 pt-1.5">
                      <span className="text-slate-500 font-medium">E-mail:</span>
                      <span className="text-slate-700 font-medium text-right">
                        {inscricaoParaExcluir.email_externo}
                      </span>
                    </div>
                  )}

                  {inscricaoParaExcluir.telefone && (
                    <div className="flex items-start justify-between gap-2 border-t border-slate-200/50 pt-1.5">
                      <span className="text-slate-500 font-medium">Telefone / WhatsApp:</span>
                      <span className="text-slate-700 font-medium text-right">
                        {inscricaoParaExcluir.telefone}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 border-t border-slate-200/50 pt-1.5">
                    <span className="text-slate-500 font-medium">Status da Inscrição:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-800">
                      {statusInscricaoLabel(inscricaoParaExcluir.status)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Essa exclusão é permanente e liberará a vaga para outros participantes.</span>
                </div>
              </div>

              {/* Rodapé com botões de ação */}
              <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={excluindoInsc}
                  onClick={() => setInscricaoParaExcluir(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={excluindoInsc}
                  onClick={confirmarExclusaoInscricao}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {excluindoInsc ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Inscrição</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
