'use client';

/**
 * /secretaria/midia/videos — Gestão Administrativa de Vídeos da Central de Mídia
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  isValidVideoUrl,
  CATEGORIAS_MIDIA_VIDEO,
  CATEGORIA_LABELS,
  CategoriaVideo,
} from '@/lib/midia-utils';
import {
  Video,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Calendar,
  User,
  Star,
  Play,
  Clock,
  ArrowLeft,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

interface MidiaVideo {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  evento_id: string | null;
  titulo: string;
  descricao: string | null;
  url_video: string;
  youtube_id: string | null;
  thumbnail_url: string | null;
  categoria: CategoriaVideo;
  autor_pregador: string | null;
  data_evento: string | null;
  duracao_segundos: number | null;
  destaque: boolean;
  ativo: boolean;
  created_at: string;
}

interface CongregacaoOption {
  id: string;
  nome: string;
}

interface EventoOption {
  id: string;
  nome: string;
  data_inicio: string | null;
}

export default function SecretariaMidiaVideosPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria');
  const supabase = useMemo(() => createClient(), []);

  const [videos, setVideos] = useState<MidiaVideo[]>([]);
  const [congregacoes, setCongregacoes] = useState<CongregacaoOption[]>([]);
  const [eventos, setEventos] = useState<EventoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');

  // Modal de Vídeo
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<MidiaVideo | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    titulo: string;
    url_video: string;
    categoria: CategoriaVideo;
    autor_pregador: string;
    descricao: string;
    data_evento: string;
    duracao_minutos: string;
    destaque: boolean;
    ativo: boolean;
    congregacao_id: string;
    evento_id: string;
    custom_thumbnail: string;
  }>({
    titulo: '',
    url_video: '',
    categoria: 'culto',
    autor_pregador: '',
    descricao: '',
    data_evento: '',
    duracao_minutos: '',
    destaque: false,
    ativo: true,
    congregacao_id: '',
    evento_id: '',
    custom_thumbnail: '',
  });

  // Preview Modal
  const [previewVideo, setPreviewVideo] = useState<MidiaVideo | null>(null);

  const loadData = useCallback(async () => {
    if (!ctx?.ministryId) return;
    setLoading(true);

    try {
      // 1. Carregar Vídeos
      const { data: vids, error: vidsErr } = await supabase
        .from('midia_videos')
        .select('*')
        .eq('ministry_id', ctx.ministryId)
        .order('created_at', { ascending: false });

      if (vidsErr) throw vidsErr;
      setVideos((vids as MidiaVideo[]) || []);

      // 2. Carregar Congregações
      const { data: congs } = await supabase
        .from('congregacoes')
        .select('id, nome')
        .eq('ministry_id', ctx.ministryId)
        .order('nome');
      if (congs) setCongregacoes(congs);

      // 3. Carregar Eventos
      const { data: evts } = await supabase
        .from('eventos')
        .select('id, nome, data_inicio')
        .eq('ministry_id', ctx.ministryId)
        .order('data_inicio', { ascending: false })
        .limit(50);
      if (evts) setEventos(evts);
    } catch (err: any) {
      console.error('Erro ao carregar dados de vídeos:', err);
    } finally {
      setLoading(false);
    }
  }, [ctx?.ministryId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived YouTube Preview for form
  const ytIdPreview = useMemo(() => {
    return extractYouTubeVideoId(formData.url_video);
  }, [formData.url_video]);

  const ytThumbPreview = useMemo(() => {
    if (formData.custom_thumbnail.trim()) return formData.custom_thumbnail.trim();
    if (ytIdPreview) return getYouTubeThumbnailUrl(ytIdPreview, 'hq');
    return null;
  }, [ytIdPreview, formData.custom_thumbnail]);

  function openCreateModal() {
    setEditingVideo(null);
    setFormData({
      titulo: '',
      url_video: '',
      categoria: 'culto',
      autor_pregador: '',
      descricao: '',
      data_evento: '',
      duracao_minutos: '',
      destaque: false,
      ativo: true,
      congregacao_id: '',
      evento_id: '',
      custom_thumbnail: '',
    });
    setErrorMsg(null);
    setModalOpen(true);
  }

  function openEditModal(video: MidiaVideo) {
    setEditingVideo(video);
    setFormData({
      titulo: video.titulo,
      url_video: video.url_video,
      categoria: video.categoria || 'culto',
      autor_pregador: video.autor_pregador || '',
      descricao: video.descricao || '',
      data_evento: video.data_evento || '',
      duracao_minutos: video.duracao_segundos ? Math.round(video.duracao_segundos / 60).toString() : '',
      destaque: video.destaque || false,
      ativo: video.ativo,
      congregacao_id: video.congregacao_id || '',
      evento_id: video.evento_id || '',
      custom_thumbnail: video.thumbnail_url || '',
    });
    setErrorMsg(null);
    setModalOpen(true);
  }

  async function handleSaveVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx?.ministryId) return;

    if (!formData.titulo.trim()) {
      setErrorMsg('O título do vídeo é obrigatório.');
      return;
    }

    if (!formData.url_video.trim()) {
      setErrorMsg('A URL do vídeo é obrigatória.');
      return;
    }

    if (!isValidVideoUrl(formData.url_video)) {
      setErrorMsg('A URL informada não é válida.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const ytId = extractYouTubeVideoId(formData.url_video);
      let thumb = formData.custom_thumbnail.trim() || null;
      if (!thumb && ytId) {
        thumb = getYouTubeThumbnailUrl(ytId, 'hq');
      }

      const durSec = formData.duracao_minutos ? parseInt(formData.duracao_minutos, 10) * 60 : null;

      const payload = {
        ministry_id: ctx.ministryId,
        congregacao_id: formData.congregacao_id.trim() || null,
        evento_id: formData.evento_id.trim() || null,
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        url_video: formData.url_video.trim(),
        youtube_id: ytId,
        thumbnail_url: thumb,
        categoria: formData.categoria,
        autor_pregador: formData.autor_pregador.trim() || null,
        data_evento: formData.data_evento || null,
        duracao_segundos: durSec && !isNaN(durSec) ? durSec : null,
        destaque: formData.destaque,
        ativo: formData.ativo,
      };

      if (editingVideo) {
        const { error } = await supabase
          .from('midia_videos')
          .update(payload)
          .eq('id', editingVideo.id)
          .eq('ministry_id', ctx.ministryId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('midia_videos')
          .insert(payload);

        if (error) throw error;
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Erro ao salvar vídeo:', err);
      setErrorMsg(err.message || 'Erro ao salvar o vídeo. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVideo(video: MidiaVideo) {
    if (!ctx?.ministryId) return;
    const confirm = window.confirm(`Deseja realmente excluir o vídeo "${video.titulo}"?`);
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from('midia_videos')
        .delete()
        .eq('id', video.id)
        .eq('ministry_id', ctx.ministryId);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      alert('Erro ao excluir vídeo: ' + err.message);
    }
  }

  async function handleToggleStatus(video: MidiaVideo) {
    if (!ctx?.ministryId) return;
    try {
      const { error } = await supabase
        .from('midia_videos')
        .update({ ativo: !video.ativo })
        .eq('id', video.id)
        .eq('ministry_id', ctx.ministryId);

      if (error) throw error;
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, ativo: !v.ativo } : v))
      );
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  }

  async function handleToggleDestaque(video: MidiaVideo) {
    if (!ctx?.ministryId) return;
    try {
      const { error } = await supabase
        .from('midia_videos')
        .update({ destaque: !video.destaque })
        .eq('id', video.id)
        .eq('ministry_id', ctx.ministryId);

      if (error) throw error;
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, destaque: !v.destaque } : v))
      );
    } catch (err: any) {
      alert('Erro ao alterar destaque: ' + err.message);
    }
  }

  // Filtered List
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const matchSearch =
        v.titulo.toLowerCase().includes(search.toLowerCase()) ||
        (v.autor_pregador && v.autor_pregador.toLowerCase().includes(search.toLowerCase())) ||
        (v.descricao && v.descricao.toLowerCase().includes(search.toLowerCase()));

      const matchCat = selectedCategoria === 'todos' || v.categoria === selectedCategoria;

      const matchStatus =
        selectedStatus === 'todos' ||
        (selectedStatus === 'ativos' && v.ativo) ||
        (selectedStatus === 'inativos' && !v.ativo) ||
        (selectedStatus === 'destaques' && v.destaque);

      return matchSearch && matchCat && matchStatus;
    });
  }, [videos, search, selectedCategoria, selectedStatus]);

  if (bloqueado) return null;

  return (
    <PageLayout
      title="Galeria de Vídeos"
      description="Gerencie transmissões, cultos gravados, pregações, estudos e clipes"
    >
      <div className="space-y-6 pb-12">
        {/* Header de Navegação */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/secretaria/midia"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Voltar para Central de Mídia"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  <Video className="w-5 h-5" />
                </span>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Vídeos Catalogados
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {videos.length} vídeo{videos.length === 1 ? '' : 's'} cadastrado{videos.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm shadow-sm hover:shadow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Adicionar Vídeo
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Campo de Busca */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, pregador ou descrição..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Categoria */}
            <div className="sm:col-span-3">
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
              >
                <option value="todos">Todas as categorias</option>
                {CATEGORIAS_MIDIA_VIDEO.map((cat: CategoriaVideo) => (
                  <option key={cat} value={cat}>
                    {CATEGORIA_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="sm:col-span-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
              >
                <option value="todos">Todos os status</option>
                <option value="ativos">Somente Ativos</option>
                <option value="destaques">Somente Destaques ⭐</option>
                <option value="inativos">Somente Inativos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listagem de Vídeos */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="aspect-video bg-slate-200 dark:bg-slate-800" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Nenhum vídeo encontrado
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {search || selectedCategoria !== 'todos' || selectedStatus !== 'todos'
                ? 'Nenhum vídeo corresponde aos filtros selecionados.'
                : 'Você ainda não cadastrou nenhum vídeo. Adicione links do YouTube ou vídeos gravados.'}
            </p>
            {videos.length === 0 && (
              <button
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Primeiro Vídeo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className={`group bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md ${
                  video.ativo
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-slate-200/60 dark:border-slate-800/60 opacity-75'
                }`}
              >
                {/* Thumbnail / Cover */}
                <div className="aspect-video relative bg-slate-950 overflow-hidden">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                      <Video className="w-12 h-12 stroke-[1.5]" />
                    </div>
                  )}

                  {/* Play Button Overlay */}
                  <button
                    onClick={() => setPreviewVideo(video)}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-lg backdrop-blur-sm"
                    title="Assistir prévia"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>

                  {/* Badges superiores */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-sm text-[11px] font-medium text-white border border-white/10">
                      {CATEGORIA_LABELS[video.categoria] || video.categoria}
                    </span>
                    {video.destaque && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/90 backdrop-blur-sm text-[11px] font-bold text-white flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 fill-current" /> Destaque
                      </span>
                    )}
                  </div>

                  {/* Status / Duração inferior */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    {video.duracao_segundos && (
                      <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono text-white flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {Math.floor(video.duracao_segundos / 60)} min
                      </span>
                    )}
                    {!video.ativo && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-600/90 backdrop-blur-sm text-[10px] font-semibold text-white">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>

                {/* Conteúdo do Card */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-1 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                      {video.titulo}
                    </h3>
                    {video.descricao && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {video.descricao}
                      </p>
                    )}
                  </div>

                  {/* Metadados */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    {video.autor_pregador && (
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[120px]">{video.autor_pregador}</span>
                      </div>
                    )}
                    {video.data_evento && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(video.data_evento).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleDestaque(video)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          video.destaque
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                            : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={video.destaque ? 'Remover dos destaques' : 'Marcar como destaque'}
                      >
                        <Star className={`w-4 h-4 ${video.destaque ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(video)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          video.ativo
                            ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={video.ativo ? 'Desativar vídeo' : 'Ativar vídeo'}
                      >
                        {video.ativo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <a
                        href={video.url_video}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Abrir link original"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(video)}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Editar vídeo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVideo(video)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Excluir vídeo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Criação / Edição */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden my-8">
              {/* Header do Modal */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <Video className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingVideo ? 'Editar Vídeo' : 'Adicionar Novo Vídeo'}
                  </h2>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveVideo} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* URL do Vídeo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    URL do Vídeo (YouTube ou Link Direto) *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.url_video}
                    onChange={(e) => setFormData({ ...formData, url_video: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white font-mono"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cole o link completo do vídeo no YouTube. O ID e thumbnail serão extraídos automaticamente.
                  </p>
                </div>

                {/* Prévia Automática de Thumbnail / ID */}
                {ytIdPreview && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-24 aspect-video rounded-lg overflow-hidden bg-slate-900 shrink-0">
                      {ytThumbPreview && (
                        <img
                          src={ytThumbPreview}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="text-xs space-y-0.5">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> YouTube ID Detectado: {ytIdPreview}
                      </span>
                      <p className="text-slate-500 dark:text-slate-400">
                        Capa e player configurados com sucesso.
                      </p>
                    </div>
                  </div>
                )}

                {/* Título do Vídeo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Título do Vídeo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ex: Culto de Celebração - Mensagem: A Força da Fé"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Categoria e Pregador */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Categoria *
                    </label>
                    <select
                      value={formData.categoria}
                      onChange={(e) =>
                        setFormData({ ...formData, categoria: e.target.value as CategoriaVideo })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                    >
                      {CATEGORIAS_MIDIA_VIDEO.map((cat: CategoriaVideo) => (
                        <option key={cat} value={cat}>
                          {CATEGORIA_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Pregador / Autor / Ministro
                    </label>
                    <input
                      type="text"
                      value={formData.autor_pregador}
                      onChange={(e) => setFormData({ ...formData, autor_pregador: e.target.value })}
                      placeholder="Ex: Pr. Carlos Silva"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Data e Duração */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Data do Culto / Evento
                    </label>
                    <input
                      type="date"
                      value={formData.data_evento}
                      onChange={(e) => setFormData({ ...formData, data_evento: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Duração (em minutos)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.duracao_minutos}
                      onChange={(e) => setFormData({ ...formData, duracao_minutos: e.target.value })}
                      placeholder="Ex: 85"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Congregação e Evento Relacionado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Congregação
                    </label>
                    <select
                      value={formData.congregacao_id}
                      onChange={(e) => setFormData({ ...formData, congregacao_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                    >
                      <option value="">Todas as congregações (Geral)</option>
                      {congregacoes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Evento Vinculado (Opcional)
                    </label>
                    <select
                      value={formData.evento_id}
                      onChange={(e) => setFormData({ ...formData, evento_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                    >
                      <option value="">Nenhum evento vinculado</option>
                      {eventos.map((evt) => (
                        <option key={evt.id} value={evt.id}>
                          {evt.nome} {evt.data_inicio ? `(${new Date(evt.data_inicio).toLocaleDateString('pt-BR')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Descrição / Resumo
                  </label>
                  <textarea
                    rows={3}
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Breve resumo da mensagem ou do evento..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white resize-none"
                  />
                </div>

                {/* Checkboxes Destaque e Ativo */}
                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.destaque}
                      onChange={(e) => setFormData({ ...formData, destaque: e.target.checked })}
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-current" /> Vídeo em Destaque
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Publicado e Ativo
                    </span>
                  </label>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : editingVideo ? 'Salvar Alterações' : 'Adicionar Vídeo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Prévia do Player */}
        {previewVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-slate-900 flex items-center justify-between border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white truncate max-w-md">
                  {previewVideo.titulo}
                </h3>
                <button
                  onClick={() => setPreviewVideo(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="aspect-video w-full bg-black">
                {previewVideo.youtube_id ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${previewVideo.youtube_id}?autoplay=1`}
                    title={previewVideo.titulo}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                    <p className="mb-3">Link direto do vídeo:</p>
                    <a
                      href={previewVideo.url_video}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 flex items-center gap-2"
                    >
                      Abrir em Nova Aba <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
