'use client';

/**
 * /app/midia — Central de Mídia do App do Membro
 *
 * Experiência oficial e consolidada com:
 * - Transmissão Ao Vivo (Culto Online)
 * - Web Rádio com HTML5 Audio Player
 * - Catálogo de Vídeos e Sermões com player sanitizado
 * - Álbuns e Galerias de Fotos
 * - Mural de Notícias integrado
 * - Tabs/Pills internas para alternância rápida
 * - Skeletons, Empty states e Tratamento de Erro com Retry
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import { CATEGORIA_LABELS, CategoriaVideo } from '@/lib/midia-utils';
import {
  Tv,
  Radio,
  Video,
  Image as ImageIcon,
  Megaphone,
  Play,
  Square,
  Volume2,
  VolumeX,
  Sparkles,
  Calendar,
  User,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Search,
  Star,
  X,
} from 'lucide-react';

type TabOption = 'tudo' | 'aovivo' | 'radio' | 'noticias' | 'videos' | 'fotos';

export default function MobileMidiaPage() {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<TabOption>('tudo');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dados do Feed Consolidado
  const [feedData, setFeedData] = useState<{
    aovivo: {
      is_aovivo: boolean;
      status: string;
      canal_youtube_url: string | null;
      provider: string | null;
      live_url: string | null;
      embed_url: string | null;
    };
    radio: {
      disponivel: boolean;
      radio_nome: string | null;
      radio_stream_url: string | null;
    };
    noticias: any[];
    videos: any[];
    albuns: any[];
  } | null>(null);

  // Vídeos completos (quando na aba de vídeos)
  const [videosList, setVideosList] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVideoCategory, setSelectedVideoCategory] = useState<string>('todos');
  const [videoSearch, setVideoSearch] = useState('');

  // Álbuns completos (quando na aba de fotos)
  const [albunsList, setAlbunsList] = useState<any[]>([]);
  const [loadingAlbuns, setLoadingAlbuns] = useState(false);

  // Player de Vídeo Modal
  const [activeVideoModal, setActiveVideoModal] = useState<any | null>(null);

  // Web Rádio State
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [isRadioBuffering, setIsRadioBuffering] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);
  const [isRadioMuted, setIsRadioMuted] = useState(false);
  const [radioVolume, setRadioVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  // Carregar Feed Consolidado
  const loadFeed = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/v1/mobile/midia/feed', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar conteúdo de mídia.');
      }

      const data = await res.json();
      setFeedData(data.feed);
    } catch (err: any) {
      console.error('Erro ao carregar feed:', err);
      setErrorMsg(err.message || 'Não foi possível carregar a Central de Mídia.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  // Carregar Vídeos Detalhados
  const loadVideos = useCallback(async (cat?: string, q?: string) => {
    setLoadingVideos(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      let url = '/api/v1/mobile/midia/videos?limit=50';
      if (cat && cat !== 'todos') url += `&categoria=${encodeURIComponent(cat)}`;
      if (q && q.trim()) url += `&q=${encodeURIComponent(q.trim())}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setVideosList(data.videos || []);
      }
    } catch (err) {
      console.error('Erro ao carregar vídeos:', err);
    } finally {
      setLoadingVideos(false);
    }
  }, [getAccessToken]);

  // Carregar Álbuns Detalhados
  const loadAlbuns = useCallback(async () => {
    setLoadingAlbuns(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch('/api/v1/mobile/midia/albuns?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAlbunsList(data.albuns || []);
      }
    } catch (err) {
      console.error('Erro ao carregar álbuns:', err);
    } finally {
      setLoadingAlbuns(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (activeTab === 'videos') {
      loadVideos(selectedVideoCategory, videoSearch);
    } else if (activeTab === 'fotos') {
      loadAlbuns();
    }
  }, [activeTab, selectedVideoCategory, videoSearch, loadVideos, loadAlbuns]);

  // Web Rádio Handlers
  function toggleRadio() {
    if (!feedData?.radio?.radio_stream_url) {
      setRadioError('Transmissão não disponível no momento.');
      return;
    }

    setRadioError(null);

    if (isRadioPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsRadioPlaying(false);
      setIsRadioBuffering(false);
    } else {
      setIsRadioBuffering(true);
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audio = audioRef.current;
      audio.src = feedData.radio.radio_stream_url;
      audio.volume = isRadioMuted ? 0 : radioVolume;

      audio.oncanplay = () => {
        setIsRadioBuffering(false);
        audio.play().catch(() => {
          setRadioError('Falha ao reproduzir áudio. Verifique sua conexão.');
          setIsRadioPlaying(false);
          setIsRadioBuffering(false);
        });
      };

      audio.onerror = () => {
        setIsRadioBuffering(false);
        setIsRadioPlaying(false);
        setRadioError('Servidor da rádio offline ou stream inacessível.');
      };

      setIsRadioPlaying(true);
    }
  }

  function handleVolumeChange(newVol: number) {
    setRadioVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = isRadioMuted ? 0 : newVol;
    }
  }

  function toggleMute() {
    const nextMuted = !isRadioMuted;
    setIsRadioMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.volume = nextMuted ? 0 : radioVolume;
    }
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  return (
    <MobileShell>
      <MobileHeader title="Central de Mídia" />

      <main className="min-h-screen bg-slate-50 pb-28">
        {/* Header Hero */}
        <div className="bg-dark-blue pt-20 pb-6 px-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-white/10 text-white">
              <Tv size={16} />
            </span>
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Comunicação & Conteúdo
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Central de Mídia
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            Cultos ao vivo, web rádio, sermões e fotos oficiais
          </p>

          {/* Navegação por Segmentos/Pills */}
          <div className="flex items-center gap-1.5 mt-5 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
            {[
              { id: 'tudo', label: 'Tudo', icon: Sparkles },
              { id: 'aovivo', label: 'Ao Vivo', icon: Tv },
              { id: 'radio', label: 'Web Rádio', icon: Radio },
              { id: 'videos', label: 'Vídeos', icon: Video },
              { id: 'fotos', label: 'Fotos', icon: ImageIcon },
              { id: 'noticias', label: 'Notícias', icon: Megaphone },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabOption)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95 ${
                    isActive
                      ? 'bg-white text-dark-blue shadow-sm'
                      : 'bg-white/10 text-white/80 hover:bg-white/15'
                  }`}
                >
                  <Icon size={13} className={isActive ? 'text-dark-blue' : 'text-white/70'} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback de Erro Geral */}
        {errorMsg && (
          <div className="p-5">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={18} className="shrink-0 text-rose-600" />
                <span className="truncate">{errorMsg}</span>
              </div>
              <button
                onClick={loadFeed}
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
            <div className="h-36 bg-slate-200 rounded-2xl animate-pulse" />
            <div className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="aspect-video bg-slate-200 rounded-xl animate-pulse" />
              <div className="aspect-video bg-slate-200 rounded-xl animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* 1. SEÇÃO AO VIVO (Visível em 'tudo' ou 'aovivo') */}
            {(activeTab === 'tudo' || activeTab === 'aovivo') && (
              <section className="space-y-3">
                {feedData?.aovivo?.is_aovivo ? (
                  <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-2xl p-4 text-white shadow-md overflow-hidden relative border border-red-500">
                    <div className="flex items-center justify-between mb-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-black tracking-wider uppercase backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        AO VIVO AGORA
                      </div>
                      <span className="text-[11px] font-bold text-red-100">
                        Culto Online
                      </span>
                    </div>

                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner mb-3">
                      {feedData.aovivo.embed_url ? (
                        <iframe
                          src={feedData.aovivo.embed_url}
                          title="Culto Ao Vivo"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full border-0"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-4 text-center">
                          <p className="text-xs mb-2">Transmissão em andamento</p>
                          <a
                            href={feedData.aovivo.live_url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-white text-red-600 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                          >
                            Assistir no Provedor <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>

                    {feedData.aovivo.canal_youtube_url && (
                      <div className="flex justify-end">
                        <a
                          href={feedData.aovivo.canal_youtube_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/90 hover:text-white underline decoration-white/40"
                        >
                          Acessar Canal Oficial <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                ) : activeTab === 'aovivo' ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Tv size={28} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Nenhuma transmissão ao vivo</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        Fique atento aos horários dos cultos ou acesse o canal oficial para rever mensagens anteriores.
                      </p>
                    </div>
                    {feedData?.aovivo?.canal_youtube_url && (
                      <a
                        href={feedData.aovivo.canal_youtube_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
                      >
                        Canal da Igreja no YouTube <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ) : null}
              </section>
            )}

            {/* 2. SEÇÃO WEB RÁDIO (Visível em 'tudo' ou 'radio') */}
            {(activeTab === 'tudo' || activeTab === 'radio') && (
              <section className="space-y-3">
                {feedData?.radio?.disponivel ? (
                  <div className="bg-gradient-to-br from-emerald-700 to-teal-900 text-white rounded-2xl p-4 shadow-md overflow-hidden relative border border-emerald-600/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-200 uppercase tracking-wider">
                        <Radio size={14} className={isRadioPlaying ? 'animate-bounce text-emerald-300' : ''} />
                        Web Rádio Oficial
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-[10px] font-bold border border-emerald-400/30">
                        {isRadioPlaying ? 'Transmitindo' : 'No Ar'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-white truncate">
                          {feedData.radio.radio_nome || 'Web Rádio Eklésia'}
                        </h3>
                        <p className="text-xs text-emerald-200/80 mt-0.5">
                          {isRadioBuffering
                            ? 'Conectando ao streaming...'
                            : isRadioPlaying
                            ? 'Louvores e mensagens 24h'
                            : 'Toque no play para ouvir'}
                        </p>
                      </div>

                      {/* Botão Play / Pause */}
                      <button
                        onClick={toggleRadio}
                        disabled={isRadioBuffering}
                        className="w-13 h-13 rounded-full bg-white text-emerald-800 flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0"
                        title={isRadioPlaying ? 'Pausar rádio' : 'Tocar rádio'}
                      >
                        {isRadioBuffering ? (
                          <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                        ) : isRadioPlaying ? (
                          <Square size={20} className="fill-current text-emerald-800" />
                        ) : (
                          <Play size={22} className="fill-current text-emerald-800 ml-0.5" />
                        )}
                      </button>
                    </div>

                    {/* Controle de Volume e Erros */}
                    {isRadioPlaying && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/15">
                        <button onClick={toggleMute} className="text-emerald-200 hover:text-white">
                          {isRadioMuted || radioVolume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isRadioMuted ? 0 : radioVolume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-emerald-950/60 rounded-lg appearance-none cursor-pointer accent-white"
                        />
                      </div>
                    )}

                    {radioError && (
                      <p className="text-[11px] text-rose-200 bg-rose-950/50 p-2 rounded-xl mt-3">
                        {radioError}
                      </p>
                    )}
                  </div>
                ) : activeTab === 'radio' ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Radio size={28} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Web Rádio Indisponível</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        A transmissão da Web Rádio não está ativada no momento para este ministério.
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>
            )}

            {/* 3. SEÇÃO VÍDEOS (Visível em 'tudo' ou 'videos') */}
            {(activeTab === 'tudo' || activeTab === 'videos') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Video size={16} className="text-dark-blue" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Vídeos & Sermões
                    </h2>
                  </div>
                  {activeTab === 'tudo' && (
                    <button
                      onClick={() => setActiveTab('videos')}
                      className="text-xs font-semibold text-blue-600 flex items-center gap-0.5"
                    >
                      Ver todos <ChevronRight size={13} />
                    </button>
                  )}
                </div>

                {/* Filtro e Busca na aba de vídeos */}
                {activeTab === 'videos' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={videoSearch}
                        onChange={(e) => setVideoSearch(e.target.value)}
                        placeholder="Buscar sermão ou pregador..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                      {['todos', 'culto', 'estudo', 'evento', 'musica', 'outro'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedVideoCategory(cat)}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
                            selectedVideoCategory === cat
                              ? 'bg-dark-blue text-white shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {cat === 'todos' ? 'Todos' : CATEGORIA_LABELS[cat as CategoriaVideo] || cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista / Grid de Vídeos */}
                {loadingVideos ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="aspect-video bg-slate-200 rounded-2xl animate-pulse" />
                    <div className="aspect-video bg-slate-200 rounded-2xl animate-pulse" />
                  </div>
                ) : (activeTab === 'videos' ? videosList : feedData?.videos || []).length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                    <p className="text-xs text-slate-500">Nenhum vídeo disponível no momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(activeTab === 'videos' ? videosList : feedData?.videos || []).map((video: any) => (
                      <div
                        key={video.id}
                        onClick={() => setActiveVideoModal(video)}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer active:scale-[0.99] group"
                      >
                        <div className="aspect-video relative bg-slate-900">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.titulo}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Video size={28} />
                            </div>
                          )}

                          {/* Play overlay button */}
                          <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-md">
                            <Play size={16} className="fill-current ml-0.5" />
                          </div>

                          {/* Badges */}
                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-sm text-[10px] font-bold text-white">
                              {CATEGORIA_LABELS[video.categoria as CategoriaVideo] || video.categoria}
                            </span>
                            {video.destaque && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold flex items-center gap-0.5">
                                <Star size={10} className="fill-current" />
                              </span>
                            )}
                          </div>

                          {video.duracao_segundos && (
                            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                              {Math.floor(video.duracao_segundos / 60)} min
                            </div>
                          )}
                        </div>

                        <div className="p-3">
                          <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition">
                            {video.titulo}
                          </h3>
                          {video.autor_pregador && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                              <User size={11} /> {video.autor_pregador}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 4. SEÇÃO FOTOS / ÁLBUNS (Visível em 'tudo' ou 'fotos') */}
            {(activeTab === 'tudo' || activeTab === 'fotos') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon size={16} className="text-dark-blue" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Álbuns & Fotos
                    </h2>
                  </div>
                  {activeTab === 'tudo' && (
                    <button
                      onClick={() => setActiveTab('fotos')}
                      className="text-xs font-semibold text-blue-600 flex items-center gap-0.5"
                    >
                      Ver todos <ChevronRight size={13} />
                    </button>
                  )}
                </div>

                {loadingAlbuns ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="aspect-square bg-slate-200 rounded-2xl animate-pulse" />
                    <div className="aspect-square bg-slate-200 rounded-2xl animate-pulse" />
                  </div>
                ) : (activeTab === 'fotos' ? albunsList : feedData?.albuns || []).length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                    <p className="text-xs text-slate-500">Nenhum álbum de fotos disponível.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(activeTab === 'fotos' ? albunsList : feedData?.albuns || []).map((album: any) => (
                      <Link
                        key={album.id}
                        href={`/app/midia/albuns/${album.id}`}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer active:scale-[0.98] group flex flex-col justify-between"
                      >
                        <div className="aspect-square relative bg-slate-900 overflow-hidden">
                          {album.capa_url ? (
                            <img
                              src={album.capa_url}
                              alt={album.titulo}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                              <ImageIcon size={32} />
                            </div>
                          )}

                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1">
                            <ImageIcon size={10} />
                            {album.total_fotos || 0}
                          </div>
                        </div>

                        <div className="p-3">
                          <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition">
                            {album.titulo}
                          </h3>
                          {album.data_evento && (
                            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                              <Calendar size={10} />
                              {new Date(album.data_evento).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 5. SEÇÃO NOTÍCIAS (Visível em 'tudo' ou 'noticias') */}
            {(activeTab === 'tudo' || activeTab === 'noticias') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Megaphone size={16} className="text-dark-blue" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Notícias & Avisos
                    </h2>
                  </div>
                  {activeTab === 'tudo' && (
                    <Link
                      href="/app/comunicados"
                      className="text-xs font-semibold text-blue-600 flex items-center gap-0.5"
                    >
                      Ver mural <ChevronRight size={13} />
                    </Link>
                  )}
                </div>

                {(feedData?.noticias || []).length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                    <p className="text-xs text-slate-500">Nenhum comunicado recente.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(feedData?.noticias || []).map((noticia: any) => (
                      <Link
                        key={noticia.id}
                        href={`/app/comunicados/${noticia.id}`}
                        className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs hover:shadow-md transition flex items-center justify-between gap-3 active:scale-[0.99] group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">
                              {noticia.categoria || 'Geral'}
                            </span>
                            {noticia.publicado_em && (
                              <span className="text-[10px] text-slate-400">
                                {new Date(noticia.publicado_em).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                            {noticia.titulo}
                          </h3>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* Modal Player de Vídeo Sanitizado */}
        {activeVideoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white truncate max-w-xs">
                  {activeVideoModal.titulo}
                </h3>
                <button
                  onClick={() => setActiveVideoModal(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="aspect-video w-full bg-black">
                {activeVideoModal.youtube_id ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${activeVideoModal.youtube_id}?autoplay=1`}
                    title={activeVideoModal.titulo}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white">
                    <p className="text-xs text-slate-300 mb-3">Vídeo disponível no link oficial:</p>
                    <a
                      href={activeVideoModal.url_video}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      Abrir Vídeo <ExternalLink size={13} />
                    </a>
                  </div>
                )}
              </div>

              {activeVideoModal.descricao && (
                <div className="p-4 bg-slate-900/90 text-xs text-slate-300 border-t border-slate-800/80">
                  <p className="line-clamp-3">{activeVideoModal.descricao}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
