'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Eye,
  Edit3,
  Save,
  Loader2,
  Bold,
  Italic,
  Underline,
  List,
  RemoveFormatting,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Image as ImageIcon,
  Building2,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';
import {
  paginateDepartmentsForRevista,
  type PalavraPastorEdicao,
  type DepartamentoRevistaPublico,
  type DepartamentosEdicaoConfig,
} from '@/lib/revista-digital-utils';

interface PersonalizarRevistaModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultYear?: number;
}

export default function PersonalizarRevistaModal({
  isOpen,
  onClose,
  defaultYear = new Date().getFullYear(),
}: PersonalizarRevistaModalProps) {
  const [activeTab, setActiveTab] = useState<'palavra' | 'departamentos'>('palavra');
  const [ano, setAno] = useState<number>(defaultYear);
  const [titulo, setTitulo] = useState<string>('Palavra do Pastor');
  const [conteudoHtml, setConteudoHtml] = useState<string>('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [nomePastor, setNomePastor] = useState<string>('');
  const [nomeEsposa, setNomeEsposa] = useState<string>('');
  const [assinatura, setAssinatura] = useState<string>('');
  const [publicada, setPublicada] = useState<boolean>(true);

  // Estado da aba Departamentos
  const [depPublicada, setDepPublicada] = useState<boolean>(false);
  const [depTitulo, setDepTitulo] = useState<string>('Nossos Departamentos');
  const [depSubtitulo, setDepSubtitulo] = useState<string>('Conheça os ministérios e lideranças da nossa igreja');
  const [depIdsSelecionados, setDepIdsSelecionados] = useState<string[]>([]);
  const [depsDisponiveis, setDepsDisponiveis] = useState<DepartamentoRevistaPublico[]>([]);
  const [draggedDepId, setDraggedDepId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const anosDisponiveis = [
    defaultYear - 1,
    defaultYear,
    defaultYear + 1,
    defaultYear + 2,
  ];

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setFeedback(null);

    authenticatedFetch(`/api/v1/agenda/revista-personalizacao?ano=${ano}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao carregar dados da edição.');
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        const ed: PalavraPastorEdicao | null = json?.edicao || null;
        const disponiveis: DepartamentoRevistaPublico[] = Array.isArray(json?.departamentos_disponiveis)
          ? json.departamentos_disponiveis
          : [];
        setDepsDisponiveis(disponiveis);

        const depCfg: DepartamentosEdicaoConfig | null = json?.departamentos_config || null;
        if (depCfg) {
          setDepPublicada(Boolean(depCfg.publicada));
          setDepTitulo(depCfg.titulo || 'Nossos Departamentos');
          setDepSubtitulo(depCfg.subtitulo ?? 'Conheça os ministérios e lideranças da nossa igreja');
          setDepIdsSelecionados(Array.isArray(depCfg.departamento_ids) ? depCfg.departamento_ids : []);
        } else {
          setDepPublicada(false);
          setDepTitulo('Nossos Departamentos');
          setDepSubtitulo('Conheça os ministérios e lideranças da nossa igreja');
          setDepIdsSelecionados([]);
        }

        if (ed) {
          setTitulo(ed.titulo || 'Palavra do Pastor');
          setConteudoHtml(ed.conteudo_html || '');
          setFotoUrl(ed.foto_url || null);
          setNomePastor(ed.nome_pastor || '');
          setNomeEsposa(ed.nome_esposa || '');
          setAssinatura(ed.assinatura || '');
          setPublicada(Boolean(ed.publicada));
          if (editorRef.current) {
            editorRef.current.innerHTML = ed.conteudo_html || '';
          }
        } else {
          setTitulo('Palavra do Pastor');
          setConteudoHtml('');
          setFotoUrl(null);
          setNomePastor('');
          setNomeEsposa('');
          setAssinatura('');
          setPublicada(true);
          if (editorRef.current) {
            editorRef.current.innerHTML = '';
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setFeedback({ tipo: 'err', texto: err?.message || 'Falha ao carregar edição.' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, ano]);

  const execFormat = (command: string) => {
    if (typeof document === 'undefined') return;
    document.execCommand(command, false);
    if (editorRef.current) {
      setConteudoHtml(editorRef.current.innerHTML);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ano', String(ano));

      const res = await authenticatedFetch('/api/v1/agenda/revista-personalizacao', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Erro ao enviar fotografia.');
      }

      setFotoUrl(json.url);
      setFeedback({ tipo: 'ok', texto: 'Fotografia oficial enviada com sucesso!' });
    } catch (err: any) {
      setFeedback({ tipo: 'err', texto: err?.message || 'Falha no upload da imagem.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleDepartamento = (id: string) => {
    setDepIdsSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const moveDepartamento = (id: string, direction: 'up' | 'down') => {
    setDepIdsSelecionados((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, removed);
      return copy;
    });
  };

  const handleDropDepartamento = (targetId: string) => {
    if (!draggedDepId || draggedDepId === targetId) return;
    setDepIdsSelecionados((prev) => {
      const fromIdx = prev.indexOf(draggedDepId);
      const toIdx = prev.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const copy = [...prev];
      const [removed] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, removed);
      return copy;
    });
    setDraggedDepId(null);
  };

  const depsSelecionadosOrdenados: DepartamentoRevistaPublico[] = depIdsSelecionados
    .map((id) => depsDisponiveis.find((d) => d.id === id))
    .filter((d): d is DepartamentoRevistaPublico => Boolean(d));

  const depPreviewPages = paginateDepartmentsForRevista(depsSelecionadosOrdenados, 4);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      let payload: Record<string, any>;

      if (activeTab === 'departamentos') {
        payload = {
          tipo: 'departamentos',
          ano,
          departamentos: {
            publicada: depPublicada,
            titulo: depTitulo.trim() || 'Nossos Departamentos',
            subtitulo: depSubtitulo.trim(),
            departamento_ids: depIdsSelecionados,
          },
        };
      } else {
        const htmlAtual = editorRef.current ? editorRef.current.innerHTML : conteudoHtml;
        setConteudoHtml(htmlAtual);
        payload = {
          tipo: 'palavra_pastor',
          ano,
          titulo: titulo.trim() || 'Palavra do Pastor',
          conteudo_html: htmlAtual,
          foto_url: fotoUrl,
          nome_pastor: nomePastor.trim(),
          nome_esposa: nomeEsposa.trim(),
          assinatura: assinatura.trim(),
          publicada,
        };
      }

      const res = await authenticatedFetch('/api/v1/agenda/revista-personalizacao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Erro ao salvar personalização.');
      }

      setFeedback({
        tipo: 'ok',
        texto: `${activeTab === 'departamentos' ? 'Departamentos' : 'Palavra do Pastor'} da edição ${ano} salvo com sucesso!`,
      });
    } catch (err: any) {
      setFeedback({ tipo: 'err', texto: err?.message || 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-800 to-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight">
                Personalizar Revista Digital
              </h2>
              <p className="text-xs text-teal-200">
                Gerenciamento da Palavra do Pastor (2ª Página Oficial) por edição anual
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode((p) => !p)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{previewMode ? 'Voltar à Edição' : 'Pré-visualizar Página'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas de Personalização */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('palavra'); setPreviewMode(false); setFeedback(null); }}
            className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'palavra'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Palavra do Pastor</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('departamentos'); setPreviewMode(false); setFeedback(null); }}
            className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'departamentos'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departamentos</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                feedback.tipo === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {feedback.tipo === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.texto}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
              <span className="text-xs font-medium">Carregando edição {ano}...</span>
            </div>
          ) : activeTab === 'departamentos' ? (
            previewMode ? (
              /* ─── PRÉ-VISUALIZAÇÃO: NOSSOS DEPARTAMENTOS ─────────────── */
              <div className="space-y-6 max-w-3xl mx-auto">
                {depPreviewPages.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500 text-sm">
                    Nenhum departamento selecionado para pré-visualização.
                  </div>
                ) : (
                  depPreviewPages.map((chunk, pIdx) => (
                    <div key={pIdx} className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-700">
                            Edição {ano} • Seção Institucional
                          </span>
                          <h3 className="text-xl font-serif font-bold text-slate-900">
                            {depTitulo || 'Nossos Departamentos'}
                          </h3>
                          {depSubtitulo && (
                            <p className="text-xs text-slate-500 mt-0.5">{depSubtitulo}</p>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-400">
                          Página {pIdx + 1} de {depPreviewPages.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {chunk.map((dep) => (
                          <div key={dep.id} className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              {dep.logo_url ? (
                                <img
                                  src={dep.logo_url}
                                  alt={dep.sigla || dep.nome}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-teal-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                                  {(dep.sigla || dep.nome.slice(0, 3)).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                {dep.sigla && (
                                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-100 text-teal-800 mb-0.5">
                                    {dep.sigla}
                                  </span>
                                )}
                                <h4 className="text-sm font-bold text-slate-900 leading-snug">{dep.nome}</h4>
                              </div>
                            </div>

                            {dep.lideranca.length > 0 && (
                              <div className="border-t border-slate-200/70 pt-2.5 space-y-1">
                                {dep.lideranca.map((lid, lIdx) => (
                                  <div key={lIdx} className="text-xs flex items-baseline justify-between gap-2">
                                    <span className="text-slate-500 font-medium shrink-0">{lid.cargo}:</span>
                                    <span className="text-slate-800 font-semibold text-right truncate">{lid.nome}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* ─── FORMULÁRIO: DEPARTAMENTOS ──────────────────────────── */
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ano da Edição Anual
                    </label>
                    <select
                      value={ano}
                      onChange={(e) => setAno(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      {anosDisponiveis.map((y) => (
                        <option key={y} value={y}>
                          Edição {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-5">
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-bold text-slate-800">Exibição Pública</p>
                      <p className="text-[11px] text-slate-500">
                        Exibir seção na Revista {ano}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDepPublicada((p) => !p)}
                      className={`w-12 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                        depPublicada ? 'bg-teal-600' : 'bg-slate-300'
                      }`}
                      aria-pressed={depPublicada}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          depPublicada ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Título da Seção
                    </label>
                    <input
                      type="text"
                      value={depTitulo}
                      onChange={(e) => setDepTitulo(e.target.value)}
                      placeholder="Nossos Departamentos"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Subtítulo da Seção
                    </label>
                    <input
                      type="text"
                      value={depSubtitulo}
                      onChange={(e) => setDepSubtitulo(e.target.value)}
                      placeholder="Conheça os ministérios e lideranças da nossa igreja"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Lista de Departamentos Ativos da Secretaria */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Departamentos Ativos (Secretaria)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Selecione quais departamentos serão exibidos na revista.
                      </p>
                    </div>
                    {depsDisponiveis.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4">
                        Nenhum departamento ativo cadastrado em Secretaria &gt; Departamentos.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {depsDisponiveis.map((dep) => {
                          const checked = depIdsSelecionados.includes(dep.id);
                          return (
                            <label
                              key={dep.id}
                              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                                checked
                                  ? 'bg-teal-50/70 border-teal-300'
                                  : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDepartamento(dep.id)}
                                className="rounded text-teal-700 focus:ring-teal-500"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 truncate">
                                  {dep.sigla ? `${dep.sigla} — ` : ''}{dep.nome}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {dep.lideranca.length} integrante(s) na liderança
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Ordenação por Arraste */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Ordem de Apresentação ({depsSelecionadosOrdenados.length} selecionado(s))
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Arraste os itens para definir a ordem na revista (até 4 por página).
                      </p>
                    </div>
                    {depsSelecionadosOrdenados.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4">
                        Selecione departamentos ao lado para ordenar.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {depsSelecionadosOrdenados.map((dep, idx) => (
                          <div
                            key={dep.id}
                            draggable
                            onDragStart={() => setDraggedDepId(dep.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropDepartamento(dep.id)}
                            className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white cursor-grab active:cursor-grabbing transition"
                          >
                            <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-[10px] font-mono font-bold text-teal-700 w-5">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 truncate flex-1">
                              {dep.sigla ? `${dep.sigla} — ` : ''}{dep.nome}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveDepartamento(dep.id, 'up')}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                title="Mover para cima"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveDepartamento(dep.id, 'down')}
                                disabled={idx === depsSelecionadosOrdenados.length - 1}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                title="Mover para baixo"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : previewMode ? (
            /* ─── PRÉ-VISUALIZAÇÃO DA 2ª PÁGINA ──────────────────────── */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-10 max-w-3xl mx-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <span className="text-[11px] font-bold uppercase tracking-widest text-teal-700">
                  Edição {ano} • Página 2
                </span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    publicada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {publicada ? 'Visível na Revista Pública' : 'Oculta (Rascunho)'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {fotoUrl && (
                  <div className="md:col-span-5">
                    <div className="rounded-2xl overflow-hidden border-4 border-teal-50 shadow-md bg-slate-100">
                      <img
                        src={fotoUrl}
                        alt="Pastor e Esposa"
                        className="w-full h-auto object-cover aspect-[4/5]"
                      />
                    </div>
                  </div>
                )}

                <div className={fotoUrl ? 'md:col-span-7 space-y-4' : 'md:col-span-12 space-y-4'}>
                  <h3 className="text-2xl font-serif font-bold text-slate-900">
                    {titulo || 'Palavra do Pastor'}
                  </h3>

                  <div
                    className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: conteudoHtml || '<p class="text-slate-400 italic">Nenhum texto inserido.</p>',
                    }}
                  />

                  {(nomePastor || nomeEsposa || assinatura) && (
                    <div className="pt-4 border-t border-slate-100 mt-6">
                      {(nomePastor || nomeEsposa) && (
                        <p className="text-sm font-bold text-slate-900">
                          {nomePastor}
                          {nomePastor && nomeEsposa ? ' & ' : ''}
                          {nomeEsposa}
                        </p>
                      )}
                      {assinatura && (
                        <p className="text-xs text-teal-700 font-medium mt-0.5">{assinatura}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ─── FORMULÁRIO DE EDIÇÃO ──────────────────────────────── */
            <div className="space-y-5">
              {/* Linha 1: Ano e Controle de Exibição Pública */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ano da Edição Anual
                  </label>
                  <select
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    {anosDisponiveis.map((y) => (
                      <option key={y} value={y}>
                        Edição {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-5">
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-bold text-slate-800">Exibição Pública</p>
                    <p className="text-[11px] text-slate-500">
                      Exibir como 2ª página da Revista {ano}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublicada((p) => !p)}
                    className={`w-12 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                      publicada ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                    aria-pressed={publicada}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        publicada ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Linha 2: Fotografia Oficial + Título e Nomes */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Foto */}
                <div className="md:col-span-4 bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-between gap-3">
                  <div className="w-full text-left">
                    <label className="block text-xs font-bold text-slate-700">
                      Fotografia Oficial (Pastor e Esposa)
                    </label>
                    <p className="text-[11px] text-slate-500">JPG, PNG ou WEBP até 2MB</p>
                  </div>

                  <div className="w-full aspect-[4/5] rounded-xl bg-slate-100 border border-dashed border-slate-300 overflow-hidden flex items-center justify-center relative">
                    {fotoUrl ? (
                      <img src={fotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4 text-slate-400">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-60" />
                        <span className="text-[11px]">Sem fotografia</span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  <div className="w-full flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-1 px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                    >
                      {uploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{fotoUrl ? 'Substituir Foto' : 'Enviar Foto'}</span>
                    </button>
                    {fotoUrl && (
                      <button
                        type="button"
                        onClick={() => setFotoUrl(null)}
                        className="px-2.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
                        title="Remover foto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Campos de Texto */}
                <div className="md:col-span-8 bg-white p-4 rounded-xl border border-slate-200 space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Título da Mensagem
                    </label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Palavra do Pastor"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome do Pastor
                      </label>
                      <input
                        type="text"
                        value={nomePastor}
                        onChange={(e) => setNomePastor(e.target.value)}
                        placeholder="Ex: Pr. João Silva"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome da Esposa
                      </label>
                      <input
                        type="text"
                        value={nomeEsposa}
                        onChange={(e) => setNomeEsposa(e.target.value)}
                        placeholder="Ex: Pra. Maria Silva"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Assinatura ou Identificação Pastoral
                    </label>
                    <input
                      type="text"
                      value={assinatura}
                      onChange={(e) => setAssinatura(e.target.value)}
                      placeholder="Ex: Pastor Presidente — Assembleia de Deus"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  {/* Editor de Texto Rico */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mensagem Pastoral
                    </label>
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 border-b border-slate-200 px-2 py-1.5 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => execFormat('bold')}
                          className="p-1.5 rounded hover:bg-white text-slate-700 transition cursor-pointer"
                          title="Negrito"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => execFormat('italic')}
                          className="p-1.5 rounded hover:bg-white text-slate-700 transition cursor-pointer"
                          title="Itálico"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => execFormat('underline')}
                          className="p-1.5 rounded hover:bg-white text-slate-700 transition cursor-pointer"
                          title="Sublinhado"
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => execFormat('insertUnorderedList')}
                          className="p-1.5 rounded hover:bg-white text-slate-700 transition cursor-pointer"
                          title="Lista"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => execFormat('removeFormat')}
                          className="p-1.5 rounded hover:bg-white text-slate-700 transition cursor-pointer ml-auto"
                          title="Limpar formatação"
                        >
                          <RemoveFormatting className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setConteudoHtml((e.target as HTMLDivElement).innerHTML)}
                        className="min-h-[160px] max-h-[260px] overflow-y-auto p-3 text-sm text-slate-800 bg-white outline-none prose prose-sm max-w-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Salvar Edição {ano}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
