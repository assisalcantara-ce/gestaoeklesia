'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  QrCode,
  Camera,
  AlertTriangle,
  XCircle,
  Gift,
  Bed,
  Keyboard,
  MapPin,
  Calendar,
  Search,
  Check,
} from 'lucide-react';

interface EventoPublicoCheckin {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  local_nome: string | null;
  status: string;
  igreja_nome: string;
  total_confirmados: number;
  total_presentes: number;
}

interface ParticipanteCheckin {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  tem_brinde?: boolean;
  com_hospedagem?: boolean;
}

type FeedbackResult =
  | {
      type: 'sucesso';
      mensagem: string;
      participante: ParticipanteCheckin;
      checkin_em: string;
      evento_titulo?: string;
    }
  | {
      type: 'ja_realizado';
      mensagem: string;
      participante: ParticipanteCheckin;
      checkin_em: string;
      evento_titulo?: string;
    }
  | {
      type: 'erro';
      mensagem: string;
      detalhe?: string;
    };

/**
 * Emite um pequeno sinal sonoro positivo ou de alerta usando Web Audio API
 */
function playAudioFeedback(type: 'sucesso' | 'alerta' | 'erro') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'sucesso') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'alerta') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Ignora se áudio for bloqueado pelo navegador
  }
}

export default function CheckinPublicoPage() {
  const { token } = useParams<{ token: string }>();

  const [evento, setEvento] = useState<EventoPublicoCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkExpirado, setLinkExpirado] = useState(false);
  const [motivoExpiracao, setMotivoExpiracao] = useState<string | null>(null);

  // Modo de Leitura: 'camera' ou 'manual'
  const [modo, setModo] = useState<'camera' | 'manual'>('camera');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState('');
  const [processando, setProcessando] = useState(false);

  // Resultado do Check-in
  const [resultado, setResultado] = useState<FeedbackResult | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScanningRef = useRef(false);

  // 1. Carregar dados do evento via Token
  const carregarEvento = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/public/eventos/check-in/${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok) {
        setLinkExpirado(true);
        setMotivoExpiracao(data.motivo || data.error || 'Este link de check-in não está mais disponível.');
        setEvento(null);
      } else {
        setEvento(data.evento);
        setLinkExpirado(false);
      }
    } catch {
      setLinkExpirado(true);
      setMotivoExpiracao('Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    carregarEvento();
  }, [carregarEvento]);

  // 2. Parar stream de câmera
  const pararCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
    isScanningRef.current = false;
  }, []);

  // 3. Processar Check-in via API
  const executarCheckin = useCallback(
    async (codigo: string) => {
      if (!token || !codigo.trim() || processando) return;

      setProcessando(true);
      pararCamera();

      try {
        const res = await fetch(`/api/v1/public/eventos/check-in/${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: codigo.trim() }),
        });

        const data = await res.json();

        if (!res.ok) {
          playAudioFeedback('erro');
          setResultado({
            type: 'erro',
            mensagem: data.error || 'QR Code inválido ou inscrição não encontrada.',
            detalhe: data.code,
          });
        } else if (data.status === 'ja_realizado') {
          playAudioFeedback('alerta');
          setResultado({
            type: 'ja_realizado',
            mensagem: data.mensagem,
            participante: data.participante,
            checkin_em: data.checkin_em,
            evento_titulo: data.evento_titulo,
          });
          if (data.total_presentes != null && data.total_confirmados != null) {
            setEvento(prev => (prev ? { ...prev, total_presentes: data.total_presentes, total_confirmados: data.total_confirmados } : prev));
          }
        } else {
          playAudioFeedback('sucesso');
          setResultado({
            type: 'sucesso',
            mensagem: data.mensagem,
            participante: data.participante,
            checkin_em: data.checkin_em,
            evento_titulo: data.evento_titulo,
          });
          if (data.total_presentes != null && data.total_confirmados != null) {
            setEvento(prev => (prev ? { ...prev, total_presentes: data.total_presentes, total_confirmados: data.total_confirmados } : prev));
          }
        }
      } catch (err: any) {
        playAudioFeedback('erro');
        setResultado({
          type: 'erro',
          mensagem: 'Erro de conexão ao processar o check-in.',
          detalhe: err?.message,
        });
      } finally {
        setProcessando(false);
      }
    },
    [token, processando, pararCamera]
  );

  // 4. Iniciar Leitor de Câmera
  const iniciarCamera = useCallback(async () => {
    setCameraErro(null);
    setResultado(null);
    setCodigoManual('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraErro('Seu navegador não possui suporte a acesso de câmera.');
      setModo('manual');
      return;
    }

    try {
      pararCamera();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraAtiva(true);
        isScanningRef.current = true;

        // Iniciar loop de leitura de QR Code
        const BarcodeDetectorClass = (window as any).BarcodeDetector;

        if (BarcodeDetectorClass) {
          const barcodeDetector = new BarcodeDetectorClass({ formats: ['qr_code'] });
          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || !isScanningRef.current) return;
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const qrValue = barcodes[0].rawValue;
                if (qrValue && isScanningRef.current) {
                  isScanningRef.current = false;
                  executarCheckin(qrValue);
                }
              }
            } catch {
              // frame bypass
            }
          }, 250);
        }
      }
    } catch (err: any) {
      console.warn('[CameraCheckin] Erro ao abrir câmera:', err);
      setCameraErro('Permissão de câmera negada ou dispositivo indisponível. Use o modo manual.');
      setCameraAtiva(false);
    }
  }, [pararCamera, executarCheckin]);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, [pararCamera]);

  // Se o modo mudar para câmera e não houver resultado em exibição, abre automaticamente
  useEffect(() => {
    if (modo === 'camera' && !resultado && !cameraAtiva && !cameraErro && evento) {
      iniciarCamera();
    }
  }, [modo, resultado, cameraAtiva, cameraErro, evento, iniciarCamera]);

  const reiniciarParaProximaLeitura = () => {
    setResultado(null);
    setCodigoManual('');
    if (modo === 'camera') {
      iniciarCamera();
    }
  };

  // ── 1. TELA DE CARREGAMENTO ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-300">Conectando ao Check-in do Evento...</p>
      </div>
    );
  }

  // ── 2. TELA DE LINK EXPIRADO / INVÁLIDO ──
  if (linkExpirado || !evento) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/90 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <XCircle className="w-9 h-9" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Link Indisponível</h2>
            <p className="text-sm text-slate-400 font-medium">
              {motivoExpiracao || 'Este link de check-in não está mais disponível ou expirou.'}
            </p>
          </div>
          <div className="pt-3 border-t border-slate-700/60 text-xs text-slate-500">
            Solicite um novo link à equipe organizadora do evento.
          </div>
        </div>
      </div>
    );
  }

  // ── 3. TELA PRINCIPAL: CHECK-IN MOBILE-FIRST ──
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Header Fixo do Evento */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block truncate">
                {evento.igreja_nome}
              </span>
              <h1 className="text-sm font-black text-white truncate leading-tight">
                {evento.titulo}
              </h1>
            </div>
          </div>

          {/* Badge de Indicador em Tempo Real */}
          <div className="shrink-0 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-right">
            <span className="text-[10px] font-semibold text-slate-400 block">Presentes</span>
            <span className="text-xs font-black text-emerald-400">
              {evento.total_presentes} <span className="text-slate-500 font-normal">/ {evento.total_confirmados}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-between space-y-4">
        {/* Banner com Detalhes Rápidos */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 p-3.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>{new Date(evento.data_inicio).toLocaleDateString('pt-BR')} às {new Date(evento.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {evento.local_nome && (
            <div className="flex items-center gap-1.5 truncate max-w-[150px]" title={evento.local_nome}>
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{evento.local_nome}</span>
            </div>
          )}
        </div>

        {/* ── ÁREA PRINCIPAL DINÂMICA ── */}
        <div className="flex-1 flex flex-col justify-center my-auto">
          {resultado ? (
            /* ── TELA DE RESULTADO / FEEDBACK ── */
            <div
              className={`rounded-3xl border p-6 text-center shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 ${
                resultado.type === 'sucesso'
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-100'
                  : resultado.type === 'ja_realizado'
                  ? 'bg-amber-950/70 border-amber-500/50 text-amber-100'
                  : 'bg-rose-950/70 border-rose-500/50 text-rose-100'
              }`}
            >
              {/* Ícone de Destaque */}
              <div
                className={`w-18 h-18 rounded-full flex items-center justify-center mx-auto shadow-lg ${
                  resultado.type === 'sucesso'
                    ? 'bg-emerald-500 text-slate-950'
                    : resultado.type === 'ja_realizado'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {resultado.type === 'sucesso' && <Check className="w-10 h-10 stroke-[3]" />}
                {resultado.type === 'ja_realizado' && <AlertTriangle className="w-10 h-10 stroke-[2.5]" />}
                {resultado.type === 'erro' && <XCircle className="w-10 h-10 stroke-[2.5]" />}
              </div>

              {/* Textos */}
              <div className="space-y-1">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block ${
                    resultado.type === 'sucesso'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : resultado.type === 'ja_realizado'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {resultado.type === 'sucesso'
                    ? 'Check-in Confirmado'
                    : resultado.type === 'ja_realizado'
                    ? 'Já Realizado'
                    : 'Atenção'}
                </span>

                <h2 className="text-xl font-black text-white pt-1">
                  {resultado.type === 'erro'
                    ? resultado.mensagem
                    : resultado.participante.nome}
                </h2>

                {resultado.type !== 'erro' && (
                  <p className="text-xs text-slate-300 font-medium">
                    {resultado.type === 'ja_realizado'
                      ? `Primeiro check-in registrado em ${new Date(resultado.checkin_em).toLocaleString('pt-BR')}`
                      : `Check-in realizado às ${new Date(resultado.checkin_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                  </p>
                )}
              </div>

              {/* Benefícios contemplados se houver */}
              {resultado.type !== 'erro' && (resultado.participante.tem_brinde || resultado.participante.com_hospedagem) && (
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  {resultado.participante.tem_brinde && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                      <Gift className="w-3.5 h-3.5" /> Brinde Contemplado 🎁
                    </span>
                  )}
                  {resultado.participante.com_hospedagem && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <Bed className="w-3.5 h-3.5" /> Hospedagem Inclusa 🛏️
                    </span>
                  )}
                </div>
              )}

              {/* Botão de Ação Imediata */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={reiniciarParaProximaLeitura}
                  className="w-full py-4 rounded-2xl bg-white text-slate-950 font-black text-sm hover:bg-slate-100 active:scale-98 transition shadow-lg flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  <span>Próxima Leitura</span>
                </button>
              </div>
            </div>
          ) : modo === 'camera' ? (
            /* ── MODO CÂMERA AO VIVO ── */
            <div className="space-y-3">
              <div className="relative aspect-square w-full max-w-[320px] mx-auto bg-black rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl flex items-center justify-center">
                {cameraAtiva ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                    {/* Alvo visual de mira do QR Code */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                      <div className="w-48 h-48 border-2 border-emerald-400/80 rounded-2xl relative shadow-inner">
                        {/* Linha de laser escaneadora */}
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce" />
                        {/* Cantoneiras */}
                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <Camera className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      {cameraErro || 'Câmera desativada ou aguardando permissão.'}
                    </p>
                    <button
                      type="button"
                      onClick={iniciarCamera}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                    >
                      Ativar Câmera
                    </button>
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-slate-400 font-medium">
                Aponte a câmera para o QR Code do comprovante
              </p>
            </div>
          ) : (
            /* ── MODO DIGITAÇÃO MANUAL ── */
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-2">
                  <Keyboard className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white">Validação Manual</h3>
                <p className="text-xs text-slate-400">
                  Informe o código de 8 dígitos da inscrição ou o nome do participante.
                </p>
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (codigoManual.trim()) {
                    executarCheckin(codigoManual.trim());
                  }
                }}
                className="space-y-3"
              >
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={codigoManual}
                    onChange={e => setCodigoManual(e.target.value.toUpperCase())}
                    placeholder="Ex: #A1B2C3D4 ou Nome"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!codigoManual.trim() || processando}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-50 transition active:scale-98 flex items-center justify-center gap-2 shadow-xs"
                >
                  {processando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Check-in</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── BARRA DE SELEÇÃO DE MODO INFERIOR ── */}
        {!resultado && (
          <div className="bg-slate-900/90 rounded-2xl p-1.5 border border-slate-800 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setModo('camera');
                iniciarCamera();
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                modo === 'camera'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Ler QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModo('manual');
                pararCamera();
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                modo === 'manual'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>Digitar Código</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer minimalista */}
      <footer className="py-2.5 text-center text-[10px] text-slate-500">
        Gestão Eklésia • Check-in Portaria
      </footer>
    </div>
  );
}
