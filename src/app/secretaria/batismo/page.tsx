'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useMembers } from '@/hooks/useMembers';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { loadOrgNomenclaturasFromSupabaseOrMigrate, type OrgNomenclaturasState } from '@/lib/org-nomenclaturas';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import { loadCertificadosTemplatesForCurrentUser } from '@/lib/certificados-templates-sync';
import { CERTIFICADOS_TEMPLATES_BASE, type CertificadoTemplate, type ElementoCertificado } from '@/lib/certificados-templates';
import { substituirPlaceholdersCertificado } from '@/lib/certificados-utils';
import type { Member } from '@/types/supabase';

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };

interface SimpleOption {
  id: string;
  nome: string;
}

export default function BatismoPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);
  const { fetchMembers, getMember, loading: membersLoading } = useMembers();
  const certificadoRenderRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState('agendamentos');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [configIgreja, setConfigIgreja] = useState<any>(null);

  const [nomenclaturas, setNomenclaturas] = useState<OrgNomenclaturasState | null>(null);
  const [supervisoes, setSupervisoes] = useState<SimpleOption[]>([]);
  const [campos, setCampos] = useState<SimpleOption[]>([]);
  const [congregacoes, setCongregacoes] = useState<SimpleOption[]>([]);

  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [templatesCertificados, setTemplatesCertificados] = useState<CertificadoTemplate[]>([]);
  const [printTemplate, setPrintTemplate] = useState<CertificadoTemplate | null>(null);
  const [printRegistro, setPrintRegistro] = useState<any | null>(null);
  const [printing, setPrinting] = useState(false);

  const [showAgendamentoForm, setShowAgendamentoForm] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<any | null>(null);
  const [formAgendamento, setFormAgendamento] = useState({
    data_evento: '',
    hora_evento: '',
    supervisao_id: '',
    campo_id: '',
    congregacao_id: '',
    local_texto: '',
    status: 'agendado',
    observacoes: ''
  });

  const [showCadastroForm, setShowCadastroForm] = useState(false);
  const [editingCadastro, setEditingCadastro] = useState<any | null>(null);
  const [formCadastro, setFormCadastro] = useState({
    member_id: '',
    pessoa_nome: '',
    data_nascimento: '',
    sexo: 'MASCULINO',
    telefone: '',
    observacoes: ''
  });
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidateResults, setCandidateResults] = useState<Member[]>([]);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [selectedCandidato, setSelectedCandidato] = useState<Member | null>(null);

  const [showRegistroForm, setShowRegistroForm] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<any | null>(null);
  const [formRegistro, setFormRegistro] = useState({
    cadastro_id: '',
    agendamento_id: '',
    data_batismo: '',
    local_texto: '',
    status: 'agendado',
    observacoes: ''
  });

  const [statusMensagem, setStatusMensagem] = useState('');

  const tabs = [
    { id: 'agendamentos', label: 'Agendamentos', icon: '📅' },
    { id: 'cadastros', label: 'Cadastro de candidatos', icon: '👥' },
    { id: 'registros', label: 'Registros', icon: '✅' }
  ];

  const normalizeEmpty = (value: string) => (value ? value : null);
  const onlyDigits = (value: string) => value.replace(/\D/g, '');
  const normalizeTipoCadastro = (value: any) => {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'membro' || v === 'congregado' || v === 'ministro' || v === 'crianca') return v;
    return '';
  };
  const isCongregado = (member: Member) => {
    const cf = (member.custom_fields || {}) as Record<string, any>;
    const roleTipo = normalizeTipoCadastro(member.role);
    const cfTipo = normalizeTipoCadastro(cf.tipoCadastro || cf.tipo_cadastro);
    const hasCargoMinisterial = Boolean(cf.cargoMinisterial);
    const hasDadosCargos = cf.dadosCargos && Object.keys(cf.dadosCargos).length > 0;
    const hasMinisterialData = hasCargoMinisterial || hasDadosCargos;
    if (roleTipo !== 'congregado') return false;
    if (hasMinisterialData) return false;
    return !cfTipo || cfTipo === 'congregado';
  };
  const formatPhone = (value: string) => {
    const digits = onlyDigits(value).slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const resetAgendamentoForm = () => {
    setFormAgendamento({
      data_evento: '',
      hora_evento: '',
      supervisao_id: '',
      campo_id: '',
      congregacao_id: '',
      local_texto: '',
      status: 'agendado',
      observacoes: ''
    });
    setEditingAgendamento(null);
  };

  const resetCadastroForm = () => {
    setFormCadastro({
      member_id: '',
      pessoa_nome: '',
      data_nascimento: '',
      sexo: 'MASCULINO',
      telefone: '',
      observacoes: ''
    });
    setEditingCadastro(null);
    setSelectedCandidato(null);
    setCandidateQuery('');
    setCandidateResults([]);
    setCandidateOpen(false);
  };

  const resetRegistroForm = () => {
    setFormRegistro({
      cadastro_id: '',
      agendamento_id: '',
      data_batismo: '',
      local_texto: '',
      status: 'agendado',
      observacoes: ''
    });
    setEditingRegistro(null);
  };

  const loadInitialData = async () => {
    setLoadingData(true);
    const resolvedMinistryId = await resolveMinistryId(supabase);
    setMinistryId(resolvedMinistryId);

    try {
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
    } catch {
      setConfigIgreja(null);
    }

    const orgNomes = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase, { syncLocalStorage: false });
    setNomenclaturas(orgNomes);

    if (resolvedMinistryId) {
      const [supRes, camposRes, congRes] = await Promise.all([
        supabase.from('supervisoes').select('id, nome').eq('ministry_id', resolvedMinistryId).order('nome'),
        supabase.from('campos').select('id, nome').eq('ministry_id', resolvedMinistryId).order('nome'),
        supabase.from('congregacoes').select('id, nome').eq('ministry_id', resolvedMinistryId).order('nome')
      ]);

      if (!supRes.error) setSupervisoes((supRes.data as SimpleOption[]) || []);
      if (!camposRes.error) setCampos((camposRes.data as SimpleOption[]) || []);
      if (!congRes.error) setCongregacoes((congRes.data as SimpleOption[]) || []);
    }

    const [agRes, cadRes, regRes] = await Promise.all([
      supabase.from('batismo_agendamentos').select('*').order('created_at', { ascending: false }),
      supabase.from('batismo_cadastros').select('*').order('created_at', { ascending: false }),
      supabase.from('batismo_registros').select('*').order('created_at', { ascending: false })
    ]);

    if (!agRes.error) setAgendamentos(agRes.data || []);
    if (!cadRes.error) setCadastros(cadRes.data || []);
    if (!regRes.error) setRegistros(regRes.data || []);

    const templatesRes = await loadCertificadosTemplatesForCurrentUser(supabase);
    const templatesLoaded = templatesRes.templates.length > 0 ? templatesRes.templates : [];
    const templatesById = new Map(templatesLoaded.map((t: any) => [t.id, t]));
    const mergedTemplates = [
      ...CERTIFICADOS_TEMPLATES_BASE.map((base) => ({
        ...base,
        ...(templatesById.get(base.id) || {})
      })),
      ...templatesLoaded.filter((t: any) => !CERTIFICADOS_TEMPLATES_BASE.some((base) => base.id === t.id))
    ] as CertificadoTemplate[];
    setTemplatesCertificados(mergedTemplates);

    setLoadingData(false);
  };

  const getTemplateAtivo = (categoria: 'apresentacao-criancas' | 'batismo' | 'casamento') => {
    const candidatos = templatesCertificados.filter((t) => (t.categoria || 'apresentacao-criancas') === categoria);
    return candidatos.find((t) => t.ativo) || candidatos.find((t) => !t.variacao) || candidatos[0] || null;
  };

  const getRegistroDataForCertificado = (registro: any) => {
    const pessoa = cadastros.find((c) => c.id === registro.cadastro_id);
    const agendamento = agendamentos.find((a) => a.id === registro.agendamento_id);
    return {
      batizando_nome: pessoa?.pessoa_nome || '',
      data_batismo: registro.data_batismo || agendamento?.data_evento || '',
      local_batismo: registro.local_texto || '',
      nome_igreja: configIgreja?.nome || '',
      data_emissao: new Date().toLocaleDateString('pt-BR')
    };
  };

  const renderCertificadoElementos = (template: CertificadoTemplate, dados: Record<string, any>) => {
    return template.elementos.filter((el) => el.visivel).map((el: ElementoCertificado) => {
      const baseStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${el.x}px`,
        top: `${el.y}px`,
        width: `${el.largura}px`,
        height: `${el.altura}px`,
        overflow: 'hidden'
      };

      if (el.tipo === 'texto') {
        const content = substituirPlaceholdersCertificado(el.texto || '', dados);
        return (
          <div
            key={el.id}
            style={{
              ...baseStyle,
              fontFamily: el.fonte || 'Arial',
              fontSize: `${el.fontSize || 12}px`,
              color: el.cor || '#000',
              textAlign: el.alinhamento || 'left',
              fontWeight: el.negrito ? 'bold' : 'normal',
              fontStyle: el.italico ? 'italic' : 'normal',
              textDecoration: el.sublinhado ? 'underline' : 'none',
              lineHeight: '1.2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: el.alinhamento === 'center' ? 'center' : el.alinhamento === 'right' ? 'flex-end' : 'flex-start'
            }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      }

      if (el.tipo === 'logo') {
        const logoUrl = configIgreja?.logo || el.imagemUrl;
        return logoUrl ? (
          <img
            key={el.id}
            src={logoUrl}
            alt="Logo"
            style={{
              ...baseStyle,
              objectFit: 'contain',
              opacity: el.transparencia || 1
            }}
          />
        ) : (
          <div
            key={el.id}
            style={{
              ...baseStyle,
              backgroundColor: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}
          >
            LOGO
          </div>
        );
      }

      if (el.tipo === 'imagem') {
        return el.imagemUrl ? (
          <img
            key={el.id}
            src={el.imagemUrl}
            alt="Imagem"
            style={{
              ...baseStyle,
              objectFit: 'contain',
              opacity: el.transparencia || 1
            }}
          />
        ) : (
          <div
            key={el.id}
            style={{
              ...baseStyle,
              backgroundColor: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}
          >
            IMAGEM
          </div>
        );
      }

      if (el.tipo === 'chapa') {
        return (
          <div
            key={el.id}
            style={{
              ...baseStyle,
              backgroundColor: el.cor || '#ef4444',
              borderRadius: `${el.borderRadius || 0}px`,
              opacity: el.transparencia || 1
            }}
          />
        );
      }

      return null;
    });
  };

  const handleImprimirCertificado = async (registro: any) => {
    const template = getTemplateAtivo('batismo');
    if (!template || !certificadoRenderRef.current) {
      setStatusMensagem('Template de certificado nao encontrado.');
      return;
    }

    setPrinting(true);
    setPrintRegistro(registro);
    setPrintTemplate(template);

    await new Promise((resolve) => setTimeout(resolve, 80));

    const canvas = await html2canvas(certificadoRenderRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    pdf.save(`certificado-batismo-${registro.id}.pdf`);

    setPrinting(false);
  };

  useEffect(() => {
    if (!loading) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    const query = candidateQuery.trim();

    if (query.length < 2) {
      setCandidateResults([]);
      setCandidateOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetchMembers(1, 20, { status: 'active', search: query, tipoCadastro: 'congregado' });
        const list = ((res as any)?.data || []) as Member[];
        const filtered = list.filter((m) => isCongregado(m));

        if (!cancelled) {
          setCandidateResults(filtered);
          setCandidateOpen(true);
        }
      } catch {
        if (!cancelled) {
          setCandidateResults([]);
          setCandidateOpen(true);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [candidateQuery, fetchMembers]);

  const mapGenderToSexo = (value: string | null | undefined) => {
    const v = String(value || '').toLowerCase();
    if (v.startsWith('f')) return 'FEMININO';
    if (v.startsWith('m')) return 'MASCULINO';
    return 'MASCULINO';
  };

  const handleSelectCandidato = (member: Member) => {
    setSelectedCandidato(member);
    setCandidateQuery(member.name || '');
    setCandidateOpen(false);
    setFormCadastro((prev) => ({
      ...prev,
      member_id: member.id,
      pessoa_nome: member.name || '',
      data_nascimento: member.birth_date || '',
      sexo: mapGenderToSexo(member.gender),
      telefone: formatPhone(member.phone || '')
    }));
  };

  const agendadosCount = agendamentos.filter((a) => a.status === 'agendado').length;
  const realizadosCount = registros.filter((r) => r.status === 'realizado').length;
  const pessoasCount = cadastros.length;

  const handleSaveAgendamento = async () => {
    if (!ministryId) return;
    const payload: any = {
      ministry_id: ministryId,
      data_evento: formAgendamento.data_evento,
      hora_evento: normalizeEmpty(formAgendamento.hora_evento),
      supervisao_id: normalizeEmpty(formAgendamento.supervisao_id),
      campo_id: normalizeEmpty(formAgendamento.campo_id),
      congregacao_id: normalizeEmpty(formAgendamento.congregacao_id),
      local_texto: normalizeEmpty(formAgendamento.local_texto),
      status: formAgendamento.status,
      observacoes: normalizeEmpty(formAgendamento.observacoes)
    };

    if (editingAgendamento) {
      const { error } = await supabase
        .from('batismo_agendamentos')
        .update(payload)
        .eq('id', editingAgendamento.id);
      if (error) {
        setStatusMensagem('Erro ao atualizar agendamento.');
        return;
      }
    } else {
      const { error } = await supabase
        .from('batismo_agendamentos')
        .insert(payload);
      if (error) {
        setStatusMensagem('Erro ao criar agendamento.');
        return;
      }
    }

    setStatusMensagem('Agendamento salvo.');
    resetAgendamentoForm();
    setShowAgendamentoForm(false);
    const { data } = await supabase
      .from('batismo_agendamentos')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAgendamentos(data);
  };

  const handleDeleteAgendamento = async (id: string) => {
    const { error } = await supabase
      .from('batismo_agendamentos')
      .delete()
      .eq('id', id);
    if (error) {
      setStatusMensagem('Erro ao remover agendamento.');
      return;
    }
    setAgendamentos((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveCadastro = async () => {
    if (!ministryId) return;
    if (!formCadastro.member_id) {
      setStatusMensagem('Selecione um congregado para cadastrar.');
      return;
    }
    try {
      const membro = await getMember(formCadastro.member_id);
      if (!membro || !isCongregado(membro)) {
        setStatusMensagem('Somente congregados podem ser cadastrados como candidatos.');
        return;
      }
    } catch {
      setStatusMensagem('Nao foi possivel validar o congregado selecionado.');
      return;
    }
    const payload: any = {
      ministry_id: ministryId,
      member_id: normalizeEmpty(formCadastro.member_id),
      pessoa_nome: formCadastro.pessoa_nome,
      data_nascimento: normalizeEmpty(formCadastro.data_nascimento),
      sexo: normalizeEmpty(formCadastro.sexo),
      telefone: normalizeEmpty(formCadastro.telefone),
      observacoes: normalizeEmpty(formCadastro.observacoes)
    };

    if (editingCadastro) {
      const { error } = await supabase
        .from('batismo_cadastros')
        .update(payload)
        .eq('id', editingCadastro.id);
      if (error) {
        setStatusMensagem('Erro ao atualizar cadastro.');
        return;
      }
    } else {
      const { error } = await supabase
        .from('batismo_cadastros')
        .insert(payload);
      if (error) {
        setStatusMensagem('Erro ao criar cadastro.');
        return;
      }
    }

    setStatusMensagem('Cadastro salvo.');
    resetCadastroForm();
    setShowCadastroForm(false);
    const { data } = await supabase
      .from('batismo_cadastros')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCadastros(data);
  };

  const handleDeleteCadastro = async (id: string) => {
    const { error } = await supabase
      .from('batismo_cadastros')
      .delete()
      .eq('id', id);
    if (error) {
      setStatusMensagem('Erro ao remover cadastro.');
      return;
    }
    setCadastros((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveRegistro = async () => {
    if (!ministryId) return;
    const payload: any = {
      ministry_id: ministryId,
      cadastro_id: normalizeEmpty(formRegistro.cadastro_id),
      agendamento_id: normalizeEmpty(formRegistro.agendamento_id),
      data_batismo: normalizeEmpty(formRegistro.data_batismo),
      local_texto: normalizeEmpty(formRegistro.local_texto),
      status: formRegistro.status,
      observacoes: normalizeEmpty(formRegistro.observacoes)
    };

    if (editingRegistro) {
      const { error } = await supabase
        .from('batismo_registros')
        .update(payload)
        .eq('id', editingRegistro.id);
      if (error) {
        setStatusMensagem('Erro ao atualizar registro.');
        return;
      }
    } else {
      const { error } = await supabase
        .from('batismo_registros')
        .insert(payload);
      if (error) {
        setStatusMensagem('Erro ao criar registro.');
        return;
      }
    }

    setStatusMensagem('Registro salvo.');
    resetRegistroForm();
    setShowRegistroForm(false);
    const { data } = await supabase
      .from('batismo_registros')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRegistros(data);
  };

  const handleDeleteRegistro = async (id: string) => {
    const { error } = await supabase
      .from('batismo_registros')
      .delete()
      .eq('id', id);
    if (error) {
      setStatusMensagem('Erro ao remover registro.');
      return;
    }
    setRegistros((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  const labelCongregacao = nomenclaturas?.divisaoPrincipal?.opcao1 || 'Congregacao';
  const labelCampo = nomenclaturas?.divisaoSecundaria?.opcao1 || 'Campo';
  const labelSupervisao = nomenclaturas?.divisaoTerciaria?.opcao1 || 'Supervisao';

  const showCongregacao = labelCongregacao !== 'NENHUMA';
  const showCampo = labelCampo !== 'NENHUMA';
  const showSupervisao = labelSupervisao !== 'NENHUMA';

  return (
    <PageLayout
      title="Batismo"
      description="Agendamentos, cadastros e registros"
      activeMenu="batismo"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Batismos Agendados</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">{agendadosCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Batismos Realizados</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{realizadosCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
          <p className="text-gray-600 text-sm">Pessoas Cadastradas</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">{pessoasCount}</p>
        </div>
      </div>

      {statusMensagem && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          {statusMensagem}
        </div>
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'agendamentos' && (
          <Section icon="📅" title="Agendamentos">
            <div className="flex items-center justify-between gap-4 mb-6">
              <p className="text-gray-500">Organize as datas e locais dos batismos.</p>
              <button
                className="bg-[#123b63] text-white px-4 py-2 rounded-lg hover:bg-[#0f2a45] transition shadow-md"
                onClick={() => {
                  resetAgendamentoForm();
                  setShowAgendamentoForm(true);
                }}
              >
                + Novo Agendamento
              </button>
            </div>

            {showAgendamentoForm && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data</label>
                    <input
                      type="date"
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formAgendamento.data_evento}
                      onChange={(e) => setFormAgendamento({ ...formAgendamento, data_evento: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Horario</label>
                    <input
                      type="time"
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formAgendamento.hora_evento}
                      onChange={(e) => setFormAgendamento({ ...formAgendamento, hora_evento: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                    <select
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formAgendamento.status}
                      onChange={(e) => setFormAgendamento({ ...formAgendamento, status: e.target.value })}
                    >
                      <option value="agendado">Agendado</option>
                      <option value="realizado">Realizado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>

                  {showSupervisao && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{labelSupervisao}</label>
                      <select
                        className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formAgendamento.supervisao_id}
                        onChange={(e) => setFormAgendamento({ ...formAgendamento, supervisao_id: e.target.value })}
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
                        className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formAgendamento.campo_id}
                        onChange={(e) => setFormAgendamento({ ...formAgendamento, campo_id: e.target.value })}
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
                        className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formAgendamento.congregacao_id}
                        onChange={(e) => setFormAgendamento({ ...formAgendamento, congregacao_id: e.target.value })}
                      >
                        <option value="">Selecione</option>
                        {congregacoes.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Local</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formAgendamento.local_texto}
                      onChange={(e) => setFormAgendamento({ ...formAgendamento, local_texto: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Observacoes</label>
                    <textarea
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      value={formAgendamento.observacoes}
                      onChange={(e) => setFormAgendamento({ ...formAgendamento, observacoes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    className="px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      resetAgendamentoForm();
                      setShowAgendamentoForm(false);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#123b63] text-white font-semibold hover:bg-[#0f2a45] transition shadow-md"
                    onClick={handleSaveAgendamento}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {agendamentos.length === 0 && (
              <p className="text-gray-500 text-center py-8">Nenhum agendamento cadastrado.</p>
            )}

            {agendamentos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2">Data</th>
                      <th className="py-2">Horario</th>
                      <th className="py-2">Local</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendamentos.map((ag) => (
                      <tr key={ag.id} className="border-t">
                        <td className="py-2">{ag.data_evento || '-'}</td>
                        <td className="py-2">{ag.hora_evento || '-'}</td>
                        <td className="py-2">{ag.local_texto || '-'}</td>
                        <td className="py-2 capitalize">{ag.status}</td>
                        <td className="py-2 text-right space-x-2">
                          <button
                            className="inline-flex items-center gap-1 text-blue-600"
                            onClick={() => {
                              setEditingAgendamento(ag);
                              setFormAgendamento({
                                data_evento: ag.data_evento || '',
                                hora_evento: ag.hora_evento || '',
                                supervisao_id: ag.supervisao_id || '',
                                campo_id: ag.campo_id || '',
                                congregacao_id: ag.congregacao_id || '',
                                local_texto: ag.local_texto || '',
                                status: ag.status || 'agendado',
                                observacoes: ag.observacoes || ''
                              });
                              setShowAgendamentoForm(true);
                            }}
                          >
                            <span aria-hidden>✏️</span>
                            Editar
                          </button>
                          <button
                            className="inline-flex items-center gap-1 text-red-600"
                            onClick={() => handleDeleteAgendamento(ag.id)}
                          >
                            <span aria-hidden>🗑️</span>
                            Excluir
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

        {activeTab === 'cadastros' && (
          <Section icon="👥" title="Cadastro de candidatos">
            <div className="flex items-center justify-between gap-4 mb-6">
              <p className="text-gray-500">Selecione um congregado e confirme os dados do candidato.</p>
              <button
                className="bg-[#123b63] text-white px-4 py-2 rounded-lg hover:bg-[#0f2a45] transition shadow-md"
                onClick={() => {
                  resetCadastroForm();
                  setShowCadastroForm(true);
                }}
              >
                + Novo Cadastro
              </button>
            </div>

            {showCadastroForm && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Buscar candidato (Congregado)</label>
                    <div className="relative">
                      <input
                        className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={candidateQuery}
                        onChange={(e) => {
                          setCandidateQuery(e.target.value);
                          setSelectedCandidato(null);
                          setFormCadastro((prev) => ({
                            ...prev,
                            member_id: '',
                            pessoa_nome: '',
                            data_nascimento: '',
                            sexo: 'MASCULINO',
                            telefone: ''
                          }));
                        }}
                        onFocus={() => {
                          if (candidateResults.length > 0) setCandidateOpen(true);
                        }}
                        placeholder="Digite nome do congregado"
                      />
                      {candidateOpen && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                          {membersLoading && (
                            <div className="px-3 py-2 text-sm text-gray-500">Buscando...</div>
                          )}
                          {!membersLoading && candidateResults.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">Nenhum congregado encontrado.</div>
                          )}
                          {!membersLoading && candidateResults.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-blue-50"
                              onClick={() => handleSelectCandidato(m)}
                            >
                              <div className="text-sm font-medium text-gray-800">{m.name}</div>
                              <div className="text-xs text-gray-500">CPF: {m.cpf || 'Nao informado'}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedCandidato && (
                      <div className="mt-2 text-xs text-gray-500">
                        Matricula: {selectedCandidato.custom_fields?.matricula || 'Nao informada'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nome</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formCadastro.pessoa_nome}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formCadastro.data_nascimento}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Sexo</label>
                    <select
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formCadastro.sexo}
                      disabled
                    >
                      <option value="FEMININO">Feminino</option>
                      <option value="MASCULINO">Masculino</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formCadastro.telefone}
                      readOnly
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Observacoes</label>
                    <textarea
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      value={formCadastro.observacoes}
                      onChange={(e) => setFormCadastro({ ...formCadastro, observacoes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    className="px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      resetCadastroForm();
                      setShowCadastroForm(false);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg bg-[#123b63] text-white font-semibold transition shadow-md ${
                      formCadastro.member_id ? 'hover:bg-[#0f2a45]' : 'opacity-60 cursor-not-allowed'
                    }`}
                    onClick={handleSaveCadastro}
                    disabled={!formCadastro.member_id}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {cadastros.length === 0 && (
              <p className="text-gray-500 text-center py-8">Nenhum candidato cadastrado.</p>
            )}

            {cadastros.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2">Nome</th>
                      <th className="py-2">Telefone</th>
                      <th className="py-2">Nascimento</th>
                      <th className="py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadastros.map((cad) => (
                      <tr key={cad.id} className="border-t">
                        <td className="py-2">{cad.pessoa_nome}</td>
                        <td className="py-2">{cad.telefone || '-'}</td>
                        <td className="py-2">{cad.data_nascimento || '-'}</td>
                        <td className="py-2 text-right space-x-2">
                          <button
                            className="inline-flex items-center gap-1 text-blue-600"
                            onClick={() => {
                              setEditingCadastro(cad);
                              setFormCadastro({
                                  member_id: cad.member_id || '',
                                pessoa_nome: cad.pessoa_nome || '',
                                data_nascimento: cad.data_nascimento || '',
                                sexo: cad.sexo || 'MASCULINO',
                                telefone: cad.telefone || '',
                                observacoes: cad.observacoes || ''
                              });
                                setCandidateQuery(cad.pessoa_nome || '');
                                setSelectedCandidato(null);
                                setCandidateOpen(false);
                              setShowCadastroForm(true);
                            }}
                          >
                            <span aria-hidden>✏️</span>
                            Editar
                          </button>
                          <button
                            className="inline-flex items-center gap-1 text-red-600"
                            onClick={() => handleDeleteCadastro(cad.id)}
                          >
                            <span aria-hidden>🗑️</span>
                            Excluir
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

        {activeTab === 'registros' && (
          <Section icon="✅" title="Registros">
            <div className="flex items-center justify-between gap-4 mb-6">
              <p className="text-gray-500">Registre os batismos realizados.</p>
              <button
                className="bg-[#123b63] text-white px-4 py-2 rounded-lg hover:bg-[#0f2a45] transition shadow-md"
                onClick={() => {
                  resetRegistroForm();
                  setShowRegistroForm(true);
                }}
              >
                + Novo Registro
              </button>
            </div>

            {showRegistroForm && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Pessoa</label>
                    <select
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formRegistro.cadastro_id}
                      onChange={(e) => setFormRegistro({ ...formRegistro, cadastro_id: e.target.value })}
                    >
                      <option value="">Selecione</option>
                      {cadastros.map((c) => (
                        <option key={c.id} value={c.id}>{c.pessoa_nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Agendamento</label>
                    <select
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formRegistro.agendamento_id}
                      onChange={(e) => setFormRegistro({ ...formRegistro, agendamento_id: e.target.value })}
                    >
                      <option value="">Selecione</option>
                      {agendamentos.map((a) => (
                        <option key={a.id} value={a.id}>{a.data_evento} {a.hora_evento ? `- ${a.hora_evento}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data do Batismo</label>
                    <input
                      type="date"
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formRegistro.data_batismo}
                      onChange={(e) => setFormRegistro({ ...formRegistro, data_batismo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Local</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formRegistro.local_texto}
                      onChange={(e) => setFormRegistro({ ...formRegistro, local_texto: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                    <select
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formRegistro.status}
                      onChange={(e) => setFormRegistro({ ...formRegistro, status: e.target.value })}
                    >
                      <option value="agendado">Agendado</option>
                      <option value="realizado">Realizado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Observacoes</label>
                    <textarea
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      value={formRegistro.observacoes}
                      onChange={(e) => setFormRegistro({ ...formRegistro, observacoes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    className="px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      resetRegistroForm();
                      setShowRegistroForm(false);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#123b63] text-white font-semibold hover:bg-[#0f2a45] transition shadow-md"
                    onClick={handleSaveRegistro}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {registros.length === 0 && (
              <p className="text-gray-500 text-center py-8">Nenhum registro cadastrado.</p>
            )}

            {registros.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2">Pessoa</th>
                      <th className="py-2">Data</th>
                      <th className="py-2">Agendamento</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((reg) => {
                      const pessoa = cadastros.find((c) => c.id === reg.cadastro_id);
                      const agendamento = agendamentos.find((a) => a.id === reg.agendamento_id);
                      return (
                        <tr key={reg.id} className="border-t">
                          <td className="py-2">{pessoa?.pessoa_nome || '-'}</td>
                          <td className="py-2">{reg.data_batismo || agendamento?.data_evento || '-'}</td>
                          <td className="py-2">{agendamento?.data_evento || '-'}</td>
                          <td className="py-2 capitalize">{reg.status}</td>
                          <td className="py-2 text-right space-x-2">
                            <button
                              className="inline-flex items-center gap-1 text-[#123b63]"
                              onClick={() => handleImprimirCertificado(reg)}
                              disabled={printing}
                            >
                              <span aria-hidden>🖨️</span>
                              {printing ? 'Gerando...' : 'Imprimir'}
                            </button>
                            <button
                              className="inline-flex items-center gap-1 text-blue-600"
                              onClick={() => {
                                setEditingRegistro(reg);
                                setFormRegistro({
                                  cadastro_id: reg.cadastro_id || '',
                                  agendamento_id: reg.agendamento_id || '',
                                  data_batismo: reg.data_batismo || '',
                                  local_texto: reg.local_texto || '',
                                  status: reg.status || 'agendado',
                                  observacoes: reg.observacoes || ''
                                });
                                setShowRegistroForm(true);
                              }}
                            >
                              <span aria-hidden>✏️</span>
                              Editar
                            </button>
                            <button
                              className="inline-flex items-center gap-1 text-red-600"
                              onClick={() => handleDeleteRegistro(reg.id)}
                            >
                              <span aria-hidden>🗑️</span>
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}
      </Tabs>
      <div
        style={{ position: 'fixed', left: '-10000px', top: 0 }}
        aria-hidden
      >
        {printTemplate && printRegistro && (
          <div
            ref={certificadoRenderRef}
            style={{
              position: 'relative',
              width: `${CERTIFICADO_CANVAS.largura}px`,
              height: `${CERTIFICADO_CANVAS.altura}px`,
              backgroundColor: '#ffffff',
              backgroundImage: printTemplate.backgroundUrl ? `url(${printTemplate.backgroundUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              overflow: 'hidden'
            }}
          >
            {renderCertificadoElementos(printTemplate, getRegistroDataForCertificado(printRegistro))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
