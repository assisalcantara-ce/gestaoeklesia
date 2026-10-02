'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import jsQR from 'jsqr';
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
  RefreshCw,
  ShieldAlert,
  ChevronRight,
  User,
  Clock,
  Flashlight,
  FlashlightOff,
  Sparkles,
} from 'lucide-react';

interface EventoPublicoCheckin {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  local_nome: string | null;
  local_endereco?: string | null;
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

type CameraStatus = 'idle' | 'solicitando' | 'ativa' | 'erro';

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

function formatarDataHoraEvento(dataIso: string) {
  try {
    const d = new Date(dataIso);
    const dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dataStr} às ${horaStr}`;
  } catch {
    return dataIso;
  }
}

function formatarTimestampCheckin(dataIso: string) {
  try {
    const d = new Date(dataIso);
    const dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dataStr} às ${horaStr}`;
  } catch {
    return dataIso;
  }
}

export default function CheckinPublicoPage() {
  const { token } = useParams<{ token: string }>();

  const [evento, setEvento] = useState<EventoPublicoCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkExpirado, setLinkExpirado] = useState(false);
  const [motivoExpiracao, setMotivoExpiracao] = useState<string | null>(null);

  // Modo de Leitura: 'idle' (menu inicial) | 'camera' (scanner ativo) | 'manual' (digitação)
  const [modo, setModo] = useState<'idle' | 'camera' | 'manual'>('idle');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraErroMensagem, setCameraErroMensagem] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState('');
  const [processando, setProcessando] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Resultado do Check-in
  const [resultado, setResultado] = useState<FeedbackResult | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
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

  // 2. Parar stream de câmera e scanner
  const pararCamera = useCallback(() => {
    isScanningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setHasTorch(false);
    setCameraStatus('idle');
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
            setEvento((prev) =>
              prev
                ? { ...prev, total_presentes: data.total_presentes, total_confirmados: data.total_confirmados }
                : prev
            );
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
            setEvento((prev) =>
              prev
                ? { ...prev, total_presentes: data.total_presentes, total_confirmados: data.total_confirmados }
                : prev
            );
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

  // 4. Scanner Loop usando jsQR
  const startScanningLoop = useCallback(() => {
    isScanningRef.current = true;

    const scanFrame = () => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        const videoWidth = video.videoWidth || 640;
        const videoHeight = video.videoHeight || 480;

        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
          canvas.width = videoWidth;
          canvas.height = videoHeight;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
          try {
            const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (qrCode && qrCode.data && qrCode.data.trim()) {
              const qrValue = qrCode.data.trim();
              if (isScanningRef.current) {
                isScanningRef.current = false;
                executarCheckin(qrValue);
                return;
              }
            }
          } catch {
            // Ignora falhas de leitura em frames intermediários
          }
        }
      }

      if (isScanningRef.current) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [executarCheckin]);

  // 5. Iniciar Câmera acionado pelo usuário
  const iniciarCamera = useCallback(async () => {
    setModo('camera');
    setCameraErroMensagem(null);
    setResultado(null);
    setCodigoManual('');
    setCameraStatus('solicitando');

    // Validação de contexto seguro e APIs
    if (typeof window === 'undefined') return;

    if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCameraErroMensagem('O acesso à câmera requer conexão segura (HTTPS).');
      setCameraStatus('erro');
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraErroMensagem('Seu navegador não possui suporte à API de câmera.');
      setCameraStatus('erro');
      return;
    }

    try {
      // Parar stream anterior se houver
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      let stream: MediaStream;

      // Tentativa 1: câmera traseira ideal (environment)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (errFirst: any) {
        // Fallback: solicitar vídeo sem restrições
        if (errFirst?.name === 'OverconstrainedError' || errFirst?.name === 'ConstraintNotSatisfiedError') {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw errFirst;
        }
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error('Elemento de vídeo não encontrado.');
      }

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;

      // Detectar suporte a lanterna
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof (videoTrack as any).getCapabilities === 'function') {
        const capabilities = (videoTrack as any).getCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      }

      // Aguarda início da reprodução no Safari / Chrome
      await video.play();

      setCameraStatus('ativa');
      startScanningLoop();
    } catch (err: any) {
      console.warn('[CheckinCamera] Erro ao obter câmera:', err);
      setCameraStatus('erro');

      const errName = err?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraErroMensagem(
          'O acesso à câmera foi bloqueado. Permita o acesso à câmera nas configurações do navegador e tente novamente.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraErroMensagem('Nenhuma câmera foi encontrada neste dispositivo.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setCameraErroMensagem(
          'A câmera pode estar em uso por outro aplicativo ou temporariamente indisponível.'
        );
      } else if (errName === 'OverconstrainedError') {
        setCameraErroMensagem('A configuração da câmera não é suportada pelo dispositivo.');
      } else if (errName === 'SecurityError') {
        setCameraErroMensagem('Acesso à câmera bloqueado por política de segurança.');
      } else {
        setCameraErroMensagem('Não foi possível acessar a câmera deste dispositivo. Use o modo manual.');
      }
    }
  }, [startScanningLoop]);

  // Alternar Lanterna / Torch se suportado
  const alternarLanterna = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch {
      // ignore
    }
  };

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, [pararCamera]);

  const reiniciarParaProximaLeitura = () => {
    setResultado(null);
    setCodigoManual('');
    iniciarCamera();
  };

  const voltarParaMenuInicial = () => {
    pararCamera();
    setModo('idle');
    setResultado(null);
    setCodigoManual('');
  };

  // ── 1. TELA DE CARREGAMENTO ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070c17] text-white flex flex-col items-center justify-center p-6">
        <div className="relative mb-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <QrCode className="w-7 h-7 text-emerald-400 animate-pulse" />
          </div>
          <div className="absolute -inset-2 rounded-2xl bg-emerald-500/10 blur-md -z-10 animate-pulse" />
        </div>
        <p className="text-sm font-bold text-white tracking-wide">Conectando ao Check-in...</p>
        <p className="text-xs text-slate-400 mt-1">Carregando informações do evento</p>
      </div>
    );
  }

  // ── 2. TELA DE LINK EXPIRADO / INVÁLIDO ──
  if (linkExpirado || !evento) {
    return (
      <div className="min-h-screen bg-[#070c17] text-white flex flex-col items-center justify-center p-5">
        <div className="w-full max-w-sm bg-[#0d1627] border border-[#1b2b46] rounded-3xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(244,63,94,0.2)]">
            <XCircle className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Link Indisponível</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              {motivoExpiracao || 'Este link de check-in não está mais disponível ou expirou.'}
            </p>
          </div>
          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500">
            Solicite um novo link à equipe organizadora do evento.
          </div>
        </div>
      </div>
    );
  }

  // ── 3. TELA PRINCIPAL: CHECK-IN MOBILE-FIRST ──
  return (
    <div className="min-h-screen bg-[#060a14] text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-emerald-500 selection:text-white">
      {/* Luz ambiente de fundo (Glow sutil) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-72 bg-gradient-to-b from-blue-600/10 via-emerald-600/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header Fixo Superior */}
      <header className="bg-[#080e1c]/80 backdrop-blur-xl border-b border-[#142238] sticky top-0 z-30 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            {/* Ícone estilizado Chama / Livro Gestão Eklésia */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-[1px] shadow-sm flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#0d1627] rounded-[11px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400/90">
                GESTÃO
              </span>
              <span className="text-xs font-black tracking-wider text-white">
                EKLÉSIA
              </span>
            </div>
          </div>

          {/* Badges do Header */}
          <div className="flex items-center gap-2">
            {/* Badge de Presentes em Tempo Real */}
            <div className="bg-[#0e1a2f] border border-[#1b3156] rounded-xl px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black text-emerald-400">
                {evento.total_presentes}{' '}
                <span className="text-slate-500 font-normal">/ {evento.total_confirmados}</span>
              </span>
            </div>

            {/* Pill Check-in */}
            <div className="bg-[#12223f] border border-[#1e3b6d] text-blue-300 rounded-xl px-2.5 py-1 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
              <QrCode className="w-3.5 h-3.5 text-blue-400" />
              <span>Check-in</span>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-between space-y-4">
        {/* ── CARD DO EVENTO (Sempre Visível) ── */}
        <div className="bg-gradient-to-b from-[#0e192c]/90 to-[#091220]/90 border border-[#182b4a] rounded-3xl p-4 shadow-xl backdrop-blur-md relative overflow-hidden">
          {/* Detalhe de iluminação sutil no card */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-2">
            {/* Subtítulo da Igreja */}
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-400 block truncate">
              {evento.igreja_nome}
            </span>

            {/* Título do Evento */}
            <h1 className="text-base sm:text-lg font-black text-white leading-tight uppercase line-clamp-2">
              {evento.titulo}
            </h1>

            {/* Linha Data e Hora */}
            <div className="pt-1 space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium">{formatarDataHoraEvento(evento.data_inicio)}</span>
              </div>

              {/* Linha Local */}
              {evento.local_nome && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <span className="font-semibold text-slate-200 block truncate">{evento.local_nome}</span>
                    {evento.local_endereco && (
                      <span className="text-[11px] text-slate-400 block truncate">{evento.local_endereco}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ÁREA PRINCIPAL DINÂMICA (Conforme o estado) ── */}
        <div className="flex-1 flex flex-col justify-center my-auto">
          {resultado ? (
            /* ─────────────────────────────────────────────────────────────
               ESTADO DE FEEDBACK / RESULTADO DO CHECK-IN
            ───────────────────────────────────────────────────────────── */
            <div
              className={`rounded-3xl border p-5 sm:p-6 text-center shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 ${
                resultado.type === 'sucesso'
                  ? 'bg-gradient-to-b from-[#0b1e1d]/95 to-[#061413]/95 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.2)]'
                  : resultado.type === 'ja_realizado'
                  ? 'bg-gradient-to-b from-[#1e170a]/95 to-[#130f06]/95 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.2)]'
                  : 'bg-gradient-to-b from-[#200c14]/95 to-[#14060b]/95 border-rose-500/40 shadow-[0_0_40px_rgba(244,63,94,0.2)]'
              }`}
            >
              {/* Ícone Redondo Iluminado */}
              <div
                className={`w-18 h-18 rounded-full flex items-center justify-center mx-auto shadow-2xl ${
                  resultado.type === 'sucesso'
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.6)] ring-4 ring-emerald-500/30'
                    : resultado.type === 'ja_realizado'
                    ? 'bg-amber-500 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.6)] ring-4 ring-amber-500/30'
                    : 'bg-rose-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.6)] ring-4 ring-rose-500/30'
                }`}
              >
                {resultado.type === 'sucesso' && <Check className="w-9 h-9 stroke-[3]" />}
                {resultado.type === 'ja_realizado' && <AlertTriangle className="w-9 h-9 stroke-[2.5]" />}
                {resultado.type === 'erro' && <XCircle className="w-9 h-9 stroke-[2.5]" />}
              </div>

              {/* Título do Status */}
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {resultado.type === 'sucesso'
                    ? 'Check-in realizado!'
                    : resultado.type === 'ja_realizado'
                    ? 'Participante já realizou o check-in'
                    : 'QR Code inválido'}
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  {resultado.type === 'sucesso'
                    ? 'Participante confirmado com sucesso.'
                    : resultado.type === 'ja_realizado'
                    ? 'Este participante já foi registrado na entrada do evento.'
                    : resultado.mensagem || 'Não foi possível encontrar uma inscrição válida para este código.'}
                </p>
              </div>

              {/* Card de Dados do Participante ou Possíveis Causas */}
              {resultado.type !== 'erro' ? (
                <div className="bg-[#091222]/90 border border-[#162744] rounded-2xl p-4 text-left space-y-3 shadow-inner">
                  {/* Nome do Participante */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Participante
                      </span>
                      <span className="text-sm sm:text-base font-black text-white block truncate">
                        {resultado.participante.nome}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes do Evento */}
                  <div className="pt-2 border-t border-[#162744] space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {resultado.evento_titulo || evento.titulo} • {formatarDataHoraEvento(evento.data_inicio)}
                      </span>
                    </div>
                    {evento.local_nome && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{evento.local_nome}</span>
                      </div>
                    )}
                  </div>

                  {/* Sub-card do Horário de Check-in */}
                  <div className="bg-[#050b16] p-3 rounded-xl border border-[#121f36] flex items-center gap-2.5 text-xs">
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        {resultado.type === 'ja_realizado' ? 'Check-in anterior em' : 'Check-in realizado em'}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {formatarTimestampCheckin(resultado.checkin_em)}
                      </span>
                    </div>
                  </div>

                  {/* Benefícios (Brinde / Hospedagem) */}
                  {(resultado.participante.tem_brinde || resultado.participante.com_hospedagem) && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {resultado.participante.tem_brinde && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          <Gift className="w-3.5 h-3.5" /> Brinde Contemplado 🎁
                        </span>
                      )}
                      {resultado.participante.com_hospedagem && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          <Bed className="w-3.5 h-3.5" /> Hospedagem Inclusa 🛏️
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Card de Possíveis Causas no Erro */
                <div className="bg-[#091222]/90 border border-[#162744] rounded-2xl p-4 text-left space-y-2 shadow-inner text-xs text-slate-300">
                  <span className="text-[11px] font-bold text-slate-200 block">Possíveis causas:</span>
                  <ul className="space-y-1 text-slate-400">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                      <span>Código inválido ou ilegível</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                      <span>Inscrição não encontrada ou pendente de pagamento</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                      <span>Este código pertence a outro evento</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Botões de Ação do Resultado */}
              <div className="pt-2 space-y-2">
                {resultado.type === 'sucesso' ? (
                  <button
                    type="button"
                    onClick={reiniciarParaProximaLeitura}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] text-slate-950 font-black text-sm transition shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-5 h-5" />
                    <span>Ler próximo QR Code</span>
                  </button>
                ) : resultado.type === 'ja_realizado' ? (
                  <button
                    type="button"
                    onClick={reiniciarParaProximaLeitura}
                    className="w-full py-4 rounded-2xl bg-[#122340] hover:bg-[#183058] active:scale-[0.98] border border-[#214275] text-white font-black text-sm transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-5 h-5 text-blue-400" />
                    <span>Ler outro QR Code</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={reiniciarParaProximaLeitura}
                    className="w-full py-4 rounded-2xl bg-[#122340] hover:bg-[#183058] active:scale-[0.98] border border-[#214275] text-white font-black text-sm transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    <span>Tentar novamente</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={voltarParaMenuInicial}
                  className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                >
                  Voltar ao início
                </button>
              </div>
            </div>
          ) : modo === 'camera' ? (
            /* ─────────────────────────────────────────────────────────────
               ESTADO CÂMERA ATIVA / SCANNER AO VIVO
            ───────────────────────────────────────────────────────────── */
            <div className="space-y-3">
              <div className="relative aspect-square w-full max-w-[340px] mx-auto bg-black rounded-3xl overflow-hidden border-2 border-[#1c3356] shadow-[0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-center">
                {/* Elemento de Vídeo Permanente no DOM */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    cameraStatus === 'ativa' ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                  }`}
                />

                {/* Lanterna / Torch se suportada */}
                {cameraStatus === 'ativa' && hasTorch && (
                  <button
                    type="button"
                    onClick={alternarLanterna}
                    className={`absolute top-3 right-3 z-20 p-2.5 rounded-2xl backdrop-blur-md border transition ${
                      torchOn
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                        : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                    }`}
                  >
                    {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                  </button>
                )}

                {/* Retículo Neon de Mira Escaneadora */}
                {cameraStatus === 'ativa' && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8 z-10">
                    <div className="w-56 h-56 border-2 border-[#00f2a9]/90 rounded-2xl relative shadow-[0_0_25px_rgba(0,242,169,0.3)]">
                      {/* Laser animado de varredura */}
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#00f2a9] to-transparent shadow-[0_0_12px_#00f2a9] animate-bounce" />
                      {/* Cantoneiras neon luminosas */}
                      <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-[#00f2a9] rounded-tl-lg shadow-[0_0_10px_#00f2a9]" />
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-[#00f2a9] rounded-tr-lg shadow-[0_0_10px_#00f2a9]" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-[#00f2a9] rounded-bl-lg shadow-[0_0_10px_#00f2a9]" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-[#00f2a9] rounded-br-lg shadow-[0_0_10px_#00f2a9]" />
                    </div>
                  </div>
                )}

                {/* Tela de Erro ou Inicialização da Câmera */}
                {cameraStatus !== 'ativa' && (
                  <div className="p-6 text-center space-y-3 z-10 max-w-[280px]">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
                        cameraStatus === 'erro'
                          ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {cameraStatus === 'erro' ? (
                        <ShieldAlert className="w-7 h-7" />
                      ) : (
                        <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">
                        {cameraStatus === 'erro' ? 'Permissão de Câmera' : 'Iniciando Câmera...'}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                        {cameraErroMensagem || 'Aguarde a inicialização da câmera do dispositivo...'}
                      </p>
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={iniciarCamera}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs transition shadow-md"
                      >
                        Tentar Novamente
                      </button>
                      <button
                        type="button"
                        onClick={() => setModo('manual')}
                        className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                      >
                        Digitar código manualmente
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Pill abaixo da Câmera */}
              {cameraStatus === 'ativa' && (
                <div className="bg-[#0e192c]/90 border border-[#1b3154] rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">
                        Aguardando QR Code...
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        Posicione o código dentro da área de leitura
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={voltarParaMenuInicial}
                    className="px-3 py-1.5 rounded-xl bg-[#162744] hover:bg-[#1d355c] text-slate-300 text-xs font-bold transition shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ) : modo === 'manual' ? (
            /* ─────────────────────────────────────────────────────────────
               ESTADO DE DIGITAÇÃO MANUAL DO CÓDIGO
            ───────────────────────────────────────────────────────────── */
            <div className="bg-gradient-to-b from-[#0e1a2f]/95 to-[#091220]/95 rounded-3xl border border-[#1b3154] p-6 space-y-4 shadow-2xl backdrop-blur-md">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-2 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                  <Keyboard className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white">Validação Manual</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Informe o código da inscrição ou o nome completo do participante.
                </p>
              </div>

              <form
                onSubmit={(e) => {
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
                    onChange={(e) => setCodigoManual(e.target.value.toUpperCase())}
                    placeholder="Ex: #A1B2C3D4 ou Nome"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3.5 bg-[#070d18] border border-[#1b3154] rounded-2xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase transition shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!codigoManual.trim() || processando}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] text-slate-950 font-black text-sm disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  {processando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirmar Check-in</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={voltarParaMenuInicial}
                  className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition text-center"
                >
                  Voltar ao início
                </button>
              </form>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               ESTADO INICIAL (MENU PRINCIPAL / IDLE)
            ───────────────────────────────────────────────────────────── */
            <div className="bg-gradient-to-b from-[#0e192c]/95 to-[#08111f]/95 border border-[#1a2e4c] rounded-3xl p-6 shadow-2xl backdrop-blur-md text-center space-y-6">
              {/* Ícone de Destaque QR Scanner */}
              <div className="relative inline-block mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                  <QrCode className="w-8 h-8 text-blue-400" />
                </div>
              </div>

              {/* Textos de Chamada */}
              <div className="space-y-1.5 max-w-[280px] mx-auto">
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                  Faça o check-in do participante
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Aponte a câmera para o QR Code do comprovante de inscrição ou digite o código manualmente.
                </p>
              </div>

              {/* Botões de Ação Principais (Stacked) */}
              <div className="space-y-3 pt-2">
                {/* Botão Primário: Ler QR Code */}
                <button
                  type="button"
                  onClick={iniciarCamera}
                  className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] text-slate-950 font-black text-sm sm:text-base flex items-center justify-between shadow-[0_4px_25px_rgba(16,185,129,0.35)] transition group"
                >
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5 text-slate-950" />
                    <span>Ler QR Code</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-slate-950/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    <ChevronRight className="w-4 h-4 text-slate-950 stroke-[3]" />
                  </div>
                </button>

                {/* Botão Secundário: Digitar Código */}
                <button
                  type="button"
                  onClick={() => {
                    pararCamera();
                    setModo('manual');
                  }}
                  className="w-full py-4 px-5 rounded-2xl bg-[#0e1a2d] hover:bg-[#14233c] active:scale-[0.98] border border-[#1d3354] text-slate-200 font-bold text-sm sm:text-base flex items-center justify-between shadow-md transition group"
                >
                  <div className="flex items-center gap-3">
                    <Keyboard className="w-5 h-5 text-blue-400" />
                    <span>Digitar Código</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER MINIMALISTA ── */}
        <footer className="py-2 text-center text-[10px] text-slate-500">
          Gestão Eklésia • Check-in Portaria
        </footer>
      </main>
    </div>
  );
}
