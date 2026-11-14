'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import jsQR from 'jsqr';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  UserCheck,
  Camera,
  CameraOff,
  RefreshCw,
  Lock,
  XCircle,
  Zap,
  ZapOff,
  ShieldCheck,
  MapPin,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface ParticipanteSnapshot {
  id: string;
  member_id: string;
  nome_ministro_snapshot: string;
  cargo_snapshot: string;
  nome_congregacao_snapshot: string | null;
  carteirinha_numero_snapshot: string | null;
  unique_id_snapshot: string | null;
  status_presenca: 'pendente' | 'presente' | 'falta' | 'falta_justificada';
}

interface ReuniaoInfo {
  id: string;
  titulo: string;
  local: string;
  data: string;
  horario_inicio: string;
  horario_limite_entrada: string;
  limite_checkin_em: string;
  status: string;
  instituicao: {
    nome: string;
    logo_url?: string | null;
  };
}

interface CheckinFeedback {
  type: 'success' | 'warning' | 'error' | 'expired';
  title: string;
  message: string;
  ministroNome?: string;
  cargo?: string;
  congregacao?: string;
  horario?: string;
}

export type CameraState = 'idle' | 'solicitando' | 'ativa' | 'erro';

export default function CheckinPublicoPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [reuniao, setReuniao] = useState<ReuniaoInfo | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteSnapshot[]>([]);
  const [feedback, setFeedback] = useState<CheckinFeedback | null>(null);

  // Estados de erro/bloqueio permanente do token/reunião
  const [erroBloqueio, setErroBloqueio] = useState<{ tipo: string; mensagem: string } | null>(null);

  // Modo: 'camera' ou 'manual'
  const [modo, setModo] = useState<'camera' | 'manual'>('camera');
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Scanner de Câmera com jsQR e ciclo de vida robusto
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraErroMensagem, setCameraErroMensagem] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  // Scanner óptico USB / Bluetooth
  const [manualQrInputValue, setManualQrInputValue] = useState('');
  const usbInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Carregar dados do check-in público via token
  const carregarDados = useCallback(async () => {
    if (!token) {
      setErroBloqueio({ tipo: 'invalido', mensagem: 'Código de acesso de check-in não fornecido.' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/public/reunioes/checkin/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'TOKEN_EXPIRADO') {
          setErroBloqueio({ tipo: 'expirado', mensagem: data.error || 'O link deste check-in expirou às 23:59:59 da data da reunião.' });
        } else if (data.code === 'REUNIAO_ENCERRADA') {
          setErroBloqueio({ tipo: 'encerrada', mensagem: data.error || 'Esta reunião já foi oficialmente encerrada.' });
        } else if (data.code === 'TOKEN_REVOGADO') {
          setErroBloqueio({ tipo: 'revogado', mensagem: data.error || 'Este link de check-in foi revogado pela administração.' });
        } else {
          setErroBloqueio({ tipo: 'invalido', mensagem: data.error || 'Link de check-in não localizado ou inválido.' });
        }
        return;
      }

      setReuniao(data.reuniao);
      setParticipantes(data.participantes || []);
    } catch (err: any) {
      setErroBloqueio({ tipo: 'erro', mensagem: err?.message || 'Falha de comunicação com o servidor.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Foco automático no input passivo de leitores USB
  useEffect(() => {
    if (!loading && modo === 'camera' && !erroBloqueio) {
      const timer = setTimeout(() => {
        usbInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, modo, erroBloqueio]);

  // 2. Parar stream de câmera e scanner de forma estrita
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
      try {
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }

    setTorchOn(false);
    setHasTorch(false);
    setCameraState('idle');
  }, []);

  // 3. Processar Check-in via API Pública
  const processarCheckin = useCallback(
    async (payload: { qr_code?: string; unique_id?: string; member_id?: string; metodo_leitura: string }) => {
      if (!token || enviando) return;

      try {
        setEnviando(true);
        const res = await fetch(`/api/v1/public/reunioes/checkin/${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok) {
          if (data.ja_presente) {
            setFeedback({
              type: 'warning',
              title: 'Presença Já Confirmada',
              message: data.message || 'Ministro já realizou o check-in nesta reunião.',
              ministroNome: data.participante?.nome,
              cargo: data.participante?.cargo,
              congregacao: data.participante?.congregacao,
              horario: data.checkin?.data_hora
                ? new Date(data.checkin.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : undefined,
            });
          } else {
            setFeedback({
              type: 'success',
              title: 'Check-in Confirmado!',
              message: data.message,
              ministroNome: data.participante?.nome,
              cargo: data.participante?.cargo,
              congregacao: data.participante?.congregacao,
              horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            });

            // Atualizar participante para status 'presente' na lista local
            setParticipantes((prev) =>
              prev.map((p) =>
                p.id === data.participante.id ? { ...p, status_presenca: 'presente' } : p
              )
            );
          }
        } else {
          if (data.code === 'CHECKIN_EXPIRADO') {
            setFeedback({
              type: 'expired',
              title: 'Horário Limite Atingido',
              message: data.error || 'O horário de tolerância para check-in foi ultrapassado.',
            });
          } else {
            setFeedback({
              type: 'error',
              title: 'Não Identificado',
              message: data.error || 'Código ou carteirinha não localizado nesta reunião ministerial.',
            });
          }
        }
      } catch (err: any) {
        setFeedback({
          type: 'error',
          title: 'Erro de Conexão',
          message: err?.message || 'Falha de comunicação com o servidor.',
        });
      } finally {
        setEnviando(false);
      }
    },
    [token, enviando]
  );

  // 4. Scanner Loop usando jsQR com alta compatibilidade (Safari iOS + Android)
  const iniciarScanningLoop = useCallback(() => {
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
                pararCamera();
                processarCheckin({ qr_code: qrValue, metodo_leitura: 'qrcode_carteirinha' });
                return;
              }
            }
          } catch {
            // Ignorar falhas de quadro intermediário
          }
        }
      }

      if (isScanningRef.current) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [pararCamera, processarCheckin]);

  // 5. Iniciar Câmera com suporte total a Safari/iOS e Chrome/Android
  const iniciarCamera = useCallback(async () => {
    setCameraErroMensagem(null);
    setCameraState('solicitando');

    // Validação de contexto seguro e suporte da API
    if (typeof window === 'undefined') return;

    if (
      window.isSecureContext === false &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setCameraErroMensagem('O acesso à câmera requer conexão segura (HTTPS).');
      setCameraState('erro');
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraErroMensagem('Seu navegador não possui suporte à captura de vídeo.');
      setCameraState('erro');
      return;
    }

    try {
      // Parar stream anterior se existir
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      let stream: MediaStream;

      // Tentativa 1: câmera traseira ideal (environment) com resolução responsiva
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
        // Fallback: se restrição falhar, solicitar vídeo sem restrições
        if (
          errFirst?.name === 'OverconstrainedError' ||
          errFirst?.name === 'ConstraintNotSatisfiedError'
        ) {
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
        throw new Error('Elemento de visualização não carregado.');
      }

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;

      // Detectar capacidade de lanterna (Flash/Torch)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof (videoTrack as any).getCapabilities === 'function') {
        const capabilities = (videoTrack as any).getCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      }

      // Aguardar início da reprodução do vídeo
      await video.play();

      setCameraState('ativa');
      iniciarScanningLoop();
    } catch (err: any) {
      console.warn('[CheckinReuniaoCamera] Erro ao iniciar câmera:', err);
      setCameraState('erro');

      const errName = err?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraErroMensagem(
          'Permissão de câmera negada. Permita o acesso à câmera nas configurações do seu navegador e clique em Tentar Novamente.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraErroMensagem('Nenhuma câmera conectada foi localizada neste dispositivo.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setCameraErroMensagem(
          'A câmera pode estar em uso por outro aplicativo ou temporariamente travada. Reinicie o navegador.'
        );
      } else {
        setCameraErroMensagem('Não foi possível inicializar a câmera. Utilize a busca nominal ou leitor USB.');
      }
    }
  }, [iniciarScanningLoop]);

  // Alternar Lanterna se suportada
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

  // Limpeza estrita ao desmontar o componente
  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, [pararCamera]);

  // Lista filtrada para busca manual
  const participantesFiltrados = useMemo(() => {
    if (!busca.trim()) return [];
    const term = busca.toLowerCase();
    return participantes.filter(
      (p) =>
        p.nome_ministro_snapshot.toLowerCase().includes(term) ||
        (p.cargo_snapshot && p.cargo_snapshot.toLowerCase().includes(term)) ||
        (p.unique_id_snapshot && p.unique_id_snapshot.toLowerCase().includes(term)) ||
        (p.carteirinha_numero_snapshot && p.carteirinha_numero_snapshot.toLowerCase().includes(term))
    );
  }, [participantes, busca]);

  const totalEsperados = participantes.length;
  const totalPresentes = participantes.filter((p) => p.status_presenca === 'presente').length;
  const percentualPresenca = totalEsperados > 0 ? Math.round((totalPresentes / totalEsperados) * 100) : 0;

  // ─── TELA DE BLOQUEIO / EXPIRAÇÃO ──────────────────────────────────────────
  if (erroBloqueio) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#031536] via-[#051c47] to-[#03122c] text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center mx-auto shadow-inner">
            {erroBloqueio.tipo === 'expirado' ? <Clock className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-white tracking-tight">
              {erroBloqueio.tipo === 'expirado' ? 'Link de Check-in Expirado' : 'Acesso Encerrado'}
            </h1>
            <p className="text-sm text-blue-100/80 leading-relaxed font-medium">{erroBloqueio.mensagem}</p>
          </div>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-blue-200">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              Gestão Eklésia • Terminal Ministerial Seguro
            </span>
          </div>
        </div>
      </main>
    );
  }

  // ─── TELA DE CARREGAMENTO INICIAL ──────────────────────────────────────────
  if (loading || !reuniao) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#031536] via-[#051c47] to-[#03122c] text-white flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-3xl shadow-xl">
          <RefreshCw className="w-9 h-9 animate-spin text-teal-400" />
          <div className="text-center">
            <p className="text-sm font-bold text-white tracking-wide">Carregando Terminal de Check-in</p>
            <p className="text-xs text-blue-200/70 mt-1">Sincronizando quórum e credenciais ministeriais...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FB] text-slate-800 flex flex-col font-sans">
      {/* ─── 1. CABEÇALHO INSTITUCIONAL GESTÃO EKLÉSIA ─── */}
      <header className="bg-gradient-to-r from-[#031536] via-[#0A2656] to-[#031536] text-white border-b border-blue-900/40 shadow-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Identidade Visual */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 p-1.5 flex items-center justify-center shrink-0 shadow-inner">
              <Image
                src="/icons/logob.png"
                alt="Gestão Eklésia"
                width={36}
                height={36}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-300 block leading-tight">
                {reuniao.instituicao.nome}
              </span>
              <h1 className="text-sm sm:text-base font-black text-white truncate max-w-[200px] sm:max-w-md leading-snug">
                {reuniao.titulo}
              </h1>
            </div>
          </div>

          {/* Quórum de Presença em Tempo Real */}
          <div className="flex items-center gap-2.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-2xl backdrop-blur-md shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-white">
                <span>{totalPresentes}</span>
                <span className="text-blue-200/70 font-semibold"> / {totalEsperados}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-300 block leading-none">
                {percentualPresenca}% quórum
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── 2. ÁREA DE CONTEÚDO PRINCIPAL (MOBILE-FIRST) ─── */}
      <div className="max-w-4xl mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        {/* Card Resumo da Convocação */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600 font-medium">
            <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/70">
              <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <strong>{reuniao.data.split('-').reverse().join('/')}</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/70">
              <Clock className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
              Início: <strong className="text-slate-800">{reuniao.horario_inicio.slice(0, 5)}</strong>
            </span>
            {reuniao.horario_limite_entrada && (
              <span className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl font-bold">
                Tolerância: {reuniao.horario_limite_entrada.slice(0, 5)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[200px]">{reuniao.local}</span>
          </div>
        </section>

        {/* FEEDBACK POPUP/CARD DE RESULTADO */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border shadow-md animate-in fade-in zoom-in-95 duration-200 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : feedback.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-600 text-white'
                      : feedback.type === 'warning'
                      ? 'bg-amber-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : feedback.type === 'warning' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-tight">{feedback.title}</h3>
                  <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{feedback.message}</p>
                  {feedback.ministroNome && (
                    <div className="mt-2 pt-2 border-t border-slate-200/70 text-xs font-semibold text-slate-900">
                      <span className="font-black">{feedback.ministroNome}</span>
                      {feedback.cargo && <span> • {feedback.cargo}</span>}
                      {feedback.congregacao && (
                        <span className="text-slate-600"> ({feedback.congregacao})</span>
                      )}
                      {feedback.horario && (
                        <span className="block text-[11px] text-teal-700 font-bold mt-0.5">
                          Horário confirmado: {feedback.horario}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-700 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* NAVEGAÇÃO DE ABAS: SCANNER / BUSCA MANUAL */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-sm gap-1.5">
          <button
            type="button"
            onClick={() => {
              setModo('camera');
              setBusca('');
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              modo === 'camera'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Leitor QR Code / Câmera</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setModo('manual');
              pararCamera();
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              modo === 'manual'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Busca Nominal Manual</span>
          </button>
        </div>

        {/* ─── ABA 1: SCANNER DE QR CODE (CÂMERA + LEITOR USB) ─── */}
        {modo === 'camera' && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col items-center gap-4 text-center">
            {/* Input Passivo / Invisível para Bipe de Leitor Óptico USB */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualQrInputValue.trim()) {
                  processarCheckin({ qr_code: manualQrInputValue.trim(), metodo_leitura: 'qrcode_carteirinha' });
                  setManualQrInputValue('');
                }
              }}
              className="w-full max-w-sm"
            >
              <div className="relative">
                <input
                  ref={usbInputRef}
                  type="text"
                  value={manualQrInputValue}
                  onChange={(e) => setManualQrInputValue(e.target.value)}
                  placeholder="Aguardando bip do leitor USB ou digite a credencial..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-teal-600 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none transition"
                />
              </div>
            </form>

            {/* Visor da Câmera Responsivo com Retículo de Enquadramento */}
            {cameraState === 'ativa' && (
              <div className="w-full max-w-md flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative w-full aspect-square sm:aspect-video bg-black rounded-3xl overflow-hidden border-2 border-teal-500 shadow-xl">
                  {/* Elemento de Vídeo com suporte estrito a Safari / iOS */}
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Moldura de Mira / Retículo */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
                    <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-teal-300 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                  </div>

                  {/* Controles Flutuantes da Câmera (Lanterna e Desligar) */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={alternarLanterna}
                        className={`p-2 rounded-xl backdrop-blur-md text-xs font-bold transition shadow-sm ${
                          torchOn ? 'bg-amber-500 text-white' : 'bg-black/60 text-white hover:bg-black/80'
                        }`}
                        title="Alternar lanterna"
                      >
                        {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={pararCamera}
                      className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-md text-xs font-bold transition shadow-sm"
                      title="Desligar câmera"
                    >
                      <CameraOff className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-200">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                  <span>Câmera ativa • Aponte para o QR Code da carteirinha</span>
                </div>

                <button
                  type="button"
                  onClick={pararCamera}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Desligar Câmera
                </button>
              </div>
            )}

            {/* Estado de Carregamento da Câmera */}
            {cameraState === 'solicitando' && (
              <div className="w-full max-w-md p-10 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
                <p className="text-xs font-bold text-slate-700">Inicializando câmera do aparelho...</p>
                <p className="text-[11px] text-slate-500">Aguardando autorização de vídeo</p>
              </div>
            )}

            {/* Estado de Erro na Câmera */}
            {cameraState === 'erro' && (
              <div className="w-full max-w-md p-6 bg-rose-50 rounded-3xl border border-rose-200 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-rose-900">Falha ao Acessar Câmera</p>
                  <p className="text-[11px] text-rose-700 leading-relaxed max-w-xs">{cameraErroMensagem}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={iniciarCamera}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Tentar Novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo('manual')}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-sm transition"
                  >
                    Usar Busca Manual
                  </button>
                </div>
              </div>
            )}

            {/* Estado Idle (Pronto para Abrir Câmera) */}
            {cameraState === 'idle' && (
              <div className="w-full max-w-md p-8 bg-gradient-to-b from-slate-50 to-white rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-inner">
                  <QrCode className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-900">Leitor Digital de Carteirinhas</p>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    Aproxime a carteirinha do ministro com QR Code ou utilize leitor óptico USB.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={iniciarCamera}
                  className="mt-1 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 active:scale-95 transition"
                >
                  <Camera className="w-4 h-4" />
                  Abrir Câmera do Aparelho
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── ABA 2: BUSCA NOMINAL MANUAL ─── */}
        {modo === 'manual' && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col gap-3 flex-1">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite nome do ministro, cargo, congregação ou matrícula..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-teal-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition font-medium"
              />
            </div>

            <div className="overflow-y-auto max-h-[460px] space-y-2 pt-1">
              {participantesFiltrados.length > 0 ? (
                participantesFiltrados.map((p) => {
                  const jaPresente = p.status_presenca === 'presente';
                  return (
                    <div
                      key={p.id}
                      className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs transition"
                    >
                      <div className="space-y-0.5">
                        <p className="font-black text-slate-900 text-sm">{p.nome_ministro_snapshot}</p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {p.cargo_snapshot} • {p.nome_congregacao_snapshot || 'Geral'}
                          {p.carteirinha_numero_snapshot && (
                            <span className="ml-1 text-slate-400 font-mono">
                              (Matrícula: {p.carteirinha_numero_snapshot})
                            </span>
                          )}
                        </p>
                      </div>

                      {jaPresente ? (
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 font-bold text-[11px] rounded-xl border border-emerald-300 flex items-center gap-1.5 shrink-0 shadow-sm">
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" /> Presente
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            processarCheckin({ member_id: p.member_id, metodo_leitura: 'busca_nome' })
                          }
                          disabled={enviando}
                          className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 shrink-0"
                        >
                          Confirmar Presença
                        </button>
                      )}
                    </div>
                  );
                })
              ) : busca.trim() ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Search className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                  <p className="text-xs font-bold text-slate-600">Nenhum ministro localizado</p>
                  <p className="text-[11px]">Verifique a digitação ou certifique-se da convocação desta reunião.</p>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Search className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                  <p className="text-xs font-bold text-slate-600">Pesquisa de Presença Convocada</p>
                  <p className="text-[11px]">Digite ao menos 2 letras do nome para confirmar o check-in nominal.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. RODAPÉ INSTITUCIONAL DISCRETO ─── */}
      <footer className="text-center py-3 text-[11px] text-slate-400 border-t border-slate-200/80 bg-white">
        Gestão Eklésia • Terminal Ministerial de Check-in em Tempo Real
      </footer>
    </main>
  );
}
