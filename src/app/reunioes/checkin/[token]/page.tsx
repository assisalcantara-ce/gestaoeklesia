'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
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

export default function CheckinPublicoPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [reuniao, setReuniao] = useState<ReuniaoInfo | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteSnapshot[]>([]);
  const [feedback, setFeedback] = useState<CheckinFeedback | null>(null);

  // Estados de erro/bloqueio
  const [erroBloqueio, setErroBloqueio] = useState<{ tipo: string; mensagem: string } | null>(null);

  // Modo: 'camera' ou 'manual'
  const [modo, setModo] = useState<'camera' | 'manual'>('camera');
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Scanner nativo BarcodeDetector / Câmera
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [manualQrInput, setManualQrInput] = useState('');
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
          setErroBloqueio({ tipo: 'expirado', mensagem: data.error || 'O link deste check-in expirou.' });
        } else if (data.code === 'REUNIAO_ENCERRADA') {
          setErroBloqueio({ tipo: 'encerrada', mensagem: data.error || 'Esta reunião já foi encerrada.' });
        } else if (data.code === 'TOKEN_REVOGADO') {
          setErroBloqueio({ tipo: 'revogado', mensagem: data.error || 'Este link foi revogado pela administração.' });
        } else {
          setErroBloqueio({ tipo: 'invalido', mensagem: data.error || 'Link de check-in inválido.' });
        }
        return;
      }

      setReuniao(data.reuniao);
      setParticipantes(data.participantes || []);
    } catch (err: any) {
      setErroBloqueio({ tipo: 'erro', mensagem: err?.message || 'Falha de conexão com o servidor.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Detector nativo de código de barras / QR Code
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      setHasBarcodeDetector(true);
    }
  }, []);

  // Foco no input USB
  useEffect(() => {
    if (!loading && modo === 'camera' && !erroBloqueio) {
      const timer = setTimeout(() => {
        usbInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loading, modo, erroBloqueio]);

  // 2. Realizar Check-in via API Pública
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
              message: data.message || 'Ministro já realizou o check-in anteriormente.',
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

            // Atualizar lista local
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
              message: data.error || 'Código ou ministro não localizado nesta reunião.',
            });
          }
        }
      } catch (err: any) {
        setFeedback({
          type: 'error',
          title: 'Erro na Leitura',
          message: err?.message || 'Falha de comunicação com o servidor.',
        });
      } finally {
        setEnviando(false);
      }
    },
    [token, enviando]
  );

  // Scanner Câmera Loop
  const pararCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  }, []);

  const iniciarCamera = useCallback(async () => {
    try {
      setFeedback(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraAtiva(true);
        scanningRef.current = true;

        if (hasBarcodeDetector && 'BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const scanLoop = async () => {
            if (!scanningRef.current || !videoRef.current) return;
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const rawVal = barcodes[0].rawValue;
                pararCamera();
                await processarCheckin({ qr_code: rawVal, metodo_leitura: 'qrcode_carteirinha' });
                return;
              }
            } catch {
              // frame drop
            }
            if (scanningRef.current) {
              requestAnimationFrame(scanLoop);
            }
          };
          requestAnimationFrame(scanLoop);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Câmera Indisponível',
        message: 'Não foi possível acessar a câmera do dispositivo. Use a busca manual ou leitor USB.',
      });
      setCameraAtiva(false);
    }
  }, [hasBarcodeDetector, processarCheckin, pararCamera]);

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

  // Telas de erro ou expiração
  if (erroBloqueio) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
            {erroBloqueio.tipo === 'expirado' ? <Clock className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-white">
              {erroBloqueio.tipo === 'expirado' ? 'Link de Check-in Expirado' : 'Acesso Encerrado'}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">{erroBloqueio.mensagem}</p>
          </div>
          <div className="p-3 bg-slate-800/60 rounded-xl text-xs text-slate-400 border border-slate-700/60">
            GESTÃO EKLÉSIA • Acesso Seguro sem Login
          </div>
        </div>
      </main>
    );
  }

  if (loading || !reuniao) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-400 mb-3" />
        <p className="text-sm font-semibold text-slate-400">Carregando Terminal de Check-in...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* ─── TOPO INSTITUCIONAL ─── */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-400 block">
              {reuniao.instituicao.nome} • Terminal de Check-in
            </span>
            <h1 className="text-base sm:text-lg font-black text-white truncate max-w-md">
              {reuniao.titulo}
            </h1>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <div className="text-right">
              <span className="text-xs font-black text-white">{totalPresentes}</span>
              <span className="text-[10px] text-slate-400"> / {totalEsperados}</span>
              <span className="ml-1 text-[10px] font-bold text-emerald-400">({percentualPresenca}%)</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── CORPO PRINCIPAL ─── */}
      <div className="max-w-5xl mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        {/* Banner Informativo da Reunião */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              {reuniao.data.split('-').reverse().join('/')}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Início: {reuniao.horario_inicio.slice(0, 5)}
            </span>
            {reuniao.horario_limite_entrada && (
              <span className="flex items-center gap-1.5 font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/60">
                Tolerância: {reuniao.horario_limite_entrada.slice(0, 5)}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-semibold truncate">Local: {reuniao.local}</span>
        </div>

        {/* FEEDBACK POPUP/CARD */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border shadow-lg animate-in fade-in zoom-in-95 duration-200 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : feedback.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : feedback.type === 'warning' ? (
                  <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <div>
                  <h3 className="font-black text-sm">{feedback.title}</h3>
                  <p className="text-xs opacity-90">{feedback.message}</p>
                  {feedback.ministroNome && (
                    <p className="text-xs font-bold mt-1 text-white">
                      {feedback.ministroNome} {feedback.cargo && `• ${feedback.cargo}`}
                      {feedback.congregacao && ` (${feedback.congregacao})`}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-xs font-bold opacity-70 hover:opacity-100 p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* SELETOR DE MODO: CÂMERA / MANUAL */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setModo('camera');
              setBusca('');
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              modo === 'camera'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Scanner / Leitor de QR Code
          </button>
          <button
            onClick={() => {
              setModo('manual');
              pararCamera();
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              modo === 'manual'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            Busca Nominal Manual
          </button>
        </div>

        {/* MODO SCANNER / CÂMERA */}
        {modo === 'camera' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col items-center gap-4 text-center">
            {/* Campo invisível / passivo para leitores de código de barras USB/Bluetooth */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualQrInput.trim()) {
                  processarCheckin({ qr_code: manualQrInput.trim(), metodo_leitura: 'qrcode_carteirinha' });
                  setManualQrInput('');
                }
              }}
              className="w-full max-w-sm"
            >
              <div className="relative">
                <input
                  ref={usbInputRef}
                  type="text"
                  value={manualQrInput}
                  onChange={(e) => setManualQrInput(e.target.value)}
                  placeholder="Aproxime a carteirinha ou bipe o leitor..."
                  className="w-full bg-slate-950 border border-teal-500/40 rounded-xl px-4 py-2.5 text-xs text-teal-300 font-mono placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
                />
              </div>
            </form>

            {/* Visualizador de Câmera */}
            {cameraAtiva ? (
              <div className="relative w-full max-w-md aspect-video bg-black rounded-2xl overflow-hidden border border-teal-500 shadow-2xl">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-2 border-teal-400/50 m-8 rounded-xl pointer-events-none animate-pulse" />
                <button
                  onClick={pararCamera}
                  className="absolute top-3 right-3 p-2 bg-slate-900/80 rounded-xl text-white text-xs font-bold"
                >
                  <CameraOff className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-full max-w-md p-8 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center gap-3">
                <QrCode className="w-12 h-12 text-teal-400/60" />
                <p className="text-xs text-slate-400 max-w-xs">
                  Pronto para ler QR Code pela câmera ou por leitor óptico USB no celular/computador.
                </p>
                <button
                  onClick={iniciarCamera}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow"
                >
                  <Camera className="w-4 h-4" />
                  Abrir Câmera do Aparelho
                </button>
              </div>
            )}
          </div>
        )}

        {/* MODO BUSCA MANUAL */}
        {modo === 'manual' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col gap-3 flex-1">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o nome do ministro, cargo ou matrícula..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="overflow-y-auto max-h-96 space-y-2">
              {participantesFiltrados.length > 0 ? (
                participantesFiltrados.map((p) => {
                  const jaPresente = p.status_presenca === 'presente';
                  return (
                    <div
                      key={p.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">{p.nome_ministro_snapshot}</p>
                        <p className="text-[11px] text-slate-400">
                          {p.cargo_snapshot} • {p.nome_congregacao_snapshot || 'Geral'}
                        </p>
                      </div>

                      {jaPresente ? (
                        <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 font-bold text-[11px] rounded-lg border border-emerald-800/60 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Presente
                        </span>
                      ) : (
                        <button
                          onClick={() => processarCheckin({ member_id: p.member_id, metodo_leitura: 'busca_nome' })}
                          disabled={enviando}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg transition"
                        >
                          Confirmar
                        </button>
                      )}
                    </div>
                  );
                })
              ) : busca.trim() ? (
                <p className="text-slate-500 text-xs text-center py-6">Nenhum ministro encontrado.</p>
              ) : (
                <p className="text-slate-500 text-xs text-center py-6">
                  Digite ao menos 2 letras para localizar o ministro convocado.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
