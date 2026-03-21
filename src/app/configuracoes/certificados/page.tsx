'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import InteractiveCanvas from '@/components/InteractiveCanvas';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import {
  loadCertificadosTemplatesForCurrentUser,
  persistCertificadosTemplatesSnapshotToSupabase
} from '@/lib/certificados-templates-sync';
import { CERTIFICADOS_TEMPLATES_BASE } from '@/lib/certificados-templates';
import {
  CERTIFICADO_PLACEHOLDERS,
  obterPreviewTextoCertificado
} from '@/lib/certificados-utils';

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };

const ELEMENTOS_CERTIFICADO = [
  { tipo: 'texto', label: 'Texto', icone: '📝' },
  { tipo: 'logo', label: 'Logo', icone: '🏛️' },
  { tipo: 'imagem', label: 'Imagem', icone: '🖼️' },
  { tipo: 'chapa', label: 'Chapa', icone: '🔴' }
];

interface CertificadoElemento {
  id: string;
  tipo: 'texto' | 'logo' | 'imagem' | 'chapa';
  x: number;
  y: number;
  largura: number;
  altura: number;
  fontSize?: number;
  cor?: string;
  backgroundColor?: string;
  fonte?: string;
  transparencia?: number;
  borderRadius?: number;
  texto?: string;
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  sombreado?: boolean;
  imagemUrl?: string;
  visivel: boolean;
}

interface CertificadoTemplate {
  id: string;
  nome: string;
  backgroundUrl?: string;
  elementos: CertificadoElemento[];
  orientacao?: 'landscape' | 'portrait';
  variacao?: 'branco';
  categoria?: 'apresentacao-criancas' | 'batismo' | 'casamento';
  ativo?: boolean;
  criado_pelo_usuario?: boolean;
}

export default function ConfiguracoesCertificadosPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const imagemInputRef = useRef<HTMLInputElement>(null);

  const CERTIFICADO_TIPOS = [
    { id: 'apresentacao-criancas', label: 'Apresentação de Crianças', descricao: 'Secretaria' },
    { id: 'batismo', label: 'Batismo', descricao: 'Secretaria' },
    { id: 'casamento', label: 'Casamento', descricao: 'Secretaria' }
  ] as const;

  const CERTIFICADO_VARIACOES = [
    { id: 'padrao', label: 'Modelo 01' },
    { id: 'branco', label: 'Modelo em branco', variacao: 'branco' as const }
  ] as const;

  const [activeMenu, setActiveMenu] = useState('config-certificados');
  const [loadingData, setLoadingData] = useState(true);
  const [ministryId, setMinistryId] = useState<string | null>(null);

  const [templatesCertificados, setTemplatesCertificados] = useState<CertificadoTemplate[]>([]);
  const [templateEmEdicao, setTemplateEmEdicao] = useState<CertificadoTemplate | null>(null);
  const [elementoSelecionado, setElementoSelecionado] = useState<CertificadoElemento | null>(null);
  const [elementosSelecionados, setElementosSelecionados] = useState<CertificadoElemento[]>([]);
  const [statusMensagem, setStatusMensagem] = useState('');
  const [tipoCertificadoAtivo, setTipoCertificadoAtivo] = useState<
    (typeof CERTIFICADO_TIPOS)[number]['id']
  >('apresentacao-criancas');


  const generateId = () => {
    try {
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
        return (crypto as any).randomUUID() as string;
      }
    } catch {
      // ignore
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const loadInitialData = async () => {
    setLoadingData(true);
    const resolvedMinistryId = await resolveMinistryId(supabase);
    setMinistryId(resolvedMinistryId);

    const templatesRes = await loadCertificadosTemplatesForCurrentUser(supabase);
    const templatesLoaded = templatesRes.templates.length > 0 ? templatesRes.templates : [];
    const templatesById = new Map(templatesLoaded.map((t: any) => [t.id, t]));
    const mergedTemplates = [
      ...CERTIFICADOS_TEMPLATES_BASE.map((base) => ({
        ...base,
        ...(templatesById.get(base.id) || {})
      })),
      ...templatesLoaded.filter((t: any) => !CERTIFICADOS_TEMPLATES_BASE.some((base) => base.id === t.id))
    ].map((t: any) => ({
      ...t,
      categoria: t.categoria || 'apresentacao-criancas'
    }));

    setTemplatesCertificados(mergedTemplates as any);
    const ativo =
      mergedTemplates.find((t: any) => t.ativo) ||
      mergedTemplates.find((t: any) => (t.categoria || 'apresentacao-criancas') === 'apresentacao-criancas' && !t.variacao) ||
      mergedTemplates.find((t: any) => !t.variacao) ||
      mergedTemplates[0] ||
      null;
    setTemplateEmEdicao(ativo as any);
    if (ativo?.categoria) {
      setTipoCertificadoAtivo(ativo.categoria);
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
    if (templatesCertificados.length === 0) return;
    const next = getTemplatePorTipo(tipoCertificadoAtivo);
    if (!next) return;
    if (templateEmEdicao?.id === next.id) return;
    setTemplateEmEdicao(next);
    setElementoSelecionado(null);
    setElementosSelecionados([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCertificadoAtivo, templatesCertificados]);

  const handleSelectTemplate = (templateId: string) => {
    const next = templatesCertificados.find((t) => t.id === templateId) || null;
    const nextComAtivo = next ? { ...next, ativo: true } : null;
    setTemplateEmEdicao(nextComAtivo);
    setElementoSelecionado(null);
    setElementosSelecionados([]);
    if (!next) return;
    const categoria = next.categoria || 'apresentacao-criancas';
    const nextTemplates = templatesCertificados.map((t) => {
      if ((t.categoria || 'apresentacao-criancas') !== categoria) return t;
      return { ...t, ativo: t.id === next.id };
    });
    setTemplatesCertificados(nextTemplates);
    setTipoCertificadoAtivo(categoria);
  };

  const handleTemplateUpdate = (nextTemplate: CertificadoTemplate) => {
    setTemplateEmEdicao(nextTemplate);
  };

  const updateElemento = (id: string, props: Partial<CertificadoElemento>) => {
    if (!templateEmEdicao) return;
    const elementosAtualizados = templateEmEdicao.elementos.map((el) =>
      el.id === id ? { ...el, ...props } : el
    );
    handleTemplateUpdate({ ...templateEmEdicao, elementos: elementosAtualizados });
  };

  const updateMultiplos = (items: Array<{ id: string; propriedades: Partial<CertificadoElemento> }>) => {
    if (!templateEmEdicao) return;
    const mapa = new Map(items.map((i) => [i.id, i.propriedades]));
    const elementosAtualizados = templateEmEdicao.elementos.map((el) =>
      mapa.has(el.id) ? { ...el, ...mapa.get(el.id) } : el
    );
    handleTemplateUpdate({ ...templateEmEdicao, elementos: elementosAtualizados });
  };

  const handleAddElemento = (tipo: CertificadoElemento['tipo']) => {
    if (!templateEmEdicao) return;

    const base: CertificadoElemento = {
      id: generateId(),
      tipo,
      x: 40,
      y: 40,
      largura: tipo === 'logo' ? 90 : tipo === 'imagem' ? 160 : tipo === 'chapa' ? 200 : 320,
      altura: tipo === 'logo' ? 90 : tipo === 'imagem' ? 120 : tipo === 'chapa' ? 40 : 40,
      fontSize: 16,
      cor: '#111827',
      fonte: 'Arial',
      alinhamento: 'left',
      negrito: false,
      italico: false,
      sublinhado: false,
      visivel: true,
      texto: tipo === 'texto' ? 'Texto do certificado' : tipo === 'chapa' ? 'CHAPA' : undefined
    };

    const elementosAtualizados = [...templateEmEdicao.elementos, base];
    handleTemplateUpdate({ ...templateEmEdicao, elementos: elementosAtualizados });
    setElementoSelecionado(base);
    setElementosSelecionados([base]);
  };

  const handleRemoveElemento = (elementoId: string) => {
    if (!templateEmEdicao) return;
    const elementosAtualizados = templateEmEdicao.elementos.filter((el) => el.id !== elementoId);
    handleTemplateUpdate({ ...templateEmEdicao, elementos: elementosAtualizados });
    if (elementoSelecionado?.id === elementoId) setElementoSelecionado(null);
  };

  const handleSaveTemplate = async () => {
    if (!templateEmEdicao || !ministryId) return;
    const nextTemplates = templatesCertificados.map((t) =>
      t.id === templateEmEdicao.id ? templateEmEdicao : t
    );
    setTemplatesCertificados(nextTemplates);
    await persistCertificadosTemplatesSnapshotToSupabase(supabase, ministryId, nextTemplates as any[]);
    setStatusMensagem('Template de certificado salvo.');
  };

  const handleResetTemplate = async () => {
    if (!templateEmEdicao || !ministryId) return;
    const baseTemplate = CERTIFICADOS_TEMPLATES_BASE.find((t) => t.id === templateEmEdicao.id);
    if (!baseTemplate) {
      setStatusMensagem('Nao ha modelo base para restaurar este template.');
      return;
    }

    const resetTemplate = JSON.parse(JSON.stringify(baseTemplate)) as CertificadoTemplate;
    const nextTemplates = templatesCertificados.map((t) =>
      t.id === templateEmEdicao.id ? resetTemplate : t
    );
    setTemplatesCertificados(nextTemplates);
    setTemplateEmEdicao(resetTemplate);
    await persistCertificadosTemplatesSnapshotToSupabase(supabase, ministryId, nextTemplates as any[]);
    setStatusMensagem('Template restaurado para o modelo base.');
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !templateEmEdicao) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handleTemplateUpdate({ ...templateEmEdicao, backgroundUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImagemUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !templateEmEdicao || !elementoSelecionado) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      updateElemento(elementoSelecionado.id, { imagemUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getTemplatePorTipo = (
    tipo: (typeof CERTIFICADO_TIPOS)[number]['id'],
    variacao?: 'branco'
  ) => {
    const candidatos = templatesCertificados.filter((template) => {
      const categoria = template.categoria || 'apresentacao-criancas';
      if (categoria !== tipo) return false;
      if (variacao === 'branco') return template.variacao === 'branco';
      return !template.variacao;
    });

    if (variacao === 'branco') return candidatos[0];
    return candidatos.find((t) => t.ativo) || candidatos[0];
  };

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 p-6">
          <h1 className="text-3xl font-bold text-gray-800">⚙️ Certificados</h1>
          <p className="text-gray-600 mt-1">Gerencie templates de certificados</p>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex h-full">
            <div className="w-72 bg-white border-r border-gray-200 p-4 overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Templates</h2>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">
                  Tipo de Certificado
                </label>
                <div className="space-y-2">
                  {CERTIFICADO_TIPOS.map((tipo) => (
                    <button
                      key={tipo.id}
                      onClick={() => setTipoCertificadoAtivo(tipo.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg transition font-semibold text-sm ${
                        tipoCertificadoAtivo === tipo.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tipo.label}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="my-4 border-gray-300" />

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✨</span>
                  <h3 className="text-sm font-bold text-gray-800">Modelos Disponiveis</h3>
                </div>

                <div className="space-y-3">
                  {CERTIFICADO_VARIACOES.map((variacao) => {
                    const template = getTemplatePorTipo(tipoCertificadoAtivo, variacao.variacao);
                    const isSelected = templateEmEdicao?.id === template?.id;
                    const isDisabled = !template;
                    const previewStyle: React.CSSProperties = template?.backgroundUrl
                      ? { backgroundImage: `url(${template.backgroundUrl})`, backgroundSize: 'cover' }
                      : variacao.variacao === 'branco'
                        ? { background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)' }
                        : { background: 'linear-gradient(135deg, #dbeafe 0%, #eef2ff 100%)' };

                    return (
                      <div
                        key={variacao.id}
                        className={`bg-white rounded-lg p-3 border-2 transition cursor-pointer hover:shadow-md ${
                          isSelected
                            ? 'border-green-500 shadow-lg ring-1 ring-green-500/20'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                        onClick={() => template && handleSelectTemplate(template.id)}
                      >
                        <div
                          className="w-full h-20 rounded mb-2 flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden"
                          style={previewStyle}
                        >
                          {!template ? (
                            <div className="text-center">
                              <div className="text-3xl mb-1 text-gray-400">⏳</div>
                              <div className="text-xs text-gray-500">Em breve</div>
                            </div>
                          ) : (
                            <div className="w-full h-full p-1.5 flex flex-col justify-between">
                              <div className="flex items-start gap-0.5">
                                <div className="w-3 h-3 bg-white/30 rounded-sm"></div>
                                <div className="flex-1 h-2 bg-white/30 rounded"></div>
                                <div className="w-3 h-3 bg-white/30 rounded-sm"></div>
                              </div>
                              <div className="flex gap-0.5">
                                <div className="w-6 h-8 bg-white/40 rounded"></div>
                                <div className="flex-1 space-y-0.5">
                                  <div className="h-2 bg-white/50 rounded"></div>
                                  <div className="h-1.5 bg-white/30 rounded w-3/4"></div>
                                  <div className="h-1.5 bg-white/30 rounded w-2/3"></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <h4 className="font-semibold text-xs text-gray-800 mb-1">
                          {variacao.label}
                          <span className="block text-[10px] text-gray-500 font-normal">
                            {template ? template.nome : 'Em breve'}
                          </span>
                        </h4>

                        <div className="text-[10px] text-gray-500">
                          {isSelected ? 'Ativo (Clique para editar)' : 'Clique para editar'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {statusMensagem && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                    {statusMensagem}
                  </div>
                )}

                <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Editar Template</h3>
                      <p className="text-sm text-gray-500">
                        {templateEmEdicao ? templateEmEdicao.nome : 'Selecione um modelo'}
                      </p>
                    </div>
                    <button
                      className="px-3 py-2 border-2 border-blue-500 text-blue-700 rounded-lg hover:bg-blue-50"
                      onClick={() => backgroundInputRef.current?.click()}
                      disabled={!templateEmEdicao}
                    >
                      Alterar Imagem
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase">
                      Imagem de Fundo (Frente)
                    </label>
                    <div
                      className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition ${
                        templateEmEdicao ? 'bg-gray-50 cursor-pointer hover:bg-gray-100' : 'bg-gray-100 cursor-not-allowed'
                      }`}
                      onClick={() => templateEmEdicao && backgroundInputRef.current?.click()}
                    >
                      <div className="text-4xl mb-2">📤</div>
                      <div className="text-sm font-semibold text-gray-700">Alterar Imagem</div>
                      <p className="text-xs text-gray-500 mt-1">Formato landscape A4 recomendado</p>
                    </div>
                    {templateEmEdicao?.backgroundUrl && (
                      <button
                        className="mt-2 text-xs text-red-600 hover:underline"
                        onClick={() => handleTemplateUpdate({ ...templateEmEdicao, backgroundUrl: undefined })}
                      >
                        Remover Imagem
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">
                      Canvas de Edicao (Landscape)
                    </h4>
                    <div className="bg-white border rounded-lg p-3">
                      {templateEmEdicao ? (
                        <InteractiveCanvas
                          elementos={templateEmEdicao.elementos}
                          elementoSelecionado={elementoSelecionado}
                          elementosSelecionados={elementosSelecionados}
                          onElementoSelecionado={setElementoSelecionado}
                          onElementosSelecionados={setElementosSelecionados}
                          onElementoAtualizado={updateElemento}
                          onMultiplosElementosAtualizados={updateMultiplos}
                          onElementoRemovido={handleRemoveElemento}
                          getPreviewText={obterPreviewTextoCertificado}
                          backgroundUrl={templateEmEdicao.backgroundUrl}
                          larguraCanvas={CERTIFICADO_CANVAS.largura}
                          alturaCanvas={CERTIFICADO_CANVAS.altura}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-[320px] text-sm text-gray-500">
                          Selecione um modelo para editar.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="px-4 py-2 bg-[#123b63] text-white rounded-lg hover:bg-[#0f2a45] transition shadow-md"
                      onClick={handleSaveTemplate}
                      disabled={!templateEmEdicao}
                    >
                      Salvar Template
                    </button>
                    <button
                      className="px-4 py-2 border-2 border-blue-500 text-blue-700 rounded-lg hover:bg-blue-50"
                      onClick={handleResetTemplate}
                      disabled={!templateEmEdicao}
                    >
                      Resetar para Nativo
                    </button>
                  </div>

                  <input
                    ref={backgroundInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBackgroundUpload}
                  />
                  <input
                    ref={imagemInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImagemUpload}
                  />
                </div>
              </div>
            </div>

            <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Adicionar Elementos</h3>
              <div className="grid grid-cols-2 gap-2">
                {ELEMENTOS_CERTIFICADO.map((el) => (
                  <button
                    key={el.tipo}
                    onClick={() => handleAddElemento(el.tipo as CertificadoElemento['tipo'])}
                    className="flex flex-col items-center gap-2 p-3 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                    disabled={!templateEmEdicao}
                  >
                    <span className="text-2xl">{el.icone}</span>
                    <span className="text-xs font-semibold text-gray-700 text-center">{el.label}</span>
                  </button>
                ))}
              </div>

              <hr className="my-4" />

              <h4 className="font-semibold text-gray-800 mb-3">Dicas de Uso</h4>
              <ul className="text-xs text-gray-600 space-y-2">
                <li>• Clique nos elementos para seleciona-los</li>
                <li>• Arraste elementos para reposiciona-los</li>
                <li>• Use os campos do elemento selecionado para ajustes</li>
                <li>• Use placeholders nos textos do certificado</li>
              </ul>

              <div className="mt-4 bg-white border rounded-lg p-4">
                <h4 className="font-semibold text-sm text-gray-800 mb-2">Elemento Selecionado</h4>
                {!elementoSelecionado && (
                  <p className="text-xs text-gray-500">Selecione um elemento para editar.</p>
                )}
                {elementoSelecionado && (
                  <div className="space-y-3">
                    {elementoSelecionado.tipo === 'texto' && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Texto</label>
                        <textarea
                          className="mt-1 w-full border rounded px-3 py-2 text-xs"
                          rows={3}
                          value={elementoSelecionado.texto || ''}
                          onChange={(e) => updateElemento(elementoSelecionado.id, { texto: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Fonte</label>
                        <input
                          className="mt-1 w-full border rounded px-2 py-1 text-xs"
                          value={elementoSelecionado.fonte || 'Arial'}
                          onChange={(e) => updateElemento(elementoSelecionado.id, { fonte: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Tamanho</label>
                        <input
                          type="number"
                          className="mt-1 w-full border rounded px-2 py-1 text-xs"
                          value={elementoSelecionado.fontSize || 12}
                          onChange={(e) => updateElemento(elementoSelecionado.id, { fontSize: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Cor</label>
                        <input
                          type="color"
                          className="mt-1 w-full border rounded h-8"
                          value={elementoSelecionado.cor || '#111827'}
                          onChange={(e) => updateElemento(elementoSelecionado.id, { cor: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Alinhamento</label>
                        <select
                          className="mt-1 w-full border rounded px-2 py-1 text-xs"
                          value={elementoSelecionado.alinhamento || 'left'}
                          onChange={(e) => updateElemento(elementoSelecionado.id, { alinhamento: e.target.value as any })}
                        >
                          <option value="left">Esquerda</option>
                          <option value="center">Centro</option>
                          <option value="right">Direita</option>
                        </select>
                      </div>
                    </div>

                    {(elementoSelecionado.tipo === 'imagem' || elementoSelecionado.tipo === 'logo') && (
                      <button
                        className="px-3 py-2 border rounded text-xs"
                        onClick={() => imagemInputRef.current?.click()}
                      >
                        Enviar Imagem
                      </button>
                    )}

                    {elementoSelecionado.tipo === 'chapa' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-700">Cor</label>
                          <input
                            type="color"
                            className="mt-1 w-full border rounded h-8"
                            value={elementoSelecionado.cor || '#ef4444'}
                            onChange={(e) => updateElemento(elementoSelecionado.id, { cor: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">Opacidade</label>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            className="mt-1 w-full border rounded px-2 py-1 text-xs"
                            value={elementoSelecionado.transparencia ?? 1}
                            onChange={(e) => updateElemento(elementoSelecionado.id, { transparencia: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      className="text-red-600 text-xs"
                      onClick={() => handleRemoveElemento(elementoSelecionado.id)}
                    >
                      Remover elemento
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 bg-white border rounded-lg p-4">
                <h4 className="font-semibold text-sm text-gray-800 mb-2">Placeholders</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {CERTIFICADO_PLACEHOLDERS.map((ph) => (
                    <li key={ph.placeholder}>{ph.placeholder} - {ph.label}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
