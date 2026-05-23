'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
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

interface PessoaSugestao {
  id: string;
  nome: string;
  data_nascimento?: string | null;
  sexo?: string | null;
  celular?: string | null;
}

interface CasamentoRegistro {
  id: string;
  ministry_id: string;
  conjuge1_id?: string | null;
  conjuge1_nome: string;
  conjuge1_data_nascimento?: string | null;
  conjuge1_sexo?: string | null;
  conjuge1_telefone?: string | null;
  conjuge2_id?: string | null;
  conjuge2_nome: string;
  conjuge2_data_nascimento?: string | null;
  conjuge2_sexo?: string | null;
  conjuge2_telefone?: string | null;
  data_casamento?: string | null;
  local_casamento?: string | null;
  pastor_nome?: string | null;
  tipo_casamento?: string | null;
  status?: string | null;
  observacoes?: string | null;
  certificado_template_key?: string | null;
  certificado_emitido_em?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: '💍' },
  { id: 'registros', label: 'Registros', icon: '📑' },
];

const STATUS_OPTIONS = [
  { value: 'registrado', label: 'Registrado' },
  { value: 'realizado',  label: 'Realizado'  },
  { value: 'cancelado',  label: 'Cancelado'  },
];

const TIPO_OPTIONS = [
  { value: 'religioso',       label: 'Religioso'          },
  { value: 'civil',           label: 'Civil'               },
  { value: 'civil_religioso', label: 'Civil e Religioso'   },
];

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };

// Componente definido FORA do pai para evitar recriação a cada render (perda de foco)
function AutocompleteField({
  label, searchValue, onSearchChange, sugestoes, showSug, setShowSug, isLoading, onSelect,
  vinculado, containerRef, placeholder, fieldError,
}: {
  label: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  sugestoes: PessoaSugestao[];
  showSug: boolean;
  setShowSug: (v: boolean) => void;
  isLoading: boolean;
  onSelect: (c: PessoaSugestao) => void;
  vinculado: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  placeholder?: string;
  fieldError?: string;
}) {
  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-semibold text-gray-600">
        {label}
        <span className="ml-1 text-[11px] font-normal text-gray-400">(busca ao digitar 3+ letras)</span>
      </label>
      <input
        value={searchValue}
        onChange={e => onSearchChange(e.target.value)}
        onFocus={() => sugestoes.length > 0 && setShowSug(true)}
        placeholder={placeholder || 'Digite o nome para buscar...'}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        autoComplete="off"
      />
      {fieldError && <p className="text-xs text-red-600 mt-1">{fieldError}</p>}
      {showSug && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-gray-400">Buscando...</div>
          ) : sugestoes.map(c => (
            <button key={c.id} type="button"
              className="flex w-full flex-col px-3 py-2 hover:bg-blue-50 text-left border-b last:border-b-0"
              onMouseDown={() => onSelect(c)}>
              <span className="text-sm font-medium text-gray-800">{c.nome}</span>
              <span className="text-xs text-gray-400">
                {[c.sexo, c.data_nascimento ? formatDate(c.data_nascimento) : null].filter(Boolean).join(' \u00b7 ')}
              </span>
            </button>
          ))}
        </div>
      )}
      {vinculado && <p className="text-[11px] text-emerald-600 mt-1">✓ Membro vinculado ao cadastro</p>}
    </div>
  );
}

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const str = String(value);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return str;
};

const formatIsoDate = (value?: string | null) => {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
};

const EMPTY_FORM = {
  conjuge1_id: '',
  conjuge1_nome: '',
  conjuge1_data_nascimento: '',
  conjuge1_sexo: 'MASCULINO',
  conjuge1_telefone: '',
  conjuge2_id: '',
  conjuge2_nome: '',
  conjuge2_data_nascimento: '',
  conjuge2_sexo: 'FEMININO',
  conjuge2_telefone: '',
  data_casamento: '',
  local_casamento: '',
  pastor_nome: '',
  tipo_casamento: 'religioso',
  status: 'registrado',
  observacoes: '',
};

export default function CasamentoPage() {
  const { ctx, bloqueado } = useRequireModulo('gestao');
  const loading = ctx.loading;
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab]       = useState('cadastro');
  const [ministryId, setMinistryId]     = useState<string | null>(null);
  const [registros, setRegistros]       = useState<CasamentoRegistro[]>([]);
  const [certTemplates, setCertTemplates] = useState<CertificadoTemplate[]>([]);
  const [configIgreja, setConfigIgreja] = useState<ConfiguracaoIgreja>({
    nome: 'Igreja/Ministerio', endereco: '', cnpj: '', telefone: '',
    email: '', website: '', descricao: '', responsavel: '', logo: '',
  });

  const [editingId, setEditingId]       = useState<string | null>(null);
  const [formData, setFormData]         = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const [loadingData, setLoadingData]   = useState(true);

  // Autocomplete cônjuge 1
  const [search1, setSearch1]           = useState('');
  const [sugestoes1, setSugestoes1]     = useState<PessoaSugestao[]>([]);
  const [showSug1, setShowSug1]         = useState(false);
  const [loading1, setLoading1]         = useState(false);
  const ref1 = useRef<HTMLDivElement>(null);
  const deb1 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplete cônjuge 2
  const [search2, setSearch2]           = useState('');
  const [sugestoes2, setSugestoes2]     = useState<PessoaSugestao[]>([]);
  const [showSug2, setShowSug2]         = useState(false);
  const [loading2, setLoading2]         = useState(false);
  const ref2 = useRef<HTMLDivElement>(null);
  const deb2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notification, setNotification] = useState({
    isOpen: false, title: '', message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    autoClose: 3000,
  });

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printTarget, setPrintTarget]       = useState<CasamentoRegistro | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const templatesCasamento = useMemo(
    () => certTemplates.filter((t) => t.categoria === 'casamento'),
    [certTemplates]
  );

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    autoClose: number | undefined = 3000
  ) => setNotification({ isOpen: true, title, message, type, autoClose });

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setSearch1(''); setSearch2('');
    setSugestoes1([]); setSugestoes2([]);
    setEditingId(null); setFieldErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.conjuge1_nome.trim()) errors.conjuge1_nome = 'Informe o nome do cônjuge 1.';
    if (!formData.conjuge2_nome.trim()) errors.conjuge2_nome = 'Informe o nome do cônjuge 2.';
    if (!formData.data_casamento)       errors.data_casamento = 'Informe a data do casamento.';
    if (!formData.local_casamento.trim()) errors.local_casamento = 'Informe o local do casamento.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const loadRegistros = async (mid?: string | null) => {
    if (!mid) return;
    const { data, error } = await supabase
      .from('casamento_registros')
      .select('*')
      .eq('ministry_id', mid)
      .order('created_at', { ascending: false });
    if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
    setRegistros((data || []) as CasamentoRegistro[]);
  };

  useEffect(() => {
    if (loading) return;
    (async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      const config = await fetchConfiguracaoIgrejaFromSupabase(supabase);
      setConfigIgreja(config);
      const certRes = await loadCertificadosTemplatesForCurrentUser(supabase);
      setCertTemplates(certRes.templates as CertificadoTemplate[]);
      await loadRegistros(mid);
      setLoadingData(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, supabase]);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref1.current && !ref1.current.contains(e.target as Node)) setShowSug1(false);
      if (ref2.current && !ref2.current.contains(e.target as Node)) setShowSug2(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buscarPessoas = useCallback(
    async (termo: string, setSugestoes: (s: PessoaSugestao[]) => void, setShow: (v: boolean) => void, setLoad: (v: boolean) => void) => {
      if (!ministryId || termo.length < 3) { setSugestoes([]); setShow(false); return; }
      setLoad(true);
      const { data } = await supabase
        .from('members')
        .select('id, name, data_nascimento, sexo, celular')
        .eq('ministry_id', ministryId)
        .ilike('name', `%${termo}%`)
        .limit(10);
      const mapped: PessoaSugestao[] = (data || []).map((m: any) => ({
        id: m.id, nome: m.name || '',
        data_nascimento: m.data_nascimento, sexo: m.sexo, celular: m.celular,
      }));
      setSugestoes(mapped);
      setShow(mapped.length > 0);
      setLoad(false);
    },
    [ministryId, supabase]
  );

  const handleSearch1 = (value: string) => {
    setSearch1(value);
    setFormData(p => ({ ...p, conjuge1_nome: value, conjuge1_id: '' }));
    if (deb1.current) clearTimeout(deb1.current);
    deb1.current = setTimeout(() => buscarPessoas(value, setSugestoes1, setShowSug1, setLoading1), 300);
  };

  const handleSearch2 = (value: string) => {
    setSearch2(value);
    setFormData(p => ({ ...p, conjuge2_nome: value, conjuge2_id: '' }));
    if (deb2.current) clearTimeout(deb2.current);
    deb2.current = setTimeout(() => buscarPessoas(value, setSugestoes2, setShowSug2, setLoading2), 300);
  };

  const selecionarConjuge1 = (c: PessoaSugestao) => {
    setSearch1(c.nome);
    setFormData(p => ({
      ...p, conjuge1_id: c.id, conjuge1_nome: c.nome,
      conjuge1_data_nascimento: formatIsoDate(c.data_nascimento),
      conjuge1_sexo: c.sexo || 'MASCULINO',
      conjuge1_telefone: c.celular || '',
    }));
    setSugestoes1([]); setShowSug1(false);
  };

  const selecionarConjuge2 = (c: PessoaSugestao) => {
    setSearch2(c.nome);
    setFormData(p => ({
      ...p, conjuge2_id: c.id, conjuge2_nome: c.nome,
      conjuge2_data_nascimento: formatIsoDate(c.data_nascimento),
      conjuge2_sexo: c.sexo || 'FEMININO',
      conjuge2_telefone: c.celular || '',
    }));
    setSugestoes2([]); setShowSug2(false);
  };

  const handleSubmit = async () => {
    if (!ministryId) { showNotification('warning', 'Aviso', 'Ministério não encontrado.', 3000); return; }
    if (!validateForm()) return;

    const payload: any = {
      ministry_id: ministryId,
      conjuge1_nome: formData.conjuge1_nome.trim(),
      conjuge1_data_nascimento: formData.conjuge1_data_nascimento || null,
      conjuge1_sexo: formData.conjuge1_sexo,
      conjuge1_telefone: formData.conjuge1_telefone.trim() || null,
      conjuge2_nome: formData.conjuge2_nome.trim(),
      conjuge2_data_nascimento: formData.conjuge2_data_nascimento || null,
      conjuge2_sexo: formData.conjuge2_sexo,
      conjuge2_telefone: formData.conjuge2_telefone.trim() || null,
      data_casamento: formData.data_casamento || null,
      local_casamento: formData.local_casamento.trim(),
      pastor_nome: formData.pastor_nome.trim() || null,
      tipo_casamento: formData.tipo_casamento,
      status: formData.status,
      observacoes: formData.observacoes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (formData.conjuge1_id) payload.conjuge1_id = formData.conjuge1_id;
    if (formData.conjuge2_id) payload.conjuge2_id = formData.conjuge2_id;

    if (editingId) {
      const { data, error } = await supabase
        .from('casamento_registros').update(payload).eq('id', editingId).select('*').single();
      if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
      setRegistros(prev => prev.map(r => r.id === editingId ? (data as CasamentoRegistro) : r));
      showNotification('success', 'Sucesso', 'Registro atualizado com sucesso.', 3000);
      resetForm(); setActiveTab('registros'); return;
    }

    const { data, error } = await supabase
      .from('casamento_registros')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select('*').single();
    if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
    setRegistros(prev => [data as CasamentoRegistro, ...prev]);
    showNotification('success', 'Sucesso', 'Registro criado com sucesso.', 3000);
    resetForm(); setActiveTab('registros');
  };

  const handleEdit = (r: CasamentoRegistro) => {
    setEditingId(r.id);
    setSearch1(r.conjuge1_nome || '');
    setSearch2(r.conjuge2_nome || '');
    setFormData({
      conjuge1_id: r.conjuge1_id || '',
      conjuge1_nome: r.conjuge1_nome || '',
      conjuge1_data_nascimento: formatIsoDate(r.conjuge1_data_nascimento),
      conjuge1_sexo: r.conjuge1_sexo || 'MASCULINO',
      conjuge1_telefone: r.conjuge1_telefone || '',
      conjuge2_id: r.conjuge2_id || '',
      conjuge2_nome: r.conjuge2_nome || '',
      conjuge2_data_nascimento: formatIsoDate(r.conjuge2_data_nascimento),
      conjuge2_sexo: r.conjuge2_sexo || 'FEMININO',
      conjuge2_telefone: r.conjuge2_telefone || '',
      data_casamento: formatIsoDate(r.data_casamento),
      local_casamento: r.local_casamento || '',
      pastor_nome: r.pastor_nome || '',
      tipo_casamento: r.tipo_casamento || 'religioso',
      status: r.status || 'registrado',
      observacoes: r.observacoes || '',
    });
    setActiveTab('cadastro');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    const { error } = await supabase.from('casamento_registros').delete().eq('id', id);
    if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
    setRegistros(prev => prev.filter(r => r.id !== id));
    showNotification('success', 'Sucesso', 'Registro excluído.', 3000);
  };

  const buildPlaceholderMap = (r: CasamentoRegistro) => ({
    conjuge1_nome: r.conjuge1_nome || '',
    conjuge2_nome: r.conjuge2_nome || '',
    conjuge1_data_nascimento: formatDate(r.conjuge1_data_nascimento),
    conjuge2_data_nascimento: formatDate(r.conjuge2_data_nascimento),
    data_casamento: formatDate(r.data_casamento),
    local_casamento: r.local_casamento || '',
    pastor_nome: r.pastor_nome || '',
    tipo_casamento: TIPO_OPTIONS.find(t => t.value === r.tipo_casamento)?.label || r.tipo_casamento || '',
    data_emissao: new Date().toLocaleDateString('pt-BR'),
    nome_igreja: configIgreja.nome || '',
  });

  const renderCertificadoHtml = (template: CertificadoTemplate, map: Record<string, string>) => {
    const orientacao = template.orientacao === 'portrait' ? 'portrait' : 'landscape';
    const largura = orientacao === 'portrait' ? CERTIFICADO_CANVAS.altura : CERTIFICADO_CANVAS.largura;
    const altura  = orientacao === 'portrait' ? CERTIFICADO_CANVAS.largura : CERTIFICADO_CANVAS.altura;

    const bgHtml = template.backgroundUrl
      ? `<img src="${template.backgroundUrl}" style="position:absolute;left:0;top:0;width:${largura}px;height:${altura}px;object-fit:fill;display:block;" />`
      : '';

    const elementsHtml = (template.elementos || [])
      .filter((el: any) => el.visivel !== false)
      .map((el: any) => {
        const base = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.largura}px;height:${el.altura}px;`;
        if (el.tipo === 'texto') {
          const texto = substituirPlaceholdersCertificado(el.texto || '', map, template.categoria).replace(/\n/g, '<br />');
          const style = [
            base,
            `font-size:${el.fontSize || 14}px;font-family:${el.fonte || 'Arial'};`,
            `font-weight:${el.negrito ? 700 : 400};font-style:${el.italico ? 'italic' : 'normal'};`,
            `text-decoration:${el.sublinhado ? 'underline' : 'none'};`,
            `color:${el.cor || '#111'};text-align:${el.alinhamento || 'left'};box-sizing:border-box;`,
          ].join('');
          return `<div style="${style}">${texto}</div>`;
        }
        if (el.tipo === 'chapa') {
          return `<div style="${base}background-color:${el.cor || '#111'};opacity:${el.transparencia ?? 1};"></div>`;
        }
        if (el.tipo === 'logo' || el.tipo === 'imagem') {
          const src = el.tipo === 'logo' ? (configIgreja.logo || el.imagemUrl || '') : (el.imagemUrl || '');
          if (!src) return '';
          return `<img src="${src}" style="${base}object-fit:contain;opacity:${el.transparencia ?? 1};" />`;
        }
        return '';
      }).join('');

    return `<div style="position:relative;width:${largura}px;height:${altura}px;margin:0 auto;overflow:hidden;">${bgHtml}${elementsHtml}</div>`;
  };

  const handlePrint = async (registro: CasamentoRegistro, template: CertificadoTemplate) => {
    const html = renderCertificadoHtml(template, buildPlaceholderMap(registro));
    const win = window.open('', '_blank');
    if (!win) return;

    const scaleX = (277 * 3.7795) / CERTIFICADO_CANVAS.largura;
    const scaleY = (190 * 3.7795) / CERTIFICADO_CANVAS.altura;
    const scale  = Math.min(scaleX, scaleY).toFixed(4);

    win.document.write(`<!DOCTYPE html><html><head><title>Certificado de Casamento</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      @page{size:A4 landscape;margin:1cm;}
      html,body{width:100%;height:100%;display:flex;justify-content:center;align-items:center;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      .cert{zoom:${scale};width:${CERTIFICADO_CANVAS.largura}px;height:${CERTIFICADO_CANVAS.altura}px;overflow:hidden;flex-shrink:0;}
      img{display:block;}
    </style></head><body><div class="cert">${html}</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('casamento_registros')
      .update({ certificado_template_key: template.id, certificado_emitido_em: nowIso, updated_at: nowIso })
      .eq('id', registro.id);
    if (!error) {
      setRegistros(prev => prev.map(r =>
        r.id === registro.id ? { ...r, certificado_template_key: template.id, certificado_emitido_em: nowIso } : r
      ));
    }
  };

  const handlePrintClick = (r: CasamentoRegistro) => {
    if (templatesCasamento.length === 0) {
      showNotification('warning', 'Certificado não configurado',
        'Crie um certificado na categoria "Casamento" em Configurações > Certificados.', undefined);
      return;
    }
    if (templatesCasamento.length === 1) { handlePrint(r, templatesCasamento[0]); return; }
    setPrintTarget(r);
    setSelectedTemplateId(templatesCasamento[0].id);
    setPrintModalOpen(true);
  };

  const handleConfirmPrint = () => {
    if (!printTarget) return;
    const tmpl = templatesCasamento.find(t => t.id === selectedTemplateId);
    if (tmpl) handlePrint(printTarget, tmpl);
    setPrintModalOpen(false); setPrintTarget(null);
  };

  if (bloqueado) return null;
  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <PageLayout
      title="Casamento"
      description="Cadastro e controle de registros de casamento"
      activeMenu="casamento"
    >
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification(p => ({ ...p, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      {/* Modal seleção de certificado */}
      {printModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-700">Selecionar certificado</h3>
            <p className="text-xs text-gray-500 mt-1">Escolha o modelo para impressão.</p>
            <select
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
            >
              {templatesCasamento.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"
                onClick={() => setPrintModalOpen(false)}>Cancelar</button>
              <button className="rounded-lg bg-[#123b63] px-3 py-2 text-xs font-semibold text-white"
                onClick={handleConfirmPrint}>Imprimir</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
        <div className="p-4 md:p-6">
          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>

            {/* ===== ABA CADASTRO ===== */}
            {activeTab === 'cadastro' && (
              <Section icon="💍" title="Cadastro de Casamento">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">

                      {/* Cônjuge 1 */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-[#123b63] border-b border-gray-100 pb-1">👤 Cônjuge 1</h4>
                        <AutocompleteField
                          label="Nome do cônjuge 1"
                          searchValue={search1}
                          onSearchChange={handleSearch1}
                          sugestoes={sugestoes1}
                          showSug={showSug1}
                          setShowSug={setShowSug1}
                          isLoading={loading1}
                          onSelect={selecionarConjuge1}
                          vinculado={!!formData.conjuge1_id}
                          containerRef={ref1}
                          fieldError={fieldErrors.conjuge1_nome}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Data de nascimento</label>
                            <input type="date" value={formData.conjuge1_data_nascimento}
                              onChange={e => setFormData(p => ({ ...p, conjuge1_data_nascimento: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Sexo</label>
                            <select value={formData.conjuge1_sexo}
                              onChange={e => setFormData(p => ({ ...p, conjuge1_sexo: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                              <option value="MASCULINO">Masculino</option>
                              <option value="FEMININO">Feminino</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Telefone</label>
                            <input value={formData.conjuge1_telefone}
                              onChange={e => setFormData(p => ({ ...p, conjuge1_telefone: e.target.value }))}
                              placeholder="(00) 00000-0000"
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Cônjuge 2 */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-[#123b63] border-b border-gray-100 pb-1">👤 Cônjuge 2</h4>
                        <AutocompleteField
                          label="Nome do cônjuge 2"
                          searchValue={search2}
                          onSearchChange={handleSearch2}
                          sugestoes={sugestoes2}
                          showSug={showSug2}
                          setShowSug={setShowSug2}
                          isLoading={loading2}
                          onSelect={selecionarConjuge2}
                          vinculado={!!formData.conjuge2_id}
                          containerRef={ref2}
                          fieldError={fieldErrors.conjuge2_nome}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Data de nascimento</label>
                            <input type="date" value={formData.conjuge2_data_nascimento}
                              onChange={e => setFormData(p => ({ ...p, conjuge2_data_nascimento: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Sexo</label>
                            <select value={formData.conjuge2_sexo}
                              onChange={e => setFormData(p => ({ ...p, conjuge2_sexo: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                              <option value="MASCULINO">Masculino</option>
                              <option value="FEMININO">Feminino</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Telefone</label>
                            <input value={formData.conjuge2_telefone}
                              onChange={e => setFormData(p => ({ ...p, conjuge2_telefone: e.target.value }))}
                              placeholder="(00) 00000-0000"
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Dados do Casamento */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-[#123b63] border-b border-gray-100 pb-1">📋 Dados do Casamento</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Data do casamento</label>
                            <input type="date" value={formData.data_casamento}
                              onChange={e => setFormData(p => ({ ...p, data_casamento: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                            {fieldErrors.data_casamento && <p className="text-xs text-red-600 mt-1">{fieldErrors.data_casamento}</p>}
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Tipo de casamento</label>
                            <select value={formData.tipo_casamento}
                              onChange={e => setFormData(p => ({ ...p, tipo_casamento: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                              {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Local do casamento</label>
                            <input value={formData.local_casamento}
                              onChange={e => setFormData(p => ({ ...p, local_casamento: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                            {fieldErrors.local_casamento && <p className="text-xs text-red-600 mt-1">{fieldErrors.local_casamento}</p>}
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600">Status</label>
                            <select value={formData.status}
                              onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-gray-600">Pastor/Ministro celebrante</label>
                            <input value={formData.pastor_nome}
                              onChange={e => setFormData(p => ({ ...p, pastor_nome: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Observações</label>
                          <textarea value={formData.observacoes}
                            onChange={e => setFormData(p => ({ ...p, observacoes: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[80px]" />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 justify-end">
                        {editingId && (
                          <button className="px-4 py-2 rounded-lg border border-gray-200 text-sm" onClick={resetForm}>
                            Cancelar edição
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

                  {/* Painel lateral */}
                  <div className="lg:col-span-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Certificado de Casamento</h3>
                      <p className="text-xs text-gray-500">
                        {templatesCasamento.length === 0
                          ? 'Nenhum modelo configurado. Crie um em Configurações > Certificados com a categoria "Casamento".'
                          : `${templatesCasamento.length} modelo(s) disponível(is) para impressão.`}
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
              <Section icon="📑" title="Registros de Casamento">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  {registros.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum registro cadastrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-400 border-b">
                            <th className="py-2 pr-4">Cônjuges</th>
                            <th className="py-2 pr-4">Data / Local</th>
                            <th className="py-2 pr-4">Tipo</th>
                            <th className="py-2 pr-4">Pastor</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registros.map(r => (
                            <tr key={r.id} className="border-b last:border-b-0">
                              <td className="py-3 pr-4">
                                <div className="font-semibold text-gray-800">{r.conjuge1_nome}</div>
                                <div className="text-xs text-gray-500">& {r.conjuge2_nome}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-xs text-gray-600">{formatDate(r.data_casamento) || '-'}</div>
                                <div className="text-xs text-gray-500">{r.local_casamento || '-'}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-xs text-gray-600">
                                  {TIPO_OPTIONS.find(t => t.value === r.tipo_casamento)?.label || '-'}
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="text-xs text-gray-600">{r.pastor_nome || '-'}</div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  r.status === 'realizado'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : r.status === 'cancelado'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {STATUS_OPTIONS.find(s => s.value === r.status)?.label || r.status || '-'}
                                </span>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <button title="Editar"
                                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                    onClick={() => handleEdit(r)}>
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button title="Excluir"
                                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                    onClick={() => handleDelete(r.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    title={templatesCasamento.length === 0 ? 'Configure um certificado de casamento primeiro' : 'Imprimir certificado'}
                                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                    onClick={() => handlePrintClick(r)}
                                    disabled={templatesCasamento.length === 0}>
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
