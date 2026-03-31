'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useMembers } from '@/hooks/useMembers';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { loadOrgNomenclaturasFromSupabaseOrMigrate, type OrgNomenclaturasState } from '@/lib/org-nomenclaturas';
import { getCargosMinisteriais, type CargoMinisterial } from '@/lib/cargos-utils';
import { formatCpf, formatPhone } from '@/lib/mascaras';
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer';
import type { Member } from '@/types/supabase';

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
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);
  const { fetchMembers } = useMembers();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppressNextSearchRef = useRef(false);

  const [activeTab, setActiveTab] = useState('cadastro');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [nomenclaturas, setNomenclaturas] = useState<OrgNomenclaturasState | null>(null);
  const [supervisoes, setSupervisoes] = useState<SimpleOption[]>([]);
  const [campos, setCampos] = useState<SimpleOption[]>([]);
  const [congregacoes, setCongregacoes] = useState<SimpleOption[]>([]);
  const [cargosMinisteriais] = useState<CargoMinisterial[]>(() => getCargosMinisteriais());

  const [registros, setRegistros] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<any | null>(null);
  const [statusMensagem, setStatusMensagem] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processRegistro, setProcessRegistro] = useState<any | null>(null);
  const [consagracaoModuleReady, setConsagracaoModuleReady] = useState(true);

  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [memberOpen, setMemberOpen] = useState(false);
  const [fotoBloqueada, setFotoBloqueada] = useState(false);
  const todayIso = () => new Date().toISOString().slice(0, 10);

  const [formRegistro, setFormRegistro] = useState({
    tipo_registro: 'chegada',
    categoria_registro: '',
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

  const tabs = [
    { id: 'cadastro', label: 'Cadastro de Processos', icon: '📝' },
    { id: 'registros', label: 'Registros', icon: '📑' }
  ];

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

    const orgNomes = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase, { syncLocalStorage: false });
    setNomenclaturas(orgNomes);

    if (resolvedMinistryId) {
      const [supRes, camposRes, congRes] = await Promise.all([
        supabase.from('supervisoes').select('id, nome').eq('ministry_id', resolvedMinistryId).order('nome'),
        supabase.from('campos').select('id, nome, supervisao_id').eq('ministry_id', resolvedMinistryId).order('nome'),
        supabase.from('congregacoes').select('id, nome, supervisao_id, campo_id').eq('ministry_id', resolvedMinistryId).order('nome')
      ]);

      if (!supRes.error) setSupervisoes((supRes.data as SimpleOption[]) || []);
      if (!camposRes.error) setCampos((camposRes.data as SimpleOption[]) || []);
      if (!congRes.error) setCongregacoes((congRes.data as SimpleOption[]) || []);
    }

    const { data, error } = await supabase
      .from('consagracao_registros')
      .select('*')
      .order('created_at', { ascending: false });
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
    if (!loading) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (formRegistro.tipo_registro !== 'progressao') {
      setMemberQuery('');
      setMemberResults([]);
      setMemberOpen(false);
      setFotoBloqueada(false);
      return;
    }
  }, [formRegistro.tipo_registro]);

  useEffect(() => {
    let cancelled = false;
    const query = memberQuery.trim();

    if (formRegistro.tipo_registro !== 'progressao') {
      setMemberResults([]);
      setMemberOpen(false);
      return;
    }

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
  }, [memberQuery, fetchMembers, formRegistro.tipo_registro]);

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
    const cargoOcupa =
      (member as any).cargo_ministerial ||
      cf.cargoMinisterial ||
      (member as any).occupation ||
      cf.qualFuncao ||
      cf.cargo ||
      '';
    const processDate = new Date().toISOString().slice(0, 10);

    const normalizeText = (value: unknown) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

    const findOptionIdByName = (options: SimpleOption[], rawName: unknown) => {
      const target = normalizeText(rawName);
      if (!target) return '';
      const found = options.find((opt) => normalizeText(opt.nome) === target);
      return found?.id || '';
    };

    const memberSupervisaoIdRaw =
      String((member as any).supervisao_id || cf.supervisao_id || '') ||
      findOptionIdByName(
        supervisoes,
        (member as any).supervisao || cf.supervisao || cf.regional || cf.divisao3
      );

    const memberCampoIdRaw =
      String((member as any).campo_id || cf.campo_id || '') ||
      findOptionIdByName(
        campos,
        (member as any).campo || cf.campo || cf.setor || cf.divisao2
      );

    const memberCongregacaoIdRaw =
      String((member as any).congregacao_id || cf.congregacao_id || '') ||
      findOptionIdByName(
        congregacoes,
        (member as any).congregacao || cf.congregacao || cf.igreja || cf.divisao1
      );

    const campoFromId = campos.find((c) => c.id === memberCampoIdRaw) || null;
    const congregacaoFromId = congregacoes.find((c) => c.id === memberCongregacaoIdRaw) || null;
    const campoFromCongregacao = congregacaoFromId?.campo_id
      ? campos.find((c) => c.id === congregacaoFromId.campo_id) || null
      : null;

    const memberSupervisaoId =
      memberSupervisaoIdRaw ||
      campoFromId?.supervisao_id ||
      congregacaoFromId?.supervisao_id ||
      campoFromCongregacao?.supervisao_id ||
      '';

    const memberCampoId =
      memberCampoIdRaw ||
      congregacaoFromId?.campo_id ||
      '';

    const memberCongregacaoId = memberCongregacaoIdRaw || '';

    suppressNextSearchRef.current = true;
    setMemberQuery(member.name || (member as any).nome || '');
    setMemberOpen(false);
    setFotoBloqueada(Boolean(fotoUrl));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.nome;
      delete next.member_id;
      return next;
    });

    setFormRegistro((prev) => ({
      ...prev,
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
      supervisao_id: memberSupervisaoId || '',
      campo_id: memberCampoId || '',
      congregacao_id: memberCongregacaoId || '',
      cargo_ocupa: cargoOcupa || prev.cargo_ocupa,
      pastor_solicitante: prev.pastor_solicitante,
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

    if (!formRegistro.nome.trim()) {
      nextErrors.nome = 'Nome completo é obrigatório.';
    }

    if (!formRegistro.cargo_pretendido) {
      nextErrors.cargo_pretendido = 'Selecione o cargo pretendido.';
    }

    if (tipoRegistro === 'progressao') {
      if (!formRegistro.member_id) {
        nextErrors.member_id = 'Selecione um ministro da busca para progressão.';
      }
      if (!formRegistro.cargo_ocupa) {
        nextErrors.cargo_ocupa = 'Informe o cargo que ocupa.';
      }
    }

    if (tipoRegistro === 'filiacao' && !formRegistro.origem_instituicao.trim()) {
      nextErrors.origem_instituicao = 'Instituição de origem é obrigatória para filiação.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setStatusMensagem('Preencha os campos obrigatórios destacados em vermelho.');
      return;
    }

    setFieldErrors({});

    const payload = {
      ministry_id: ministryId,
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
      const { error } = await supabase
        .from('consagracao_registros')
        .update({ ...normalizedPayload, updated_at: new Date().toISOString() })
        .eq('id', editingRegistro.id);
      if (error) {
        if (isConsagracaoTableMissing(error)) {
          setConsagracaoModuleReady(false);
          setStatusMensagem('Módulo Consagração indisponível: tabela public.consagracao_registros não encontrada. Aplique as migrations de Consagração no Supabase.');
          return;
        }
        setStatusMensagem(`Erro ao atualizar registro: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase
        .from('consagracao_registros')
        .insert(normalizedPayload);
      if (error) {
        if (isConsagracaoTableMissing(error)) {
          setConsagracaoModuleReady(false);
          setStatusMensagem('Módulo Consagração indisponível: tabela public.consagracao_registros não encontrada. Aplique as migrations de Consagração no Supabase.');
          return;
        }
        setStatusMensagem(`Erro ao criar registro: ${error.message}`);
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

    setStatusMensagem('Registro salvo.');
    resetForm();
    setShowForm(false);
    await ensureNumeroProcesso();
    const { data, error } = await supabase
      .from('consagracao_registros')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setRegistros(data);
  };

  const handleDeleteRegistro = async (id: string) => {
    if (!consagracaoModuleReady) {
      setStatusMensagem('Módulo Consagração indisponível: tabela de registros não encontrada no banco.');
      return;
    }

    const { error } = await supabase
      .from('consagracao_registros')
      .delete()
      .eq('id', id);
    if (error) {
      if (isConsagracaoTableMissing(error)) {
        setConsagracaoModuleReady(false);
        setStatusMensagem('Módulo Consagração indisponível: tabela public.consagracao_registros não encontrada. Aplique as migrations de Consagração no Supabase.');
        return;
      }
      setStatusMensagem('Erro ao remover registro.');
      return;
    }
    setRegistros((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateStatus = async (status: string) => {
    if (!consagracaoModuleReady) {
      setStatusMensagem('Módulo Consagração indisponível: tabela de registros não encontrada no banco.');
      return;
    }

    if (!processRegistro) return;
    const { error } = await supabase
      .from('consagracao_registros')
      .update({ status_processo: status, updated_at: new Date().toISOString() })
      .eq('id', processRegistro.id);
    if (error) {
      if (isConsagracaoTableMissing(error)) {
        setConsagracaoModuleReady(false);
        setStatusMensagem('Módulo Consagração indisponível: tabela public.consagracao_registros não encontrada. Aplique as migrations de Consagração no Supabase.');
        return;
      }
      setStatusMensagem('Erro ao atualizar status.');
      return;
    }
    setRegistros((prev) =>
      prev.map((r) => (r.id === processRegistro.id ? { ...r, status_processo: status } : r))
    );

    const tipoProcesso = normalizeTipoRegistro(processRegistro.tipo_registro || '');
    if (tipoProcesso === 'progressao' && processRegistro.member_id) {
      await syncMemberProgressStatus(
        processRegistro.member_id,
        status,
        processRegistro.cargo_pretendido || '',
        processRegistro.cargo_ocupa || ''
      );
    }

    setProcessModalOpen(false);
    setProcessRegistro(null);
  };

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

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
  const statusIsError = /(erro|preencha|obrigat|nao foi possivel|não foi possível)/i.test(statusMensagem);

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

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'cadastro' && (
          <Section icon="📝" title="Cadastro de Processos">
            <div className="flex items-center justify-between gap-4 mb-6">
              <p className="text-gray-500">Cadastre processos de chegada, progressão e filiação ministerial.</p>
              <button
                className={`text-white px-4 py-2 rounded-lg transition shadow-md ${consagracaoModuleReady ? 'bg-teal-500 hover:bg-teal-600' : 'bg-gray-400 cursor-not-allowed'}`}
                onClick={() => {
                  setStatusMensagem('');
                  resetForm();
                  setShowForm(true);
                      ensureNumeroProcesso();
                }}
                disabled={!consagracaoModuleReady}
                title={!consagracaoModuleReady ? 'Aplique as migrations do módulo de Consagração no Supabase' : 'Novo Registro'}
              >
                + Novo Registro
              </button>
            </div>

            {showForm && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6 max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-teal-700 border-b border-gray-100 pb-2">Dados do Processo</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Número do Processo</label>
                          <input
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.numero_processo}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Registro</label>
                          <select
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.tipo_registro}
                            onChange={(e) => {
                              const value = normalizeTipoRegistro(e.target.value);
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
                                setFieldErrors({});
                              }
                            }}
                          >
                            {TIPO_REGISTRO_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria do Registro</label>
                          <select
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.categoria_registro}
                            onChange={(e) => setFormRegistro({ ...formRegistro, categoria_registro: e.target.value })}
                          >
                            <option value="">Selecione</option>
                            {CATEGORIA_REGISTRO_OPTIONS.map((categoria) => (
                              <option key={categoria} value={categoria}>{categoria}</option>
                            ))}
                          </select>
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
                                member_id: isProgressao ? '' : prev.member_id,
                                cpf: isProgressao ? '' : prev.cpf,
                                data_nascimento: isProgressao ? '' : prev.data_nascimento,
                                rg: isProgressao ? '' : prev.rg,
                                estado_civil: isProgressao ? '' : prev.estado_civil,
                                nacionalidade: isProgressao ? '' : prev.nacionalidade,
                                naturalidade: isProgressao ? '' : prev.naturalidade,
                                uf: isProgressao ? '' : prev.uf,
                                email: isProgressao ? '' : prev.email,
                                telefone: isProgressao ? '' : prev.telefone,
                                nome_pai: isProgressao ? '' : prev.nome_pai,
                                nome_mae: isProgressao ? '' : prev.nome_mae,
                                nome_conjuge: isProgressao ? '' : prev.nome_conjuge,
                                matricula: isProgressao ? '' : prev.matricula,
                                foto_url: isProgressao ? '' : prev.foto_url,
                              }));
                              if (isProgressao) {
                                setMemberQuery(value);
                                setFotoBloqueada(false);
                              } else {
                                setMemberQuery('');
                                setMemberResults([]);
                                setMemberOpen(false);
                              }
                            }}
                            placeholder={isProgressao ? 'Digite o nome ou CPF para buscar no cadastro' : 'Preenchimento manual'}
                          />
                          {isProgressao && memberOpen && memberResults.length > 0 && (
                            <div className="absolute z-20 mt-2 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                              {memberResults.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => handleSelectMember(m)}
                                  className="w-full px-4 py-2 text-left hover:bg-blue-50 text-sm"
                                >
                                  <div className="font-semibold text-gray-800">{m.name}</div>
                                  <div className="text-xs text-gray-500">CPF: {(m as any).cpf || '-'}</div>
                                </button>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            {isProgressao
                              ? 'No tipo Progressão, a busca é dinâmica e o cadastro é preenchido automaticamente ao selecionar um ministro.'
                              : 'No tipo Candidato ou Filiação, o preenchimento é manual.'}
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
                              onChange={(e) => setFormRegistro({ ...formRegistro, supervisao_id: e.target.value })}
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
                              onChange={(e) => setFormRegistro({ ...formRegistro, campo_id: e.target.value })}
                            >
                              <option value="">Selecione</option>
                              {campos.map((c) => (
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
                              onChange={(e) => setFormRegistro({ ...formRegistro, congregacao_id: e.target.value })}
                            >
                              <option value="">Selecione</option>
                              {congregacoes.map((c) => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Cargo que ocupa</label>
                          {isProgressao ? (
                            <select
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
                            </select>
                          ) : (
                            <input
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
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Cargo pretendido</label>
                          <select
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
                          <select
                            className="mt-1 w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formRegistro.status_processo}
                            onChange={(e) => setFormRegistro({ ...formRegistro, status_processo: e.target.value })}
                          >
                            <option value="em_processo">Em Processo</option>
                            <option value="deferir">Deferido</option>
                            <option value="indeferir">Indeferido</option>
                            <option value="homologar">Homologado</option>
                          </select>
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
            )}
          </Section>
        )}

        {activeTab === 'registros' && (
          <Section icon="📑" title="Registros">
            {registros.length === 0 && (
              <p className="text-gray-500 text-center py-8">Nenhum registro cadastrado.</p>
            )}

            {registros.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-200 text-gray-800 text-left">
                      <th className="py-2">Foto</th>
                      <th className="py-2">Nº Processo</th>
                      <th className="py-2">Data Proc.</th>
                      <th className="py-2">Nome</th>
                      <th className="py-2">CPF</th>
                      <th className="py-2">Cargo Pretendido</th>
                      <th className="py-2">Tipo</th>
                      <th className="py-2">Registro</th>
                      <th className="py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((reg) => (
                      <tr key={reg.id} className="border-t">
                        <td className="py-2">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                            {reg.foto_url ? (
                              <img src={reg.foto_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-gray-400">SEM FOTO</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2">{reg.numero_processo || '-'}</td>
                        <td className="py-2">{reg.data_processo || '-'}</td>
                        <td className="py-2">{reg.nome}</td>
                        <td className="py-2">{reg.cpf || '-'}</td>
                        <td className="py-2">{reg.cargo_pretendido || '-'}</td>
                        <td className="py-2">{TIPO_REGISTRO_LABELS[reg.tipo_registro] || reg.tipo_registro || '-'}</td>
                        <td className="py-2">
                          <span className="text-xs font-semibold text-blue-600">
                            {STATUS_LABELS[reg.status_processo] || reg.status_processo}
                          </span>
                        </td>
                        <td className="py-2 text-right space-x-2">
                          <button
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition text-xs font-semibold"
                            onClick={() => {
                              setEditingRegistro(reg);
                              setFormRegistro({
                                tipo_registro: normalizeTipoRegistro(reg.tipo_registro || ''),
                                categoria_registro: reg.regiao || '',
                                member_id: reg.member_id || '',
                                numero_processo: reg.numero_processo || '',
                                data_processo: reg.data_processo || '',
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
                                pastor_solicitante: reg.pastor_solicitante || '',
                                origem_instituicao: reg.origem_instituicao || '',
                                origem_cidade: reg.origem_cidade || '',
                                origem_uf: reg.origem_uf || '',
                                origem_data_consagracao: reg.origem_data_consagracao || '',
                                data_autorizacao: reg.data_autorizacao || '',
                                status_processo: reg.status_processo || 'em_processo',
                                observacoes: reg.observacoes || '',
                                foto_url: reg.foto_url || ''
                              });
                              setShowForm(true);
                              setActiveTab('cadastro');
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 transition text-xs font-semibold"
                            onClick={() => handleDeleteRegistro(reg.id)}
                          >
                            Excluir
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition text-xs font-semibold"
                            onClick={() => {
                              setProcessRegistro(reg);
                              setProcessModalOpen(true);
                            }}
                          >
                            Processar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}
      </Tabs>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFotoUpload}
      />

      {processModalOpen && processRegistro && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Alterar Registro - Processos</h3>
              <button
                className="text-gray-500 hover:text-gray-800"
                onClick={() => setProcessModalOpen(false)}
              >
                X
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="px-4 py-3 bg-green-100 text-green-700 rounded-lg font-semibold hover:bg-green-200"
                onClick={() => handleUpdateStatus('deferir')}
              >
                Deferir
              </button>
              <button
                className="px-4 py-3 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200"
                onClick={() => handleUpdateStatus('indeferir')}
              >
                Indeferir
              </button>
              <button
                className="px-4 py-3 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200"
                onClick={() => handleUpdateStatus('em_processo')}
              >
                Em Processo
              </button>
              <button
                className="px-4 py-3 bg-emerald-100 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-200"
                onClick={() => handleUpdateStatus('homologar')}
              >
                Homologar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

