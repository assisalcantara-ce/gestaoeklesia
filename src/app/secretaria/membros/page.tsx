'use client';

import { useState, useEffect, useRef } from 'react';
import NotificationModal from '@/components/NotificationModal';
import MembrosOverview from '@/components/MembrosOverview';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { useUserContext } from '@/hooks/useUserContext';
import { useMembers } from '@/hooks/useMembers';
import { getCargosMinisteriais, type CargoMinisterial } from '@/lib/cargos-utils';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import { getMensagemSemTemplate } from '@/lib/cartoes-utils';
import { createClient } from '@/lib/supabase-client';
import { loadOrgNomenclaturasFromSupabaseOrMigrate } from '@/lib/org-nomenclaturas';
import { loadTemplatesForCurrentUser } from '@/lib/cartoes-templates-sync';
import ConfirmDeleteModal from '@/components/secretaria/membros/ConfirmDeleteModal';
import MembroCarteirinhaModal from '@/components/secretaria/membros/MembroCarteirinhaModal';
import MembrosToolbar from '@/components/secretaria/membros/MembrosToolbar';
import MembrosTable from '@/components/secretaria/membros/MembrosTable';
import MembroFormModal from '@/components/secretaria/membros/MembroFormModal';

interface Membro {
  id: string;
  uniqueId: string; // UNIQUE ID com 16 caracteres para QR Code
  matricula: string;
  nome: string;
  cpf: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';

  supervisao: string;
  campo: string;
  congregacao: string;
  status: 'ativo' | 'inativo';
  // Dados pessoais
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
  // Endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  latitude?: string;
  longitude?: string;
  // Contato
  email?: string;
  celular?: string;
  whatsapp?: string;
  // Documentos e Observações Gerais
  profissao?: string;
  tituloEleitoral?: string;
  zonaEleitoral?: string;
  secaoEleitoral?: string;
  observacoes?: string;
  // Foto
  fotoUrl?: string;
  // Ministeriais
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
    }
  };
  observacoesMinisteriais?: string;
  isDizimista?: boolean;
}

interface DivisaoOption {
  id: string;
  nome: string;
  supervisao_id?: string | null;
  campo_id?: string | null;
}

interface DadosPessoaisState {
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

type MembrosFormTab = 'dados' | 'endereco' | 'ministerial' | 'foto' | 'dizimos';

export default function MembrosPage() {
  const { bloqueado } = useRequireModulo('secretaria');
  const supabase = createClient();

  const [dashboardView, setDashboardView] = useState<'overview' | 'list'>('overview');
  const [activeTab, setActiveTab] = useState<MembrosFormTab>('dados');
  const [isDizimista, setIsDizimista] = useState(false);
  const [dizimosHistorico, setDizimosHistorico] = useState<Array<{mes_referencia: string; status: string; valor: number | null; data_pagamento: string | null}>>([]);
  const [loadingDizimosHistorico, _setLoadingDizimosHistorico] = useState(false);
  const [templatesSnapshot, setTemplatesSnapshot] = useState<any[]>([]);
  const [configIgreja, setConfigIgreja] = useState({
    nome: 'Igreja/Ministério',
    endereco: '',
    cnpj: '',
    telefone: '',
    email: '',
    logo: ''
  });

  // Função para gerar UNIQUE ID com 16 caracteres
  const gerarUniqueId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

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

  const memberToMembro = (member: any): Membro => {
    const cf = (member.custom_fields && typeof member.custom_fields === 'object') ? member.custom_fields : {};
    const cargoMinisterial = String(
      (cf as any).cargoMinisterial ||
      (cf as any).cargo_ministerial ||
      member.cargo_ministerial ||
      ''
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

  const { members: membersApi, fetchMembers, createMember, updateMember, deleteMember, error: membersError } = useMembers();

  const [membros, setMembros] = useState<Membro[]>([]);

  // Carregar membros do Supabase (API) ao abrir a tela
  useEffect(() => {
    fetchMembers(1, 500).catch((e) => {
      // Erros já são expostos via membersError; aqui evitamos poluir o console.
      if (e instanceof Error && e.message === 'Usuário sem ministério associado') return;
      if (e instanceof Error && e.message === 'Não autenticado') return; // race condition na hidratação
      console.error('Erro ao carregar membros (API):', e);
    });
  }, [fetchMembers]);

  // Projetar o formato do banco (Member) para o formato usado pela UI (Membro)
  useEffect(() => {
    setMembros(
      membersApi
        .map(memberToMembro)
        .sort((a, b) => (parseInt(a.matricula) || 0) - (parseInt(b.matricula) || 0))
    );
  }, [membersApi]);

  useEffect(() => {
    fetchConfiguracaoIgrejaFromSupabase(supabase)
      .then(setConfigIgreja)
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureTemplatesSnapshot = async () => {
    if (templatesSnapshot.length > 0) return templatesSnapshot;
    const { templates } = await loadTemplatesForCurrentUser(supabase, { allowLocalMigration: true });
    setTemplatesSnapshot(templates);
    return templates;
  };

  const hasActiveTemplate = (tipoCadastro: string, templatesBase: any[]) => {
    const tipo = (tipoCadastro || '').toLowerCase() === 'crianca' ? 'membro' : tipoCadastro;
    return templatesBase.some((t: any) => {
      const tTipo = (t.tipoCadastro || t.tipo || '').toLowerCase();
      return tTipo === tipo && t.ativo === true;
    });
  };

  const [maxMembros, setMaxMembros] = useState<number>(0); // 0 = sem limite
  const limiteMembrosAtingido = maxMembros > 0 && membros.length >= maxMembros;

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ATIVO');
  const [cargoFilter, setCargoFilter] = useState('TODOS');
  const [currentPage, setCurrentPage] = useState(1);
  const [membroEditando, setMembroEditando] = useState<Membro | null>(null);
  const [membroDeletando, setMembroDeletando] = useState<Membro | null>(null);
  const [membroImprimindo, setMembroImprimindo] = useState<Membro | null>(null);
  const [membroImprimindoCartao, setMembroImprimindoCartao] = useState<Membro | null>(null);
  const [ultimoCadastro, setUltimoCadastro] = useState<Membro | null>(null);
  const [membrosSelecionados, setMembrosSelecionados] = useState<Set<string>>(new Set());
  const [cpfDuplicado, setCpfDuplicado] = useState(false);
  const [_verificandoCpf, _setVerificandoCpf] = useState(false);
  const cpfInputRef = useRef<HTMLInputElement>(null);
  const [imprimindoLote, setImprimindoLote] = useState(false);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    autoClose?: number; // Tempo em ms
    showButton?: boolean;
  }>({ isOpen: false, title: '', message: '', type: 'success' });
  const [enderecoData, setEnderecoData] = useState({
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    complemento: '',
    cidade: '',
    latitude: '',
    longitude: ''
  });

  // Estado para dados pessoais
  const [dadosPessoais, setDadosPessoais] = useState<DadosPessoaisState>({
    matricula: '',
    cpf: '',
    tipoCadastro: 'membro', // Convenção do projeto
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
    observacoes: ''
  });

  // Estado para foto (Base64)
  const [fotoMembro, setFotoMembro] = useState<string | null>(null);
  const [fotoOriginal, setFotoOriginal] = useState<string | null>(null); // Guardar original para crop
  const [fotoCropRotacao, setFotoCropRotacao] = useState<number>(0); // Rotação manual em graus
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

  // Estado para forçar atualização da validação ao focar na janela
  // const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    function handleFocus() {
      // Forçar re-render para validar templates novamente
      // setUpdateTrigger(prev => prev + 1);
      // console.log('🔄 Janela focada - revalidando templates');
    }

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Estado para dados ministeriais
  const [dadosMinisteriais, setDadosMinisteriais] = useState({
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
    observacoesMinisteriais: ''
  });

  // Estado para rastrear cargo selecionado
  const [cargoSelecionado, setCargoSelecionado] = useState('');

  // Estado para armazenar dados de consagração/recebimento por cargo
  const [dadosCargos, setDadosCargos] = useState<{
    [key: string]: {
      dataConsagracaoRecebimento: string;
      localConsagracao: string;
      localOrigem: string;
    }
  }>({});

  // Estado para controlar modo edição (admin only)
  const [_isAdminMode, setIsAdminMode] = useState(false);
  const userCtx = useUserContext();
  const isSupervisor = userCtx.nivel === 'supervisor';
  const isAuxiliar = userCtx.nivel === 'auxiliar_secretaria';
  const [_isEditando, setIsEditando] = useState(false);

  // Cargos ministeriais (sincronizados com configurações via localStorage)
  const [cargosMinisteriais] = useState<CargoMinisterial[]>(() => getCargosMinisteriais());

  const resolveCargoValue = (rawValue?: string) => {
    const value = String(rawValue || '').trim();
    if (!value) return '';

    const match = cargosMinisteriais.find(
      (cargo) => String(cargo.nome || '').trim().toLocaleUpperCase('pt-BR') === value.toLocaleUpperCase('pt-BR')
    );

    return match?.nome || value;
  };

  // Nomenclaturas dinâmicas para as divisões
  const [nomenclaturas, setNomenclaturasState] = useState({
    divisao1: 'IGREJA',
    divisao2: 'CAMPO',
    divisao3: 'NENHUMA'
  });
  const [orgNomenclaturasRaw, setOrgNomenclaturasRaw] = useState<any>(null);

  const [_supervisoes, setSupervisoes] = useState<DivisaoOption[]>([]);
  const [_campos, setCampos] = useState<DivisaoOption[]>([]);
  const [congregacoes, setCongregacoes] = useState<DivisaoOption[]>([]);

  const refreshNomenclaturas = async () => {
    const org = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase);
    setOrgNomenclaturasRaw(org);
    setNomenclaturasState({
      divisao1: org?.divisaoPrincipal?.opcao1 || 'IGREJA',
      divisao2: org?.divisaoSecundaria?.opcao1 || 'CAMPO',
      divisao3: org?.divisaoTerciaria?.opcao1 || 'NENHUMA',
    });
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        await refreshNomenclaturas();
      } catch {
        // ignore
      }
    };

    run();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nomenclaturas' && mounted) {
        run();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveMinistryId = async (): Promise<string | null> => {
    return userCtx.ministryId;
  };

  useEffect(() => {
    const loadEstruturaOptions = async () => {
      const ministryId = await resolveMinistryId();
      if (!ministryId) return;

      const [s, c, g, minRow] = await Promise.all([
        supabase.from('supervisoes').select('id,nome,is_active').eq('ministry_id', ministryId).eq('is_active', true).order('nome'),
        supabase.from('campos').select('id,nome,supervisao_id,is_active').eq('ministry_id', ministryId).eq('is_active', true).order('nome'),
        supabase.from('congregacoes').select('id,nome,supervisao_id,campo_id,is_active').eq('ministry_id', ministryId).eq('is_active', true).order('nome'),
        supabase.from('ministries').select('subscription_plan_id, subscription_plans(max_members)').eq('id', ministryId).maybeSingle(),
      ]);

      if (s.error) console.warn('Falha ao carregar 1a divisao:', s.error);
      if (c.error) console.warn('Falha ao carregar 2a divisao:', c.error);
      if (g.error) console.warn('Falha ao carregar 3a divisao:', g.error);

      const maxM = (minRow.data as any)?.subscription_plans?.max_members;
      if (typeof maxM === 'number' && maxM > 0) setMaxMembros(maxM);

      if (s.error) console.warn('Falha ao carregar 1a divisao:', s.error);
      if (c.error) console.warn('Falha ao carregar 2a divisao:', c.error);
      if (g.error) console.warn('Falha ao carregar 3a divisao:', g.error);

      setSupervisoes(((s.data as any[]) || []).map((row: any) => ({ id: row.id, nome: row.nome })));
      setCampos(((c.data as any[]) || []).map((row: any) => ({ id: row.id, nome: row.nome, supervisao_id: row.supervisao_id })));
      setCongregacoes(((g.data as any[]) || []).map((row: any) => ({ id: row.id, nome: row.nome, supervisao_id: row.supervisao_id, campo_id: row.campo_id })));
    };

    loadEstruturaOptions().catch(() => null);
  }, []);

  const sanitizeNome = (value: unknown) => String(value || '').trim();

  const supervisoesFromNomenclaturas = ((orgNomenclaturasRaw?.divisaoPrincipal?.custom || []) as string[])
    .map((nome, idx) => ({ id: `cfg-s-${idx}-${nome}`, nome: sanitizeNome(nome) }))
    .filter((opt) => !!opt.nome);
  const camposFromNomenclaturas = ((orgNomenclaturasRaw?.divisaoSecundaria?.custom || []) as string[])
    .map((nome, idx) => ({ id: `cfg-c-${idx}-${nome}`, nome: sanitizeNome(nome) }))
    .filter((opt) => !!opt.nome);
  const congregacoesFromNomenclaturas = ((orgNomenclaturasRaw?.divisaoTerciaria?.custom || []) as string[])
    .map((nome, idx) => ({ id: `cfg-g-${idx}-${nome}`, nome: sanitizeNome(nome) }))
    .filter((opt) => !!opt.nome);





  // Funções de Imagem
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

  // Função para confirmar crop da foto
  const confirmarCropFoto = () => {
    if (!canvasRefCrop.current || !fotoOriginal) return;

    const canvas = canvasRefCrop.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Carregar imagem para renderizar no canvas com transformações
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Limpar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calcular escala da imagem para preenchimento (object-cover)
      const canvasAspect = canvas.width / canvas.height;
      const imgAspect = img.width / img.height;

      let imgX, imgY, imgWidth, imgHeight;

      if (imgAspect > canvasAspect) {
        // Imagem é mais larga - colocar altura = altura canvas
        imgHeight = canvas.height;
        imgWidth = imgHeight * imgAspect;
        imgX = (canvas.width - imgWidth) / 2;
        imgY = 0;
      } else {
        // Imagem é mais estreita - colocar largura = largura canvas
        imgWidth = canvas.width;
        imgHeight = imgWidth / imgAspect;
        imgX = 0;
        imgY = (canvas.height - imgHeight) / 2;
      }

      // Aplicar transformações em relação ao CENTRO DA IMAGEM VISÍVEL
      ctx.save();
      
      // Centro da imagem visível (com object-cover)
      const imgCenterX = imgX + imgWidth / 2;
      const imgCenterY = imgY + imgHeight / 2;
      
      // Mover para centro da imagem, aplicar transformações, e voltar
      ctx.translate(imgCenterX, imgCenterY);
      ctx.rotate((fotoCropRotacao * Math.PI) / 180);
      ctx.scale(fotoCropZoom, fotoCropZoom);
      ctx.translate(fotoCropPositionX, fotoCropPositionY);
      ctx.translate(-imgCenterX, -imgCenterY);

      // Desenhar a imagem
      ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
      
      ctx.restore();

      // Converter canvas para JPEG e salvar
      const imagemCropada = canvas.toDataURL('image/jpeg', 0.95);
      setFotoMembro(imagemCropada);
      setMostrarCropModal(false);
      setFotoOriginal(imagemCropada);
    };
    img.src = fotoOriginal;
  };

  // Função para cancelar crop
  const cancelarCropFoto = () => {
    setMostrarCropModal(false);
    setFotoOriginal(null);
    setFotoCropZoom(1);
    setFotoCropPositionX(0);
    setFotoCropPositionY(0);
    setFotoCropRotacao(0);
  };

  // Controles de mouse para crop
  const handleCropWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomAmount = e.deltaY > 0 ? -0.1 : 0.1; // Scroll down = zoom out, scroll up = zoom in
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
    
    setFotoCropPositionX(prev => Math.max(-200, Math.min(200, prev + deltaX / 2)));
    setFotoCropPositionY(prev => Math.max(-200, Math.min(200, prev + deltaY / 2)));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
  };

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

  const girarCropImagemDireita = () => {
    setFotoCropRotacao((prev) => (prev + 90) % 360);
  };

  const processarERedimensionar = (base64: string, deg = 0): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        // Proporção alvo para o cartão (3:4)
        const targetWidth = 300;
        const targetHeight = 400;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Limpar fundo
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        ctx.save();
        // Centralizar para rotacionar
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.rotate((deg * Math.PI) / 180);

        // Calcular dimensões da imagem rotacionada para o corte
        let drawWidth, drawHeight;
        const targetRatio = targetWidth / targetHeight;

        // Se rotacionado 90 ou 270, invertemos a análise de proporção da fonte
        const isVertical = deg === 90 || deg === 270;
        const sourceWidth = isVertical ? img.height : img.width;
        const sourceHeight = isVertical ? img.width : img.height;
        const sourceRatio = sourceWidth / sourceHeight;

        if (sourceRatio > targetRatio) {
          // Fonte mais larga que o alvo
          drawHeight = targetHeight;
          drawWidth = targetHeight * sourceRatio;
        } else {
          // Alvo mais largo que a fonte
          drawWidth = targetWidth;
          drawHeight = targetWidth / sourceRatio;
        }

        // Desenhar centralizado (a partir do translate de centro)
        // Se isVertical, o drawImage precisa lidar com o fato de que largura/altura da 'img' são fixas
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();

        // JPEG 0.7 para otimização
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
      const rotacionada = await processarERedimensionar(fotoOriginal || fotoMembro as string, novaRotacao);
      setFotoMembro(rotacionada);
    }
  };

  const itemsPerPage = 10;

  // Função para gerar próxima matrícula automática
  const gerarProximaMatricula = () => {
    const ultimaMatricula = Math.max(
      ...membros.map(m => parseInt(m.matricula) || 0),
      0
    );
    return String(ultimaMatricula + 1).padStart(3, '0');
  };

  // Função para abrir novo cadastro
  const abrirNovoCadastro = () => {
    const novaMatricula = gerarProximaMatricula();
    setDadosPessoais({
      matricula: novaMatricula,
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
      observacoes: ''
    });
    setEnderecoData({
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      complemento: '',
      cidade: '',
      latitude: '',
      longitude: ''
    });
    setDadosMinisteriais({
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
      dataEmissao: new Date().toISOString().slice(0, 10),
      dataValidadeCredencial: '',
      observacoesMinisteriais: ''
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

  // Função para validar CPF
  const validarCPF = (cpf: string): boolean => {
    // Remove caracteres especiais
    const cpfLimpo = cpf.replace(/\D/g, '');

    // Verifica se tem 11 dígitos
    if (cpfLimpo.length !== 11) {
      return false;
    }

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpfLimpo)) {
      return false;
    }

    // Permitir CPFs de teste comuns (ex: 123...)
    if (cpfLimpo.startsWith('123456789')) return true;

    // Valida primeiro dígito verificador
    let soma = 0;
    let resto;

    for (let i = 1; i <= 9; i++) {
      soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
    }

    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) {
      resto = 0;
    }

    if (resto !== parseInt(cpfLimpo.substring(9, 10))) {
      return false;
    }

    // Valida segundo dígito verificador
    soma = 0;

    for (let i = 1; i <= 10; i++) {
      soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
    }

    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) {
      resto = 0;
    }

    if (resto !== parseInt(cpfLimpo.substring(10, 11))) {
      return false;
    }

    return true;
  };

  // Função para gerar PDF da listagem de membros
  const gerarPDFListagem = () => {
    const { jsPDF } = require('jspdf');
    const autoTable = require('jspdf-autotable').default;

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const config = configIgreja;

    // Cabeçalho personalizado
    let yPos = 15;

    // Logo à esquerda (se existir)
    if (config.logo) {
      try {
        doc.addImage(config.logo, 'PNG', 14, yPos - 5, 30, 30);
      } catch (error) {
        console.error('Erro ao adicionar logo:', error);
      }
    }

    // Informações da igreja à direita do logo
    const textStartX = config.logo ? 50 : 14;

    // Nome da igreja (título)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(config.nome, textStartX, yPos + 5);

    // Informações de contato
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    let infoY = yPos + 12;
    if (config.endereco) {
      doc.text(config.endereco, textStartX, infoY);
      infoY += 5;
    }

    const contatoInfo = [];
    if (config.cnpj) contatoInfo.push(`CNPJ: ${config.cnpj}`);
    if (config.telefone) contatoInfo.push(`Tel: ${config.telefone}`);
    if (config.email) contatoInfo.push(config.email);

    if (contatoInfo.length > 0) {
      doc.text(contatoInfo.join(' | '), textStartX, infoY);
    }

    // Linha separadora
    yPos = config.logo ? 50 : 35;
    doc.setDrawColor(20, 184, 166); // teal-600
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);

    // Título do relatório
    yPos += 8;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Listagem de Membros', pageWidth / 2, yPos, { align: 'center' });

    // Informações do relatório
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    yPos += 7;

    doc.text(`Total de registros: ${membrosFiltrados.length}`, 14, yPos);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, yPos, { align: 'right' });

    // Preparar dados da tabela
    const tableData = membrosFiltrados.map(membro => [
      membro.matricula,
      membro.nome,
      membro.cpf,
      membro.cargoMinisterial || '',
      (membro as any).dadosCargos?.dataConsagracao
        ? new Date((membro as any).dadosCargos.dataConsagracao).toLocaleDateString('pt-BR')
        : (membro as any).dataConsagracao
          ? new Date((membro as any).dataConsagracao).toLocaleDateString('pt-BR')
          : '-',
      membro.status === 'ativo' ? 'Ativo' : 'Inativo'
    ]);

    // Gerar tabela
    autoTable(doc, {
      startY: yPos + 5,
      head: [['Matrícula', 'Nome', 'CPF', 'Cargo', 'Dt. Consagração', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [20, 184, 166], // teal-600
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { halign: 'left', cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 35 },
        3: { halign: 'left', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 30 },
        5: { halign: 'center', cellWidth: 20 }
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });

    // Rodapé
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Gestão Eklésia - Sistema de Gerenciamento Eclesiástico`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'right' }
      );
    }

    // Salvar PDF
    const dataHora = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    doc.save(`listagem_membros_${dataHora}.pdf`);

    setNotification({
      isOpen: true,
      title: 'Sucesso',
      message: 'PDF gerado com sucesso!',
      type: 'success'
    });
  };

  // Função para abrir edição de membro
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
      observacoes: membro.observacoes || ''
    });
    setEnderecoData({
      cep: membro.cep || '',
      logradouro: membro.logradouro || '',
      numero: membro.numero || '',
      bairro: membro.bairro || '',
      complemento: membro.complemento || '',
      cidade: membro.cidade || '',
      latitude: membro.latitude || '',
      longitude: membro.longitude || ''
    });
    setFotoMembro(membro.fotoUrl || null);
    setFotoOriginal(membro.fotoUrl || null);
    setRotation(0); // Reset rotation on edit
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
      observacoesMinisteriais: membro.observacoesMinisteriais || ''
    });
    setCargoSelecionado(resolveCargoValue(membro.cargoMinisterial));
    setDadosCargos(membro.dadosCargos || {});
    setIsEditando(false);
    setIsAdminMode(true); // Modo admin ativado para edição
    setIsDizimista(membro.isDizimista ?? false);
    setDizimosHistorico([]);
    setCpfDuplicado(false);
    setShowForm(true);
    setActiveTab('dados');
  };

  const abrirDocumentosMembro = async (membro: Membro) => {
    const templatesBase = await ensureTemplatesSnapshot();
    if (!hasActiveTemplate(membro.tipoCadastro, templatesBase)) {
      setNotification({
        isOpen: true,
        title: 'Template Ausente',
        message: getMensagemSemTemplate(membro.tipoCadastro),
        type: 'warning'
      });
      return;
    }

    setMembroImprimindoCartao(membro);
  };

  // Função para salvar/atualizar membro


  const salvarMembro = async () => {
    console.log('💾 Iniciando salvamento do membro...');
    console.log('Dados Pessoais:', dadosPessoais);

    // Bloquear se CPF duplicado foi detectado
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

    // Validar campos obrigatórios
    if (!dadosPessoais.cpf || !dadosPessoais.nome || !dadosPessoais.dataNascimento) {
      console.warn('⚠️ Erro: Campos obrigatórios ausentes');
      setNotification({
        isOpen: true,
        title: 'Erro de Validação',
        message: 'Preencha todos os campos obrigatórios: CPF, Nome e Data de Nascimento',
        type: 'error'
      });
      return;
    }

    // Validar CPF
    if (!validarCPF(dadosPessoais.cpf)) {
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: 'CPF inválido. Verifique o número digitado',
        type: 'error'
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
        // Compatibilidade entre telas/fluxos que usam nomes diferentes para o mesmo dado
        cargoMinisterial: cargoSelecionado || null,
        cargo_ministerial: cargoSelecionado || null,
      };

      const latitudeNumber = enderecoData.latitude ? Number(String(enderecoData.latitude).replace(',', '.')) : null
      const longitudeNumber = enderecoData.longitude ? Number(String(enderecoData.longitude).replace(',', '.')) : null

      // Converte para maiúsculo, retorna null se vazio
      const u = (v: string | null | undefined): string | null => v ? v.toUpperCase().trim() : null;

      const payloadBase: any = {
        name: (dadosPessoais.nome || '').toUpperCase().trim(),
        cpf: onlyDigits(dadosPessoais.cpf) || null,
        email: dadosPessoais.email?.trim().toLowerCase() || null,
        phone: dadosPessoais.celular || null,
        // Aba Dados
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
        // Aba Endereço
        cep: onlyDigits(enderecoData.cep) || null,
        logradouro: u(enderecoData.logradouro),
        numero: u(enderecoData.numero),
        bairro: u(enderecoData.bairro),
        complemento: u(enderecoData.complemento),
        cidade: u(enderecoData.cidade),
        estado: u(dadosPessoais.uf),
        // Aba Contato
        celular: dadosPessoais.celular || null,
        whatsapp: dadosPessoais.whatsapp || null,
        // Geolocalização
        congregacao_id: congregacoes.find((cg) => cg.nome === dadosPessoais.supervisao)?.id || null,
        latitude: Number.isFinite(latitudeNumber) ? latitudeNumber : null,
        longitude: Number.isFinite(longitudeNumber) ? longitudeNumber : null,
        // Aba Ministerial
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
        // Aba Foto
        foto_url: fotoMembro || null,
        // Dizimistas
        is_dizimista: isDizimista || dadosPessoais.tipoCadastro === 'ministro',
        // Datas ministeriais
        data_consagracao: dadosMinisteriais.dataConsagracao || null,
        data_emissao: dadosMinisteriais.dataEmissao || null,
        data_validade_credencial: dadosMinisteriais.dataValidadeCredencial || null,
        // Sistema
        status: uiStatusToDb('ativo'),
        role: dadosPessoais.tipoCadastro,
        observacoes: u(dadosPessoais.observacoes),
        custom_fields,
      };

      if (membroEditando) {
        const payload: any = payloadBase;
        await updateMember(membroEditando.id, payload);
        await fetchMembers(1, 500);
        setNotification({
          isOpen: true,
          title: 'Sucesso',
          message: 'Membro atualizado com sucesso!',
          type: 'success'
        });
      } else {
        const created = await createMember(payloadBase);
        await fetchMembers(1, 500);
        const createdUi = memberToMembro(created as unknown as any);
        setUltimoCadastro(createdUi);
        setNotification({
          isOpen: true,
          title: 'Sucesso',
          message: 'Novo membro cadastrado com sucesso!',
          type: 'success'
        });
      }
    } catch (e) {
      console.error('Erro ao salvar membro (API):', e);
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: e instanceof Error ? e.message : 'Erro ao salvar membro',
        type: 'error'
      });
      return;
    }

    // Limpar formulário completamente
    resetarFormulario();
  };

  // Função para resetar todos os dados do formulário
  const resetarFormulario = () => {
    setDadosPessoais({
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
      observacoes: ''
    });
    setEnderecoData({
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      complemento: '',
      cidade: '',
      latitude: '',
      longitude: ''
    });
    setDadosMinisteriais({
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
      dataEmissao: '',      dataValidadeCredencial: '',
      observacoesMinisteriais: ''
    });
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

  // Função para fechar formulário
  const fecharFormulario = () => {
    resetarFormulario();
  };



  // Função para abrir modal de confirmação de deleção
  const abrirConfirmacaoDeletar = (membro: Membro) => {
    setMembroDeletando(membro);
  };

  // Função para deletar membro
  const deletarMembro = async () => {
    if (!membroDeletando) return;

    try {
      await deleteMember(membroDeletando.id);
      await fetchMembers(1, 500);
      setNotification({
        isOpen: true,
        title: 'Sucesso',
        message: `Membro "${membroDeletando.nome}" foi deletado com sucesso!`,
        type: 'success'
      });
      setMembroDeletando(null);
    } catch (e) {
      console.error('Erro ao deletar membro (API):', e);
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: e instanceof Error ? e.message : 'Erro ao deletar membro',
        type: 'error'
      });
    }
  };

  // Função para cancelar deleção
  const cancelarDeletar = () => {
    setMembroDeletando(null);
  };

  // Função para buscar CEP e preencher endereço automaticamente
  const buscarCEP = async () => {
    const cepLimpo = enderecoData.cep.replace(/\D/g, '');

    if (!cepLimpo || cepLimpo.length !== 8) {
      setNotification({
        isOpen: true,
        title: 'Aviso',
        message: 'Digite um CEP válido com 8 dígitos',
        type: 'warning'
      });
      // Limpar dados de endereço quando CEP inválido
      setEnderecoData(prev => ({
        ...prev,
        logradouro: '',
        bairro: '',
        cidade: '',
        complemento: '',
        latitude: '',
        longitude: ''
      }));
      return;
    }

    try {
      console.log('🔎 Buscando CEP:', cepLimpo);
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

      if (!response.ok) {
        throw new Error('Erro ao conectar com ViaCEP');
      }

      const data = await response.json();
      console.log('📮 Resposta ViaCEP:', data);

      if (data.erro) {
        setNotification({
          isOpen: true,
          title: 'Aviso',
          message: 'CEP não encontrado. Verifique o número.',
          type: 'warning'
        });
        // Limpar dados
        setEnderecoData(prev => ({
          ...prev,
          logradouro: '',
          bairro: '',
          cidade: '',
          complemento: '',
          latitude: '',
          longitude: ''
        }));
        return;
      }

      const novoEndereco = {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        complemento: data.complemento || ''
      };

      console.log('📝 Novo endereço:', novoEndereco);

      // Primeiro, atualizar o estado com o novo endereço
      const enderecoAtualizado = {
        ...enderecoData,
        ...novoEndereco,
        latitude: '',
        longitude: ''
      };

      setEnderecoData(enderecoAtualizado);

      // Após atualizar, fazer geocodificação
      if (novoEndereco.logradouro && novoEndereco.cidade) {
        console.log('🌍 Iniciando geocodificação automática...');

        // Construir endereço com dados do estado atual
        const partesEndereco = [
          novoEndereco.logradouro,
          enderecoData.numero, // Usar o número que estava antes
          novoEndereco.bairro,
          novoEndereco.cidade
        ].filter(Boolean);

        const enderecoCompleto = partesEndereco.join(', ');
        console.log('📍 Endereço para geocoding:', enderecoCompleto);

        // Fazer requisição de geocoding
        try {
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(enderecoCompleto)}&format=json&limit=1`
          );

          if (!geoResponse.ok) {
            throw new Error('Erro ao conectar com Nominatim');
          }

          const geoData = await geoResponse.json();
          console.log('📍 Resposta Nominatim:', geoData);

          if (geoData && geoData.length > 0) {
            const latitude = parseFloat(geoData[0].lat).toFixed(4);
            const longitude = parseFloat(geoData[0].lon).toFixed(4);
            console.log('✅ Coordenadas encontradas:', { latitude, longitude });

            setEnderecoData(prev => ({
              ...prev,
              latitude: latitude,
              longitude: longitude
            }));
          } else {
            console.log('⚠️ Nenhuma coordenada encontrada para este endereço');
          }
        } catch (geoError) {
          console.error('❌ Erro na geocodificação:', geoError);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao buscar CEP:', error);
      setNotification({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao buscar CEP. Tente novamente.',
        type: 'error'
      });
      // Limpar dados em caso de erro
      setEnderecoData(prev => ({
        ...prev,
        logradouro: '',
        bairro: '',
        cidade: '',
        complemento: '',
        latitude: '',
        longitude: ''
      }));
    }
  };


  // Filtrar membros
  const membrosFiltrados = membros.filter(m => {
    const matchSearch = m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.cpf.includes(searchTerm) ||
      m.matricula.includes(searchTerm);
    const matchStatus = statusFilter === 'TODOS' || m.status.toUpperCase() === statusFilter;
    const matchCargo = cargoFilter === 'TODOS' || (m.cargoMinisterial || '').toUpperCase() === cargoFilter.toUpperCase();
    return matchSearch && matchStatus && matchCargo;
  });

  const totalPages = Math.ceil(membrosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const membrosPaginados = membrosFiltrados.slice(startIndex, endIndex);







  if (bloqueado) return null;

  return (
    <>
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        autoClose={notification.autoClose}
        showButton={notification.showButton !== undefined ? notification.showButton : true}
      />

      {/* Modal de Confirmação de Deleção */}
      <ConfirmDeleteModal
        isOpen={!!membroDeletando}
        membro={membroDeletando}
        onConfirm={deletarMembro}
        onCancel={cancelarDeletar}
      />

      {/* Modal de Crop de Foto - Enquadrar Foto 3x4 */}
      {mostrarCropModal && fotoOriginal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b-2 border-teal-500 bg-gradient-to-r from-teal-600 to-teal-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🖼️</span> Enquadrar Foto (3x4)
              </h2>
              <button
                onClick={cancelarCropFoto}
                className="text-white hover:text-gray-100 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-4">

              {/* Área de Preview com proporcao 3x4 */}
              <div className="bg-gray-100 rounded-lg p-4 flex justify-center">
                <div 
                  ref={previewAreaRef}
                  className="relative bg-black rounded-lg overflow-hidden cursor-grab active:cursor-grabbing select-none aspect-[3/4]" 
                  style={{ width: '220px', height: '293px' }}
                  onWheel={handleCropWheel}
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleCropMouseMove}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                >
                  <canvas
                    ref={canvasRefCrop}
                    width={220}
                    height={293}
                    className="hidden"
                  />
                  <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-gray-900">
                    <img
                      src={fotoOriginal}
                      alt="Preview para crop"
                      className="w-full h-full object-cover pointer-events-none"
                      style={{
                        transform: `rotate(${fotoCropRotacao}deg) scale(${fotoCropZoom}) translateX(${fotoCropPositionX}px) translateY(${fotoCropPositionY}px)`,
                        transformOrigin: 'center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Controles de Rotação */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Rotação</label>
                <div className="flex gap-3 justify-center items-center">
                  <button
                    onClick={girarCropImagemEsquerda}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition"
                  >
                    ↺ 90° Esq
                  </button>
                  <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-2 rounded min-w-[50px] text-center">{fotoCropRotacao}°</span>
                  <button
                    onClick={girarCropImagemDireita}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition"
                  >
                    90° Dir ↻
                  </button>
                </div>
              </div>

              {/* Controles de Zoom */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-semibold text-gray-700">Zoom</label>
                  <span className="text-xs font-bold text-teal-600 bg-teal-100 px-2 py-1 rounded">{fotoCropZoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={fotoCropZoom}
                  onChange={(e) => setFotoCropZoom(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1x</span>
                  <span>3x</span>
                </div>
              </div>

              {/* Controles de Posição */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-gray-700">Posição</label>
                  <button
                    onClick={resetCropView}
                    className="text-xs px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
                  >
                    ↺ Resetar
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Horizontal</label>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      step="5"
                      value={fotoCropPositionX}
                      onChange={(e) => setFotoCropPositionX(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Vertical</label>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      step="5"
                      value={fotoCropPositionY}
                      onChange={(e) => setFotoCropPositionY(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Botões */}
            <div className="flex gap-4 px-6 py-4 border-t border-gray-300 bg-gray-50">
              <button
                onClick={confirmarCropFoto}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition font-bold text-sm"
              >
                ✓ Confirmar Enquadramento
              </button>
              <button
                onClick={cancelarCropFoto}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-bold text-sm"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Impressão e Carteirinha */}
      <MembroCarteirinhaModal
        membroImprimindo={membroImprimindo}
        setMembroImprimindo={setMembroImprimindo}
        membroImprimindoCartao={membroImprimindoCartao}
        setMembroImprimindoCartao={setMembroImprimindoCartao}
        imprimindoLote={imprimindoLote}
        setImprimindoLote={setImprimindoLote}
        membrosSelecionados={membrosSelecionados}
        setMembrosSelecionados={setMembrosSelecionados}
        membros={membros}
        configIgreja={configIgreja}
        setNotification={setNotification}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-6 max-w-[96rem] mx-auto w-full">
          {/* Navegação de Abas - Dashboard vs Dados de Ministros */}
          <div className="bg-white rounded-lg shadow-md mb-6 border-b-4 border-teal-500">
            <div className="flex items-center gap-4 p-4">
              <button
                onClick={() => setDashboardView('overview')}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  dashboardView === 'overview'
                    ? 'bg-teal-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setDashboardView('list')}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  dashboardView === 'list'
                    ? 'bg-teal-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                👥 Dados de Membros
              </button>
            </div>
          </div>

          {membersError && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
              <p className="text-amber-900 font-semibold">{membersError}</p>
              {membersError === 'Usuário sem ministério associado' && (
                <p className="text-amber-900 text-sm mt-1">
                  Seu usuário ainda não está vinculado a um ministério. Se você acabou de se cadastrar, aguarde a liberação/associação do seu acesso.
                </p>
              )}
            </div>
          )}

          {/* Vista - Dashboard */}
          {dashboardView === 'overview' && (
            <div>
              <MembrosOverview 
                membros={membros}
                nivelUsuario="administrador"
                maxMembros={maxMembros}
              />
            </div>
          )}

          {/* Vista - Dados de Ministros (Listagem completa) */}
          {dashboardView === 'list' && (
            <div>
              {/* Toolbar de Filtros e Pesquisa */}
              <MembrosToolbar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                cargoFilter={cargoFilter}
                setCargoFilter={setCargoFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                setCurrentPage={setCurrentPage}
                cargosMinisteriais={cargosMinisteriais as any}
                membrosFiltradosCount={membrosFiltrados.length}
                totalMembrosCount={membros.length}
                isSupervisor={isSupervisor}
                limiteMembrosAtingido={limiteMembrosAtingido}
                maxMembros={maxMembros}
                abrirNovoCadastro={abrirNovoCadastro}
                ultimoCadastro={ultimoCadastro}
                gerarProximaMatricula={gerarProximaMatricula}
                setDadosPessoais={setDadosPessoais}
                setEnderecoData={setEnderecoData}
                setDadosMinisteriais={setDadosMinisteriais}
                setCargoSelecionado={setCargoSelecionado}
                setDadosCargos={setDadosCargos}
                setIsEditando={setIsEditando}
                setShowForm={setShowForm}
                setActiveTab={setActiveTab as any}
                resolveCargoValue={resolveCargoValue}
                gerarPDFListagem={gerarPDFListagem}
                membrosSelecionadosCount={membrosSelecionados.size}
                setImprimindoLote={setImprimindoLote}
                setNotification={setNotification}
              />

              {/* Tabela de Membros */}
              <MembrosTable
                membrosPaginados={membrosPaginados}
                membrosFiltradosCount={membrosFiltrados.length}
                membrosSelecionados={membrosSelecionados}
                setMembrosSelecionados={setMembrosSelecionados}
                maskCpf={maskCpf}
                isSupervisor={isSupervisor}
                isAuxiliar={isAuxiliar}
                setMembroImprimindo={setMembroImprimindo}
                abrirEdicao={abrirEdicao}
                abrirDocumentosMembro={abrirDocumentosMembro}
                abrirConfirmacaoDeletar={abrirConfirmacaoDeletar}
                ensureTemplatesSnapshot={ensureTemplatesSnapshot}
                hasActiveTemplate={hasActiveTemplate}
                getMensagemSemTemplate={getMensagemSemTemplate}
                setNotification={setNotification}
                setMembroImprimindoCartao={setMembroImprimindoCartao}
                startIndex={startIndex}
                endIndex={endIndex}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
              />
              {/* Modal de Formulário */}
              <MembroFormModal
                showForm={showForm}
                setShowForm={setShowForm}
                membroEditando={membroEditando}
                activeTab={activeTab}
                setActiveTab={(tab: any) => setActiveTab(tab)}
                dadosPessoais={dadosPessoais}
                setDadosPessoais={setDadosPessoais}
                enderecoData={enderecoData}
                setEnderecoData={setEnderecoData}
                dadosMinisteriais={dadosMinisteriais}
                setDadosMinisteriais={setDadosMinisteriais}
                cargoSelecionado={cargoSelecionado}
                setCargoSelecionado={setCargoSelecionado}
                dadosCargos={dadosCargos}
                setDadosCargos={setDadosCargos}
                nomenclaturas={nomenclaturas}
                supervisoesOptions={supervisoesFromNomenclaturas}
                camposOptions={camposFromNomenclaturas}
                congregacoesOptions={congregacoesFromNomenclaturas}
                cargosMinisteriais={cargosMinisteriais as any}
                buscarCep={buscarCEP}
                loadingCep={false}
                fotoMembro={fotoMembro}
                setFotoMembro={setFotoMembro}
                fileInputRef={fileInputRef}
                handleFotoUpload={handleFotoUpload}
                handleGirarFoto={handleGirarFoto}
                salvarMembro={salvarMembro}
                fecharFormulario={fecharFormulario}
                dizimosHistorico={dizimosHistorico}
                loadingDizimosHistorico={loadingDizimosHistorico}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
