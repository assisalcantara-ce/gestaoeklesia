'use client';

/**
 * /secretaria/midia/radio — Configuração e Gestão da Web Rádio
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import {
  Radio,
  Play,
  Square,
  Volume2,
  VolumeX,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function SecretariaMidiaRadioPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria');
  const supabase = useMemo(() => createClient(), []);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [radioNome, setRadioNome] = useState('Web Rádio');
  const [radioStreamUrl, setRadioStreamUrl] = useState('');
  const [radioAtiva, setRadioAtiva] = useState(false);

  // Audio Player Test State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
          setRadioNome(data.radio_nome || 'Web Rádio');
          setRadioStreamUrl(data.radio_stream_url || '');
          setRadioAtiva(data.radio_ativa || false);
        }
      } catch (err: any) {
        console.error('Erro ao carregar configurações de rádio:', err);
      }
    }

    loadConfig();
  }, [ctx?.ministryId, supabase]);

  // Audio Player Handler
  function togglePlay() {
    if (!radioStreamUrl.trim()) {
      setAudioError('Insira uma URL de streaming válida para testar.');
      return;
    }

    setAudioError(null);

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsPlaying(false);
      setIsAudioLoading(false);
    } else {
      setIsAudioLoading(true);
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audio = audioRef.current;
      audio.src = radioStreamUrl.trim();
      audio.volume = isMuted ? 0 : volume;

      audio.oncanplay = () => {
        setIsAudioLoading(false);
        audio.play().catch((err) => {
          console.error('Erro ao iniciar áudio:', err);
          setAudioError('Não foi possível reproduzir este stream. Verifique a URL e o protocolo (HTTPS).');
          setIsPlaying(false);
          setIsAudioLoading(false);
        });
      };

      audio.onerror = () => {
        setIsAudioLoading(false);
        setIsPlaying(false);
        setAudioError('Falha de conexão com a URL de áudio. Verifique se o servidor de streaming está online e aceita HTTPS/CORS.');
      };

      setIsPlaying(true);
    }
  }

  function handleVolumeChange(newVol: number) {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : newVol;
    }
  }

  function toggleMute() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.volume = nextMuted ? 0 : volume;
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx?.ministryId) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        ministry_id: ctx.ministryId,
        radio_nome: radioNome.trim() || 'Web Rádio',
        radio_stream_url: radioStreamUrl.trim() || null,
        radio_ativa: radioAtiva,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('midia_configuracoes')
        .upsert(payload, { onConflict: 'ministry_id' });

      if (error) throw error;

      setSuccessMsg('Configurações da Web Rádio salvas com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar rádio:', err);
      setErrorMsg(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  if (bloqueado) return null;

  return (
    <PageLayout
      title="Configuração da Web Rádio"
      description="Gerencie a transmissão contínua de áudio, louvores e mensagens para os membros"
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
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
              <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <Radio className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Web Rádio Oficial
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configurações de streaming de áudio contínuo
            </p>
          </div>
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

        {/* Form e Configurações */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleSave} className="space-y-5">
                {/* Nome da Rádio */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nome da Rádio / Estação *
                  </label>
                  <input
                    type="text"
                    required
                    value={radioNome}
                    onChange={(e) => setRadioNome(e.target.value)}
                    placeholder="Ex: Rádio Eklésia FM, Voz da Esperança"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* URL do Streaming */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    URL do Stream de Áudio (Icecast / Shoutcast / AAC / MP3) *
                  </label>
                  <input
                    type="url"
                    value={radioStreamUrl}
                    onChange={(e) => setRadioStreamUrl(e.target.value)}
                    placeholder="https://servidor.radio.com:8000/stream ou .aac / .mp3"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Recomendamos utilizar uma URL segura com protocolo <strong>https://</strong> para compatibilidade total com navegadores e app mobile PWA.
                  </p>
                </div>

                {/* Switch Ativa / Inativa */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={radioAtiva}
                      onChange={(e) => setRadioAtiva(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                        Web Rádio Ativa no Aplicativo Mobile
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">
                        Quando ativada, a rádio aparecerá no menu e player mobile dos membros.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Botão Salvar */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Salvando...' : 'Salvar Configurações'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Teste do Player / Informações */}
          <div className="md:col-span-5 space-y-6">
            {/* Player de Teste */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 text-white shadow-lg space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {isPlaying ? 'Transmitindo Ao Vivo' : 'Player em Espera'}
                  </span>
                </div>
                {radioAtiva && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30">
                    No Ar
                  </span>
                )}
              </div>

              <div className="text-center py-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Radio className={`w-10 h-10 ${isPlaying ? 'animate-bounce' : ''}`} />
                </div>
                <h3 className="text-lg font-bold truncate">{radioNome || 'Web Rádio'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Streaming de Áudio Oficial</p>
              </div>

              {audioError && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-300">
                  {audioError}
                </div>
              )}

              {/* Controles do Player */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={!radioStreamUrl.trim()}
                    className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                    title={isPlaying ? 'Pausar reprodução' : 'Iniciar teste do streaming'}
                  >
                    {isAudioLoading ? (
                      <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    ) : isPlaying ? (
                      <Square className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                {/* Volume slider */}
                <div className="flex items-center gap-2 pt-2 px-4">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* Dicas e Recomendações */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                Formatos e Servidores Suportados
              </h4>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed list-disc list-inside">
                <li>
                  <strong>Icecast & Shoutcast:</strong> URLs diretas como <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">https://stream.exemplo.com/live</code>
                </li>
                <li>
                  <strong>HTTPS Obrigatório:</strong> Devido às políticas de segurança dos navegadores, streams em HTTP não tocarão em sites com certificado SSL.
                </li>
                <li>
                  <strong>Codecs recomendados:</strong> AAC (64kbps/128kbps) ou MP3 (128kbps) para consumo leve no celular.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
