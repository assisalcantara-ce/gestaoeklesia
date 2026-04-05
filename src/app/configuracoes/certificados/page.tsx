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
  persistCertificadosTemplatesSnapshotToSupabase,
} from '@/lib/certificados-templates-sync';
import {
  CERTIFICADO_PLACEHOLDERS,
  obterPreviewTextoCertificado,
} from '@/lib/certificados-utils';

const CERTIFICADO_CANVAS = { largura: 840, altura: 595 };

const ELEMENTOS_TIPOS = [
  { tipo: 'texto',  label: 'Texto',  icone: 'T'   },
  { tipo: 'logo',   label: 'Logo',   icone: 'L'   },
  { tipo: 'imagem', label: 'Imagem', icone: 'IMG' },
  { tipo: 'chapa',  label: 'Chapa',  icone: 'CH'  },
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

const novoTemplateEmBranco = (nome: string): CertificadoTemplate => ({
  id: gId(),
  nome,
  orientacao: 'landscape',
  ativo: false,
  criado_pelo_usuario: true,
  elementos: [],
});

export default function ConfiguracoesCertificadosPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const imagemInputRef = useRef<HTMLInputElement>(null);

  const [activeMenu, setActiveMenu]       = useState('config-certificados');
  const [loadingData, setLoadingData]     = useState(true);
  const [ministryId, setMinistryId]       = useState<string | null>(null);

  const [templates, setTemplates]                         = useState<CertificadoTemplate[]>([]);
  const [templateEmEdicao, setTemplateEmEdicao]           = useState<CertificadoTemplate | null>(null);
  const [elementoSelecionado, setElementoSelecionado]     = useState<CertificadoElemento | null>(null);
  const [elementosSelecionados, setElementosSelecionados] = useState<CertificadoElemento[]>([]);
  const [statusMensagem, setStatusMensagem]               = useState('');
  const [novoNome, setNovoNome]                           = useState('');
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
    const tmpl = novoTemplateEmBranco(nome);
    const prox = [...templates, tmpl];
    await salvarTodos(prox);
    setTemplateEmEdicao(tmpl);
    setNovoNome('');
    mostrarStatus(`Modelo "${nome}" criado.`);
  };

  const handleSalvar = async () => {
    if (!templateEmEdicao || !ministryId) return;
    const prox = templates.map((t) => (t.id === templateEmEdicao.id ? templateEmEdicao : t));
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

  /* ---------- canvas helpers ---------- */

  const updateEl = (id: string, props: Partial<CertificadoElemento>) => {
    if (!templateEmEdicao) return;
    setTemplateEmEdicao({
      ...templateEmEdicao,
      elementos: templateEmEdicao.elementos.map((el) =>
        el.id === id ? { ...el, ...props } : el
      ),
    });
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
      setTemplateEmEdicao({ ...templateEmEdicao, backgroundUrl: ev.target?.result as string });
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
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome do modelo"
                  className="flex-1 border rounded px-2 py-1.5 text-sm"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCriarNovo()}
                />
                <button
                  onClick={handleCriarNovo}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition"
                >
                  +
                </button>
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
                    <div className="flex gap-2">
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

                  <div className="bg-white border rounded-lg p-2">
                    <InteractiveCanvas
                      elementos={templateEmEdicao.elementos}
                      elementoSelecionado={elementoSelecionado}
                      elementosSelecionados={elementosSelecionados}
                      onElementoSelecionado={setElementoSelecionado}
                      onElementosSelecionados={setElementosSelecionados}
                      onElementoAtualizado={updateEl}
                      onMultiplosElementosAtualizados={updateMultiplos}
                      onElementoRemovido={handleRemoveEl}
                      getPreviewText={obterPreviewTextoCertificado}
                      backgroundUrl={templateEmEdicao.backgroundUrl}
                      larguraCanvas={CERTIFICADO_CANVAS.largura}
                      alturaCanvas={CERTIFICADO_CANVAS.altura}
                    />
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
                    className="flex flex-col items-center gap-1 p-3 border rounded-lg hover:border-blue-400 hover:bg-blue-50 transition disabled:opacity-40 text-gray-700"
                  >
                    <span className="text-base font-bold">{el.icone}</span>
                    <span className="text-xs">{el.label}</span>
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Fonte</label>
                      <input
                        className="mt-1 w-full border rounded px-2 py-1 text-xs"
                        value={elementoSelecionado.fonte || 'Arial'}
                        onChange={(e) => updateEl(elementoSelecionado.id, { fonte: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Tamanho</label>
                      <input
                        type="number"
                        className="mt-1 w-full border rounded px-2 py-1 text-xs"
                        value={elementoSelecionado.fontSize || 16}
                        onChange={(e) => updateEl(elementoSelecionado.id, { fontSize: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Cor</label>
                      <input
                        type="color"
                        className="mt-1 w-full border rounded h-8"
                        value={elementoSelecionado.cor || '#111827'}
                        onChange={(e) => updateEl(elementoSelecionado.id, { cor: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Alinham.</label>
                      <select
                        className="mt-1 w-full border rounded px-2 py-1 text-xs"
                        value={elementoSelecionado.alinhamento || 'left'}
                        onChange={(e) => updateEl(elementoSelecionado.id, { alinhamento: e.target.value as any })}
                      >
                        <option value="left">Esq</option>
                        <option value="center">Centro</option>
                        <option value="right">Dir</option>
                      </select>
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

                  <div className="flex gap-2">
                    <button
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => updateEl(elementoSelecionado.id, { negrito: !elementoSelecionado.negrito })}
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => updateEl(elementoSelecionado.id, { italico: !elementoSelecionado.italico })}
                    >
                      <em>I</em>
                    </button>
                    <button
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                      onClick={() => updateEl(elementoSelecionado.id, { sublinhado: !elementoSelecionado.sublinhado })}
                    >
                      U
                    </button>
                    <button
                      className="ml-auto text-xs text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveEl(elementoSelecionado.id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              )}
            </div>

            <hr />

            {/* Placeholders */}
            <div>
              <h4 className="text-sm font-bold text-gray-800 mb-2">Variaveis Disponiveis</h4>
              <ul className="text-xs text-gray-500 space-y-1">
                {CERTIFICADO_PLACEHOLDERS.map((ph) => (
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
