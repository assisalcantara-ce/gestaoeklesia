'use client';

/**
 * /secretaria/midia/aovivo — Controle e Configuração de Transmissão Ao Vivo
 */

import { useEffect, useState, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import {
  extractYouTubeVideoId,
  LIVE_PROVIDERS,
  LiveProvider,
} from '@/lib/midia-utils';
import {
  Tv,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Video,
  Youtube,
  Info,
} from 'lucide-react';
import Link from 'next/link';

export default function SecretariaMidiaAoVivoPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria');
  const supabase = useMemo(() => createClient(), []);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [isAoVivo, setIsAoVivo] = useState(false);
  const [liveProvider, setLiveProvider] = useState<LiveProvider>('youtube');
  const [liveUrlAtual, setLiveUrlAtual] = useState('');
  const [canalYoutubeUrl, setCanalYoutubeUrl] = useState('');

  useEffect(() => {
    async function loadConfig() {
      if (!ctx?.ministryId) return;

      try {
        const { data, error } = await supabase
          .from('midia_configuracoes')
          .select('*')
          .eq('ministry_id', ctx.ministryId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setIsAoVivo(data.is_aovivo || false);
          setLiveProvider((data.live_provider as LiveProvider) || 'youtube');
          setLiveUrlAtual(data.live_url_atual || '');
          setCanalYoutubeUrl(data.canal_youtube_url || '');
        }
      } catch (err: any) {
        console.error('Erro ao carregar configurações de ao vivo:', err);
      }
    }

    loadConfig();
  }, [ctx?.ministryId, supabase]);

  // Derived YouTube Embed for Live
  const liveYtId = useMemo(() => {
    if (liveProvider === 'youtube' && liveUrlAtual) {
      return extractYouTubeVideoId(liveUrlAtual);
    }
    return null;
  }, [liveProvider, liveUrlAtual]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx?.ministryId) return;

    if (isAoVivo && !liveUrlAtual.trim()) {
      setErrorMsg('Para ativar a transmissão ao vivo, informe a URL do streaming atual.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        ministry_id: ctx.ministryId,
        is_aovivo: isAoVivo,
        live_provider: liveProvider,
        live_url_atual: liveUrlAtual.trim() || null,
        canal_youtube_url: canalYoutubeUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('midia_configuracoes')
        .upsert(payload, { onConflict: 'ministry_id' });

      if (error) throw error;

      setSuccessMsg('Configurações de Transmissão Ao Vivo salvas com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar ao vivo:', err);
      setErrorMsg(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  // Quick toggle helper
  async function handleQuickToggleLive() {
    if (!ctx?.ministryId) return;
    const nextStatus = !isAoVivo;

    if (nextStatus && !liveUrlAtual.trim()) {
      setErrorMsg('Informe a URL do streaming antes de iniciar a transmissão.');
      return;
    }

    try {
      const { error } = await supabase
        .from('midia_configuracoes')
        .upsert(
          {
            ministry_id: ctx.ministryId,
            is_aovivo: nextStatus,
            live_provider: liveProvider,
            live_url_atual: liveUrlAtual.trim() || null,
            canal_youtube_url: canalYoutubeUrl.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'ministry_id' }
        );

      if (error) throw error;
      setIsAoVivo(nextStatus);
      setSuccessMsg(
        nextStatus
          ? '🔴 TRANSMISSÃO AO VIVO INICIADA! Os membros verão o banner de culto ao vivo.'
          : 'Transmissão ao vivo encerrada com sucesso.'
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('Erro ao alterar status da live: ' + err.message);
    }
  }

  if (bloqueado) return null;

  return (
    <PageLayout
      title="Transmissão Ao Vivo"
      description="Controle o status do culto ao vivo, configure links do YouTube, Facebook ou HLS"
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
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
                  <Tv className="w-5 h-5" />
                </span>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Transmissão Ao Vivo
                </h1>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Controle o status do culto ao vivo e integrações de streaming
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuickToggleLive}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all active:scale-[0.98] ${
              isAoVivo
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isAoVivo ? 'bg-white' : 'bg-rose-500'}`} />
            {isAoVivo ? 'Encerrar Culto Ao Vivo' : 'Entrar Ao Vivo Agora'}
          </button>
        </div>

        {/* Feedback alerts */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Grid de Configurações e Prévia */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Formulário */}
          <div className="md:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleSave} className="space-y-5">
                {/* Status Switch */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isAoVivo ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
                        Status da Transmissão (No Ar)
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ativa o banner de transmissão ao vivo no início do aplicativo mobile.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isAoVivo}
                      onChange={(e) => setIsAoVivo(e.target.checked)}
                      className="w-5 h-5 rounded text-red-600 focus:ring-red-500 border-slate-300 dark:border-slate-700"
                    />
                  </label>
                </div>

                {/* Provedor */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Plataforma / Provedor de Live *
                  </label>
                  <select
                    value={liveProvider}
                    onChange={(e) => setLiveProvider(e.target.value as LiveProvider)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                  >
                    {LIVE_PROVIDERS.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov === 'youtube'
                          ? 'YouTube Live (Recomendado)'
                          : prov === 'facebook'
                          ? 'Facebook Live'
                          : prov === 'vimeo'
                          ? 'Vimeo Live'
                          : prov === 'hls'
                          ? 'HLS Stream (.m3u8)'
                          : 'Outro Player Embed'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* URL Atual do Streaming */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    URL da Transmissão Atual *
                  </label>
                  <input
                    type="url"
                    value={liveUrlAtual}
                    onChange={(e) => setLiveUrlAtual(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cole o link do vídeo ao vivo que está sendo transmitido neste momento.
                  </p>
                </div>

                {/* Canal Oficial do YouTube */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Canal Oficial da Igreja no YouTube (Opcional)
                  </label>
                  <input
                    type="url"
                    value={canalYoutubeUrl}
                    onChange={(e) => setCanalYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/@seucanaligreja"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-white"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Atalho para os membros se inscreverem e acessarem os cultos anteriores.
                  </p>
                </div>

                {/* Botão Salvar */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm shadow-sm transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Salvando...' : 'Salvar Configurações'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Prévia da Transmissão */}
          <div className="md:col-span-5 space-y-6">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isAoVivo ? 'bg-rose-500 animate-ping' : 'bg-slate-500'}`} />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    {isAoVivo ? '🔴 Prévia Ao Vivo' : 'Prévia do Player'}
                  </span>
                </div>
                {liveProvider === 'youtube' && (
                  <Youtube className="w-4 h-4 text-red-500" />
                )}
              </div>

              {/* Player Preview */}
              <div className="aspect-video w-full bg-black relative flex items-center justify-center">
                {liveYtId ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${liveYtId}`}
                    title="Live Preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : liveUrlAtual ? (
                  <div className="p-6 text-center text-slate-400 text-xs space-y-2">
                    <Video className="w-8 h-8 mx-auto text-slate-600" />
                    <p>Stream externo configurado:</p>
                    <code className="text-[11px] bg-slate-900 px-2 py-1 rounded block truncate text-slate-300">
                      {liveUrlAtual}
                    </code>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs space-y-1">
                    <Tv className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                    <p>Nenhuma transmissão ativa.</p>
                    <p className="text-[11px] text-slate-600">
                      Insira o link da live para visualizar o player.
                    </p>
                  </div>
                )}
              </div>

              {/* Status footer */}
              <div className="p-4 bg-slate-900/60 border-t border-slate-800/80 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Provedor:</span>
                  <span className="font-semibold uppercase text-white">{liveProvider}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Visibilidade Mobile:</span>
                  <span className={`font-semibold ${isAoVivo ? 'text-rose-400' : 'text-slate-400'}`}>
                    {isAoVivo ? 'Em Destaque (Ao Vivo)' : 'Inativo / Oculto'}
                  </span>
                </div>
              </div>
            </div>

            {/* Informações adicionais */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-500" />
                Dica para Lives no YouTube
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Você pode utilizar tanto a URL do link direto da live (<code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">youtube.com/watch?v=...</code>) quanto o link de compartilhamento curto (<code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">youtu.be/...</code>).
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
