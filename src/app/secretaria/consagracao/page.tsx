'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Section from '@/components/Section';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useMembers } from '@/hooks/useMembers';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { type OrgNomenclaturasState } from '@/lib/org-nomenclaturas';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';
import { getCargosMinisteriais, type CargoMinisterial } from '@/lib/cargos-utils';
import { formatCpf, formatPhone } from '@/lib/mascaras';
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer';
import type { Member } from '@/types/supabase';
import { comissoesService } from '@/services/comissoes-service';
import { consacracaoService } from '@/services/consagracao-service';
import type { Comissao } from '@/types/comissoes';
import { loadCertificadosTemplatesForCurrentUser } from '@/lib/certificados-templates-sync';
import { substituirPlaceholdersCertificado } from '@/lib/certificados-utils';
import QRCode from 'qrcode';

interface SimpleOption {
  id: string;
  nome: string;
  supervisao_id?: string | null;
  campo_id?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  em_processo: 'Em Processo',
  deferir: 'Deferido',
  indeferir: 'Indeferido',
  homologar: 'Homologado'
};

const TIPO_REGISTRO_LABELS: Record<string, string> = {
  chegada: 'Candidato (Novo cadastro)',
  progressao: 'Progressão (já cadastrado)',
  filiacao: 'Filiação (consagrado em outra instituição)',
  novo: 'Candidato (Novo cadastro)',
  existente: 'Progressão (já cadastrado)',
  ministro: 'Progressão (já cadastrado)'
};

const TIPO_REGISTRO_OPTIONS: Array<{ value: 'chegada' | 'progressao' | 'filiacao'; label: string }> = [
  { value: 'chegada', label: TIPO_REGISTRO_LABELS.chegada },
  { value: 'progressao', label: TIPO_REGISTRO_LABELS.progressao },
  { value: 'filiacao', label: TIPO_REGISTRO_LABELS.filiacao },
];

const CATEGORIA_REGISTRO_OPTIONS = [
  'AUTORIZAÇÃO',
  'AUTORIZAÇÃO - NOVO APRESENTADOR',
  'CONSAGRAÇÃO',
  'ORDENAÇÃO',
  'ENTRADA NO PROBATÓRIO',
  'SAÍDA DO PROBATÓRIO',
  'INTEGRAÇÃO',
  'REINTEGRAÇÃO',
];

const normalizeTipoRegistro = (value: string) => {
  if (value === 'novo') return 'chegada';
  if (value === 'existente' || value === 'ministro') return 'progressao';
  if (value === 'chegada' || value === 'progressao' || value === 'filiacao') return value;
  return 'chegada';
};

const isConsagracaoTableMissing = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return code === 'PGRST205' || message.includes("could not find the table 'public.consagracao_registros'");
};

export default function ConsagracaoPage() {
  const { ctx, bloqueado } = useRequireModulo('comissao');
  const planFeatures = usePlanFeatures();
  const isSupervisor = ctx.nivel === 'supervisor';
  const isAdmin = ctx.nivel === 'administrador';
  const isSecretarioGeral = ctx.nivel === 'secretario_geral';
  const isPresidencia = ctx.nivel === 'presidencia';

  // A Secretaria Geral (e Administrador) é o único operador de tramitação no sistema.
  // A Comissão de Consagração analisa fora do sistema e devolve o parecer.
  // O Presidente é signatário e não possui ação operacional de tramitação.
  const canOperarTramitacao = isSecretarioGeral || ctx.nivel === 'auxiliar_secretaria' || isAdmin || (!isSupervisor && !isPresidencia && ctx.podeEscrever('secretaria'));

  // Capacidade de cadastrar novo processo ou editar dados cadastrais
  const canCadastrarEditar = canOperarTramitacao;

  const supabase = useMemo(() => createClient(), []);
  const { fetchMembers } = useMembers();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppressNextSearchRef = useRef(false);

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCampoId, setFiltroCampoId] = useState('');
  const [filtroCongregacaoId, setFiltroCongregacaoId] = useState('');
  const [filtroComissaoId, setFiltroComissaoId] = useState('');
  const [comissoes, setComissoes] = useState<Comissao[]>([]);

  const [nomenclaturas, setNomenclaturas] = useState<OrgNomenclaturasState | null>(null);
  const [supervisoes, setSupervisoes] = useState<SimpleOption[]>([]);
  const [campos, setCampos] = useState<SimpleOption[]>([]);
  const [congregacoes, setCongregacoes] = useState<SimpleOption[]>([]);
  const [cargosMinisteriais] = useState<CargoMinisterial[]>(() => getCargosMinisteriais());

  const [registros, setRegistros] = useState<any[]>([]);
  const [comissoesAtivas, setComissoesAtivas] = useState<Comissao[]>([]);
  const [loadingComissoes, setLoadingComissoes] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<any | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [registroParaExcluir, setRegistroParaExcluir] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [responsavelTenant, setResponsavelTenant] = useState('');
  const [churchInfo, setChurchInfo] = useState<{ nome: string; logoUrl: string; responsavel: string }>({
    nome: '',
    logoUrl: '',
    responsavel: ''
  });
  const [statusMensagem, setStatusMensagem] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processRegistro, setProcessRegistro] = useState<any | null>(null);
  const [parecerInput, setParecerInput] = useState('');
  const [parecerError, setParecerError] = useState('');
  const [consagracaoModuleReady, setConsagracaoModuleReady] = useState(true);

  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [memberOpen, setMemberOpen] = useState(false);
  const [fotoBloqueada, setFotoBloqueada] = useState(false);
  const todayIso = () => new Date().toISOString().slice(0, 10);

  const [formRegistro, setFormRegistro] = useState({
    tipo_registro: 'chegada',
    categoria_registro: '',
    comissao_id: '',
    member_id: '',
    numero_processo: '',
    data_processo: todayIso(),
    cpf: '',
    nome: '',
    data_nascimento: '',
    sexo: 'MASCULINO',
    rg: '',
    orgao_emissor: '',
    estado_civil: '',
    nacionalidade: '',
    naturalidade: '',
    uf: '',
    email: '',
    telefone: '',
    nome_pai: '',
    nome_mae: '',
    nome_conjuge: '',
    matricula: '',
    supervisao_id: '',
    campo_id: '',
    congregacao_id: '',
    cargo_ocupa: '',
    cargo_pretendido: '',
    pastor_solicitante: '',
    origem_instituicao: '',
    origem_cidade: '',
    origem_uf: '',
    origem_data_consagracao: '',
    data_autorizacao: '',
    status_processo: 'em_processo',
    observacoes: '',
    foto_url: ''
  });


  const getNextProcessNumber = async () => {
    if (!ministryId || !consagracaoModuleReady) return '';
    const year = new Date().getFullYear();
    const { data, error } = await supabase
      .from('consagracao_registros')
      .select('numero_processo')
      .eq('ministry_id', ministryId)
      .like('numero_processo', `%/${year}`);

    if (error) {
      if (isConsagracaoTableMissing(error)) {
        setConsagracaoModuleReady(false);
        setStatusMensagem('Módulo Consagração indisponível: tabela public.consagracao_registros não encontrada. Aplique as migrations de Consagração no Supabase.');
      }
      return '';
    }

    const numeros = (data || [])
      .map((item: any) => {
        const raw = String(item?.numero_processo || '');
        const base = raw.split('/')[0];
        const parsed = Number.parseInt(base, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      })
      .filter((value: number) => value > 0);

    const next = (numeros.length ? Math.max(...numeros) : 0) + 1;
    return `${next}/${year}`;
  };

  const loadInitialData = async () => {
    setLoadingData(true);
    const resolvedMinistryId = await resolveMinistryId(supabase);
    setMinistryId(resolvedMinistryId);

    let scopeCongIds: string[] | null = null;

    if (resolvedMinistryId) {
      const orgService = await obterEstruturaOrganizacionalService(resolvedMinistryId, supabase);
      const labels = orgService.getLabels();
      setNomenclaturas({
        divisaoPrincipal: { opcao1: labels.nomeDivisao1 },
        divisaoSecundaria: { opcao1: labels.nomeDivisao2 },
        divisaoTerciaria: { opcao1: labels.nomeDivisao3 },
      });

      const div1Regs = orgService.getDivisao1();
      const div2Regs = orgService.getDivisao2();
      const div3Regs = orgService.getDivisao3();

      // Divisão 1: Congregações (filhas da Divisão 2)
      // Divisão 2: Campos / Grupos (filhos da Divisão 3)
      // Divisão 3: Supervisões / Regionais (topo da hierarquia)
      const congregacoesValidas = div1Regs
        .filter((u) => u.tabelaOrigem === 'congregacoes' || !div3Regs.some((s) => s.id === u.id))
        .map((u) => ({
          id: u.id,
          nome: u.nome,
          campo_id: u.tabelaOrigem === 'congregacoes' ? (u.parentId || null) : null,
          supervisao_id: null,
        }));

      setCongregacoes(congregacoesValidas);
      setCampos(div2Regs.map((u) => ({ id: u.id, nome: u.nome, supervisao_id: u.parentId || null })));
      setSupervisoes(div3Regs.map((u) => ({ id: u.id, nome: u.nome })));

      // Determina IDs de congregações visíveis para o supervisor
      if (isSupervisor && ctx.supervisaoId) {
        const camposDaSupervisao = div2Regs.filter((c) => c.parentId === ctx.supervisaoId).map((c) => c.id);
        const uVisiveis = congregacoesValidas.filter((u) => (u.campo_id && camposDaSupervisao.includes(u.campo_id)));
        scopeCongIds = uVisiveis.map((u) => u.id);
      }

      // Buscar dados do ministério e responsável configurado no perfil da igreja (Configurações -> Geral)
      let responsavel = '';
      let churchNome = '';
      let churchLogo = '';
      try {
        const [{ data: minData }, { data: configData }] = await Promise.all([
          supabase.from('ministries').select('name, logo_url, cnpj_cpf').eq('id', resolvedMinistryId).maybeSingle(),
          supabase.from('configurations').select('church_profile').eq('ministry_id', resolvedMinistryId).maybeSingle()
        ]);
        if (minData) {
          churchNome = minData.name || '';
          churchLogo = minData.logo_url || '';
        }
        if (configData?.church_profile && typeof configData.church_profile === 'object') {
          const cp = configData.church_profile as any;
          responsavel = String(cp.responsavel || '').trim();
          if (!churchNome && cp.nome) churchNome = cp.nome;
          if (!churchLogo && cp.logo) churchLogo = cp.logo;
        }
      } catch (err) {
        console.error('Erro ao buscar dados do ministério/configurações:', err);
      }
      setChurchInfo({
        nome: churchNome,
        logoUrl: churchLogo,
        responsavel: responsavel
      });
      setResponsavelTenant(responsavel);
      if (responsavel) {
        setFormRegistro((prev) => ({
          ...prev,
          pastor_solicitante: prev.pastor_solicitante || responsavel,
        }));
      }

      setLoadingComissoes(true);
      try {
        const comissoesLista = await comissoesService.listarComissoes(resolvedMinistryId);
        setComissoes(comissoesLista);
        setComissoesAtivas(comissoesLista.filter((c) => c.status === 'ativa'));
      } catch (err) {
        console.error('Erro ao carregar comissões:', err);
        setComissoes([]);
        setComissoesAtivas([]);
      } finally {
        setLoadingComissoes(false);
      }
    }

    let query = supabase
      .from('consagracao_registros')
      .select('*')
      .order('created_at', { ascending: false });
    if (scopeCongIds !== null) {
      if (scopeCongIds.length > 0) {
        query = query.in('congregacao_id', scopeCongIds);
      } else {
        // Supervisor sem congregações vinculadas → lista vazia
        setConsagracaoModuleReady(true);
        setRegistros([]);
        setLoadingData(false);
        return;
      }
    }
    const { data, error } = await query;
    if (error) {
      if (isConsagracaoTableMissing(error)) {
        setConsagracaoModuleReady(false);
        setStatusMensagem('Módulo Consagração indisponível: tabela public.consagracao_registros não encontrada. Aplique as migrations de Consagração no Supabase.');
        setRegistros([]);
      }
    } else if (data) {
      setConsagracaoModuleReady(true);
      setRegistros(data);
    }

    setLoadingData(false);
  };

  useEffect(() => {
    if (!ctx.loading && !bloqueado) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.loading, bloqueado]);

  useEffect(() => {
    let cancelled = false;
    const query = memberQuery.trim();

    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      setMemberOpen(false);
      return;
    }
    if (query.length < 2) {
      setMemberResults([]);
      setMemberOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetchMembers(1, 20, { status: 'active', search: query });
        const list = ((res as any)?.data || []) as Member[];
        if (!cancelled) {
          setMemberResults(list);
          setMemberOpen(true);
        }
      } catch {
        if (!cancelled) {
          setMemberResults([]);
          setMemberOpen(true);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memberQuery, fetchMembers]);

  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        const maxSize = 480;
        const ratio = img.width / img.height;
        let width = maxSize;
        let height = maxSize;
        if (ratio > 1) {
          height = Math.round(maxSize / ratio);
        } else {
          width = Math.round(maxSize * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressed);
      };
      img.src = base64;
    });
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      const compressed = await compressImage(result);
      setFormRegistro((prev) => ({ ...prev, foto_url: compressed }));
      setFotoBloqueada(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetForm = () => {
    setFormRegistro({
      tipo_registro: 'chegada',
      categoria_registro: '',
      comissao_id: '',
      member_id: '',
      numero_processo: '',
      data_processo: todayIso(),
      cpf: '',
      nome: '',
      data_nascimento: '',
      sexo: 'MASCULINO',
      rg: '',
      orgao_emissor: '',
      estado_civil: '',
      nacionalidade: '',
      naturalidade: '',
      uf: '',
      email: '',
      telefone: '',
      nome_pai: '',
      nome_mae: '',
      nome_conjuge: '',
      matricula: '',
      supervisao_id: '',
      campo_id: '',
      congregacao_id: '',
      cargo_ocupa: '',
      cargo_pretendido: '',
      pastor_solicitante: responsavelTenant || '',
      origem_instituicao: '',
      origem_cidade: '',
      origem_uf: '',
      origem_data_consagracao: '',
      data_autorizacao: '',
      status_processo: 'em_processo',
      observacoes: '',
      foto_url: ''
    });
    setEditingRegistro(null);
    setMemberQuery('');
    setMemberResults([]);
    setMemberOpen(false);
    setFotoBloqueada(false);
  };

  const ensureNumeroProcesso = async () => {
    if (editingRegistro) return;
    const next = await getNextProcessNumber();
    if (!next) return;
    setFormRegistro((prev) => ({ ...prev, numero_processo: next }));
  };

  const handleSelectMember = (member: Member) => {
    const cf = ((member as any).custom_fields || {}) as Record<string, any>;
    const fotoUrl = (member as any).foto_url || cf.fotoUrl || '';

    const normalizeText = (value: unknown) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

    const matchCargoMinisterial = (rawCargo: unknown) => {
      if (!rawCargo) return '';
      const target = normalizeText(rawCargo);
      if (!target) return '';
      // 1. Match exato com lista de cargos ministeriais
      const exact = cargosMinisteriais.find((c) => normalizeText(c.nome) === target);
      if (exact) return exact.nome;
      // 2. Match parcial / prefixo (ex: "OBREIRO" -> "Obreiro(a)", "MISSIONARIO" -> "Missionário(a)")
      const partial = cargosMinisteriais.find((c) => {
        const cNorm = normalizeText(c.nome);
        return cNorm === target || cNorm.startsWith(target) || target.startsWith(cNorm);
      });
      if (partial) return partial.nome;
      return String(rawCargo).trim();
    };

    // Origem oficial: members.cargo_ministerial (com fallback para custom_fields somente se cargo_ministerial for nulo)
    const rawCargo =
      (member as any).cargo_ministerial ||
      cf.cargoMinisterial ||
      cf.cargo_ministerial ||
      '';

    const cargoOcupa = matchCargoMinisterial(rawCargo);
    const processDate = new Date().toISOString().slice(0, 10);

    const findOptionIdByName = (options: SimpleOption[], rawName: unknown) => {
      const target = normalizeText(rawName);
      if (!target) return '';
      const found = options.find((opt) => normalizeText(opt.nome) === target);
      return found?.id || '';
    };

    // Resolução de Congregação do Membro (apenas congregações válidas do tenant)
    const memberCongregacaoIdRaw =
      (congregacoes.some((cg) => cg.id === (member as any).congregacao_id) ? (member as any).congregacao_id : '') ||
      (congregacoes.some((cg) => cg.id === cf.congregacao_id) ? cf.congregacao_id : '') ||
      findOptionIdByName(congregacoes, (member as any).congregacao || cf.congregacao || cf.igreja || cf.divisao1) ||
      findOptionIdByName(congregacoes, (member as any).supervisao || cf.supervisao); // Caso o nome da congregação tenha sido gravado no campo supervisao

    const congregacaoFromId = congregacoes.find((c) => c.id === memberCongregacaoIdRaw) || null;

    // Resolução de Grupo / Campo
    const memberCampoIdRaw =
      congregacaoFromId?.campo_id ||
      (campos.some((cp) => cp.id === (member as any).campo_id) ? (member as any).campo_id : '') ||
      (campos.some((cp) => cp.id === cf.campo_id) ? cf.campo_id : '') ||
      findOptionIdByName(campos, (member as any).campo || cf.campo || cf.setor || cf.divisao2);

    const campoFromId = campos.find((c) => c.id === memberCampoIdRaw) || null;

    // Resolução de Supervisão / Regional
    const memberSupervisaoIdRaw =
      campoFromId?.supervisao_id ||
      congregacaoFromId?.supervisao_id ||
      (supervisoes.some((sp) => sp.id === (member as any).supervisao_id) ? (member as any).supervisao_id : '') ||
      (supervisoes.some((sp) => sp.id === cf.supervisao_id) ? cf.supervisao_id : '') ||
      findOptionIdByName(supervisoes, (member as any).supervisao || cf.supervisao || cf.regional || cf.divisao3);

    suppressNextSearchRef.current = true;
    setMemberQuery(member.name || (member as any).nome || '');
    setMemberOpen(false);
    setFotoBloqueada(Boolean(fotoUrl));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.nome;
      delete next.member_id;
      delete next.cargo_ocupa;
      return next;
    });

    setFormRegistro((prev) => ({
      ...prev,
      tipo_registro: 'progressao',
      member_id: member.id,
      nome: member.name || (member as any).nome || prev.nome,
      cpf: formatCpf((member as any).cpf || cf.cpf || prev.cpf || ''),
      data_nascimento: (member as any).birth_date || (member as any).data_nascimento || prev.data_nascimento,
      sexo: (member as any).gender || (member as any).sexo || prev.sexo,
      rg: (member as any).rg || cf.rg || prev.rg,
      estado_civil: (member as any).estado_civil || cf.estadoCivil || prev.estado_civil,
      nacionalidade: (member as any).nacionalidade || cf.nacionalidade || prev.nacionalidade,
      naturalidade: (member as any).naturalidade || cf.naturalidade || prev.naturalidade,
      uf: (member as any).uf || cf.uf || prev.uf,
      email: (member as any).email || cf.email || prev.email,
      telefone: formatPhone((member as any).celular || (member as any).phone || cf.celular || prev.telefone || ''),
      nome_pai: (member as any).nome_pai || cf.nomePai || prev.nome_pai,
      nome_mae: (member as any).nome_mae || cf.nomeMae || prev.nome_mae,
      nome_conjuge: (member as any).nome_conjuge || cf.nomeConjuge || prev.nome_conjuge,
      matricula: (member as any).matricula || cf.matricula || prev.matricula,
      data_processo: prev.data_processo || processDate,
      supervisao_id: memberSupervisaoIdRaw || '',
      campo_id: memberCampoIdRaw || '',
      congregacao_id: memberCongregacaoIdRaw || '',
      cargo_ocupa: cargoOcupa || '',
      // Preservar cargo pretendido intocado
      cargo_pretendido: prev.cargo_pretendido,
      pastor_solicitante: prev.pastor_solicitante || responsavelTenant || '',
      foto_url: fotoUrl || prev.foto_url
    }));
  };

  const syncMemberProgressStatus = async (
    memberId: string,
    processStatus: string,
    cargoPretendido: string,
    cargoOcupa: string
  ) => {
    if (!memberId) return;

    const { data: existingMember, error: existingMemberError } = await supabase
      .from('members')
      .select('custom_fields')
      .eq('id', memberId)
      .maybeSingle();

    if (existingMemberError) {
      console.error('Erro ao carregar membro para sincronizar status de consagração:', existingMemberError);
      return;
    }

    const currentCustomFields =
      existingMember?.custom_fields && typeof existingMember.custom_fields === 'object'
        ? (existingMember.custom_fields as Record<string, any>)
        : {};

    const nextCustomFields = {
      ...currentCustomFields,
      consagracaoStatus: processStatus === 'em_processo' ? 'em_processo' : null,
      consagracaoCargoPretendido: cargoPretendido || null,
      consagracaoCargoOcupado: cargoOcupa || null,
      consagracaoAtualizadoEm: new Date().toISOString(),
    };

    const { error: updateMemberError } = await supabase
      .from('members')
      .update({
        custom_fields: nextCustomFields,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', memberId);

    if (updateMemberError) {
      console.error('Erro ao sincronizar status de consagração no membro:', updateMemberError);
    }
  };

  const handleSaveRegistro = async () => {
    if (!consagracaoModuleReady) {
      setStatusMensagem('Não foi possível salvar: a tabela de Consagração não existe no banco. Aplique as migrations do módulo.');
      return;
    }

    if (!ministryId) {
      setStatusMensagem('Erro ao salvar: ministério não identificado para este usuário. Recarregue a página ou verifique o vínculo de acesso.');
      return;
    }

    const tipoRegistro = normalizeTipoRegistro(formRegistro.tipo_registro);
    const nextErrors: Record<string, string> = {};

    if (!formRegistro.numero_processo?.trim()) {
      nextErrors.numero_processo = 'Número do processo é obrigatório.';
    }

    if (!formRegistro.tipo_registro?.trim()) {
      nextErrors.tipo_registro = 'Tipo de registro é obrigatório.';
    }

    if (!formRegistro.categoria_registro?.trim()) {
      nextErrors.categoria_registro = 'Selecione a categoria do registro.';
    }

    if (!formRegistro.comissao_id?.trim()) {
      nextErrors.comissao_id = 'Selecione a comissão responsável.';
    }

    const normalizeCargo = (v: string | null | undefined) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

    if (!formRegistro.cargo_pretendido?.trim()) {
      nextErrors.cargo_pretendido = 'Selecione o cargo pretendido.';
    } else if (
      formRegistro.cargo_ocupa?.trim() &&
      normalizeCargo(formRegistro.cargo_ocupa) === normalizeCargo(formRegistro.cargo_pretendido)
    ) {
      nextErrors.cargo_pretendido = 'O cargo pretendido deve ser diferente do cargo atual.';
    }

    if (tipoRegistro === 'progressao') {
      if (!formRegistro.member_id) {
        nextErrors.member_id = 'Selecione um ministro da busca para progressão.';
      }
      if (!formRegistro.cargo_ocupa) {
        nextErrors.cargo_ocupa = 'Informe o cargo que ocupa.';
      }
    }

    if (tipoRegistro === 'filiacao' && !formRegistro.origem_instituicao?.trim()) {
      nextErrors.origem_instituicao = 'Instituição de origem é obrigatória para filiação.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const errorFieldsOrder = [
        'numero_processo',
        'tipo_registro',
        'categoria_registro',
        'comissao_id',
        'nome',
        'member_id',
        'cargo_ocupa',
        'cargo_pretendido',
        'origem_instituicao',
      ];
      const firstErrorField = errorFieldsOrder.find((k) => nextErrors[k]) || Object.keys(nextErrors)[0];
      const firstErrorMsg = nextErrors[firstErrorField] || 'Preencha os campos obrigatórios destacados em vermelho.';
      setStatusMensagem(firstErrorMsg);

      setTimeout(() => {
        const targetEl = document.querySelector(
          `[name="${firstErrorField}"], [name="consagracao_${firstErrorField}"], #${firstErrorField}, [data-field="${firstErrorField}"]`
        );
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (targetEl instanceof HTMLElement) {
            try {
              targetEl.focus();
            } catch {}
          }
        }
      }, 50);
      return;
    }

    setFieldErrors({});

    const payload = {
      ministry_id: ministryId,
      comissao_id: formRegistro.comissao_id || null,
      member_id: tipoRegistro === 'progressao' ? formRegistro.member_id || null : null,
      tipo_registro: tipoRegistro,
      regiao: formRegistro.categoria_registro || null,
      numero_processo: formRegistro.numero_processo || null,
      data_processo: formRegistro.data_processo || null,
      cpf: formRegistro.cpf || null,
      nome: formRegistro.nome,
      data_nascimento: formRegistro.data_nascimento || null,
      sexo: formRegistro.sexo || null,
      rg: formRegistro.rg || null,
      orgao_emissor: formRegistro.orgao_emissor || null,
      estado_civil: formRegistro.estado_civil || null,
      nacionalidade: formRegistro.nacionalidade || null,
      naturalidade: formRegistro.naturalidade || null,
      uf: formRegistro.uf || null,
      email: formRegistro.email || null,
      telefone: formRegistro.telefone || null,
      nome_pai: formRegistro.nome_pai || null,
      nome_mae: formRegistro.nome_mae || null,
      nome_conjuge: formRegistro.nome_conjuge || null,
      matricula: formRegistro.matricula || null,
      supervisao_id: formRegistro.supervisao_id || null,
      campo_id: formRegistro.campo_id || null,
      congregacao_id: formRegistro.congregacao_id || null,
      cargo_ocupa: formRegistro.cargo_ocupa || null,
      cargo_pretendido: formRegistro.cargo_pretendido || null,
      pastor_solicitante: formRegistro.pastor_solicitante || null,
      origem_instituicao: formRegistro.origem_instituicao || null,
      origem_cidade: formRegistro.origem_cidade || null,
      origem_uf: formRegistro.origem_uf || null,
      origem_data_consagracao: formRegistro.origem_data_consagracao || null,
      data_autorizacao: formRegistro.data_autorizacao || null,
      status_processo: formRegistro.status_processo || 'em_processo',
      observacoes: formRegistro.observacoes || null,
      foto_url: formRegistro.foto_url || null
    };

    const normalizedPayload = normalizePayloadToUppercase(payload);
    if (typeof normalizedPayload.email === 'string') {
      normalizedPayload.email = normalizedPayload.email.toLowerCase();
    }

    if (editingRegistro) {
      try {
        await consacracaoService.atualizarRegistro(
          editingRegistro.id,
          ministryId,
          normalizedPayload,
          ctx.nivel
        );
      } catch (err: any) {
        setStatusMensagem(`Erro ao atualizar registro: ${err.message}`);
        return;
      }
    } else {
      try {
        await consacracaoService.criarRegistro(
          ministryId,
          normalizedPayload,
          ctx.nivel
        );
      } catch (err: any) {
        setStatusMensagem(`Erro ao criar registro: ${err.message}`);
        return;
      }
    }

    if (tipoRegistro === 'progressao' && formRegistro.member_id) {
      await syncMemberProgressStatus(
        formRegistro.member_id,
        formRegistro.status_processo || 'em_processo',
        formRegistro.cargo_pretendido,
        formRegistro.cargo_ocupa
      );
    }

    setStatusMensagem('Registro salvo com sucesso.');
    resetForm();
    setShowForm(false);
    await ensureNumeroProcesso();
    if (ministryId) {
      const data = await consacracaoService.listarRegistros(ministryId);
      setRegistros(data);
    }
  };

  const handleDeleteRegistro = async (id: string) => {
    if (!consagracaoModuleReady) {
      setStatusMensagem('Módulo Consagração indisponível: tabela de registros não encontrada no banco.');
      return;
    }

    if (!ministryId) return;

    try {
      setDeleting(true);
      await consacracaoService.excluirRegistro(id, ministryId, ctx.nivel);
      setRegistros((prev) => prev.filter((r) => r.id !== id));
      setDeleteModalOpen(false);
      setRegistroParaExcluir(null);
      setStatusMensagem('Processo excluído com sucesso.');
    } catch (err: any) {
      setStatusMensagem(`Erro ao remover registro: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * COMISSÃO: Deliberação de mérito (Deferir / Indeferir)
   */
  const handleComissaoDecisao = async (decisao: 'deferir' | 'indeferir') => {
    if (!processRegistro || !ministryId) return;

    const parecerTratado = (parecerInput || '').trim();
    if (!parecerTratado) {
      setParecerError('O parecer da Comissão deve ser registrado antes de lançar a decisão.');
      return;
    }
    setParecerError('');

    try {
      if (decisao === 'deferir') {
        await consacracaoService.deferirProcessoComissao(processRegistro.id, ministryId, ctx.nivel, parecerTratado);
        setStatusMensagem('Processo deferido pela Comissão com sucesso.');
      } else {
        await consacracaoService.indeferirProcessoComissao(processRegistro.id, ministryId, ctx.nivel, parecerTratado);
        setStatusMensagem('Processo indeferido pela Comissão.');
      }

      const tipoProcesso = normalizeTipoRegistro(processRegistro.tipo_registro || '');
      if (tipoProcesso === 'progressao' && processRegistro.member_id) {
        await syncMemberProgressStatus(
          processRegistro.member_id,
          decisao,
          processRegistro.cargo_pretendido || '',
          processRegistro.cargo_ocupa || ''
        );
      }

      setRegistros((prev) =>
        prev.map((r) => (r.id === processRegistro.id ? { ...r, status_processo: decisao, observacoes: parecerTratado } : r))
      );
      setProcessModalOpen(false);
      setProcessRegistro(null);
      setParecerInput('');
      setParecerError('');
    } catch (err: any) {
      console.error('Erro na deliberação da Comissão:', err);
      setStatusMensagem(err.message || 'Erro ao deliberar sobre o processo.');
      setParecerError(err.message || 'Erro ao deliberar sobre o processo.');
    }
  };

  /**
   * SECRETARIA GERAL: Homologação do processo
   */
  const handleSecretariaHomologar = async () => {
    if (!processRegistro || !ministryId) return;

    try {
      const res = await consacracaoService.homologarProcesso(processRegistro.id, ministryId, ctx.nivel);
      setStatusMensagem(res.message || 'Processo homologado com sucesso.');

      setRegistros((prev) =>
        prev.map((r) => (r.id === processRegistro.id ? { ...r, status_processo: 'homologar' } : r))
      );
      setProcessModalOpen(false);
      setProcessRegistro(null);
    } catch (err: any) {
      console.error('Erro ao homologar processo:', err);
      setStatusMensagem(err.message || 'Erro ao homologar processo.');
    }
  };

  /**
   * SECRETARIA GERAL: Reabertura administrativa (Voltar para Em Processo)
   */
  const handleSecretariaReabrir = async () => {
    if (!processRegistro || !ministryId) return;

    try {
      await consacracaoService.reabrirProcessoSecretaria(processRegistro.id, ministryId, ctx.nivel);
      setStatusMensagem('Processo reaberto para Em Processo.');

      const tipoProcesso = normalizeTipoRegistro(processRegistro.tipo_registro || '');
      if (tipoProcesso === 'progressao' && processRegistro.member_id) {
        await syncMemberProgressStatus(
          processRegistro.member_id,
          'em_processo',
          processRegistro.cargo_pretendido || '',
          processRegistro.cargo_ocupa || ''
        );
      }

      setRegistros((prev) =>
        prev.map((r) => (r.id === processRegistro.id ? { ...r, status_processo: 'em_processo' } : r))
      );
      setProcessModalOpen(false);
      setProcessRegistro(null);
    } catch (err: any) {
      console.error('Erro ao reabrir processo:', err);
      setStatusMensagem(err.message || 'Erro ao reabrir processo.');
    }
  };

  const limparFiltros = () => {
    setFiltroBusca('');
    setFiltroTipo('');
    setFiltroStatus('');
    setFiltroCampoId('');
    setFiltroCongregacaoId('');
    setFiltroComissaoId('');
  };

  const temFiltrosAtivos = Boolean(
    filtroBusca.trim() || filtroTipo || filtroStatus || filtroCampoId || filtroCongregacaoId || filtroComissaoId
  );

  const getCongregacaoNome = (congId: string) => {
    if (!congId) return '-';
    const found = congregacoes.find((c) => c.id === congId);
    return found?.nome || '-';
  };

  const getCampoNome = (campoId: string) => {
    if (!campoId) return '-';
    const found = campos.find((c) => c.id === campoId);
    return found?.nome || '-';
  };

  const handleImprimirLista = () => {
    if (registrosFiltrados.length === 0) return;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Por favor, permita popups para imprimir o relatório.');
      return;
    }

    const churchNome = churchInfo.nome || 'Gestão Eklésia';
    const churchLogo = churchInfo.logoUrl || '';
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const filtrosAplicados: string[] = [];
    if (filtroBusca.trim()) filtrosAplicados.push(`Busca: "${filtroBusca.trim()}"`);
    if (filtroTipo) {
      const tipoLabel = filtroTipo === 'chegada' ? 'Chegada (Novo)' : filtroTipo === 'progressao' ? 'Progressão' : 'Filiação';
      filtrosAplicados.push(`Tipo: ${tipoLabel}`);
    }
    if (filtroStatus) {
      filtrosAplicados.push(`Status: ${STATUS_LABELS[filtroStatus] || filtroStatus}`);
    }
    if (filtroCampoId) {
      filtrosAplicados.push(`${labelCampo}: ${getCampoNome(filtroCampoId)}`);
    }
    if (filtroCongregacaoId) {
      filtrosAplicados.push(`${labelCongregacao}: ${getCongregacaoNome(filtroCongregacaoId)}`);
    }
    if (filtroComissaoId) {
      const comissaoNome = comissoes.find((c) => c.id === filtroComissaoId)?.nome || 'Comissão Selecionada';
      filtrosAplicados.push(`Comissão: ${comissaoNome}`);
    }

    const filtroResumo = filtrosAplicados.length > 0 ? filtrosAplicados.join(' | ') : 'Todos os processos (sem filtros)';

    const rowsHtml = registrosFiltrados
      .map((reg, idx) => {
        const tipo = normalizeTipoRegistro(reg.tipo_registro || '');
        const tipoLabel = tipo === 'progressao' ? 'Progressão' : tipo === 'filiacao' ? 'Filiação' : 'Chegada';
        const dataProc = reg.data_processo ? reg.data_processo.split('-').reverse().join('/') : '-';
        const congNome = getCongregacaoNome(reg.congregacao_id);
        const campoNome = getCampoNome(reg.campo_id);
        const localNome = campoNome !== '-' && campoNome !== congNome ? `${congNome} / ${campoNome}` : congNome;
        const statusLabel = STATUS_LABELS[reg.status_processo] || reg.status_processo || 'Em Processo';
        const cpfFmt = reg.cpf ? formatCpf(reg.cpf) : '-';
        const cargoAtual = reg.cargo_ocupa || (tipo === 'chegada' ? 'Não se aplica' : '-');
        const cargoPretendido = reg.cargo_pretendido || '-';

        return `
          <tr>
            <td style="text-align: center; font-size: 11px; font-weight: bold; color: #475569;">${idx + 1}</td>
            <td style="font-family: monospace; font-size: 11px; font-weight: 600; color: #1e293b; white-space: nowrap;">${reg.numero_processo || '-'}</td>
            <td style="font-size: 11px; color: #475569; white-space: nowrap;">${dataProc}</td>
            <td style="font-size: 11px; font-weight: 600; color: #0f172a;">
              ${reg.nome || '-'}
              ${cpfFmt !== '-' ? `<br/><span style="font-size: 10px; font-weight: normal; color: #64748b; font-family: monospace;">CPF: ${cpfFmt}</span>` : ''}
            </td>
            <td style="font-size: 11px; white-space: nowrap;">
              <span class="badge ${tipo}">${tipoLabel}</span>
            </td>
            <td style="font-size: 11px; color: #334155;">${cargoAtual}</td>
            <td style="font-size: 11px; font-weight: 600; color: #0f766e;">${cargoPretendido}</td>
            <td style="font-size: 11px; color: #334155;">${localNome}</td>
            <td style="font-size: 11px; white-space: nowrap;">
              <span class="status-badge ${reg.status_processo || 'em_processo'}">${statusLabel}</span>
            </td>
          </tr>
        `;
      })
      .join('');

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relação de Processos de Consagração - ${churchNome}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            padding: 24px 32px;
            font-size: 12px;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .header-logo {
            width: 56px;
            height: 56px;
            object-fit: contain;
            border-radius: 8px;
          }
          .header-title h1 {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.3px;
          }
          .header-title h2 {
            font-size: 13px;
            font-weight: 600;
            color: #0f766e;
            margin-top: 2px;
            text-transform: uppercase;
          }
          .header-right {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .filter-bar {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 16px;
            font-size: 11px;
            color: #475569;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
          }
          th, td {
            border: 1px solid #e2e8f0;
            padding: 8px 10px;
            text-align: left;
            vertical-align: middle;
          }
          th {
            background: #0f766e;
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
          }
          .badge.chegada { background: #e0f2fe; color: #0369a1; }
          .badge.progressao { background: #e0e7ff; color: #4338ca; }
          .badge.filiacao { background: #fef3c7; color: #b45309; }

          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
          }
          .status-badge.em_processo { background: #ccfbf1; color: #0f766e; }
          .status-badge.deferir { background: #dcfce7; color: #15803d; }
          .status-badge.indeferir { background: #fee2e2; color: #b91c1c; }
          .status-badge.homologar { background: #f3e8ff; color: #7e22ce; }

          .footer-section {
            margin-top: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 11px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
          }
          .signature-box {
            text-align: center;
            min-width: 240px;
          }
          .signature-line {
            border-top: 1px solid #334155;
            margin-bottom: 4px;
          }
          .signature-title {
            font-size: 11px;
            font-weight: 600;
            color: #1e293b;
          }
          .signature-role {
            font-size: 10px;
            color: #64748b;
          }

          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4 landscape; margin: 1.2cm; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="window.print()" style="padding: 8px 18px; font-size: 12px; font-weight: bold; background: #0f766e; color: white; border: none; border-radius: 6px; cursor: pointer;">
            🖨️ Imprimir / Salvar PDF
          </button>
          <button onclick="window.close()" style="padding: 8px 14px; font-size: 12px; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
            Fechar
          </button>
        </div>

        <div class="header">
          <div class="header-left">
            ${churchLogo ? `<img src="${churchLogo}" class="header-logo" alt="Logo" />` : ''}
            <div class="header-title">
              <h1>${churchNome}</h1>
              <h2>Relação de Processos de Consagração de Obreiros</h2>
            </div>
          </div>
          <div class="header-right">
            <div><strong>Emissão:</strong> ${hoje} às ${hora}</div>
            <div><strong>Total:</strong> ${registrosFiltrados.length} processo(s)</div>
          </div>
        </div>

        <div class="filter-bar">
          <div><strong>Filtros aplicados:</strong> ${filtroResumo}</div>
          <div><strong>Listagem Oficial</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th style="width: 90px;">Nº Processo</th>
              <th style="width: 75px;">Data</th>
              <th>Ministro / Obreiro</th>
              <th style="width: 90px;">Tipo</th>
              <th>Cargo Atual</th>
              <th>Cargo Pretendido</th>
              <th>${labelCongregacao} / ${labelCampo}</th>
              <th style="width: 95px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-section">
          <div>
            Documento emitido via Sistema de Gestão Eklésia.<br/>
            Total de processos listados: <strong>${registrosFiltrados.length}</strong>
          </div>
        </div>
      </body>
      </html>
    `);

    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };

  const handleImprimirFichaCandidato = async (reg: any) => {
    if (!reg) return;

    // Buscar comissão vinculada ao processo
    let comissaoNome = '';
    if (reg.comissao_id && ministryId) {
      comissaoNome = reg.comissao?.nome || comissoes.find((c) => c.id === reg.comissao_id)?.nome || '';
      if (!comissaoNome) {
        try {
          const comissaoData = await comissoesService.obterComissaoPorId(reg.comissao_id, ministryId);
          comissaoNome = comissaoData?.nome || '';
        } catch (err) {
          console.error('Erro ao buscar comissão para a ficha:', err);
        }
      }
    }

    const win = window.open('', '_blank');
    if (!win) {
      alert('Por favor, permita popups para imprimir a ficha.');
      return;
    }

    const churchNome = churchInfo.nome || 'Gestão Eklésia';
    const churchLogo = churchInfo.logoUrl || '';
    const responsavel = churchInfo.responsavel || responsavelTenant || '';
    const pastorIndicante = reg.pastor_solicitante || responsavel || '-';
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const tipo = normalizeTipoRegistro(reg.tipo_registro || '');
    const tipoLabel = tipo === 'progressao' ? 'Progressão (já cadastrado)' : tipo === 'filiacao' ? 'Filiação (vindo de outro ministério)' : 'Candidato (Novo cadastro / Chegada)';
    const statusLabel = STATUS_LABELS[reg.status_processo] || reg.status_processo || 'Em Processo';
    const dataProc = reg.data_processo ? reg.data_processo.split('-').reverse().join('/') : '-';
    const dataNasc = reg.data_nascimento ? reg.data_nascimento.split('-').reverse().join('/') : '-';
    const dataConsagOrigem = reg.origem_data_consagracao ? reg.origem_data_consagracao.split('-').reverse().join('/') : '-';
    const dataAutorizacao = reg.data_autorizacao ? reg.data_autorizacao.split('-').reverse().join('/') : '-';
    
    const congNome = getCongregacaoNome(reg.congregacao_id);
    const campoNome = getCampoNome(reg.campo_id);
    const supervisaoNome = supervisoes.find((s) => s.id === reg.supervisao_id)?.nome || '-';

    let decisaoTexto = 'Em Processo';
    let decisaoCor = '#0f766e';
    if (reg.status_processo === 'homologar') {
      decisaoTexto = 'DEFERIDO (Homologado)';
      decisaoCor = '#15803d';
    } else if (reg.status_processo === 'deferir') {
      decisaoTexto = 'DEFERIDO (Registrado)';
      decisaoCor = '#15803d';
    } else if (reg.status_processo === 'indeferir') {
      decisaoTexto = 'INDEFERIDO';
      decisaoCor = '#b91c1c';
    } else if (reg.status_processo === 'em_processo' || reg.status_processo === 'aguardando') {
      decisaoTexto = 'EM PROCESSO';
      decisaoCor = '#0284c7';
    } else if (STATUS_LABELS[reg.status_processo]) {
      decisaoTexto = STATUS_LABELS[reg.status_processo].toUpperCase();
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Ficha do Processo do Obreiro - ${reg.nome || 'Consagração'}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            padding: 24px 32px;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .header-logo {
            width: 56px;
            height: 56px;
            object-fit: contain;
            border-radius: 8px;
          }
          .header-title h1 {
            font-size: 17px;
            font-weight: 800;
            color: #0f172a;
          }
          .header-title h2 {
            font-size: 13px;
            font-weight: 700;
            color: #0f766e;
            text-transform: uppercase;
          }
          .header-right {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .process-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 11px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-top: 14px;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
          }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
          .field {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 10px;
          }
          .field-label {
            font-size: 9px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .field-value {
            font-size: 12px;
            font-weight: 600;
            color: #1e293b;
          }
          .photo-box {
            width: 100px;
            height: 125px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f1f5f9;
            flex-shrink: 0;
          }
          .photo-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .photo-placeholder {
            font-size: 10px;
            font-weight: bold;
            color: #94a3b8;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
          }
          .badge-status {
            background: #ccfbf1;
            color: #0f766e;
            border: 1px solid #99f6e4;
          }
          .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            @page { size: A4 portrait; margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px;">
          <button onclick="window.print()" style="padding: 8px 18px; font-size: 12px; font-weight: bold; background: #0f766e; color: white; border: none; border-radius: 6px; cursor: pointer;">
            🖨️ Imprimir Ficha
          </button>
          <button onclick="window.close()" style="padding: 8px 14px; font-size: 12px; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
            Fechar
          </button>
        </div>

        <div class="header">
          <div class="header-left">
            ${churchLogo ? `<img src="${churchLogo}" class="header-logo" alt="Logo" />` : ''}
            <div class="header-title">
              <h1>${churchNome}</h1>
              <h2>Ficha de Processo de Consagração de Obreiro</h2>
            </div>
          </div>
          <div class="header-right">
            <div><strong>Emissão:</strong> ${hoje} às ${hora}</div>
            <div><strong>Status:</strong> <span class="badge badge-status">${statusLabel}</span></div>
          </div>
        </div>

        <div class="process-box">
          <div>
            <span class="field-label">NÚMERO DO PROCESSO</span>
            <div style="font-family: monospace; font-size: 15px; font-weight: 800; color: #0f766e;">${reg.numero_processo || 'S/N'}</div>
          </div>
          <div>
            <span class="field-label">DATA DO PROCESSO</span>
            <div class="field-value">${dataProc}</div>
          </div>
          <div>
            <span class="field-label">TIPO DE PROCESSO</span>
            <div class="field-value">${tipoLabel}</div>
          </div>
          ${reg.categoria_registro || reg.regiao ? `
            <div>
              <span class="field-label">CATEGORIA</span>
              <div class="field-value">${reg.categoria_registro || reg.regiao}</div>
            </div>
          ` : ''}
        </div>

        <div class="section-title">1. Dados do Candidato / Ministro</div>
        <div style="display: flex; gap: 14px; margin-bottom: 8px;">
          <div class="photo-box">
            ${reg.foto_url ? `<img src="${reg.foto_url}" alt="Foto" />` : `<span class="photo-placeholder">3x4 FOTO</span>`}
          </div>
          <div style="flex: 1;" class="grid-2">
            <div class="field" style="grid-column: span 2;">
              <div class="field-label">Nome Completo</div>
              <div class="field-value" style="font-size: 13px;">${reg.nome || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">CPF</div>
              <div class="field-value">${reg.cpf ? formatCpf(reg.cpf) : '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">RG / Órgão Emissor</div>
              <div class="field-value">${reg.rg || '-'} ${reg.orgao_emissor ? `(${reg.orgao_emissor})` : ''}</div>
            </div>
            <div class="field">
              <div class="field-label">Data de Nascimento</div>
              <div class="field-value">${dataNasc}</div>
            </div>
            <div class="field">
              <div class="field-label">Sexo</div>
              <div class="field-value">${reg.sexo || '-'}</div>
            </div>
          </div>
        </div>

        <div class="grid-3" style="margin-bottom: 8px;">
          <div class="field">
            <div class="field-label">Estado Civil</div>
            <div class="field-value">${reg.estado_civil || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Cônjuge</div>
            <div class="field-value">${reg.nome_conjuge || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Nacionalidade / Naturalidade</div>
            <div class="field-value">${reg.nacionalidade || 'Brasileira'} ${reg.naturalidade ? `- ${reg.naturalidade}/${reg.uf || ''}` : ''}</div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom: 8px;">
          <div class="field">
            <div class="field-label">Filiação (Pai / Mãe)</div>
            <div class="field-value">
              ${reg.nome_pai ? `Pai: ${reg.nome_pai}` : ''}
              ${reg.nome_pai && reg.nome_mae ? '<br/>' : ''}
              ${reg.nome_mae ? `Mãe: ${reg.nome_mae}` : ''}
              ${!reg.nome_pai && !reg.nome_mae ? '-' : ''}
            </div>
          </div>
          <div class="field">
            <div class="field-label">Contatos (Telefone / E-mail)</div>
            <div class="field-value">
              ${reg.telefone ? `Tel: ${reg.telefone}` : ''}
              ${reg.telefone && reg.email ? '<br/>' : ''}
              ${reg.email ? `Email: ${reg.email}` : ''}
              ${!reg.telefone && !reg.email ? '-' : ''}
            </div>
          </div>
        </div>

        <div class="section-title">2. Dados Ministeriais e Lotação</div>
        <div class="grid-3" style="margin-bottom: 8px;">
          <div class="field">
            <div class="field-label">Cargo Atual / Ocupado</div>
            <div class="field-value">${reg.cargo_ocupa || 'Não se aplica'}</div>
          </div>
          <div class="field" style="background: #f0fdfa; border-color: #99f6e4;">
            <div class="field-label" style="color: #0f766e;">Cargo Pretendido</div>
            <div class="field-value" style="color: #0f766e; font-size: 13px;">${reg.cargo_pretendido || '-'}</div>
          </div>
          <div class="field">
            <div class="field-label">Matrícula do Membro</div>
            <div class="field-value">${reg.matricula || '-'}</div>
          </div>
        </div>

        <div class="grid-3" style="margin-bottom: 8px;">
          <div class="field">
            <div class="field-label">${labelSupervisao}</div>
            <div class="field-value">${supervisaoNome}</div>
          </div>
          <div class="field">
            <div class="field-label">${labelCampo}</div>
            <div class="field-value">${campoNome}</div>
          </div>
          <div class="field">
            <div class="field-label">${labelCongregacao}</div>
            <div class="field-value">${congNome}</div>
          </div>
        </div>

        ${tipo === 'filiacao' || reg.origem_instituicao ? `
          <div class="section-title">3. Dados da Instituição de Origem</div>
          <div class="grid-3" style="margin-bottom: 8px;">
            <div class="field">
              <div class="field-label">Instituição de Origem</div>
              <div class="field-value">${reg.origem_instituicao || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">Cidade / UF de Origem</div>
              <div class="field-value">${reg.origem_cidade || '-'}${reg.origem_uf ? `/${reg.origem_uf}` : ''}</div>
            </div>
            <div class="field">
              <div class="field-label">Data Consagração na Origem</div>
              <div class="field-value">${dataConsagOrigem}</div>
            </div>
          </div>
        ` : ''}

        <!-- Seção: Registro da Avaliação (Histórico Oficial) -->
        <div class="section-title">Registro da Avaliação</div>
        
        <div style="background: #f8fafc; border: 1.5px solid #0f766e; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
          <div class="grid-3" style="margin-bottom: ${reg.observacoes || dataAutorizacao !== '-' ? '8px' : '0'};">
            <div class="field" style="background: #ffffff; border-color: #cbd5e1;">
              <div class="field-label" style="color: #0f766e; font-weight: 800;">COMISSÃO RESPONSÁVEL PELA AVALIAÇÃO</div>
              <div class="field-value" style="font-size: 13px; font-weight: 700; color: #0f172a;">
                ${comissaoNome || 'Comissão não informada'}
              </div>
            </div>
            <div class="field" style="background: #ffffff; border-color: #cbd5e1;">
              <div class="field-label" style="color: #0f766e; font-weight: 800;">PASTOR SOLICITANTE / INDICAÇÃO</div>
              <div class="field-value" style="font-size: 13px; font-weight: 700; color: #0f172a;">
                ${pastorIndicante}
              </div>
            </div>
            <div class="field" style="background: #ffffff; border-color: #cbd5e1;">
              <div class="field-label" style="color: #0f766e; font-weight: 800;">DECISÃO DA COMISSÃO</div>
              <div class="field-value" style="font-size: 13px; font-weight: 800; color: ${decisaoCor};">
                ${decisaoTexto}
              </div>
            </div>
          </div>

          ${reg.observacoes || dataAutorizacao !== '-' ? `
            <div class="grid-2" style="margin-top: 4px;">
              ${dataAutorizacao !== '-' ? `
                <div class="field" style="background: #ffffff;">
                  <div class="field-label">DATA DE AUTORIZAÇÃO / HOMOLOGAÇÃO</div>
                  <div class="field-value">${dataAutorizacao}</div>
                </div>
              ` : ''}
              ${reg.observacoes ? `
                <div class="field" style="background: #ffffff; ${dataAutorizacao === '-' ? 'grid-column: span 2;' : ''}">
                  <div class="field-label" style="color: #0f766e; font-weight: 800;">PARECER / DESPACHO DA COMISSÃO</div>
                  <div class="field-value" style="font-weight: 600; font-size: 11px; color: #1e293b; white-space: pre-wrap;">
                    ${reg.observacoes}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <div class="footer">
          Documento gerado pelo Sistema de Gestão Eklésia em ${hoje} às ${hora} | Processo nº ${reg.numero_processo || '-'}
        </div>
      </body>
      </html>
    `);

    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };

  const handleEmitirCertificado = async (reg: any) => {
    if (!reg) return;

    if (reg.status_processo !== 'homologar') {
      setStatusMensagem('O Certificado de Consagração só pode ser emitido para processos homologados.');
      return;
    }

    if (!ministryId || (reg.ministry_id && reg.ministry_id !== ministryId)) {
      setStatusMensagem('Acesso negado: o processo não pertence ao ministério atual.');
      return;
    }

    try {
      let cargoHomologado = '';
      let memberUniqueId = '';

      // Prioridade 1: Buscar cargo resultante e unique_id efetivamente aplicados em members
      if (reg.member_id) {
        const { data: memberData, error: memberErr } = await supabase
          .from('members')
          .select('id, ministry_id, cargo_ministerial, unique_id, custom_fields')
          .eq('id', reg.member_id)
          .eq('ministry_id', ministryId)
          .single();

        if (!memberErr && memberData) {
          if (memberData.cargo_ministerial) {
            cargoHomologado = String(memberData.cargo_ministerial).trim();
          }
          memberUniqueId =
            memberData.unique_id ||
            (memberData.custom_fields as any)?.uniqueId ||
            '';
        }
      }

      // Se ainda não tiver unique_id mas temos CPF/registro, buscar por CPF
      if (!memberUniqueId && reg.cpf) {
        const cpfLimpo = String(reg.cpf).replace(/\D/g, '');
        if (cpfLimpo) {
          const { data: mByCpf } = await supabase
            .from('members')
            .select('id, unique_id, custom_fields, cargo_ministerial')
            .eq('ministry_id', ministryId)
            .eq('cpf', cpfLimpo)
            .maybeSingle();

          if (mByCpf) {
            if (!cargoHomologado && mByCpf.cargo_ministerial) {
              cargoHomologado = String(mByCpf.cargo_ministerial).trim();
            }
            memberUniqueId =
              mByCpf.unique_id ||
              (mByCpf.custom_fields as any)?.uniqueId ||
              mByCpf.id ||
              '';
          }
        }
      }

      // Se ainda assim não tiver, usar reg.member_id ou identificador seguro
      if (!memberUniqueId) {
        memberUniqueId = reg.member_id || reg.id || '';
      }

      // Prioridade 2: Dados específicos de resultado persistidos no registro do processo
      if (!cargoHomologado && reg.cargo_resultante) {
        cargoHomologado = String(reg.cargo_resultante).trim();
      }

      // Prioridade 3: Fallback seguro baseado no tipo de processo
      if (!cargoHomologado) {
        const tipo = normalizeTipoRegistro(reg.tipo_registro || '');
        if (tipo === 'progressao') {
          cargoHomologado = (reg.cargo_pretendido || '').trim();
        } else {
          cargoHomologado = (reg.cargo_pretendido || reg.cargo_ocupa || '').trim();
        }
      }

      if (!cargoHomologado) {
        setStatusMensagem('Não foi possível identificar o cargo homologado para este processo.');
        return;
      }

      const { templates } = await loadCertificadosTemplatesForCurrentUser(supabase);

      const norm = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
      const cargoNorm = norm(cargoHomologado);

      const activeTemplates = (templates || []).filter(
        (t: any) => t.ativo !== false && (t.categoria === 'ministerial' || t.categoria === 'consagracao-obreiro')
      );

      // 1. Correspondência exata por cargo_key
      let matchedTemplate = activeTemplates.find((t: any) => t.cargo_key && norm(t.cargo_key) === cargoNorm);

      // 2. Correspondência por nome do template
      if (!matchedTemplate) {
        matchedTemplate = activeTemplates.find((t: any) => {
          const tNomeNorm = norm(t.nome || t.name || '');
          return tNomeNorm === cargoNorm || tNomeNorm === `consagracao ${cargoNorm}` || tNomeNorm.includes(cargoNorm);
        });
      }

      // 3. Correspondência parcial (ex: "Pastor Presidente" / "Pastor")
      if (!matchedTemplate) {
        matchedTemplate = activeTemplates.find((t: any) => {
          if (!t.cargo_key) return false;
          const ckNorm = norm(t.cargo_key);
          return cargoNorm.includes(ckNorm) || ckNorm.includes(cargoNorm);
        });
      }

      if (!matchedTemplate) {
        setStatusMensagem(`Não existe um modelo de certificado configurado para o cargo ${cargoHomologado}. Configure o modelo em Configurações → Certificados.`);
        return;
      }

      const win = window.open('', '_blank');
      if (!win) {
        alert('Por favor, permita popups para emitir o certificado.');
        return;
      }

      const congNome = getCongregacaoNome(reg.congregacao_id) || '-';
      const churchNome = churchInfo.nome || 'Gestão Eklésia';
      const churchLogo = churchInfo.logoUrl || '';
      const responsavel = churchInfo.responsavel || responsavelTenant || '';
      const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const dataConsagFormatada = reg.data_processo ? reg.data_processo.split('-').reverse().join('/') : hoje;

      const dadosCertificado: Record<string, any> = {
        ministro_nome: reg.nome || '',
        obreiro_nome: reg.nome || '',
        candidato_nome: reg.nome || '',
        matricula: reg.matricula || '',
        cargo_ministerial: cargoHomologado,
        cargo: cargoHomologado,
        congregacao: congNome,
        data_consagracao: dataConsagFormatada,
        data_emissao: hoje,
        nome_igreja: churchNome,
        presidente_nome: responsavel,
        pastor_nome: responsavel,
        cpf: reg.cpf ? formatCpf(reg.cpf) : '',
        numero_processo: reg.numero_processo || '',
      };

      const baseUrl =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gestaoeklesia.com.br');
      const validacaoUrl = `${baseUrl}/validar/credencial/${encodeURIComponent(memberUniqueId)}`;

      const elementosHtmlArray = await Promise.all(
        (matchedTemplate.elementos || [])
          .filter((el: any) => el.visivel !== false)
          .map(async (el: any) => {
            const left = el.x || 0;
            const top = el.y || 0;
            const width = el.largura || 100;
            const height = el.altura || 30;
            const opacity = el.transparencia ?? 1;

            if (el.tipo === 'texto') {
              const textoFinal = substituirPlaceholdersCertificado(el.texto || '', dadosCertificado, matchedTemplate.categoria);
              const fontSize = el.fontSize || 16;
              const cor = el.cor || '#000000';
              const fonte = el.fonte || 'Arial';
              const align = el.alinhamento || 'left';
              const bold = el.negrito ? 'bold' : 'normal';
              const italic = el.italico ? 'italic' : 'normal';
              const underline = el.sublinhado ? 'underline' : 'none';
              const shadow = el.sombreado ? 'text-shadow: 2px 2px 2px rgba(0,0,0,0.5);' : '';
              const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

              return `
                <div style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; font-size: ${fontSize}px; color: ${cor}; font-family: '${fonte}', sans-serif; font-weight: ${bold}; font-style: ${italic}; text-decoration: ${underline}; ${shadow} text-align: ${align}; opacity: ${opacity}; display: flex; align-items: center; justify-content: ${justify}; word-break: break-word; line-height: 1.2; box-sizing: border-box;">
                  ${textoFinal}
                </div>
              `;
            }

            if (el.tipo === 'logo') {
              const logoSrc = churchLogo || el.imagemUrl;
              if (!logoSrc) return '';
              return `
                <div style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; opacity: ${opacity}; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                  <img src="${logoSrc}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              `;
            }

            if (el.tipo === 'imagem') {
              if (!el.imagemUrl) return '';
              return `
                <div style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; opacity: ${opacity}; border-radius: ${el.borderRadius || 0}px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                  <img src="${el.imagemUrl}" alt="Imagem" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              `;
            }

            if (el.tipo === 'foto-membro') {
              const fotoSrc = reg.foto_url || el.foto || el.imagemUrl;
              if (!fotoSrc) return '';
              return `
                <div style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; opacity: ${opacity}; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                  <img src="${fotoSrc}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              `;
            }

            if (el.tipo === 'qrcode') {
              try {
                const qrSize = Math.min(width, height);
                const qrDataUrl = await QRCode.toDataURL(validacaoUrl, {
                  width: Math.max(qrSize * 3, 200),
                  margin: 1,
                  color: {
                    dark: el.cor || '#000000',
                    light: '#ffffff',
                  },
                });

                return `
                  <div style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; opacity: ${opacity}; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
                    <img src="${qrDataUrl}" alt="QR Code Autenticação Ministerial" style="width: 100%; height: 100%; object-fit: contain;" />
                  </div>
                `;
              } catch (qrErr) {
                console.error('Erro ao gerar QR Code para certificado:', qrErr);
                return '';
              }
            }

            if (el.tipo === 'chapa') {
              return `
                <div style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; background-color: ${el.cor || '#ff0000'}; opacity: ${opacity}; border-radius: ${el.borderRadius || 0}px; box-sizing: border-box;"></div>
              `;
            }

            return '';
          })
      );

      const elementosHtml = elementosHtmlArray.join('');

      const safeDocTitle = `Certificado_Consagracao_${(reg.nome || 'Membro').replace(/[^a-zA-Z0-9_-]/g, '_')}_${cargoHomologado.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      win.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>${safeDocTitle}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              background-color: #f3f4f6;
              display: flex;
              align-items: center;
              justify-content: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .certificate-container {
              position: relative;
              width: 840px;
              height: 595px;
              background-color: #ffffff;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            .certificate-bg {
              position: absolute;
              top: 0;
              left: 0;
              width: 840px;
              height: 595px;
              object-fit: cover;
              z-index: 1;
            }
            .certificate-content {
              position: absolute;
              top: 0;
              left: 0;
              width: 840px;
              height: 595px;
              z-index: 2;
            }
            @media print {
              html, body {
                background-color: transparent !important;
                display: block !important;
              }
              .certificate-container {
                width: 100vw !important;
                height: 100vh !important;
                max-width: none !important;
                max-height: none !important;
                box-shadow: none !important;
                page-break-inside: avoid;
              }
              .certificate-bg, .certificate-content {
                width: 100% !important;
                height: 100% !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            ${matchedTemplate.backgroundUrl ? `<img class="certificate-bg" src="${matchedTemplate.backgroundUrl}" alt="Fundo Certificado" />` : ''}
            <div class="certificate-content">
              ${elementosHtml}
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `);

      win.document.close();
      win.focus();
    } catch (err: any) {
      console.error('Erro ao emitir certificado:', err);
      setStatusMensagem(`Erro ao emitir certificado: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleNovoRegistro = () => {
    setStatusMensagem('');
    resetForm();
    setShowForm(true);
    ensureNumeroProcesso();
  };

  const handleEditRegistro = (reg: any) => {
    setEditingRegistro(reg);
    setFormRegistro({
      tipo_registro: normalizeTipoRegistro(reg.tipo_registro || ''),
      categoria_registro: reg.regiao || '',
      comissao_id: reg.comissao_id || '',
      member_id: reg.member_id || '',
      numero_processo: reg.numero_processo || '',
      data_processo: reg.data_processo || todayIso(),
      nome: reg.nome || '',
      data_nascimento: reg.data_nascimento || '',
      sexo: reg.sexo || 'MASCULINO',
      rg: reg.rg || '',
      orgao_emissor: reg.orgao_emissor || '',
      estado_civil: reg.estado_civil || '',
      nacionalidade: reg.nacionalidade || '',
      naturalidade: reg.naturalidade || '',
      uf: reg.uf || '',
      email: reg.email || '',
      cpf: reg.cpf ? formatCpf(reg.cpf) : '',
      telefone: reg.telefone ? formatPhone(reg.telefone) : '',
      nome_pai: reg.nome_pai || '',
      nome_mae: reg.nome_mae || '',
      nome_conjuge: reg.nome_conjuge || '',
      matricula: reg.matricula || '',
      supervisao_id: reg.supervisao_id || '',
      campo_id: reg.campo_id || '',
      congregacao_id: reg.congregacao_id || '',
      cargo_ocupa: reg.cargo_ocupa || '',
      cargo_pretendido: reg.cargo_pretendido || '',
      pastor_solicitante: reg.pastor_solicitante || responsavelTenant || '',
      origem_instituicao: reg.origem_instituicao || '',
      origem_cidade: reg.origem_cidade || '',
      origem_uf: reg.origem_uf || '',
      origem_data_consagracao: reg.origem_data_consagracao || '',
      data_autorizacao: reg.data_autorizacao || '',
      status_processo: reg.status_processo || 'em_processo',
      observacoes: reg.observacoes || '',
      foto_url: reg.foto_url || ''
    });
    if (reg.tipo_registro === 'progressao' && reg.nome) {
      suppressNextSearchRef.current = true;
      setMemberQuery(reg.nome);
    }
    setFotoBloqueada(Boolean(reg.foto_url));
    setShowForm(true);
  };

  const registrosFiltrados = useMemo(() => {
    return registros.filter((reg) => {
      // 1. Busca textual (nome, cpf, numero_processo, cargo_pretendido)
      if (filtroBusca.trim()) {
        const query = filtroBusca.trim().toLowerCase();
        const nomeMatch = (reg.nome || '').toLowerCase().includes(query);
        const cpfLimpo = (reg.cpf || '').replace(/\D/g, '');
        const queryLimpa = query.replace(/\D/g, '');
        const cpfMatch = queryLimpa ? cpfLimpo.includes(queryLimpa) : false;
        const numMatch = (reg.numero_processo || '').toLowerCase().includes(query);
        const cargoPretendidoMatch = (reg.cargo_pretendido || '').toLowerCase().includes(query);
        if (!nomeMatch && !cpfMatch && !numMatch && !cargoPretendidoMatch) return false;
      }

      // 2. Tipo de processo
      if (filtroTipo && filtroTipo !== 'TODOS') {
        const regTipo = normalizeTipoRegistro(reg.tipo_registro || '');
        if (regTipo !== filtroTipo) return false;
      }

      // 3. Status
      if (filtroStatus && filtroStatus !== 'TODOS') {
        if (reg.status_processo !== filtroStatus) return false;
      }

      // 4. Grupo / Campo
      if (filtroCampoId && filtroCampoId !== 'TODOS') {
        if (reg.campo_id !== filtroCampoId) return false;
      }

      // 5. Congregação
      if (filtroCongregacaoId && filtroCongregacaoId !== 'TODOS') {
        if (reg.congregacao_id !== filtroCongregacaoId) return false;
      }

      // 6. Comissão Responsável
      if (filtroComissaoId && filtroComissaoId !== 'TODOS') {
        if (reg.comissao_id !== filtroComissaoId) return false;
      }

      return true;
    });
  }, [registros, filtroBusca, filtroTipo, filtroStatus, filtroCampoId, filtroCongregacaoId, filtroComissaoId]);

  if (ctx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;
  if (loadingData) return <div className="p-8">Carregando...</div>;

  const labelCongregacao = nomenclaturas?.divisaoPrincipal?.opcao1 || 'Congregação';
  const labelCampo = nomenclaturas?.divisaoSecundaria?.opcao1 || 'Campo';
  const labelSupervisao = nomenclaturas?.divisaoTerciaria?.opcao1 || 'Supervisão';

  const showCongregacao = labelCongregacao !== 'NENHUMA';
  const showCampo = labelCampo !== 'NENHUMA';
  const showSupervisao = labelSupervisao !== 'NENHUMA';

  const emProcessoCount = registros.filter((r) => r.status_processo === 'em_processo').length;
  const deferidosCount = registros.filter((r) => r.status_processo === 'deferir').length;
  const homologadosCount = registros.filter((r) => r.status_processo === 'homologar').length;
  const isProgressao = formRegistro.tipo_registro === 'progressao';
  const isFiliacao = formRegistro.tipo_registro === 'filiacao';
  const statusIsError = /(erro|preencha|obrigat|nao foi possivel|não foi possível|não existe|nao existe)/i.test(statusMensagem);

  if (ctx.loading || planFeatures.loading) return <div className="p-8 text-gray-500">Carregando...</div>;

  if (!planFeatures.has_modulo_comissao || !planFeatures.hasFeature('ordination_module')) {
    return (
      <PageLayout title="Consagração" description="Separação de ministros: chegadas, progressão e filiação" activeMenu="consagracao">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto text-teal-600 shadow-sm border border-teal-200/60">
            <span className="text-3xl">🙏</span>
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-teal-100 text-teal-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Intermediário
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Consagração Indisponível no seu Plano</h2>
          </div>
          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A Gestão de Consagração e Ordenação de Obreiros está disponível a partir do Plano Intermediário.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
            Faça o upgrade para gerenciar processos de consagração, ordenação, chegadas, filiações e homologação de ministros da igreja.
          </p>
          <div className="pt-3">
            <a
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos
            </a>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Consagração"
      description="Separação de ministros: chegadas, progressão e filiação"
      activeMenu="consagracao"
    >
      <div className="max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-teal-500">
          <p className="text-gray-600 text-sm">Em Processo</p>
          <p className="text-3xl font-bold text-teal-700 mt-2">{emProcessoCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Deferidos</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{deferidosCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">Homologados</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{homologadosCount}</p>
        </div>
      </div>

      {statusMensagem && (
        <div className={`mb-6 px-4 py-3 rounded border ${statusIsError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          {statusMensagem}
        </div>
      )}

            <Section icon="📋" title="Processos de Consagração">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <p className="text-gray-500 text-sm">
            Separação de ministros: chegadas, progressão e filiação ministerial.
          </p>
          {canCadastrarEditar && (
            <button
              className={`inline-flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-md ${
                consagracaoModuleReady ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-400 cursor-not-allowed'
              }`}
              onClick={handleNovoRegistro}
              disabled={!consagracaoModuleReady}
              title={!consagracaoModuleReady ? 'Aplique as migrations do módulo de Consagração no Supabase' : 'Novo Registro'}
            >
              <span>➕</span> Novo Registro
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
          {/* Linha 1: Buscar, Tipo de Processo, Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Buscar</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  placeholder="Nome, CPF ou nº processo..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                />
                <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Processo</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="">Todos os Tipos</option>
                <option value="chegada">Chegada (Novo)</option>
                <option value="progressao">Progressão</option>
                <option value="filiacao">Filiação</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos os Status</option>
                <option value="em_processo">Em Processo</option>
                <option value="deferir">Deferido</option>
                <option value="indeferir">Indeferido</option>
                <option value="homologar">Homologado</option>
              </select>
            </div>
          </div>

          {/* Linha 2: Grupo, Congregação, Comissão Responsável e Botões Limpar / Imprimir Lista */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-1">
            {showCampo && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{labelCampo}</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  value={filtroCampoId}
                  onChange={(e) => {
                    const newCampoId = e.target.value;
                    setFiltroCampoId(newCampoId);
                    if (filtroCongregacaoId) {
                      const cong = congregacoes.find((c) => c.id === filtroCongregacaoId);
                      if (cong && cong.campo_id !== newCampoId) {
                        setFiltroCongregacaoId('');
                      }
                    }
                  }}
                >
                  <option value="">Todos os {labelCampo}s</option>
                  {campos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {showCongregacao && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{labelCongregacao}</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  value={filtroCongregacaoId}
                  onChange={(e) => {
                    const newCongId = e.target.value;
                    setFiltroCongregacaoId(newCongId);
                    if (newCongId) {
                      const cong = congregacoes.find((c) => c.id === newCongId);
                      if (cong?.campo_id) {
                        setFiltroCampoId(cong.campo_id);
                      }
                    }
                  }}
                >
                  <option value="">Todas as {labelCongregacao}s</option>
                  {(filtroCampoId
                    ? congregacoes.filter((c) => c.campo_id === filtroCampoId)
                    : congregacoes
                  ).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Comissão Responsável</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                value={filtroComissaoId}
                onChange={(e) => setFiltroComissaoId(e.target.value)}
              >
                <option value="">Todas as Comissões</option>
                {comissoes.map((com) => (
                  <option key={com.id} value={com.id}>
                    {com.nome} {com.status === 'inativa' ? '(Inativa)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={limparFiltros}
                disabled={!temFiltrosAtivos}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border transition ${
                  temFiltrosAtivos
                    ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900 shadow-sm cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title="Limpar todos os filtros"
              >
                <span>✕</span> Limpar
              </button>

              <button
                type="button"
                onClick={handleImprimirLista}
                disabled={registrosFiltrados.length === 0}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition shadow-sm ${
                  registrosFiltrados.length > 0
                    ? 'bg-slate-800 hover:bg-slate-900 text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                }`}
                title="Imprimir listagem de processos filtrados"
              >
                <span>🖨️</span> Imprimir Lista
              </button>
            </div>
          </div>

          {temFiltrosAtivos && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
              <span className="text-gray-500">
                Exibindo <strong>{registrosFiltrados.length}</strong> de <strong>{registros.length}</strong> processos
              </span>
            </div>
          )}
        </div>

        {/* Tabela de Processos */}
        {loadingData ? (
          <div className="p-12 text-center text-gray-500">
            <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
            <p className="text-sm font-medium">Carregando processos de consagração...</p>
          </div>
        ) : !consagracaoModuleReady ? (
          <div className="p-8 text-center text-amber-800 bg-amber-50 rounded-xl border border-amber-200">
            <p className="font-semibold">Módulo de Consagração indisponível.</p>
            <p className="text-xs text-amber-600 mt-1">Aplique as migrations da tabela public.consagracao_registros no Supabase.</p>
          </div>
        ) : registros.length === 0 ? (
          <div className="p-12 text-center text-gray-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <span className="text-3xl mb-2 block">📑</span>
            <p className="text-base font-semibold text-slate-700">Nenhum processo cadastrado</p>
            <p className="text-xs text-gray-500 mt-1">Clique no botão "+ Novo Registro" para cadastrar o primeiro processo.</p>
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <span className="text-3xl mb-2 block">🔍</span>
            <p className="text-base font-semibold text-slate-700">Nenhum processo encontrado</p>
            <p className="text-xs text-gray-500 mt-1">Tente ajustar os filtros de busca ou clique abaixo para limpar.</p>
            <button
              onClick={limparFiltros}
              className="mt-3 px-4 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left">Nº Processo</th>
                  <th className="py-3 px-4 text-left">Data</th>
                  <th className="py-3 px-4 text-left">Ministro / Obreiro</th>
                  <th className="py-3 px-4 text-left">Tipo</th>
                  <th className="py-3 px-4 text-left">Cargo Pretendido</th>
                  <th className="py-3 px-4 text-left">Congregação / Campo</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {registrosFiltrados.map((reg) => {
                  const tipo = normalizeTipoRegistro(reg.tipo_registro || '');
                  const congNome = getCongregacaoNome(reg.congregacao_id);
                  const campoNome = getCampoNome(reg.campo_id);
                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {reg.numero_processo || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {reg.data_processo ? reg.data_processo.split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{reg.nome}</div>
                        {reg.cpf && (
                          <div className="text-xs text-gray-400 font-mono">{formatCpf(reg.cpf)}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            tipo === 'progressao'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : tipo === 'filiacao'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}
                        >
                          {tipo === 'progressao' ? 'Progressão' : tipo === 'filiacao' ? 'Filiação' : 'Chegada'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-teal-800">
                        {reg.cargo_pretendido || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        <div className="font-medium text-slate-800">{congNome}</div>
                        {campoNome !== '-' && <div className="text-gray-400">{campoNome}</div>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${
                            reg.status_processo === 'deferir'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : reg.status_processo === 'indeferir'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : reg.status_processo === 'homologar'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-teal-50 text-teal-700 border-teal-200'
                          }`}
                        >
                          {STATUS_LABELS[reg.status_processo] || reg.status_processo || 'Em Processo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition text-sm shadow-xs"
                          onClick={() => handleImprimirFichaCandidato(reg)}
                          title="Imprimir Ficha do Candidato"
                          aria-label="Imprimir Ficha do Candidato"
                        >
                          🖨️
                        </button>
                        {/* Editar Cadastro (Secretaria Geral / Admin) */}
                        {canCadastrarEditar && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition text-sm shadow-xs"
                            onClick={() => handleEditRegistro(reg)}
                            title="Editar processo"
                            aria-label="Editar processo"
                          >
                            ✏️
                          </button>
                        )}

                        {/* SECRETARIA GERAL: Registrar decisão da Comissão (quando Em Processo) */}
                        {canOperarTramitacao && reg.status_processo === 'em_processo' && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center px-2.5 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-300 hover:bg-teal-100 transition text-xs font-semibold shadow-xs gap-1"
                            onClick={() => {
                              setProcessRegistro(reg);
                              setParecerInput(reg.observacoes || '');
                              setParecerError('');
                              setProcessModalOpen(true);
                            }}
                            title="Registrar decisão da Comissão"
                            aria-label="Registrar decisão da Comissão"
                          >
                            <span>📝</span>
                            <span>Registrar decisão</span>
                          </button>
                        )}

                        {/* SECRETARIA GERAL: Homologação (quando Deferido) */}
                        {canOperarTramitacao && reg.status_processo === 'deferir' && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center px-2.5 h-8 rounded-lg bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100 transition text-xs font-semibold shadow-xs gap-1"
                            onClick={() => {
                              setProcessRegistro(reg);
                              setParecerInput(reg.observacoes || '');
                              setParecerError('');
                              setProcessModalOpen(true);
                            }}
                            title="Secretaria Geral: Homologar / Reabrir"
                            aria-label="Homologar Processo"
                          >
                            <span>📜</span>
                            <span>Homologar</span>
                          </button>
                        )}

                        {/* SECRETARIA GERAL: Reabertura administrativa (quando Indeferido) */}
                        {canOperarTramitacao && reg.status_processo === 'indeferir' && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center px-2.5 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition text-xs font-semibold shadow-xs gap-1"
                            onClick={() => {
                              setProcessRegistro(reg);
                              setParecerInput(reg.observacoes || '');
                              setParecerError('');
                              setProcessModalOpen(true);
                            }}
                            title="Secretaria Geral: Reabrir Processo"
                            aria-label="Reabrir Processo"
                          >
                            <span>🔄</span>
                            <span>Reabrir</span>
                          </button>
                        )}

                        {/* Certificado de Consagração (habilitado apenas quando Homologado) */}
                        <button
                          type="button"
                          disabled={reg.status_processo !== 'homologar'}
                          className={`inline-flex items-center justify-center px-2.5 h-8 rounded-lg border transition text-xs font-semibold shadow-xs gap-1 ${
                            reg.status_processo === 'homologar'
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 cursor-pointer'
                              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                          }`}
                          onClick={() => handleEmitirCertificado(reg)}
                          title={
                            reg.status_processo === 'homologar'
                              ? 'Emitir Certificado de Consagração'
                              : 'Certificado disponível apenas após a homologação do processo'
                          }
                          aria-label="Emitir Certificado de Consagração"
                        >
                          <span>🎓</span>
                          <span>Certificado</span>
                        </button>

                        {/* Excluir Processo (Secretaria Geral / Admin) */}
                        {canCadastrarEditar && (
                          <button
                            type="button"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm shadow-xs transition ${
                              reg.status_processo === 'homologar'
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 cursor-pointer'
                            }`}
                            onClick={() => {
                              if (reg.status_processo === 'homologar') {
                                setStatusMensagem('Processos homologados não podem ser excluídos, pois fazem parte do histórico oficial da consagração.');
                                return;
                              }
                              setRegistroParaExcluir(reg);
                              setDeleteModalOpen(true);
                            }}
                            title={
                              reg.status_processo === 'homologar'
                                ? 'Processos homologados não podem ser excluídos, pois fazem parte do histórico oficial da consagração.'
                                : 'Excluir processo'
                            }
                            aria-label="Excluir processo"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Modal de Cadastro / Edição */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col my-auto border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingRegistro ? 'Editar Processo de Consagração' : 'Novo Processo de Consagração'}
                </h3>
                <p className="text-xs text-gray-500">
                  {editingRegistro ? `Processo nº ${formRegistro.numero_processo || '-'}` : 'Preencha os dados do ministro para registrar o processo'}
                </p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-700 text-xl font-bold p-1 rounded-lg hover:bg-gray-200 transition"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
<div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-teal-700 border-b border-gray-100 pb-2">Dados do Processo</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Número do Processo <span className="text-red-500">*</span>
                          </label>
                          <input
                            name="numero_processo"
                            id="numero_processo"
                            className={`mt-1 w-full px-3 py-2 border-2 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 ${fieldErrors.numero_processo ? 'border-red-500 focus:ring-red-400' : 'border-teal-500 focus:ring-blue-500'}`}
                            value={formRegistro.numero_processo}
                            readOnly
                          />
                          {fieldErrors.numero_processo && (
                            <p className="mt-1 text-xs text-red-600">{fieldErrors.numero_processo}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Tipo de Registro <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="tipo_registro"
                            id="tipo_registro"
                            className={`mt-1 w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.tipo_registro ? 'border-red-500 focus:ring-red-400' : 'border-teal-500 focus:ring-blue-500'}`}
                            value={formRegistro.tipo_registro}
                            onChange={(e) => {
                              const value = normalizeTipoRegistro(e.target.value);
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.tipo_registro;
                                return next;
                              });
                              setFormRegistro((prev) => {
                                const leavingProgressao = prev.tipo_registro === 'progressao' && value !== 'progressao';
                                return {
                                  ...prev,
                                  tipo_registro: value,
                                  member_id: value === 'progressao' ? prev.member_id : '',
                                  cargo_ocupa: value === 'progressao' ? prev.cargo_ocupa : '',
                                  origem_instituicao: value === 'filiacao' ? prev.origem_instituicao : '',
                                  origem_cidade: value === 'filiacao' ? prev.origem_cidade : '',
                                  origem_uf: value === 'filiacao' ? prev.origem_uf : '',
                                  origem_data_consagracao: value === 'filiacao' ? prev.origem_data_consagracao : '',
                                  foto_url: leavingProgressao ? '' : prev.foto_url
                                };
                              });
                              if (value !== 'progressao') {
                                setMemberQuery('');
                                setMemberResults([]);
                                setMemberOpen(false);
                                setFotoBloqueada(false);
                              }
                            }}
                          >
                            {TIPO_REGISTRO_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          {fieldErrors.tipo_registro && (
                            <p className="mt-1 text-xs text-red-600">{fieldErrors.tipo_registro}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Categoria do Registro <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="categoria_registro"
                            id="categoria_registro"
                            className={`mt-1 w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.categoria_registro ? 'border-red-500 focus:ring-red-400' : 'border-teal-500 focus:ring-blue-500'}`}
                            value={formRegistro.categoria_registro}
                            onChange={(e) => {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.categoria_registro;
                                return next;
                              });
                              setFormRegistro({ ...formRegistro, categoria_registro: e.target.value });
                            }}
                          >
                            <option value="">Selecione</option>
                            {CATEGORIA_REGISTRO_OPTIONS.map((categoria) => (
                              <option key={categoria} value={categoria}>{categoria}</option>
                            ))}
                          </select>
                          {fieldErrors.categoria_registro && (
                            <p className="mt-1 text-xs text-red-600">{fieldErrors.categoria_registro}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Comissão Responsável <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="comissao_id"
                            id="comissao_id"
                            className={`mt-1 w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.comissao_id ? 'border-red-500 focus:ring-red-400' : 'border-teal-500 focus:ring-blue-500'}`}
                            value={formRegistro.comissao_id}
                            onChange={(e) => {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.comissao_id;
                                return next;
                              });
                              setFormRegistro({ ...formRegistro, comissao_id: e.target.value });
                            }}
                            disabled={loadingComissoes}
                          >
                            <option value="">{loadingComissoes ? 'Carregando comissões...' : 'Selecione a comissão...'}</option>
                            {comissoesAtivas.map((com) => (
                              <option key={com.id} value={com.id}>{com.nome}</option>
                            ))}
                          </select>
                          {fieldErrors.comissao_id && (
                            <p className="mt-1 text-xs text-red-600">{fieldErrors.comissao_id}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-teal-700 border-b border-gray-100 pb-2">Dados Pessoais</h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="relative">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
                          <input
                            className={`mt-1 w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.nome || fieldErrors.member_id ? 'border-red-500 focus:ring-red-400' : 'border-teal-500 focus:ring-blue-500'}`}
                            value={formRegistro.nome}
                            autoComplete={!isProgressao ? 'new-password' : 'on'}
                            autoCorrect={!isProgressao ? 'off' : undefined}
                            autoCapitalize={!isProgressao ? 'off' : undefined}
                            spellCheck={!isProgressao ? false : undefined}
                            name="consagracao_nome_completo"
                            data-lpignore={!isProgressao ? 'true' : undefined}
                            onChange={(e) => {
                              const value = e.target.value;
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.nome;
                                delete next.member_id;
                                return next;
                              });
                              setFormRegistro((prev) => ({
                                ...prev,
                                nome: value,
                                member_id: '',
                              }));
                              setMemberQuery(value);
                              setFotoBloqueada(false);
                            }}
                            placeholder="Digite o nome ou CPF para buscar membro/ministro no cadastro"
                          />
                          {memberOpen && memberResults.length > 0 && (
                            <div className="absolute z-20 mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto divide-y divide-slate-100">
                              {memberResults.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => handleSelectMember(m)}
                                  className="w-full px-4 py-2.5 text-left hover:bg-teal-50/70 transition flex items-center justify-between text-sm"
                                >
                                  <div>
                                    <div className="font-semibold text-gray-800">{m.name}</div>
                                    <div className="text-xs text-gray-500">
                                      CPF: {(m as any).cpf || '-'} • Matrícula: {(m as any).matricula || '-'}
                                    </div>
                                  </div>
                                  {(m as any).cargo_ministerial && (
                                    <span className="text-xs font-semibold px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full">
                                      {(m as any).cargo_ministerial}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            Digite para buscar um membro/ministro já cadastrado (preenchimento automático) ou preencha manualmente para novos candidatos/filiações.
                          </p>
                          {(fieldErrors.nome || fieldErrors.member_id) && (
                            <p className="mt-1 text-xs text-red-600">{fieldErrors.member_id || fieldErrors.nome}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">CPF</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.cpf}
                            onChange={(e) => setFormRegistro({ ...formRegistro, cpf: formatCpf(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Nascimento</label>
                          <input
                            type="date"
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.data_nascimento}
                            onChange={(e) => setFormRegistro({ ...formRegistro, data_nascimento: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Sexo</label>
                          <select
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.sexo}
                            onChange={(e) => setFormRegistro({ ...formRegistro, sexo: e.target.value })}
                          >
                            <option value="MASCULINO">Masculino</option>
                            <option value="FEMININO">Feminino</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Filiação: Pai</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.nome_pai}
                            onChange={(e) => setFormRegistro({ ...formRegistro, nome_pai: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Filiação: Mãe</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.nome_mae}
                            onChange={(e) => setFormRegistro({ ...formRegistro, nome_mae: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Estado Civil</label>
                          <select
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.estado_civil}
                            onChange={(e) => setFormRegistro({ ...formRegistro, estado_civil: e.target.value })}
                          >
                            <option value="">Selecione</option>
                            <option value="SOLTEIRO">Solteiro(a)</option>
                            <option value="CASADO">Casado(a)</option>
                            <option value="DIVORCIADO">Divorciado(a)</option>
                            <option value="VIUVO">Viúvo(a)</option>
                            <option value="UNIAO ESTAVEL">União Estável</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">RG/Órgão Emissor</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.rg}
                            onChange={(e) => setFormRegistro({ ...formRegistro, rg: e.target.value })}
                            placeholder="RG"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Órgão Emissor</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.orgao_emissor}
                            onChange={(e) => setFormRegistro({ ...formRegistro, orgao_emissor: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Cônjuge</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.nome_conjuge}
                            onChange={(e) => setFormRegistro({ ...formRegistro, nome_conjuge: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Nacionalidade</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.nacionalidade}
                            onChange={(e) => setFormRegistro({ ...formRegistro, nacionalidade: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Naturalidade/UF</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.naturalidade}
                            onChange={(e) => setFormRegistro({ ...formRegistro, naturalidade: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.email}
                            onChange={(e) => setFormRegistro({ ...formRegistro, email: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-teal-700 border-b border-gray-100 pb-2">Contato e Estrutura Ministerial</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.telefone}
                            onChange={(e) => setFormRegistro({ ...formRegistro, telefone: formatPhone(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Matrícula</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                            value={formRegistro.matricula}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Data do Processo</label>
                          <input
                            type="date"
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.data_processo}
                            onChange={(e) => setFormRegistro({ ...formRegistro, data_processo: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Indicação</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.pastor_solicitante}
                            onChange={(e) => setFormRegistro({ ...formRegistro, pastor_solicitante: e.target.value })}
                            placeholder="Nome do pastor que indica o ministro"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {showSupervisao && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{labelSupervisao}</label>
                            <select
                              className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={formRegistro.supervisao_id}
                              onChange={(e) => {
                                const newSupId = e.target.value;
                                setFormRegistro((prev) => {
                                  const currentCampo = campos.find((c) => c.id === prev.campo_id);
                                  const keepCampo = Boolean(currentCampo && currentCampo.supervisao_id === newSupId);
                                  return {
                                    ...prev,
                                    supervisao_id: newSupId,
                                    campo_id: keepCampo ? prev.campo_id : '',
                                    congregacao_id: keepCampo ? prev.congregacao_id : '',
                                  };
                                });
                              }}
                            >
                              <option value="">Selecione</option>
                              {supervisoes.map((s) => (
                                <option key={s.id} value={s.id}>{s.nome}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {showCampo && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{labelCampo}</label>
                            <select
                              className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={formRegistro.campo_id}
                              onChange={(e) => {
                                const newCampoId = e.target.value;
                                const campoObj = campos.find((c) => c.id === newCampoId);
                                setFormRegistro((prev) => {
                                  const currentCong = congregacoes.find((cg) => cg.id === prev.congregacao_id);
                                  const keepCong = Boolean(currentCong && currentCong.campo_id === newCampoId);
                                  return {
                                    ...prev,
                                    campo_id: newCampoId,
                                    supervisao_id: campoObj?.supervisao_id || prev.supervisao_id,
                                    congregacao_id: keepCong ? prev.congregacao_id : '',
                                  };
                                });
                              }}
                            >
                              <option value="">Selecione</option>
                              {(formRegistro.supervisao_id
                                ? campos.filter((c) => c.supervisao_id === formRegistro.supervisao_id)
                                : campos
                              ).map((c) => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {showCongregacao && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{labelCongregacao}</label>
                            <select
                              className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={formRegistro.congregacao_id}
                              onChange={(e) => {
                                const newCongId = e.target.value;
                                const congObj = congregacoes.find((cg) => cg.id === newCongId);
                                const campoObj = congObj?.campo_id ? campos.find((c) => c.id === congObj.campo_id) : null;
                                setFormRegistro((prev) => ({
                                  ...prev,
                                  congregacao_id: newCongId,
                                  campo_id: congObj?.campo_id || prev.campo_id,
                                  supervisao_id: campoObj?.supervisao_id || prev.supervisao_id,
                                }));
                              }}
                            >
                              <option value="">Selecione</option>
                              {(formRegistro.campo_id
                                ? congregacoes.filter((c) => c.campo_id === formRegistro.campo_id)
                                : formRegistro.supervisao_id
                                ? congregacoes.filter((c) => {
                                    const cCampo = campos.find((cp) => cp.id === c.campo_id);
                                    return cCampo?.supervisao_id === formRegistro.supervisao_id;
                                  })
                                : congregacoes
                              ).map((c) => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Cargo que ocupa {isProgressao && <span className="text-red-500">*</span>}
                          </label>
                          {isProgressao ? (
                            <select
                              name="cargo_ocupa"
                              id="cargo_ocupa"
                              className={`mt-1 w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.cargo_ocupa ? 'border-red-500 focus:ring-red-400' : 'border-teal-500 focus:ring-blue-500'}`}
                              value={formRegistro.cargo_ocupa}
                              onChange={(e) => {
                                setFieldErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.cargo_ocupa;
                                  return next;
                                });
                                setFormRegistro({ ...formRegistro, cargo_ocupa: e.target.value });
                              }}
                            >
                              <option value="">Selecione</option>
                              {cargosMinisteriais.filter((c) => c.ativo).map((cargo) => (
                                <option key={cargo.id} value={cargo.nome}>{cargo.nome}</option>
                              ))}
                              {formRegistro.cargo_ocupa &&
                                !cargosMinisteriais.some((c) => c.nome.toLowerCase() === formRegistro.cargo_ocupa.toLowerCase()) && (
                                  <option value={formRegistro.cargo_ocupa}>{formRegistro.cargo_ocupa}</option>
                                )}
                            </select>
                          ) : (
                            <input
                              name="cargo_ocupa"
                              id="cargo_ocupa"
                              className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                              value="Não se aplica"
                              readOnly
                            />
                          )}
                          {isProgressao && fieldErrors.cargo_ocupa && (
                            <p className="mt-1 text-xs text-red-600">{fieldErrors.cargo_ocupa}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Cargo pretendido <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="cargo_pretendido"
                            id="cargo_pretendido"
                            className={`mt-1 w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.cargo_pretendido ? 'border-red-500 focus:ring-red-400' : 'border-teal-500 focus:ring-blue-500'}`}
                            value={formRegistro.cargo_pretendido}
                            onChange={(e) => {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.cargo_pretendido;
                                return next;
                              });
                              setFormRegistro({ ...formRegistro, cargo_pretendido: e.target.value });
                            }}
                          >
                            <option value="">Selecione</option>
                            {cargosMinisteriais.filter((c) => c.ativo).map((cargo) => (
                              <option key={cargo.id} value={cargo.nome}>{cargo.nome}</option>
                            ))}
                            {formRegistro.cargo_pretendido &&
                              !cargosMinisteriais.some((c) => c.nome.toLowerCase() === formRegistro.cargo_pretendido.toLowerCase()) && (
                                <option value={formRegistro.cargo_pretendido}>{formRegistro.cargo_pretendido}</option>
                              )}
                          </select>
                          {fieldErrors.cargo_pretendido && (
                            <p className="mt-1 text-xs text-red-600">{fieldErrors.cargo_pretendido}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {isFiliacao && (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-amber-900 border-b border-amber-200 pb-2">Dados de Origem para Filiação</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Instituição de origem *</label>
                            <input
                              name="origem_instituicao"
                              id="origem_instituicao"
                              className={`mt-1 w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${fieldErrors.origem_instituicao ? 'border-red-500 focus:ring-red-400' : 'border-amber-400 focus:ring-amber-500'}`}
                              value={formRegistro.origem_instituicao}
                              onChange={(e) => {
                                setFieldErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.origem_instituicao;
                                  return next;
                                });
                                setFormRegistro({ ...formRegistro, origem_instituicao: e.target.value });
                              }}
                            />
                            {fieldErrors.origem_instituicao && (
                              <p className="mt-1 text-xs text-red-600">{fieldErrors.origem_instituicao}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade de origem</label>
                            <input
                              className="mt-1 w-full px-3 py-2 border-2 border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                              value={formRegistro.origem_cidade}
                              onChange={(e) => setFormRegistro({ ...formRegistro, origem_cidade: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">UF de origem</label>
                            <input
                              className="mt-1 w-full px-3 py-2 border-2 border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                              value={formRegistro.origem_uf}
                              onChange={(e) => setFormRegistro({ ...formRegistro, origem_uf: e.target.value.toUpperCase().slice(0, 2) })}
                              maxLength={2}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Data da consagração de origem</label>
                            <input
                              type="date"
                              className="mt-1 w-full px-3 py-2 border-2 border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                              value={formRegistro.origem_data_consagracao}
                              onChange={(e) => setFormRegistro({ ...formRegistro, origem_data_consagracao: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-teal-700 border-b border-gray-100 pb-2">Andamento e Observações</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Data Autorização</label>
                          <input
                            type="date"
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.data_autorizacao}
                            onChange={(e) => setFormRegistro({ ...formRegistro, data_autorizacao: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Status do Processo</label>
                          <div className="mt-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-800">
                              {STATUS_LABELS[formRegistro.status_processo] || formRegistro.status_processo || 'Em Processo'}
                            </span>
                            <span className="text-xs text-slate-500 italic">
                              (Fluxo de tramitação)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Observações</label>
                        <textarea
                          className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          value={formRegistro.observacoes}
                          onChange={(e) => setFormRegistro({ ...formRegistro, observacoes: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
                      <h4 className="text-sm font-semibold text-teal-700 border-b border-gray-100 pb-2 mb-3">Foto do Candidato</h4>
                      <div className="w-full h-48 rounded border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                        {formRegistro.foto_url ? (
                          <img src={formRegistro.foto_url} alt="Foto" className="max-h-44 object-contain" />
                        ) : (
                          <span className="text-xs text-gray-500">Sem foto</span>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        <button
                          className={`w-full px-3 py-2 rounded-lg text-sm font-semibold ${
                            fotoBloqueada
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-teal-500 text-white hover:bg-teal-600'
                          }`}
                          onClick={() => !fotoBloqueada && fileInputRef.current?.click()}
                          disabled={fotoBloqueada}
                        >
                          {fotoBloqueada ? 'Foto já cadastrada' : 'Abrir Foto'}
                        </button>
                        {!fotoBloqueada && formRegistro.foto_url && (
                          <button
                            className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-red-100 text-red-700 hover:bg-red-200"
                            onClick={() => setFormRegistro((prev) => ({ ...prev, foto_url: '' }))}
                          >
                            Remover Foto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                
              <div className="flex gap-3 justify-end mt-6">
                <button
                  className="px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-600 hover:text-gray-800"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-white font-semibold transition shadow-md ${ministryId && consagracaoModuleReady ? 'bg-teal-500 hover:bg-teal-600' : 'bg-gray-400 cursor-not-allowed'}`}
                  onClick={handleSaveRegistro}
                  disabled={!ministryId || !consagracaoModuleReady}
                  title={!consagracaoModuleReady ? 'Aplique as migrations do módulo de Consagração no Supabase' : (!ministryId ? 'Sem ministério associado ao usuário' : 'Salvar registro')}
                >
                  Salvar
                </button>
              </div>

              {statusMensagem && (
                <div className={`mt-4 px-4 py-3 rounded border ${statusIsError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                  {statusMensagem}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFotoUpload}
      />

      {deleteModalOpen && registroParaExcluir && registroParaExcluir.status_processo !== 'homologar' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 text-2xl">
                ⚠️
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800">Excluir processo?</h3>
                <p className="text-sm text-slate-600 mt-2">
                  Esta ação excluirá o processo. O candidato voltará à lista de ativos e seu cargo atual será preservado, pois a consagração ainda não foi homologada.
                </p>
                {registroParaExcluir.nome && (
                  <p className="text-xs text-slate-500 font-medium mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    Candidato: <strong>{registroParaExcluir.nome}</strong> {registroParaExcluir.numero_processo ? `(Processo nº ${registroParaExcluir.numero_processo})` : ''}
                  </p>
                )}
                <p className="text-xs text-red-600 font-semibold mt-2">
                  Esta ação não poderá ser desfeita.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (deleting) return;
                  setDeleteModalOpen(false);
                  setRegistroParaExcluir(null);
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deleting || !registroParaExcluir) return;
                  setDeleting(true);
                  try {
                    await handleDeleteRegistro(registroParaExcluir.id);
                    setDeleteModalOpen(false);
                    setRegistroParaExcluir(null);
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-xl transition shadow-sm cursor-pointer"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {processModalOpen && processRegistro && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-100">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {processRegistro.status_processo === 'em_processo'
                    ? '📝'
                    : processRegistro.status_processo === 'deferir'
                    ? '📜'
                    : '🔄'}
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  {processRegistro.status_processo === 'em_processo'
                    ? 'Decisão da Comissão'
                    : processRegistro.status_processo === 'deferir'
                    ? 'Homologação — Secretaria Geral'
                    : 'Reabertura — Secretaria Geral'}
                </h3>
              </div>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                onClick={() => {
                  setProcessModalOpen(false);
                  setProcessRegistro(null);
                  setParecerInput('');
                  setParecerError('');
                }}
              >
                ✕
              </button>
            </div>

            {/* Resumo do Processo */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nº Processo:</span>
                <span className="font-bold text-slate-800">{processRegistro.numero_processo || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Candidato / Ministro:</span>
                <span className="font-bold text-slate-900">{processRegistro.nome}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Cargo Pretendido:</span>
                <span className="font-semibold text-teal-700">{processRegistro.cargo_pretendido || '-'}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-medium">Status Atual:</span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    processRegistro.status_processo === 'deferir'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : processRegistro.status_processo === 'indeferir'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : processRegistro.status_processo === 'homologar'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-teal-50 text-teal-700 border-teal-200'
                  }`}
                >
                  {STATUS_LABELS[processRegistro.status_processo] || processRegistro.status_processo || 'Em Processo'}
                </span>
              </div>
            </div>

            {/* Ações Específicas por Status */}
            {processRegistro.status_processo === 'em_processo' && canOperarTramitacao && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 p-3 rounded-lg">
                  📝 <strong>Secretaria Geral:</strong> Registre abaixo a decisão recebida da Comissão de Consagração após análise da Ficha do Processo.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    PARECER / DESPACHO DA COMISSÃO <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-slate-500">
                    Transcreva neste campo o parecer registrado pela Comissão na Ficha do Processo.
                  </p>
                  <textarea
                    rows={4}
                    value={parecerInput}
                    onChange={(e) => {
                      setParecerInput(e.target.value);
                      if (parecerError) setParecerError('');
                    }}
                    placeholder="Ex.: Candidato avaliado e aprovado por unanimidade pela comissão..."
                    className={`w-full p-3 text-sm border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition resize-y ${
                      parecerError ? 'border-red-500 bg-red-50/40' : 'border-slate-300 bg-white'
                    }`}
                  />
                  {parecerError && (
                    <p className="text-xs text-red-600 font-semibold mt-1 animate-in fade-in duration-150">
                      ⚠️ {parecerError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
                    onClick={() => handleComissaoDecisao('deferir')}
                  >
                    <span>✅</span> Deferido
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
                    onClick={() => handleComissaoDecisao('indeferir')}
                  >
                    <span>❌</span> Indeferido
                  </button>
                </div>
              </div>
            )}

            {processRegistro.status_processo === 'deferir' && canOperarTramitacao && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 bg-purple-50 border border-purple-200 p-3 rounded-lg">
                  📜 <strong>Secretaria Geral:</strong> Processo deferido pela Comissão. Homologue para efetivar oficialmente os registros e histórico ministerial, ou reabra se houver pendência administrativa.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition shadow-md cursor-pointer"
                    onClick={handleSecretariaHomologar}
                  >
                    <span>📜</span> Homologar Consagração
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition text-sm cursor-pointer"
                    onClick={handleSecretariaReabrir}
                  >
                    <span>🔄</span> Voltar para Em Processo (Reabrir)
                  </button>
                </div>
              </div>
            )}

            {processRegistro.status_processo === 'indeferir' && canOperarTramitacao && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 bg-red-50 border border-red-200 p-3 rounded-lg">
                  🔄 <strong>Secretaria Geral:</strong> Processo indeferido pela Comissão. A Secretaria Geral pode reabri-lo administrativamente para uma nova análise pela Comissão.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md cursor-pointer"
                    onClick={handleSecretariaReabrir}
                  >
                    <span>🔄</span> Voltar para Em Processo (Reabrir)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}

