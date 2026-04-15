'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface CandidatoSugestao {
  id: string;
  nome: string;
  data_nascimento?: string | null;
  sexo?: string | null;
  celular?: string | null;
}

interface BatismoRegistro {
  id: string;
  ministry_id: string;
  candidato_id?: string | null;
  candidato_nome: string;
  candidato_data_nascimento?: string | null;
  candidato_sexo?: string | null;
  candidato_telefone?: string | null;
  data_batismo?: string | null;
  local_batismo?: string | null;
  pastor_nome?: string | null;
  status?: string | null;
  observacoes?: string | null;
  certificado_template_key?: string | null;
  certificado_emitido_em?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: '✝️' },
  { id: 'registros', label: 'Registros', icon: '📑' },
];

const STATUS_OPTIONS = [
  { value: 'registrado', label: 'Registrado' },
  { value: 'batizado', label: 'Batizado' },
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

const EMPTY_FORM = {
  candidato_id: '' as string,
  candidato_nome: '',
  candidato_data_nascimento: '',
  candidato_sexo: 'MASCULINO',
  candidato_telefone: '',
  data_batismo: '',
  local_batismo: '',
  pastor_nome: '',
  status: 'registrado',
  observacoes: '',
};

export default function BatismoAguasPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('cadastro');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<BatismoRegistro[]>([]);
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
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Autocomplete
  const [searchInput, setSearchInput] = useState('');
  const [sugestoes, setSugestoes] = useState<CandidatoSugestao[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notification, setNotification] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    autoClose: true,
  });

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<BatismoRegistro | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const templatesBatismo = useMemo(
    () => certTemplates.filter((t) => t.categoria === 'batismo-aguas'),
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
    setFormData({ ...EMPTY_FORM });
    setSearchInput('');
    setSugestoes([]);
    setEditingId(null);
    setFieldErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.candidato_nome.trim()) errors.candidato_nome = 'Informe o nome do candidato.';
    if (!formData.data_batismo) errors.data_batismo = 'Informe a data do batismo.';
    if (!formData.local_batismo.trim()) errors.local_batismo = 'Informe o local do batismo.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const loadRegistros = async (mid?: string | null) => {
    if (!mid) return;
    const { data, error } = await supabase
      .from('batismo_aguas_registros')
      .select('*')
      .eq('ministry_id', mid)
      .order('created_at', { ascending: false });

    if (error) {
      showNotification('error', 'Erro', error.message || 'Erro ao carregar registros', false);
      return;
    }
    setRegistros((data || []) as BatismoRegistro[]);
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

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSugestoes(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buscarCandidatos = useCallback(
    async (termo: string) => {
      if (!ministryId || termo.length < 3) {
        setSugestoes([]);
        setShowSugestoes(false);
        return;
      }
      setSearchLoading(true);
      const { data } = await supabase
        .from('members')
        .select('id, name, data_nascimento, sexo, celular')
        .eq('ministry_id', ministryId)
        .eq('tipo_cadastro', 'congregado')
        .ilike('name', `%${termo}%`)
        .limit(10);

      const mapped: CandidatoSugestao[] = (data || []).map((m: any) => ({
        id: m.id,
        nome: m.name || '',
        data_nascimento: m.data_nascimento,
        sexo: m.sexo,
        celular: m.celular,
      }));
      setSugestoes(mapped);
      setShowSugestoes(mapped.length > 0);
      setSearchLoading(false);
    },
    [ministryId, supabase]
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setFormData((prev) => ({ ...prev, candidato_nome: value, candidato_id: '' }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarCandidatos(value), 300);
  };

  const handleSelecionarCandidato = (c: CandidatoSugestao) => {
    setSearchInput(c.nome);
    setFormData((prev) => ({
      ...prev,
      candidato_id: c.id,
      candidato_nome: c.nome,
      candidato_data_nascimento: formatIsoDate(c.data_nascimento),
      candidato_sexo: c.sexo || 'MASCULINO',
      candidato_telefone: c.celular || '',
    }));
    setSugestoes([]);
    setShowSugestoes(false);
  };

  const handleSubmit = async () => {
    if (!ministryId) {
      showNotification('warning', 'Aviso', 'Ministerio nao encontrado.', true);
      return;
    }
    if (!validateForm()) return;

    const payload: any = {
      ministry_id: ministryId,
      candidato_nome: formData.candidato_nome.trim(),
      candidato_data_nascimento: formData.candidato_data_nascimento || null,
      candidato_sexo: formData.candidato_sexo,
      candidato_telefone: formData.candidato_telefone.trim() || null,
      data_batismo: formData.data_batismo || null,
      local_batismo: formData.local_batismo.trim(),
      pastor_nome: formData.pastor_nome.trim() || null,
      status: formData.status,
      observacoes: formData.observacoes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (formData.candidato_id) payload.candidato_id = formData.candidato_id;

    if (editingId) {
      const { data, error } = await supabase
        .from('batismo_aguas_registros')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .single();

      if (error) {
        showNotification('error', 'Erro', error.message || 'Erro ao atualizar registro', false);
        return;
      }
      setRegistros((prev) => prev.map((r) => (r.id === editingId ? (data as BatismoRegistro) : r)));
      showNotification('success', 'Sucesso', 'Registro atualizado com sucesso.', true);
      resetForm();
      setActiveTab('registros');
      return;
    }

    const { data, error } = await supabase
      .from('batismo_aguas_registros')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select('*')
      .single();

    if (error) {
      showNotification('error', 'Erro', error.message || 'Erro ao salvar registro', false);
      return;
    }

    setRegistros((prev) => [data as BatismoRegistro, ...prev]);
    showNotification('success', 'Sucesso', 'Registro criado com sucesso.', true);
    resetForm();
    setActiveTab('registros');
  };

  const handleEdit = (registro: BatismoRegistro) => {
    setEditingId(registro.id);
    const nome = registro.candidato_nome || '';
    setSearchInput(nome);
    setFormData({
      candidato_id: registro.candidato_id || '',
      candidato_nome: nome,
      candidato_data_nascimento: formatIsoDate(registro.candidato_data_nascimento),
      candidato_sexo: registro.candidato_sexo || 'MASCULINO',
      candidato_telefone: registro.candidato_telefone || '',
      data_batismo: formatIsoDate(registro.data_batismo),
      local_batismo: registro.local_batismo || '',
      pastor_nome: registro.pastor_nome || '',
      status: registro.status || 'registrado',
      observacoes: registro.observacoes || '',
    });
    setActiveTab('cadastro');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    const { error } = await supabase.from('batismo_aguas_registros').delete().eq('id', id);
    if (error) {
      showNotification('error', 'Erro', error.message || 'Erro ao excluir registro', false);
      return;
    }
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    showNotification('success', 'Sucesso', 'Registro excluido.', true);
  };

  const buildPlaceholderMap = (registro: BatismoRegistro) => ({
    candidato_nome: registro.candidato_nome || '',
    candidato_data_nascimento: formatDate(registro.candidato_data_nascimento),
    candidato_sexo: registro.candidato_sexo || '',
    data_batismo: formatDate(registro.data_batismo),
    local_batismo: registro.local_batismo || '',
    pastor_nome: registro.pastor_nome || '',
    data_emissao: new Date().toLocaleDateString('pt-BR'),
    nome_igreja: configIgreja.nome || '',
  });

  const renderCertificadoHtml = (template: CertificadoTemplate, map: Record<string, string>) => {
    const orientacao = template.orientacao === 'portrait' ? 'portrait' : 'landscape';
    const largura = orientacao === 'portrait' ? CERTIFICADO_CANVAS.altura : CERTIFICADO_CANVAS.largura;
    const altura = orientacao === 'portrait' ? CERTIFICADO_CANVAS.largura : CERTIFICADO_CANVAS.altura;

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
          const style = [baseStyle, `background-color:${el.cor || '#111'};`, `opacity:${el.transparencia ?? 1};`].join('');
          return `<div style="${style}"></div>`;
        }
        if (el.tipo === 'logo' || el.tipo === 'imagem') {
          const src = el.tipo === 'logo' ? (configIgreja.logo || el.imagemUrl || '') : (el.imagemUrl || '');
          if (!src) return '';
          const style = [baseStyle, 'object-fit:contain;', `opacity:${el.transparencia ?? 1};`].join('');
          return `<img src="${src}" style="${style}" />`;
        }
        return '';
      })
      .join('');

    return `<div style="position:relative; width:${largura}px; height:${altura}px; margin:0 auto; overflow:hidden;">${bgHtml}${elementsHtml}</div>`;
  };

  const handlePrint = async (registro: BatismoRegistro, template: CertificadoTemplate) => {
    const html = renderCertificadoHtml(template, buildPlaceholderMap(registro));
    const win = window.open('', '_blank');
    if (!win) return;

    const scaleX = (297 * 3.7795) / CERTIFICADO_CANVAS.largura;
    const scaleY = (210 * 3.7795) / CERTIFICADO_CANVAS.altura;
    const scale = Math.min(scaleX, scaleY).toFixed(4);

    win.document.write(`<!DOCTYPE html><html><head><title>Certificado de Batismo</title>`);
    win.document.write(`<style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A4 landscape; margin: 0; }
      html, body { width: 297mm; height: 210mm; overflow: hidden; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .cert-scale-wrapper { transform-origin: top left; transform: scale(${scale}); width: ${CERTIFICADO_CANVAS.largura}px; height: ${CERTIFICADO_CANVAS.altura}px; }
      img { display: block; }
    </style></head><body>`);
    win.document.write(`<div class="cert-scale-wrapper">${html}</div>`);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('batismo_aguas_registros')
      .update({ certificado_template_key: template.id, certificado_emitido_em: nowIso, updated_at: nowIso })
      .eq('id', registro.id);

    if (!error) {
      setRegistros((prev) =>
        prev.map((r) =>
          r.id === registro.id ? { ...r, certificado_template_key: template.id, certificado_emitido_em: nowIso } : r
        )
      );
    }
  };

  const handlePrintClick = (registro: BatismoRegistro) => {
    if (templatesBatismo.length === 0) {
      showNotification(
        'warning',
        'Certificado nao configurado',
        'Crie um certificado na categoria "Batismo nas Aguas" em Configuracoes > Certificados.',
        false
      );
      return;
    }
    if (templatesBatismo.length === 1) {
      handlePrint(registro, templatesBatismo[0]);
      return;
    }
    setPrintTarget(registro);
    setSelectedTemplateId(templatesBatismo[0].id);
    setPrintModalOpen(true);
  };

  const handleConfirmPrint = () => {
    if (!printTarget) return;
    const template = templatesBatismo.find((t) => t.id === selectedTemplateId);
    if (template) handlePrint(printTarget, template);
    setPrintModalOpen(false);
    setPrintTarget(null);
  };

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <PageLayout
      title="Batismo nas Aguas"
      description="Cadastro e controle de candidatos ao batismo"
      activeMenu="batismo-aguas"
    >
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      {/* Modal seleção de certificado */}
      {printModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-700">Selecionar certificado</h3>
            <p className="text-xs text-gray-500 mt-1">Escolha o modelo para impressao.</p>
            <select
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              {templatesBatismo.map((t) => (
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
            {/* ===== ABA CADASTRO ===== */}
            {activeTab === 'cadastro' && (
              <Section icon="✝️" title="Cadastro de Candidato ao Batismo">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">

                      {/* Autocomplete candidato */}
                      <div ref={searchRef} className="relative">
                        <label className="text-xs font-semibold text-gray-600">
                          Nome do candidato
                          <span className="ml-1 text-[11px] font-normal text-gray-400">(congregado — busca ao digitar 3+ letras)</span>
                        </label>
                        <input
                          value={searchInput}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          onFocus={() => sugestoes.length > 0 && setShowSugestoes(true)}
                          placeholder="Digite o nome para buscar congregados..."
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          autoComplete="off"
                        />
                        {fieldErrors.candidato_nome && (
                          <p className="text-xs text-red-600 mt-1">{fieldErrors.candidato_nome}</p>
                        )}
                        {/* Dropdown sugestões */}
                        {showSugestoes && (
                          <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto">
                            {searchLoading ? (
                              <div className="px-3 py-2 text-xs text-gray-400">Buscando...</div>
                            ) : (
                              sugestoes.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="flex w-full flex-col px-3 py-2 hover:bg-blue-50 text-left border-b last:border-b-0"
                                  onMouseDown={() => handleSelecionarCandidato(c)}
                                >
                                  <span className="text-sm font-medium text-gray-800">{c.nome}</span>
                                  <span className="text-xs text-gray-400">
                                    {[c.sexo, c.data_nascimento ? formatDate(c.data_nascimento) : null].filter(Boolean).join(' · ')}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        {formData.candidato_id && (
                          <p className="text-[11px] text-emerald-600 mt-1">✓ Congregado vinculado ao cadastro</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Data de nascimento</label>
                          <input
                            type="date"
                            value={formData.candidato_data_nascimento}
                            onChange={(e) => setFormData((prev) => ({ ...prev, candidato_data_nascimento: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Sexo</label>
                          <select
                            value={formData.candidato_sexo}
                            onChange={(e) => setFormData((prev) => ({ ...prev, candidato_sexo: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          >
                            <option value="MASCULINO">Masculino</option>
                            <option value="FEMININO">Feminino</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Telefone</label>
                          <input
                            value={formData.candidato_telefone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, candidato_telefone: e.target.value }))}
                            placeholder="(00) 00000-0000"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
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
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Data do batismo</label>
                          <input
                            type="date"
                            value={formData.data_batismo}
                            onChange={(e) => setFormData((prev) => ({ ...prev, data_batismo: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.data_batismo && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.data_batismo}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Local do batismo</label>
                          <input
                            value={formData.local_batismo}
                            onChange={(e) => setFormData((prev) => ({ ...prev, local_batismo: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          {fieldErrors.local_batismo && (
                            <p className="text-xs text-red-600 mt-1">{fieldErrors.local_batismo}</p>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-600">Pastor/Ministro que batizou</label>
                          <input
                            value={formData.pastor_nome}
                            onChange={(e) => setFormData((prev) => ({ ...prev, pastor_nome: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
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

                  {/* Painel lateral: info certificado */}
                  <div className="lg:col-span-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Certificado de Batismo</h3>
                      <p className="text-xs text-gray-500">
                        {templatesBatismo.length === 0
                          ? 'Nenhum modelo configurado. Crie um em Configuracoes > Certificados com a categoria "Batismo nas Aguas".'
                          : `${templatesBatismo.length} modelo(s) disponivel(is) para impressao.`}
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

            {/* ===== ABA REGISTROS ===== */}
            {activeTab === 'registros' && (
              <Section icon="📑" title="Registros de Batismo">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  {registros.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum registro cadastrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-400 border-b">
                            <th className="py-2 pr-4">Candidato</th>
                            <th className="py-2 pr-4">Batismo</th>
                            <th className="py-2 pr-4">Pastor</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2">Acoes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registros.map((r) => (
                            <tr key={r.id} className="border-b last:border-b-0">
                              <td className="py-3 pr-4">
                                <div className="font-semibold text-gray-800">{r.candidato_nome}</div>
                                <div className="text-xs text-gray-500">
                                  {[r.candidato_sexo, r.candidato_data_nascimento ? formatDate(r.candidato_data_nascimento) : null].filter(Boolean).join(' · ')}
                                </div>
                                {r.candidato_telefone && (
                                  <div className="text-xs text-gray-400">{r.candidato_telefone}</div>
                                )}
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-xs text-gray-600">{formatDate(r.data_batismo) || '-'}</div>
                                <div className="text-xs text-gray-500">{r.local_batismo || '-'}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-xs text-gray-600">{r.pastor_nome || '-'}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  r.status === 'batizado'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : r.status === 'cancelado'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
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
                                    title={
                                      templatesBatismo.length === 0
                                        ? 'Configure um certificado de batismo primeiro'
                                        : 'Imprimir certificado de batismo'
                                    }
                                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                    onClick={() => handlePrintClick(r)}
                                    disabled={templatesBatismo.length === 0}
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
