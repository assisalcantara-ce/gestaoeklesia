'use client';

/**
 * /secretaria/midia/albuns — Gestão de Álbuns de Fotos e Galerias de Eventos
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import {
  Image as ImageIcon,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Building2,
  Upload,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Star,
  Search,
  Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AlbumItem {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  evento_id: string | null;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  data_evento: string | null;
  publicado_em: string | null;
  ativo: boolean;
  created_at: string;
  congregacoes?: { nome: string } | null;
  eventos?: { titulo: string } | null;
  midia_fotos?: { count: number }[];
}

interface FotoItem {
  id: string;
  album_id: string;
  ministry_id: string;
  foto_url: string;
  legenda: string | null;
  ordem: number;
  created_at: string;
}

export default function SecretariaMidiaAlbunsPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria');
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [albuns, setAlbuns] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string }[]>([]);
  const [eventos, setEventos] = useState<{ id: string; titulo: string }[]>([]);

  // Filtros
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCongregacao, setFiltroCongregacao] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Modal Álbum (Criar / Editar)
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<AlbumItem | null>(null);
  const [albumForm, setAlbumForm] = useState({
    titulo: '',
    descricao: '',
    congregacao_id: '',
    evento_id: '',
    data_evento: new Date().toISOString().split('T')[0],
    publicado_em: new Date().toISOString().split('T')[0],
    capa_url: '',
    ativo: true,
  });
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);

  // Gestor de Fotos do Álbum
  const [selectedAlbumParaFotos, setSelectedAlbumParaFotos] = useState<AlbumItem | null>(null);
  const [fotosDoAlbum, setFotosDoAlbum] = useState<FotoItem[]>([]);
  const [loadingFotos, setLoadingFotos] = useState(false);
  const [uploadingFotos, setUploadingFotos] = useState(false);

  // Notificações
  const [notify, setNotify] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setNotify({ isOpen: true, type, title, message });
  };

  // Carregar dados de apoio (Congregações e Eventos do Tenant)
  useEffect(() => {
    async function loadAuxData() {
      if (!ctx?.ministryId) return;

      try {
        const { data: congData } = await supabase
          .from('congregacoes')
          .select('id, nome')
          .eq('ministry_id', ctx.ministryId)
          .order('nome');

        const { data: evData } = await supabase
          .from('eventos')
          .select('id, titulo')
          .eq('ministry_id', ctx.ministryId)
          .order('data_inicio', { ascending: false })
          .limit(50);

        setCongregacoes(congData || []);
        setEventos(evData || []);
      } catch (err) {
        console.error('Erro ao carregar dados auxiliares:', err);
      }
    }

    if (!ctx?.loading && ctx?.ministryId) {
      loadAuxData();
    }
  }, [ctx?.loading, ctx?.ministryId, supabase]);

  // Carregar lista de álbuns
  const loadAlbuns = useCallback(async () => {
    if (!ctx?.ministryId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('midia_albuns')
        .select(
          `
          id,
          ministry_id,
          congregacao_id,
          evento_id,
          titulo,
          descricao,
          capa_url,
          data_evento,
          publicado_em,
          ativo,
          created_at,
          congregacoes ( nome ),
          eventos ( titulo )
        `
        )
        .eq('ministry_id', ctx.ministryId)
        .order('publicado_em', { ascending: false });

      if (error) throw error;
      setAlbuns((data as any) || []);
    } catch (err: any) {
      showNotification('error', 'Erro', err?.message || 'Erro ao carregar álbuns.');
    } finally {
      setLoading(false);
    }
  }, [ctx?.ministryId, supabase]);

  useEffect(() => {
    if (!ctx?.loading && ctx?.ministryId) {
      loadAlbuns();
    }
  }, [ctx?.loading, ctx?.ministryId, loadAlbuns]);

  // Carregar fotos de um álbum
  const loadFotos = useCallback(
    async (albumId: string) => {
      if (!ctx?.ministryId) return;
      setLoadingFotos(true);

      try {
        const { data, error } = await supabase
          .from('midia_fotos')
          .select('*')
          .eq('album_id', albumId)
          .eq('ministry_id', ctx.ministryId)
          .order('ordem', { ascending: true })
          .order('created_at', { ascending: true });

        if (error) throw error;
        setFotosDoAlbum(data || []);
      } catch (err: any) {
        showNotification('error', 'Erro', err?.message || 'Erro ao carregar fotos do álbum.');
      } finally {
        setLoadingFotos(false);
      }
    },
    [ctx?.ministryId, supabase]
  );

  // Abrir Modal de Criação
  const handleOpenCreate = () => {
    setEditingAlbum(null);
    setAlbumForm({
      titulo: '',
      descricao: '',
      congregacao_id: '',
      evento_id: '',
      data_evento: new Date().toISOString().split('T')[0],
      publicado_em: new Date().toISOString().split('T')[0],
      capa_url: '',
      ativo: true,
    });
    setShowAlbumModal(true);
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (album: AlbumItem) => {
    setEditingAlbum(album);
    setAlbumForm({
      titulo: album.titulo,
      descricao: album.descricao || '',
      congregacao_id: album.congregacao_id || '',
      evento_id: album.evento_id || '',
      data_evento: album.data_evento || '',
      publicado_em: album.publicado_em ? album.publicado_em.split('T')[0] : '',
      capa_url: album.capa_url || '',
      ativo: album.ativo,
    });
    setShowAlbumModal(true);
  };

  // Upload da Foto de Capa do Álbum
  const handleUploadCapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCapa(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/secretaria/uploads/midia-foto', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || 'Erro ao enviar capa.');
      }

      const data = await res.json();
      setAlbumForm((prev) => ({ ...prev, capa_url: data.url }));
      showNotification('success', 'Sucesso', 'Capa enviada com sucesso!');
    } catch (err: any) {
      showNotification('error', 'Erro no Upload', err?.message || 'Não foi possível enviar a capa.');
    } finally {
      setUploadingCapa(false);
    }
  };

  // Salvar Álbum (Insert / Update)
  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx?.ministryId || !ctx?.userId) return;

    if (!albumForm.titulo.trim()) {
      showNotification('warning', 'Campo Obrigatório', 'O título do álbum é obrigatório.');
      return;
    }

    setSavingAlbum(true);
    try {
      const payload = {
        ministry_id: ctx.ministryId,
        congregacao_id: albumForm.congregacao_id ? albumForm.congregacao_id : null,
        evento_id: albumForm.evento_id ? albumForm.evento_id : null,
        titulo: albumForm.titulo.trim(),
        descricao: albumForm.descricao.trim() || null,
        data_evento: albumForm.data_evento || null,
        publicado_em: albumForm.publicado_em ? new Date(albumForm.publicado_em).toISOString() : null,
        capa_url: albumForm.capa_url || null,
        ativo: albumForm.ativo,
        created_by: ctx.userId,
      };

      if (editingAlbum) {
        const { error } = await supabase
          .from('midia_albuns')
          .update(payload)
          .eq('id', editingAlbum.id)
          .eq('ministry_id', ctx.ministryId);

        if (error) throw error;
        showNotification('success', 'Sucesso', 'Álbum atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('midia_albuns').insert(payload);
        if (error) throw error;
        showNotification('success', 'Sucesso', 'Álbum criado com sucesso!');
      }

      setShowAlbumModal(false);
      loadAlbuns();
    } catch (err: any) {
      showNotification('error', 'Erro ao Salvar', err?.message || 'Erro ao salvar álbum.');
    } finally {
      setSavingAlbum(false);
    }
  };

  // Excluir Álbum
  const handleDeleteAlbum = async (id: string) => {
    if (!ctx?.ministryId) return;
    if (!confirm('Deseja realmente excluir este álbum e todas as suas fotos? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('midia_albuns')
        .delete()
        .eq('id', id)
        .eq('ministry_id', ctx.ministryId);

      if (error) throw error;
      showNotification('success', 'Excluído', 'Álbum excluído com sucesso.');
      loadAlbuns();
    } catch (err: any) {
      showNotification('error', 'Erro ao Excluir', err?.message || 'Erro ao excluir álbum.');
    }
  };

  // Abrir Gestor de Fotos
  const handleOpenGerenciarFotos = (album: AlbumItem) => {
    setSelectedAlbumParaFotos(album);
    loadFotos(album.id);
  };

  // Upload Múltiplo de Fotos para o Álbum
  const handleUploadFotosMultiplas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedAlbumParaFotos || !ctx?.ministryId) return;

    setUploadingFotos(true);
    let sucessos = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/v1/secretaria/uploads/midia-foto', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          // Inserir na tabela midia_fotos
          await supabase.from('midia_fotos').insert({
            album_id: selectedAlbumParaFotos.id,
            ministry_id: ctx.ministryId,
            foto_url: data.url,
            ordem: fotosDoAlbum.length + i + 1,
          });
          sucessos++;
        }
      }

      showNotification('success', 'Upload Concluído', `${sucessos} foto(s) adicionada(s) ao álbum.`);
      loadFotos(selectedAlbumParaFotos.id);
    } catch (err: any) {
      showNotification('error', 'Erro no Upload', err?.message || 'Erro ao adicionar fotos.');
    } finally {
      setUploadingFotos(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Definir Foto como Capa do Álbum
  const handleDefinirCapa = async (fotoUrl: string) => {
    if (!selectedAlbumParaFotos || !ctx?.ministryId) return;

    try {
      const { error } = await supabase
        .from('midia_albuns')
        .update({ capa_url: fotoUrl })
        .eq('id', selectedAlbumParaFotos.id)
        .eq('ministry_id', ctx.ministryId);

      if (error) throw error;
      setSelectedAlbumParaFotos((prev) => (prev ? { ...prev, capa_url: fotoUrl } : null));
      showNotification('success', 'Capa Atualizada', 'A foto foi definida como capa do álbum.');
      loadAlbuns();
    } catch (err: any) {
      showNotification('error', 'Erro', err?.message || 'Não foi possível definir a capa.');
    }
  };

  // Excluir Foto Individual
  const handleDeleteFoto = async (fotoId: string) => {
    if (!selectedAlbumParaFotos || !ctx?.ministryId) return;
    if (!confirm('Deseja excluir esta foto?')) return;

    try {
      const { error } = await supabase
        .from('midia_fotos')
        .delete()
        .eq('id', fotoId)
        .eq('ministry_id', ctx.ministryId);

      if (error) throw error;
      loadFotos(selectedAlbumParaFotos.id);
    } catch (err: any) {
      showNotification('error', 'Erro', err?.message || 'Erro ao remover foto.');
    }
  };

  // Filtros aplicados na lista
  const albunsFiltrados = useMemo(() => {
    return albuns.filter((a) => {
      if (filtroBusca) {
        const query = filtroBusca.toLowerCase();
        const matchesTitulo = a.titulo.toLowerCase().includes(query);
        const matchesDesc = a.descricao?.toLowerCase().includes(query);
        if (!matchesTitulo && !matchesDesc) return false;
      }
      if (filtroCongregacao !== 'todas') {
        if (filtroCongregacao === 'geral' && a.congregacao_id !== null) return false;
        if (filtroCongregacao !== 'geral' && a.congregacao_id !== filtroCongregacao) return false;
      }
      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'ativo' && !a.ativo) return false;
        if (filtroStatus === 'inativo' && a.ativo) return false;
      }
      return true;
    });
  }, [albuns, filtroBusca, filtroCongregacao, filtroStatus]);

  if (bloqueado) return null;

  return (
    <PageLayout
      title="Álbuns & Galerias de Fotos"
      description="Gerencie os álbuns fotográficos oficiais dos eventos, cultos e congressos da igreja."
      headerExtra={
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/secretaria/midia')}
            className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar à Mídia</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-bold text-white bg-[#123b63] hover:bg-[#0e2f50] rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Álbum</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Barra de Filtros e Busca */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por título ou descrição..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#123b63]/20 focus:border-[#123b63]"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={filtroCongregacao}
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-semibold focus:outline-none"
            >
              <option value="todas">Todas as Congregações</option>
              <option value="geral">Geral (Todo o Ministério)</option>
              {congregacoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-semibold focus:outline-none"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-3">
                <div className="w-full h-36 bg-gray-200 rounded-xl" />
                <div className="w-3/4 h-5 bg-gray-200 rounded" />
                <div className="w-1/2 h-3 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Lista Vazia */}
        {!loading && albunsFiltrados.length === 0 && (
          <div className="bg-white py-16 px-4 text-center rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-800">Nenhum álbum encontrado</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Cadastre o primeiro álbum fotográfico para disponibilizar fotos dos cultos e eventos aos membros.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="mt-2 px-4 py-2 text-xs font-bold text-white bg-[#123b63] hover:bg-[#0e2f50] rounded-xl shadow-sm transition"
            >
              Criar Álbum
            </button>
          </div>
        )}

        {/* Grid de Álbuns */}
        {!loading && albunsFiltrados.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {albunsFiltrados.map((album) => (
              <div
                key={album.id}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                  album.ativo ? 'border-gray-200 hover:border-blue-300' : 'border-gray-200 opacity-60 bg-gray-50/50'
                }`}
              >
                <div>
                  {/* Capa */}
                  <div className="relative w-full h-44 bg-gray-100 overflow-hidden border-b border-gray-100">
                    {album.capa_url ? (
                      <img src={album.capa_url} alt={album.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1">
                        <ImageIcon className="w-8 h-8 opacity-40" />
                        <span className="text-[11px]">Sem foto de capa</span>
                      </div>
                    )}
                    <span
                      className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                        album.ativo ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-white'
                      }`}
                    >
                      {album.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Informações */}
                  <div className="p-4 space-y-2">
                    <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-1">{album.titulo}</h3>
                    {album.descricao && (
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{album.descricao}</p>
                    )}

                    <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      {album.congregacoes?.nome ? (
                        <span className="flex items-center gap-1 font-semibold text-gray-600">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          <span>{album.congregacoes.nome}</span>
                        </span>
                      ) : (
                        <span className="text-blue-600 font-semibold">Toda a Igreja</span>
                      )}

                      {album.data_evento && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>{album.data_evento}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="p-4 pt-0 border-t border-gray-50 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => handleOpenGerenciarFotos(album)}
                    className="flex-1 py-2 px-3 text-xs font-bold text-[#123b63] bg-blue-50 hover:bg-blue-100 rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Fotos & Galeria</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(album)}
                      className="p-2 text-gray-500 hover:text-[#123b63] hover:bg-gray-100 rounded-lg transition"
                      title="Editar Álbum"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAlbum(album.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Excluir Álbum"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL 1: CRIAR / EDITAR ÁLBUM */}
        {showAlbumModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-gray-900">
                  {editingAlbum ? 'Editar Álbum' : 'Novo Álbum de Fotos'}
                </h3>
                <button
                  onClick={() => setShowAlbumModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveAlbum} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Título do Álbum *</label>
                  <input
                    type="text"
                    required
                    value={albumForm.titulo}
                    onChange={(e) => setAlbumForm({ ...albumForm, titulo: e.target.value })}
                    placeholder="Ex: Congresso de Jovens 2026"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#123b63]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={albumForm.descricao}
                    onChange={(e) => setAlbumForm({ ...albumForm, descricao: e.target.value })}
                    placeholder="Breve relato sobre as fotos e o evento..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#123b63]/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Congregação</label>
                    <select
                      value={albumForm.congregacao_id}
                      onChange={(e) => setAlbumForm({ ...albumForm, congregacao_id: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold"
                    >
                      <option value="">Geral (Toda a Igreja)</option>
                      {congregacoes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Evento Relacionado</label>
                    <select
                      value={albumForm.evento_id}
                      onChange={(e) => setAlbumForm({ ...albumForm, evento_id: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold"
                    >
                      <option value="">Nenhum evento vinculado</option>
                      {eventos.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Data do Evento</label>
                    <input
                      type="date"
                      value={albumForm.data_evento}
                      onChange={(e) => setAlbumForm({ ...albumForm, data_evento: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Data de Publicação</label>
                    <input
                      type="date"
                      value={albumForm.publicado_em}
                      onChange={(e) => setAlbumForm({ ...albumForm, publicado_em: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold"
                    />
                  </div>
                </div>

                {/* Upload Foto de Capa */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Foto de Capa do Álbum</label>
                  <div className="flex items-center gap-3">
                    {albumForm.capa_url ? (
                      <img
                        src={albumForm.capa_url}
                        alt="Preview Capa"
                        className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 border border-dashed border-gray-300">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingCapa ? 'Enviando...' : 'Selecionar imagem de capa'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleUploadCapa}
                          disabled={uploadingCapa}
                        />
                      </label>
                      <span className="block text-[10px] text-gray-400 mt-1">JPEG, PNG ou WebP até 5MB</span>
                    </div>
                  </div>
                </div>

                {/* Status Ativo */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">Álbum Ativo</span>
                    <span className="text-[10px] text-gray-400 block">Exibir para os membros no app</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={albumForm.ativo}
                    onChange={(e) => setAlbumForm({ ...albumForm, ativo: e.target.checked })}
                    className="w-4 h-4 text-[#123b63] rounded border-gray-300 focus:ring-[#123b63]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAlbumModal(false)}
                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingAlbum || uploadingCapa}
                    className="px-5 py-2 text-xs font-bold text-white bg-[#123b63] hover:bg-[#0e2f50] rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    {savingAlbum ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{editingAlbum ? 'Atualizar Álbum' : 'Salvar Álbum'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: GESTOR DE FOTOS DO ÁLBUM */}
        {selectedAlbumParaFotos && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    Galeria do Álbum
                  </span>
                  <h3 className="text-base font-bold text-gray-900">{selectedAlbumParaFotos.titulo}</h3>
                </div>
                <button
                  onClick={() => setSelectedAlbumParaFotos(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Botão de Upload Múltiplo */}
              <div className="p-4 bg-blue-50/60 border border-dashed border-blue-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div>
                  <h4 className="text-xs font-bold text-[#123b63]">Adicionar Fotos ao Álbum</h4>
                  <p className="text-[11px] text-gray-500">
                    Selecione uma ou mais fotos para upload simultâneo (JPEG, PNG, WebP).
                  </p>
                </div>
                <div>
                  <label className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#123b63] hover:bg-[#0e2f50] text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm transition">
                    {uploadingFotos ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{uploadingFotos ? 'Enviando fotos...' : 'Upload de Fotos'}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleUploadFotosMultiplas}
                      disabled={uploadingFotos}
                    />
                  </label>
                </div>
              </div>

              {/* Lista de Fotos */}
              {loadingFotos ? (
                <div className="py-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#123b63]" />
                  <span>Carregando fotos...</span>
                </div>
              ) : fotosDoAlbum.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 space-y-1">
                  <ImageIcon className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="font-semibold text-gray-600">Nenhuma foto adicionada ainda.</p>
                  <p>Utilize o botão acima para enviar as fotos deste álbum.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {fotosDoAlbum.map((foto) => {
                    const isCapa = selectedAlbumParaFotos.capa_url === foto.foto_url;
                    return (
                      <div
                        key={foto.id}
                        className="group relative rounded-xl overflow-hidden bg-gray-100 border border-gray-200 aspect-square"
                      >
                        <img src={foto.foto_url} alt="Foto" className="w-full h-full object-cover" />

                        {isCapa && (
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-extrabold flex items-center gap-0.5 shadow-sm">
                            <Star className="w-2.5 h-2.5 fill-white" />
                            Capa
                          </span>
                        )}

                        {/* Overlay com Ações */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleDeleteFoto(foto.id)}
                              className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                              title="Remover Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {!isCapa && (
                            <button
                              onClick={() => handleDefinirCapa(foto.foto_url)}
                              className="w-full py-1 text-[10px] font-bold bg-white/90 hover:bg-white text-gray-800 rounded-md transition text-center"
                            >
                              Definir Capa
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t text-xs text-gray-500">
                <span>Total de fotos: {fotosDoAlbum.length}</span>
                <button
                  onClick={() => setSelectedAlbumParaFotos(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        <NotificationModal
          isOpen={notify.isOpen}
          type={notify.type}
          title={notify.title}
          message={notify.message}
          onClose={() => setNotify((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </PageLayout>
  );
}
