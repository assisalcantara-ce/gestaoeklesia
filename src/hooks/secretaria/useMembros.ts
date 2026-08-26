'use client';

import { useState, useEffect, useRef } from 'react';
import { useMembers } from '@/hooks/useMembers';
import { useUserContext } from '@/hooks/useUserContext';
import { getCargosMinisteriais, type CargoMinisterial } from '@/lib/cargos-utils';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { getMensagemSemTemplate } from '@/lib/cartoes-utils';
import { createClient } from '@/lib/supabase-client';
import { loadTemplatesForCurrentUser } from '@/lib/cartoes-templates-sync';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Membro {
  id: string;
  uniqueId: string;
  matricula: string;
  nome: string;
  cpf: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';
  supervisao: string;
  campo: string;
  congregacao: string;
  status: 'ativo' | 'inativo';
  dataNascimento?: string;
  sexo?: string;
  tipoSanguineo?: string;
  escolaridade?: string;
  estadoCivil?: string;
  nomeConjuge?: string;
  cpfConjuge?: string;
  dataNascimentoConjuge?: string;
  nomePai?: string;
  nomeMae?: string;
  rg?: string;
  orgaoEmissor?: string;
  nacionalidade?: string;
  naturalidade?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  latitude?: string;
  longitude?: string;
  email?: string;
  celular?: string;
  whatsapp?: string;
  profissao?: string;
  tituloEleitoral?: string;
  zonaEleitoral?: string;
  secaoEleitoral?: string;
  observacoes?: string;
  fotoUrl?: string;
  temFuncaoIgreja?: boolean;
  qualFuncao?: string;
  setorDepartamento?: string;
  dataBatismoAguas?: string;
  dataBatismoEspiritoSanto?: string;
  cursoTeologico?: string;
  instituicaoTeologica?: string;
  pastorAuxiliar?: boolean;
  procedencia?: string;
  procedenciaLocal?: string;
  cargoMinisterial?: string;
  dataConsagracao?: string;
  dataEmissao?: string;
  dataValidadeCredencial?: string;
  dadosCargos?: {
    [key: string]: {
      dataConsagracaoRecebimento: string;
      localConsagracao: string;
      localOrigem: string;
    };
  };
  observacoesMinisteriais?: string;
  isDizimista?: boolean;
}

export interface DivisaoOption {
  id: string;
  nome: string;
  supervisao_id?: string | null;
  campo_id?: string | null;
}

export interface DadosPessoaisState {
  matricula: string;
  cpf: string;
  tipoCadastro: Membro['tipoCadastro'];
  nome: string;
  dataNascimento: string;
  sexo: string;
  tipoSanguineo: string;
  escolaridade: string;
  estadoCivil: string;
  nomeConjuge: string;
  cpfConjuge: string;
  dataNascimentoConjuge: string;
  nomePai: string;
  nomeMae: string;
  rg: string;
  orgaoEmissor: string;
  nacionalidade: string;
  naturalidade: string;
  uf: string;
  supervisao: string;
  campo: string;
  congregacao: string;
  email: string;
  celular: string;
  whatsapp: string;
  profissao: string;
  tituloEleitoral: string;
  zonaEleitoral: string;
  secaoEleitoral: string;
  observacoes: string;
}

export type MembrosFormTab = 'dados' | 'endereco' | 'ministerial' | 'foto' | 'dizimos';

// ─── Helpers puros (sem estado) ────────────────────────────────────────────────

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatCpf = (cpf: string) => {
  const digits = onlyDigits(cpf).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const maskCpf = (cpf: string) => {
  const digits = onlyDigits(cpf).slice(0, 11);
  if (!digits) return '-';
  if (digits.length < 11) return formatCpf(digits).replace(/\d/g, '*');
  return formatCpf(digits).replace(/^(\d{3})\.\d{3}\.\d{3}-(\d{2})$/, '$1.***.***-$2');
};

const normalizeTipoCadastro = (value: any): Membro['tipoCadastro'] => {
  const v = String(value || '').toLowerCase();
  if (v === 'membro' || v === 'congregado' || v === 'ministro' || v === 'crianca') return v as any;
  return 'ministro';
};

const dbStatusToUi = (status: any): Membro['status'] =>
  status === 'active' ? 'ativo' : 'inativo';

const uiStatusToDb = (status: Membro['status']): string =>
  status === 'ativo' ? 'active' : 'inactive';

const gerarUniqueId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const validarCPF = (cpf: string): boolean => {
  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;
  if (cpfLimpo.startsWith('123456789')) return true;

  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(10, 11))) return false;

  return true;
};


const hasActiveTemplate = (tipoCadastro: string, templatesBase: any[]) => {
  const tipo = (tipoCadastro || '').toLowerCase() === 'crianca' ? 'membro' : tipoCadastro;
  return templatesBase.some((t: any) => {
    const tTipo = (t.tipoCadastro || t.tipo || '').toLowerCase();
    return tTipo === tipo && t.ativo === true;
  });
};

// ─── Estados iniciais ──────────────────────────────────────────────────────────

const DADOS_PESSOAIS_INICIAL: DadosPessoaisState = {
  matricula: '',
  cpf: '',
  tipoCadastro: 'membro',
  nome: '',
  dataNascimento: '',
  sexo: 'MASCULINO',
  tipoSanguineo: '',
  escolaridade: '',
  estadoCivil: '',
  nomeConjuge: '',
  cpfConjuge: '',
  dataNascimentoConjuge: '',
  nomePai: '',
  nomeMae: '',
  rg: '',
  orgaoEmissor: '',
  nacionalidade: 'BRASILEIRA',
  naturalidade: '',
  uf: '',
  supervisao: '',
  campo: '',
  congregacao: '',
  email: '',
  celular: '',
  whatsapp: '',
  profissao: '',
  tituloEleitoral: '',
  zonaEleitoral: '',
  secaoEleitoral: '',
  observacoes: '',
};

const ENDERECO_INICIAL = {
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  complemento: '',
  cidade: '',
  latitude: '',
  longitude: '',
};

const DADOS_MINISTERIAIS_INICIAL = {
  temFuncaoIgreja: false,
  qualFuncao: '',
  setorDepartamento: '',
  dataBatismoAguas: '',
  dataBatismoEspiritoSanto: '',
  cursoTeologico: '',
  instituicaoTeologica: '',
  pastorAuxiliar: false,
  procedencia: '',
  procedenciaLocal: '',
  dataConsagracao: '',
  dataEmissao: '',
  dataValidadeCredencial: '',
  observacoesMinisteriais: '',
};

// ─── Hook principal ────────────────────────────────────────────────────────────

export function useMembros() {
  const supabase = createClient();
  const userCtx = useUserContext();
  const isSupervisor = userCtx.nivel === 'supervisor';
  const isAuxiliar = userCtx.nivel === 'auxiliar_secretaria';

  const { members: membersApi, fetchMembers, createMember, updateMember, deleteMember, error: membersError } = useMembers();

  // ── Estado: membros ──────────────────────────────────────────────────────────
  const [membros, setMembros] = useState<Membro[]>([]);
  const [maxMembros, setMaxMembros] = useState<number>(0);

  // ── Estado: UI / navegação ───────────────────────────────────────────────────
  const [dashboardView, setDashboardView] = useState<'overview' | 'list' | 'aniversariantes'>('overview');
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<MembrosFormTab>('dados');

  // ── Estado: filtros e paginação ──────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ATIVO');
  const [cargoFilter, setCargoFilter] = useState('TODOS');
  const [sortOrdemAlfabetica, setSortOrdemAlfabetica] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ── Estado: seleção em lote ──────────────────────────────────────────────────
  const [membrosSelecionados, setMembrosSelecionados] = useState<Set<string>>(new Set());
  const [imprimindoLote, setImprimindoLote] = useState(false);

  // ── Estado: modais ───────────────────────────────────────────────────────────
  const [membroEditando, setMembroEditando] = useState<Membro | null>(null);
  const [membroDeletando, setMembroDeletando] = useState<Membro | null>(null);
  const [membroImprimindo, setMembroImprimindo] = useState<Membro | null>(null);
  const [membroImprimindoCartao, setMembroImprimindoCartao] = useState<Membro | null>(null);
  const [ultimoCadastro, setUltimoCadastro] = useState<Membro | null>(null);

  // ── Estado: notificação ──────────────────────────────────────────────────────
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    autoClose?: number;
    showButton?: boolean;
  }>({ isOpen: false, title: '', message: '', type: 'success' });

  // ── Estado: formulário ───────────────────────────────────────────────────────
  const [dadosPessoais, setDadosPessoais] = useState<DadosPessoaisState>(DADOS_PESSOAIS_INICIAL);
  const [enderecoData, setEnderecoData] = useState(ENDERECO_INICIAL);
  const [dadosMinisteriais, setDadosMinisteriais] = useState(DADOS_MINISTERIAIS_INICIAL);
  const [cargoSelecionado, setCargoSelecionado] = useState('');
  const [dadosCargos, setDadosCargos] = useState<{
    [key: string]: {
      dataConsagracaoRecebimento: string;
      localConsagracao: string;
      localOrigem: string;
    };
  }>({});
  const [cpfDuplicado, setCpfDuplicado] = useState(false);
  const [isDizimista, setIsDizimista] = useState(false);
  const [dizimosHistorico, setDizimosHistorico] = useState<
    Array<{ mes_referencia: string; status: string; valor: number | null; data_pagamento: string | null }>
  >([]);
  const [loadingDizimosHistorico] = useState(false);

  // ── Estado: foto ─────────────────────────────────────────────────────────────
  const [fotoMembro, setFotoMembro] = useState<string | null>(null);
  const [fotoOriginal, setFotoOriginal] = useState<string | null>(null);
  const [fotoCropRotacao, setFotoCropRotacao] = useState<number>(0);
  const [rotation, setRotation] = useState(0);
  const [mostrarCropModal, setMostrarCropModal] = useState(false);
  const [fotoCropZoom, setFotoCropZoom] = useState(1);
  const [fotoCropPositionX, setFotoCropPositionX] = useState(0);
  const [fotoCropPositionY, setFotoCropPositionY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRefCrop = useRef<HTMLCanvasElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cpfInputRef = useRef<HTMLInputElement>(null);

  // ── Estado: configuração da igreja ──────────────────────────────────────────
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja>({
    nome: 'Igreja/Ministério',
    endereco: '',
    cnpj: '',
    telefone: '',
    email: '',
    logo: '',
  });

  // ── Estado: cargos ministeriais ──────────────────────────────────────────────
  const [cargosMinisteriais] = useState<CargoMinisterial[]>(() => getCargosMinisteriais());

  // ── Estado: modo admin/edição ─────────────────────────────────────────────────
  const [_isAdminMode, setIsAdminMode] = useState(false);
  const [_isEditando, setIsEditando] = useState(false);

  // ── Estado: nomenclaturas / divisões ─────────────────────────────────────────
  const [nomenclaturas, setNomenclaturasState] = useState({
    divisao1: 'IGREJA',
    divisao2: 'CAMPO',
    divisao3: 'NENHUMA',
  });
  const [supervisoes, setSupervisoes] = useState<DivisaoOption[]>([]);
  const [campos, setCampos] = useState<DivisaoOption[]>([]);
  const [congregacoes, setCongregacoes] = useState<DivisaoOption[]>([]);

  // ── Estado: templates ────────────────────────────────────────────────────────
  const [templatesSnapshot, setTemplatesSnapshot] = useState<any[]>([]);

  // ─── Derivados ───────────────────────────────────────────────────────────────

  const limiteMembrosAtingido = maxMembros > 0 && membros.length >= maxMembros;

  const supervisoesOptions = supervisoes;
  const camposOptions = campos;
  const congregacoesOptions = congregacoes;

  console.log('supervisoesOptions', supervisoesOptions);
  console.log('camposOptions', camposOptions);
  console.log('congregacoesOptions', congregacoesOptions);



  // ─── Filtros e paginação ──────────────────────────────────────────────────────

  const membrosFiltrados = membros
    .filter((m) => {
      const matchSearch =
        m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cpf.includes(searchTerm) ||
        m.matricula.includes(searchTerm);
      const matchStatus = statusFilter === 'TODOS' || m.status.toUpperCase() === statusFilter;
      const matchCargo =
        cargoFilter === 'TODOS' ||
        (m.cargoMinisterial || '').toUpperCase() === cargoFilter.toUpperCase();
      return matchSearch && matchStatus && matchCargo;
    })
    .sort((a, b) => {
      if (!sortOrdemAlfabetica) return 0;
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });

  const totalPages = Math.ceil(membrosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const membrosPaginados = membrosFiltrados.slice(startIndex, endIndex);

  // ─── Helpers de transformação de dados ───────────────────────────────────────

  const memberToMembro = (member: any): Membro => {
    const cf = member.custom_fields && typeof member.custom_fields === 'object' ? member.custom_fields : {};
    const cargoMinisterial = String(
      (cf as any).cargoMinisterial || (cf as any).cargo_ministerial || member.cargo_ministerial || ''
    );
    const stableUniqueId =
      member.unique_id ||
      (typeof (cf as any).uniqueId === 'string' && String((cf as any).uniqueId).length >= 8
        ? String((cf as any).uniqueId)
        : String(member.id || '').replace(/-/g, '').slice(0, 16).toUpperCase());

    return {
      id: member.id,
      uniqueId: stableUniqueId,
      ...(cf as any),
      matricula: String(member.matricula || (cf as any).matricula || ''),
      nome: String(member.name || (cf as any).nome || ''),
      cpf: formatCpf(String(member.cpf || (cf as any).cpf || '')),
      tipoCadastro: normalizeTipoCadastro(member.tipo_cadastro || member.role || (cf as any).tipoCadastro),
      supervisao: String((cf as any).supervisao || ''),
      campo: String((cf as any).campo || ''),
      congregacao: String((cf as any).congregacao || ''),
      status: dbStatusToUi(member.status),
      dataNascimento: String(member.data_nascimento || (cf as any).dataNascimento || ''),
      sexo: String(member.sexo || (cf as any).sexo || ''),
      tipoSanguineo: String(member.tipo_sanguineo || (cf as any).tipoSanguineo || ''),
      escolaridade: String(member.escolaridade || (cf as any).escolaridade || ''),
      estadoCivil: String(member.estado_civil || (cf as any).estadoCivil || ''),
      nomeConjuge: String(member.nome_conjuge || (cf as any).nomeConjuge || ''),
      cpfConjuge: String(member.cpf_conjuge || (cf as any).cpfConjuge || ''),
      dataNascimentoConjuge: String(member.data_nascimento_conjuge || (cf as any).dataNascimentoConjuge || ''),
      nomePai: String(member.nome_pai || (cf as any).nomePai || ''),
      nomeMae: String(member.nome_mae || (cf as any).nomeMae || ''),
      rg: String(member.rg || (cf as any).rg || ''),
      orgaoEmissor: String(member.orgao_emissor || (cf as any).orgaoEmissor || ''),
      nacionalidade: String(member.nacionalidade || (cf as any).nacionalidade || ''),
      naturalidade: String(member.naturalidade || (cf as any).naturalidade || ''),
      uf: String(member.uf_naturalidade || member.estado || (cf as any).uf || ''),
      qualFuncao: String(member.qual_funcao || (cf as any).qualFuncao || ''),
      profissao: String(member.profissao || (cf as any).profissao || ''),
      tituloEleitoral: String(member.titulo_eleitoral || (cf as any).tituloEleitoral || ''),
      zonaEleitoral: String(member.zona_eleitoral || (cf as any).zonaEleitoral || ''),
      secaoEleitoral: String(member.secao_eleitoral || (cf as any).secaoEleitoral || ''),
      observacoes: String(member.observacoes || (cf as any).observacoes || ''),
      email: String(member.email || (cf as any).email || ''),
      celular: String(member.celular || member.phone || (cf as any).celular || ''),
      whatsapp: String(member.whatsapp || (cf as any).whatsapp || ''),
      logradouro: String(member.logradouro || (cf as any).logradouro || ''),
      numero: String(member.numero || (cf as any).numero || ''),
      bairro: String(member.bairro || (cf as any).bairro || ''),
      cidade: String(member.cidade || (cf as any).cidade || ''),
      complemento: String(member.complemento || (cf as any).complemento || ''),
      cep: String(member.cep || (cf as any).cep || ''),
      procedencia: String(member.procedencia || (cf as any).procedencia || '').toLocaleLowerCase('pt-BR'),
      procedenciaLocal: String(member.procedencia_local || (cf as any).procedenciaLocal || ''),
      latitude: String((member.latitude ?? (cf as any).latitude ?? '') || ''),
      longitude: String((member.longitude ?? (cf as any).longitude ?? '') || ''),
      cargoMinisterial,
      cursoTeologico: String(member.curso_teologico || (cf as any).cursoTeologico || ''),
      instituicaoTeologica: String(member.instituicao_teologica || (cf as any).instituicaoTeologica || ''),
      pastorAuxiliar: member.pastor_auxiliar ?? (cf as any).pastorAuxiliar ?? false,
      temFuncaoIgreja: member.tem_funcao_igreja ?? (cf as any).temFuncaoIgreja ?? false,
      setorDepartamento: String(member.setor_departamento || (cf as any).setorDepartamento || ''),
      observacoesMinisteriais: String(member.observacoes_ministeriais || (cf as any).observacoesMinisteriais || ''),
      dataConsagracao: String(member.data_consagracao || (cf as any).dataConsagracao || ''),
      dataEmissao: String(member.data_emissao || (cf as any).dataEmissao || ''),
      dataValidadeCredencial: String(member.data_validade_credencial || (cf as any).dataValidadeCredencial || ''),
      dataBatismoAguas: String(member.data_batismo_aguas || (cf as any).dataBatismoAguas || ''),
      dataBatismoEspiritoSanto: String(member.data_batismo_espirito_santo || (cf as any).dataBatismoEspiritoSanto || ''),
      fotoUrl: member.foto_url || (cf as any).fotoUrl || undefined,
      isDizimista: member.is_dizimista ?? (cf as any).isDizimista ?? false,
    };
  };

  const buildCustomFieldsFromForm = (base: Partial<Membro>) => {
    const customFields = { ...base } as Record<string, any>;
    delete customFields.id;
    delete customFields.nome;
    delete customFields.cpf;
    delete customFields.status;
    return customFields;
  };

  // ─── Efeitos ─────────────────────────────────────────────────────────────────

  // Carregar membros ao montar
  useEffect(() => {
    fetchMembers(1, 500).catch((e) => {
      if (e instanceof Error && e.message === 'Usuário sem ministério associado') return;
      if (e instanceof Error && e.message === 'Não autenticado') return;
      console.error('Erro ao carregar membros (API):', e);
    });
  }, [fetchMembers]);

  // Sincronizar membrosApi -> membros
  useEffect(() => {
    setMembros(
      membersApi
        .map(memberToMembro)
        .sort((a, b) => (parseInt(a.matricula) || 0) - (parseInt(b.matricula) || 0))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersApi]);

  // Carregar configuração da igreja
  useEffect(() => {
    fetchConfiguracaoIgrejaFromSupabase(supabase)
      .then(setConfigIgreja)
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listener de foco (mantido para compatibilidade futura)
  useEffect(() => {
    function handleFocus() {
      // placeholder — reservado para revalidação futura de templates
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Carregar estrutura de divisões (supervisões, campos, congregações) + limite de plano via EstruturaOrganizacionalService
  useEffect(() => {
    let mounted = true;

    const loadEstruturaOptions = async () => {
      const ministryId = userCtx.ministryId;
      if (!ministryId) return;

      const [orgService, minRow] = await Promise.all([
        obterEstruturaOrganizacionalService(ministryId, supabase),
        supabase.from('ministries').select('subscription_plan_id, subscription_plans(max_members)').eq('id', ministryId).maybeSingle(),
      ]);

      if (!mounted) return;

      const maxM = (minRow.data as any)?.subscription_plans?.max_members;
      if (typeof maxM === 'number' && maxM > 0) setMaxMembros(maxM);

      const div1 = orgService.getOptionsFormatadas(1);
      const div2 = orgService.getOptionsFormatadas(2);
      const div3 = orgService.getOptionsFormatadas(3);
      const labels = orgService.getLabels();

      setNomenclaturasState({
        divisao1: labels.nomeDivisao1,
        divisao2: labels.nomeDivisao2,
        divisao3: labels.nomeDivisao3,
      });

      setSupervisoes(div1);
      setCampos(div2);
      setCongregacoes(div3);
    };

    loadEstruturaOptions().catch(() => null);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nomenclaturas' && mounted) {
        loadEstruturaOptions().catch(() => null);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [userCtx.ministryId]);

  // ─── Templates ───────────────────────────────────────────────────────────────

  const ensureTemplatesSnapshot = async () => {
    if (templatesSnapshot.length > 0) return templatesSnapshot;
    const { templates } = await loadTemplatesForCurrentUser(supabase, { allowLocalMigration: true });
    setTemplatesSnapshot(templates);
    return templates;
  };

  // ─── Helpers de formulário ────────────────────────────────────────────────────

  const gerarProximaMatricula = () => {
    const ultimaMatricula = Math.max(...membros.map((m) => parseInt(m.matricula) || 0), 0);
    return String(ultimaMatricula + 1).padStart(3, '0');
  };

  const resolveCargoValue = (rawValue?: string) => {
    const value = String(rawValue || '').trim();
    if (!value) return '';
    const match = cargosMinisteriais.find(
      (cargo) =>
        String(cargo.nome || '').trim().toLocaleUpperCase('pt-BR') === value.toLocaleUpperCase('pt-BR')
    );
    return match?.nome || value;
  };

  // ─── Ações de formulário ──────────────────────────────────────────────────────

  const resetarFormulario = () => {
    setDadosPessoais(DADOS_PESSOAIS_INICIAL);
    setEnderecoData(ENDERECO_INICIAL);
    setDadosMinisteriais(DADOS_MINISTERIAIS_INICIAL);
    setFotoMembro(null);
    setFotoOriginal(null);
    setRotation(0);
    setCargoSelecionado('');
    setDadosCargos({});
    setShowForm(false);
    setMembroEditando(null);
    setIsAdminMode(false);
    setIsDizimista(false);
    setDizimosHistorico([]);
  };

  const fecharFormulario = () => resetarFormulario();

  const abrirNovoCadastro = () => {
    const novaMatricula = gerarProximaMatricula();
    setDadosPessoais({ ...DADOS_PESSOAIS_INICIAL, matricula: novaMatricula });
    setEnderecoData(ENDERECO_INICIAL);
    setDadosMinisteriais({
      ...DADOS_MINISTERIAIS_INICIAL,
      dataEmissao: new Date().toISOString().slice(0, 10),
    });
    setFotoMembro(null);
    setFotoOriginal(null);
    setCargoSelecionado('');
    setDadosCargos({});
    setIsEditando(false);
    setIsDizimista(false);
    setCpfDuplicado(false);
    setShowForm(true);
    setActiveTab('dados');
  };

  const abrirEdicao = (membro: Membro) => {
    setMembroEditando(membro);
    setDadosPessoais({
      matricula: membro.matricula || '',
      cpf: membro.cpf || '',
      tipoCadastro: membro.tipoCadastro || 'ministro',
      nome: membro.nome || '',
      dataNascimento: membro.dataNascimento || '',
      sexo: membro.sexo || 'MASCULINO',
      tipoSanguineo: membro.tipoSanguineo || '',
      escolaridade: membro.escolaridade || '',
      estadoCivil: membro.estadoCivil || '',
      nomeConjuge: membro.nomeConjuge || '',
      cpfConjuge: membro.cpfConjuge || '',
      dataNascimentoConjuge: membro.dataNascimentoConjuge || '',
      nomePai: membro.nomePai || '',
      nomeMae: membro.nomeMae || '',
      rg: membro.rg || '',
      orgaoEmissor: membro.orgaoEmissor || '',
      nacionalidade: membro.nacionalidade || 'BRASILEIRA',
      naturalidade: membro.naturalidade || '',
      uf: membro.uf || '',
      supervisao: membro.supervisao || '',
      campo: membro.campo || '',
      congregacao: membro.congregacao || '',
      email: membro.email || '',
      celular: membro.celular || '',
      whatsapp: membro.whatsapp || '',
      profissao: membro.profissao || '',
      tituloEleitoral: membro.tituloEleitoral || '',
      zonaEleitoral: membro.zonaEleitoral || '',
      secaoEleitoral: membro.secaoEleitoral || '',
      observacoes: membro.observacoes || '',
    });
    setEnderecoData({
      cep: membro.cep || '',
      logradouro: membro.logradouro || '',
      numero: membro.numero || '',
      bairro: membro.bairro || '',
      complemento: membro.complemento || '',
      cidade: membro.cidade || '',
      latitude: membro.latitude || '',
      longitude: membro.longitude || '',
    });
    setFotoMembro(membro.fotoUrl || null);
    setFotoOriginal(membro.fotoUrl || null);
    setRotation(0);
    setDadosMinisteriais({
      temFuncaoIgreja: membro.temFuncaoIgreja || false,
      qualFuncao: membro.qualFuncao || '',
      setorDepartamento: membro.setorDepartamento || '',
      dataBatismoAguas: membro.dataBatismoAguas || '',
      dataBatismoEspiritoSanto: membro.dataBatismoEspiritoSanto || '',
      cursoTeologico: membro.cursoTeologico || '',
      instituicaoTeologica: membro.instituicaoTeologica || '',
      pastorAuxiliar: membro.pastorAuxiliar || false,
      procedencia: membro.procedencia || '',
      procedenciaLocal: membro.procedenciaLocal || '',
      dataConsagracao: membro.dataConsagracao || '',
      dataEmissao: membro.dataEmissao || '',
      dataValidadeCredencial: membro.dataValidadeCredencial || '',
      observacoesMinisteriais: membro.observacoesMinisteriais || '',
    });
    setCargoSelecionado(resolveCargoValue(membro.cargoMinisterial));
    setDadosCargos(membro.dadosCargos || {});
    setIsEditando(false);
    setIsAdminMode(true);
    setIsDizimista(membro.isDizimista ?? false);
    setDizimosHistorico([]);
    setCpfDuplicado(false);
    setShowForm(true);
    setActiveTab('dados');
  };

  const abrirConfirmacaoDeletar = (membro: Membro) => setMembroDeletando(membro);
  const cancelarDeletar = () => setMembroDeletando(null);

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  const salvarMembro = async () => {
    console.log('💾 Iniciando salvamento do membro...');

    if (cpfDuplicado) {
      setNotification({
        isOpen: true,
        title: 'CPF já cadastrado',
        message: 'Este CPF já está registrado em outro membro. Corrija o CPF antes de continuar.',
        type: 'error',
      });
      setTimeout(() => cpfInputRef.current?.focus(), 50);
      return;
    }

    if (!dadosPessoais.cpf || !dadosPessoais.nome || !dadosPessoais.dataNascimento) {
      setNotification({
        isOpen: true,
        title: 'Erro de Validação',
        message: 'Preencha todos os campos obrigatórios: CPF, Nome e Data de Nascimento',
        type: 'error',
      });
      return;
    }

    if (!validarCPF(dadosPessoais.cpf)) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: 'CPF inválido. Verifique o número digitado',
        type: 'error',
      });
      return;
    }

    try {
      const baseForCustom: Partial<Membro> = {
        uniqueId: membroEditando?.uniqueId || gerarUniqueId(),
        matricula: dadosPessoais.matricula,
        tipoCadastro: dadosPessoais.tipoCadastro,
        supervisao: dadosPessoais.supervisao,
        campo: dadosPessoais.campo,
        congregacao: dadosPessoais.congregacao,
        status: 'ativo',
        dataNascimento: dadosPessoais.dataNascimento,
        sexo: dadosPessoais.sexo,
        tipoSanguineo: dadosPessoais.tipoSanguineo,
        escolaridade: dadosPessoais.escolaridade,
        estadoCivil: dadosPessoais.estadoCivil,
        nomeConjuge: dadosPessoais.nomeConjuge,
        cpfConjuge: dadosPessoais.cpfConjuge,
        dataNascimentoConjuge: dadosPessoais.dataNascimentoConjuge,
        nomePai: dadosPessoais.nomePai,
        nomeMae: dadosPessoais.nomeMae,
        rg: dadosPessoais.rg,
        orgaoEmissor: dadosPessoais.orgaoEmissor,
        nacionalidade: dadosPessoais.nacionalidade,
        naturalidade: dadosPessoais.naturalidade,
        uf: dadosPessoais.uf,
        email: dadosPessoais.email,
        celular: dadosPessoais.celular,
        whatsapp: dadosPessoais.whatsapp,
        profissao: dadosPessoais.profissao,
        tituloEleitoral: dadosPessoais.tituloEleitoral,
        zonaEleitoral: dadosPessoais.zonaEleitoral,
        secaoEleitoral: dadosPessoais.secaoEleitoral,
        observacoes: dadosPessoais.observacoes,
        ...enderecoData,
        ...dadosMinisteriais,
        cargoMinisterial: cargoSelecionado,
        dadosCargos,
        temFuncaoIgreja: dadosMinisteriais.temFuncaoIgreja,
        fotoUrl: fotoMembro || undefined,
      };

      const custom_fields = {
        ...buildCustomFieldsFromForm(baseForCustom),
        cargoMinisterial: cargoSelecionado || null,
        cargo_ministerial: cargoSelecionado || null,
      };

      const latitudeNumber = enderecoData.latitude
        ? Number(String(enderecoData.latitude).replace(',', '.'))
        : null;
      const longitudeNumber = enderecoData.longitude
        ? Number(String(enderecoData.longitude).replace(',', '.'))
        : null;

      const u = (v: string | null | undefined): string | null => (v ? v.toUpperCase().trim() : null);

      const payloadBase: any = {
        name: (dadosPessoais.nome || '').toUpperCase().trim(),
        cpf: onlyDigits(dadosPessoais.cpf) || null,
        email: dadosPessoais.email?.trim().toLowerCase() || null,
        phone: dadosPessoais.celular || null,
        matricula: u(dadosPessoais.matricula),
        unique_id: baseForCustom.uniqueId || null,
        tipo_cadastro: dadosPessoais.tipoCadastro,
        data_nascimento: dadosPessoais.dataNascimento || null,
        sexo: u(dadosPessoais.sexo),
        tipo_sanguineo: u(dadosPessoais.tipoSanguineo),
        escolaridade: u(dadosPessoais.escolaridade),
        estado_civil: u(dadosPessoais.estadoCivil),
        nome_conjuge: u(dadosPessoais.nomeConjuge),
        cpf_conjuge: dadosPessoais.cpfConjuge ? onlyDigits(dadosPessoais.cpfConjuge) : null,
        data_nascimento_conjuge: dadosPessoais.dataNascimentoConjuge || null,
        nome_pai: u(dadosPessoais.nomePai),
        nome_mae: u(dadosPessoais.nomeMae),
        rg: u(dadosPessoais.rg),
        orgao_emissor: u(dadosPessoais.orgaoEmissor),
        nacionalidade: u(dadosPessoais.nacionalidade),
        naturalidade: u(dadosPessoais.naturalidade),
        uf_naturalidade: u(dadosPessoais.uf),
        data_batismo_aguas: dadosMinisteriais.dataBatismoAguas || null,
        data_batismo_espirito_santo: dadosMinisteriais.dataBatismoEspiritoSanto || null,
        cep: onlyDigits(enderecoData.cep) || null,
        logradouro: u(enderecoData.logradouro),
        numero: u(enderecoData.numero),
        bairro: u(enderecoData.bairro),
        complemento: u(enderecoData.complemento),
        cidade: u(enderecoData.cidade),
        estado: u(dadosPessoais.uf),
        celular: dadosPessoais.celular || null,
        whatsapp: dadosPessoais.whatsapp || null,
        congregacao_id: congregacoes.find((cg) => cg.nome === dadosPessoais.supervisao)?.id || null,
        latitude: Number.isFinite(latitudeNumber) ? latitudeNumber : null,
        longitude: Number.isFinite(longitudeNumber) ? longitudeNumber : null,
        profissao: u(dadosPessoais.profissao),
        titulo_eleitoral: u(dadosPessoais.tituloEleitoral),
        zona_eleitoral: u(dadosPessoais.zonaEleitoral),
        secao_eleitoral: u(dadosPessoais.secaoEleitoral),
        curso_teologico: u(dadosMinisteriais.cursoTeologico),
        instituicao_teologica: u(dadosMinisteriais.instituicaoTeologica),
        pastor_auxiliar: dadosMinisteriais.pastorAuxiliar ?? false,
        procedencia: u(dadosMinisteriais.procedencia),
        procedencia_local: u(dadosMinisteriais.procedenciaLocal),
        cargo_ministerial: u(cargoSelecionado),
        dados_cargos: dadosCargos || {},
        tem_funcao_igreja: dadosMinisteriais.temFuncaoIgreja ?? false,
        qual_funcao: u(dadosMinisteriais.qualFuncao),
        setor_departamento: u(dadosMinisteriais.setorDepartamento),
        observacoes_ministeriais: u(dadosMinisteriais.observacoesMinisteriais),
        foto_url: fotoMembro || null,
        is_dizimista: isDizimista || dadosPessoais.tipoCadastro === 'ministro',
        data_consagracao: dadosMinisteriais.dataConsagracao || null,
        data_emissao: dadosMinisteriais.dataEmissao || null,
        data_validade_credencial: dadosMinisteriais.dataValidadeCredencial || null,
        status: uiStatusToDb('ativo'),
        role: dadosPessoais.tipoCadastro,
        observacoes: u(dadosPessoais.observacoes),
        custom_fields,
      };

      if (membroEditando) {
        await updateMember(membroEditando.id, payloadBase);
        await fetchMembers(1, 500);
        setNotification({ isOpen: true, title: 'Sucesso', message: 'Membro atualizado com sucesso!', type: 'success' });
      } else {
        const created = await createMember(payloadBase);
        await fetchMembers(1, 500);
        const createdUi = memberToMembro(created as unknown as any);
        setUltimoCadastro(createdUi);
        setNotification({ isOpen: true, title: 'Sucesso', message: 'Novo membro cadastrado com sucesso!', type: 'success' });
      }
    } catch (e) {
      console.error('Erro ao salvar membro (API):', e);
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: e instanceof Error ? e.message : 'Erro ao salvar membro',
        type: 'error',
      });
      return;
    }

    resetarFormulario();
  };

  const deletarMembro = async () => {
    if (!membroDeletando) return;
    try {
      await deleteMember(membroDeletando.id);
      await fetchMembers(1, 500);
      setNotification({
        isOpen: true,
        title: 'Sucesso',
        message: `Membro "${membroDeletando.nome}" foi deletado com sucesso!`,
        type: 'success',
      });
      setMembroDeletando(null);
    } catch (e) {
      console.error('Erro ao deletar membro (API):', e);
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: e instanceof Error ? e.message : 'Erro ao deletar membro',
        type: 'error',
      });
    }
  };

  // ─── Documentos / carteirinha ─────────────────────────────────────────────────

  const abrirDocumentosMembro = async (membro: Membro) => {
    const templatesBase = await ensureTemplatesSnapshot();
    if (!hasActiveTemplate(membro.tipoCadastro, templatesBase)) {
      setNotification({
        isOpen: true,
        title: 'Template Ausente',
        message: getMensagemSemTemplate(membro.tipoCadastro),
        type: 'warning',
      });
      return;
    }
    setMembroImprimindoCartao(membro);
  };

  // ─── PDF Listagem ─────────────────────────────────────────────────────────────

  const gerarPDFListagem = () => {
    const { jsPDF } = require('jspdf');
    const autoTable = require('jspdf-autotable').default;

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const config = configIgreja;

    let yPos = 15;

    if (config.logo) {
      try { doc.addImage(config.logo, 'PNG', 14, yPos - 5, 30, 30); }
      catch (error) { console.error('Erro ao adicionar logo:', error); }
    }

    const textStartX = config.logo ? 50 : 14;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(config.nome, textStartX, yPos + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let infoY = yPos + 12;
    if (config.endereco) { doc.text(config.endereco, textStartX, infoY); infoY += 5; }

    const contatoInfo = [];
    if (config.cnpj) contatoInfo.push(`CNPJ: ${config.cnpj}`);
    if (config.telefone) contatoInfo.push(`Tel: ${config.telefone}`);
    if (config.email) contatoInfo.push(config.email);
    if (contatoInfo.length > 0) doc.text(contatoInfo.join(' | '), textStartX, infoY);

    yPos = config.logo ? 50 : 35;
    doc.setDrawColor(20, 184, 166);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);

    yPos += 8;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Listagem de Membros', pageWidth / 2, yPos, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    yPos += 7;
    doc.text(`Total de registros: ${membrosFiltrados.length}`, 14, yPos);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, yPos, { align: 'right' });

    const tableData = membrosFiltrados.map((membro) => {
      const tipo = (membro?.tipoCadastro || '').toLowerCase().trim();
      const cargoExibicao = tipo === 'ministro'
        ? ((membro?.cargoMinisterial || '').trim() || 'MINISTRO')
        : (membro?.tipoCadastro || '').toUpperCase().trim();

      return [
        membro.matricula,
        membro.nome,
        membro.cpf,
        cargoExibicao,
        (membro as any).dadosCargos?.dataConsagracao
          ? new Date((membro as any).dadosCargos.dataConsagracao).toLocaleDateString('pt-BR')
          : (membro as any).dataConsagracao
            ? new Date((membro as any).dataConsagracao).toLocaleDateString('pt-BR')
            : '-',
        membro.status === 'ativo' ? 'Ativo' : 'Inativo',
      ];
    });

    autoTable(doc, {
      startY: yPos + 5,
      head: [['Matrícula', 'Nome', 'CPF', 'Cargo', 'Dt. Consagração', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { halign: 'left', cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 35 },
        3: { halign: 'left', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 30 },
        5: { halign: 'center', cellWidth: 20 },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gestão Eklésia - Sistema de Gerenciamento Eclesiástico`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }

    const dataHora = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    doc.save(`listagem_membros_${dataHora}.pdf`);

    setNotification({ isOpen: true, title: 'Sucesso', message: 'PDF gerado com sucesso!', type: 'success' });
  };

  // ─── Busca de CEP ─────────────────────────────────────────────────────────────

  const buscarCEP = async () => {
    const cepLimpo = enderecoData.cep.replace(/\D/g, '');

    if (!cepLimpo || cepLimpo.length !== 8) {
      setNotification({ isOpen: true, title: 'Aviso', message: 'Digite um CEP válido com 8 dígitos', type: 'warning' });
      setEnderecoData((prev) => ({ ...prev, logradouro: '', bairro: '', cidade: '', complemento: '', latitude: '', longitude: '' }));
      return;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (!response.ok) throw new Error('Erro ao conectar com ViaCEP');

      const data = await response.json();

      if (data.erro) {
        setNotification({ isOpen: true, title: 'Aviso', message: 'CEP não encontrado. Verifique o número.', type: 'warning' });
        setEnderecoData((prev) => ({ ...prev, logradouro: '', bairro: '', cidade: '', complemento: '', latitude: '', longitude: '' }));
        return;
      }

      const novoEndereco = {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        complemento: data.complemento || '',
      };

      const enderecoAtualizado = { ...enderecoData, ...novoEndereco, latitude: '', longitude: '' };
      setEnderecoData(enderecoAtualizado);

      if (novoEndereco.logradouro && novoEndereco.cidade) {
        const partesEndereco = [novoEndereco.logradouro, enderecoData.numero, novoEndereco.bairro, novoEndereco.cidade].filter(Boolean);
        const enderecoCompleto = partesEndereco.join(', ');

        try {
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(enderecoCompleto)}&format=json&limit=1`
          );
          if (!geoResponse.ok) throw new Error('Erro ao conectar com Nominatim');

          const geoData = await geoResponse.json();
          if (geoData && geoData.length > 0) {
            const latitude = parseFloat(geoData[0].lat).toFixed(4);
            const longitude = parseFloat(geoData[0].lon).toFixed(4);
            setEnderecoData((prev) => ({ ...prev, latitude, longitude }));
          }
        } catch (geoError) {
          console.error('❌ Erro na geocodificação:', geoError);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar CEP:', error);
      setNotification({ isOpen: true, title: 'Erro', message: 'Erro ao buscar CEP. Tente novamente.', type: 'error' });
      setEnderecoData((prev) => ({ ...prev, logradouro: '', bairro: '', cidade: '', complemento: '', latitude: '', longitude: '' }));
    }
  };

  // ─── Upload / Crop de Foto ────────────────────────────────────────────────────

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFotoOriginal(result);
        setFotoCropZoom(1);
        setFotoCropPositionX(0);
        setFotoCropPositionY(0);
        setFotoCropRotacao(0);
        setMostrarCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmarCropFoto = () => {
    if (!canvasRefCrop.current || !fotoOriginal) return;
    const canvas = canvasRefCrop.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const canvasAspect = canvas.width / canvas.height;
      const imgAspect = img.width / img.height;

      let imgX, imgY, imgWidth, imgHeight;
      if (imgAspect > canvasAspect) {
        imgHeight = canvas.height;
        imgWidth = imgHeight * imgAspect;
        imgX = (canvas.width - imgWidth) / 2;
        imgY = 0;
      } else {
        imgWidth = canvas.width;
        imgHeight = imgWidth / imgAspect;
        imgX = 0;
        imgY = (canvas.height - imgHeight) / 2;
      }

      ctx.save();
      const imgCenterX = imgX + imgWidth / 2;
      const imgCenterY = imgY + imgHeight / 2;
      ctx.translate(imgCenterX, imgCenterY);
      ctx.rotate((fotoCropRotacao * Math.PI) / 180);
      ctx.scale(fotoCropZoom, fotoCropZoom);
      ctx.translate(fotoCropPositionX, fotoCropPositionY);
      ctx.translate(-imgCenterX, -imgCenterY);
      ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();

      const imagemCropada = canvas.toDataURL('image/jpeg', 0.95);
      setFotoMembro(imagemCropada);
      setMostrarCropModal(false);
      setFotoOriginal(imagemCropada);
    };
    img.src = fotoOriginal;
  };

  const cancelarCropFoto = () => {
    setMostrarCropModal(false);
    setFotoOriginal(null);
    setFotoCropZoom(1);
    setFotoCropPositionX(0);
    setFotoCropPositionY(0);
    setFotoCropRotacao(0);
  };

  const handleCropWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomAmount = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(1, Math.min(3, fotoCropZoom + zoomAmount));
    setFotoCropZoom(newZoom);
  };

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setFotoCropPositionX((prev) => Math.max(-200, Math.min(200, prev + deltaX / 2)));
    setFotoCropPositionY((prev) => Math.max(-200, Math.min(200, prev + deltaY / 2)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCropMouseUp = () => setIsDragging(false);

  const resetCropView = () => {
    setFotoCropZoom(1);
    setFotoCropPositionX(0);
    setFotoCropPositionY(0);
  };

  const girarCropImagemEsquerda = () => {
    setFotoCropRotacao((prev) => {
      const novaRotacao = prev - 90;
      return novaRotacao < 0 ? novaRotacao + 360 : novaRotacao;
    });
  };

  const girarCropImagemDireita = () => setFotoCropRotacao((prev) => (prev + 90) % 360);

  const processarERedimensionar = (base64: string, deg = 0): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        const targetWidth = 300;
        const targetHeight = 400;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.save();
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.rotate((deg * Math.PI) / 180);

        let drawWidth, drawHeight;
        const targetRatio = targetWidth / targetHeight;
        const isVertical = deg === 90 || deg === 270;
        const sourceWidth = isVertical ? img.height : img.width;
        const sourceHeight = isVertical ? img.width : img.height;
        const sourceRatio = sourceWidth / sourceHeight;

        if (sourceRatio > targetRatio) {
          drawHeight = targetHeight;
          drawWidth = targetHeight * sourceRatio;
        } else {
          drawWidth = targetWidth;
          drawHeight = targetWidth / sourceRatio;
        }

        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedBase64);
      };
      img.src = base64;
    });
  };

  const handleGirarFoto = async () => {
    const novaRotacao = (rotation + 90) % 360;
    setRotation(novaRotacao);
    if (fotoOriginal || fotoMembro) {
      const rotacionada = await processarERedimensionar(fotoOriginal || (fotoMembro as string), novaRotacao);
      setFotoMembro(rotacionada);
    }
  };

  // ─── Retorno do hook ──────────────────────────────────────────────────────────

  return {
    // Estado: membros e configuração
    membros,
    membersError,
    maxMembros,
    limiteMembrosAtingido,
    configIgreja,
    cargosMinisteriais,
    nomenclaturas,

    // Estado: UI / navegação
    dashboardView,
    setDashboardView,
    showForm,
    setShowForm,
    activeTab,
    setActiveTab,

    // Estado: filtros e paginação
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    cargoFilter,
    setCargoFilter,
    sortOrdemAlfabetica,
    setSortOrdemAlfabetica,
    currentPage,
    setCurrentPage,
    membrosFiltrados,
    membrosPaginados,
    totalPages,
    startIndex,
    endIndex,
    itemsPerPage,

    // Estado: seleção em lote
    membrosSelecionados,
    setMembrosSelecionados,
    imprimindoLote,
    setImprimindoLote,

    // Estado: modais
    membroEditando,
    membroDeletando,
    membroImprimindo,
    setMembroImprimindo,
    membroImprimindoCartao,
    setMembroImprimindoCartao,
    ultimoCadastro,

    // Estado: notificação
    notification,
    setNotification,

    // Estado: formulário
    dadosPessoais,
    setDadosPessoais,
    enderecoData,
    setEnderecoData,
    dadosMinisteriais,
    setDadosMinisteriais,
    cargoSelecionado,
    setCargoSelecionado,
    dadosCargos,
    setDadosCargos,
    cpfDuplicado,
    setCpfDuplicado,
    isDizimista,
    setIsDizimista,
    dizimosHistorico,
    loadingDizimosHistorico,

    // Estado: foto e crop
    fotoMembro,
    setFotoMembro,
    fotoOriginal,
    fotoCropRotacao,
    fotoCropZoom,
    setFotoCropZoom,
    fotoCropPositionX,
    setFotoCropPositionX,
    fotoCropPositionY,
    setFotoCropPositionY,
    isDragging,
    mostrarCropModal,
    canvasRefCrop,
    previewAreaRef,
    fileInputRef,
    cpfInputRef,

    // Permissões de usuário
    isSupervisor,
    isAuxiliar,

    // Opções de nomenclatura
    supervisoesOptions: supervisoes,
    camposOptions: campos,
    congregacoesOptions: congregacoes,

    // Helpers expostos
    maskCpf,
    gerarProximaMatricula,
    resolveCargoValue,
    hasActiveTemplate,
    getMensagemSemTemplate,
    ensureTemplatesSnapshot,

    // Ações CRUD
    salvarMembro,
    deletarMembro,
    abrirNovoCadastro,
    abrirEdicao,
    abrirDocumentosMembro,
    abrirConfirmacaoDeletar,
    cancelarDeletar,
    fecharFormulario,

    // Ações PDF
    gerarPDFListagem,

    // Ações CEP
    buscarCEP,

    // Ações foto/crop
    handleFotoUpload,
    confirmarCropFoto,
    cancelarCropFoto,
    handleCropWheel,
    handleCropMouseDown,
    handleCropMouseMove,
    handleCropMouseUp,
    resetCropView,
    girarCropImagemEsquerda,
    girarCropImagemDireita,
    handleGirarFoto,
  };
}
