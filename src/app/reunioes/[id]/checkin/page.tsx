'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Users,
  UserCheck,
  Camera,
  CameraOff,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

interface ParticipanteSnapshot {
  id: string;
  member_id: string;
  nome_ministro_snapshot: string;
  cargo_snapshot: string;
  congregacao_id_snapshot: string | null;
  nome_congregacao_snapshot: string | null;
  area_snapshot: string | null;
  carteirinha_numero_snapshot: string | null;
  unique_id_snapshot: string | null;
  status_presenca: 'pendente' | 'presente' | 'falta' | 'falta_justificada';
}

interface ReuniaoInfo {
  id: string;
  titulo: string;
  local: string;
  data_reuniao: string;
  horario_inicio: string;
  horario_limite_entrada: string;
  limite_checkin_em: string;
  status: 'agendada' | 'em_andamento' | 'encerrada' | 'cancelada';
  total_esperados: number;
  total_presentes: number;
  total_ausentes: number;
  total_justificados: number;
  congregacoes?: { id: string; nome: string } | null;
}

interface CheckinFeedback {
  type: 'success' | 'warning' | 'error' | 'expired';
  title: string;
  message: string;
  ministroNome?: string;
  cargo?: string;
  congregacao?: string;
  horario?: string;
  code?: string;
}

export default function CheckinReuniaoPage() {
  const params = useParams();
  const router = useRouter();
  const reuniaoId = params?.id as string;

  const { ctx, bloqueado } = useRequireModulo('reunioes');
  const planFeatures = usePlanFeatures();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [reuniao, setReuniao] = useState<ReuniaoInfo | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteSnapshot[]>([]);
  const [feedback, setFeedback] = useState<CheckinFeedback | null>(null);

  // Estados de Encerramento da Reunião
  const [modalEncerrarAberto, setModalEncerrarAberto] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [resumoEncerramento, setResumoEncerramento] = useState<{
    total_esperados: number;
    total_presentes: number;
    total_ausentes: number;
    total_justificados: number;
    encerrada_em?: string;
  } | null>(null);

  // Modo de operação: 'camera' ou 'manual'
  const [modo, setModo] = useState<'camera' | 'manual'>('camera');
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Scanner nativo BarcodeDetector / Input
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [manualQrInput, setManualQrInput] = useState('');

  // ─── 1. Carregar Dados da Reunião e Snapshot ──────────────────────────────
  const carregarReuniao = useCallback(async () => {
    if (!reuniaoId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/reunioes/${reuniaoId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar reunião.');
      }

      setReuniao(data.reuniao);
      setParticipantes(data.participantes || []);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Erro ao carregar reunião',
        message: err?.message || 'Falha de comunicação com o servidor.',
      });
    } finally {
      setLoading(false);
    }
  }, [reuniaoId]);

  useEffect(() => {
    if (!bloqueado && reuniaoId) {
      carregarReuniao();
    }
  }, [bloqueado, reuniaoId, carregarReuniao]);

  // Checagem de suporte a BarcodeDetector nativo no navegador
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      setHasBarcodeDetector(true);
    }
  }, []);

  // ─── 2. Executar Chamada de Check-in no Backend ────────────────────────────
  const realizarCheckin = useCallback(
    async (payload: { qr_code?: string; unique_id?: string; member_id?: string; metodo_leitura: string }) => {
      if (!reuniaoId || enviando) return;

      try {
        setEnviando(true);
        const res = await fetch(`/api/v1/reunioes/${reuniaoId}/checkin`, {
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
              message: data.message || 'Este ministro já havia realizado o check-in.',
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
              title: 'Check-in Realizado com Sucesso!',
              message: data.message,
              ministroNome: data.participante?.nome,
              cargo: data.participante?.cargo,
              congregacao: data.participante?.congregacao,
              horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            });

            // Atualizar participante local no snapshot
            setParticipantes((prev) =>
              prev.map((p) =>
                p.id === data.participante?.id || p.member_id === data.participante?.id
                  ? { ...p, status_presenca: 'presente' }
                  : p
              )
            );

            // Atualizar contadores
            setReuniao((prev) => (prev ? { ...prev, total_presentes: data.total_presentes } : prev));
          }
        } else {
          // Tratar códigos de erro específicos do backend
          if (data.code === 'HORARIO_LIMITE_EXPIRADO') {
            setFeedback({
              type: 'expired',
              title: 'Tolerância Expirada',
              message: 'O horário limite para entrada de ministros foi ultrapassado.',
              code: data.code,
            });
          } else if (data.code === 'FORA_DO_SNAPSHOT') {
            setFeedback({
              type: 'error',
              title: 'Ministro Não Convocado',
              message: data.error,
              code: data.code,
            });
          } else if (data.code === 'MINISTRO_INATIVO') {
            setFeedback({
              type: 'error',
              title: 'Ministro Inativo',
              message: data.error,
              code: data.code,
            });
          } else if (data.code === 'REUNIAO_ENCERRADA') {
            setFeedback({
              type: 'expired',
              title: 'Reunião Encerrada',
              message: 'Não é possível registrar novos check-ins pois a reunião já foi encerrada.',
              code: data.code,
            });
          } else {
            setFeedback({
              type: 'error',
              title: 'Não Foi Possível Registrar',
              message: data.error || 'Erro ao processar check-in.',
              code: data.code,
            });
          }
        }
      } catch (err: any) {
        setFeedback({
          type: 'error',
          title: 'Erro de Conexão',
          message: err?.message || 'Falha ao conectar com o servidor.',
        });
      } finally {
        setEnviando(false);
        setManualQrInput('');
      }
    },
    [reuniaoId, enviando]
  );

  // ─── 2.1 Executar Encerramento Oficial da Reunião ─────────────────────────
  const executarEncerramento = async () => {
    if (!reuniaoId || encerrando) return;

    try {
      setEncerrando(true);
      pararCamera();

      const res = await fetch(`/api/v1/reunioes/${reuniaoId}/encerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao encerrar reunião.');
      }

      setResumoEncerramento(data.resumo);
      setModalEncerrarAberto(false);

      // Atualizar status local da reunião para encerrada
      setReuniao((prev) =>
        prev
          ? {
              ...prev,
              status: 'encerrada',
              total_esperados: data.resumo.total_esperados,
              total_presentes: data.resumo.total_presentes,
              total_ausentes: data.resumo.total_ausentes,
              total_justificados: data.resumo.total_justificados,
            }
          : prev
      );

      // Atualizar lista local de participantes convertendo pendentes para falta
      setParticipantes((prev) =>
        prev.map((p) => (p.status_presenca === 'pendente' ? { ...p, status_presenca: 'falta' } : p))
      );

      setFeedback({
        type: 'success',
        title: 'Reunião Encerrada com Sucesso!',
        message: 'Faltas registradas, tokens inativados e processo de advertências iniciado.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Erro no Encerramento',
        message: err?.message || 'Falha ao processar o encerramento da reunião.',
      });
    } finally {
      setEncerrando(false);
    }
  };

  // ─── 3. Controle da Câmera e Scanner ──────────────────────────────────────
  const iniciarCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador sem suporte direto para acesso à câmera.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraAtiva(true);
      iniciarLoopLeitura();
    } catch (err: any) {
      console.warn('Câmera indisponível ou permissão negada:', err);
      setFeedback({
        type: 'warning',
        title: 'Câmera Indisponível',
        message: 'Permissão da câmera negada ou não encontrada. Utilize a busca manual abaixo.',
      });
      setCameraAtiva(false);
      setModo('manual');
    }
  };

  const pararCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraAtiva(false);
  }, []);

  const iniciarLoopLeitura = () => {
    if (!hasBarcodeDetector) return;
    scanningRef.current = true;

    // @ts-ignore
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

    const scanFrame = async () => {
      if (!scanningRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        if (scanningRef.current) requestAnimationFrame(scanFrame);
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          if (code && !enviando) {
            pararCamera();
            realizarCheckin({ qr_code: code, metodo_leitura: 'qrcode_carteirinha' });
            return;
          }
        }
      } catch (err) {
        // frame vazio / detecção silenciosa
      }

      if (scanningRef.current) {
        requestAnimationFrame(scanFrame);
      }
    };

    requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, [pararCamera]);

  // ─── 4. Filtro de Busca Manual ────────────────────────────────────────────
  const participantesFiltrados = useMemo(() => {
    if (!busca.trim()) return participantes;
    const term = busca.toLowerCase().trim();
    return participantes.filter(
      (p) =>
        p.nome_ministro_snapshot.toLowerCase().includes(term) ||
        (p.cargo_snapshot && p.cargo_snapshot.toLowerCase().includes(term)) ||
        (p.nome_congregacao_snapshot && p.nome_congregacao_snapshot.toLowerCase().includes(term)) ||
        (p.carteirinha_numero_snapshot && p.carteirinha_numero_snapshot.toLowerCase().includes(term))
    );
  }, [participantes, busca]);

  // ─── 5. Bloqueios de Plano / Loading ──────────────────────────────────────
  if (ctx.loading || planFeatures.loading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-6 space-y-4">
        <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        <p className="text-sm font-medium">Carregando painel de check-in...</p>
      </div>
    );
  }

  if (!planFeatures.has_modulo_reunioes || !planFeatures.hasFeature('meetings_module')) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold">Módulo Reuniões Bloqueado</h2>
          <p className="text-slate-400 text-sm">Disponível a partir do Plano Intermediário.</p>
          <button
            onClick={() => router.push('/configuracoes')}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 rounded-xl font-semibold transition"
          >
            Conhecer Planos
          </button>
        </div>
      </div>
    );
  }

  const isExpirado = reuniao?.limite_checkin_em && new Date().toISOString() > reuniao.limite_checkin_em;
  const isEncerrada = reuniao?.status === 'encerrada';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-teal-500 selection:text-white pb-12">
      {/* ─── Header Compacto Mobile-First ─── */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/reunioes')}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white line-clamp-1 leading-tight">{reuniao?.titulo || 'Reunião Ministerial'}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                {reuniao?.data_reuniao ? new Date(reuniao.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Início: {reuniao?.horario_inicio ? reuniao.horario_inicio.slice(0, 5) : '—'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={carregarReuniao}
          className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-teal-400 transition active:scale-95"
          title="Recarregar dados"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-4 space-y-4">
        {/* ─── Cards de Quórum / Status ─── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Presentes</p>
              <p className="text-xl font-black text-white leading-none mt-1">{reuniao?.total_presentes || 0}</p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Convocados</p>
              <p className="text-xl font-black text-white leading-none mt-1">{reuniao?.total_esperados || 0}</p>
            </div>
          </div>
        </div>

        {/* ─── Alertas de Status / Tolerância ─── */}
        {isEncerrada ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-red-400">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <div className="text-xs">
              <strong className="block font-bold">Reunião Encerrada</strong>
              O registro de novas presenças está finalizado.
            </div>
          </div>
        ) : isExpirado ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-amber-300">
            <Clock className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <div className="text-xs">
              <strong className="block font-bold">Tolerância Expirada</strong>
              Horário limite de entrada ({reuniao?.horario_limite_entrada.slice(0, 5)}) ultrapassado.
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Check-in em Aberto
            </span>
            <span>Limite tolerância: <strong className="text-slate-200">{reuniao?.horario_limite_entrada.slice(0, 5)}</strong></span>
          </div>
        )}

        {/* ─── Feedback Visual do Check-in Realizado ─── */}
        {feedback && (
          <div
            className={`rounded-2xl border p-4 shadow-xl animate-in fade-in zoom-in-95 duration-200 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : feedback.type === 'warning'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : feedback.type === 'expired'
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                : 'bg-red-950/40 border-red-500/40 text-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {feedback.type === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />}
              {feedback.type === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />}
              {feedback.type === 'expired' && <Clock className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />}
              {feedback.type === 'error' && <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />}

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm tracking-wide">{feedback.title}</h3>
                <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{feedback.message}</p>

                {feedback.ministroNome && (
                  <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1 text-xs">
                    <p className="font-bold text-white text-sm">{feedback.ministroNome}</p>
                    <p className="text-slate-300">
                      {feedback.cargo || 'Ministro'} {feedback.congregacao ? `• ${feedback.congregacao}` : ''}
                    </p>
                    {feedback.horario && (
                      <p className="text-[11px] text-slate-400">Registrado às {feedback.horario}</p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setFeedback(null)}
                className="text-white/60 hover:text-white text-xs px-2 py-1 rounded-lg bg-black/20"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ─── Seletor de Modo (Câmera / Busca Manual) ─── */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => {
              setModo('camera');
              if (!cameraAtiva) iniciarCamera();
            }}
            className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              modo === 'camera'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            Leitor QR Code
          </button>
          <button
            onClick={() => {
              setModo('manual');
              pararCamera();
            }}
            className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              modo === 'manual'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            Busca Manual
          </button>
        </div>

        {/* ─── MODO 1: CÂMERA / LEITOR QR CODE ─── */}
        {modo === 'camera' && (
          <div className="space-y-3">
            <div className="relative aspect-square max-h-72 w-full bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden flex flex-col items-center justify-center shadow-2xl">
              {cameraAtiva ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay Mira QR Code */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-teal-400/80 rounded-2xl relative animate-pulse">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-teal-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-teal-400" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-teal-400" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-teal-400" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center mx-auto text-teal-400 shadow-inner">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Leitor de Carteirinha</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Aponte a câmera para o QR Code da carteirinha do ministro.
                    </p>
                  </div>
                  <button
                    onClick={iniciarCamera}
                    disabled={isEncerrada || Boolean(isExpirado)}
                    className="px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95"
                  >
                    Ativar Câmera
                  </button>
                </div>
              )}
            </div>

            {cameraAtiva && (
              <button
                onClick={pararCamera}
                className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2"
              >
                <CameraOff className="w-4 h-4 text-rose-400" />
                Desativar Câmera
              </button>
            )}

            {/* Entrada Rápida de Código / Leitor USB */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 space-y-2">
              <label className="text-[11px] font-semibold text-slate-400">Leitor USB / Digitação Rápida</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="URL do QR ou UniqueId..."
                  value={manualQrInput}
                  onChange={(e) => setManualQrInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualQrInput.trim()) {
                      realizarCheckin({ qr_code: manualQrInput.trim(), metodo_leitura: 'qrcode_carteirinha' });
                    }
                  }}
                  disabled={enviando || isEncerrada || Boolean(isExpirado)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                />
                <button
                  onClick={() => {
                    if (manualQrInput.trim()) {
                      realizarCheckin({ qr_code: manualQrInput.trim(), metodo_leitura: 'qrcode_carteirinha' });
                    }
                  }}
                  disabled={!manualQrInput.trim() || enviando || isEncerrada || Boolean(isExpirado)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-teal-400 text-xs font-bold rounded-xl border border-slate-700 transition"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODO 2: BUSCA MANUAL NO SNAPSHOT ─── */}
        {modo === 'manual' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar ministro pelo nome, cargo ou congregação..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 shadow-inner"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {participantesFiltrados.length === 0 ? (
                <div className="text-center py-8 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Nenhum ministro encontrado no snapshot.</p>
                </div>
              ) : (
                participantesFiltrados.map((p) => {
                  const isPresente = p.status_presenca === 'presente';
                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        isPresente
                          ? 'bg-teal-950/20 border-teal-500/30'
                          : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white line-clamp-1">{p.nome_ministro_snapshot}</p>
                          {isPresente && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-400 text-[10px] font-bold border border-teal-500/30">
                              Presente
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {p.cargo_snapshot || 'Ministro'} • {p.nome_congregacao_snapshot || 'Sede'}
                        </p>
                      </div>

                      {!isPresente ? (
                        <button
                          onClick={() =>
                            realizarCheckin({
                              member_id: p.member_id,
                              metodo_leitura: 'manual_secretaria',
                            })
                          }
                          disabled={enviando || isEncerrada || Boolean(isExpirado)}
                          className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 flex-shrink-0"
                        >
                          Check-in
                        </button>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ─── Ação Administrativa: Encerrar Reunião ─── */}
        {!isEncerrada ? (
          <div className="pt-4">
            <button
              onClick={() => setModalEncerrarAberto(true)}
              disabled={encerrando}
              className="w-full py-3.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-lg active:scale-95"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Encerrar Reunião Ministerial
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-teal-400 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-white">Reunião Oficialmente Encerrada</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {resumoEncerramento?.encerrada_em
                  ? `Finalizada em ${new Date(resumoEncerramento.encerrada_em).toLocaleString('pt-BR')}`
                  : 'Faltas e advertências processadas pela Secretaria.'}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center">
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Total</p>
                <p className="text-sm font-bold text-white">{reuniao?.total_esperados || 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Presentes</p>
                <p className="text-sm font-bold text-emerald-400">{reuniao?.total_presentes || 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Faltas</p>
                <p className="text-sm font-bold text-rose-400">{reuniao?.total_ausentes || 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Justific.</p>
                <p className="text-sm font-bold text-amber-400">{reuniao?.total_justificados || 0}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Modal de Confirmação de Encerramento ─── */}
      {modalEncerrarAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h2 className="text-base font-bold text-white">Encerrar Reunião Ministerial?</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Esta ação fechará oficialmente a reunião e executará as seguintes rotinas no sistema:
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Bloquear imediatamente novos check-ins de ministros.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Registrar <strong>01 falta</strong> para cada ministro ausente.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Gerar os protocolos de <strong>Cartas de Advertência</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>Inativar os links públicos do painel em TV/Telão.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setModalEncerrarAberto(false)}
                disabled={encerrando}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Voltar / Cancelar
              </button>
              <button
                onClick={executarEncerramento}
                disabled={encerrando}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                {encerrando ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Encerrando...
                  </>
                ) : (
                  'Confirmar Encerramento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
