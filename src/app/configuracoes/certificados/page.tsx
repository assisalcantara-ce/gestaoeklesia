'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import InteractiveCanvas from '@/components/InteractiveCanvas';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { AlignCenter, AlignLeft, AlignRight, Award, Bold, Clipboard, Copy, Download, Image as ImageIcon, Italic, Shield, Type, Underline } from 'lucide-react';

const FONTES_DISPONIVEIS = [
  'Arial', 'Arial Black', 'Georgia', 'Times New Roman', 'Verdana',
  'Trebuchet MS', 'Comic Sans MS', 'Courier New', 'Impact', 'Tahoma',
  'Palatino', 'Garamond', 'Book Antiqua', 'Lucida Console',
];
import {
  loadCertificadosTemplatesForCurrentUser,
  persistCertificadosTemplatesSnapshotToSupabase,
} from '@/lib/certificados-templates-sync';
import {
  CERTIFICADO_CATEGORIAS,
  getCertificadoPlaceholders,
  obterPreviewTextoCertificado,
} from '@/lib/certificados-utils';

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };

const ELEMENTOS_TIPOS = [
  { tipo: 'texto',  label: 'Texto',  icone: <Type className="h-5 w-5" /> },
  { tipo: 'logo',   label: 'Logo',   icone: <Shield className="h-5 w-5" /> },
  { tipo: 'imagem', label: 'Imagem', icone: <ImageIcon className="h-5 w-5" /> },
  { tipo: 'chapa',  label: 'Chapa',  icone: <Award className="h-5 w-5" /> },
];

interface CertificadoElemento {
  id: string;
  tipo: 'texto' | 'logo' | 'imagem' | 'chapa' | 'foto-membro' | 'qrcode' | 'linha';
  x: number;
  y: number;
  largura: number;
  altura: number;
  fontSize?: number;
  cor?: string;
  fonte?: string;
  transparencia?: number;
  texto?: string;
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  imagemUrl?: string;
  visivel: boolean;
}

interface CertificadoTemplate {
  id: string;
  nome: string;
  chave?: string;
  categoria?: string;
  backgroundUrl?: string;
  elementos: CertificadoElemento[];
  orientacao?: 'landscape' | 'portrait';
  ativo?: boolean;
  criado_pelo_usuario?: boolean;
}

const gId = () =>
  typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const novoTemplateEmBranco = (nome: string, categoria: string): CertificadoTemplate => ({
  id: gId(),
  nome,
  orientacao: 'landscape',
  ativo: false,
  criado_pelo_usuario: true,
  categoria: (categoria || 'ministerial') as any,
  elementos: [],
});

export default function ConfiguracoesCertificadosPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const imagemInputRef = useRef<HTMLInputElement>(null);
  const canvasROCleanup = useRef<(() => void) | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  // Ref callback estável — mede largura só na montagem e em resize de janela
  // NÃO usa ResizeObserver no próprio wrapper (causaria loop: escala muda altura → observer dispara → loop)
  const canvasWrapperRef = useCallback((node: HTMLDivElement | null) => {
    canvasROCleanup.current?.();
    canvasROCleanup.current = null;
    if (!node) return;
    let lastW = 0;
    const measure = () => {
      const w = node.clientWidth;
      if (w > 0 && w !== lastW) {
        lastW = w;
        setCanvasScale(w / CERTIFICADO_CANVAS.largura);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    canvasROCleanup.current = () => {
      window.removeEventListener('resize', measure);
    };
  }, []);

  const [activeMenu, setActiveMenu]       = useState('config-certificados');
  const [loadingData, setLoadingData]     = useState(true);
  const [ministryId, setMinistryId]       = useState<string | null>(null);

  const [templates, setTemplates]                         = useState<CertificadoTemplate[]>([]);
  const [templateEmEdicao, setTemplateEmEdicao]           = useState<CertificadoTemplate | null>(null);
  const [elementoSelecionado, setElementoSelecionado]     = useState<CertificadoElemento | null>(null);
  const [elementosSelecionados, setElementosSelecionados] = useState<CertificadoElemento[]>([]);
  const [clipboardEls, setClipboardEls]                   = useState<CertificadoElemento[]>([]);
  const [statusMensagem, setStatusMensagem]               = useState('');
  const [novoNome, setNovoNome]                           = useState('');
  const [novoCategoria, setNovoCategoria]                 = useState('ministerial');
  const [renomearId, setRenomearId]                       = useState<string | null>(null);
  const [renomearNome, setRenomearNome]                   = useState('');
  const [confirmDeleteId, setConfirmDeleteId]             = useState<string | null>(null);

  const mostrarStatus = (msg: string) => {
    setStatusMensagem(msg);
    setTimeout(() => setStatusMensagem(''), 3000);
  };

  useEffect(() => {
    if (loading) return;
    setLoadingData(true);
    (async () => {
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      const res = await loadCertificadosTemplatesForCurrentUser(supabase);
      setTemplates(res.templates as CertificadoTemplate[]);
      setTemplateEmEdicao(res.templates[0] as CertificadoTemplate ?? null);
      setLoadingData(false);
    })();
  }, [loading, supabase]);

  /* ---------- mutacoes de template ---------- */

  const salvarTodos = async (prox: CertificadoTemplate[]) => {
    setTemplates(prox);
    if (ministryId) {
      await persistCertificadosTemplatesSnapshotToSupabase(supabase, ministryId, prox as any[]);
    }
  };

  const handleCriarNovo = async () => {
    const nome = novoNome.trim() || `Modelo ${templates.length + 1}`;
    const tmpl = novoTemplateEmBranco(nome, novoCategoria);
    const prox = [...templates, tmpl];
    await salvarTodos(prox);
    setTemplateEmEdicao(tmpl);
    setNovoNome('');
    setNovoCategoria('ministerial');
    mostrarStatus(`Modelo "${nome}" criado.`);
  };

  const handleSalvar = async () => {
    if (!templateEmEdicao || !ministryId) return;
    const payload = {
      ...templateEmEdicao,
      categoria: (templateEmEdicao.categoria || 'ministerial') as any,
    };
    const prox = templates.map((t) => (t.id === templateEmEdicao.id ? payload : t));
    await salvarTodos(prox);
    mostrarStatus('Modelo salvo com sucesso.');
  };

  const handleRenomear = async (id: string) => {
    const nome = renomearNome.trim();
    if (!nome) return;
    const prox = templates.map((t) => (t.id === id ? { ...t, nome } : t));
    await salvarTodos(prox);
    if (templateEmEdicao?.id === id) setTemplateEmEdicao((prev) => prev ? { ...prev, nome } : prev);
    setRenomearId(null);
    mostrarStatus('Modelo renomeado.');
  };

  const handleDeletar = async (id: string) => {
    const prox = templates.filter((t) => t.id !== id);
    await salvarTodos(prox);
    if (templateEmEdicao?.id === id) {
      setTemplateEmEdicao(prox[0] ?? null);
    }
    setConfirmDeleteId(null);
    mostrarStatus('Modelo excluido.');
  };

  const handleSelect = (t: CertificadoTemplate) => {
    setTemplateEmEdicao(t);
    setElementoSelecionado(null);
    setElementosSelecionados([]);
  };

  const currentCategoria = templateEmEdicao?.categoria || 'ministerial';
  const placeholdersAtivos = getCertificadoPlaceholders(currentCategoria);

  /* ---------- canvas helpers ---------- */

  const updateEl = (id: string, props: Partial<CertificadoElemento>) => {
    if (!templateEmEdicao) return;
    setTemplateEmEdicao({
      ...templateEmEdicao,
      elementos: templateEmEdicao.elementos.map((el) =>
        el.id === id ? { ...el, ...props } : el
      ),
    });
    // Mantém elementoSelecionado sincronizado para o painel não ficar com dados velhos
    setElementoSelecionado((prev) => prev?.id === id ? { ...prev, ...props } : prev);
    setElementosSelecionados((prev) => prev.map((el) => el.id === id ? { ...el, ...props } : el));
  };

  const updateMultiplos = (
    items: Array<{ id: string; propriedades: Partial<CertificadoElemento> }>
  ) => {
    if (!templateEmEdicao) return;
    const mapa = new Map(items.map((i) => [i.id, i.propriedades]));
    setTemplateEmEdicao({
      ...templateEmEdicao,
      elementos: templateEmEdicao.elementos.map((el) =>
        mapa.has(el.id) ? { ...el, ...mapa.get(el.id) } : el
      ),
    });
  };

  const handleAddEl = (tipo: CertificadoElemento['tipo']) => {
    if (!templateEmEdicao) return;
    const base: CertificadoElemento = {
      id: gId(),
      tipo,
      x: 40,
      y: 40,
      largura: tipo === 'logo' ? 90 : tipo === 'imagem' ? 160 : tipo === 'chapa' ? 200 : 320,
      altura:  tipo === 'logo' ? 90 : tipo === 'imagem' ? 120 : tipo === 'chapa' ? 40  : 40,
      fontSize: 16,
      cor: '#111827',
      fonte: 'Arial',
      alinhamento: 'left',
      visivel: true,
      texto: tipo === 'texto' ? 'Texto do certificado' : undefined,
    };
    setTemplateEmEdicao({
      ...templateEmEdicao,
      elementos: [...templateEmEdicao.elementos, base],
    });
    setElementoSelecionado(base);
    setElementosSelecionados([base]);
  };

  const handleAddEls = (novos: CertificadoElemento[]) => {
    if (!templateEmEdicao) return;
    setTemplateEmEdicao({
      ...templateEmEdicao,
      elementos: [...templateEmEdicao.elementos, ...novos],
    });
    setElementosSelecionados(novos);
    setElementoSelecionado(novos[0] ?? null);
  };

  const handleCopiar = () => {
    const selecionados = elementosSelecionados.length > 0
      ? elementosSelecionados
      : elementoSelecionado ? [elementoSelecionado] : [];
    if (selecionados.length > 0)
      setClipboardEls(selecionados.map((el) => ({ ...el, locked: false })));
  };

  const handleColar = () => {
    if (!templateEmEdicao || clipboardEls.length === 0) return;
    const offset = 15;
    const copias: CertificadoElemento[] = clipboardEls.map((el) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
      locked: false,
      x: Math.min(el.x + offset, CERTIFICADO_CANVAS.largura - el.largura),
      y: Math.min(el.y + offset, CERTIFICADO_CANVAS.altura - el.altura),
    }));
    handleAddEls(copias);
  };

  const handleRemoveEl = (elId: string) => {
    if (!templateEmEdicao) return;
    setTemplateEmEdicao({
      ...templateEmEdicao,
      elementos: templateEmEdicao.elementos.filter((el) => el.id !== elId),
    });
    if (elementoSelecionado?.id === elId) setElementoSelecionado(null);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !templateEmEdicao) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      // Redimensiona a imagem para exatamente o tamanho do canvas (cover)
      const img = new Image();
      img.onload = () => {
        const cW = CERTIFICADO_CANVAS.largura;
        const cH = CERTIFICADO_CANVAS.altura;
        const canvas = document.createElement('canvas');
        canvas.width = cW;
        canvas.height = cH;
        const ctx = canvas.getContext('2d')!;
        // Estica para preencher o canvas inteiro (sem cortes, sem espaços)
        ctx.drawImage(img, 0, 0, cW, cH);
        const resized = canvas.toDataURL('image/jpeg', 0.92);
        setTemplateEmEdicao((prev) => prev ? { ...prev, backgroundUrl: resized } : prev);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !elementoSelecionado) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateEl(elementoSelecionado.id, { imagemUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Modelos de Certificado</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Crie e edite modelos que ficam disponiveis em Secretaria / Certificados
            </p>
          </div>
          {statusMensagem && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">
              {statusMensagem}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex">

          {/* Painel esquerdo: lista de modelos */}
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Novo Modelo</p>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nome do modelo"
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCriarNovo()}
                />
                <div className="flex gap-2">
                  <select
                    className="flex-1 border rounded px-2 py-1.5 text-xs"
                    value={novoCategoria}
                    onChange={(e) => setNovoCategoria(e.target.value)}
                  >
                    {CERTIFICADO_CATEGORIAS.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCriarNovo}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {templates.length === 0 && (
                <p className="text-xs text-gray-400 text-center mt-6">
                  Nenhum modelo ainda.<br />Crie o primeiro acima.
                </p>
              )}
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-lg border p-3 cursor-pointer transition group ${
                    templateEmEdicao?.id === t.id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelect(t)}
                >
                  {/* miniatura */}
                  <div
                    className="w-full h-14 rounded mb-2 overflow-hidden"
                    style={
                      t.backgroundUrl
                        ? { backgroundImage: `url(${t.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { background: 'linear-gradient(135deg,#dbeafe,#eef2ff)' }
                    }
                  >
                    <div className="w-full h-full flex items-center justify-center text-white text-xs opacity-60">
                      {t.elementos.length === 0 ? 'Em branco' : `${t.elementos.length} elem.`}
                    </div>
                  </div>

                  {renomearId === t.id ? (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        className="flex-1 border rounded px-1 py-0.5 text-xs"
                        value={renomearNome}
                        onChange={(e) => setRenomearNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenomear(t.id);
                          if (e.key === 'Escape') setRenomearId(null);
                        }}
                      />
                      <button className="text-xs text-blue-600 font-semibold" onClick={() => handleRenomear(t.id)}>OK</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-gray-800 truncate flex-1">{t.nome}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Renomear"
                          className="text-gray-400 hover:text-blue-500 text-xs px-1"
                          onClick={() => { setRenomearId(t.id); setRenomearNome(t.nome); }}
                        >&#9998;</button>
                        {confirmDeleteId === t.id ? (
                          <>
                            <button className="text-xs text-red-600 font-semibold" onClick={() => handleDeletar(t.id)}>Sim</button>
                            <button className="text-xs text-gray-500" onClick={() => setConfirmDeleteId(null)}>Nao</button>
                          </>
                        ) : (
                          <button
                            title="Excluir"
                            className="text-gray-400 hover:text-red-500 text-xs px-1"
                            onClick={() => setConfirmDeleteId(t.id)}
                          >&#10005;</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Area central: canvas */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!templateEmEdicao ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm">
                <p className="text-4xl mb-3">+</p>
                <p>Crie um modelo no painel esquerdo para comecar.</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow border border-gray-200 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{templateEmEdicao.nome}</h3>
                      <p className="text-xs text-gray-400">{templateEmEdicao.elementos.length} elemento(s) no canvas</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">Categoria</span>
                      <select
                        value={templateEmEdicao.categoria || 'ministerial'}
                        onChange={(e) =>
                          setTemplateEmEdicao((prev) =>
                            prev
                              ? { ...prev, categoria: e.target.value as any }
                              : prev
                          )
                        }
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs"
                      >
                        {CERTIFICADO_CATEGORIAS.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        title="Exportar JSON do modelo"
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm flex items-center gap-1"
                        onClick={() => {
                          const payload = {
                            name: templateEmEdicao.nome,
                            template_key: templateEmEdicao.chave,
                            categoria: templateEmEdicao.categoria || 'ministerial',
                            template_data: {
                              elementos: templateEmEdicao.elementos,
                              backgroundUrl: templateEmEdicao.backgroundUrl,
                            },
                          };
                          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${templateEmEdicao.chave || 'template'}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4" /> Exportar JSON
                      </button>
                      <button
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
                        onClick={() => backgroundInputRef.current?.click()}
                      >
                        Imagem de Fundo
                      </button>
                      {templateEmEdicao.backgroundUrl && (
                        <button
                          className="px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 text-sm"
                          onClick={() => setTemplateEmEdicao({ ...templateEmEdicao, backgroundUrl: undefined })}
                        >
                          Remover Fundo
                        </button>
                      )}
                      <button
                        className="px-4 py-1.5 bg-[#123b63] text-white rounded hover:bg-[#0f2a45] text-sm font-semibold shadow"
                        onClick={handleSalvar}
                      >
                        Salvar Modelo
                      </button>
                    </div>
                  </div>

                  <div className="w-full flex justify-center bg-gray-100 rounded-lg p-2">
                    <div
                      ref={canvasWrapperRef}
                      className="rounded-lg border overflow-hidden"
                      style={{
                        width: '100%',
                        maxWidth: `${CERTIFICADO_CANVAS.largura}px`,
                        height: `${CERTIFICADO_CANVAS.altura * canvasScale}px`,
                      }}
                    >
                    <div
                      style={{
                        transform: `scale(${canvasScale})`,
                        transformOrigin: 'top left',
                        width: `${CERTIFICADO_CANVAS.largura}px`,
                        height: `${CERTIFICADO_CANVAS.altura}px`,
                      }}
                    >
                      <InteractiveCanvas
                        elementos={templateEmEdicao.elementos}
                        elementoSelecionado={elementoSelecionado}
                        elementosSelecionados={elementosSelecionados}
                        onElementoSelecionado={setElementoSelecionado}
                        onElementosSelecionados={setElementosSelecionados}
                        onElementoAtualizado={updateEl}
                        onMultiplosElementosAtualizados={updateMultiplos}
                        onElementoRemovido={handleRemoveEl}
                        onElementosAdicionados={handleAddEls}
                        getPreviewText={(texto) => obterPreviewTextoCertificado(texto, currentCategoria)}
                        backgroundUrl={templateEmEdicao.backgroundUrl}
                        larguraCanvas={CERTIFICADO_CANVAS.largura}
                        alturaCanvas={CERTIFICADO_CANVAS.altura}
                      />
                    </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Painel direito: ferramentas */}
          <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-2">Adicionar Elemento</h3>
              <div className="grid grid-cols-2 gap-2">
                {ELEMENTOS_TIPOS.map((el) => (
                  <button
                    key={el.tipo}
                    onClick={() => handleAddEl(el.tipo as CertificadoElemento['tipo'])}
                    disabled={!templateEmEdicao}
                    className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-xl bg-white hover:border-[#123b63] hover:bg-[#123b63]/5 transition disabled:opacity-40 text-gray-700"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#123b63]/10 text-[#123b63]">
                      {el.icone}
                    </span>
                    <span className="text-xs font-semibold">{el.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <hr />

            {/* Elemento selecionado */}
            <div>
              <h4 className="text-sm font-bold text-gray-800 mb-2">Elemento Selecionado</h4>
              {!elementoSelecionado && (
                <p className="text-xs text-gray-400">Clique em um elemento no canvas.</p>
              )}
              {elementoSelecionado && (
                <div className="space-y-3">
                  {elementoSelecionado.tipo === 'texto' && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Texto</label>
                      <textarea
                        className="mt-1 w-full border rounded px-2 py-1 text-xs"
                        rows={3}
                        value={elementoSelecionado.texto || ''}
                        onChange={(e) => updateEl(elementoSelecionado.id, { texto: e.target.value })}
                      />
                    </div>
                  )}
                  {/* Fonte */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Fonte</label>
                    <select
                      key={elementoSelecionado.id + '_fonte'}
                      className="mt-1 w-full border rounded px-2 py-1 text-xs"
                      value={elementoSelecionado.fonte || 'Arial'}
                      onChange={(e) => updateEl(elementoSelecionado.id, { fonte: e.target.value })}
                    >
                      {FONTES_DISPONIVEIS.map((f) => (
                        <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tamanho + Cor */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Tamanho</label>
                      <input
                        key={elementoSelecionado.id + '_size'}
                        type="number"
                        min={6} max={200}
                        className="mt-1 w-full border rounded px-2 py-1 text-xs"
                        value={elementoSelecionado.fontSize ?? 16}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (v >= 6 && v <= 200) updateEl(elementoSelecionado.id, { fontSize: v });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Cor</label>
                      <input
                        type="color"
                        className="mt-1 w-full border rounded h-8 cursor-pointer"
                        value={elementoSelecionado.cor || '#111827'}
                        onChange={(e) => updateEl(elementoSelecionado.id, { cor: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Formatação: B / I / U + Alinhamento */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Formatação</label>
                    <div className="flex gap-1">
                      {/* Negrito */}
                      <button
                        title="Negrito"
                        onClick={() => updateEl(elementoSelecionado.id, { negrito: !elementoSelecionado.negrito })}
                        className={`flex items-center justify-center w-8 h-8 rounded border text-xs transition ${
                          elementoSelecionado.negrito
                            ? 'bg-[#123b63] text-white border-[#123b63]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      {/* Itálico */}
                      <button
                        title="Itálico"
                        onClick={() => updateEl(elementoSelecionado.id, { italico: !elementoSelecionado.italico })}
                        className={`flex items-center justify-center w-8 h-8 rounded border text-xs transition ${
                          elementoSelecionado.italico
                            ? 'bg-[#123b63] text-white border-[#123b63]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      {/* Sublinhado */}
                      <button
                        title="Sublinhado"
                        onClick={() => updateEl(elementoSelecionado.id, { sublinhado: !elementoSelecionado.sublinhado })}
                        className={`flex items-center justify-center w-8 h-8 rounded border text-xs transition ${
                          elementoSelecionado.sublinhado
                            ? 'bg-[#123b63] text-white border-[#123b63]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <Underline className="h-3.5 w-3.5" />
                      </button>
                      <div className="w-px bg-gray-200 mx-1" />
                      {/* Alinhar esquerda */}
                      <button
                        title="Alinhar à esquerda"
                        onClick={() => updateEl(elementoSelecionado.id, { alinhamento: 'left' })}
                        className={`flex items-center justify-center w-8 h-8 rounded border text-xs transition ${
                          (elementoSelecionado.alinhamento || 'left') === 'left'
                            ? 'bg-[#123b63] text-white border-[#123b63]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <AlignLeft className="h-3.5 w-3.5" />
                      </button>
                      {/* Centralizar */}
                      <button
                        title="Centralizar"
                        onClick={() => updateEl(elementoSelecionado.id, { alinhamento: 'center' })}
                        className={`flex items-center justify-center w-8 h-8 rounded border text-xs transition ${
                          elementoSelecionado.alinhamento === 'center'
                            ? 'bg-[#123b63] text-white border-[#123b63]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <AlignCenter className="h-3.5 w-3.5" />
                      </button>
                      {/* Alinhar direita */}
                      <button
                        title="Alinhar à direita"
                        onClick={() => updateEl(elementoSelecionado.id, { alinhamento: 'right' })}
                        className={`flex items-center justify-center w-8 h-8 rounded border text-xs transition ${
                          elementoSelecionado.alinhamento === 'right'
                            ? 'bg-[#123b63] text-white border-[#123b63]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <AlignRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {(elementoSelecionado.tipo === 'imagem' || elementoSelecionado.tipo === 'logo') && (
                    <button
                      className="w-full px-3 py-1.5 border rounded text-xs text-gray-700 hover:bg-gray-50"
                      onClick={() => imagemInputRef.current?.click()}
                    >
                      Enviar Imagem
                    </button>
                  )}

                  {elementoSelecionado.tipo === 'chapa' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Cor</label>
                        <input
                          type="color"
                          className="mt-1 w-full border rounded h-8"
                          value={elementoSelecionado.cor || '#ef4444'}
                          onChange={(e) => updateEl(elementoSelecionado.id, { cor: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Opacidade</label>
                        <input
                          type="number"
                          min="0" max="1" step="0.05"
                          className="mt-1 w-full border rounded px-2 py-1 text-xs"
                          value={elementoSelecionado.transparencia ?? 1}
                          onChange={(e) => updateEl(elementoSelecionado.id, { transparencia: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Copiar / Colar */}
                  <div className="flex gap-2">
                    <button
                      title="Copiar elemento (Ctrl+C)"
                      onClick={handleCopiar}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-50 transition"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </button>
                    <button
                      title="Colar elemento (Ctrl+V)"
                      onClick={handleColar}
                      disabled={clipboardEls.length === 0}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                    >
                      <Clipboard className="h-3.5 w-3.5" /> Colar
                    </button>
                  </div>

                  <button
                    className="w-full py-1.5 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50 transition"
                    onClick={() => handleRemoveEl(elementoSelecionado.id)}
                  >
                    Remover Elemento
                  </button>
                </div>
              )}
            </div>

            <hr />

            {/* Placeholders */}
            <div>
              <h4 className="text-sm font-bold text-gray-800 mb-2">Variaveis Disponiveis</h4>
              <ul className="text-xs text-gray-500 space-y-1">
                {placeholdersAtivos.map((ph) => (
                  <li key={ph.placeholder} className="flex items-center gap-1">
                    <code className="bg-gray-100 px-1 rounded">{ph.placeholder}</code>
                    <span>{ph.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <input ref={backgroundInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
      <input ref={imagemInputRef} type="file" accept="image/*" className="hidden" onChange={handleImgUpload} />
    </div>
  );
}
