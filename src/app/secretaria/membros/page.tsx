'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import NotificationModal from '@/components/NotificationModal';
import FichaMembro from '@/components/FichaMembro';
import CartãoMembro from '@/components/CartãoMembro';
import CartaoBatchPrinter from '@/components/CartaoBatchPrinter';
import MembrosOverview from '@/components/MembrosOverview';
import { getCargosMinisteriais, type CargoMinisterial } from '@/lib/cargos-utils';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import { getMensagemSemTemplate } from '@/lib/cartoes-utils';
import { createClient } from '@/lib/supabase-client';
import { loadOrgNomenclaturasFromSupabaseOrMigrate } from '@/lib/org-nomenclaturas';
import { loadTemplatesForCurrentUser } from '@/lib/cartoes-templates-sync';
import { useMembers } from '@/hooks/useMembers';
import type { Member, CreateMemberRequest, UpdateMemberRequest } from '@/types/supabase';

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
}

interface DivisaoOption {
  id: string;
  nome: string;
  supervisao_id?: string | null;
  campo_id?: string | null;
}

export default function MembrosPage() {
  const supabase = createClient();

  const [dashboardView, setDashboardView] = useState<'overview' | 'list'>('overview');
  const [activeMenu, setActiveMenu] = useState('membros');
  const [activeTab, setActiveTab] = useState('dados');
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

  const formatPhone = (value: string) => {
    const digits = onlyDigits(value).slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const normalizeTipoCadastro = (value: any): Membro['tipoCadastro'] => {
    const v = String(value || '').toLowerCase();
    if (v === 'membro' || v === 'congregado' || v === 'ministro' || v === 'crianca') return v as any;
    return 'ministro';
  };

  const dbStatusToUi = (status: Member['status'] | null | undefined): Membro['status'] =>
    status === 'active' ? 'ativo' : 'inativo';

  const uiStatusToDb = (status: Membro['status']): Member['status'] =>
    status === 'ativo' ? 'active' : 'inactive';

  const memberToMembro = (member: Member): Membro => {
    const cf = (member.custom_fields && typeof member.custom_fields === 'object') ? member.custom_fields : {};
    const cargoMinisterial = String(
      (cf as any).cargoMinisterial ||
      (cf as any).cargo_ministerial ||
      member.cargo_ministerial ||
      member.profissao ||
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
      qualFuncao: String(member.qual_funcao || member.profissao || (cf as any).qualFuncao || ''),
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
      console.error('Erro ao carregar membros (API):', e);
    });
  }, [fetchMembers]);

  // Projetar o formato do banco (Member) para o formato usado pela UI (Membro)
  useEffect(() => {
    setMembros(membersApi.map(memberToMembro));
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

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ATIVO');
  const [currentPage, setCurrentPage] = useState(1);
  const [membroEditando, setMembroEditando] = useState<Membro | null>(null);
  const [membroDeletando, setMembroDeletando] = useState<Membro | null>(null);
  const [membroImprimindo, setMembroImprimindo] = useState<Membro | null>(null);
  const [membroImprimindoCartao, setMembroImprimindoCartao] = useState<Membro | null>(null);
  const [ultimoCadastro, setUltimoCadastro] = useState<Membro | null>(null);
  const [membrosSelecionados, setMembrosSelecionados] = useState<Set<string>>(new Set());
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
  const [dadosPessoais, setDadosPessoais] = useState({
    matricula: '',
    cpf: '',
    tipoCadastro: 'ministro', // Convenção do projeto
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
    whatsapp: ''
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
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isEditando, setIsEditando] = useState(false);

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

  const [supervisoes, setSupervisoes] = useState<DivisaoOption[]>([]);
  const [campos, setCampos] = useState<DivisaoOption[]>([]);
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
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const mu = await supabase
        .from('ministry_users')
        .select('ministry_id')
        .eq('user_id', user.id)
        .limit(1);
      const ministryIdFromMu = (mu.data as any)?.[0]?.ministry_id as string | undefined;
      if (ministryIdFromMu) return ministryIdFromMu;

      const m = await supabase
        .from('ministries')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      const ministryIdFromOwner = (m.data as any)?.[0]?.id as string | undefined;
      return ministryIdFromOwner || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const loadEstruturaOptions = async () => {
      const ministryId = await resolveMinistryId();
      if (!ministryId) return;

      const [s, c, g] = await Promise.all([
        supabase.from('supervisoes').select('id,nome,is_active').eq('ministry_id', ministryId).eq('is_active', true).order('nome'),
        supabase.from('campos').select('id,nome,supervisao_id,is_active').eq('ministry_id', ministryId).eq('is_active', true).order('nome'),
        supabase.from('congregacoes').select('id,nome,supervisao_id,campo_id,is_active').eq('ministry_id', ministryId).eq('is_active', true).order('nome'),
      ]);

      if (s.error) console.warn('Falha ao carregar 1a divisao:', s.error);
      if (c.error) console.warn('Falha ao carregar 2a divisao:', c.error);
      if (g.error) console.warn('Falha ao carregar 3a divisao:', g.error);

      setSupervisoes(((s.data as any[]) || []).map((row: any) => ({ id: row.id, nome: row.nome })));
      setCampos(((c.data as any[]) || []).map((row: any) => ({ id: row.id, nome: row.nome, supervisao_id: row.supervisao_id })));
      setCongregacoes(((g.data as any[]) || []).map((row: any) => ({ id: row.id, nome: row.nome, supervisao_id: row.supervisao_id, campo_id: row.campo_id })));
    };

    loadEstruturaOptions().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sanitizeNome = (value: unknown) => String(value || '').trim();

  const dedupByNome = (items: DivisaoOption[]): DivisaoOption[] => {
    const seen = new Set<string>();
    const out: DivisaoOption[] = [];
    items.forEach((item) => {
      const nome = sanitizeNome(item.nome);
      if (!nome) return;
      const key = nome.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...item, nome });
    });
    return out;
  };

  const supervisoesFromNomenclaturas = ((orgNomenclaturasRaw?.divisaoPrincipal?.custom || []) as string[])
    .map((nome, idx) => ({ id: `cfg-s-${idx}-${nome}`, nome: sanitizeNome(nome) }))
    .filter((opt) => !!opt.nome);
  const camposFromNomenclaturas = ((orgNomenclaturasRaw?.divisaoSecundaria?.custom || []) as string[])
    .map((nome, idx) => ({ id: `cfg-c-${idx}-${nome}`, nome: sanitizeNome(nome) }))
    .filter((opt) => !!opt.nome);
  const congregacoesFromNomenclaturas = ((orgNomenclaturasRaw?.divisaoTerciaria?.custom || []) as string[])
    .map((nome, idx) => ({ id: `cfg-g-${idx}-${nome}`, nome: sanitizeNome(nome) }))
    .filter((opt) => !!opt.nome);

  const supervisoesFromMembers = dedupByNome(
    (membersApi || [])
      .map((m: any, idx: number) => ({ id: `legacy-s-${idx}`, nome: sanitizeNome((m?.custom_fields as any)?.supervisao) }))
      .filter((opt: any) => !!opt.nome)
  );
  const camposFromMembers = dedupByNome(
    (membersApi || [])
      .map((m: any, idx: number) => ({ id: `legacy-c-${idx}`, nome: sanitizeNome((m?.custom_fields as any)?.campo) }))
      .filter((opt: any) => !!opt.nome)
  );
  const congregacoesFromMembers = dedupByNome(
    (membersApi || [])
      .map((m: any, idx: number) => ({ id: `legacy-g-${idx}`, nome: sanitizeNome((m?.custom_fields as any)?.congregacao) }))
      .filter((opt: any) => !!opt.nome)
  );

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
      tipoCadastro: 'ministro',
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
      whatsapp: ''
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
    doc.text('Listagem de Ministros', pageWidth / 2, yPos, { align: 'center' });

    // Informações do relatório
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    yPos += 7;

    doc.text(`Total de registros: ${membros.length}`, 14, yPos);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, yPos, { align: 'right' });

    // Preparar dados da tabela
    const tableData = membros.map(membro => [
      membro.matricula,
      membro.nome,
      membro.cpf,
      membro.supervisao || '-',
      membro.campo || '-',
      membro.status === 'ativo' ? 'Ativo' : 'Inativo'
    ]);

    // Gerar tabela
    autoTable(doc, {
      startY: yPos + 5,
      head: [['Matrícula', 'Nome', 'CPF', 'Supervisão', 'Campo', 'Status']],
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
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'left', cellWidth: 30 },
        4: { halign: 'left', cellWidth: 30 },
        5: { halign: 'left', cellWidth: 30 },
        6: { halign: 'center', cellWidth: 20 }
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
    doc.save(`listagem_ministros_${dataHora}.pdf`);

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
      tipoCadastro: 'ministro',
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
      whatsapp: membro.whatsapp || ''
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
    setShowForm(true);
    setActiveTab('dados');
  };

  // Função para salvar/atualizar membro
  const salvarMembro = async () => {
    console.log('💾 Iniciando salvamento do membro...');
    console.log('Dados Pessoais:', dadosPessoais);

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
        tipoCadastro: 'ministro',
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

      const payloadBase: CreateMemberRequest = {
        name: dadosPessoais.nome,
        cpf: onlyDigits(dadosPessoais.cpf) || null,
        email: dadosPessoais.email || null,
        phone: dadosPessoais.celular || null,
        // Aba Dados
        matricula: dadosPessoais.matricula || null,
        unique_id: baseForCustom.uniqueId || null,
        tipo_cadastro: 'ministro',
        data_nascimento: dadosPessoais.dataNascimento || null,
        sexo: dadosPessoais.sexo || null,
        tipo_sanguineo: dadosPessoais.tipoSanguineo || null,
        escolaridade: dadosPessoais.escolaridade || null,
        estado_civil: dadosPessoais.estadoCivil || null,
        nome_conjuge: dadosPessoais.nomeConjuge || null,
        cpf_conjuge: dadosPessoais.cpfConjuge ? onlyDigits(dadosPessoais.cpfConjuge) : null,
        data_nascimento_conjuge: dadosPessoais.dataNascimentoConjuge || null,
        nome_pai: dadosPessoais.nomePai || null,
        nome_mae: dadosPessoais.nomeMae || null,
        rg: dadosPessoais.rg || null,
        orgao_emissor: dadosPessoais.orgaoEmissor || null,
        nacionalidade: dadosPessoais.nacionalidade || null,
        naturalidade: dadosPessoais.naturalidade || null,
        uf_naturalidade: dadosPessoais.uf || null,
        data_batismo_aguas: dadosMinisteriais.dataBatismoAguas || null,
        data_batismo_espirito_santo: dadosMinisteriais.dataBatismoEspiritoSanto || null,
        // Aba Endereço
        cep: onlyDigits(enderecoData.cep) || null,
        logradouro: enderecoData.logradouro || null,
        numero: enderecoData.numero || null,
        bairro: enderecoData.bairro || null,
        complemento: enderecoData.complemento || null,
        cidade: enderecoData.cidade || null,
        estado: dadosPessoais.uf || null,
        // Aba Contato
        celular: dadosPessoais.celular || null,
        whatsapp: dadosPessoais.whatsapp || null,
        // Geolocalização
        congregacao_id: congregacoes.find((cg) => cg.nome === dadosPessoais.supervisao)?.id || null,
        latitude: Number.isFinite(latitudeNumber) ? latitudeNumber : null,
        longitude: Number.isFinite(longitudeNumber) ? longitudeNumber : null,
        // Aba Ministerial
        profissao: dadosMinisteriais.qualFuncao || cargoSelecionado || null,
        curso_teologico: dadosMinisteriais.cursoTeologico || null,
        instituicao_teologica: dadosMinisteriais.instituicaoTeologica || null,
        pastor_auxiliar: dadosMinisteriais.pastorAuxiliar ?? false,
        procedencia: dadosMinisteriais.procedencia || null,
        procedencia_local: dadosMinisteriais.procedenciaLocal || null,
        cargo_ministerial: cargoSelecionado || null,
        dados_cargos: dadosCargos || {},
        tem_funcao_igreja: dadosMinisteriais.temFuncaoIgreja ?? false,
        qual_funcao: dadosMinisteriais.qualFuncao || null,
        setor_departamento: dadosMinisteriais.setorDepartamento || null,
        observacoes_ministeriais: dadosMinisteriais.observacoesMinisteriais || null,
        // Aba Foto
        foto_url: fotoMembro || null,
        // Datas ministeriais
        data_consagracao: dadosMinisteriais.dataConsagracao || null,
        data_emissao: dadosMinisteriais.dataEmissao || null,
        data_validade_credencial: dadosMinisteriais.dataValidadeCredencial || null,
        // Sistema
        status: uiStatusToDb('ativo'),
        role: 'ministro',
        observacoes: null,
        custom_fields,
      };

      if (membroEditando) {
        const payload: UpdateMemberRequest = payloadBase;
        await updateMember(membroEditando.id, payload);
        await fetchMembers(1, 500);
        setNotification({
          isOpen: true,
          title: 'Sucesso',
          message: 'Ministro atualizado com sucesso!',
          type: 'success'
        });
      } else {
        const created = await createMember(payloadBase);
        await fetchMembers(1, 500);
        const createdUi = memberToMembro(created as unknown as Member);
        setUltimoCadastro(createdUi);
        setNotification({
          isOpen: true,
          title: 'Sucesso',
          message: 'Novo ministro cadastrado com sucesso!',
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
      tipoCadastro: 'ministro',
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
      whatsapp: ''
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
      dataEmissao: '',
      dataValidadeCredencial: '',
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
        message: `Ministro "${membroDeletando.nome}" foi deletado com sucesso!`,
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
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(membrosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const membrosPaginados = membrosFiltrados.slice(startIndex, endIndex);

  const supervisoesOptions = supervisoes.length
    ? dedupByNome([...supervisoes])
    : dedupByNome([
        ...supervisoes,
        ...supervisoesFromMembers,
        ...supervisoesFromNomenclaturas,
      ]);
  const camposOptions = campos.length
    ? dedupByNome([...campos])
    : dedupByNome([
        ...campos,
        ...camposFromMembers,
        ...camposFromNomenclaturas,
      ]);
  const congregacoesOptions = congregacoes.length
    ? dedupByNome([...congregacoes])
    : dedupByNome([
        ...congregacoes,
        ...congregacoesFromMembers,
        ...congregacoesFromNomenclaturas,
      ]);

  const isDbOption = (id?: string | null) => !!id && !id.startsWith('legacy-') && !id.startsWith('cfg-');

  // Mapeamento da tela atual:
  // 1ª Divisão = Congregação, 2ª Divisão = Setor, 3ª Divisão = Regional.
  const divisao1Options = congregacoesOptions;
  const divisao2Options = camposOptions;
  const divisao3Options = supervisoesOptions;

  const divisao1Selecionada = divisao1Options.find((o) => o.nome === dadosPessoais.supervisao) || null;
  const divisao2Selecionada = divisao2Options.find((o) => o.nome === dadosPessoais.campo) || null;

  const divisao2Filtradas = (divisao1Selecionada?.campo_id && isDbOption(divisao1Selecionada.id))
    ? divisao2Options.filter((o) => o.id === divisao1Selecionada.campo_id)
    : divisao2Options;

  const divisao3Filtradas = divisao3Options.filter((o) => {
    if (divisao2Selecionada?.supervisao_id && isDbOption(divisao2Selecionada.id)) {
      return o.id === divisao2Selecionada.supervisao_id;
    }
    if (divisao1Selecionada?.supervisao_id && isDbOption(divisao1Selecionada.id)) {
      return o.id === divisao1Selecionada.supervisao_id;
    }
    return true;
  });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

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
      {membroDeletando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-red-500 bg-gradient-to-r from-red-600 to-red-700">
              <span className="text-3xl">⚠️</span>
              <h2 className="text-lg font-bold text-white">Confirmar Deleção</h2>
            </div>

            {/* Conteúdo */}
            <div className="px-6 py-6 space-y-4">
              <p className="text-gray-700 font-semibold">
                Tem certeza que deseja deletar este ministro?
              </p>
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Matrícula:</span> {membroDeletando.matricula}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Nome:</span> {membroDeletando.nome}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">CPF:</span> {membroDeletando.cpf}
                </p>
              </div>
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                <p className="text-xs text-yellow-800">
                  <span className="font-semibold">⚠️ Atenção:</span> Esta ação é irreversível e não pode ser desfeita.
                </p>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-4 px-6 py-4 border-t border-gray-300 bg-gray-50">
              <button
                onClick={deletarMembro}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition font-semibold text-sm"
              >
                ✓ Deletar
              </button>
              <button
                onClick={cancelarDeletar}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold text-sm"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal de Impressão - Ficha do Ministro */}
      {membroImprimindo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b-2 border-teal-500 bg-gradient-to-r from-teal-600 to-teal-700 flex-shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🖨️</span> Ficha do Ministro
              </h2>
              <button
                onClick={() => setMembroImprimindo(null)}
                className="text-white hover:text-gray-100 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo da Ficha com scroll */}
            <div className="flex-1 overflow-y-auto p-6">
              <FichaMembro
                membro={{
                  matricula: membroImprimindo.matricula,
                  id: membroImprimindo.id,
                  uniqueId: membroImprimindo.uniqueId,
                  nome: membroImprimindo.nome,
                  cpf: membroImprimindo.cpf,
                  tipoCadastro: membroImprimindo.tipoCadastro,
                  dataNascimento: membroImprimindo.dataNascimento || '',
                  sexo: membroImprimindo.sexo || '',
                  tipoSanguineo: membroImprimindo.tipoSanguineo || '',
                  escolaridade: membroImprimindo.escolaridade || '',
                  estadoCivil: membroImprimindo.estadoCivil || '',
                  rg: membroImprimindo.rg || '',
                  nacionalidade: membroImprimindo.nacionalidade || '',
                  naturalidade: membroImprimindo.naturalidade || '',
                  uf: membroImprimindo.uf || '',
                  cep: membroImprimindo.cep || '',
                  logradouro: membroImprimindo.logradouro || '',
                  numero: membroImprimindo.numero || '',
                  bairro: membroImprimindo.bairro || '',
                  complemento: membroImprimindo.complemento || '',
                  cidade: membroImprimindo.cidade || '',
                  nomeConjuge: membroImprimindo.nomeConjuge || '',
                  cpfConjuge: membroImprimindo.cpfConjuge || '',
                  dataNascimentoConjuge: membroImprimindo.dataNascimentoConjuge || '',
                  nomePai: membroImprimindo.nomePai || '',
                  nomeMae: membroImprimindo.nomeMae || '',
                  email: membroImprimindo.email || '',
                  celular: membroImprimindo.celular || '',
                  whatsapp: membroImprimindo.whatsapp || '',
                  qualFuncao: membroImprimindo.qualFuncao || '',
                  setorDepartamento: membroImprimindo.setorDepartamento || ''
                }}
                dadosIgreja={(() => {
                  return {
                    nomeIgreja: configIgreja.nome || 'Igreja',
                    endereco: configIgreja.endereco || '',
                    telefone: configIgreja.telefone || '',
                    email: configIgreja.email || '',
                    logoUrl: configIgreja.logo || undefined
                  };
                })()}
                fotoUrl={membroImprimindo.fotoUrl || undefined}
              />
            </div>

            {/* Botão de Fechar */}
            <div className="flex gap-4 px-6 py-4 border-t border-gray-300 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setMembroImprimindo(null)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold text-sm"
              >
                ✕ Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão - Cartão do Membro */}
      {membroImprimindoCartao && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <CartãoMembro
            membro={membroImprimindoCartao}
            onClose={() => setMembroImprimindoCartao(null)}
          />
        </div>
      )}

      {/* Modal de Impressão em Lote - Cartões */}
      {imprimindoLote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b-2 border-purple-500 bg-gradient-to-r from-purple-600 to-purple-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🎫</span> Impressão em Lote
              </h2>
              <button
                onClick={() => setImprimindoLote(false)}
                className="text-white hover:text-gray-100 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 font-semibold mb-4">
                  Pronto para imprimir cartões de {membrosSelecionados.size} membro{membrosSelecionados.size !== 1 ? 's' : ''}?
                </p>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600">
                    Os cartões serão gerados em PDF e otimizados para impressão em lote.
                  </p>
                </div>

                {/* Listagem dos membros selecionados */}
                <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Membros selecionados:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {membros
                      .filter(m => membrosSelecionados.has(m.id))
                      .map(m => (
                        <li key={m.id}>• {m.nome} ({m.matricula})</li>
                      ))}
                  </ul>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-4">
                <button
                  onClick={() => setImprimindoLote(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
                >
                  ✕ Cancelar
                </button>
                <CartaoBatchPrinter
                  membros={membros.filter(m => membrosSelecionados.has(m.id))}
                  onComplete={() => {
                    setImprimindoLote(false);
                    setMembrosSelecionados(new Set());
                    setNotification({
                      isOpen: true,
                      title: 'Sucesso',
                      message: 'PDF de cartões gerado com sucesso!',
                      type: 'success',
                      autoClose: 2000, // Fechar em 2 segundos
                      showButton: false // Esconder botão
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
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
                👥 Dados de Ministros
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
              />
            </div>
          )}

          {/* Vista - Dados de Ministros (Listagem completa) */}
          {dashboardView === 'list' && (
            <div>
          {/* Filtro de Busca */}
          <div className="bg-white rounded-lg p-4 shadow-md mb-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-teal-700 mb-2">Filtro de Busca</label>
                <input
                  type="text"
                  placeholder="DIGITE SUA BUSCA"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border-2 border-teal-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="w-48">
                <label className="block text-sm font-semibold text-teal-700 mb-2">SITUAÇÃO</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border-2 border-teal-300 rounded-lg bg-teal-50 focus:outline-none focus:border-teal-500"
                >
                  <option>ATIVO</option>
                  <option>INATIVO</option>
                  <option>TODOS</option>
                </select>
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ATIVO');
                  setCurrentPage(1);
                }}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold text-sm"
              >
                LIMPAR
              </button>
            </div>
          </div>

          {/* Header da Tabela */}
          <div className="bg-white rounded-t-lg shadow-md">
            <div className="flex items-center justify-between p-4 border-b-2 border-teal-500">
              <div className="flex items-center gap-2">
                <span className="text-2xl">☰</span>
                <h2 className="text-lg font-bold text-teal-700">Listagem de Ministros</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Quantidade de Ministros</span>
                <div className="flex gap-2">
                  <button
                    onClick={abrirNovoCadastro}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm flex items-center gap-2"
                  >
                    <span>➕</span> Novo Cadastro
                  </button>
                  <button
                    onClick={async () => {
                      if (ultimoCadastro) {
                        const novaMatricula = gerarProximaMatricula();
                        setDadosPessoais({
                          matricula: novaMatricula,
                          cpf: '',
                          tipoCadastro: 'ministro',
                          nome: '',
                          dataNascimento: ultimoCadastro.dataNascimento || '',
                          sexo: ultimoCadastro.sexo || 'MASCULINO',
                          tipoSanguineo: ultimoCadastro.tipoSanguineo || '',
                          escolaridade: ultimoCadastro.escolaridade || '',
                          estadoCivil: ultimoCadastro.estadoCivil || '',
                          nomeConjuge: '',
                          cpfConjuge: '',
                          dataNascimentoConjuge: '',
                          nomePai: ultimoCadastro.nomePai || '',
                          nomeMae: ultimoCadastro.nomeMae || '',
                          rg: '',
                          orgaoEmissor: ultimoCadastro.orgaoEmissor || '',
                          nacionalidade: ultimoCadastro.nacionalidade || 'BRASILEIRA',
                          naturalidade: ultimoCadastro.naturalidade || '',
                          uf: ultimoCadastro.uf || '',
                          supervisao: ultimoCadastro.supervisao || '',
                          campo: ultimoCadastro.campo || '',
                          congregacao: ultimoCadastro.congregacao || '',
                          email: '',
                          celular: '',
                          whatsapp: ''
                        });
                        setEnderecoData({
                          cep: ultimoCadastro.cep || '',
                          logradouro: ultimoCadastro.logradouro || '',
                          numero: ultimoCadastro.numero || '',
                          bairro: ultimoCadastro.bairro || '',
                          complemento: ultimoCadastro.complemento || '',
                          cidade: ultimoCadastro.cidade || '',
                          latitude: ultimoCadastro.latitude || '',
                          longitude: ultimoCadastro.longitude || ''
                        });
                        setDadosMinisteriais({
                          temFuncaoIgreja: ultimoCadastro.temFuncaoIgreja || false,
                          qualFuncao: ultimoCadastro.qualFuncao || '',
                          setorDepartamento: ultimoCadastro.setorDepartamento || '',
                          dataBatismoAguas: ultimoCadastro.dataBatismoAguas || '',
                          dataBatismoEspiritoSanto: ultimoCadastro.dataBatismoEspiritoSanto || '',
                          cursoTeologico: ultimoCadastro.cursoTeologico || '',
                          instituicaoTeologica: ultimoCadastro.instituicaoTeologica || '',
                          pastorAuxiliar: ultimoCadastro.pastorAuxiliar || false,
                          procedencia: ultimoCadastro.procedencia || '',
                          procedenciaLocal: ultimoCadastro.procedenciaLocal || '',
                          dataConsagracao: ultimoCadastro.dataConsagracao || '',
                          dataEmissao: ultimoCadastro.dataEmissao || '',
                          dataValidadeCredencial: ultimoCadastro.dataValidadeCredencial || '',
                          observacoesMinisteriais: ultimoCadastro.observacoesMinisteriais || ''
                        });
                        setCargoSelecionado(resolveCargoValue(ultimoCadastro.cargoMinisterial));
                        setDadosCargos(ultimoCadastro.dadosCargos || {});
                        setIsEditando(false);
                        setShowForm(true);
                        setActiveTab('dados');
                      }
                    }}
                    disabled={!ultimoCadastro}
                    className={`px-4 py-2 rounded-lg transition font-semibold text-sm ${ultimoCadastro
                      ? 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    📋 Cadastrar Semelhante
                  </button>
                  <button
                    onClick={gerarPDFListagem}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold text-sm"
                  >
                    🖨️ IMPRIMIR
                  </button>
                  <button
                    onClick={async () => {
                      if (membrosSelecionados.size === 0) {
                        setNotification({
                          isOpen: true,
                          title: 'Aviso',
                          message: 'Selecione pelo menos um membro para imprimir cartões',
                          type: 'warning'
                        });
                        return;
                      }

                      // Verificar template ativo (assumindo 'membro' como padrão para lote ou verificar o primeiro)
                      // Se quiser ser mais estrito, poderia verificar todos os selecionados
                      const selecionados = membros.filter(m => membrosSelecionados.has(m.id));
                      if (selecionados.length === 0) return;

                      const tiposUnicos = Array.from(new Set(selecionados.map(m => m.tipoCadastro || 'membro')));
                      const templatesBase = await ensureTemplatesSnapshot();
                      const tipoSemTemplate = tiposUnicos.find(t => !hasActiveTemplate(t, templatesBase));

                      if (tipoSemTemplate) {
                        setNotification({
                          isOpen: true,
                          title: 'Template Ausente',
                          message: getMensagemSemTemplate(tipoSemTemplate),
                          type: 'warning'
                        });
                        return;
                      }

                      setImprimindoLote(true);
                    }}
                    disabled={membrosSelecionados.size === 0}
                    className={`px-4 py-2 rounded-lg transition font-semibold text-sm ${membrosSelecionados.size > 0
                      ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    🎫 IMPRIMIR CARTÕES ({membrosSelecionados.size})
                  </button>
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="px-4 pt-3 pb-2">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-2 border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 w-12">
                      <input
                        type="checkbox"
                        checked={membrosSelecionados.size === membrosPaginados.length && membrosPaginados.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const novoSet = new Set(membrosSelecionados);
                            membrosPaginados.forEach(m => novoSet.add(m.id));
                            setMembrosSelecionados(novoSet);
                          } else {
                            const novoSet = new Set(membrosSelecionados);
                            membrosPaginados.forEach(m => novoSet.delete(m.id));
                            setMembrosSelecionados(novoSet);
                          }
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-20">Matrícula</th>
                    <th className="border-2 border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 w-12">Foto</th>
                    <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Nome</th>
                    <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">CPF</th>
                    <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Cargo</th>
                    <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Data Consagração</th>
                    <th className="border-2 border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="border-2 border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Controles</th>
                  </tr>
                </thead>
                <tbody>
                  {membrosPaginados.map((membro) => (
                    <tr key={membro.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={membrosSelecionados.has(membro.id)}
                          onChange={(e) => {
                            const novoSet = new Set(membrosSelecionados);
                            if (e.target.checked) {
                              novoSet.add(membro.id);
                            } else {
                              novoSet.delete(membro.id);
                            }
                            setMembrosSelecionados(novoSet);
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-700">{membro.matricula}</td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <div className="w-10 h-12 bg-gray-100 rounded overflow-hidden flex items-center justify-center mx-auto border border-gray-200">
                          {membro.fotoUrl ? (
                            <img src={membro.fotoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl text-gray-400">👤</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-700">{membro.nome}</td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-600">{membro.cpf}</td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-600">{membro.cargoMinisterial || '-'}</td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-600">
                        {membro.dataConsagracao
                          ? new Date(membro.dataConsagracao + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <span className={`px-3 py-1 rounded text-sm font-semibold ${membro.status === 'ativo'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {membro.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => setMembroImprimindo(membro)}
                            className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                            title="Imprimir Ficha"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </button>
                          <button
                            onClick={async () => {
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
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition"
                            title="Imprimir Cartão"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => abrirEdicao(membro)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="Editar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => abrirConfirmacaoDeletar(membro)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                            title="Deletar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Rodapé da Tabela */}
          <div className="bg-white rounded-b-lg shadow-md p-4 border-t border-gray-300">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex + 1} até {Math.min(endIndex, membrosFiltrados.length)} de {membrosFiltrados.length} registros
              </div>
              <div className="flex items-center gap-1">
                {/* Anterior */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ‹
                </button>

                {/* Páginas com ellipsis */}
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 4) pages.push('...');
                    const start = Math.max(2, currentPage - 2);
                    const end = Math.min(totalPages - 1, currentPage + 2);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 3) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400 select-none">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`px-3 py-1 rounded ${
                          currentPage === p
                            ? 'bg-teal-600 text-white font-bold'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}

                {/* Próximo */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Formulário Modal com Abas */}
          {showForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" style={{ height: '90vh' }}>
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-4 border-b-2 border-teal-500 bg-gradient-to-r from-teal-600 to-teal-700 flex-shrink-0">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>{membroEditando ? '✏️' : '➕'}</span>
                    {membroEditando ? `Editar Ministro - ${membroEditando.nome}` : 'Inserir Novo Ministro'}
                  </h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-white hover:text-gray-100 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Abas - Com altura fixa para evitar redimensionamento */}
                <div className="flex border-b border-gray-300 bg-white overflow-x-auto h-16 items-center flex-shrink-0">
                  <button
                    onClick={() => setActiveTab('dados')}
                    className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${activeTab === 'dados'
                      ? 'text-teal-700 border-teal-600'
                      : 'text-gray-600 border-transparent hover:text-teal-600'
                      }`}
                  >
                    📋 Dados
                  </button>
                  <button
                    onClick={() => setActiveTab('endereco')}
                    className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${activeTab === 'endereco'
                      ? 'text-teal-700 border-teal-600'
                      : 'text-gray-600 border-transparent hover:text-teal-600'
                      }`}
                  >
                    🌍 Endereço + Contato
                  </button>
                  <button
                    onClick={() => setActiveTab('ministerial')}
                    className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${activeTab === 'ministerial'
                      ? 'text-teal-700 border-teal-600'
                      : 'text-gray-600 border-transparent hover:text-teal-600'
                      }`}
                  >
                    ⛪ Ministerial
                  </button>
                  <button
                    onClick={() => setActiveTab('foto')}
                    className={`px-4 py-3 font-semibold transition whitespace-nowrap text-sm border-b-3 h-full flex items-center ${activeTab === 'foto'
                      ? 'text-teal-700 border-teal-600'
                      : 'text-gray-600 border-transparent hover:text-teal-600'
                      }`}
                  >
                    📸 Foto
                  </button>
                </div>

                {/* Conteúdo das Abas - Scrollável com margens laterais e altura fixa */}
                <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                  {/* ABA: DADOS CADASTRAIS */}
                  {activeTab === 'dados' && (
                    <div className="space-y-3">
                      {/* Linha 0: Matrícula */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Matrícula</label>
                          <input
                            type="text"
                            placeholder="Automática"
                            value={dadosPessoais.matricula}
                            onChange={(e) => isAdminMode ? setDadosPessoais({ ...dadosPessoais, matricula: e.target.value }) : null}
                            disabled={!isAdminMode}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm ${isAdminMode
                              ? 'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent'
                              : 'bg-gray-100 text-gray-600 cursor-not-allowed'
                              }`}
                          />
                        </div>
                        {isAdminMode && (
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={isEditando}
                                onChange={(e) => setIsEditando(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                              Editar Matrícula
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Linha 1: CPF e Tipo de Cadastro */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            CPF *
                            {membroEditando && <span className="ml-2 text-xs text-gray-500">(Bloqueado)</span>}
                            {dadosPessoais.cpf && !membroEditando && (
                              <span className={`ml-2 ${validarCPF(dadosPessoais.cpf) ? 'text-green-600' : 'text-red-600'}`}>
                                {validarCPF(dadosPessoais.cpf) ? '✓ Válido' : '✗ Inválido'}
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            placeholder="Somente Números"
                            value={dadosPessoais.cpf}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, cpf: formatCpf(e.target.value) })}
                            disabled={false}
                            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                              dadosPessoais.cpf && !validarCPF(dadosPessoais.cpf)
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-gray-300 focus:ring-teal-500'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Cadastro *</label>
                          <input
                            type="text"
                            value="Ministro"
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600 cursor-not-allowed focus:outline-none"
                          />
                        </div>
                      </div>



                      {/* Nome */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">NOME *</label>
                        <input
                          type="text"
                          placeholder="Nome da Pessoa"
                          value={dadosPessoais.nome}
                          onChange={(e) => setDadosPessoais({ ...dadosPessoais, nome: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>

                      {/* Data Nascimento, Sexo e Tipo Sanguíneo */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Data Nascimento *</label>
                          <input
                            type="date"
                            value={dadosPessoais.dataNascimento}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, dataNascimento: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Sexo</label>
                          <select
                            value={dadosPessoais.sexo}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, sexo: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option>MASCULINO</option>
                            <option>FEMININO</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo Sanguíneo</label>
                          <select
                            value={dadosPessoais.tipoSanguineo}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, tipoSanguineo: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="">- Escolha -</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                          </select>
                        </div>
                      </div>



                      {/* Escolaridade e Estado Civil */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Escolaridade</label>
                          <select
                            value={dadosPessoais.escolaridade}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, escolaridade: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="">- Escolha -</option>
                            <option value="sem_instrucao">Sem Instrução</option>
                            <option value="fundamental">Ensino Fundamental</option>
                            <option value="medio">Ensino Médio</option>
                            <option value="superior">Ensino Superior</option>
                            <option value="posgraduacao">Pós-Graduação</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Estado Civil</label>
                          <select
                            value={dadosPessoais.estadoCivil}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, estadoCivil: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="">- Escolha -</option>
                            <option value="solteiro">Solteiro</option>
                            <option value="casado">Casado</option>
                          </select>
                        </div>
                      </div>



                      {/* Dados do Cônjuge - Aparecem apenas se casado */}
                      {dadosPessoais.estadoCivil === 'casado' && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                          <h4 className="text-xs font-semibold text-blue-800 mb-3">👥 Dados do Cônjuge</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Cônjuge</label>
                              <input
                                type="text"
                                placeholder="Nome"
                                value={dadosPessoais.nomeConjuge}
                                onChange={(e) => setDadosPessoais({ ...dadosPessoais, nomeConjuge: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">CPF do Cônjuge</label>
                              <input
                                type="text"
                                placeholder="Somente Números"
                                value={dadosPessoais.cpfConjuge}
                                onChange={(e) => setDadosPessoais({ ...dadosPessoais, cpfConjuge: formatCpf(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Data Nascimento do Cônjuge</label>
                              <input
                                type="date"
                                value={dadosPessoais.dataNascimentoConjuge}
                                onChange={(e) => setDadosPessoais({ ...dadosPessoais, dataNascimentoConjuge: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pais e Filiação */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Pai</label>
                          <input
                            type="text"
                            value={dadosPessoais.nomePai}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, nomePai: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Mãe</label>
                          <input
                            type="text"
                            value={dadosPessoais.nomeMae}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, nomeMae: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                      </div>



                      {/* Documentação */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">RG</label>
                          <input
                            type="text"
                            value={dadosPessoais.rg}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, rg: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Órgão Emissor</label>
                          <input
                            type="text"
                            value={dadosPessoais.orgaoEmissor}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, orgaoEmissor: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Nacionalidade</label>
                          <select
                            value={dadosPessoais.nacionalidade}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, nacionalidade: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option>BRASILEIRA</option>
                            <option>ESTRANGEIRA</option>
                          </select>
                        </div>
                      </div>



                      {/* Naturalidade e UF */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Naturalidade</label>
                          <input
                            type="text"
                            value={dadosPessoais.naturalidade}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, naturalidade: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">UF</label>
                          <select
                            value={dadosPessoais.uf}
                            onChange={(e) => setDadosPessoais({ ...dadosPessoais, uf: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="">Selecionar</option>
                            <option value="AC">Acre</option>
                            <option value="AL">Alagoas</option>
                            <option value="AP">Amapá</option>
                            <option value="AM">Amazonas</option>
                            <option value="BA">Bahia</option>
                            <option value="CE">Ceará</option>
                            <option value="DF">Distrito Federal</option>
                            <option value="ES">Espírito Santo</option>
                            <option value="GO">Goiás</option>
                            <option value="MA">Maranhão</option>
                            <option value="MT">Mato Grosso</option>
                            <option value="MS">Mato Grosso do Sul</option>
                            <option value="MG">Minas Gerais</option>
                            <option value="PA">Pará</option>
                            <option value="PB">Paraíba</option>
                            <option value="PR">Paraná</option>
                            <option value="PE">Pernambuco</option>
                            <option value="PI">Piauí</option>
                            <option value="RJ">Rio de Janeiro</option>
                            <option value="RN">Rio Grande do Norte</option>
                            <option value="RS">Rio Grande do Sul</option>
                            <option value="RO">Rondônia</option>
                            <option value="RR">Roraima</option>
                            <option value="SC">Santa Catarina</option>
                            <option value="SP">São Paulo</option>
                            <option value="SE">Sergipe</option>
                            <option value="TO">Tocantins</option>
                          </select>
                        </div>
                      </div>



                      {/* Batismo */}
                      <div className="bg-teal-50 border border-teal-200 p-3 rounded-md">
                        <h4 className="text-xs font-semibold text-teal-800 mb-3">⛪ Dados Eclesiásticos</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Data de Batismo nas Águas</label>
                            <input
                              type="date"
                              value={dadosMinisteriais.dataBatismoAguas}
                              onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, dataBatismoAguas: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Data de Batismo no Espírito Santo</label>
                            <input
                              type="date"
                              value={dadosMinisteriais.dataBatismoEspiritoSanto}
                              onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, dataBatismoEspiritoSanto: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>



                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Profissão</label>
                          <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Título Eleitoral</label>
                          <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Zona</label>
                          <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Seção</label>
                          <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                        </div>
                      </div>



                      {/* Organização Eclesiástica */}
                      <div className="bg-sky-50 border border-sky-200 p-3 rounded-md mt-3">
                        <h4 className="text-xs font-semibold text-sky-800 mb-3">🏢 Organização Eclesiástica</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">{nomenclaturas.divisao1} (1ª Divisão)</label>
                            <select
                              value={dadosPessoais.supervisao}
                              onChange={(e) => {
                                const value = e.target.value;
                                const congregacaoSelecionada = divisao1Options.find((opt) => opt.nome === value) || null;
                                const setorRelacionado = congregacaoSelecionada?.campo_id
                                  ? divisao2Options.find((opt) => opt.id === congregacaoSelecionada.campo_id) || null
                                  : null;
                                const regionalRelacionado = setorRelacionado?.supervisao_id
                                  ? divisao3Options.find((opt) => opt.id === setorRelacionado.supervisao_id) || null
                                  : (congregacaoSelecionada?.supervisao_id
                                      ? divisao3Options.find((opt) => opt.id === congregacaoSelecionada.supervisao_id) || null
                                      : null);

                                setDadosPessoais({
                                  ...dadosPessoais,
                                  supervisao: value,
                                  campo: setorRelacionado?.nome || '',
                                  congregacao: regionalRelacionado?.nome || '',
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                              <option value="">Selecione</option>
                              {divisao1Options.map((opt) => (
                                <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">{nomenclaturas.divisao2} (2ª Divisão)</label>
                            <select
                              value={dadosPessoais.campo}
                              onChange={(e) => {
                                const value = e.target.value;
                                const setorSelecionado = divisao2Options.find((opt) => opt.nome === value) || null;
                                const regionalRelacionado = setorSelecionado?.supervisao_id
                                  ? divisao3Options.find((opt) => opt.id === setorSelecionado.supervisao_id) || null
                                  : null;

                                setDadosPessoais({
                                  ...dadosPessoais,
                                  campo: value,
                                  congregacao: regionalRelacionado?.nome || '',
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                              <option value="">Selecione</option>
                              {divisao2Filtradas.map((opt) => (
                                <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">{nomenclaturas.divisao3} (3ª Divisão)</label>
                            <select
                              value={dadosPessoais.congregacao}
                              onChange={(e) => setDadosPessoais({ ...dadosPessoais, congregacao: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                              <option value="">Selecione</option>
                              {divisao3Filtradas.map((opt) => (
                                <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Observações</label>
                        <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                      </div>

                    </div>
                  )}

                  {/* ABA: ENDEREÇO + CONTATO COM GEOLOCALIZAÇÃO */}
                  {activeTab === 'endereco' && (
                    <div className="space-y-3">
                      {/* Seção: ENDEREÇO */}
                      <div className="border-b pb-3">
                        <h3 className="text-sm font-bold text-teal-700 mb-3">📍 Endereço</h3>
                        <div className="space-y-3">
                          {/* Linha 1: CEP + Botão Buscar */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">CEP</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={enderecoData.cep}
                                onChange={(e) => setEnderecoData({ ...enderecoData, cep: e.target.value })}
                                placeholder="00000-000"
                                className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                              <button
                                type="button"
                                onClick={buscarCEP}
                                className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold text-sm transition whitespace-nowrap"
                              >
                                🔍 Buscar
                              </button>
                            </div>
                          </div>

                          {/* Linha 2: Logradouro + Número */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Logradouro</label>
                              <input type="text" value={enderecoData.logradouro} onChange={(e) => setEnderecoData({ ...enderecoData, logradouro: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Número</label>
                              <input type="text" value={enderecoData.numero} onChange={(e) => setEnderecoData({ ...enderecoData, numero: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Bairro</label>
                            <input type="text" value={enderecoData.bairro} onChange={(e) => setEnderecoData({ ...enderecoData, bairro: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Complemento</label>
                            <input type="text" value={enderecoData.complemento} onChange={(e) => setEnderecoData({ ...enderecoData, complemento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Cidade</label>
                            <input type="text" value={enderecoData.cidade} onChange={(e) => setEnderecoData({ ...enderecoData, cidade: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                          </div>
                        </div>

                        {/* Geolocalização (Automática) */}
                        <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                          <label className="block text-xs font-semibold text-gray-700 mb-2">🌐 Geolocalização (Automática)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Latitude</label>
                              <input type="text" value={enderecoData.latitude} disabled className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600 cursor-not-allowed" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Longitude</label>
                              <input type="text" value={enderecoData.longitude} disabled className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600 cursor-not-allowed" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-2">Os dados de latitude e longitude serão preenchidos automaticamente ao buscar o CEP.</p>
                        </div>
                      </div>

                      {/* Seção: CONTATO */}
                      <div>
                        <h3 className="text-sm font-bold text-teal-700 mb-3">📞 Contato</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">EMAIL</label>
                            <input
                              type="email"
                              value={dadosPessoais.email}
                              onChange={(e) => setDadosPessoais({ ...dadosPessoais, email: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">CELULAR</label>
                            <input
                              type="text"
                              placeholder="(00) 00000-0000"
                              value={dadosPessoais.celular}
                              onChange={(e) => setDadosPessoais({ ...dadosPessoais, celular: formatPhone(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">WHATSAPP</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="(00) 00000-0000"
                                value={dadosPessoais.whatsapp}
                                onChange={(e) => setDadosPessoais({ ...dadosPessoais, whatsapp: formatPhone(e.target.value) })}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (dadosPessoais.whatsapp) {
                                    const num = dadosPessoais.whatsapp.replace(/\D/g, '');
                                    window.open(`https://wa.me/55${num}`, '_blank');
                                  }
                                }}
                                className="bg-green-600 text-white px-3 rounded-md hover:bg-green-700 font-semibold text-sm"
                              >
                                💬
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ABA: MINISTERIAL */}
                  {activeTab === 'ministerial' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Curso Teológico</label>
                          <select
                            value={dadosMinisteriais.cursoTeologico}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, cursoTeologico: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="">NÃO TEM</option>
                            <option value="basico">Básico</option>
                            <option value="medio">Médio</option>
                            <option value="bacharel">Bacharel</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Instituição</label>
                          <input
                            type="text"
                            value={dadosMinisteriais.instituicaoTeologica}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, instituicaoTeologica: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Pastor Auxiliar?</label>
                          <input
                            type="checkbox"
                            checked={!!dadosMinisteriais.pastorAuxiliar}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, pastorAuxiliar: e.target.checked })}
                            className="w-5 h-5 mt-2"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Procedência</label>
                          <select
                            value={dadosMinisteriais.procedencia}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, procedencia: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="">- Definir -</option>
                            <option value="aclamacao">Aclamação</option>
                            <option value="batismo">Batismo</option>
                            <option value="carta">Carta</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Procedência Local</label>
                          <input
                            type="text"
                            value={dadosMinisteriais.procedenciaLocal}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, procedenciaLocal: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                      </div>



                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Cargo Ministerial</label>
                          <select
                            value={cargoSelecionado}
                            onChange={(e) => setCargoSelecionado(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <option value="">- Selecionar -</option>
                            {cargosMinisteriais
                              .filter(cargo => cargo.ativo)
                              .map(cargo => (
                                <option key={cargo.id} value={cargo.nome}>
                                  {cargo.nome}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Data Batismo Esp. Santo</label>
                          <input
                            type="date"
                            value={dadosMinisteriais.dataBatismoEspiritoSanto}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, dataBatismoEspiritoSanto: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Data Batismo Águas</label>
                          <input
                            type="date"
                            value={dadosMinisteriais.dataBatismoAguas}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, dataBatismoAguas: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Data de Consagração</label>
                          <input
                            type="date"
                            value={dadosMinisteriais.dataConsagracao}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, dataConsagracao: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Data de Validade (Credencial)</label>
                          <input
                            type="date"
                            value={dadosMinisteriais.dataValidadeCredencial}
                            onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, dataValidadeCredencial: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                      </div>



                      {/* Bloco de Consagração/Recebimento - Aparece quando cargo é selecionado */}
                      {cargoSelecionado && (
                        <div className="p-4 border border-teal-200 rounded-lg bg-teal-50">
                          <h3 className="text-sm font-bold text-teal-900 mb-3">Consagração / Recebimento - {cargoSelecionado}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Data da Consagração ou Recebimento</label>
                              <input
                                type="date"
                                value={dadosCargos[cargoSelecionado]?.dataConsagracaoRecebimento || ''}
                                onChange={(e) => setDadosCargos({
                                  ...dadosCargos,
                                  [cargoSelecionado]: {
                                    ...dadosCargos[cargoSelecionado],
                                    dataConsagracaoRecebimento: e.target.value
                                  }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Local de Consagração</label>
                              <input
                                type="text"
                                placeholder="Ex: Templo Central"
                                value={dadosCargos[cargoSelecionado]?.localConsagracao || ''}
                                onChange={(e) => setDadosCargos({
                                  ...dadosCargos,
                                  [cargoSelecionado]: {
                                    ...dadosCargos[cargoSelecionado],
                                    localConsagracao: e.target.value
                                  }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Local de Origem</label>
                              <input
                                type="text"
                                placeholder="Ex: Igreja Original, Pastor Referência"
                                value={dadosCargos[cargoSelecionado]?.localOrigem || ''}
                                onChange={(e) => setDadosCargos({
                                  ...dadosCargos,
                                  [cargoSelecionado]: {
                                    ...dadosCargos[cargoSelecionado],
                                    localOrigem: e.target.value
                                  }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={dadosMinisteriais.temFuncaoIgreja}
                              onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, temFuncaoIgreja: e.target.checked })}
                              className="w-5 h-5 cursor-pointer"
                            />
                            <label className="text-sm font-semibold text-gray-700">Função na Igreja?</label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg" style={{ backgroundColor: dadosMinisteriais.temFuncaoIgreja ? '#f0f9ff' : '#f9fafb', borderColor: dadosMinisteriais.temFuncaoIgreja ? '#bfdbfe' : '#e5e7eb', borderWidth: '1px' }}>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Qual Função?</label>
                            <input
                              type="text"
                              placeholder="Ex: Líder de Louvor, Coordenador"
                              value={dadosMinisteriais.qualFuncao}
                              onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, qualFuncao: e.target.value })}
                              disabled={!dadosMinisteriais.temFuncaoIgreja}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Setor ou Departamento</label>
                            <input
                              type="text"
                              placeholder="Ex: Ministério de Louvor"
                              value={dadosMinisteriais.setorDepartamento}
                              onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, setorDepartamento: e.target.value })}
                              disabled={!dadosMinisteriais.temFuncaoIgreja}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>



                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Observações</label>
                        <textarea
                          rows={2}
                          value={dadosMinisteriais.observacoesMinisteriais}
                          onChange={(e) => setDadosMinisteriais({ ...dadosMinisteriais, observacoesMinisteriais: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {/* ABA: FOTO */}
                  {activeTab === 'foto' && (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 relative overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
                        {fotoMembro ? (
                          <div className="relative group">
                            <img
                              src={fotoMembro}
                              alt="Foto do Ministro"
                              className="max-h-64 rounded-md shadow-md border-2 border-teal-500 transition-opacity group-hover:opacity-50"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-teal-600 text-white p-2 rounded-full shadow-lg"
                                title="Alterar Foto"
                              >
                                ✏️
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-4xl mb-3">📸</div>
                            <h3 className="text-base font-semibold text-gray-800 mb-1">Foto do Ministro</h3>
                            <p className="text-xs text-gray-600 mb-3">Clique para fazer upload</p>
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold text-sm flex items-center gap-2"
                            >
                              📁 Escolher Foto
                            </button>
                          </>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFotoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>

                      {fotoMembro && (
                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={handleGirarFoto}
                            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-semibold text-sm flex items-center gap-2"
                          >
                            🔄 Girar
                          </button>
                          {fotoMembro && (
                            <button
                              onClick={() => setFotoMembro(null)}
                              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold text-sm flex items-center gap-2"
                            >
                              🗑️ Remover
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Rodapé com Botões de Ação */}
                <div className="flex gap-4 px-4 py-3 border-t border-gray-300 bg-gradient-to-r from-teal-50 to-cyan-50 flex-shrink-0">
                  <button
                    onClick={salvarMembro}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition font-bold text-sm"
                  >
                    ✓ {membroEditando ? 'Atualizar' : 'Cadastrar'}
                  </button>
                  <button
                    onClick={fecharFormulario}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-bold text-sm"
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>
          )}        </div>
      </div>
    </div>
  );
}