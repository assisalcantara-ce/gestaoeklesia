'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { authenticatedFetch } from '@/lib/api-client';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import type { ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';

// Types
export interface Congregacao { id: string; nome: string; is_sede?: boolean }
export interface Departamento { id: string; nome: string; sigla?: string }
export interface Lancamento {
  id: string;
  data_lancamento: string;
  tipo_movimento: 'entrada' | 'saida';
  tipo_recebimento: string;
  valor: number;
  descricao?: string | null;
  referencia?: string | null;
  observacoes?: string | null;
  congregacao_id?: string | null;
  departamento_id?: string | null;
  conta_id?: string | null;
  categoria_id?: string | null;
  member_id?: string | null;
  congregacao_nome?: string;
  departamento_nome?: string;
}
export interface FinConta { id: string; nome: string; is_padrao?: boolean }
export interface FinCategoria { id: string; nome: string; icone?: string; tipo_movimento?: string }
export interface Fechamento {
  id: string;
  mes_referencia: string;
  saldo_inicial: number;
  entradas: number;
  saidas: number;
  saldo_final: number;
  status: string;
  congregacao_id?: string | null;
  created_at?: string;
  observacoes?: string;
}
export interface Dizimista {
  id: string;
  nome: string;
  congregacao_id?: string | null;
  congregacao_nome?: string;
}
export interface FinContaFull {
  id: string;
  nome: string;
  tipo: string;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  chave_pix?: string | null;
  saldo_inicial: number;
  is_padrao: boolean;
  is_ativa: boolean;
  congregacao_id?: string | null;
  departamento_id?: string | null;
}
export interface FinCategoriaFull {
  id: string;
  nome: string;
  tipo_movimento: 'entrada' | 'saida' | 'ambos';
  codigo?: string | null;
  cor?: string | null;
  icone?: string | null;
  categoria_pai_id?: string | null;
  descricao?: string | null;
  is_ativa: boolean;
  is_sistema: boolean;
}
export interface PaymentDestino {
  id: string;
  label: string;
  tipo_recebimento: string;
  congregacao_id?: string | null;
  conta_id?: string | null;
  categoria_id?: string | null;
  valor_fixo?: number | null;
  descricao?: string | null;
  token: string;
  is_ativo: boolean;
  expires_at?: string | null;
  total_arrecadado?: number;
  total_transacoes?: number;
}
export interface FinCobranca {
  id: string;
  txid: string;
  valor: number;
  status: 'PENDENTE' | 'CONCLUIDA' | 'EXPIRADA' | 'CANCELADA';
  pix_copia_cola?: string | null;
  payer_name?: string | null;
  payer_cpf?: string | null;
  paid_at?: string | null;
  created_at: string;
  destino_label?: string;
  congregacao_nome?: string;
}
export interface FinWebhookEvent {
  id: string;
  txid?: string | null;
  e2eid?: string | null;
  valor?: number | null;
  payload?: any;
  status_processamento: 'sucesso' | 'erro' | 'ignorado';
  erro_mensagem?: string | null;
  created_at: string;
}
export interface MesDados {
  mes: string;
  ano: number;
  entradas: number;
  saidas: number;
  saldo: number;
  totalAcumulado: number;
}

export type Aba = 'dashboard' | 'lancamentos' | 'relatorios' | 'fechamento' | 'dizimistas' | 'contas' | 'categorias' | 'arrecadacao';
export type SubAbaArrecadacao = 'destinos' | 'cobrancas' | 'webhooks';
export type TipoRecebimento = 'dizimo' | 'oferta' | 'oferta_especial' | 'outros';

export interface FormLanc {
  data_lancamento: string;
  tipo_movimento: 'entrada' | 'saida';
  tipo_recebimento: TipoRecebimento | '';
  categoria_saida: string;
  forma_pagamento: string;
  valor: string;
  referencia: string;
  observacoes: string;
  descricao: string;
  congregacao_id: string;
  departamento_id: string;
  conta_id: string;
  categoria_id: string;
  is_dizimo: boolean;
  dizimista_id?: string;
  dizimista_nome?: string;
  is_dizimo_avulso?: boolean;
}

export interface FormConta {
  nome: string;
  tipo: string;
  banco: string;
  agencia: string;
  conta: string;
  chave_pix: string;
  saldo_inicial: string;
  is_padrao: boolean;
  is_ativa: boolean;
  congregacao_id: string;
  departamento_id: string;
}

export interface FormCat {
  nome: string;
  tipo_movimento: 'entrada' | 'saida' | 'ambos';
  codigo: string;
  cor: string;
  icone: string;
  categoria_pai_id: string;
  is_ativa: boolean;
}

export interface FormDestino {
  label: string;
  tipo_recebimento: string;
  congregacao_id: string;
  conta_id: string;
  categoria_id: string;
  valor_fixo: string;
  descricao: string;
  expires_at: string;
}

export interface UserScope {
  isFinanceiroLocal: boolean;
  congregacaoId: string | null;
  canWrite: boolean;
  canDelete: boolean;
}

const emptyForm = (): FormLanc => ({
  data_lancamento: new Date().toISOString().split('T')[0],
  tipo_movimento: 'entrada',
  tipo_recebimento: 'oferta',
  categoria_saida: '',
  forma_pagamento: 'A VISTA',
  valor: '',
  referencia: '',
  observacoes: '',
  descricao: '',
  congregacao_id: '',
  departamento_id: '',
  conta_id: '',
  categoria_id: '',
  is_dizimo: false,
  dizimista_id: '',
  dizimista_nome: '',
  is_dizimo_avulso: false,
});

const emptyFormConta = (): FormConta => ({
  nome: '', tipo: 'conta_corrente', banco: '', agencia: '', conta: '',
  chave_pix: '', saldo_inicial: '0', is_padrao: false, is_ativa: true,
  congregacao_id: '', departamento_id: '',
});

const emptyFormCat = (): FormCat => ({
  nome: '', tipo_movimento: 'ambos', codigo: '', cor: '#6b7280',
  icone: '🏷️', categoria_pai_id: '', is_ativa: true,
});

const emptyFormDestino = (): FormDestino => ({
  label: '', tipo_recebimento: 'oferta', congregacao_id: '',
  conta_id: '', categoria_id: '', valor_fixo: '', descricao: '', expires_at: '',
});

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const TIPOS = [
  { value: 'dizimo', label: 'Dízimo' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'oferta_especial', label: 'Oferta Especial' },
  { value: 'outros', label: 'Outros' },
];

const TIPOS_SAIDA = [
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'energia', label: 'Energia Elétrica' },
  { value: 'agua', label: 'Água / Saneamento' },
  { value: 'internet', label: 'Internet / Telefone' },
  { value: 'manutencao', label: 'Manutenção / Reformas' },
  { value: 'equipamentos', label: 'Equipamentos / Som' },
  { value: 'preletor', label: 'Honorários / Preletor' },
  { value: 'social', label: 'Ação Social / Cestas' },
  { value: 'missoes', label: 'Missões / Oferta Missionária' },
  { value: 'eventos', label: 'Eventos / Congressos' },
  { value: 'material', label: 'Material de Expediente / Limpeza' },
  { value: 'impostos', label: 'Impostos / Taxas' },
  { value: 'outros_saida', label: 'Outras Despesas' },
];

const TIPOS_DESTINO = [
  { value: 'dizimo', label: 'Dízimo' },
  { value: 'oferta', label: 'Oferta Geral' },
  { value: 'oferta_especial', label: 'Oferta Especial' },
  { value: 'campanha', label: 'Campanha / Projeto' },
  { value: 'evento', label: 'Inscrição de Evento' },
  { value: 'outros', label: 'Outros' },
];

const TIPOS_CONTA = [
  { value: 'caixa', label: 'Caixa Físico' },
  { value: 'conta_corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'pix', label: 'Chave PIX' },
  { value: 'fundo', label: 'Fundo' },
  { value: 'outro', label: 'Outro' },
];

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function useTesouraria() {
  const { loading: authLoading } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('tesouraria');
  const planFeatures = usePlanFeatures();
  const supabase = useMemo(() => createClient(), []);

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [ministerio, setMinisterio] = useState<ConfiguracaoIgreja | null>(null);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [nomenclaturas, setNomenclaturas] = useState({
    divisao1: 'Congregação',
  });
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [lancamentos] = useState<Lancamento[]>([]);
  const [finContas, setFinContas] = useState<FinConta[]>([]);
  const [finCategorias, setFinCategorias] = useState<FinCategoria[]>([]);
  const [scope, setScope] = useState<UserScope>({
    isFinanceiroLocal: false, congregacaoId: null, canWrite: true, canDelete: true,
  });

  const [loadingData, setLoadingData] = useState(true);
  const [aba, setAba] = useState<Aba>('dashboard');

  // Fechamentos
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [abaFechaMes, setAbaFechaMes] = useState(mesAtual());
  const [showFechaModal, setShowFechaModal] = useState(false);
  const [fechaObs, setFechaObs] = useState('');
  const [fechaSaldoInicial, setFechaSaldoInicial] = useState('');
  const [fechaDataInicio, setFechaDataInicio] = useState('');
  const [fechaDataFim, setFechaDataFim] = useState('');
  const [salvandoFecha, setSalvandoFecha] = useState(false);
  const [fechaCongId, setFechaCongId] = useState<string | null>(null);

  // Dizimistas
  const [dizimistasMembros, setDizimistasMembros] = useState<any[]>([]);
  const [loadingDizimistas, setLoadingDizimistas] = useState(false);
  const [abaDizimistaMes, setAbaDizimistaMes] = useState(mesAtual());
  const [filtroNomeDiz, setFiltroNomeDiz] = useState('');
  const [filtroStatusDiz, setFiltroStatusDiz] = useState<'' | 'pago' | 'pendente'>('');
  const [filtroCongDiz, setFiltroCongDiz] = useState('');

  // Filtros
  const [filtroCong, setFiltroCong] = useState('');
  const [filtroDept, setFiltroDept] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroMovimento, setFiltroMovimento] = useState<'' | 'entrada' | 'saida'>('');
  const [filtroMes, setFiltroMes] = useState(mesAtual());
  const [loadingMes, setLoadingMes] = useState(false);
  const [lancamentosMes, setLancamentosMes] = useState<Lancamento[]>([]);

  // Relatórios
  const [relMes, setRelMes] = useState(mesAtual());
  const [relCong, setRelCong] = useState('');
  const [relDept, setRelDept] = useState('');
  const [relMostrarDet, setRelMostrarDet] = useState(false);
  const [relTipoRel, setRelTipoRel] = useState<'entradas' | 'saidas' | 'ambos'>('entradas');
  const [relFiltroPeriodo, setRelFiltroPeriodo] = useState<'mes' | 'custom'>('mes');
  const [relDataInicio, setRelDataInicio] = useState('');
  const [relDataFim, setRelDataFim] = useState('');

  // Contas (CRUD)
  const [contasFull] = useState<FinContaFull[]>([]);
  const [loadingContas] = useState(false);
  const [showContaModal, setShowContaModal] = useState(false);
  const [contaEditId, setContaEditId] = useState<string | null>(null);
  const [formConta, setFormConta] = useState<FormConta>(emptyFormConta());
  const [savingConta, setSavingConta] = useState(false);
  const [confirmDelConta, setConfirmDelConta] = useState<string | null>(null);

  // Categorias (CRUD)
  const [categoriasFull] = useState<FinCategoriaFull[]>([]);
  const [loadingCats] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [formCat, setFormCat] = useState<FormCat>(emptyFormCat());
  const [savingCat, setSavingCat] = useState(false);
  const [confirmDelCat, setConfirmDelCat] = useState<string | null>(null);
  const [filtroCatTipo, setFiltroCatTipo] = useState<'' | 'entrada' | 'saida' | 'ambos'>('');

  // Formulário
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormLanc>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
    open: false, title: '', message: '', type: 'success',
  });

  // Arrecadação Digital
  const [destinos] = useState<PaymentDestino[]>([]);
  const [loadingDestinos] = useState(false);
  const [showDestinoModal, setShowDestinoModal] = useState(false);
  const [destinoEditId, setDestinoEditId] = useState<string | null>(null);
  const [formDestino, setFormDestino] = useState<FormDestino>(emptyFormDestino());
  const [savingDestino] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDestino, setQrDestino] = useState<{ token: string; label: string } | null>(null);
  const [filtroDestinoStatus, setFiltroDestinoStatus] = useState<'' | 'ativo' | 'inativo'>('');
  const [filtroDestinoTipo, setFiltroDestinoTipo] = useState('');
  const [filtroDestinoCong, setFiltroDestinoCong] = useState('');
  const [qrCopied, setQrCopied] = useState(false);
  const [confirmDelDestino, setConfirmDelDestino] = useState<string | null>(null);

  // Arrecadação sub-abas
  const [subAbaArr, setSubAbaArr] = useState<SubAbaArrecadacao>('destinos');
  const [gatewayAtivo] = useState<boolean | null>(null);
  const [cobrancas] = useState<FinCobranca[]>([]);
  const [loadingCobrancas] = useState(false);
  const [cobrFiltroStatus, setCobrFiltroStatus] = useState('');
  const [cobrFiltroDestino, setCobrFiltroDestino] = useState('');
  const [cobrFiltroCong, setCobrFiltroCong] = useState('');
  const [cobrFiltroStart, setCobrFiltroStart] = useState('');
  const [cobrFiltroEnd, setCobrFiltroEnd] = useState('');
  const [webhookEvents] = useState<FinWebhookEvent[]>([]);
  const [loadingWebhooks] = useState(false);
  const [webhookFiltroProcessado, setWebhookFiltroProcessado] = useState<'' | 'sim' | 'nao'>('');

  // Gráficos
  const [dadosGrafico] = useState<MesDados[]>([]);
  const [periodoGrafico, setPeriodoGrafico] = useState<'6' | '12' | 'ano'>('12');

  const showModal = useCallback((title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setModal({ open: true, title, message, type });
  }, []);

  const resetDizForm = useCallback(() => {}, []);

  // Formatadores
  const fmtBRL = useCallback((val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  }, []);

  const fmtDate = useCallback((dateStr: string) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }, []);

  const tipoLabel = useCallback((tipo: string) => {
    const found = TIPOS.find(t => t.value === tipo);
    return found ? found.label : tipo;
  }, []);

  const tipoCor = useCallback((tipo: string) => {
    switch (tipo) {
      case 'dizimo': return 'bg-blue-100 text-blue-800';
      case 'oferta': return 'bg-[#123b63]/10 text-[#123b63]';
      case 'oferta_especial': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const congNome = useCallback((id?: string | null) => {
    if (!id) return 'Sede / Ministério geral';
    const found = congregacoes.find(c => c.id === id);
    return found ? found.nome : 'Outra congregação';
  }, [congregacoes]);

  // Carregamento de dados iniciais
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingData(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const resolvedMid = await resolveMinistryId(supabase);
        if (resolvedMid) {
          setMinistryId(resolvedMid);
        }

        const mData = await fetchConfiguracaoIgrejaFromSupabase();
        if (mData) {
          setMinisterio(mData);
        }

        const userRes = await authenticatedFetch('/api/v1/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          const userRole = String(userData.role ?? '').toLowerCase().trim();
          const cId = userData.congregacao_id ?? null;
          const isFinLocal = userRole === 'financeiro_local' || userRole === 'tesouraria_local';
          const isManagerOrAdmin = !userRole || ['super_admin', 'admin', 'administrador', 'tesoureiro_sede', 'tesoureiro_geral', 'financeiro'].includes(userRole);

          setScope({
            isFinanceiroLocal: isFinLocal,
            congregacaoId: cId,
            canWrite: isManagerOrAdmin || isFinLocal,
            canDelete: isManagerOrAdmin,
          });
        }

        // Carrega 1ª Divisão (Caixas / Congregações / Unidades) e Nomenclaturas via EstruturaOrganizacionalService
        const orgService = await obterEstruturaOrganizacionalService(resolvedMid || session.user.id, supabase);
        const labels = orgService.getLabels();
        setNomenclaturas({
          divisao1: labels.nomeDivisao1,
        });

        const div1Options = orgService.getOptionsFormatadas(1);
        setCongregacoes(div1Options.map((opt) => ({ id: opt.id, nome: opt.nome, is_sede: false })));

        // Carrega Departamentos diretamente via Supabase
        const { data: dData } = await supabase
          .from('departamentos')
          .select('id, nome, sigla')
          .order('nome');
        if (dData) {
          setDepartamentos(dData);
        }

        // Carrega Contas, Categorias e Fechamentos anteriores via Supabase
        const [contasRes, catsRes, fechamentosRes] = await Promise.all([
          supabase.from('fin_contas').select('*').eq('is_ativa', true).order('nome'),
          supabase.from('fin_categorias').select('*').eq('is_ativa', true).order('nome'),
          supabase.from('tesouraria_fechamentos').select('*').eq('ministry_id', resolvedMid || session.user.id).order('created_at', { ascending: false }),
        ]);

        if (contasRes.data) {
          setFinContas(contasRes.data);
        }
        if (catsRes.data) {
          setFinCategorias(catsRes.data);
        }
        if (fechamentosRes.data) {
          setFechamentos(fechamentosRes.data);
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados iniciais:', err);
      } finally {
        setLoadingData(false);
      }
    };

    if (!authLoading && !bloqueado) {
      init();
    }
  }, [authLoading, bloqueado, supabase]);

  // Auxiliar para calcular próximo mês
  const mesProximo = useCallback((mesStr: string) => {
    const [y, m] = mesStr.split('-').map(Number);
    if (m === 12) return `${y + 1}-01`;
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  }, []);

  // Carregar lançamentos do mês selecionado via Supabase Client
  const loadLancamentosMes = useCallback(async (mes: string) => {
    if (!ministryId) return;
    try {
      setLoadingMes(true);
      let q = supabase
        .from('tesouraria_lancamentos')
        .select('*, congregacoes(nome), departamentos(nome, sigla)')
        .eq('ministry_id', ministryId)
        .gte('data_lancamento', `${mes}-01`)
        .lt('data_lancamento', `${mesProximo(mes)}-01`);

      if (scope.isFinanceiroLocal && scope.congregacaoId) {
        q = q.eq('congregacao_id', scope.congregacaoId);
      }

      const { data, error } = await q;
      if (error) {
        console.error('Erro ao buscar lançamentos do mês:', error);
      } else if (data) {
        const formatados: Lancamento[] = data.map((item: any) => ({
          ...item,
          congregacao_nome: item.congregacoes?.nome ?? 'Sede / Geral',
          departamento_nome: item.departamentos?.nome ?? item.departamentos?.sigla ?? '—',
        }));
        setLancamentosMes(formatados);
      }
    } catch (err) {
      console.error('Erro ao carregar lançamentos do mês:', err);
    } finally {
      setLoadingMes(false);
    }
  }, [ministryId, scope, supabase, mesProximo]);

  useEffect(() => {
    if (ministryId) {
      loadLancamentosMes(filtroMes);
    }
  }, [filtroMes, ministryId, loadLancamentosMes]);

  // Buscar lançamentos quando o mês de referência do Relatório (relMes) alterar
  const [lancamentosRelMes, setLancamentosRelMes] = useState<Lancamento[]>([]);

  const loadLancamentosRelatorio = useCallback(async (mes: string) => {
    if (!ministryId) return;
    try {
      let q = supabase
        .from('tesouraria_lancamentos')
        .select('*, congregacoes(nome), departamentos(nome, sigla)')
        .eq('ministry_id', ministryId)
        .gte('data_lancamento', `${mes}-01`)
        .lt('data_lancamento', `${mesProximo(mes)}-01`);

      if (scope.isFinanceiroLocal && scope.congregacaoId) {
        q = q.eq('congregacao_id', scope.congregacaoId);
      }

      const { data, error } = await q;
      if (error) {
        console.error('Erro ao buscar lançamentos do relatório:', error);
      } else if (data) {
        const formatados: Lancamento[] = data.map((item: any) => ({
          ...item,
          congregacao_nome: item.congregacoes?.nome ?? 'Sede / Geral',
          departamento_nome: item.departamentos?.nome ?? item.departamentos?.sigla ?? '—',
        }));
        setLancamentosRelMes(formatados);
      }
    } catch (err) {
      console.error('Erro ao carregar lançamentos do relatório:', err);
    }
  }, [ministryId, scope, supabase, mesProximo]);

  useEffect(() => {
    if (ministryId && aba === 'relatorios') {
      loadLancamentosRelatorio(relMes);
    }
  }, [relMes, ministryId, aba, loadLancamentosRelatorio]);

  // Carregar lista de Dizimistas (Membros com is_dizimista=true OU tipo_cadastro='ministro')
  const loadDizimistasData = useCallback(async () => {
    if (!ministryId) return;
    try {
      setLoadingDizimistas(true);
      // Buscar membros dizimistas ou ministros
      const { data: membersData, error: memErr } = await supabase
        .from('members')
        .select('id, name, tipo_cadastro, is_dizimista, congregacao_id, congregacoes(nome)')
        .eq('ministry_id', ministryId)
        .or('is_dizimista.eq.true,tipo_cadastro.eq.ministro');

      if (memErr) {
        console.error('Erro ao carregar membros dizimistas:', memErr);
      } else if (membersData) {
        setDizimistasMembros(membersData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de dizimistas:', err);
    } finally {
      setLoadingDizimistas(false);
    }
  }, [ministryId, supabase]);

  useEffect(() => {
    if (ministryId) {
      loadDizimistasData();
    }
  }, [ministryId, loadDizimistasData]);

  useEffect(() => {
    if (ministryId && aba === 'dizimistas') {
      loadLancamentosMes(abaDizimistaMes);
    }
  }, [aba, abaDizimistaMes, ministryId, loadLancamentosMes]);

  // Cruzar membros dizimistas com os lançamentos de dízimo do mês selecionado (abaDizimistaMes)
  const dizimistasCompletos = useMemo(() => {
    return dizimistasMembros.map((m: any) => {
      const nomeLower = (m.name || '').toLowerCase().trim();

      // Procurar lançamento de dízimo no mês com o nome do membro no observacoes/referencia ou congregacao
      const lancDizimo = lancamentosMes.find((l) => {
        if (l.tipo_recebimento !== 'dizimo' && l.tipo_movimento !== 'entrada') return false;
        const obsLower = (l.observacoes || '').toLowerCase();
        const refLower = (l.referencia || '').toLowerCase();
        const descLower = (l.descricao || '').toLowerCase();
        return obsLower.includes(nomeLower) || refLower.includes(nomeLower) || descLower.includes(nomeLower);
      });

      return {
        id: m.id,
        nome: m.name,
        tipoCadastro: m.tipo_cadastro || 'membro',
        congregacaoId: m.congregacao_id,
        congregacaoNome: m.congregacoes?.nome || 'Sede / Geral',
        pagoNoMes: !!lancDizimo,
        valorPago: lancDizimo ? Number(lancDizimo.valor) : 0,
        dataPagamento: lancDizimo ? lancDizimo.data_lancamento : null,
      };
    });
  }, [dizimistasMembros, lancamentosMes]);

  // Lista de dizimistas filtrada por Nome, Congregação e Status (Adimplente/Inadimplente)
  const dizimistasFiltrados = useMemo(() => {
    return dizimistasCompletos.filter((d) => {
      if (filtroNomeDiz && !d.nome.toLowerCase().includes(filtroNomeDiz.toLowerCase())) return false;
      if (filtroCongDiz && d.congregacaoId !== filtroCongDiz) return false;
      if (filtroStatusDiz === 'pago' && !d.pagoNoMes) return false;
      if (filtroStatusDiz === 'pendente' && d.pagoNoMes) return false;
      return true;
    });
  }, [dizimistasCompletos, filtroNomeDiz, filtroCongDiz, filtroStatusDiz]);

  // Lançamentos filtrados para o Relatório
  const lancsRelatorioFiltrados = useMemo(() => {
    return lancamentosRelMes.filter(l => {
      // Filtro de Congregação/Caixa do Relatório
      if (relCong && l.congregacao_id !== relCong) return false;
      // Filtro de Departamento do Relatório
      if (relDept && l.departamento_id !== relDept) return false;
      // Filtro de Tipo de Movimento do Relatório (entradas / saidas / ambos)
      if (relTipoRel === 'entradas' && l.tipo_movimento !== 'entrada') return false;
      if (relTipoRel === 'saidas' && l.tipo_movimento !== 'saida') return false;
      return true;
    });
  }, [lancamentosRelMes, relCong, relDept, relTipoRel]);

  const entradasRelatorio = useMemo(() => {
    return lancsRelatorioFiltrados.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
  }, [lancsRelatorioFiltrados]);

  const saidasRelatorio = useMemo(() => {
    return lancsRelatorioFiltrados.filter(l => l.tipo_movimento === 'saida').reduce((s, l) => s + Number(l.valor), 0);
  }, [lancsRelatorioFiltrados]);

  // Lançamentos filtrados
  const lancsFiltrados = useMemo(() => {
    return lancamentosMes.filter(l => {
      if (filtroMovimento && l.tipo_movimento !== filtroMovimento) return false;
      if (filtroTipo && l.tipo_recebimento !== filtroTipo) return false;
      if (filtroCong && l.congregacao_id !== filtroCong) return false;
      if (filtroDept && l.departamento_id !== filtroDept) return false;
      return true;
    });
  }, [lancamentosMes, filtroMovimento, filtroTipo, filtroCong, filtroDept]);

  const entradasFiltradas = useMemo(() => {
    return lancsFiltrados.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
  }, [lancsFiltrados]);

  const saidasFiltradas = useMemo(() => {
    return lancsFiltrados.filter(l => l.tipo_movimento === 'saida').reduce((s, l) => s + Number(l.valor), 0);
  }, [lancsFiltrados]);

  // Handlers CRUD Lançamento
  const handleEdit = useCallback((l: Lancamento) => {
    setEditId(l.id);
    setForm({
      data_lancamento: l.data_lancamento,
      tipo_movimento: l.tipo_movimento,
      tipo_recebimento: (l.tipo_recebimento as TipoRecebimento) || 'dizimo',
      categoria_saida: l.tipo_recebimento || '',
      forma_pagamento: (l as any).forma_pagamento || 'A VISTA',
      valor: Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      referencia: l.referencia || '',
      observacoes: l.observacoes || '',
      descricao: l.descricao || '',
      congregacao_id: l.congregacao_id || '',
      departamento_id: l.departamento_id || '',
      conta_id: l.conta_id || '',
      categoria_id: l.categoria_id || '',
      is_dizimo: l.tipo_recebimento === 'dizimo',
    });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.data_lancamento || !form.valor) {
      showModal('Campos obrigatórios', 'Preencha valor e data.', 'error');
      return;
    }
    const valClean = form.valor.replace(/\./g, '').replace(',', '.');
    const valNum = parseFloat(valClean);
    if (isNaN(valNum) || valNum <= 0) {
      showModal('Valor inválido', 'Informe um valor maior que zero.', 'error');
      return;
    }

    try {
      setSaving(true);

      let obsFinal = form.observacoes || form.descricao || '';
      if (form.tipo_recebimento === 'dizimo') {
        if (form.is_dizimo_avulso) {
          if (!obsFinal.toLowerCase().includes('avulso')) {
            obsFinal = obsFinal ? `Dízimo Avulso — ${obsFinal}` : 'Dízimo Avulso';
          }
        } else if (form.dizimista_nome && !obsFinal.toLowerCase().includes(form.dizimista_nome.toLowerCase())) {
          obsFinal = obsFinal ? `Dízimo de ${form.dizimista_nome} — ${obsFinal}` : `Dízimo de ${form.dizimista_nome}`;
        }
      }

      const payload = {
        data_lancamento: form.data_lancamento,
        tipo_movimento: form.tipo_movimento,
        tipo_recebimento: form.tipo_movimento === 'entrada' ? form.tipo_recebimento : form.categoria_saida,
        valor: valNum,
        referencia: form.referencia || (form.dizimista_nome ? `Dízimo: ${form.dizimista_nome}` : null),
        observacoes: obsFinal || null,
        descricao: obsFinal || null,
        congregacao_id: form.congregacao_id || null,
        departamento_id: form.departamento_id || null,
        conta_id: form.conta_id || null,
        categoria_id: form.categoria_id || null,
      };

      const url = editId ? `/api/v1/tesouraria/lancamentos?id=${editId}` : '/api/v1/tesouraria/lancamentos';
      const method = editId ? 'PUT' : 'POST';
      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        showModal('Erro', errJson.error ?? 'Falha ao salvar lançamento.', 'error');
        return;
      }

      showModal('Sucesso!', editId ? 'Lançamento atualizado.' : 'Lançamento registrado.');
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      resetDizForm();
      loadLancamentosMes(filtroMes);
    } catch (err: any) {
      showModal('Erro', err.message, 'error');
    } finally {
      setSaving(false);
    }
  }, [form, editId, showModal, resetDizForm, loadLancamentosMes, filtroMes]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/v1/tesouraria/lancamentos?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        showModal('Erro', json.error ?? 'Falha ao excluir.', 'error');
        return;
      }
      showModal('Excluído!', 'Lançamento removido com sucesso.');
      setConfirmDel(null);
      loadLancamentosMes(filtroMes);
    } catch (err: any) {
      showModal('Erro', err.message, 'error');
    }
  }, [showModal, loadLancamentosMes, filtroMes]);

  // Status mensal para fechamento
  const statusMes = useMemo(() => {
    return congregacoes.map(c => ({ id: c.id, nome: c.nome, fechAnt: null }));
  }, [congregacoes]);

  // Fechamento de Caixa
  const handleFecharMes = useCallback(async () => {
    try {
      setSalvandoFecha(true);
      const cxModal = statusMes.find(cx => cx.id === fechaCongId) ?? statusMes[0];
      const saldoIniNum = parseFloat(fechaSaldoInicial.replace(',', '.')) || 0;
      const doPeriodo = lancamentos.filter(l =>
        l.data_lancamento >= fechaDataInicio &&
        l.data_lancamento <= fechaDataFim &&
        (cxModal?.id === null ? l.congregacao_id === null : l.congregacao_id === cxModal?.id)
      );
      const entLivePeriodo = doPeriodo.filter(l => l.tipo_movimento === 'entrada').reduce((s, l) => s + Number(l.valor), 0);
      const saiLivePeriodo = doPeriodo.filter(l => l.tipo_movimento === 'saida').reduce((s, l) => s + Number(l.valor), 0);
      const saldoFinalModal = saldoIniNum + entLivePeriodo - saiLivePeriodo;

      const payload = {
        mes_referencia: fechaDataFim.substring(0, 7),
        congregacao_id: fechaCongId,
        saldo_inicial: saldoIniNum,
        entradas: entLivePeriodo,
        saidas: saiLivePeriodo,
        saldo_final: saldoFinalModal,
        observacoes: fechaObs,
      };

      const res = await authenticatedFetch('/api/v1/tesouraria/fechamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        showModal('Erro', json.error ?? 'Falha ao fechar mês.', 'error');
        return;
      }

      showModal('Caixa Fechado!', 'O período financeiro foi encerrado.');
      setShowFechaModal(false);
      setFechaCongId(null);
    } catch (err: any) {
      showModal('Erro', err.message, 'error');
    } finally {
      setSalvandoFecha(false);
    }
  }, [fechaCongId, fechaSaldoInicial, fechaDataInicio, fechaDataFim, fechaObs, lancamentos, showModal, statusMes]);

  // Handlers Contas
  const handleSaveConta = useCallback(async () => {
    if (!formConta.nome.trim()) {
      showModal('Campo obrigatório', 'Informe o nome da conta.', 'error');
      return;
    }
    try {
      setSavingConta(true);
      const url = contaEditId ? `/api/v1/tesouraria/contas?id=${contaEditId}` : '/api/v1/tesouraria/contas';
      const method = contaEditId ? 'PUT' : 'POST';
      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formConta),
      });
      if (!res.ok) {
        const json = await res.json();
        showModal('Erro', json.error ?? 'Falha ao salvar conta.', 'error');
        return;
      }
      showModal('Sucesso!', contaEditId ? 'Conta atualizada.' : 'Conta criada.');
      setShowContaModal(false);
      setContaEditId(null);
      setFormConta(emptyFormConta());
    } catch (err: any) {
      showModal('Erro', err.message, 'error');
    } finally {
      setSavingConta(false);
    }
  }, [formConta, contaEditId, showModal]);

  const handleDeleteConta = useCallback(async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/v1/tesouraria/contas?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        showModal('Erro', json.error ?? 'Falha ao excluir conta.', 'error');
        return;
      }
      showModal('Excluída!', 'Conta removida.');
      setConfirmDelConta(null);
    } catch (err: any) {
      showModal('Erro', err.message, 'error');
    }
  }, [showModal]);

  // Handlers Categorias
  const handleSaveCat = useCallback(async () => {
    if (!formCat.nome.trim()) {
      showModal('Campo obrigatório', 'Informe o nome da categoria.', 'error');
      return;
    }
    try {
      setSavingCat(true);
      const url = catEditId ? `/api/v1/tesouraria/categorias?id=${catEditId}` : '/api/v1/tesouraria/categorias';
      const method = catEditId ? 'PUT' : 'POST';
      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formCat),
      });
      if (!res.ok) {
        const json = await res.json();
        showModal('Erro', json.error ?? 'Falha ao salvar categoria.', 'error');
        return;
      }
      showModal('Sucesso!', catEditId ? 'Categoria atualizada.' : 'Categoria criada.');
      setShowCatModal(false);
      setCatEditId(null);
      setFormCat(emptyFormCat());
    } catch (err: any) {
      showModal('Erro', err.message, 'error');
    } finally {
      setSavingCat(false);
    }
  }, [formCat, catEditId, showModal]);

  const handleDeleteCat = useCallback(async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/v1/tesouraria/categorias?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        showModal('Erro', json.error ?? 'Falha ao excluir categoria.', 'error');
        return;
      }
      showModal('Excluída!', 'Categoria removida.');
      setConfirmDelCat(null);
    } catch (err: any) {
      showModal('Erro', err.message, 'error');
    }
  }, [showModal]);

  // Exportar CSV
  const exportarCSV = useCallback((dados: any[], filename: string) => {
    if (!dados || dados.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    const emItem = dados[0];
    if (emItem.data_lancamento !== undefined) {
      headers = ['Data', 'Tipo Movimento', 'Tipo Recebimento / Categoria', 'Valor', 'Congregação', 'Departamento', 'Referência', 'Observações'];
      rows = dados.map((l: Lancamento) => [
        l.data_lancamento,
        l.tipo_movimento === 'entrada' ? 'Entrada' : 'Saída',
        l.tipo_recebimento || '',
        Number(l.valor).toFixed(2),
        l.congregacao_nome || '',
        l.departamento_nome || '',
        `"${(l.referencia || '').replace(/"/g, '""')}"`,
        `"${(l.observacoes || '').replace(/"/g, '""')}"`,
      ]);
    } else {
      headers = Object.keys(emItem);
      rows = dados.map((item) =>
        Object.values(item).map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
      );
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    authLoading,
    bloqueado,
    planFeatures,
    ministryId,
    ministerio,
    congregacoes,
    departamentos,
    lancamentos,
    finContas,
    finCategorias,
    scope,
    loadingData,
    aba,
    setAba,
    // Fechamentos
    fechamentos,
    abaFechaMes,
    setAbaFechaMes,
    showFechaModal,
    setShowFechaModal,
    fechaObs,
    setFechaObs,
    fechaSaldoInicial,
    setFechaSaldoInicial,
    fechaDataInicio,
    setFechaDataInicio,
    fechaDataFim,
    setFechaDataFim,
    salvandoFecha,
    fechaCongId,
    setFechaCongId,
    handleFecharMes,
    statusMes,
    // Dizimistas
    dizimistasFiltrados,
    loadingDizimistas,
    abaDizimistaMes,
    setAbaDizimistaMes,
    filtroNomeDiz,
    setFiltroNomeDiz,
    filtroStatusDiz,
    setFiltroStatusDiz,
    filtroCongDiz,
    setFiltroCongDiz,
    // Filtros & Lançamentos
    filtroCong,
    setFiltroCong,
    filtroDept,
    setFiltroDept,
    filtroTipo,
    setFiltroTipo,
    filtroMovimento,
    setFiltroMovimento,
    filtroMes,
    setFiltroMes,
    loadingMes,
    lancamentosMes,
    lancsFiltrados,
    entradasFiltradas,
    saidasFiltradas,
    // Relatórios
    relMes,
    setRelMes,
    relCong,
    setRelCong,
    relDept,
    setRelDept,
    relMostrarDet,
    setRelMostrarDet,
    relTipoRel,
    setRelTipoRel,
    relFiltroPeriodo,
    setRelFiltroPeriodo,
    relDataInicio,
    setRelDataInicio,
    relDataFim,
    setRelDataFim,
    lancsRelatorioFiltrados,
    entradasRelatorio,
    saidasRelatorio,
    // Contas CRUD
    contasFull,
    loadingContas,
    showContaModal,
    setShowContaModal,
    contaEditId,
    setContaEditId,
    formConta,
    setFormConta,
    savingConta,
    confirmDelConta,
    setConfirmDelConta,
    handleSaveConta,
    handleDeleteConta,
    emptyFormConta,
    TIPOS_CONTA,
    // Categorias CRUD
    categoriasFull,
    loadingCats,
    showCatModal,
    setShowCatModal,
    catEditId,
    setCatEditId,
    formCat,
    setFormCat,
    savingCat,
    confirmDelCat,
    setConfirmDelCat,
    filtroCatTipo,
    setFiltroCatTipo,
    handleSaveCat,
    handleDeleteCat,
    emptyFormCat,
    // Formulário Lançamento
    showForm,
    setShowForm,
    form,
    setForm,
    editId,
    setEditId,
    saving,
    confirmDel,
    setConfirmDel,
    handleEdit,
    handleSave,
    handleDelete,
    emptyForm,
    resetDizForm,
    // Arrecadação Digital
    destinos,
    loadingDestinos,
    showDestinoModal,
    setShowDestinoModal,
    destinoEditId,
    setDestinoEditId,
    formDestino,
    setFormDestino,
    savingDestino,
    showQrModal,
    setShowQrModal,
    qrDestino,
    setQrDestino,
    filtroDestinoStatus,
    setFiltroDestinoStatus,
    filtroDestinoTipo,
    setFiltroDestinoTipo,
    filtroDestinoCong,
    setFiltroDestinoCong,
    qrCopied,
    setQrCopied,
    confirmDelDestino,
    setConfirmDelDestino,
    subAbaArr,
    setSubAbaArr,
    gatewayAtivo,
    cobrancas,
    loadingCobrancas,
    cobrFiltroStatus,
    setCobrFiltroStatus,
    cobrFiltroDestino,
    setCobrFiltroDestino,
    cobrFiltroCong,
    setCobrFiltroCong,
    cobrFiltroStart,
    setCobrFiltroStart,
    cobrFiltroEnd,
    setCobrFiltroEnd,
    webhookEvents,
    loadingWebhooks,
    webhookFiltroProcessado,
    setWebhookFiltroProcessado,
    // Gráficos
    dadosGrafico,
    periodoGrafico,
    setPeriodoGrafico,
    // Modais & Utilitários
    modal,
    setModal,
    showModal,
    fmtBRL,
    fmtDate,
    tipoLabel,
    tipoCor,
    congNome,
    nomenclaturas,
    exportarCSV,
    MESES,
    TIPOS,
    TIPOS_SAIDA,
    TIPOS_DESTINO,
  };
}
