'use client';

/**
 * /secretaria/midia — Visão Geral e Painel da Central de Mídia
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import {
  Image as ImageIcon,
  Video,
  Radio,
  Tv,
  Megaphone,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface MidiaOverviewMetrics {
  totalAlbuns: number;
  totalFotos: number;
  totalVideos: number;
  radioAtiva: boolean;
  radioNome: string | null;
  isAoVivo: boolean;
  canalYoutube: string | null;
  noticiasCount: number;
}

export default function SecretariaMidiaPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria');
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MidiaOverviewMetrics>({
    totalAlbuns: 0,
    totalFotos: 0,
    totalVideos: 0,
    radioAtiva: false,
    radioNome: null,
    isAoVivo: false,
    canalYoutube: null,
    noticiasCount: 0,
  });

  const [recentAlbuns, setRecentAlbuns] = useState<any[]>([]);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!ctx?.ministryId) return;
      setLoading(true);

      try {
        // 1. Contagem de Álbuns
        const { count: albunsCount } = await supabase
          .from('midia_albuns')
          .select('id', { count: 'exact', head: true })
          .eq('ministry_id', ctx.ministryId);

        // 2. Contagem de Fotos
        const { count: fotosCount } = await supabase
          .from('midia_fotos')
          .select('id', { count: 'exact', head: true })
          .eq('ministry_id', ctx.ministryId);

        // 3. Contagem de Vídeos
        const { count: videosCount } = await supabase
          .from('midia_videos')
          .select('id', { count: 'exact', head: true })
          .eq('ministry_id', ctx.ministryId);

        // 4. Configurações de Mídia
        const { data: cfgData } = await supabase
          .from('midia_configuracoes')
          .select('*')
          .eq('ministry_id', ctx.ministryId)
          .maybeSingle();

        // 5. Notícias / Comunicados
        const { count: noticiasCount } = await supabase
          .from('secretaria_comunicados')
          .select('id', { count: 'exact', head: true })
          .eq('ministry_id', ctx.ministryId);

        // 6. Recentes
        const { data: albunsRecentes } = await supabase
          .from('midia_albuns')
          .select('id, titulo, capa_url, data_evento, ativo, created_at')
          .eq('ministry_id', ctx.ministryId)
          .order('created_at', { ascending: false })
          .limit(4);

        const { data: videosRecentes } = await supabase
          .from('midia_videos')
          .select('id, titulo, thumbnail_url, categoria, autor_pregador, ativo, created_at')
          .eq('ministry_id', ctx.ministryId)
          .order('created_at', { ascending: false })
          .limit(4);

        setMetrics({
          totalAlbuns: albunsCount || 0,
          totalFotos: fotosCount || 0,
          totalVideos: videosCount || 0,
          radioAtiva: cfgData?.radio_ativa || false,
          radioNome: cfgData?.radio_nome || null,
          isAoVivo: cfgData?.is_aovivo || false,
          canalYoutube: cfgData?.canal_youtube_url || null,
          noticiasCount: noticiasCount || 0,
        });

        setRecentAlbuns(albunsRecentes || []);
        setRecentVideos(videosRecentes || []);
      } catch (err) {
        console.error('Erro ao carregar dados da central de mídia:', err);
      } finally {
        setLoading(false);
      }
    }

    if (!ctx?.loading && ctx?.ministryId) {
      loadData();
    }
  }, [ctx?.loading, ctx?.ministryId, supabase]);

  if (bloqueado) return null;

  return (
    <PageLayout
      title="Central de Comunicação & Mídia"
      description="Gerencie álbuns de fotos, vídeos, transmissões ao vivo, web rádio e notícias oficiais do ministério."
    >
      <div className="space-y-6">
        {/* Banner Informativo */}
        <div className="bg-gradient-to-r from-[#123b63] to-[#1e588f] rounded-2xl p-6 text-white shadow-sm relative overflow-hidden flex items-center justify-between">
          <div className="space-y-2 max-w-2xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Painel Administrativo Oficial</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Central de Conteúdo e Transmissões</h2>
            <p className="text-sm text-blue-100/90 leading-relaxed">
              Publique os registros fotográficos de cultos e congressos, alimente o catálogo de mensagens em vídeo, transmita cultos ao vivo e transmita a Web Rádio diretamente para o aplicativo dos membros.
            </p>
          </div>
          <div className="absolute -right-6 -bottom-8 opacity-10 text-white pointer-events-none">
            <Video className="w-48 h-48" />
          </div>
        </div>

        {/* Métricas Executivas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ExecutiveMetricCard
            title="Álbuns & Galerias"
            value={loading ? 0 : metrics.totalAlbuns}
            subtitle={`${metrics.totalFotos} fotos no total`}
            icon={ImageIcon}
            color="blue"
            loading={loading}
          />
          <ExecutiveMetricCard
            title="Vídeos & Mensagens"
            value={loading ? 0 : metrics.totalVideos}
            subtitle="Sermões e estudos catalogados"
            icon={Video}
            color="indigo"
            loading={loading}
          />
          <ExecutiveMetricCard
            title="Transmissão Ao Vivo"
            value={loading ? '...' : metrics.isAoVivo ? 'NO AR' : 'Fora do Ar'}
            subtitle={metrics.isAoVivo ? 'Live ativa para os membros' : 'Nenhuma transmissão no momento'}
            icon={Tv}
            color={metrics.isAoVivo ? 'rose' : 'slate'}
            badgeText={metrics.isAoVivo ? 'AO VIVO' : undefined}
            loading={loading}
          />
          <ExecutiveMetricCard
            title="Web Rádio"
            value={loading ? '...' : metrics.radioAtiva ? 'No Ar' : 'Inativa'}
            subtitle={metrics.radioNome || 'Streaming de áudio'}
            icon={Radio}
            color={metrics.radioAtiva ? 'emerald' : 'slate'}
            badgeText={metrics.radioAtiva ? 'ON' : undefined}
            loading={loading}
          />
        </div>

        {/* Atalhos Rápidos para Módulos de Mídia */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Módulos da Central de Mídia
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: Álbuns */}
            <div
              onClick={() => router.push('/secretaria/midia/albuns')}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition">
                    Álbuns de Fotos
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Crie álbuns fotográficos de eventos, cultos e congressos com upload de múltiplas fotos.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-blue-600">
                <span>Gerenciar álbuns</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2: Vídeos */}
            <div
              onClick={() => router.push('/secretaria/midia/videos')}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition">
                    Catálogo de Vídeos
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Cadastre sermões, mensagens, estudos bíblicos e vídeos musicais via link do YouTube.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                <span>Gerenciar vídeos</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 3: Transmissões Ao Vivo */}
            <div
              onClick={() => router.push('/secretaria/midia/aovivo')}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-rose-300 transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-rose-600 transition">
                    Cultos Ao Vivo (Live)
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Ative ou desative transmissões ao vivo do YouTube, Facebook ou canal oficial da igreja.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-rose-600">
                <span>Configurar Live</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 4: Web Rádio */}
            <div
              onClick={() => router.push('/secretaria/midia/radio')}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-emerald-600 transition">
                    Web Rádio
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Configure a URL do streaming da rádio gospel da igreja com player de teste integrado.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                <span>Configurar Web Rádio</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 5: Mural de Notícias (Reutilização de secretaria_comunicados) */}
            <div
              onClick={() => router.push('/secretaria/comunicados')}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-amber-300 transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-amber-600 transition">
                    Mural de Comunicados & Notícias
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Publique comunicados oficiais, notícias institucionais e informes departamentais.
                  </p>
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-amber-600">
                <span>Ver comunicados ({metrics.noticiasCount})</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Prévia de Conteúdos Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Álbuns Recentes */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>Últimos Álbuns de Fotos</span>
              </h3>
              <button
                onClick={() => router.push('/secretaria/midia/albuns')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Ver todos
              </button>
            </div>

            {recentAlbuns.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">Nenhum álbum cadastrado ainda.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recentAlbuns.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => router.push('/secretaria/midia/albuns')}
                    className="border border-gray-100 rounded-xl overflow-hidden hover:border-blue-200 transition cursor-pointer"
                  >
                    <div className="w-full h-24 bg-gray-100 relative">
                      {album.capa_url ? (
                        <img
                          src={album.capa_url}
                          alt={album.titulo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-bold text-gray-800 truncate">{album.titulo}</p>
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        {album.data_evento || 'Sem data'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vídeos Recentes */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-600" />
                <span>Últimos Vídeos Cadastrados</span>
              </h3>
              <button
                onClick={() => router.push('/secretaria/midia/videos')}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Ver todos
              </button>
            </div>

            {recentVideos.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">Nenhum vídeo cadastrado ainda.</p>
            ) : (
              <div className="space-y-2.5">
                {recentVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => router.push('/secretaria/midia/videos')}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition cursor-pointer"
                  >
                    <div className="w-16 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.titulo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Video className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{video.titulo}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                        <span className="capitalize px-1.5 py-0.2 rounded bg-gray-100 font-semibold">
                          {video.categoria}
                        </span>
                        {video.pregador_nome && <span className="truncate">{video.pregador_nome}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
