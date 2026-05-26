'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { Pencil, Plus, Trash2, X, TrendingUp, Building2, Tag, Printer, Users, CalendarDays, Lock, Unlock, CheckCircle, Search, Download, CreditCard, List, Star, AlertCircle, QrCode, Copy, ExternalLink, Settings, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import type { ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Congregacao { id: string; nome: string; }
interface Departamento { id: string; nome: string; sigla: string; }

interface Dizimista {
  id: string;
  nome: string;
  congregacao_id: string | null;
  congregacao_nome: string;
  membro_desde: string; // YYYY-MM
}

interface Lancamento {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  departamento_id: string | null;
  member_id: string | null;
  dizimista_nome: string | null;
  tipo_recebimento: TipoRecebimento;
  tipo_movimento: TipoMovimento;
  descricao: string | null;
  referencia: string | null;
  valor: number;
  forma_pagamento: FormaPagamento;
  data_lancamento: string;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  // joined
  congregacao_nome?: string;
  departamento_nome?: string;
}

type TipoRecebimento = 'oferta' | 'dizimo' | 'evento' | 'campanha' | 'contribuicao' | 'outros' | 'missoes';
type FormaPagamento  = 'dinheiro' | 'pix' | 'cartao' | 'transferencia' | 'cheque';
type TipoMovimento  = 'entrada' | 'saida';
type Aba = 'dashboard' | 'lancamentos' | 'caixa' | 'relatorio' | 'dizimistas' | 'contas' | 'categorias' | 'arrecadacao';
type SubAbaArrecadacao = 'destinos' | 'cobrancas' | 'webhooks';

const TIPOS_SAIDA: { value: string; label: string; cor: string }[] = [
  { value: 'aluguel',         label: 'Aluguel',              cor: 'bg-red-100 text-red-800'     },
  { value: 'utilidades',      label: 'Água / Luz / Internet', cor: 'bg-orange-100 text-orange-800'},
  { value: 'material',        label: 'Material',              cor: 'bg-yellow-100 text-yellow-800'},
  { value: 'pessoal',         label: 'Pessoal / Salários',    cor: 'bg-rose-100 text-rose-800'   },
  { value: 'manutencao',      label: 'Manutenção',            cor: 'bg-amber-100 text-amber-800' },
  { value: 'missoes_saida',   label: 'Missões (repasse)',     cor: 'bg-teal-100 text-teal-800'  },
  { value: 'eventos_despesa', label: 'Eventos (despesa)',     cor: 'bg-purple-100 text-purple-800'},
  { value: 'outros_despesa',  label: 'Outros',                cor: 'bg-gray-100 text-gray-700'  },
];

interface Fechamento {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  mes_referencia: string;
  saldo_inicial: number;
  total_entradas: number;
  total_saidas: number;
  saldo_final: number;
  status: 'aberto' | 'fechado';
  observacoes: string | null;
  fechado_por: string | null;
  fechado_em: string | null;
  status_conselho_fiscal?: string;
}

const TIPOS: { value: TipoRecebimento; label: string; cor: string }[] = [
  { value: 'oferta',       label: 'Oferta',       cor: 'bg-blue-100 text-blue-800'    },
  { value: 'dizimo',       label: 'Dízimo',        cor: 'bg-green-100 text-green-800'  },
  { value: 'evento',       label: 'Evento',        cor: 'bg-purple-100 text-purple-800'},
  { value: 'campanha',     label: 'Campanha',      cor: 'bg-orange-100 text-orange-800'},
  { value: 'contribuicao', label: 'Contribuição',  cor: 'bg-pink-100 text-pink-800'   },
  { value: 'missoes',      label: 'Missões',       cor: 'bg-teal-100 text-teal-800'   },
  { value: 'outros',       label: 'Outros',        cor: 'bg-gray-100 text-gray-700'   },
];

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: 'dinheiro',     label: 'Dinheiro'      },
  { value: 'pix',          label: 'PIX'           },
  { value: 'cartao',       label: 'Cartão'        },
  { value: 'transferencia',label: 'Transferência' },
  { value: 'cheque',       label: 'Cheque'        },
];

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string) => {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

const MESES = [
  '01','02','03','04','05','06','07','08','09','10','11','12'
];
const MESES_LABEL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

// ─── Fase 2 — Tipos e helpers ────────────────────────────────────────────────

interface MesDados {
  mes: string;    // YYYY-MM
  label: string;  // 'Jan/25'
  entradas: number;
  saidas: number;
  saldo: number;
}

function exportarCSV(linhas: Lancamento[], nomeArquivo: string) {
  const header = ['Data', 'Movimento', 'Tipo/Categoria', 'Caixa', 'Departamento', 'Descrição', 'Referência', 'Forma Pagamento', 'Valor (R$)'];
  const rows = linhas.map(l => [
    fmtDate(l.data_lancamento),
    l.tipo_movimento === 'saida' ? 'Saída' : 'Entrada',
    l.tipo_movimento === 'saida'
      ? (TIPOS_SAIDA.find(t => t.value === l.tipo_recebimento)?.label ?? l.tipo_recebimento)
      : tipoLabel(l.tipo_recebimento),
    l.congregacao_nome ?? 'Caixa Geral (Sede)',
    l.departamento_nome ?? 'Caixa da Igreja',
    l.descricao ?? '',
    l.referencia ?? '',
    l.forma_pagamento,
    Number(l.valor).toFixed(2).replace('.', ','),
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MonthPicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 2 + i); // -2 a +3
  const [ano, mes] = value ? value.split('-') : [String(anoAtual), String(new Date().getMonth() + 1).padStart(2,'0')];

  const update = (m: string, a: string) => onChange(`${a}-${m}`);

  return (
    <div className={`flex gap-1 ${className ?? ''}`}>
      <select
        value={mes}
        onChange={e => update(e.target.value, ano)}
        className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm"
      >
        {MESES.map((m, i) => <option key={m} value={m}>{MESES_LABEL[i]}</option>)}
      </select>
      <select
        value={ano}
        onChange={e => update(mes, e.target.value)}
        className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm"
      >
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

const tipoLabel = (t: string) => TIPOS.find(x => x.value === t)?.label ?? t;
const tipoCor   = (t: string) => TIPOS.find(x => x.value === t)?.cor   ?? 'bg-gray-100 text-gray-700';

const mesAtual = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

// Retorna 'YYYY-MM' do mês seguinte — usado para construir date range indexável no banco
// new Date(y, m, 1): m é 1-based aqui, o construtor JS trata overflow automaticamente (Dez → Jan)
const mesProximo = (mes: string): string => {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

type FormLanc = {
  congregacao_id: string;
  departamento_id: string;
  tipo_movimento: TipoMovimento;
  tipo_recebimento: TipoRecebimento | '';
  categoria_saida: string;
  descricao: string;
  referencia: string;
  valor: string;
  forma_pagamento: FormaPagamento;
  data_lancamento: string;
  observacoes: string;
  conta_id: string;
  categoria_id: string;
};

const emptyForm = (): FormLanc => ({
  congregacao_id:   '',
  departamento_id:  '',
  tipo_movimento:   'entrada',
  tipo_recebimento: '',
  categoria_saida:  '',
  descricao:        '',
  referencia:       '',
  valor:            '',
  forma_pagamento:  'dinheiro',
  data_lancamento:  new Date().toISOString().split('T')[0],
  observacoes:      '',
  conta_id:         '',
  categoria_id:     '',
});

// Interfaces para dados financeiros (Fase 1)
interface FinConta {
  id: string;
  nome: string;
  tipo: string;
  is_padrao: boolean;
  congregacao_id: string | null;
}

interface FinCategoria {
  id: string;
  nome: string;
  tipo_movimento: string;
  cor: string | null;
  icone: string | null;
}

// Full interfaces for CRUD tabs
interface FinContaFull {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  nome: string;
  tipo: 'caixa' | 'conta_corrente' | 'poupanca' | 'pix' | 'fundo' | 'outro';
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  chave_pix: string | null;
  saldo_inicial: number;
  is_ativa: boolean;
  is_padrao: boolean;
  created_at: string;
}

interface FinCategoriaFull {
  id: string;
  ministry_id: string | null;
  nome: string;
  tipo_movimento: 'entrada' | 'saida' | 'ambos';
  codigo: string | null;
  categoria_pai_id: string | null;
  cor: string | null;
  icone: string | null;
  is_sistema: boolean;
  is_ativa: boolean;
  modulo_origem: string | null;
}

type FormConta = {
  nome: string;
  tipo: 'caixa' | 'conta_corrente' | 'poupanca' | 'pix' | 'fundo' | 'outro';
  banco: string;
  agencia: string;
  conta: string;
  chave_pix: string;
  saldo_inicial: string;
  congregacao_id: string;
  is_padrao: boolean;
  is_ativa: boolean;
};

const emptyFormConta = (): FormConta => ({
  nome: '', tipo: 'caixa', banco: '', agencia: '', conta: '',
  chave_pix: '', saldo_inicial: '0', congregacao_id: '', is_padrao: false, is_ativa: true,
});

type FormCat = {
  nome: string;
  tipo_movimento: 'entrada' | 'saida' | 'ambos';
  codigo: string;
  cor: string;
  icone: string;
  categoria_pai_id: string;
  is_ativa: boolean;
};

const emptyFormCat = (): FormCat => ({
  nome: '', tipo_movimento: 'entrada', codigo: '', cor: '#6b7280', icone: '', categoria_pai_id: '', is_ativa: true,
});

// ── Arrecadação Digital ───────────────────────────────────────────────────────

interface PaymentDestino {
  id: string;
  congregacao_id: string | null;
  tipo_recebimento: string;
  label: string;
  descricao: string | null;
  public_token: string;
  valor_fixo: number | null;
  is_ativo: boolean;
  expires_at: string | null;
  created_at: string;
  total_arrecadado: number;
  congregacoes?: { nome: string } | null;
}

type FormDestino = {
  label: string;
  tipo_recebimento: string;
  congregacao_id: string;
  conta_id: string;
  categoria_id: string;
  valor_fixo: string;
  descricao: string;
  expires_at: string;
};

// ── Cobranças PIX ───────────────────────────────────────────────────────────────────────
interface FinCobranca {
  id: string;
  destination_id: string;
  gateway_charge_id: string;
  status: 'pendente' | 'pago' | 'cancelado' | 'expirado' | 'estornado';
  payer_name: string | null;
  payer_document: string | null;
  payer_email: string | null;
  valor_solicitado: number;
  valor_pago: number | null;
  invoice_url: string | null;
  tesouraria_lancamento_id: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  // campos computados
  dest_label?: string;
  congregacao_nome?: string;
}

// ── Webhook Events ────────────────────────────────────────────────────────────────────
interface FinWebhookEvent {
  id: string;
  event_type: string;
  gateway_event_id: string;
  processed: boolean;
  processing_error: string | null;
  payload: Record<string, unknown>;
  received_at: string;
}

const TIPOS_DESTINO = [
  { value: 'dizimo',         label: 'Dízimo',    cor: 'bg-green-100 text-green-800'  },
  { value: 'oferta',         label: 'Oferta',    cor: 'bg-blue-100 text-blue-800'    },
  { value: 'missoes',        label: 'Missões',   cor: 'bg-teal-100 text-teal-800'    },
  { value: 'doacao',         label: 'Doação',    cor: 'bg-pink-100 text-pink-800'    },
  { value: 'campanha_local', label: 'Campanha',  cor: 'bg-orange-100 text-orange-800'},
  { value: 'evento_local',   label: 'Evento',    cor: 'bg-purple-100 text-purple-800'},
];

const emptyFormDestino = (): FormDestino => ({
  label: '', tipo_recebimento: 'oferta', congregacao_id: '',
  conta_id: '', categoria_id: '', valor_fixo: '', descricao: '', expires_at: '',
});

const TIPOS_CONTA = [
  { value: 'caixa',          label: 'Caixa Físico'   },
  { value: 'conta_corrente', label: 'Conta Corrente' },
  { value: 'poupanca',       label: 'Poupança'       },
  { value: 'pix',            label: 'Chave PIX'      },
  { value: 'fundo',          label: 'Fundo'          },
  { value: 'outro',          label: 'Outro'          },
];

// ─── Role helpers ─────────────────────────────────────────────────────────────

interface UserScope {
  isFinanceiroLocal: boolean;
  congregacaoId: string | null; // congregação vinculada (para financeiro_local)
  canWrite: boolean;
  canDelete: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TesourariaPage() {
  const { loading: authLoading } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('tesouraria');
  const supabase = useMemo(() => createClient(), []);

  const [ministryId,  setMinistryId]  = useState<string | null>(null);
  const [ministerio,   setMinisterio]  = useState<ConfiguracaoIgreja | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [lancamentos, setLancamentos]   = useState<Lancamento[]>([]);
  const [finContas, setFinContas]       = useState<FinConta[]>([]);
  const [finCategorias, setFinCategorias] = useState<FinCategoria[]>([]);
  const [scope, setScope] = useState<UserScope>({
    isFinanceiroLocal: false, congregacaoId: null, canWrite: true, canDelete: false,
  });

  const [loadingData, setLoadingData] = useState(true);
  const [aba, setAba] = useState<Aba>('dashboard');

  // Fechamentos
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [abaFechaMes, setAbaFechaMes] = useState(mesAtual());
  const [showFechaModal, setShowFechaModal] = useState(false);
  const [fechaObs, setFechaObs] = useState('');
  const [fechaSaldoInicial, setFechaSaldoInicial] = useState('');
  const [salvandoFecha, setSalvandoFecha] = useState(false);
  const [fechaCongId, setFechaCongId] = useState<string | null>(null);

  // Dizimistas
  const [dizimistas, setDizimistas] = useState<Dizimista[]>([]);
  const [dizimistaPagamentos, setDizimistaPagamentos] = useState<{member_id: string; status: string}[]>([]);
  const [loadingDizimistas, setLoadingDizimistas] = useState(false);
  const [abaDizimistaMes, setAbaDizimistaMes] = useState(mesAtual());
  const [filtroNomeDiz, setFiltroNomeDiz] = useState('');
  const [filtroStatusDiz, setFiltroStatusDiz] = useState<'' | 'pago' | 'pendente' | 'avulso'>('');
  const [filtroConsDiz, setFiltroConsDiz] = useState('');

  // Filtros
  const [filtroCong,  setFiltroCong]  = useState('');
  const [filtroTipo,  setFiltroTipo]  = useState('');
  const [filtroMes,   setFiltroMes]   = useState(mesAtual());
  const [relMes,           setRelMes]           = useState(mesAtual());
  const [relCong,          setRelCong]          = useState('');
  const [relMostrarDet,    setRelMostrarDet]    = useState(false);
  const [relTipoRel,       setRelTipoRel]       = useState<'entradas' | 'saidas' | 'ambos'>('entradas');

  // ── Contas (CRUD) ──────────────────────────────────────────────────────────
  const [contasFull,      setContasFull]      = useState<FinContaFull[]>([]);
  const [loadingContas,   setLoadingContas]   = useState(false);
  const [showContaModal,  setShowContaModal]  = useState(false);
  const [contaEditId,     setContaEditId]     = useState<string | null>(null);
  const [formConta,       setFormConta]       = useState<FormConta>(emptyFormConta());
  const [savingConta,     setSavingConta]     = useState(false);
  const [confirmDelConta, setConfirmDelConta] = useState<string | null>(null);

  // ── Categorias (CRUD) ──────────────────────────────────────────────────────
  const [categoriasFull,  setCategoriasFull]  = useState<FinCategoriaFull[]>([]);
  const [loadingCats,     setLoadingCats]     = useState(false);
  const [showCatModal,    setShowCatModal]    = useState(false);
  const [catEditId,       setCatEditId]       = useState<string | null>(null);
  const [formCat,         setFormCat]         = useState<FormCat>(emptyFormCat());
  const [savingCat,       setSavingCat]       = useState(false);
  const [confirmDelCat,   setConfirmDelCat]   = useState<string | null>(null);
  const [filtroCatTipo,   setFiltroCatTipo]   = useState<'' | 'entrada' | 'saida' | 'ambos'>('');

  // Formulário
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState<FormLanc>(emptyForm());
  const [editId,    setEditId]    = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Busca de dizimista no formulário
  const [dizBusca,    setDizBusca]    = useState('');
  const [dizBuscaRes, setDizBuscaRes] = useState<{id: string; nome: string}[]>([]);
  const [dizSelId,    setDizSelId]    = useState<string | null>(null);
  const [dizSelNome,  setDizSelNome]  = useState('');
  const [dizBuscando, setDizBuscando] = useState(false);
  const [dizIsAvulso, setDizIsAvulso] = useState(false);
  const [dizAvulsoNome, setDizAvulsoNome] = useState('');

  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; type: 'success'|'error'|'info' }>({
    open: false, title: '', message: '', type: 'success',
  });

  // ── Arrecadação Digital (CRUD) ────────────────────────────────────────────
  const [destinos,             setDestinos]             = useState<PaymentDestino[]>([]);
  const [loadingDestinos,      setLoadingDestinos]      = useState(false);
  const [showDestinoModal,     setShowDestinoModal]     = useState(false);
  const [destinoEditId,        setDestinoEditId]        = useState<string | null>(null);
  const [formDestino,          setFormDestino]          = useState<FormDestino>(emptyFormDestino());
  const [savingDestino,        setSavingDestino]        = useState(false);
  const [showQrModal,          setShowQrModal]          = useState(false);
  const [qrDestino,            setQrDestino]            = useState<{ token: string; label: string } | null>(null);
  const [filtroDestinoStatus,  setFiltroDestinoStatus]  = useState<'' | 'ativo' | 'inativo'>('');
  const [filtroDestinoTipo,    setFiltroDestinoTipo]    = useState('');
  const [filtroDestinoCong,    setFiltroDestinoCong]    = useState('');
  const [qrCopied,             setQrCopied]             = useState(false);
  const [confirmDelDestino,    setConfirmDelDestino]    = useState<string | null>(null);

  // ── Arrecadação — sub-abas e cobranças/webhooks ───────────────────────────
  const [subAbaArr,              setSubAbaArr]              = useState<SubAbaArrecadacao>('destinos');
  const [gatewayAtivo,           setGatewayAtivo]           = useState<boolean | null>(null);
  const [cobrancas,              setCobrancas]              = useState<FinCobranca[]>([]);
  const [loadingCobrancas,       setLoadingCobrancas]       = useState(false);
  const [cobrFiltroStatus,       setCobrFiltroStatus]       = useState('');
  const [cobrFiltroDestino,      setCobrFiltroDestino]      = useState('');
  const [cobrFiltroCong,         setCobrFiltroCong]         = useState('');
  const [cobrFiltroStart,        setCobrFiltroStart]        = useState('');
  const [cobrFiltroEnd,          setCobrFiltroEnd]          = useState('');
  const [webhookEvents,          setWebhookEvents]          = useState<FinWebhookEvent[]>([]);
  const [loadingWebhooks,        setLoadingWebhooks]        = useState(false);
  const [webhookFiltroProcessado, setWebhookFiltroProcessado] = useState<'' | 'sim' | 'nao'>('' );

  // ── Fase 2 ────────────────────────────────────────────────────────────────
  const [dadosGrafico,    setDadosGrafico]    = useState<MesDados[]>([]);
  const [loadingGrafico,  setLoadingGrafico]  = useState(false);
  const [lancamentosMes,  setLancamentosMes]  = useState<Lancamento[]>([]);
  const [loadingMes,      setLoadingMes]      = useState(false);
  const [filtroMovimento, setFiltroMovimento] = useState<'' | 'entrada' | 'saida'>('');

  // ── Relatório — dados diretos do banco (substituem relFiltrado in-memory) ──
  const [relDadosDB,   setRelDadosDB]   = useState<Lancamento[]>([]);
  const [relLoadingDB, setRelLoadingDB] = useState(false);

  const showModal = (title: string, message: string, type: 'success'|'error'|'info' = 'success') =>
    setModal({ open: true, title, message, type });

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoadingData(true);

    const mid = await resolveMinistryId(supabase);
    setMinistryId(mid);
    if (!mid) { setLoadingData(false); return; }

    // Dados do ministério (para timbre de impressão)
    const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
    setMinisterio(config);

    // Detectar role do usuário atual
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    let scopeCongId: string | null = null;
    if (uid) {
      const { data: mu } = await supabase
        .from('ministry_users')
        .select('role, permissions, congregacao_id')
        .eq('ministry_id', mid)
        .eq('user_id', uid)
        .maybeSingle();
      if (mu) {
        const perms: string[] = Array.isArray(mu.permissions) ? mu.permissions : [];
        const isLocal  = perms.includes('FINANCEIRO_LOCAL');
        const isAdmin  = perms.includes('ADMINISTRADOR') || mu.role === 'admin';
        const isFin    = perms.includes('FINANCEIRO');
        if (isLocal) scopeCongId = mu.congregacao_id ?? null;
        setScope({
          isFinanceiroLocal: isLocal,
          congregacaoId:     mu.congregacao_id ?? null,
          canWrite:          isAdmin || isFin || isLocal,
          canDelete:         isAdmin || isFin,
        });
        // financeiro_local: pré-filtrar pela congregação
        if (isLocal && mu.congregacao_id) setFiltroCong(mu.congregacao_id);
      }
    }

    // Congregações
    const { data: congs } = await supabase
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', mid)
      .eq('is_active', true)
      .order('nome');
    setCongregacoes((congs as Congregacao[]) || []);

    // Departamentos
    const { data: deps } = await supabase
      .from('departamentos')
      .select('id, nome, sigla')
      .eq('ministry_id', mid)
      .eq('ativo', true)
      .order('ordem');
    setDepartamentos((deps as Departamento[]) || []);

    // Contas financeiras (Fase 1 — opcional, pode não existir em instalações antigas)
    try {
      const { data: contas } = await supabase
        .from('fin_contas')
        .select('id,nome,tipo,is_padrao,congregacao_id')
        .eq('ministry_id', mid)
        .eq('is_ativa', true)
        .order('is_padrao', { ascending: false })
        .order('nome');
      setFinContas((contas as FinConta[]) || []);
    } catch { setFinContas([]); }

    // Categorias financeiras (Fase 1 — sistema + ministério)
    try {
      const { data: cats } = await supabase
        .from('fin_categorias')
        .select('id,nome,tipo_movimento,cor,icone')
        .or(`ministry_id.is.null,ministry_id.eq.${mid}`)
        .eq('is_ativa', true)
        .order('codigo');
      setFinCategorias((cats as FinCategoria[]) || []);
    } catch { setFinCategorias([]); }

    // Lançamentos (financeiro_local: filtro por congregação no servidor)
    // Limitado a 200 registros mais recentes para evitar carregar todo o histórico
    let lancsQuery = supabase
      .from('tesouraria_lancamentos')
      .select('*')
      .eq('ministry_id', mid);
    if (scopeCongId) lancsQuery = lancsQuery.eq('congregacao_id', scopeCongId);
    const { data: lancs } = await lancsQuery.order('data_lancamento', { ascending: false }).limit(200);

    if (lancs) {
      // Enriquecer com nomes
      const congMap = new Map((congs as Congregacao[] || []).map(c => [c.id, c.nome]));
      const depMap  = new Map((deps as Departamento[] || []).map(d => [d.id, `${d.sigla} - ${d.nome}`]));
      setLancamentos((lancs as Lancamento[]).map(l => ({
        ...l,
        tipo_movimento:    (l as any).tipo_movimento ?? 'entrada',
        congregacao_nome:  l.congregacao_id  ? (congMap.get(l.congregacao_id)  ?? 'Sede') : 'Caixa Geral (Sede)',
        departamento_nome: l.departamento_id ? (depMap.get(l.departamento_id)  ?? '—')    : 'Caixa da Igreja',
      })));
    }

    // Fechamentos
    const { data: fechs } = await supabase
      .from('tesouraria_fechamentos')
      .select('*')
      .eq('ministry_id', mid)
      .order('mes_referencia', { ascending: false });
    setFechamentos((fechs as Fechamento[]) || []);

    setLoadingData(false);
  }, [authLoading, supabase]);

  useEffect(() => { load(); }, [load]);

  // ── Filtro de lançamentos ─────────────────────────────────────────────────

  const lancsFiltrados = useMemo(() => lancamentosMes.filter(l => {
    if (filtroMovimento && l.tipo_movimento !== filtroMovimento) return false;
    if (filtroTipo && l.tipo_recebimento !== filtroTipo) return false;
    if (filtroCong && l.congregacao_id !== filtroCong) return false;
    return true;
  }), [lancamentosMes, filtroMovimento, filtroTipo, filtroCong]);

  const entradasFiltradas = useMemo(() =>
    lancsFiltrados.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0),
    [lancsFiltrados]);

  const saidasFiltradas = useMemo(() =>
    lancsFiltrados.filter(l => l.tipo_movimento === 'saida').reduce((s, l) => s + Number(l.valor), 0),
    [lancsFiltrados]);

  const totalFiltrado = useMemo(() =>
    lancsFiltrados.reduce((s, l) => s + Number(l.valor), 0),
    [lancsFiltrados]);

  // ── Dashboard stats ───────────────────────────────────────────────────────

  const dashStats = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const doMes = lancamentos.filter(l => l.data_lancamento.startsWith(mes));

    const totalGeral   = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
    const totalMes     = doMes.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
    const totalSaidas  = doMes.filter(l => l.tipo_movimento === 'saida').reduce((s, l) => s + Number(l.valor), 0);
    const saldoMes     = totalMes - totalSaidas;

    const porTipo: Record<string, number> = {};
    doMes.filter(l => l.tipo_movimento === 'entrada').forEach(l => {
      porTipo[l.tipo_recebimento] = (porTipo[l.tipo_recebimento] ?? 0) + Number(l.valor);
    });

    const porCong: Record<string, number> = {};
    doMes.filter(l => l.tipo_movimento === 'entrada').forEach(l => {
      const k = l.congregacao_nome ?? 'Caixa Geral (Sede)';
      porCong[k] = (porCong[k] ?? 0) + Number(l.valor);
    });

    return { totalGeral, totalMes, totalSaidas, saldoMes, porTipo, porCong };
  }, [lancamentos]);

  // Comparativo mês atual vs mês anterior (usa dados do gráfico 12 meses)
  const dashComparativo = useMemo(() => {
    const hoje = new Date();
    const mesA = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const antD  = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesB  = `${antD.getFullYear()}-${String(antD.getMonth() + 1).padStart(2, '0')}`;
    const a  = dadosGrafico.find(m => m.mes === mesA) ?? { entradas: 0, saidas: 0, saldo: 0 };
    const b  = dadosGrafico.find(m => m.mes === mesB) ?? { entradas: 0, saidas: 0, saldo: 0 };
    const pct = (cur: number, ant: number) =>
      ant === 0 ? (cur > 0 ? 100 : 0) : ((cur - ant) / ant) * 100;
    return {
      mesBLabel: `${MESES_LABEL[antD.getMonth()].slice(0, 3)}/${antD.getFullYear()}`,
      entradas: { atual: a.entradas, anterior: b.entradas, variacao: pct(a.entradas, b.entradas) },
      saidas:   { atual: a.saidas,   anterior: b.saidas,   variacao: pct(a.saidas,   b.saidas)   },
      saldo:    { atual: a.saldo,    anterior: b.saldo,    variacao: pct(a.saldo,     b.saldo)    },
    };
  }, [dadosGrafico]);

  // ── Busca de dizimista ─────────────────────────────────────────────────────

  const buscarMembDizimista = useCallback(async (q: string) => {
    if (!ministryId || q.trim().length < 3) { setDizBuscaRes([]); return; }
    setDizBuscando(true);
    const { data } = await supabase
      .from('members')
      .select('id, name')
      .eq('ministry_id', ministryId)
      .eq('is_dizimista', true)
      .eq('status', 'active')
      .ilike('name', `${q.trim()}%`)
      .limit(8);
    const results = (data || []).map((m: any) => ({ id: m.id, nome: m.name }));
    setDizBuscaRes(results);
    // Se não encontrou ninguém, ativa automaticamente o modo avulso
    if (results.length === 0) {
      setDizIsAvulso(true);
      setDizAvulsoNome(q.trim());
      setDizBusca('');
    }
    setDizBuscando(false);
  }, [ministryId, supabase]);

  const resetDizForm = () => {
    setDizBusca('');
    setDizBuscaRes([]);
    setDizSelId(null);
    setDizSelNome('');
    setDizIsAvulso(false);
    setDizAvulsoNome('');
  };

  // ── Fase 2: Gráfico 12 meses ────────────────────────────────────────────────

  const carregarGrafico12Meses = useCallback(async () => {
    if (!ministryId) return;
    setLoadingGrafico(true);
    const hoje = new Date();
    const meses: MesDados[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MESES_LABEL[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(2)}`;
      meses.push({ mes, label, entradas: 0, saidas: 0, saldo: 0 });
    }
    const oldest = meses[0].mes;
    let q = supabase
      .from('tesouraria_lancamentos')
      .select('data_lancamento, tipo_movimento, valor')
      .eq('ministry_id', ministryId)
      .gte('data_lancamento', `${oldest}-01`);
    if (scope.isFinanceiroLocal && scope.congregacaoId) {
      q = q.eq('congregacao_id', scope.congregacaoId);
    }
    const { data } = await q;
    if (data) {
      (data as { data_lancamento: string; tipo_movimento: string; valor: number }[]).forEach(l => {
        const m = l.data_lancamento.slice(0, 7);
        const idx = meses.findIndex(x => x.mes === m);
        if (idx >= 0) {
          if (l.tipo_movimento === 'entrada') meses[idx].entradas += Number(l.valor);
          else meses[idx].saidas += Number(l.valor);
        }
      });
      meses.forEach(m => { m.saldo = m.entradas - m.saidas; });
    }
    setDadosGrafico(meses);
    setLoadingGrafico(false);
  }, [ministryId, supabase, scope]);

  // ── Fase 2: Lançamentos do mês (query direta ao banco) ───────────────────────

  const carregarLancamentosMes = useCallback(async (mes: string) => {
    if (!ministryId) return;
    setLoadingMes(true);
    const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));
    const depMap  = new Map(departamentos.map(d => [d.id, `${d.sigla} - ${d.nome}`]));
    let q = supabase
      .from('tesouraria_lancamentos')
      .select('*')
      .eq('ministry_id', ministryId)
      .gte('data_lancamento', `${mes}-01`)
      .lt('data_lancamento', `${mesProximo(mes)}-01`)
      .order('data_lancamento', { ascending: false });
    if (scope.isFinanceiroLocal && scope.congregacaoId) {
      q = q.eq('congregacao_id', scope.congregacaoId);
    }
    const { data } = await q;
    setLancamentosMes(((data ?? []) as Lancamento[]).map(l => ({
      ...l,
      tipo_movimento:    (l as unknown as { tipo_movimento?: string }).tipo_movimento as TipoMovimento ?? 'entrada',
      congregacao_nome:  l.congregacao_id  ? (congMap.get(l.congregacao_id)  ?? 'Sede') : 'Caixa Geral (Sede)',
      departamento_nome: l.departamento_id ? (depMap.get(l.departamento_id)  ?? '—')    : 'Caixa da Igreja',
    })));
    setLoadingMes(false);
  }, [ministryId, supabase, scope, congregacoes, departamentos]);

  // Gráfico 12 meses: carrega após o load inicial completar
  useEffect(() => {
    if (!ministryId || loadingData) return;
    carregarGrafico12Meses();
  }, [ministryId, loadingData, carregarGrafico12Meses]);

  // Lançamentos do mês: rebusca no banco quando filtroMes muda ou após carga inicial
  useEffect(() => {
    if (!ministryId || loadingData) return;
    carregarLancamentosMes(filtroMes);
  }, [filtroMes, ministryId, loadingData, carregarLancamentosMes]);

  // ── Fase 2: Relatório — query direta ao banco por período ─────────────────────

  const carregarRelatorio = useCallback(async (mes: string, cong: string) => {
    if (!ministryId) return;
    setRelLoadingDB(true);
    const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));
    const depMap  = new Map(departamentos.map(d => [d.id, `${d.sigla} - ${d.nome}`]));
    let q = supabase
      .from('tesouraria_lancamentos')
      .select('*')
      .eq('ministry_id', ministryId)
      .gte('data_lancamento', `${mes}-01`)
      .lt('data_lancamento', `${mesProximo(mes)}-01`)
      .order('data_lancamento', { ascending: false });
    if (scope.isFinanceiroLocal && scope.congregacaoId) {
      q = q.eq('congregacao_id', scope.congregacaoId);
    } else if (cong) {
      q = q.eq('congregacao_id', cong);
    }
    const { data } = await q;
    setRelDadosDB(((data ?? []) as Lancamento[]).map(l => ({
      ...l,
      tipo_movimento:    (l as unknown as { tipo_movimento?: string }).tipo_movimento as TipoMovimento ?? 'entrada',
      congregacao_nome:  l.congregacao_id  ? (congMap.get(l.congregacao_id)  ?? 'Sede') : 'Caixa Geral (Sede)',
      departamento_nome: l.departamento_id ? (depMap.get(l.departamento_id)  ?? '—')    : 'Caixa da Igreja',
    })));
    setRelLoadingDB(false);
  }, [ministryId, supabase, scope, congregacoes, departamentos]);

  useEffect(() => {
    if (!ministryId || loadingData || aba !== 'relatorio') return;
    carregarRelatorio(relMes, relCong);
  }, [relMes, relCong, aba, ministryId, loadingData, carregarRelatorio]);

  // ── Contas: carregar lista completa ──────────────────────────────────────────

  const carregarContasFull = useCallback(async () => {
    if (!ministryId) return;
    setLoadingContas(true);
    const { data } = await supabase
      .from('fin_contas')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('is_padrao', { ascending: false })
      .order('nome');
    setContasFull((data as FinContaFull[]) || []);
    setLoadingContas(false);
  }, [ministryId, supabase]);

  useEffect(() => {
    if (aba === 'contas' && ministryId && !loadingData) carregarContasFull();
  }, [aba, ministryId, loadingData, carregarContasFull]);

  // ── Categorias: carregar lista completa ──────────────────────────────────────

  const carregarCategoriasFull = useCallback(async () => {
    if (!ministryId) return;
    setLoadingCats(true);
    const { data } = await supabase
      .from('fin_categorias')
      .select('*')
      .or(`ministry_id.is.null,ministry_id.eq.${ministryId}`)
      .order('codigo', { ascending: true })
      .order('nome', { ascending: true });
    setCategoriasFull((data as FinCategoriaFull[]) || []);
    setLoadingCats(false);
  }, [ministryId, supabase]);

  useEffect(() => {
    if (aba === 'categorias' && ministryId && !loadingData) carregarCategoriasFull();
  }, [aba, ministryId, loadingData, carregarCategoriasFull]);

  // ── Arrecadação Digital: carregar destinos ────────────────────────────────

  const carregarDestinos = useCallback(async () => {
    setLoadingDestinos(true);
    try {
      const res  = await fetch('/api/v1/ministry/payment-destinations');
      const json = await res.json() as { data?: PaymentDestino[] };
      setDestinos(json.data ?? []);
    } catch {
      setDestinos([]);
    } finally {
      setLoadingDestinos(false);
    }
  }, []);

  useEffect(() => {
    if (aba === 'arrecadacao' && ministryId && !loadingData) {
      void carregarDestinos();
      void carregarGatewayStatus();
      if (contasFull.length === 0) carregarContasFull();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, ministryId, loadingData, carregarDestinos, carregarContasFull]);

  useEffect(() => {
    if (aba === 'arrecadacao' && ministryId && !loadingData) {
      if (subAbaArr === 'cobrancas') void carregarCobrancas();
      else if (subAbaArr === 'webhooks') void carregarWebhookEvents();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subAbaArr, aba, ministryId, loadingData]);

  const handleSaveDestino = async () => {
    if (!formDestino.label.trim()) {
      showModal('Campo obrigatório', 'Informe o label do destino.', 'error');
      return;
    }
    setSavingDestino(true);
    try {
      const body: Record<string, unknown> = {
        label:            formDestino.label.trim(),
        tipo_recebimento: formDestino.tipo_recebimento,
        congregacao_id:   formDestino.congregacao_id || undefined,
        conta_id:         formDestino.conta_id || undefined,
        categoria_id:     formDestino.categoria_id || undefined,
        descricao:        formDestino.descricao.trim() || undefined,
        expires_at:       formDestino.expires_at ? new Date(formDestino.expires_at).toISOString() : null,
        valor_fixo:       formDestino.valor_fixo
          ? parseFloat(formDestino.valor_fixo.replace(',', '.'))
          : null,
      };
      let res: Response;
      if (destinoEditId) {
        res = await fetch(`/api/v1/ministry/payment-destinations/${destinoEditId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/v1/ministry/payment-destinations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      }
      const json = await res.json() as { error?: string };
      if (!res.ok) { showModal('Erro', json.error ?? 'Erro ao salvar.', 'error'); return; }
      showModal('Sucesso', destinoEditId ? 'Destino atualizado!' : 'Destino criado!', 'success');
      setShowDestinoModal(false);
      setDestinoEditId(null);
      setFormDestino(emptyFormDestino());
      void carregarDestinos();
    } finally {
      setSavingDestino(false);
    }
  };

  const handleToggleDestino = async (dest: PaymentDestino) => {
    const res = await fetch(`/api/v1/ministry/payment-destinations/${dest.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_ativo: !dest.is_ativo }),
    });
    if (res.ok) void carregarDestinos();
  };

  const handleDeleteDestino = async (id: string) => {
    const res = await fetch(`/api/v1/ministry/payment-destinations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setConfirmDelDestino(null);
      void carregarDestinos();
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      showModal('Erro', data.error ?? 'Não foi possível excluir o destino.', 'error');
      setConfirmDelDestino(null);
    }
  };

  // ── Arrecadção: funcionários de suporte (gateway, cobranças, webhooks) ──────
  const carregarGatewayStatus = useCallback(async () => {
    if (!ministryId) return;
    try {
      const { data } = await supabase
        .from('ministry_payment_gateways')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('gateway', 'asaas')
        .eq('is_active', true)
        .maybeSingle();
      setGatewayAtivo(!!data);
    } catch {
      setGatewayAtivo(false);
    }
  }, [ministryId, supabase]);

  const carregarCobrancas = useCallback(async () => {
    if (!ministryId) return;
    setLoadingCobrancas(true);
    try {
      // Busca destinos para mapear label/congregção
      const { data: destData } = await supabase
        .from('fin_payment_destinations')
        .select('id, label, congregacoes(nome)')
        .eq('ministry_id', ministryId);
      type DestRow = { id: string; label: string; congregacoes: { nome: string } | null };
      const destMap = new Map(
        ((destData ?? []) as DestRow[]).map(d => [d.id, { label: d.label, cong: d.congregacoes?.nome ?? '' }])
      );
      const destIds = [...destMap.keys()];
      if (destIds.length === 0) { setCobrancas([]); return; }
      const { data } = await supabase
        .from('fin_payment_charges')
        .select('id, destination_id, gateway_charge_id, status, payer_name, payer_document, payer_email, valor_solicitado, valor_pago, invoice_url, tesouraria_lancamento_id, expires_at, paid_at, created_at')
        .in('destination_id', destIds)
        .order('created_at', { ascending: false })
        .limit(500);
      setCobrancas(((data ?? []) as FinCobranca[]).map(c => ({
        ...c,
        dest_label:      destMap.get(c.destination_id)?.label ?? '—',
        congregacao_nome: destMap.get(c.destination_id)?.cong  ?? '',
      })));
    } catch {
      setCobrancas([]);
    } finally {
      setLoadingCobrancas(false);
    }
  }, [ministryId, supabase]);

  const carregarWebhookEvents = useCallback(async () => {
    if (!ministryId) return;
    setLoadingWebhooks(true);
    try {
      const { data: gws } = await supabase
        .from('ministry_payment_gateways')
        .select('id')
        .eq('ministry_id', ministryId);
      const gwIds = ((gws ?? []) as { id: string }[]).map(g => g.id);
      if (gwIds.length === 0) { setWebhookEvents([]); return; }
      const { data } = await supabase
        .from('fin_webhook_events')
        .select('id, event_type, gateway_event_id, processed, processing_error, payload, received_at')
        .in('gateway_id', gwIds)
        .order('received_at', { ascending: false })
        .limit(200);
      setWebhookEvents((data ?? []) as FinWebhookEvent[]);
    } catch {
      setWebhookEvents([]);
    } finally {
      setLoadingWebhooks(false);
    }
  }, [ministryId, supabase]);

  function exportarCSVCobrancas(rows: FinCobranca[]) {
    const header = ['ID', 'Destino', 'Congregação', 'Pagador', 'CPF/CNPJ', 'E-mail', 'Valor Solicitado (R$)', 'Valor Pago (R$)', 'Status', 'Data Pagamento', 'Gateway Charge ID', 'Lançamento ID'];
    const rows2d = rows.map(c => [
      c.id,
      c.dest_label ?? '',
      c.congregacao_nome ?? '',
      c.payer_name ?? '',
      c.payer_document ?? '',
      c.payer_email ?? '',
      Number(c.valor_solicitado).toFixed(2).replace('.', ','),
      c.valor_pago != null ? Number(c.valor_pago).toFixed(2).replace('.', ',') : '',
      c.status,
      c.paid_at ? fmtDate(c.paid_at.split('T')[0]) : '',
      c.gateway_charge_id ?? '',
      c.tesouraria_lancamento_id ?? '',
    ]);
    const csv = [header, ...rows2d]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobrancas-pix-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleSaveConta = async () => {
    if (!ministryId) return;
    if (!formConta.nome.trim()) { showModal('Campo obrigatório', 'Informe o nome da conta.', 'error'); return; }
    setSavingConta(true);
    const saldoNum = parseFloat(formConta.saldo_inicial.replace(',', '.')) || 0;
    const now = new Date().toISOString();
    const payload = {
      ministry_id:    ministryId,
      congregacao_id: formConta.congregacao_id || null,
      nome:           formConta.nome.trim(),
      tipo:           formConta.tipo,
      banco:          formConta.banco.trim()     || null,
      agencia:        formConta.agencia.trim()   || null,
      conta:          formConta.conta.trim()     || null,
      chave_pix:      formConta.chave_pix.trim() || null,
      saldo_inicial:  saldoNum,
      is_ativa:       formConta.is_ativa,
      is_padrao:      formConta.is_padrao,
      updated_at:     now,
    };
    const res = contaEditId
      ? await supabase.from('fin_contas').update(payload).eq('id', contaEditId)
      : await supabase.from('fin_contas').insert({ ...payload, created_at: now });
    setSavingConta(false);
    if (res.error) { showModal('Erro', res.error.message, 'error'); return; }
    showModal(contaEditId ? 'Atualizado!' : 'Criada!', `Conta "${formConta.nome}" salva.`);
    setShowContaModal(false);
    setContaEditId(null);
    setFormConta(emptyFormConta());
    carregarContasFull();
    load();
  };

  const handleDeleteConta = async (id: string) => {
    const { error } = await supabase.from('fin_contas').delete().eq('id', id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    setConfirmDelConta(null);
    showModal('Excluída!', 'Conta removida.');
    carregarContasFull();
    load();
  };

  const handleToggleContaAtiva = async (c: FinContaFull) => {
    const { error } = await supabase.from('fin_contas')
      .update({ is_ativa: !c.is_ativa, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    carregarContasFull();
    load();
  };

  const handleSetContaPadrao = async (c: FinContaFull) => {
    if (c.is_padrao) return;
    const now = new Date().toISOString();
    const atual = contasFull.find(x => x.is_padrao);
    if (atual) {
      await supabase.from('fin_contas').update({ is_padrao: false, updated_at: now }).eq('id', atual.id);
    }
    const { error } = await supabase.from('fin_contas').update({ is_padrao: true, updated_at: now }).eq('id', c.id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    showModal('Conta padrão definida!', `"${c.nome}" agora é a conta padrão.`);
    carregarContasFull();
    load();
  };

  // ── Categorias: CRUD handlers ─────────────────────────────────────────────

  const handleSaveCat = async () => {
    if (!ministryId) return;
    if (!formCat.nome.trim()) { showModal('Campo obrigatório', 'Informe o nome da categoria.', 'error'); return; }
    setSavingCat(true);
    const now = new Date().toISOString();
    const payload = {
      ministry_id:      ministryId,
      nome:             formCat.nome.trim(),
      tipo_movimento:   formCat.tipo_movimento,
      codigo:           formCat.codigo.trim()          || null,
      cor:              formCat.cor                    || null,
      icone:            formCat.icone.trim()           || null,
      categoria_pai_id: formCat.categoria_pai_id       || null,
      is_ativa:         formCat.is_ativa,
      is_sistema:       false,
      updated_at:       now,
    };
    const res = catEditId
      ? await supabase.from('fin_categorias').update(payload).eq('id', catEditId)
      : await supabase.from('fin_categorias').insert({ ...payload, created_at: now });
    setSavingCat(false);
    if (res.error) { showModal('Erro', res.error.message, 'error'); return; }
    showModal(catEditId ? 'Atualizada!' : 'Criada!', `Categoria "${formCat.nome}" salva.`);
    setShowCatModal(false);
    setCatEditId(null);
    setFormCat(emptyFormCat());
    carregarCategoriasFull();
    load();
  };

  const handleDeleteCat = async (id: string) => {
    const { error } = await supabase.from('fin_categorias').delete().eq('id', id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    setConfirmDelCat(null);
    showModal('Excluída!', 'Categoria removida.');
    carregarCategoriasFull();
    load();
  };

  const handleToggleCatAtiva = async (c: FinCategoriaFull) => {
    const { error } = await supabase.from('fin_categorias')
      .update({ is_ativa: !c.is_ativa, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    carregarCategoriasFull();
    load();
  };

  // ── Salvar ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!ministryId) return;
    const isSaida = form.tipo_movimento === 'saida';
    if (!isSaida && !form.tipo_recebimento) {
      showModal('Campos obrigatórios', 'Preencha o tipo de recebimento.', 'error'); return;
    }
    if (!form.valor || !form.data_lancamento) {
      showModal('Campos obrigatórios', 'Preencha valor e data.', 'error'); return;
    }
    if (!scope.isFinanceiroLocal && !form.congregacao_id) {
      showModal('Congregação obrigatória', 'Selecione a congregação do lançamento.', 'error'); return;
    }
    const valorNum = parseFloat(form.valor.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      showModal('Valor inválido', 'Informe um valor maior que zero.', 'error'); return;
    }

    // Verificar se o mês do lançamento já está fechado
    const mesLanc = form.data_lancamento.slice(0, 7);
    const mestaFechado = fechamentos.some(f => f.mes_referencia === mesLanc && f.status === 'fechado');
    if (mestaFechado) {
      const [anoL, monL] = mesLanc.split('-');
      showModal(
        'Mês fechado',
        `O caixa de ${MESES_LABEL[Number(monL) - 1]}/${anoL} já foi encerrado e não aceita novos lançamentos ou edições. Para corrigir dados deste mês, reabasteça o histórico com o administrador.`,
        'error'
      );
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const payload: any = {
      ministry_id:      ministryId,
      congregacao_id:   form.congregacao_id  || null,
      departamento_id:  form.departamento_id || null,
      member_id:        dizSelId || null,
      tipo_movimento:   form.tipo_movimento,
      tipo_recebimento: isSaida ? (form.categoria_saida || 'outros_despesa') : form.tipo_recebimento,
      descricao:        form.descricao.trim()  || null,
      referencia:       form.referencia.trim() || null,
      valor:            valorNum,
      forma_pagamento:  form.forma_pagamento,
      data_lancamento:  form.data_lancamento,
      observacoes:      form.observacoes.trim() || null,
      conta_id:         form.conta_id    || null,
      categoria_id:     form.categoria_id || null,
      updated_at:       now,
    };

    // Sempre incluir dizimista_nome e member_id no payload (insert e update)
    if (!isSaida && form.tipo_recebimento === 'dizimo') {
      if (dizSelId) {
        payload.member_id      = dizSelId;
        payload.dizimista_nome = dizSelNome;
      } else if (dizIsAvulso) {
        payload.member_id      = null;
        payload.dizimista_nome = dizAvulsoNome.trim() || null;
      } else {
        payload.member_id      = null;
        payload.dizimista_nome = null;
      }
    }

    if (editId) {
      const { error } = await supabase.from('tesouraria_lancamentos').update(payload).eq('id', editId);
      if (error) { showModal('Erro', error.message, 'error'); setSaving(false); return; }
      // Atualizar dizimistas_pagamentos se houver membro vinculado
      if (form.tipo_recebimento === 'dizimo' && dizSelId) {
        const mesRef = form.data_lancamento.slice(0, 7);
        await supabase.from('dizimistas_pagamentos').upsert({
          ministry_id:    ministryId,
          member_id:      dizSelId,
          mes_referencia: mesRef,
          status:         'pago',
        }, { onConflict: 'ministry_id,member_id,mes_referencia' });
      }
      showModal('Atualizado!', 'Lançamento atualizado com sucesso.');
    } else {
      const { error } = await supabase.from('tesouraria_lancamentos').insert({ ...payload, created_at: now, origem_modulo: 'manual' });
      if (error) { showModal('Erro', error.message, 'error'); setSaving(false); return; }
      // Se for dízimo com membro selecionado, registrar pagamento
      if (form.tipo_recebimento === 'dizimo' && dizSelId) {
        const mesRef = form.data_lancamento.slice(0, 7);
        const { error: errPag } = await supabase.from('dizimistas_pagamentos').upsert({
          ministry_id:    ministryId,
          member_id:      dizSelId,
          mes_referencia: mesRef,
          status:         'pago',
        }, { onConflict: 'ministry_id,member_id,mes_referencia' });
        if (errPag) { showModal('Aviso', `Dízimo salvo, mas houve erro ao registrar adimplência: ${errPag.message}`, 'error'); }
      }
      showModal('Registrado!', 'Lançamento registrado com sucesso.');
    }
    setSaving(false);
    setForm(emptyForm());
    setEditId(null);
    setShowForm(false);
    resetDizForm();
    load();
    carregarLancamentosMes(filtroMes);
  };

  // ── Editar ────────────────────────────────────────────────────────────────

  const handleEdit = (l: Lancamento) => {
    const isSaida = l.tipo_movimento === 'saida';
    // Limpar estado de busca antes de restaurar
    resetDizForm();
    setForm({
      congregacao_id:   l.congregacao_id  ?? '',
      departamento_id:  l.departamento_id ?? '',
      tipo_movimento:   l.tipo_movimento,
      tipo_recebimento: isSaida ? '' : l.tipo_recebimento,
      categoria_saida:  isSaida ? l.tipo_recebimento : '',
      descricao:        l.descricao  ?? '',
      referencia:       l.referencia ?? '',
      valor:            fmtBRL(Number(l.valor)),
      forma_pagamento:  l.forma_pagamento,
      data_lancamento:  l.data_lancamento,
      observacoes:      l.observacoes ?? '',
      conta_id:         (l as any).conta_id    ?? '',
      categoria_id:     (l as any).categoria_id ?? '',
    });
    // Restaurar vínculo de dizimista
    if (l.member_id && l.dizimista_nome) {
      setDizSelId(l.member_id);
      setDizSelNome(l.dizimista_nome);
    } else if (!l.member_id && l.dizimista_nome && l.tipo_recebimento === 'dizimo') {
      setDizIsAvulso(true);
      setDizAvulsoNome(l.dizimista_nome);
    }
    setEditId(l.id);
    setShowForm(true);
    setAba('lancamentos');
  };

  // ── Excluir ───────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tesouraria_lancamentos').delete().eq('id', id);
    if (error) { showModal('Erro', error.message, 'error'); return; }
    setConfirmDel(null);
    showModal('Excluído!', 'Lançamento removido.');
    load();
    carregarLancamentosMes(filtroMes);
  };

  // ── Fechar Mês (por congregação) ────────────────────────────────

  const handleFecharMes = async () => {
    if (!ministryId) return;

    // Impedir fechamento de mês futuro
    const mesAtualStr = new Date().toISOString().slice(0, 7);
    if (abaFechaMes > mesAtualStr) {
      showModal('Erro', 'Não é possível fechar um mês futuro.', 'error');
      return;
    }

    const saldoIni = parseFloat(fechaSaldoInicial.replace(',', '.')) || 0;

    // Buscar totais do banco filtrado pela congregação específica
    let totaisQ = supabase
      .from('tesouraria_lancamentos')
      .select('tipo_movimento, valor')
      .eq('ministry_id', ministryId)
      .gte('data_lancamento', `${abaFechaMes}-01`)
      .lt('data_lancamento', `${mesProximo(abaFechaMes)}-01`);
    if (fechaCongId === null) totaisQ = totaisQ.is('congregacao_id', null);
    else totaisQ = totaisQ.eq('congregacao_id', fechaCongId);
    const { data: totaisDb } = await totaisQ;
    const itensDb = (totaisDb ?? []) as Array<{ tipo_movimento: string; valor: number }>;
    const entradas = itensDb
      .filter(l => l.tipo_movimento === 'entrada')
      .reduce((s, l) => s + Number(l.valor), 0);
    const saidas = itensDb
      .filter(l => l.tipo_movimento === 'saida')
      .reduce((s, l) => s + Number(l.valor), 0);
    const saldoFinal = saldoIni + entradas - saidas;

    setSalvandoFecha(true);
    const { data: sd } = await supabase.auth.getSession();
    const uid = sd.session?.user.id;

    // Verificar se já existe fechamento (SELECT → INSERT ou UPDATE)
    let existQ = supabase
      .from('tesouraria_fechamentos')
      .select('id')
      .eq('ministry_id', ministryId)
      .eq('mes_referencia', abaFechaMes);
    if (fechaCongId === null) existQ = existQ.is('congregacao_id', null);
    else existQ = existQ.eq('congregacao_id', fechaCongId);
    const { data: existing } = await existQ.maybeSingle();

    const payload = {
      ministry_id:    ministryId,
      congregacao_id: fechaCongId,
      mes_referencia: abaFechaMes,
      saldo_inicial:  saldoIni,
      total_entradas: entradas,
      total_saidas:   saidas,
      saldo_final:    saldoFinal,
      status:         'fechado',
      observacoes:    fechaObs || null,
      fechado_por:    uid ?? null,
      fechado_em:     new Date().toISOString(),
    };

    let errorMsg: string | null = null;
    let fechamentoId: string | null = null;
    if (existing?.id) {
      const { error: upErr } = await supabase.from('tesouraria_fechamentos').update(payload).eq('id', existing.id);
      if (upErr) errorMsg = upErr.message;
      fechamentoId = existing.id;
    } else {
      const { data: insData, error: insErr } = await supabase.from('tesouraria_fechamentos').insert(payload).select('id').single();
      if (insErr) errorMsg = insErr.message;
      fechamentoId = insData?.id ?? null;
    }

    setSalvandoFecha(false);
    if (errorMsg) { showModal('Erro', errorMsg, 'error'); return; }

    // Registrar log (ignora silenciosamente se a tabela ainda não existir)
    if (fechamentoId) {
      try {
        await supabase.from('tesouraria_fechamento_logs').insert({
          fechamento_id:  fechamentoId,
          congregacao_id: fechaCongId,
          usuario_id:     uid ?? null,
          acao:           'fechamento',
        });
      } catch { /* tabela pode não existir em ambientes sem a migration */ }
    }

    const congNome = fechaCongId === null
      ? 'Sede / Caixa Geral'
      : (congregacoes.find(c => c.id === fechaCongId)?.nome ?? 'Congregação');
    const [ano, mon] = abaFechaMes.split('-');
    showModal('Caixa fechado!', `${congNome} — ${MESES_LABEL[Number(mon) - 1]}/${ano} fechado. Saldo: ${fmtBRL(saldoFinal)}.`);
    setShowFechaModal(false);
    setFechaObs('');
    setFechaSaldoInicial('');
    setFechaCongId(null);
    load();
  };

  // ── Relatório ─────────────────────────────────────────────────────────────

  // ── Relatório — memos derivados dos dados do banco (sem limite de 200) ───────
  const relEntradas = useMemo(() => relDadosDB.filter(l => l.tipo_movimento !== 'saida'), [relDadosDB]);
  const relSaidas   = useMemo(() => relDadosDB.filter(l => l.tipo_movimento === 'saida'),  [relDadosDB]);
  const relTotalEntradas = useMemo(() => relEntradas.reduce((s, l) => s + Number(l.valor), 0), [relEntradas]);
  const relTotalSaidas   = useMemo(() => relSaidas.reduce((s, l) => s + Number(l.valor), 0),   [relSaidas]);

  const relDados = useMemo(() =>
    relTipoRel === 'entradas' ? relEntradas :
    relTipoRel === 'saidas'   ? relSaidas   : relDadosDB
  , [relTipoRel, relEntradas, relSaidas, relDadosDB]);

  const relTotal = useMemo(() => relDados.reduce((s, l) => s + Number(l.valor), 0), [relDados]);

  const relPorTipo = useMemo(() => {
    const acc: Record<string, number> = {};
    relEntradas.forEach(l => {
      acc[l.tipo_recebimento] = (acc[l.tipo_recebimento] ?? 0) + Number(l.valor);
    });
    return acc;
  }, [relEntradas]);

  const relPorTipoSaida = useMemo(() => {
    const acc: Record<string, number> = {};
    relSaidas.forEach(l => {
      acc[l.tipo_recebimento] = (acc[l.tipo_recebimento] ?? 0) + Number(l.valor);
    });
    return acc;
  }, [relSaidas]);

  const handlePrint = () => window.print();

  // ── Dizimistas ────────────────────────────────────────────────────────────

  const carregarDizimistas = useCallback(async () => {
    if (!ministryId) return;
    setLoadingDizimistas(true);
    const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));
    const { data: mems } = await supabase
      .from('members')
      .select('id, name, congregacao_id, created_at')
      .eq('ministry_id', ministryId)
      .eq('is_dizimista', true)
      .eq('status', 'active')
      .order('name');
    setDizimistas((mems || []).map((m: any) => ({
      id: m.id,
      nome: m.name,
      congregacao_id: m.congregacao_id,
      congregacao_nome: m.congregacao_id ? (congMap.get(m.congregacao_id) ?? '—') : 'Sede',
      membro_desde: (m.created_at as string).slice(0, 7),
    })));

    const { data: pags } = await supabase
      .from('dizimistas_pagamentos')
      .select('member_id, status')
      .eq('ministry_id', ministryId)
      .eq('mes_referencia', abaDizimistaMes);
    setDizimistaPagamentos((pags || []) as {member_id: string; status: string}[]);

    setLoadingDizimistas(false);
  }, [ministryId, supabase, congregacoes, abaDizimistaMes]);

  useEffect(() => {
    if (aba === 'dizimistas' && ministryId) carregarDizimistas();
  }, [aba, abaDizimistaMes, ministryId, carregarDizimistas]);

  const dizimistasComStatus = useMemo(() => {
    const pagMap = new Map(dizimistaPagamentos.map(p => [p.member_id, p.status]));
    // Fallback: lancamentos com member_id no mês também marcam como 'pago'
    lancamentos
      .filter(l => l.member_id && l.tipo_recebimento === 'dizimo' && l.data_lancamento.startsWith(abaDizimistaMes))
      .forEach(l => { if (!pagMap.has(l.member_id!)) pagMap.set(l.member_id!, 'pago'); });
    return dizimistas.map(d => ({ ...d, status: (pagMap.get(d.id) ?? 'pendente') as 'pago' | 'pendente' }));
  }, [dizimistas, dizimistaPagamentos, lancamentos, abaDizimistaMes]);

  const dizimistasVisiveis = useMemo(() => dizimistasComStatus.filter(d => {
    if (filtroNomeDiz && !d.nome.toLowerCase().includes(filtroNomeDiz.toLowerCase())) return false;
    if (filtroConsDiz && d.congregacao_id !== filtroConsDiz) return false;
    if (filtroStatusDiz === '' || filtroStatusDiz === 'pago') {
      // Todos ou Adimplente: exibe apenas quem pagou no mês
      return d.status === 'pago';
    }
    if (filtroStatusDiz === 'pendente') {
      // Inadimplente: só membros que já eram dizimistas no mês selecionado
      return d.status === 'pendente' && d.membro_desde <= abaDizimistaMes;
    }
    return false; // 'avulso' não usa essa lista
  }), [dizimistasComStatus, filtroNomeDiz, filtroStatusDiz, filtroConsDiz, abaDizimistaMes]);

  const dizimosAvulsos = useMemo(() => lancamentos.filter(l =>
    l.tipo_recebimento === 'dizimo' &&
    l.data_lancamento.startsWith(abaDizimistaMes) &&
    !l.member_id
  ), [lancamentos, abaDizimistaMes]);

  // Lista unificada para o filtro "Todos" (adimplentes + avulsos do mês)
  const listaUnificadaTodos = useMemo(() => {
    if (filtroStatusDiz !== '') return [];
    // Mapa member_id → soma dos dízimos do mês
    const valorPorMembro = new Map<string, number>();
    lancamentos
      .filter(l => l.member_id && l.tipo_recebimento === 'dizimo' && l.data_lancamento.startsWith(abaDizimistaMes))
      .forEach(l => {
        valorPorMembro.set(l.member_id!, (valorPorMembro.get(l.member_id!) ?? 0) + Number(l.valor));
      });
    const adimplentes = dizimistasVisiveis.map(d => ({
      key: `m-${d.id}`,
      nome: d.nome,
      congregacao_nome: d.congregacao_nome,
      situacao: 'Adimplente' as const,
      valor: valorPorMembro.get(d.id) ?? null,
    }));
    const avulsosFiltrados = dizimosAvulsos
      .filter(l => !filtroNomeDiz ||
        (l.dizimista_nome || '').toLowerCase().includes(filtroNomeDiz.toLowerCase()))
      .map(l => ({
        key: `a-${l.id}`,
        nome: l.dizimista_nome || 'Não informado',
        congregacao_nome: l.congregacao_nome || '—',
        situacao: 'Avulso' as const,
        valor: Number(l.valor),
      }));
    return [...adimplentes, ...avulsosFiltrados]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [filtroStatusDiz, dizimistasVisiveis, dizimosAvulsos, filtroNomeDiz, lancamentos, abaDizimistaMes]);

  const totalPagos = useMemo(() => dizimistasComStatus.filter(d => d.status === 'pago').length, [dizimistasComStatus]);

  // ─────────────────────────────────────────────────────────────────────────

  if (bloqueado || authLoading || loadingData) return <div className="p-8 text-gray-500">Carregando...</div>;

  const congNome = (id: string | null) => {
    if (!id) return 'Caixa Geral (Sede)';
    return congregacoes.find(c => c.id === id)?.nome ?? '—';
  };

  return (
    <PageLayout title="Tesouraria" description="Gestão de arrecadação e caixas das congregações" activeMenu="tesouraria">

      {/* ── Estilos de impressão ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #relatorio-print, #relatorio-print *, #dizimistas-print, #dizimistas-print * { visibility: visible !important; }
          #relatorio-print, #dizimistas-print {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 24px 32px !important;
            background: white !important;
            font-size: 11pt !important;
          }
          .no-print { display: none !important; }
        }
      `}} />

      {/* ── Abas ── */}
      <div className="mb-6 border-b-2 border-slate-200 flex gap-1 flex-wrap">
        {([
          { id: 'dashboard',   icon: <TrendingUp className="h-4 w-4" />,    label: 'Dashboard'     },
          { id: 'lancamentos', icon: <Tag className="h-4 w-4" />,           label: 'Lançamentos'   },
          { id: 'caixa',       icon: <CalendarDays className="h-4 w-4" />,  label: 'Caixa Mensal'  },
          { id: 'relatorio',   icon: <Printer className="h-4 w-4" />,       label: 'Relatório'     },
          { id: 'dizimistas',  icon: <Users className="h-4 w-4" />,         label: 'Dizimistas'    },
          { id: 'contas',      icon: <CreditCard className="h-4 w-4" />,    label: 'Contas'        },
          { id: 'categorias',  icon: <List className="h-4 w-4" />,          label: 'Categorias'    },
          { id: 'arrecadacao', icon: <QrCode className="h-4 w-4" />,        label: 'Arrecadação Digital' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition ${
              aba === t.id ? 'border-[#123b63] text-[#123b63]' : 'border-transparent text-gray-500 hover:text-[#123b63]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: DASHBOARD
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'dashboard' && (
        <div className="space-y-6">
          {/* Cards resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-green-500 p-5 shadow-md">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Entradas (mês atual)</p>
              <p className="text-2xl font-bold text-green-600">{fmtBRL(dashStats.totalMes)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-red-500 p-5 shadow-md">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Saídas (mês atual)</p>
              <p className="text-2xl font-bold text-red-500">{fmtBRL(dashStats.totalSaidas)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-[#123b63] p-5 shadow-md">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Saldo do mês</p>
              <p className={`text-2xl font-bold ${dashStats.saldoMes >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>
                {fmtBRL(dashStats.saldoMes)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-amber-500 p-5 shadow-md">
              {scope.isFinanceiroLocal ? (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sua Congregação</p>
                  <p className="text-lg font-bold text-[#123b63] leading-tight">
                    {congregacoes.find(c => c.id === scope.congregacaoId)?.nome ?? '—'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Congregações ativas</p>
                  <p className="text-2xl font-bold text-[#123b63]">{congregacoes.length}</p>
                </>
              )}
            </div>
          </div>

          {/* ── Comparativo mês atual vs anterior ─────────────────────────────── */}
          {dadosGrafico.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { key: 'entradas', label: 'Entradas', data: dashComparativo.entradas, cor: 'text-green-600', bg: 'border-t-green-500' },
                { key: 'saidas',   label: 'Saídas',   data: dashComparativo.saidas,   cor: 'text-red-500',   bg: 'border-t-red-500'   },
                { key: 'saldo',    label: 'Saldo',    data: dashComparativo.saldo,    cor: dashComparativo.saldo.atual >= 0 ? 'text-[#123b63]' : 'text-red-600', bg: 'border-t-[#123b63]' },
              ] as const).map(item => (
                <div key={item.key} className={`bg-white rounded-2xl border border-slate-200 border-t-4 ${item.bg} p-4 shadow-md`}>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{item.label} — comparativo</p>
                  <p className={`text-xl font-bold ${item.cor}`}>{fmtBRL(item.data.atual)}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className={`text-xs font-semibold ${item.data.variacao >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {item.data.variacao >= 0 ? '▲' : '▼'} {Math.abs(item.data.variacao).toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">vs {fmtBRL(item.data.anterior)} ({dashComparativo.mesBLabel})</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Gráfico Entradas x Saídas — últimos 12 meses ──────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Entradas × Saídas — últimos 12 meses</h3>
            {loadingGrafico ? (
              <p className="text-sm text-gray-400 py-6 text-center">Carregando...</p>
            ) : dadosGrafico.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Nenhum dado disponível.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => {
                      const n = Number(v);
                      return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
                    }}
                    tick={{ fontSize: 10 }}
                    width={48}
                  />
                  <ChartTooltip
                    formatter={(v: unknown) => fmtBRL(Number(v))}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="saidas"   name="Saídas"   fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Tendência de saldo mensal ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Tendência de saldo — últimos 12 meses</h3>
            {loadingGrafico ? (
              <p className="text-sm text-gray-400 py-6 text-center">Carregando...</p>
            ) : dadosGrafico.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Nenhum dado disponível.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dadosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => {
                      const n = Number(v);
                      return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
                    }}
                    tick={{ fontSize: 10 }}
                    width={48}
                  />
                  <ChartTooltip
                    formatter={(v: unknown) => fmtBRL(Number(v))}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo"
                    stroke="#123b63"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#123b63' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Por tipo de recebimento */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Arrecadação do mês por tipo</h3>
            {Object.keys(dashStats.porTipo).length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum lançamento no mês atual.</p>
            ) : (
              <div className="space-y-3">
                {TIPOS.map(t => {
                  const val = dashStats.porTipo[t.value] ?? 0;
                  if (val === 0) return null;
                  const pct = dashStats.totalMes > 0 ? (val / dashStats.totalMes) * 100 : 0;
                  return (
                    <div key={t.value}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.cor}`}>{t.label}</span>
                        <span className="font-semibold text-gray-800">{fmtBRL(val)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-2 bg-[#123b63] rounded-full" style={{ width: `${pct.toFixed(1)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Por congregação */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Arrecadação do mês por congregação / caixa</h3>
            {Object.keys(dashStats.porCong).length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum lançamento no mês atual.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(dashStats.porCong)
                  .sort((a, b) => b[1] - a[1])
                  .map(([nome, val]) => (
                    <div key={nome} className="flex justify-between items-center py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-700">{nome}</span>
                      </div>
                      <span className="font-semibold text-[#123b63]">{fmtBRL(val)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: LANÇAMENTOS
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'lancamentos' && (
        <div className="space-y-4">
          {/* Barra de filtros */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-md">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mês</label>
                <MonthPicker
                  value={filtroMes}
                  onChange={setFiltroMes}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Movimento</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm h-[38px]">
                  {([
                    { v: '' as const,        label: 'Todos'   },
                    { v: 'entrada' as const, label: '↑ Entr.' },
                    { v: 'saida' as const,   label: '↓ Saída' },
                  ]).map(opt => (
                    <button key={opt.v} type="button"
                      onClick={() => { setFiltroMovimento(opt.v); setFiltroTipo(''); }}
                      className={`flex-1 text-xs font-medium transition px-1 ${
                        filtroMovimento === opt.v
                          ? opt.v === 'entrada' ? 'bg-green-600 text-white'
                            : opt.v === 'saida' ? 'bg-red-500 text-white'
                            : 'bg-[#123b63] text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={e => setFiltroTipo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todos os tipos</option>
                  {filtroMovimento === 'saida'
                    ? TIPOS_SAIDA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                    : TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                  }
                </select>
              </div>
              {!scope.isFinanceiroLocal && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Caixa</label>
                  <select
                    value={filtroCong}
                    onChange={e => setFiltroCong(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Todas as congregações</option>
                    {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Linha de ações */}
            <div className="mt-3 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                {scope.canWrite && (
                  <button
                    onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
                  >
                    <Plus className="h-4 w-4" /> Novo
                  </button>
                )}
                {lancamentosMes.length > 0 && (
                  <button
                    onClick={() => exportarCSV(lancsFiltrados, `lancamentos-${filtroMes}`)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                    title="Exportar lançamentos filtrados para CSV"
                  >
                    <Download className="h-4 w-4" /> CSV
                  </button>
                )}
              </div>
              {/* Totalizador */}
              <div className="flex gap-3 flex-wrap text-sm">
                <span className="text-gray-400">{lancsFiltrados.length} reg.</span>
                <span className="text-green-600 font-semibold">↑ {fmtBRL(entradasFiltradas)}</span>
                <span className="text-red-500 font-semibold">↓ {fmtBRL(saidasFiltradas)}</span>
                <span className={`font-bold ${entradasFiltradas - saidasFiltradas >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>
                  = {fmtBRL(entradasFiltradas - saidasFiltradas)}
                </span>
              </div>
            </div>

            {/* Loading do mês */}
            {loadingMes && (
              <p className="text-xs text-gray-400 mt-2 text-center">Buscando lançamentos do mês...</p>
            )}
          </div>

          {/* Formulário inline */}
          {showForm && (
            <div className="bg-white rounded-2xl border-2 border-[#123b63] p-5 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-[#123b63]">
                  {editId ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h3>
                <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()); resetDizForm(); }}>
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-700" />
                </button>
              </div>

              {/* Toggle Entrada / Saída */}
              <div className="flex gap-2 mb-4">
                {(['entrada', 'saida'] as const).map(mv => (
                  <button
                    key={mv}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, tipo_movimento: mv, tipo_recebimento: '', categoria_saida: '' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                      form.tipo_movimento === mv
                        ? mv === 'entrada'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {mv === 'entrada' ? '↑ Entrada (Receita)' : '↓ Saída (Despesa)'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Caixa / Congregação */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Caixa</label>
                  {scope.isFinanceiroLocal ? (
                    <input
                      readOnly
                      value={congNome(scope.congregacaoId)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
                    />
                  ) : (
                    <select
                      value={form.congregacao_id}
                      onChange={e => setForm(p => ({ ...p, congregacao_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Selecione a congregação *</option>
                      {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                </div>

                {/* Tipo de Entrada ou Categoria de Saída */}
                {form.tipo_movimento === 'entrada' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Tipo de recebimento <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.tipo_recebimento}
                      onChange={e => setForm(p => ({ ...p, tipo_recebimento: e.target.value as TipoRecebimento }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria da despesa</label>
                    <select
                      value={form.categoria_saida}
                      onChange={e => setForm(p => ({ ...p, categoria_saida: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Selecione</option>
                      {TIPOS_SAIDA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Busca de membro dizimista */}
                {form.tipo_movimento === 'entrada' && form.tipo_recebimento === 'dizimo' && (
                  <div className="relative">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Membro dizimista
                      <span className="ml-1 font-normal text-gray-400">(opcional)</span>
                    </label>

                    {/* Membro cadastrado selecionado */}
                    {dizSelId && (
                      <div className="flex items-center gap-2 px-3 py-2 border border-green-300 rounded-lg bg-green-50 text-sm">
                        <CheckCircle size={14} className="text-green-500 shrink-0" />
                        <span className="flex-1 text-green-800 font-medium truncate">{dizSelNome}</span>
                        <button type="button" onClick={resetDizForm} className="text-green-600 hover:text-red-500 transition">
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Dízimo avulso */}
                    {!dizSelId && dizIsAvulso && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-700 font-medium">
                          <span>Membro não encontrado — será salvo como dízimo avulso</span>
                          <button type="button" onClick={resetDizForm} className="ml-auto text-amber-500 hover:text-red-500" title="Limpar e buscar novamente">
                            <X size={12} />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Nome do contribuinte (opcional)"
                          value={dizAvulsoNome}
                          onChange={e => setDizAvulsoNome(e.target.value)}
                          className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-amber-50 placeholder-amber-400"
                        />
                        <p className="text-xs text-amber-600">Será identificado no relatório como “Avulso”.</p>
                      </div>
                    )}

                    {/* Busca */}
                    {!dizSelId && !dizIsAvulso && (
                      <>
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Digite 3 letras do nome..."
                            value={dizBusca}
                            onChange={e => { setDizBusca(e.target.value); buscarMembDizimista(e.target.value); }}
                            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm"
                          />
                        </div>
                        {dizBuscando && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
                        {dizBuscaRes.length > 0 && (
                          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {dizBuscaRes.map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => { setDizSelId(m.id); setDizSelNome(m.nome); setDizBusca(''); setDizBuscaRes([]); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition border-b border-gray-100 last:border-0"
                              >
                                {m.nome}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Departamento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Departamento</label>
                  <select
                    value={form.departamento_id}
                    onChange={e => setForm(p => ({ ...p, departamento_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Caixa da Igreja</option>
                    {departamentos.map(d => (
                      <option key={d.id} value={d.id}>{d.sigla} – {d.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Valor (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={e => {
                      // Permite digitar livremente: só dígitos e vírgula
                      const raw = e.target.value.replace(/[^\d,]/g, '');
                      setForm(p => ({ ...p, valor: raw }));
                    }}
                    onBlur={e => {
                      // Formata para 1.250,00 ao sair do campo
                      const raw = e.target.value.replace(/\./g, '').replace(',', '.');
                      const num = parseFloat(raw);
                      if (!isNaN(num) && num > 0) {
                        setForm(p => ({ ...p, valor: num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
                      }
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Data */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Data <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.data_lancamento}
                    onChange={e => setForm(p => ({ ...p, data_lancamento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Forma de pagamento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Forma de pagamento</label>
                  <select
                    value={form.forma_pagamento}
                    onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value as FormaPagamento }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {FORMAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                {/* Conta / Caixa */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Conta / Caixa</label>
                  {finContas.length === 0 ? (
                    <div className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-400 flex items-center justify-between gap-2">
                      <span>Nenhuma conta cadastrada.</span>
                      <button type="button" onClick={() => { setShowForm(false); setAba('contas'); }} className="text-[#123b63] font-semibold hover:underline whitespace-nowrap">+ Cadastrar</button>
                    </div>
                  ) : (
                    <select
                      value={form.conta_id}
                      onChange={e => setForm(p => ({ ...p, conta_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Padrão do ministério</option>
                      {finContas.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}{c.is_padrao ? ' ★' : ''}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Categoria financeira */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria financeira</label>
                  {finCategorias.length === 0 ? (
                    <div className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-400 flex items-center justify-between gap-2">
                      <span>Sem categorias disponíveis.</span>
                      <button type="button" onClick={() => { setShowForm(false); setAba('categorias'); }} className="text-[#123b63] font-semibold hover:underline whitespace-nowrap">Configurar</button>
                    </div>
                  ) : (
                    <select
                      value={form.categoria_id}
                      onChange={e => setForm(p => ({ ...p, categoria_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Sem categoria</option>
                      {finCategorias
                        .filter(c => c.tipo_movimento === form.tipo_movimento || c.tipo_movimento === 'ambos')
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.icone ? `${c.icone} ` : ''}{c.nome}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* Referência */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Referência (evento/campanha)</label>
                  <input
                    type="text"
                    placeholder="Ex: Festa das Nações"
                    value={form.referencia}
                    onChange={e => setForm(p => ({ ...p, referencia: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Descrição */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
                  <input
                    type="text"
                    placeholder="Descrição livre..."
                    value={form.descricao}
                    onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Obs */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
                  <textarea
                    rows={2}
                    value={form.observacoes}
                    onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Registrar'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()); resetDizForm(); }}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            {lancsFiltrados.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">Nenhum lançamento no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Caixa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Departamento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Descrição / Ref.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lancsFiltrados.map(l => (
                      <tr key={l.id} className={`hover:bg-slate-50 transition ${l.tipo_movimento === 'saida' ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(l.data_lancamento)}</td>
                        <td className="px-4 py-3 text-gray-700">{l.congregacao_nome}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{l.departamento_nome}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold w-fit ${
                              l.tipo_movimento === 'saida'
                                ? (TIPOS_SAIDA.find(t => t.value === l.tipo_recebimento)?.cor ?? 'bg-red-100 text-red-800')
                                : tipoCor(l.tipo_recebimento)
                            }`}>
                              {l.tipo_movimento === 'saida'
                                ? (TIPOS_SAIDA.find(t => t.value === l.tipo_recebimento)?.label ?? l.tipo_recebimento)
                                : tipoLabel(l.tipo_recebimento)}
                            </span>
                            <span className={`text-xs font-semibold ${l.tipo_movimento === 'saida' ? 'text-red-500' : 'text-green-600'}`}>
                              {l.tipo_movimento === 'saida' ? '↓ Saída' : '↑ Entrada'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                          {l.referencia || l.descricao || '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${l.tipo_movimento === 'saida' ? 'text-red-600' : 'text-[#123b63]'}`}>
                          {l.tipo_movimento === 'saida' ? '- ' : ''}{fmtBRL(Number(l.valor))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-center">
                            {scope.canWrite && (
                              <button onClick={() => handleEdit(l)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {scope.canDelete && (
                              <button onClick={() => setConfirmDel(l.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#123b63]/5 border-t border-gray-200">
                      <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-600 text-right">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-[#123b63]">{fmtBRL(totalFiltrado)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: CAIXA MENSAL (por congregação)
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'caixa' && (() => {
        const todasCaixas: Array<{ id: string | null; nome: string }> = [
          { id: null, nome: 'Sede / Caixa Geral' },
          ...congregacoes.map(c => ({ id: c.id, nome: c.nome })),
        ];
        const caixasVisiveis = scope.isFinanceiroLocal && scope.congregacaoId
          ? todasCaixas.filter(cx => cx.id === scope.congregacaoId)
          : todasCaixas;

        const statusMes = caixasVisiveis.map(cx => {
          const fec = fechamentos.find(f =>
            f.mes_referencia === abaFechaMes &&
            (cx.id === null ? f.congregacao_id === null : f.congregacao_id === cx.id),
          );
          const fechAnt = fechamentos
            .filter(f =>
              f.mes_referencia < abaFechaMes &&
              f.status === 'fechado' &&
              (cx.id === null ? f.congregacao_id === null : f.congregacao_id === cx.id),
            )
            .sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia))[0];
          const doMes = lancamentos.filter(l =>
            l.data_lancamento.startsWith(abaFechaMes) &&
            (cx.id === null ? l.congregacao_id === null : l.congregacao_id === cx.id),
          );
          const entLive = doMes.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
          const saiLive = doMes.filter(l => l.tipo_movimento === 'saida').reduce((s, l) => s + Number(l.valor), 0);
          const saldoInicial  = fec?.saldo_inicial  ?? (fechAnt?.saldo_final ?? 0);
          const totalEntradas = fec?.total_entradas ?? entLive;
          const totalSaidas   = fec?.total_saidas   ?? saiLive;
          const saldoFinal    = fec?.saldo_final    ?? (saldoInicial + entLive - saiLive);
          const isFechado     = fec?.status === 'fechado';
          return { ...cx, fec, fechAnt, entLive, saiLive, saldoInicial, totalEntradas, totalSaidas, saldoFinal, isFechado };
        });

        const totalFechadas  = statusMes.filter(s => s.isFechado).length;
        const totalPendentes = statusMes.filter(s => !s.isFechado).length;
        const pctFechamento  = statusMes.length > 0 ? Math.round((totalFechadas / statusMes.length) * 100) : 0;
        const [ano, mon]     = abaFechaMes.split('-');

        return (
          <div className="space-y-6">
            {/* Seletor de mês */}
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mês / Ano</label>
                <MonthPicker value={abaFechaMes} onChange={setAbaFechaMes} />
              </div>
            </div>

            {/* KPIs de fechamento */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-slate-400 p-4 shadow-md">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Caixas</p>
                <p className="text-2xl font-bold text-gray-700">{statusMes.length}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-green-500 p-4 shadow-md">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fechadas</p>
                <p className="text-2xl font-bold text-green-600">{totalFechadas}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-yellow-500 p-4 shadow-md">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{totalPendentes}</p>
              </div>
              <div className={`rounded-2xl border-2 p-4 shadow-md ${pctFechamento === 100 ? 'bg-green-50 border-green-500' : pctFechamento >= 50 ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-[#123b63]'}`}>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">% Fechamento</p>
                <p className={`text-2xl font-bold ${pctFechamento === 100 ? 'text-green-600' : pctFechamento >= 50 ? 'text-yellow-600' : 'text-[#123b63]'}`}>{pctFechamento}%</p>
                <p className="text-xs text-gray-400 mt-0.5">{MESES_LABEL[Number(mon) - 1]}/{ano}</p>
              </div>
            </div>

            {/* Tabela de caixas por congregação */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-md">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Situação de Caixa — {MESES_LABEL[Number(mon) - 1]}/{ano}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Congregação</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Saldo Inicial</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-green-600">Entradas</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-red-500">Saídas</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Saldo Final</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                      {scope.canWrite && <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statusMes.map(cx => (
                      <tr key={cx.id ?? '__sede__'} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-700">{cx.nome}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmtBRL(cx.saldoInicial)}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">{fmtBRL(cx.totalEntradas)}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-semibold">{fmtBRL(cx.totalSaidas)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${cx.saldoFinal >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>{fmtBRL(cx.saldoFinal)}</td>
                        <td className="px-4 py-3 text-center">
                          {cx.isFechado
                            ? <span className="flex items-center justify-center gap-1 text-green-700 text-xs font-semibold"><Lock className="h-3 w-3" /> Fechado</span>
                            : <span className="flex items-center justify-center gap-1 text-yellow-600 text-xs font-semibold"><Unlock className="h-3 w-3" /> Aberto</span>
                          }
                        </td>
                        {scope.canWrite && (
                          <td className="px-4 py-3 text-center">
                            {!cx.isFechado ? (
                              <button
                                onClick={() => {
                                  setFechaCongId(cx.id);
                                  setFechaSaldoInicial(String(cx.saldoInicial));
                                  setFechaObs('');
                                  setShowFechaModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#0f2a45] transition mx-auto"
                              >
                                <Lock className="h-3 w-3" /> Fechar
                              </button>
                            ) : cx.fec?.fechado_em ? (
                              <span className="text-xs text-gray-400">{fmtDate(cx.fec.fechado_em.slice(0, 10))}</span>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal de fechamento por congregação */}
            {showFechaModal && (() => {
              const cxModal = statusMes.find(cx => cx.id === fechaCongId) ?? statusMes[0];
              const saldoIniNum = parseFloat(fechaSaldoInicial.replace(',', '.')) || 0;
              const saldoFinalModal = saldoIniNum + (cxModal?.entLive ?? 0) - (cxModal?.saiLive ?? 0);
              return (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-[#123b63]">Fechar Caixa</h3>
                        <p className="text-sm text-gray-500">{cxModal?.nome} — {MESES_LABEL[Number(mon) - 1]}/{ano}</p>
                      </div>
                      <button onClick={() => { setShowFechaModal(false); setFechaCongId(null); }}><X className="h-5 w-5 text-gray-400" /></button>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Saldo inicial do mês (R$)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={fechaSaldoInicial}
                        onChange={e => setFechaSaldoInicial(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                      {cxModal?.fechAnt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Sugerido: {fmtBRL(cxModal.fechAnt.saldo_final)} (saldo de {cxModal.fechAnt.mes_referencia.split('-').reverse().join('/')})
                        </p>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Entradas do mês:</span>
                        <span className="font-semibold text-green-600">{fmtBRL(cxModal?.entLive ?? 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Saídas do mês:</span>
                        <span className="font-semibold text-red-500">{fmtBRL(cxModal?.saiLive ?? 0)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="text-gray-700 font-semibold">Saldo final:</span>
                        <span className={`font-bold ${saldoFinalModal >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>
                          {fmtBRL(saldoFinalModal)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
                      <textarea
                        rows={2}
                        value={fechaObs}
                        onChange={e => setFechaObs(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleFecharMes}
                        disabled={salvandoFecha}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
                      >
                        <Lock className="h-4 w-4" /> {salvandoFecha ? 'Fechando...' : 'Confirmar Fechamento'}
                      </button>
                      <button
                        onClick={() => { setShowFechaModal(false); setFechaCongId(null); }}
                        className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Histórico de fechamentos */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-md">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Histórico de fechamentos</h3>
              {fechamentos.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum mês fechado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b-2 border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Mês</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Congregação</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Saldo Inicial</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-green-600">Entradas</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-red-500">Saídas</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Saldo Final</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fechamentos
                        .slice()
                        .sort((a, b) =>
                          b.mes_referencia.localeCompare(a.mes_referencia) ||
                          (a.congregacao_id ?? '').localeCompare(b.congregacao_id ?? ''),
                        )
                        .map(f => {
                          const [fy, fm] = f.mes_referencia.split('-');
                          const cxNome = f.congregacao_id
                            ? (congregacoes.find(c => c.id === f.congregacao_id)?.nome ?? '—')
                            : 'Sede / Caixa Geral';
                          return (
                            <tr key={f.id} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 font-semibold text-gray-700">{MESES_LABEL[Number(fm) - 1]}/{fy}</td>
                              <td className="px-4 py-3 text-gray-600">{cxNome}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{fmtBRL(f.saldo_inicial)}</td>
                              <td className="px-4 py-3 text-right text-green-600 font-semibold">{fmtBRL(f.total_entradas)}</td>
                              <td className="px-4 py-3 text-right text-red-500 font-semibold">{fmtBRL(f.total_saidas)}</td>
                              <td className={`px-4 py-3 text-right font-bold ${f.saldo_final >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>{fmtBRL(f.saldo_final)}</td>
                              <td className="px-4 py-3 text-center">
                                {f.status === 'fechado'
                                  ? <span className="flex items-center justify-center gap-1 text-green-700 text-xs font-semibold"><Lock className="h-3 w-3" /> Fechado</span>
                                  : <span className="flex items-center justify-center gap-1 text-yellow-600 text-xs font-semibold"><Unlock className="h-3 w-3" /> Aberto</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: RELATÓRIO
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'relatorio' && (
        <div className="space-y-4">
          {/* Filtros do relatório */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-md flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de relatório</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                {(['entradas', 'saidas', 'ambos'] as const).map(v => (
                  <button key={v} onClick={() => setRelTipoRel(v)}
                    className={`px-3 py-1.5 font-medium transition ${
                      relTipoRel === v ? 'bg-[#123b63] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}>
                    {v === 'entradas' ? 'Entradas' : v === 'saidas' ? 'Saídas' : 'Ambos'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Mês de referência</label>
              <MonthPicker
                value={relMes}
                onChange={setRelMes}
              />
            </div>
            {!scope.isFinanceiroLocal && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Caixa</label>
                <select
                  value={relCong}
                  onChange={e => setRelCong(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todas as congregações</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <label className="no-print flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={relMostrarDet}
                onChange={e => setRelMostrarDet(e.target.checked)}
                className="w-4 h-4 accent-[#123b63] cursor-pointer"
              />
              <span className="text-sm text-gray-600">Incluir lançamentos detalhados</span>
            </label>
            <button
              onClick={handlePrint}
              className="no-print flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button
              onClick={() => exportarCSV(relDados, `relatorio-${relMes || 'geral'}`)}
              className="no-print flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              title="Exportar relatório para CSV"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>

          {/* Resumo por tipo */}
          <div id="relatorio-print" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md space-y-5">

            {/* Loading indicator */}
            {relLoadingDB && (
              <p className="text-sm text-gray-400 py-6 text-center">Buscando dados do período...</p>
            )}

            {/* Timbre (visível apenas na impressão) */}
            <div className="hidden print:block border-b border-gray-300 pb-4 mb-4">
              <div className="flex items-center gap-4">
                {ministerio?.logo && (
                  <img src={ministerio.logo} alt="Logo" className="h-16 w-16 object-contain" />
                )}
                <div className="flex-1 text-center">
                  <p className="text-xl font-bold text-gray-900">{ministerio?.nome}</p>
                  {ministerio?.endereco && <p className="text-xs text-gray-600 mt-0.5">{ministerio.endereco}</p>}
                  <p className="text-xs text-gray-600 mt-0.5">
                    {ministerio?.telefone && `Tel: ${ministerio.telefone}`}
                    {ministerio?.telefone && ministerio?.email && ' | '}
                    {ministerio?.email && `Email: ${ministerio.email}`}
                  </p>
                </div>
                {ministerio?.logo && <div className="w-16" />}
              </div>
            </div>
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#123b63]">
                  {relTipoRel === 'entradas' ? 'Relatório de Entradas' : relTipoRel === 'saidas' ? 'Relatório de Saídas' : 'Relatório Financeiro'}
                </h2>
                <p className="text-sm text-gray-500">
                  {relMes ? `Período: ${relMes.split('-')[1]}/${relMes.split('-')[0]}` : 'Todos os períodos'}
                  {relCong ? ` • ${congNome(relCong)}` : ' • Todas as congregações'}
                </p>
              </div>
              {relTipoRel === 'ambos' ? (
                <div className="flex gap-3">
                  <div className="bg-green-50 rounded-lg px-4 py-2 text-center">
                    <p className="text-xs text-green-600 font-semibold">Entradas</p>
                    <p className="text-base font-bold text-green-700">{fmtBRL(relTotalEntradas)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg px-4 py-2 text-center">
                    <p className="text-xs text-red-500 font-semibold">Saídas</p>
                    <p className="text-base font-bold text-red-600">{fmtBRL(relTotalSaidas)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-4 py-2 text-center">
                    <p className="text-xs text-[#123b63] font-semibold">Saldo</p>
                    <p className={`text-base font-bold ${relTotalEntradas - relTotalSaidas >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>
                      {fmtBRL(relTotalEntradas - relTotalSaidas)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className={`text-xl font-bold ${relTipoRel === 'saidas' ? 'text-red-600' : 'text-[#123b63]'}`}>{fmtBRL(relTotal)}</p>
              )}
            </div>

            {/* Por tipo — Entradas */}
            {(relTipoRel === 'entradas' || relTipoRel === 'ambos') && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Resumo de Entradas por tipo</h3>
                <div className="divide-y divide-gray-100">
                  {TIPOS.map(t => {
                    const val = relPorTipo[t.value] ?? 0;
                    const base = relTotalEntradas > 0 ? relTotalEntradas : 1;
                    const pct = ((val / base) * 100).toFixed(1);
                    return (
                      <div key={t.value} className="flex items-center justify-between py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.cor}`}>{t.label}</span>
                        <div className="flex gap-4 items-center">
                          <span className="text-gray-400 text-xs">{pct}%</span>
                          <span className="font-semibold text-gray-800 w-28 text-right">{fmtBRL(val)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {relTipoRel === 'ambos' && (
                    <div className="flex items-center justify-between py-2 text-sm border-t border-gray-200">
                      <span className="text-xs font-bold text-gray-600">TOTAL ENTRADAS</span>
                      <span className="font-bold text-green-700 w-28 text-right">{fmtBRL(relTotalEntradas)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Por tipo — Saídas */}
            {(relTipoRel === 'saidas' || relTipoRel === 'ambos') && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Resumo de Saídas por categoria</h3>
                <div className="divide-y divide-gray-100">
                  {TIPOS_SAIDA.map(t => {
                    const val = relPorTipoSaida[t.value] ?? 0;
                    const base = relTotalSaidas > 0 ? relTotalSaidas : 1;
                    const pct = ((val / base) * 100).toFixed(1);
                    return (
                      <div key={t.value} className="flex items-center justify-between py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.cor}`}>{t.label}</span>
                        <div className="flex gap-4 items-center">
                          <span className="text-gray-400 text-xs">{pct}%</span>
                          <span className="font-semibold text-red-700 w-28 text-right">{fmtBRL(val)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between py-2 text-sm border-t border-gray-200">
                    <span className="text-xs font-bold text-gray-600">{relTipoRel === 'ambos' ? 'TOTAL SAÍDAS' : 'TOTAL'}</span>
                    <span className="font-bold text-red-600 w-28 text-right">{fmtBRL(relTotalSaidas)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Detalhado */}
            <div className={relMostrarDet ? '' : 'no-print'}>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Lançamentos detalhados</h3>
              {relDados.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum lançamento no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Caixa</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Departamento</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Tipo</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Referência</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Forma</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {relDados.map(l => (
                        <tr key={l.id} className={l.tipo_movimento === 'saida' ? 'bg-red-50/30' : ''}>
                          <td className="px-3 py-2 text-gray-600">{fmtDate(l.data_lancamento)}</td>
                          <td className="px-3 py-2 text-gray-700">{l.congregacao_nome}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{l.departamento_nome}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tipoCor(l.tipo_recebimento)}`}>
                              {tipoLabel(l.tipo_recebimento)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{l.referencia || l.descricao || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 capitalize">{l.forma_pagamento}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${l.tipo_movimento === 'saida' ? 'text-red-600' : 'text-[#123b63]'}`}>
                            {l.tipo_movimento === 'saida' ? '−' : ''}{fmtBRL(Number(l.valor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#123b63]/5 border-t border-gray-200">
                        <td colSpan={6} className="px-3 py-2 text-xs font-bold text-gray-600 text-right">TOTAL</td>
                        <td className={`px-3 py-2 text-right font-bold ${relTipoRel === 'saidas' ? 'text-red-600' : 'text-[#123b63]'}`}>{fmtBRL(relTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

            {/* Rodapé de impressão */}
            <div className="hidden print:block border-t border-gray-200 pt-3 mt-4 text-right text-xs text-gray-400">
              Impresso em: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>

            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: DIZIMISTAS
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'dizimistas' && (
        <div className="space-y-5">

          {/* Filtros */}
          <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-md flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Mês/Ano</label>
              <MonthPicker value={abaDizimistaMes} onChange={v => setAbaDizimistaMes(v)} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome</label>
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={filtroNomeDiz}
                onChange={e => setFiltroNomeDiz(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Congregação</label>
              <select
                value={filtroConsDiz}
                onChange={e => setFiltroConsDiz(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select
                value={filtroStatusDiz}
                onChange={e => setFiltroStatusDiz(e.target.value as '' | 'pago' | 'pendente' | 'avulso')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="pago">Adimplente</option>
                <option value="pendente">Inadimplente</option>
                <option value="avulso">Dízimos avulsos</option>
              </select>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0e2d4e] transition"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            {filtroStatusDiz !== 'avulso' && dizimistasVisiveis.length > 0 && (
              <button
                onClick={() => {
                  const rows = dizimistasVisiveis.map(d => ({
                    id: d.id,
                    congregacao_id: d.congregacao_id,
                    congregacao_nome: d.congregacao_nome,
                    data_lancamento: abaDizimistaMes + '-01',
                    tipo_movimento: 'entrada' as TipoMovimento,
                    tipo_recebimento: 'dizimo' as TipoRecebimento,
                    valor: 0,
                    forma_pagamento: 'dinheiro' as FormaPagamento,
                    descricao: d.status === 'pago' ? 'Adimplente' : 'Inadimplente',
                    referencia: null, observacoes: null, dizimista_nome: d.nome,
                    departamento_id: null, member_id: d.id, ministry_id: ministryId ?? '',
                    criado_por: null, created_at: '', departamento_nome: '—',
                  }));
                  exportarCSV(rows as Lancamento[], `dizimistas-${abaDizimistaMes}`);
                }}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                title="Exportar lista para CSV"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            )}
          </div>

          {/* Cards resumo */}
          <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-[#123b63] p-4 shadow-md">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Dizimistas</p>
              <p className="text-2xl font-bold text-[#123b63]">{dizimistas.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-green-500 p-4 shadow-md">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Deram dízimo este mês</p>
              <p className="text-2xl font-bold text-green-600">{totalPagos}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-yellow-400 p-4 shadow-md">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Inadimplentes</p>
              <p className="text-2xl font-bold text-yellow-600">{dizimistas.length - totalPagos}</p>
            </div>
          </div>

          {/* Área de impressão */}
          <div id="dizimistas-print" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
            {/* Timbre — visível apenas na impressão */}
            <div className="hidden print:block mb-6 border-b pb-4">
              {ministerio?.logo && (
                <img src={ministerio.logo} alt="Logo" className="h-16 mb-2" />
              )}
              <h1 className="text-xl font-bold text-gray-900">{ministerio?.nome ?? 'Ministério'}</h1>
              {ministerio?.endereco && <p className="text-xs text-gray-600">{ministerio.endereco}</p>}
              {(ministerio?.telefone || ministerio?.email) && (
                <p className="text-xs text-gray-600">
                  {[ministerio.telefone, ministerio.email].filter(Boolean).join(' | ')}
                </p>
              )}
              <h2 className="text-base font-semibold text-gray-700 mt-3">
                {filtroStatusDiz === 'avulso'
                  ? `Dízimos Avulsos — ${abaDizimistaMes.split('-').reverse().join('/')}`
                  : filtroStatusDiz === 'pendente'
                  ? `Inadimplentes — ${abaDizimistaMes.split('-').reverse().join('/')}`
                  : filtroStatusDiz === 'pago'
                  ? `Adimplentes — ${abaDizimistaMes.split('-').reverse().join('/')}`
                  : `Dizimistas (Adimplentes + Avulsos) — ${abaDizimistaMes.split('-').reverse().join('/')}`}
              </h2>
            </div>

            {/* Tabela de dízimos avulsos */}
            {filtroStatusDiz === 'avulso' ? (
              dizimosAvulsos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Nenhum dízimo avulso registrado em {abaDizimistaMes.split('-').reverse().join('/')}.
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-200">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">#</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Nome / Contribuinte</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Congregação</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Data</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dizimosAvulsos.map((l, i) => (
                      <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {l.dizimista_nome || <span className="text-gray-400 italic">Não informado</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {l.congregacao_nome || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(l.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-[#123b63]">
                          {fmtBRL(Number(l.valor))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-amber-200 bg-amber-50">
                      <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-600">Total ({dizimosAvulsos.length} registro{dizimosAvulsos.length !== 1 ? 's' : ''})</td>
                      <td className="px-3 py-2 text-right font-bold text-[#123b63]">
                        {fmtBRL(dizimosAvulsos.reduce((s, l) => s + Number(l.valor), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )

            ) : filtroStatusDiz === '' ? (
              // Lista unificada: Adimplentes + Avulsos
              loadingDizimistas ? (
                <div className="text-center py-8 text-gray-400">Carregando...</div>
              ) : listaUnificadaTodos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Nenhum dízimo registrado em {abaDizimistaMes.split('-').reverse().join('/')}.
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">#</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Nome</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Congregação</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Situação</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaUnificadaTodos.map((row, i) => (
                      <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{row.nome}</td>
                        <td className="px-3 py-2 text-gray-600">{row.congregacao_nome}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.situacao === 'Adimplente'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>{row.situacao}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500 text-xs">
                          {row.valor != null ? fmtBRL(row.valor) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )

            ) : loadingDizimistas ? (
              <div className="text-center py-8 text-gray-400">Carregando...</div>
            ) : dizimistasVisiveis.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {filtroStatusDiz === 'pendente'
                  ? 'Nenhum inadimplente no período selecionado.'
                  : 'Nenhum resultado para os filtros selecionados.'}
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">#</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Nome</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Congregação</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {dizimistasVisiveis.map((d, i) => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{d.nome}</td>
                      <td className="px-3 py-2 text-gray-600">{d.congregacao_nome}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          d.status === 'pago'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {d.status === 'pago' ? 'Adimplente' : 'Inadimplente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Rodapé de impressão */}
            <div className="hidden print:block border-t border-gray-200 pt-3 mt-4 text-right text-xs text-gray-400">
              Impresso em: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: CONTAS
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'contas' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#123b63]">Contas e Caixas</h2>
              <p className="text-sm text-gray-500">Gerencie caixas físicos, contas bancárias e fundos do ministério.</p>
            </div>
            {scope.canDelete && (
              <button
                onClick={() => { setFormConta(emptyFormConta()); setContaEditId(null); setShowContaModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
              >
                <Plus className="h-4 w-4" /> Nova Conta
              </button>
            )}
          </div>

          {/* Alerta quando sem contas */}
          {!loadingContas && contasFull.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Nenhuma conta cadastrada</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Cadastre caixas e contas bancárias para que apareçam nos formulários de lançamento.
                  {!scope.canDelete && ' Entre em contato com o Administrador ou Financeiro para cadastrar.'}
                </p>
              </div>
            </div>
          )}

          {/* Lista */}
          {loadingContas ? (
            <p className="text-center text-gray-400 py-12">Carregando...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {contasFull.map(c => (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl border-2 p-4 shadow-sm transition ${
                    c.is_padrao ? 'border-[#123b63]' : c.is_ativa ? 'border-slate-200' : 'border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.is_padrao && <Star className="h-3.5 w-3.5 text-amber-500 shrink-0 fill-amber-500" />}
                        <span className="font-bold text-gray-800 text-sm truncate">{c.nome}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                        c.tipo === 'caixa'          ? 'bg-green-100 text-green-700' :
                        c.tipo === 'conta_corrente' ? 'bg-blue-100 text-blue-700' :
                        c.tipo === 'poupanca'       ? 'bg-teal-100 text-teal-700' :
                        c.tipo === 'pix'            ? 'bg-purple-100 text-purple-700' :
                        c.tipo === 'fundo'          ? 'bg-orange-100 text-orange-700' :
                                                     'bg-gray-100 text-gray-600'
                      }`}>
                        {TIPOS_CONTA.find(t => t.value === c.tipo)?.label ?? c.tipo}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ml-2 ${
                      c.is_ativa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.is_ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                    {c.congregacao_id && (
                      <p>📍 {congregacoes.find(x => x.id === c.congregacao_id)?.nome ?? '—'}</p>
                    )}
                    {c.banco && <p>🏦 {c.banco}{c.agencia ? ` / Ag. ${c.agencia}` : ''}{c.conta ? ` / C. ${c.conta}` : ''}</p>}
                    {c.chave_pix && <p>⚡ PIX: {c.chave_pix}</p>}
                    <p>Saldo inicial: <span className="font-semibold text-gray-700">{fmtBRL(Number(c.saldo_inicial))}</span></p>
                  </div>

                  {scope.canDelete && (
                    <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                      <button
                        onClick={() => {
                          setFormConta({
                            nome: c.nome, tipo: c.tipo, banco: c.banco ?? '', agencia: c.agencia ?? '',
                            conta: c.conta ?? '', chave_pix: c.chave_pix ?? '',
                            saldo_inicial: String(c.saldo_inicial),
                            congregacao_id: c.congregacao_id ?? '',
                            is_padrao: c.is_padrao, is_ativa: c.is_ativa,
                          });
                          setContaEditId(c.id);
                          setShowContaModal(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                      {!c.is_padrao && (
                        <button
                          onClick={() => handleSetContaPadrao(c)}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                        >
                          <Star className="h-3 w-3" /> Padrão
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleContaAtiva(c)}
                        className={`px-2 py-1 text-xs rounded-lg transition ${
                          c.is_ativa
                            ? 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {c.is_ativa ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => setConfirmDelConta(c.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                      >
                        <Trash2 className="h-3 w-3" /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Modal: form de conta */}
          {showContaModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-lg space-y-4 overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-[#123b63]">{contaEditId ? 'Editar Conta' : 'Nova Conta / Caixa'}</h3>
                  <button onClick={() => { setShowContaModal(false); setContaEditId(null); setFormConta(emptyFormConta()); }}>
                    <X className="h-5 w-5 text-gray-400 hover:text-gray-700" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nome <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Ex: Caixa Sede, Conta Bradesco..."
                      value={formConta.nome}
                      onChange={e => setFormConta(p => ({ ...p, nome: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                    <select
                      value={formConta.tipo}
                      onChange={e => setFormConta(p => ({ ...p, tipo: e.target.value as FormConta['tipo'] }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      {TIPOS_CONTA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Congregação (opcional)</label>
                    <select
                      value={formConta.congregacao_id}
                      onChange={e => setFormConta(p => ({ ...p, congregacao_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Sede / Ministério geral</option>
                      {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Banco</label>
                    <input
                      type="text"
                      placeholder="Ex: Bradesco, Itaú..."
                      value={formConta.banco}
                      onChange={e => setFormConta(p => ({ ...p, banco: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Agência</label>
                    <input
                      type="text"
                      placeholder="0000-0"
                      value={formConta.agencia}
                      onChange={e => setFormConta(p => ({ ...p, agencia: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Número da Conta</label>
                    <input
                      type="text"
                      placeholder="00000-0"
                      value={formConta.conta}
                      onChange={e => setFormConta(p => ({ ...p, conta: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Chave PIX</label>
                    <input
                      type="text"
                      placeholder="CNPJ, e-mail, telefone..."
                      value={formConta.chave_pix}
                      onChange={e => setFormConta(p => ({ ...p, chave_pix: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Saldo Inicial (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={formConta.saldo_inicial}
                      onChange={e => setFormConta(p => ({ ...p, saldo_inicial: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formConta.is_padrao}
                        onChange={e => setFormConta(p => ({ ...p, is_padrao: e.target.checked }))}
                        className="w-4 h-4 accent-[#123b63]"
                      />
                      <span className="text-sm text-gray-700">Conta padrão do ministério <span className="text-amber-500">★</span></span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formConta.is_ativa}
                        onChange={e => setFormConta(p => ({ ...p, is_ativa: e.target.checked }))}
                        className="w-4 h-4 accent-[#123b63]"
                      />
                      <span className="text-sm text-gray-700">Conta ativa</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveConta}
                    disabled={savingConta}
                    className="flex-1 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
                  >
                    {savingConta ? 'Salvando...' : contaEditId ? 'Atualizar' : 'Criar Conta'}
                  </button>
                  <button
                    onClick={() => { setShowContaModal(false); setContaEditId(null); setFormConta(emptyFormConta()); }}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm delete conta */}
          {confirmDelConta && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
                <h3 className="text-base font-bold text-gray-800 mb-2">Excluir Conta</h3>
                <p className="text-sm text-gray-600 mb-1">Esta ação não pode ser desfeita.</p>
                <p className="text-xs text-amber-600 mb-5">Lançamentos vinculados perderão a referência de conta (conta_id → NULL).</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeleteConta(confirmDelConta)}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setConfirmDelConta(null)}
                    className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: CATEGORIAS
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'categorias' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#123b63]">Categorias Financeiras</h2>
              <p className="text-sm text-gray-500">Categorias do sistema são somente leitura. Crie categorias personalizadas para seu ministério.</p>
            </div>
            {scope.canDelete && (
              <button
                onClick={() => { setFormCat(emptyFormCat()); setCatEditId(null); setShowCatModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition"
              >
                <Plus className="h-4 w-4" /> Nova Categoria
              </button>
            )}
          </div>

          {/* Filtro tipo */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500">Filtrar:</span>
            {([
              { v: '' as const,       label: 'Todos'      },
              { v: 'entrada' as const, label: '↑ Entradas' },
              { v: 'saida' as const,   label: '↓ Saídas'  },
              { v: 'ambos' as const,   label: '⇅ Ambos'   },
            ]).map(opt => (
              <button
                key={opt.v}
                onClick={() => setFiltroCatTipo(opt.v)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  filtroCatTipo === opt.v
                    ? 'bg-[#123b63] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {loadingCats ? (
            <p className="text-center text-gray-400 py-12">Carregando...</p>
          ) : (
            <>
              {/* Categorias do sistema */}
              {(() => {
                const sistemaFiltradas = categoriasFull.filter(c =>
                  c.is_sistema && (!filtroCatTipo || c.tipo_movimento === filtroCatTipo || c.tipo_movimento === 'ambos')
                );
                if (sistemaFiltradas.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Categorias do Sistema (somente leitura)</h3>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-gray-100">
                      {sistemaFiltradas.map(c => (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="w-6 text-center text-sm">{c.icone}</span>
                          <span className="flex-1 text-sm text-gray-700">{c.nome}</span>
                          {c.codigo && <span className="text-xs text-gray-400">{c.codigo}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.tipo_movimento === 'entrada' ? 'bg-green-100 text-green-700' :
                            c.tipo_movimento === 'saida'   ? 'bg-red-100 text-red-700' :
                                                             'bg-gray-100 text-gray-600'
                          }`}>
                            {c.tipo_movimento === 'entrada' ? 'Entrada' : c.tipo_movimento === 'saida' ? 'Saída' : 'Ambos'}
                          </span>
                          {c.cor && <span className="w-3 h-3 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: c.cor }} />}
                          <span className="text-xs text-gray-400 italic">Sistema</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Categorias personalizadas — hierarquia pai/filha */}
              {(() => {
                const customAll = categoriasFull.filter(c => !c.is_sistema);
                const customFiltradas = customAll.filter(c =>
                  !filtroCatTipo || c.tipo_movimento === filtroCatTipo || c.tipo_movimento === 'ambos'
                );
                // Separa pais e filhas
                const pais  = customFiltradas.filter(c => !c.categoria_pai_id);
                const filhas = customFiltradas.filter(c =>  c.categoria_pai_id);
                // Filhas órfãs (pai não aparece na lista filtrada) — exibir sem indentação
                const filhasOrfas = filhas.filter(f => !customFiltradas.some(p => p.id === f.categoria_pai_id));
                const todasRaiz = [...pais, ...filhasOrfas];

                const renderCat = (c: FinCategoriaFull, isChild = false) => (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-2.5 ${!c.is_ativa ? 'opacity-50' : ''} ${isChild ? 'pl-10 border-l-2 border-gray-100 ml-4' : ''}`}>
                    <span className="w-6 text-center text-sm">{c.icone || '🏷️'}</span>
                    <span className="flex-1 text-sm text-gray-700 font-medium">
                      {isChild && <span className="text-gray-400 mr-1">└</span>}
                      {c.nome}
                    </span>
                    {c.codigo && <span className="text-xs text-gray-400">{c.codigo}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.tipo_movimento === 'entrada' ? 'bg-green-100 text-green-700' :
                      c.tipo_movimento === 'saida'   ? 'bg-red-100 text-red-700'     :
                                                       'bg-gray-100 text-gray-600'
                    }`}>
                      {c.tipo_movimento === 'entrada' ? 'Entrada' : c.tipo_movimento === 'saida' ? 'Saída' : 'Ambos'}
                    </span>
                    {c.cor && <span className="w-3 h-3 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: c.cor }} />}
                    <span className={`text-xs font-semibold ${c.is_ativa ? 'text-green-600' : 'text-gray-400'}`}>
                      {c.is_ativa ? 'Ativa' : 'Inativa'}
                    </span>
                    {scope.canDelete && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setFormCat({
                              nome: c.nome, tipo_movimento: c.tipo_movimento,
                              codigo: c.codigo ?? '', cor: c.cor ?? '#6b7280',
                              icone: c.icone ?? '', categoria_pai_id: c.categoria_pai_id ?? '',
                              is_ativa: c.is_ativa,
                            });
                            setCatEditId(c.id);
                            setShowCatModal(true);
                          }}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600 transition"
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleToggleCatAtiva(c)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition text-xs"
                          title={c.is_ativa ? 'Desativar' : 'Ativar'}
                        >
                          {c.is_ativa ? '⊙' : '○'}
                        </button>
                        <button
                          onClick={() => setConfirmDelCat(c.id)}
                          className="p-1 rounded hover:bg-red-50 text-red-500 transition"
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );

                return (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Categorias Personalizadas</h3>
                    {customFiltradas.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
                        <p className="text-sm text-gray-400">Nenhuma categoria personalizada encontrada.</p>
                        {scope.canDelete && (
                          <button
                            onClick={() => { setFormCat(emptyFormCat()); setCatEditId(null); setShowCatModal(true); }}
                            className="mt-3 text-sm text-[#123b63] font-semibold hover:underline"
                          >
                            + Criar primeira categoria
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-gray-100">
                        {todasRaiz.map(pai => (
                          <div key={pai.id}>
                            {renderCat(pai, false)}
                            {filhas
                              .filter(f => f.categoria_pai_id === pai.id)
                              .map(filha => renderCat(filha, true))
                            }
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* Modal: form de categoria */}
          {showCatModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-md space-y-4 overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-[#123b63]">{catEditId ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                  <button onClick={() => { setShowCatModal(false); setCatEditId(null); setFormCat(emptyFormCat()); }}>
                    <X className="h-5 w-5 text-gray-400 hover:text-gray-700" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nome <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Ex: Fundo Social, Construção..."
                      value={formCat.nome}
                      onChange={e => setFormCat(p => ({ ...p, nome: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de movimento</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      {([
                        { v: 'entrada' as const, label: '↑ Entrada' },
                        { v: 'saida' as const,   label: '↓ Saída'  },
                        { v: 'ambos' as const,   label: '⇅ Ambos'  },
                      ]).map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setFormCat(p => ({ ...p, tipo_movimento: opt.v }))}
                          className={`flex-1 py-2 text-sm font-medium transition ${
                            formCat.tipo_movimento === opt.v ? 'bg-[#123b63] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Código (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: 3.1"
                        value={formCat.codigo}
                        onChange={e => setFormCat(p => ({ ...p, codigo: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Ícone (emoji)</label>
                      <input
                        type="text"
                        placeholder="Ex: 🏠"
                        value={formCat.icone}
                        onChange={e => setFormCat(p => ({ ...p, icone: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Cor</label>
                      <input
                        type="color"
                        value={formCat.cor}
                        onChange={e => setFormCat(p => ({ ...p, cor: e.target.value }))}
                        className="w-full h-9 border border-gray-200 rounded-lg px-1 py-1 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria pai (opcional)</label>
                      <select
                        value={formCat.categoria_pai_id}
                        onChange={e => setFormCat(p => ({ ...p, categoria_pai_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Nenhuma</option>
                        {categoriasFull
                          .filter(c => c.id !== catEditId)
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              {c.icone ? `${c.icone} ` : ''}{c.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formCat.is_ativa}
                      onChange={e => setFormCat(p => ({ ...p, is_ativa: e.target.checked }))}
                      className="w-4 h-4 accent-[#123b63]"
                    />
                    <span className="text-sm text-gray-700">Categoria ativa</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveCat}
                    disabled={savingCat}
                    className="flex-1 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
                  >
                    {savingCat ? 'Salvando...' : catEditId ? 'Atualizar' : 'Criar Categoria'}
                  </button>
                  <button
                    onClick={() => { setShowCatModal(false); setCatEditId(null); setFormCat(emptyFormCat()); }}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm delete categoria */}
          {confirmDelCat && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
                <h3 className="text-base font-bold text-gray-800 mb-2">Excluir Categoria</h3>
                <p className="text-sm text-gray-600 mb-1">Esta ação não pode ser desfeita.</p>
                <p className="text-xs text-amber-600 mb-5">Lançamentos vinculados perderão a referência de categoria.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeleteCat(confirmDelCat)}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setConfirmDelCat(null)}
                    className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: ARRECADAÇÃO DIGITAL
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'arrecadacao' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Arrecadação Digital</h2>
              <p className="text-sm text-gray-500">Links PIX, cobranças e webhooks</p>
            </div>
            {scope.canWrite && subAbaArr === 'destinos' && (
              <button
                onClick={() => { setFormDestino(emptyFormDestino()); setDestinoEditId(null); setShowDestinoModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#123b63] text-white rounded-xl text-sm font-semibold hover:bg-[#1a4f85] transition"
              >
                <Plus className="h-4 w-4" /> Novo Destino
              </button>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {(['destinos', 'cobrancas', 'webhooks'] as SubAbaArrecadacao[]).map(tab => (
              <button
                key={tab}
                onClick={() => setSubAbaArr(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  subAbaArr === tab ? 'bg-white shadow text-[#123b63]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'destinos' ? 'Destinos' : tab === 'cobrancas' ? 'Cobranças PIX' : 'Log Webhooks'}
              </button>
            ))}
          </div>

          {/* ── Sub-aba: Destinos ────────────────────────────────── */}
          {subAbaArr === 'destinos' && (<>

          {/* Alerta de Gateway */}
          {gatewayAtivo === false && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Gateway ASAAS não configurado</p>
                <p className="text-xs text-amber-600">Configure um gateway ativo para que os links PIX possam aceitar pagamentos.</p>
              </div>
              <a
                href="/configuracoes"
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition"
              >
                <Settings className="h-3.5 w-3.5" /> Configurar Gateway
              </a>
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filtroDestinoStatus}
              onChange={e => setFiltroDestinoStatus(e.target.value as '' | 'ativo' | 'inativo')}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
            >
              <option value="">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
            <select
              value={filtroDestinoTipo}
              onChange={e => setFiltroDestinoTipo(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
            >
              <option value="">Todos os tipos</option>
              {TIPOS_DESTINO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {congregacoes.length > 0 && !scope.isFinanceiroLocal && (
              <select
                value={filtroDestinoCong}
                onChange={e => setFiltroDestinoCong(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
              >
                <option value="">Todas as congregações</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
          </div>

          {/* Lista */}
          {loadingDestinos ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando destinos...</div>
          ) : (() => {
            const filtrados = destinos.filter(d => {
              if (filtroDestinoStatus === 'ativo'   && !d.is_ativo) return false;
              if (filtroDestinoStatus === 'inativo' && d.is_ativo)  return false;
              if (filtroDestinoTipo && d.tipo_recebimento !== filtroDestinoTipo) return false;
              if (filtroDestinoCong && d.congregacao_id !== filtroDestinoCong) return false;
              return true;
            });

            if (filtrados.length === 0) {
              return (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                  <QrCode className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Nenhum destino de arrecadação encontrado</p>
                  {scope.canWrite && (
                    <button
                      onClick={() => { setFormDestino(emptyFormDestino()); setDestinoEditId(null); setShowDestinoModal(true); }}
                      className="mt-3 text-sm text-[#123b63] font-semibold hover:underline"
                    >
                      + Criar primeiro destino
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtrados.map(dest => {
                  const tipoInfo = TIPOS_DESTINO.find(t => t.value === dest.tipo_recebimento);
                  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/pagar/${dest.public_token}`;
                  return (
                    <div
                      key={dest.id}
                      className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 ${!dest.is_ativo ? 'opacity-60' : ''}`}
                    >
                      {/* Cabeçalho do card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 truncate">{dest.label}</p>
                          {dest.congregacoes?.nome && (
                            <p className="text-xs text-gray-400 truncate">{dest.congregacoes.nome}</p>
                          )}
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${tipoInfo?.cor ?? 'bg-gray-100 text-gray-700'}`}>
                          {tipoInfo?.label ?? dest.tipo_recebimento}
                        </span>
                      </div>

                      {/* Valor + arrecadado */}
                      <div className="flex gap-4 text-sm flex-wrap">
                        <div>
                          <p className="text-xs text-gray-400">Valor</p>
                          <p className="font-semibold text-gray-700">
                            {dest.valor_fixo != null ? fmtBRL(dest.valor_fixo) : 'Aberto'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Arrecadado</p>
                          <p className="font-semibold text-green-700">{fmtBRL(dest.total_arrecadado)}</p>
                        </div>
                        <div className="ml-auto flex flex-col items-end gap-1">
                          <span className={`text-xs font-semibold ${dest.is_ativo ? 'text-green-600' : 'text-gray-400'}`}>
                            {dest.is_ativo ? '● Ativo' : '○ Inativo'}
                          </span>
                          {dest.expires_at && (
                            new Date(dest.expires_at) < new Date()
                              ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Expirado</span>
                              : <span className="text-xs text-amber-600">Expira: {fmtDate(dest.expires_at.split('T')[0])}</span>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
                        <button
                          onClick={() => { setQrDestino({ token: dest.public_token, label: dest.label }); setShowQrModal(true); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#1a4f85] transition"
                          title="Ver QR Code"
                        >
                          <QrCode className="h-3 w-3" /> QR Code
                        </button>
                        <button
                          onClick={() => { void navigator.clipboard.writeText(link); showModal('Copiado!', 'Link copiado para a área de transferência.', 'success'); }}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition"
                          title="Copiar link"
                        >
                          <Copy className="h-3 w-3" /> Copiar Link
                        </button>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition"
                          title="Abrir link"
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </a>
                        {scope.canWrite && (
                          <>
                            <button
                              onClick={() => {
                                setFormDestino({
                                  label:            dest.label,
                                  tipo_recebimento: dest.tipo_recebimento,
                                  congregacao_id:   dest.congregacao_id ?? '',
                                  conta_id:         '',
                                  categoria_id:     '',
                                  valor_fixo:       dest.valor_fixo != null ? String(dest.valor_fixo) : '',
                                  descricao:        dest.descricao ?? '',
                                  expires_at:       dest.expires_at ? new Date(dest.expires_at).toISOString().slice(0, 16) : '',
                                });
                                setDestinoEditId(dest.id);
                                setShowDestinoModal(true);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs hover:bg-blue-50 transition"
                              title="Editar"
                            >
                              <Pencil className="h-3 w-3" /> Editar
                            </button>
                            <button
                              onClick={() => void handleToggleDestino(dest)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition"
                              title={dest.is_ativo ? 'Pausar' : 'Reativar'}
                            >
                              {dest.is_ativo ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                              {dest.is_ativo ? 'Pausar' : 'Reativar'}
                            </button>
                            <button
                              onClick={() => setConfirmDelDestino(dest.id)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 transition"
                              title="Excluir destino"
                            >
                              <Trash2 className="h-3 w-3" /> Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          </>)}

          {/* ── Sub-aba: Cobranças PIX ─────────────────────────────────── */}
          {subAbaArr === 'cobrancas' && (() => {
            const cobrancasFiltradas = cobrancas.filter(c => {
              if (cobrFiltroStatus && c.status !== cobrFiltroStatus) return false;
              if (cobrFiltroDestino && c.destination_id !== cobrFiltroDestino) return false;
              if (cobrFiltroCong && c.congregacao_nome !== congregacoes.find(cg => cg.id === cobrFiltroCong)?.nome) return false;
              if (cobrFiltroStart && c.created_at.split('T')[0] < cobrFiltroStart) return false;
              if (cobrFiltroEnd   && c.created_at.split('T')[0] > cobrFiltroEnd)   return false;
              return true;
            });
            const statusColors: Record<string, string> = {
              pendente: 'bg-yellow-100 text-yellow-800', pago: 'bg-green-100 text-green-800',
              cancelado: 'bg-gray-100 text-gray-600',   expirado: 'bg-red-100 text-red-700',
              estornado: 'bg-orange-100 text-orange-700',
            };
            return (
              <div className="space-y-4">
                {/* Filtros */}
                <div className="flex flex-wrap gap-3">
                  <select value={cobrFiltroStatus} onChange={e => setCobrFiltroStatus(e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]">
                    <option value="">Todos os status</option>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="expirado">Expirado</option>
                    <option value="estornado">Estornado</option>
                  </select>
                  <select value={cobrFiltroDestino} onChange={e => setCobrFiltroDestino(e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]">
                    <option value="">Todos os destinos</option>
                    {destinos.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                  {congregacoes.length > 0 && !scope.isFinanceiroLocal && (
                    <select value={cobrFiltroCong} onChange={e => setCobrFiltroCong(e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]">
                      <option value="">Todas as congregações</option>
                      {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                  <input type="date" value={cobrFiltroStart} onChange={e => setCobrFiltroStart(e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]" title="De" />
                  <input type="date" value={cobrFiltroEnd}   onChange={e => setCobrFiltroEnd(e.target.value)}   className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]" title="Até" />
                  <button onClick={() => void carregarCobrancas()} className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition">
                    <RefreshCw className="h-4 w-4" /> Atualizar
                  </button>
                </div>
                {/* Resumo por congregação */}
                {(() => {
                  const pagas = cobrancasFiltradas.filter(c => c.status === 'pago');
                  if (pagas.length === 0 || congregacoes.length === 0) return null;
                  const porCong = congregacoes.map(cg => ({
                    nome: cg.nome,
                    total: pagas.filter(c => c.congregacao_nome === cg.nome)
                      .reduce((s, c) => s + (c.valor_pago ?? c.valor_solicitado), 0),
                    qtd: pagas.filter(c => c.congregacao_nome === cg.nome).length,
                  })).filter(r => r.qtd > 0);
                  const semCong = pagas.filter(c => !c.congregacao_nome);
                  if (semCong.length > 0) porCong.push({
                    nome: 'Caixa Geral',
                    total: semCong.reduce((s, c) => s + (c.valor_pago ?? c.valor_solicitado), 0),
                    qtd: semCong.length,
                  });
                  if (porCong.length < 2) return null;
                  return (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">Resumo por Congregação (cobranças pagas)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {porCong.sort((a, b) => b.total - a.total).map(r => (
                          <div key={r.nome} className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm">
                            <p className="text-xs text-gray-500 font-medium truncate" title={r.nome}>{r.nome}</p>
                            <p className="text-base font-bold text-green-700 mt-0.5">{fmtBRL(r.total)}</p>
                            <p className="text-[10px] text-gray-400">{r.qtd} cobrança{r.qtd !== 1 ? 's' : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Exportar */}
                <div className="flex justify-end">
                  <button
                    onClick={() => exportarCSVCobrancas(cobrancasFiltradas)}
                    disabled={cobrancasFiltradas.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" /> Exportar CSV ({cobrancasFiltradas.length})
                  </button>
                </div>
                {/* Tabela */}
                {loadingCobrancas ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Carregando cobranças...</div>
                ) : cobrancasFiltradas.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                    <p className="text-gray-500 font-medium">Nenhuma cobrança encontrada</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 text-left">
                          <th className="px-4 py-3 font-semibold">Destino</th>
                          <th className="px-4 py-3 font-semibold">Pagador</th>
                          <th className="px-4 py-3 font-semibold">CPF/CNPJ</th>
                          <th className="px-4 py-3 font-semibold">E-mail</th>
                          <th className="px-4 py-3 font-semibold text-right">Valor</th>
                          <th className="px-4 py-3 font-semibold text-center">Status</th>
                          <th className="px-4 py-3 font-semibold text-right">Pgto.</th>
                          <th className="px-4 py-3 font-semibold text-right">Criado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobrancasFiltradas.map(c => (
                          <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium truncate max-w-[140px]">{c.dest_label}</p>
                              {c.congregacao_nome && <p className="text-xs text-gray-400">{c.congregacao_nome}</p>}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{c.payer_name ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.payer_document ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{c.payer_email ?? '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold">{fmtBRL(c.valor_pago ?? c.valor_solicitado)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 text-xs">{c.paid_at ? fmtDate(c.paid_at.split('T')[0]) : '—'}</td>
                            <td className="px-4 py-3 text-right text-gray-400 text-xs">{fmtDate(c.created_at.split('T')[0])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Sub-aba: Log Webhooks ──────────────────────────────────── */}
          {subAbaArr === 'webhooks' && (() => {
            const webhooksFiltrados = webhookEvents.filter(w => {
              if (webhookFiltroProcessado === 'sim' && !w.processed)                         return false;
              if (webhookFiltroProcessado === 'nao' && (w.processed && !w.processing_error)) return false;
              return true;
            });
            return (
              <div className="space-y-4">
                {/* Filtros */}
                <div className="flex flex-wrap gap-3">
                  <select value={webhookFiltroProcessado} onChange={e => setWebhookFiltroProcessado(e.target.value as '' | 'sim' | 'nao')} className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]">
                    <option value="">Todos</option>
                    <option value="sim">Processados com sucesso</option>
                    <option value="nao">Não processados / Erro</option>
                  </select>
                  <button onClick={() => void carregarWebhookEvents()} className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition">
                    <RefreshCw className="h-4 w-4" /> Atualizar
                  </button>
                </div>
                {/* Tabela */}
                {loadingWebhooks ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Carregando webhooks...</div>
                ) : webhooksFiltrados.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                    <p className="text-gray-500 font-medium">Nenhum evento de webhook encontrado</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 text-left">
                          <th className="px-4 py-3 font-semibold">Evento</th>
                          <th className="px-4 py-3 font-semibold">Gateway Event ID</th>
                          <th className="px-4 py-3 font-semibold text-center">Processado</th>
                          <th className="px-4 py-3 font-semibold">Erro</th>
                          <th className="px-4 py-3 font-semibold text-right">Recebido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {webhooksFiltrados.map(w => (
                          <tr key={w.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{w.event_type}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{w.gateway_event_id}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${w.processed && !w.processing_error ? 'bg-green-100 text-green-700' : w.processing_error ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {w.processed && !w.processing_error ? 'OK' : w.processing_error ? 'Erro' : 'Pendente'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-red-600 max-w-[200px] truncate" title={w.processing_error ?? ''}>
                              {w.processing_error ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400 text-xs">{fmtDate(w.received_at.split('T')[0])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Modal: QR Code ─────────────────────────────────────────── */}
          {showQrModal && qrDestino && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">QR Code — {qrDestino.label}</h3>
                  <button onClick={() => { setShowQrModal(false); setQrCopied(false); }} className="p-1 rounded hover:bg-gray-100">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                <div className="flex justify-center">
                  <QRCodeSVG
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/pagar/${qrDestino.token}`}
                    size={208}
                    className="rounded-xl border border-gray-200 p-2"
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/pagar/${qrDestino.token}`}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 truncate"
                  />
                  <button
                    onClick={async () => {
                      const link = `${window.location.origin}/pagar/${qrDestino.token}`;
                      await navigator.clipboard.writeText(link);
                      setQrCopied(true);
                      setTimeout(() => setQrCopied(false), 2000);
                    }}
                    className="px-3 py-2 bg-[#123b63] text-white rounded-lg text-xs font-semibold hover:bg-[#1a4f85] transition"
                  >
                    {qrCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Modal: Criar / Editar Destino ──────────────────────────── */}
          {showDestinoModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-gray-800">
                    {destinoEditId ? 'Editar Destino' : 'Novo Destino de Arrecadação'}
                  </h3>
                  <button onClick={() => { setShowDestinoModal(false); setDestinoEditId(null); }} className="p-1 rounded hover:bg-gray-100">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Label */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Nome/Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formDestino.label}
                      onChange={e => setFormDestino(p => ({ ...p, label: e.target.value }))}
                      placeholder="Ex.: Dízimo — Sede"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
                    />
                  </div>

                  {/* Tipo */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Recebimento <span className="text-red-500">*</span></label>
                    <select
                      value={formDestino.tipo_recebimento}
                      onChange={e => setFormDestino(p => ({ ...p, tipo_recebimento: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
                    >
                      {TIPOS_DESTINO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  {/* Congregação */}
                  {congregacoes.length > 0 && !scope.isFinanceiroLocal && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Congregação</label>
                      <select
                        value={formDestino.congregacao_id}
                        onChange={e => setFormDestino(p => ({ ...p, congregacao_id: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
                      >
                        <option value="">Sem congregação específica</option>
                        {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Conta destino */}
                  {contasFull.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Conta Destino</label>
                      <select
                        value={formDestino.conta_id}
                        onChange={e => setFormDestino(p => ({ ...p, conta_id: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
                      >
                        <option value="">Conta padrão</option>
                        {contasFull.filter(c => c.is_ativa).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Valor */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Valor Fixo (R$)</label>
                    <input
                      type="number"
                      value={formDestino.valor_fixo}
                      onChange={e => setFormDestino(p => ({ ...p, valor_fixo: e.target.value }))}
                      placeholder="Deixe vazio para valor aberto"
                      min="0.01"
                      step="0.01"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
                    />
                    <p className="text-xs text-gray-400 mt-1">Se vazio, o pagador informa o valor.</p>
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição (opcional)</label>
                    <textarea
                      value={formDestino.descricao}
                      onChange={e => setFormDestino(p => ({ ...p, descricao: e.target.value }))}
                      rows={2}
                      placeholder="Informações adicionais para o pagador"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
                    />
                  </div>

                  {/* Data de Expiração */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Expiração (opcional)</label>
                    <input
                      type="datetime-local"
                      value={formDestino.expires_at}
                      onChange={e => setFormDestino(p => ({ ...p, expires_at: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123b63]"
                    />
                    <p className="text-xs text-gray-400 mt-1">Se preenchida, o link será bloqueado após essa data.</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => void handleSaveDestino()}
                    disabled={savingDestino}
                    className="flex-1 py-2.5 bg-[#123b63] text-white rounded-xl text-sm font-semibold hover:bg-[#1a4f85] transition disabled:opacity-60"
                  >
                    {savingDestino ? 'Salvando...' : destinoEditId ? 'Salvar alterações' : 'Criar destino'}
                  </button>
                  <button
                    onClick={() => { setShowDestinoModal(false); setDestinoEditId(null); }}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Delete Destino ────────────────────────────────────────── */}
      {confirmDelDestino && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-800 mb-2">Excluir Destino de Arrecadação</h3>
            <p className="text-sm text-gray-600 mb-2">Esta ação não pode ser desfeita.</p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
              ⚠️ Cobranças PIX já geradas por este destino não serão afetadas, mas novos pagamentos não serão aceitos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => void handleDeleteDestino(confirmDelDestino)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Excluir
              </button>
              <button
                onClick={() => setConfirmDelDestino(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ─────────────────────────────────────────────────── */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-800 mb-2">Excluir Lançamento</h3>
            <p className="text-sm text-gray-600 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDel)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Excluir
              </button>
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification ──────────────────────────────────────────────────── */}
      <NotificationModal
        isOpen={modal.open}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal(p => ({ ...p, open: false }))}
      />
    </PageLayout>
  );
}
