'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { loadCertificadosTemplatesForCurrentUser } from '@/lib/certificados-templates-sync';
import { fetchConfiguracaoIgrejaFromSupabase, type ConfiguracaoIgreja } from '@/lib/igreja-config-utils';
import { substituirPlaceholdersCertificado } from '@/lib/certificados-utils';
import { Pencil, Printer, Trash2 } from 'lucide-react';

type CertificadoTemplate = {
  id: string;
  nome: string;
  backgroundUrl?: string;
  elementos: any[];
  orientacao?: 'landscape' | 'portrait';
  categoria?: string;
  ativo?: boolean;
};

interface ApresentacaoRegistro {
  id: string;
  ministry_id: string;
  crianca_nome: string;
  crianca_data_nascimento?: string | null;
  crianca_sexo?: string | null;
  pai_nome?: string | null;
  mae_nome?: string | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
  data_apresentacao?: string | null;
  local_apresentacao?: string | null;
  status?: string | null;
  observacoes?: string | null;
  certificado_template_key?: string | null;
  certificado_emitido_em?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: '📝' },
  { id: 'registros', label: 'Registros', icon: '📑' },
];

const STATUS_OPTIONS = [
  { value: 'registrado', label: 'Registrado' },
  { value: 'apresentado', label: 'Apresentado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const str = String(value);
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, ano, mes, dia] = isoMatch;
    return `${dia}/${mes}/${ano}`;
  }
  return str;
};

const formatIsoDate = (value?: string | null) => {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
};

export default function ApresentacaoCriancasPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('cadastro');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<ApresentacaoRegistro[]>([]);
  const [certTemplates, setCertTemplates] = useState<CertificadoTemplate[]>([]);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja>({
    nome: 'Igreja/Ministerio',
    endereco: '',
    cnpj: '',
    telefone: '',
    email: '',
    website: '',
    descricao: '',
    responsavel: '',
    logo: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    crianca_nome: '',
    crianca_data_nascimento: '',
    crianca_sexo: 'MASCULINO',
    pai_nome: '',
    mae_nome: '',
    responsavel_nome: '',
    responsavel_telefone: '',
    data_apresentacao: '',
    local_apresentacao: '',
    status: 'registrado',
    observacoes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState(true);

  const [notification, setNotification] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    autoClose: true,
  });

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<ApresentacaoRegistro | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const templatesApresentacao = useMemo(
    () => certTemplates.filter((t) => t.categoria === 'apresentacao-criancas'),
    [certTemplates]
  );

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    autoClose = true
  ) => {
    setNotification({ isOpen: true, title, message, type, autoClose });
  };

  const resetForm = () => {
    setFormData({
      crianca_nome: '',
      crianca_data_nascimento: '',
      crianca_sexo: 'MASCULINO',
      pai_nome: '',
      mae_nome: '',
      responsavel_nome: '',
      responsavel_telefone: '',
      data_apresentacao: '',
      local_apresentacao: '',
      status: 'registrado',
      observacoes: '',
    });
    setEditingId(null);
    setFieldErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.crianca_nome.trim()) errors.crianca_nome = 'Informe o nome da crianca.';
    if (!formData.crianca_data_nascimento) errors.crianca_data_nascimento = 'Informe a data de nascimento.';
    if (!formData.pai_nome.trim()) errors.pai_nome = 'Informe o nome do pai.';
    if (!formData.mae_nome.trim()) errors.mae_nome = 'Informe o nome da mae.';
    if (!formData.responsavel_nome.trim()) errors.responsavel_nome = 'Informe o responsavel.';
    if (!formData.responsavel_telefone.trim()) errors.responsavel_telefone = 'Informe o telefone do responsavel.';
    if (!formData.data_apresentacao) errors.data_apresentacao = 'Informe a data da apresentacao.';
    if (!formData.local_apresentacao.trim()) errors.local_apresentacao = 'Informe o local da apresentacao.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const loadRegistros = async (mid?: string | null) => {
    if (!mid) return;
    const { data, error } = await supabase
      .from('apresentacao_criancas_registros')
      .select('*')
      .eq('ministry_id', mid)
      .order('created_at', { ascending: false });

    if (error) {
      showNotification('error', 'Erro', error.message || 'Erro ao carregar registros', false);
      return;
    }

    setRegistros((data || []) as ApresentacaoRegistro[]);
  };

  useEffect(() => {
    if (loading) return;
    const run = async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      const certRes = await loadCertificadosTemplatesForCurrentUser(supabase);
      setCertTemplates(certRes.templates as CertificadoTemplate[]);
      await loadRegistros(mid);
      setLoadingData(false);
    };
    run();
  }, [loading, supabase]);

  const handleSubmit = async () => {
    if (!ministryId) {
      showNotification('warning', 'Aviso', 'Ministerio nao encontrado.', true);
      return;
    }
    if (!validateForm()) return;

    const payload = {
      ministry_id: ministryId,
      crianca_nome: formData.crianca_nome.trim(),
      crianca_data_nascimento: formData.crianca_data_nascimento,
      crianca_sexo: formData.crianca_sexo,
      pai_nome: formData.pai_nome.trim(),
      mae_nome: formData.mae_nome.trim(),
      responsavel_nome: formData.responsavel_nome.trim(),
      responsavel_telefone: formData.responsavel_telefone.trim(),
      data_apresentacao: formData.data_apresentacao,
      local_apresentacao: formData.local_apresentacao.trim(),
      status: formData.status,
      observacoes: formData.observacoes.trim(),
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('apresentacao_criancas_registros')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .single();

      if (error) {
        showNotification('error', 'Erro', error.message || 'Erro ao atualizar registro', false);
        return;
      }

      setRegistros((prev) => prev.map((r) => (r.id === editingId ? (data as ApresentacaoRegistro) : r)));
      showNotification('success', 'Sucesso', 'Registro atualizado com sucesso.', true);
      resetForm();
      setActiveTab('registros');
      return;
    }

    const { data, error } = await supabase
      .from('apresentacao_criancas_registros')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select('*')
      .single();

    if (error) {
      showNotification('error', 'Erro', error.message || 'Erro ao salvar registro', false);
      return;
    }

    setRegistros((prev) => [data as ApresentacaoRegistro, ...prev]);
    showNotification('success', 'Sucesso', 'Registro criado com sucesso.', true);
    resetForm();
    setActiveTab('registros');
  };

  const handleEdit = (registro: ApresentacaoRegistro) => {
    setEditingId(registro.id);
    setFormData({
      crianca_nome: registro.crianca_nome || '',
      crianca_data_nascimento: formatIsoDate(registro.crianca_data_nascimento),
      crianca_sexo: registro.crianca_sexo || 'MASCULINO',
      pai_nome: registro.pai_nome || '',
      mae_nome: registro.mae_nome || '',
      responsavel_nome: registro.responsavel_nome || '',
      responsavel_telefone: registro.responsavel_telefone || '',
      data_apresentacao: formatIsoDate(registro.data_apresentacao),
      local_apresentacao: registro.local_apresentacao || '',
      status: registro.status || 'registrado',
      observacoes: registro.observacoes || '',
    });
    setActiveTab('cadastro');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    const { error } = await supabase
      .from('apresentacao_criancas_registros')
      .delete()
      .eq('id', id);

    if (error) {
      showNotification('error', 'Erro', error.message || 'Erro ao excluir registro', false);
      return;
    }

    setRegistros((prev) => prev.filter((r) => r.id !== id));
    showNotification('success', 'Sucesso', 'Registro excluido.', true);
  };

  const buildPlaceholderMap = (registro: ApresentacaoRegistro) => ({
    crianca_nome: registro.crianca_nome || '',
    crianca_data_nascimento: formatDate(registro.crianca_data_nascimento),
    crianca_sexo: registro.crianca_sexo || '',
    pai_nome: registro.pai_nome || '',
    mae_nome: registro.mae_nome || '',
    responsavel_nome: registro.responsavel_nome || '',
    responsavel_telefone: registro.responsavel_telefone || '',
    data_apresentacao: formatDate(registro.data_apresentacao),
    local_apresentacao: registro.local_apresentacao || '',
    data_emissao: new Date().toLocaleDateString('pt-BR'),
    nome_igreja: configIgreja.nome || '',
  });

  const renderCertificadoHtml = (template: CertificadoTemplate, map: Record<string, string>) => {
    const orientacao = template.orientacao === 'portrait' ? 'portrait' : 'landscape';
    const largura = orientacao === 'portrait' ? CERTIFICADO_CANVAS.altura : CERTIFICADO_CANVAS.largura;
    const altura = orientacao === 'portrait' ? CERTIFICADO_CANVAS.largura : CERTIFICADO_CANVAS.altura;

    // Fundo como <img> absoluto para garantir impressão independente das config do browser
    const bgHtml = template.backgroundUrl
      ? `<img src="${template.backgroundUrl}" style="position:absolute;left:0;top:0;width:${largura}px;height:${altura}px;object-fit:fill;display:block;" />`
      : '';

    const elementsHtml = (template.elementos || [])
      .filter((el: any) => el.visivel !== false)
      .map((el: any) => {
        const baseStyle = `position:absolute; left:${el.x}px; top:${el.y}px; width:${el.largura}px; height:${el.altura}px;`;
        if (el.tipo === 'texto') {
          const texto = substituirPlaceholdersCertificado(el.texto || '', map, template.categoria).replace(/\n/g, '<br />');
          const style = [
            baseStyle,
            `font-size:${el.fontSize || 14}px;`,
            `font-family:${el.fonte || 'Arial'};`,
            `font-weight:${el.negrito ? 700 : 400};`,
            `font-style:${el.italico ? 'italic' : 'normal'};`,
            `text-decoration:${el.sublinhado ? 'underline' : 'none'};`,
            `color:${el.cor || '#111'};`,
            `text-align:${el.alinhamento || 'left'};`,
            'box-sizing:border-box;',
          ].join('');
          return `<div style="${style}">${texto}</div>`;
        }

        if (el.tipo === 'chapa') {
          const style = [
            baseStyle,
            `background-color:${el.cor || '#111'};`,
            `opacity:${el.transparencia ?? 1};`,
          ].join('');
          return `<div style="${style}"></div>`;
        }

        if (el.tipo === 'logo' || el.tipo === 'imagem') {
          const src = el.tipo === 'logo'
            ? (configIgreja.logo || el.imagemUrl || '')
            : (el.imagemUrl || '');
          if (!src) return '';
          const style = [
            baseStyle,
            'object-fit:contain;',
            `opacity:${el.transparencia ?? 1};`,
          ].join('');
          return `<img src="${src}" style="${style}" />`;
        }

        return '';
      })
      .join('');

    return `
      <div style="position:relative; width:${largura}px; height:${altura}px; margin:0 auto; overflow:hidden;">
        ${bgHtml}
        ${elementsHtml}
      </div>
    `;
  };

  const handlePrint = async (registro: ApresentacaoRegistro, template: CertificadoTemplate) => {
    const html = renderCertificadoHtml(template, buildPlaceholderMap(registro));
    const win = window.open('', '_blank');
    if (!win) return;

    // A4 landscape em px a 96dpi: 297mm × 210mm ≈ 1122 × 794
    // Canvas: 840 × 595 → scale ≈ 1.334 para preencher a folha toda
    const scaleX = (297 * 3.7795) / CERTIFICADO_CANVAS.largura;
    const scaleY = (210 * 3.7795) / CERTIFICADO_CANVAS.altura;
    const scale = Math.min(scaleX, scaleY).toFixed(4);

    win.document.write(`<!DOCTYPE html><html><head><title>Certificado</title>`);
    win.document.write(`<style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A4 landscape; margin: 0; }
      html, body {
        width: 297mm; height: 210mm;
        overflow: hidden;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .cert-scale-wrapper {
        transform-origin: top left;
        transform: scale(${scale});
        width: ${CERTIFICADO_CANVAS.largura}px;
        height: ${CERTIFICADO_CANVAS.altura}px;
      }
      img { display: block; }
    </style>`);
    win.document.write('</head><body>');
    win.document.write(`<div class="cert-scale-wrapper">${html}</div>`);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('apresentacao_criancas_registros')
      .update({
        certificado_template_key: template.id,
        certificado_emitido_em: nowIso,
        updated_at: nowIso,
      })
      .eq('id', registro.id);

    if (!error) {
      setRegistros((prev) =>
        prev.map((r) =>
          r.id === registro.id
            ? { ...r, certificado_template_key: template.id, certificado_emitido_em: nowIso }
            : r
        )
      );
    }
  };

  const handlePrintClick = (registro: ApresentacaoRegistro) => {
    if (templatesApresentacao.length === 0) {
      showNotification(
        'warning',
        'Certificado nao encontrado',
        'Crie um certificado na categoria Apresentacao de Criancas em Configuracoes > Certificados.',
        false
      );
      return;
    }

    if (templatesApresentacao.length === 1) {
      handlePrint(registro, templatesApresentacao[0]);
      return;
    }

    setPrintTarget(registro);
    setSelectedTemplateId(templatesApresentacao[0].id);
    setPrintModalOpen(true);
  };

  const handleConfirmPrint = () => {
    if (!printTarget) return;
    const template = templatesApresentacao.find((t) => t.id === selectedTemplateId);
    if (template) handlePrint(printTarget, template);
    setPrintModalOpen(false);
    setPrintTarget(null);
  };

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <PageLayout
      title="Apresentacao de Criancas"
      description="Cadastro e controle de apresentacoes de criancas"
      activeMenu="apresentacao-criancas"
    >
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      {printModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-700">Selecionar certificado</h3>
            <p className="text-xs text-gray-500 mt-1">
              Escolha o modelo para impressao.
            </p>
            <select
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              {templatesApresentacao.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"
                onClick={() => setPrintModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="rounded-lg bg-[#123b63] px-3 py-2 text-xs font-semibold text-white"
                onClick={handleConfirmPrint}
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
        <div className="p-4 md:p-6">
          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === 'cadastro' && (
              <Section icon="📝" title="Cadastro de Apresentacao">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Nome da crianca</label>
                          <input
                            value={formData.crianca_nome}
                            onChange={(e) => setFormData((prev) => ({ ...prev, crianca_nome: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.crianca_nome && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.crianca_nome}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Data de nascimento</label>
                          <input
                            type="date"
                            value={formData.crianca_data_nascimento}
                            onChange={(e) => setFormData((prev) => ({ ...prev, crianca_data_nascimento: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.crianca_data_nascimento && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.crianca_data_nascimento}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Sexo</label>
                          <select
                            value={formData.crianca_sexo}
                            onChange={(e) => setFormData((prev) => ({ ...prev, crianca_sexo: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          >
                            <option value="MASCULINO">Masculino</option>
                            <option value="FEMININO">Feminino</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Data da apresentacao</label>
                          <input
                            type="date"
                            value={formData.data_apresentacao}
                            onChange={(e) => setFormData((prev) => ({ ...prev, data_apresentacao: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.data_apresentacao && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.data_apresentacao}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Local da apresentacao</label>
                          <input
                            value={formData.local_apresentacao}
                            onChange={(e) => setFormData((prev) => ({ ...prev, local_apresentacao: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.local_apresentacao && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.local_apresentacao}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Status</label>
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Nome do pai</label>
                          <input
                            value={formData.pai_nome}
                            onChange={(e) => setFormData((prev) => ({ ...prev, pai_nome: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.pai_nome && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.pai_nome}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Nome da mae</label>
                          <input
                            value={formData.mae_nome}
                            onChange={(e) => setFormData((prev) => ({ ...prev, mae_nome: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.mae_nome && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.mae_nome}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Responsavel</label>
                          <input
                            value={formData.responsavel_nome}
                            onChange={(e) => setFormData((prev) => ({ ...prev, responsavel_nome: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.responsavel_nome && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.responsavel_nome}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Telefone do responsavel</label>
                          <input
                            value={formData.responsavel_telefone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, responsavel_telefone: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.responsavel_telefone && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.responsavel_telefone}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600">Observacoes</label>
                        <textarea
                          value={formData.observacoes}
                          onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[80px]"
                        />
                      </div>

                      <div className="flex flex-wrap gap-3 justify-end">
                        {editingId && (
                          <button
                            className="px-4 py-2 rounded-lg border border-gray-200 text-sm"
                            onClick={resetForm}
                          >
                            Cancelar edicao
                          </button>
                        )}
                        <button
                          className="px-4 py-2 rounded-lg bg-[#123b63] text-white text-sm font-semibold"
                          onClick={handleSubmit}
                        >
                          {editingId ? 'Atualizar registro' : 'Salvar registro'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Certificado</h3>
                      <p className="text-xs text-gray-500">
                        {templatesApresentacao.length === 0
                          ? 'Nenhum modelo configurado para apresentacao de criancas.'
                          : `${templatesApresentacao.length} modelo(s) disponiveis para impressao.`}
                      </p>
                      <button
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"
                        onClick={() => setActiveTab('registros')}
                      >
                        Ver registros
                      </button>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {activeTab === 'registros' && (
              <Section icon="📑" title="Registros">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  {registros.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum registro cadastrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-400 border-b">
                            <th className="py-2 pr-4">Crianca</th>
                            <th className="py-2 pr-4">Pais/Responsavel</th>
                            <th className="py-2 pr-4">Apresentacao</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2">Acoes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registros.map((r) => (
                            <tr key={r.id} className="border-b last:border-b-0">
                              <td className="py-3 pr-4">
                                <div className="font-semibold text-gray-800">{r.crianca_nome}</div>
                                <div className="text-xs text-gray-500">{formatDate(r.crianca_data_nascimento)}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-xs text-gray-600">Pai: {r.pai_nome || '-'}</div>
                                <div className="text-xs text-gray-600">Mae: {r.mae_nome || '-'}</div>
                                <div className="text-xs text-gray-600">Resp: {r.responsavel_nome || '-'}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-xs text-gray-600">{formatDate(r.data_apresentacao)}</div>
                                <div className="text-xs text-gray-500">{r.local_apresentacao || '-'}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                  {STATUS_OPTIONS.find((s) => s.value === r.status)?.label || r.status || '-'}
                                </span>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    title="Editar"
                                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                    onClick={() => handleEdit(r)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    title="Excluir"
                                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                    onClick={() => handleDelete(r.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    title={templatesApresentacao.length === 0
                                      ? 'Cadastre um certificado para apresentacao de criancas'
                                      : 'Imprimir certificado'}
                                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                    onClick={() => handlePrintClick(r)}
                                    disabled={templatesApresentacao.length === 0}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </button>
                                </div>
                                {r.certificado_emitido_em && (
                                  <div className="text-[11px] text-gray-400 mt-1">
                                    Certificado emitido em {formatDate(r.certificado_emitido_em)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
}
