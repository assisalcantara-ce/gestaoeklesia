'use client';

/**
 * /app/midia/albuns/[id] — Visualização e Galeria de Fotos do Álbum no Mobile
 *
 * Inclui:
 * - Capa e metadados do álbum (título, descrição, data, congregação)
 * - Grid de fotos com lazy loading
 * - Lightbox Modal com navegação anterior/próxima e suporte a swipe no celular
 * - Legenda e contador de fotos
 * - Botão de retorno à Central de Mídia
 * - Estados de carregamento e erro com retry
 */

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import Link from 'next/link';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  ArrowLeft,
  Calendar,
  Image as ImageIcon,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface FotoItem {
  id: string;
  foto_url: string;
  legenda: string | null;
  ordem: number;
}

interface AlbumDetail {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  data_evento: string | null;
  publicado_em: string | null;
  escopo: string;
  congregacao_nome: string | null;
  total_fotos: number;
  fotos: FotoItem[];
}

export default function MobileAlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = use(Promise.resolve(params));
  const albumId = resolvedParams.id;
  const supabase = useMemo(() => createClient(), []);

  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lightbox Modal State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadAlbum = useCallback(async () => {
    if (!albumId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/v1/mobile/midia/albuns/${albumId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Álbum não encontrado ou não publicado.');
        }
        if (res.status === 403) {
          throw new Error('Você não tem permissão para acessar este álbum.');
        }
        throw new Error('Falha ao carregar fotos do álbum.');
      }

      const data = await res.json();
      setAlbum(data.album);
    } catch (err: any) {
      console.error('Erro ao carregar detalhes do álbum:', err);
      setErrorMsg(err.message || 'Erro ao consultar álbum.');
    } finally {
      setLoading(false);
    }
  }, [albumId, getAccessToken]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  // Lightbox Navigation
  const prevPhoto = useCallback(() => {
    if (lightboxIndex === null || !album) return;
    setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : album.fotos.length - 1));
  }, [lightboxIndex, album]);

  const nextPhoto = useCallback(() => {
    if (lightboxIndex === null || !album) return;
    setLightboxIndex((prev) => (prev! < album.fotos.length - 1 ? prev! + 1 : 0));
  }, [lightboxIndex, album]);

  // Touch Swipe Handlers
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    // Swipe threshold 50px
    if (diff > 50) {
      nextPhoto();
    } else if (diff < -50) {
      prevPhoto();
    }
    setTouchStart(null);
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, prevPhoto, nextPhoto]);

  return (
    <MobileShell>
      <MobileHeader title="Galeria de Fotos" />

      <main className="min-h-screen bg-slate-50 pb-28">
        {/* Topo / Voltar */}
        <div className="bg-dark-blue pt-20 pb-5 px-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/app/midia"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white bg-white/10 px-3 py-1.5 rounded-xl transition"
            >
              <ArrowLeft size={14} /> Voltar para Central
            </Link>
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
              Álbum Oficial
            </span>
          </div>
        </div>

        {/* Feedback de Erro */}
        {errorMsg && (
          <div className="p-5">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={18} className="shrink-0 text-rose-600" />
                <span className="truncate">{errorMsg}</span>
              </div>
              <button
                onClick={loadAlbum}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-xl text-[11px] shrink-0"
              >
                <RefreshCw size={11} /> Tentar de novo
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="p-5 space-y-4">
            <div className="h-44 bg-slate-200 rounded-2xl animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="aspect-square bg-slate-200 rounded-xl animate-pulse" />
              <div className="aspect-square bg-slate-200 rounded-xl animate-pulse" />
              <div className="aspect-square bg-slate-200 rounded-xl animate-pulse" />
              <div className="aspect-square bg-slate-200 rounded-xl animate-pulse" />
            </div>
          </div>
        ) : album ? (
          <div className="p-5 space-y-5">
            {/* Metadados e Capa do Álbum */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              {album.capa_url && (
                <div className="aspect-video w-full relative bg-slate-950 overflow-hidden">
                  <img
                    src={album.capa_url}
                    alt={album.titulo}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">
                      {album.escopo === 'congregacao' ? 'Congregação' : 'Geral'}
                    </span>
                    <h1 className="text-base font-black leading-tight drop-shadow-sm">
                      {album.titulo}
                    </h1>
                  </div>
                </div>
              )}

              <div className="p-4 space-y-2">
                {!album.capa_url && (
                  <h1 className="text-lg font-black text-slate-900 leading-tight">
                    {album.titulo}
                  </h1>
                )}

                {album.descricao && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {album.descricao}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  {album.data_evento && (
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar size={12} className="text-slate-400" />
                      {new Date(album.data_evento).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {album.congregacao_nome && (
                    <span className="flex items-center gap-1 font-medium">
                      <Building2 size={12} className="text-slate-400" />
                      {album.congregacao_nome}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-bold text-blue-600 ml-auto">
                    <ImageIcon size={12} />
                    {album.fotos.length} foto{album.fotos.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid de Fotos */}
            {album.fotos.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <ImageIcon size={32} className="mx-auto text-slate-400" />
                <p className="text-xs text-slate-500">Nenhuma foto adicionada a este álbum.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {album.fotos.map((foto, idx) => (
                  <div
                    key={foto.id}
                    onClick={() => setLightboxIndex(idx)}
                    className="aspect-square bg-slate-900 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer active:scale-[0.98] relative group"
                  >
                    <img
                      src={foto.foto_url}
                      alt={foto.legenda || `Foto ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {foto.legenda && (
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[10px] text-white truncate font-medium">
                          {foto.legenda}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Lightbox Modal com Swipe */}
        {lightboxIndex !== null && album && (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 text-white select-none backdrop-blur-md"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
              <span className="text-xs font-bold text-white/90">
                {lightboxIndex + 1} de {album.fotos.length}
              </span>
              <button
                onClick={() => setLightboxIndex(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Imagem Central */}
            <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
              <img
                src={album.fotos[lightboxIndex].foto_url}
                alt={album.fotos[lightboxIndex].legenda || `Foto ${lightboxIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform"
              />

              {/* Botões Laterais */}
              <button
                onClick={prevPhoto}
                className="absolute left-3 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition"
                title="Foto anterior"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={nextPhoto}
                className="absolute right-3 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition"
                title="Próxima foto"
              >
                <ChevronRight size={22} />
              </button>
            </div>

            {/* Bottom Bar com Legenda */}
            <div className="p-4 bg-gradient-to-t from-black/90 to-transparent text-center z-10 space-y-1">
              {album.fotos[lightboxIndex].legenda ? (
                <p className="text-xs font-medium text-white/90">
                  {album.fotos[lightboxIndex].legenda}
                </p>
              ) : (
                <p className="text-[11px] text-white/50">{album.titulo}</p>
              )}
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
