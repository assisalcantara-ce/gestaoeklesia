'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { loadOrgNomenclaturasFromSupabaseOrMigrate, type OrgNomenclaturasState } from '@/lib/org-nomenclaturas';
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import { loadCertificadosTemplatesForCurrentUser } from '@/lib/certificados-templates-sync';
import { CERTIFICADOS_TEMPLATES_BASE, type CertificadoTemplate, type ElementoCertificado } from '@/lib/certificados-templates';
import { substituirPlaceholdersCertificado } from '@/lib/certificados-utils';
import { formatPhone } from '@/lib/mascaras';

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };

interface SimpleOption {
  id: string;
  nome: string;
}

export default function CasamentosPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);
  const certificadoRenderRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState('agendamentos');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [nomenclaturas, setNomenclaturas] = useState<OrgNomenclaturasState | null>(null);
  const [supervisoes, setSupervisoes] = useState<SimpleOption[]>([]);
  const [campos, setCampos] = useState<SimpleOption[]>([]);
  const [congregacoes, setCongregacoes] = useState<SimpleOption[]>([]);
  const [configIgreja, setConfigIgreja] = useState<any>(null);

  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);

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
    noivo_nome: '',
    noiva_nome: '',
    telefone: '',
    observacoes: ''
  });

  const [showRegistroForm, setShowRegistroForm] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<any | null>(null);
  const [formRegistro, setFormRegistro] = useState({
    cadastro_id: '',
    agendamento_id: '',
    data_casamento: '',
    local_texto: '',
    celebrante_nome: '',
    status: 'agendado',
    observacoes: ''
  });

  const [templatesCertificados, setTemplatesCertificados] = useState<CertificadoTemplate[]>([]);
  const [printTemplate, setPrintTemplate] = useState<CertificadoTemplate | null>(null);
  const [printRegistro, setPrintRegistro] = useState<any | null>(null);
  const [printing, setPrinting] = useState(false);

  const [statusMensagem, setStatusMensagem] = useState('');

  const tabs = [
    { id: 'agendamentos', label: 'Agendamentos', icon: '📅' },
    { id: 'cadastros', label: 'Cadastro de casais', icon: '💍' },
    { id: 'registros', label: 'Registros', icon: '✅' }
  ];

  const normalizeEmpty = (value: string) => (value ? value : null);

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
      noivo_nome: '',
      noiva_nome: '',
      telefone: '',
      observacoes: ''
    });
    setEditingCadastro(null);
  };

  const resetRegistroForm = () => {
    setFormRegistro({
      cadastro_id: '',
      agendamento_id: '',
      data_casamento: '',
      local_texto: '',
      celebrante_nome: '',
      status: 'agendado',
      observacoes: ''
    });
    setEditingRegistro(null);
  };

  const loadInitialData = async () => {
    setLoadingData(true);
    const resolvedMinistryId = await resolveMinistryId(supabase);
    setMinistryId(resolvedMinistryId);

    const orgNomes = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase, { syncLocalStorage: false });
    setNomenclaturas(orgNomes);

    try {
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
    } catch {
      setConfigIgreja(null);
    }

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
      supabase.from('casamentos_agendamentos').select('*').order('created_at', { ascending: false }),
      supabase.from('casamentos_cadastros').select('*').order('created_at', { ascending: false }),
      supabase.from('casamentos_registros').select('*').order('created_at', { ascending: false })
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

  useEffect(() => {
    if (!loading) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const getTemplateAtivo = (categoria: 'apresentacao-criancas' | 'batismo' | 'casamento') => {
    const candidatos = templatesCertificados.filter((t) => (t.categoria || 'apresentacao-criancas') === categoria);
    return candidatos.find((t) => t.ativo) || candidatos.find((t) => !t.variacao) || candidatos[0] || null;
  };

  const getRegistroDataForCertificado = (registro: any) => {
    const casal = cadastros.find((c) => c.id === registro.cadastro_id);
    const agendamento = agendamentos.find((a) => a.id === registro.agendamento_id);
    return {
      noivo_nome: casal?.noivo_nome || '',
      noiva_nome: casal?.noiva_nome || '',
      data_casamento: registro.data_casamento || agendamento?.data_evento || '',
      local_casamento: registro.local_texto || agendamento?.local_texto || '',
      celebrante_nome: registro.celebrante_nome || '',
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
    const template = getTemplateAtivo('casamento');
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
    pdf.save(`certificado-casamento-${registro.id}.pdf`);

    setPrinting(false);
  };

  const agendadosCount = agendamentos.filter((a) => a.status === 'agendado').length;
  const realizadosCount = registros.filter((r) => r.status === 'realizado').length;
  const casaisCount = cadastros.length;

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
        .from('casamentos_agendamentos')
        .update(payload)
        .eq('id', editingAgendamento.id);
      if (error) {
        setStatusMensagem('Erro ao atualizar agendamento.');
        return;
      }
    } else {
      const { error } = await supabase
        .from('casamentos_agendamentos')
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
      .from('casamentos_agendamentos')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAgendamentos(data);
  };

  const handleDeleteAgendamento = async (id: string) => {
    const { error } = await supabase
      .from('casamentos_agendamentos')
      .delete()
      .eq('id', id);
    if (error) {
      setStatusMensagem('Erro ao remover agendamento.');
      return;
    }
    setAgendamentos((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSaveCadastro = async () => {
    if (!ministryId) return;
    const payload: any = {
      ministry_id: ministryId,
      noivo_nome: formCadastro.noivo_nome,
      noiva_nome: formCadastro.noiva_nome,
      telefone: normalizeEmpty(formCadastro.telefone),
      observacoes: normalizeEmpty(formCadastro.observacoes)
    };

    if (editingCadastro) {
      const { error } = await supabase
        .from('casamentos_cadastros')
        .update(payload)
        .eq('id', editingCadastro.id);
      if (error) {
        setStatusMensagem('Erro ao atualizar cadastro.');
        return;
      }
    } else {
      const { error } = await supabase
        .from('casamentos_cadastros')
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
      .from('casamentos_cadastros')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCadastros(data);
  };

  const handleDeleteCadastro = async (id: string) => {
    const { error } = await supabase
      .from('casamentos_cadastros')
      .delete()
      .eq('id', id);
    if (error) {
      setStatusMensagem('Erro ao remover cadastro.');
      return;
    }
    setCadastros((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveRegistro = async () => {
    if (!ministryId) return;
    const payload: any = {
      ministry_id: ministryId,
      cadastro_id: normalizeEmpty(formRegistro.cadastro_id),
      agendamento_id: normalizeEmpty(formRegistro.agendamento_id),
      data_casamento: normalizeEmpty(formRegistro.data_casamento),
      local_texto: normalizeEmpty(formRegistro.local_texto),
      celebrante_nome: normalizeEmpty(formRegistro.celebrante_nome),
      status: formRegistro.status,
      observacoes: normalizeEmpty(formRegistro.observacoes)
    };

    if (editingRegistro) {
      const { error } = await supabase
        .from('casamentos_registros')
        .update(payload)
        .eq('id', editingRegistro.id);
      if (error) {
        setStatusMensagem('Erro ao atualizar registro.');
        return;
      }
    } else {
      const { error } = await supabase
        .from('casamentos_registros')
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
      .from('casamentos_registros')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRegistros(data);
  };

  const handleDeleteRegistro = async (id: string) => {
    const { error } = await supabase
      .from('casamentos_registros')
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
      title="Casamentos"
      description="Agendamentos, cadastros e registros"
      activeMenu="casamentos"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Casamentos Agendados</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">{agendadosCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Casamentos Realizados</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{realizadosCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
          <p className="text-gray-600 text-sm">Casais Cadastrados</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">{casaisCount}</p>
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
              <p className="text-gray-500">Organize as datas e locais dos casamentos.</p>
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
                      <th className="py-2">Local</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendamentos.map((ag) => (
                      <tr key={ag.id} className="border-t">
                        <td className="py-2">{ag.data_evento}</td>
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
          <Section icon="💍" title="Cadastro de Casais">
            <div className="flex items-center justify-between gap-4 mb-6">
              <p className="text-gray-500">Cadastre os casais para casamento.</p>
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
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nome do Noivo</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formCadastro.noivo_nome}
                      onChange={(e) => setFormCadastro({ ...formCadastro, noivo_nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Noiva</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formCadastro.noiva_nome}
                      onChange={(e) => setFormCadastro({ ...formCadastro, noiva_nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formCadastro.telefone}
                      onChange={(e) => setFormCadastro({ ...formCadastro, telefone: formatPhone(e.target.value) })}
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
                    className="px-4 py-2 rounded-lg bg-[#123b63] text-white font-semibold hover:bg-[#0f2a45] transition shadow-md"
                    onClick={handleSaveCadastro}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {cadastros.length === 0 && (
              <p className="text-gray-500 text-center py-8">Nenhum casal cadastrado.</p>
            )}

            {cadastros.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2">Noivo</th>
                      <th className="py-2">Noiva</th>
                      <th className="py-2">Telefone</th>
                      <th className="py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadastros.map((cad) => (
                      <tr key={cad.id} className="border-t">
                        <td className="py-2">{cad.noivo_nome}</td>
                        <td className="py-2">{cad.noiva_nome}</td>
                        <td className="py-2">{cad.telefone || '-'}</td>
                        <td className="py-2 text-right space-x-2">
                          <button
                            className="inline-flex items-center gap-1 text-blue-600"
                            onClick={() => {
                              setEditingCadastro(cad);
                              setFormCadastro({
                                noivo_nome: cad.noivo_nome || '',
                                noiva_nome: cad.noiva_nome || '',
                                telefone: cad.telefone || '',
                                observacoes: cad.observacoes || ''
                              });
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
              <p className="text-gray-500">Registre os casamentos realizados.</p>
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
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Casal</label>
                    <select
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formRegistro.cadastro_id}
                      onChange={(e) => setFormRegistro({ ...formRegistro, cadastro_id: e.target.value })}
                    >
                      <option value="">Selecione</option>
                      {cadastros.map((c) => (
                        <option key={c.id} value={c.id}>{c.noivo_nome} & {c.noiva_nome}</option>
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
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data do Casamento</label>
                    <input
                      type="date"
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formRegistro.data_casamento}
                      onChange={(e) => setFormRegistro({ ...formRegistro, data_casamento: e.target.value })}
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
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Celebrante</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formRegistro.celebrante_nome}
                      onChange={(e) => setFormRegistro({ ...formRegistro, celebrante_nome: e.target.value })}
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
                      <th className="py-2">Casal</th>
                      <th className="py-2">Data</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((reg) => {
                      const casal = cadastros.find((c) => c.id === reg.cadastro_id);
                      return (
                        <tr key={reg.id} className="border-t">
                          <td className="py-2">{casal ? `${casal.noivo_nome} & ${casal.noiva_nome}` : '-'}</td>
                          <td className="py-2">{reg.data_casamento || '-'}</td>
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
                                  data_casamento: reg.data_casamento || '',
                                  local_texto: reg.local_texto || '',
                                  celebrante_nome: reg.celebrante_nome || '',
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

      <div style={{ position: 'fixed', left: '-10000px', top: 0 }} aria-hidden>
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
