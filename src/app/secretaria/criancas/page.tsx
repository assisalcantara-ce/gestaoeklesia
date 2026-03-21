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
import { fetchConfiguracaoIgrejaFromSupabase } from '@/lib/igreja-config-utils';
import { loadCertificadosTemplatesForCurrentUser } from '@/lib/certificados-templates-sync';
import { CERTIFICADOS_TEMPLATES_BASE, type CertificadoTemplate, type ElementoCertificado } from '@/lib/certificados-templates';
import { substituirPlaceholdersCertificado } from '@/lib/certificados-utils';
import { formatPhone } from '@/lib/mascaras';

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };

export default function CriancasPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);
  const certificadoRenderRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState('registros');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [configIgreja, setConfigIgreja] = useState<any>(null);

  const [registros, setRegistros] = useState<any[]>([]);
  const [templatesCertificados, setTemplatesCertificados] = useState<CertificadoTemplate[]>([]);
  const [printTemplate, setPrintTemplate] = useState<CertificadoTemplate | null>(null);
  const [printRegistro, setPrintRegistro] = useState<any | null>(null);
  const [printing, setPrinting] = useState(false);

  const [showRegistroForm, setShowRegistroForm] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<any | null>(null);
  const [formRegistro, setFormRegistro] = useState({
    crianca_nome: '',
    crianca_data_nascimento: '',
    crianca_sexo: 'FEMININO',
    pai_nome: '',
    mae_nome: '',
    responsavel_telefone: '',
    data_apresentacao: '',
    status: 'agendado',
    observacoes: ''
  });

  const [statusMensagem, setStatusMensagem] = useState('');

  const tabs = [
    { id: 'registros', label: 'Registro de Apresentacoes', icon: '📑' },
    { id: 'cadastros', label: 'Cadastro de Criancas', icon: '🧒' }
  ];

  const resetRegistroForm = () => {
    setFormRegistro({
      crianca_nome: '',
      crianca_data_nascimento: '',
      crianca_sexo: 'FEMININO',
      pai_nome: '',
      mae_nome: '',
      responsavel_telefone: '',
      data_apresentacao: '',
      status: 'agendado',
      observacoes: ''
    });
    setEditingRegistro(null);
  };

  const normalizeEmpty = (value: string) => (value ? value : null);

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
    const { data: registrosRes, error: registrosErr } = await supabase
      .from('apresentacao_criancas_registros')
      .select('*')
      .order('created_at', { ascending: false });

    if (!registrosErr) setRegistros(registrosRes || []);

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
    return {
      crianca_nome: registro.crianca_nome,
      pai_nome: registro.pai_nome,
      mae_nome: registro.mae_nome,
      responsavel_nome: registro.pai_nome || registro.mae_nome || '',
      responsavel_telefone: registro.responsavel_telefone || '',
      data_apresentacao: registro.data_apresentacao || '',
      local_apresentacao: '',
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
    const template = getTemplateAtivo('apresentacao-criancas');
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
    pdf.save(`certificado-apresentacao-${registro.id}.pdf`);

    await supabase
      .from('apresentacao_criancas_registros')
      .update({
        certificado_template_key: template.id,
        certificado_emitido_em: new Date().toISOString()
      })
      .eq('id', registro.id);

    setPrinting(false);
  };

  useEffect(() => {
    if (!loading) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const pendentesCount = registros.filter((r) => r.status === 'agendado').length;
  const apresentadosCount = registros.filter((r) => r.status === 'apresentado').length;
  const criancasCount = registros.length;

  const handleSaveRegistro = async () => {
    if (!ministryId) return;
    const payload: any = {
      ministry_id: ministryId,
      crianca_nome: formRegistro.crianca_nome,
      crianca_data_nascimento: normalizeEmpty(formRegistro.crianca_data_nascimento),
      crianca_sexo: normalizeEmpty(formRegistro.crianca_sexo),
      pai_nome: normalizeEmpty(formRegistro.pai_nome),
      mae_nome: normalizeEmpty(formRegistro.mae_nome),
      responsavel_telefone: normalizeEmpty(formRegistro.responsavel_telefone),
      data_apresentacao: normalizeEmpty(formRegistro.data_apresentacao),
      status: formRegistro.status,
      observacoes: normalizeEmpty(formRegistro.observacoes)
    };

    if (editingRegistro) {
      const { error } = await supabase
        .from('apresentacao_criancas_registros')
        .update(payload)
        .eq('id', editingRegistro.id);
      if (error) {
        setStatusMensagem('Erro ao atualizar registro.');
        return;
      }
    } else {
      const { error } = await supabase
        .from('apresentacao_criancas_registros')
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
      .from('apresentacao_criancas_registros')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRegistros(data);
  };

  const handleDeleteRegistro = async (id: string) => {
    const { error } = await supabase
      .from('apresentacao_criancas_registros')
      .delete()
      .eq('id', id);
    if (error) {
      setStatusMensagem('Erro ao remover registro.');
      return;
    }
    setRegistros((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <PageLayout
      title="Apresentacao de Criancas"
      description="Gerencie cadastros de apresentacao"
      activeMenu="criancas"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Registros Pendentes</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">{pendentesCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Apresentacoes Apresentadas</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{apresentadosCount}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
          <p className="text-gray-600 text-sm">Criancas Cadastradas</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">{criancasCount}</p>
        </div>
      </div>

      {statusMensagem && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          {statusMensagem}
        </div>
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>

        {activeTab === 'cadastros' && (
        <Section icon="🧒" title="Cadastro de Crianca">
          <div className="flex items-center justify-between gap-4 mb-6">
            <p className="text-gray-500">Cadastre a crianca para apresentacao.</p>
            <button
              className="bg-[#123b63] text-white px-4 py-2 rounded-lg hover:bg-[#0f2a45] transition shadow-md"
              onClick={() => {
                resetRegistroForm();
                setShowRegistroForm(true);
              }}
            >
              + Novo Cadastro
            </button>
          </div>

          {showRegistroForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formRegistro.status}
                    onChange={(e) => setFormRegistro({ ...formRegistro, status: e.target.value })}
                  >
                    <option value="agendado">Agendado</option>
                    <option value="apresentado">Apresentado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Crianca</label>
                  <input
                    className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formRegistro.crianca_nome}
                    onChange={(e) => setFormRegistro({ ...formRegistro, crianca_nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formRegistro.crianca_data_nascimento}
                    onChange={(e) => setFormRegistro({ ...formRegistro, crianca_data_nascimento: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data da Apresentacao</label>
                  <input
                    type="date"
                    className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formRegistro.data_apresentacao}
                    onChange={(e) => setFormRegistro({ ...formRegistro, data_apresentacao: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Sexo</label>
                  <select
                    className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formRegistro.crianca_sexo}
                    onChange={(e) => setFormRegistro({ ...formRegistro, crianca_sexo: e.target.value })}
                  >
                    <option value="FEMININO">Feminino</option>
                    <option value="MASCULINO">Masculino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome do Pai</label>
                  <input
                    className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formRegistro.pai_nome}
                    onChange={(e) => setFormRegistro({ ...formRegistro, pai_nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Mae</label>
                  <input
                    className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formRegistro.mae_nome}
                    onChange={(e) => setFormRegistro({ ...formRegistro, mae_nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone do Responsavel</label>
                  <input
                    className="mt-1 w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formRegistro.responsavel_telefone}
                    onChange={(e) => setFormRegistro({ ...formRegistro, responsavel_telefone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                  />
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
                <button className="px-4 py-2 rounded-lg bg-[#123b63] text-white font-semibold hover:bg-[#0f2a45] transition shadow-md" onClick={handleSaveRegistro}>
                  Salvar
                </button>
              </div>
            </div>
          )}
        </Section>
        )}

        {activeTab === 'registros' && (
        <div className="space-y-6">
        <Section icon="📑" title="Registro de Apresentacoes">
          {registros.length === 0 && (
            <p className="text-gray-500 text-center py-8">Nenhum registro cadastrado.</p>
          )}

          {registros.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">Crianca</th>
                    <th className="py-2">Data</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((reg) => (
                    <tr key={reg.id} className="border-t">
                      <td className="py-2">{reg.crianca_nome}</td>
                      <td className="py-2">{reg.data_apresentacao || '-'}</td>
                      <td className="py-2 capitalize">{reg.status}</td>
                      <td className="py-2 text-right space-x-2">
                        <button
                          className="inline-flex items-center gap-1 text-[#123b63]"
                          onClick={() => handleImprimirCertificado(reg)}
                          disabled={printing}
                        >
                          <span aria-hidden>🖨️</span>
                          {printing ? 'Gerando...' : 'Certificado'}
                        </button>
                        <button
                          className="inline-flex items-center gap-1 text-blue-600"
                          onClick={() => {
                            setEditingRegistro(reg);
                            setFormRegistro({
                              crianca_nome: reg.crianca_nome || '',
                              crianca_data_nascimento: reg.crianca_data_nascimento || '',
                              crianca_sexo: reg.crianca_sexo || 'FEMININO',
                              pai_nome: reg.pai_nome || '',
                              mae_nome: reg.mae_nome || '',
                              responsavel_telefone: reg.responsavel_telefone || '',
                              data_apresentacao: reg.data_apresentacao || '',
                              status: reg.status || 'agendado',
                              observacoes: reg.observacoes || ''
                            });
                            setShowRegistroForm(true);
                            setActiveTab('cadastros');
                          }}
                        >
                          <span aria-hidden>✏️</span>
                          Editar
                        </button>
                        <button className="inline-flex items-center gap-1 text-red-600" onClick={() => handleDeleteRegistro(reg.id)}>
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

        </div>
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
