'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Users,
  UserCheck,
  UserX,
  FileCheck2,
  Building2,
  MapPin,
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Sparkles,
  User,
} from 'lucide-react';

interface UltimaEntrada {
  nome: string;
  cargo: string;
  congregacao: string;
  foto_url?: string | null;
  data_hora_checkin: string;
}

interface PainelData {
  instituicao: {
    nome: string;
    logo_url?: string | null;
  };
  reuniao: {
    titulo: string;
    local: string;
    data: string;
    horario_inicio: string;
    horario_limite_entrada?: string | null;
    status: string;
  };
  indicadores: {
    total_esperado: number;
    total_presente: number;
    total_ausente: number;
    total_justificado: number;
    percentual_presenca: number;
    percentual_ausencia: number;
  };
  ultimas_entradas?: UltimaEntrada[];
  consolidado_congregacoes: Array<{
    congregacao: string;
    total_esperado: number;
    total_presente: number;
    percentual_presenca: number;
  }>;
  consolidado_areas: Array<{
    area: string;
    total_esperado: number;
    total_presente: number;
    percentual_presenca: number;
  }>;
  atualizado_em: string;
}

type EstadoTela =
  | 'carregando'
  | 'ativo'
  | 'token_invalido'
  | 'token_expirado'
  | 'token_revogado'
  | 'reuniao_encerrada'
  | 'erro_comunicacao';

export default function PainelInformativoPublicoPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [data, setData] = useState<PainelData | null>(null);
  const [estado, setEstado] = useState<EstadoTela>('carregando');
  const [mensagemErro, setMensagemErro] = useState<string>('');
  const [atualizandoSilencioso, setAtualizandoSilencioso] = useState<boolean>(false);
  const [horaLocal, setHoraLocal] = useState<string>('');

  // Identificador visual do check-in mais recente para aplicar animação discreta
  const [ultimoCheckinKey, setUltimoCheckinKey] = useState<string | null>(null);
  const [checkinAnimadoKey, setCheckinAnimadoKey] = useState<string | null>(null);

  const timerPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Relógio em tempo real para TV
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setHoraLocal(
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Função para buscar dados da API pública
  const carregarPainel = useCallback(
    async (isBackground = false) => {
      if (!token) {
        setEstado('token_invalido');
        setMensagemErro('Código de acesso do painel não fornecido.');
        return;
      }

      if (isBackground) {
        setAtualizandoSilencioso(true);
      }

      try {
        const res = await fetch(`/api/v1/public/reunioes/painel/${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        });

        const json = await res.json();

        if (!res.ok) {
          const code = json.code;
          if (code === 'TOKEN_EXPIRADO') {
            setEstado('token_expirado');
            setMensagemErro(json.error || 'O link deste painel informativo expirou.');
          } else if (code === 'TOKEN_REVOGADO') {
            setEstado('token_revogado');
            setMensagemErro(json.error || 'Este link de exibição foi revogado pela administração.');
          } else if (code === 'REUNIAO_ENCERRADA') {
            setEstado('reuniao_encerrada');
            setMensagemErro(json.error || 'Esta reunião ministerial foi finalizada e o painel foi desativado.');
          } else if (code === 'TOKEN_NAO_ENCONTRADO' || code === 'TOKEN_INVALIDO') {
            setEstado('token_invalido');
            setMensagemErro(json.error || 'Link do painel inválido ou não localizado.');
          } else {
            if (!data) {
              setEstado('erro_comunicacao');
              setMensagemErro(json.error || 'Não foi possível conectar ao servidor.');
            }
          }
          return;
        }

        if (json.success && json.painel) {
          const novosDados: PainelData = json.painel;
          const primeirasEntradas = novosDados.ultimas_entradas || [];
          const topItem = primeirasEntradas[0];
          const topKey = topItem ? `${topItem.nome}-${topItem.data_hora_checkin}` : null;

          // Se houver novo check-in em relação ao estado anterior
          if (topKey && ultimoCheckinKey && topKey !== ultimoCheckinKey) {
            setCheckinAnimadoKey(topKey);
            setTimeout(() => setCheckinAnimadoKey(null), 4000);
          }

          if (topKey) {
            setUltimoCheckinKey(topKey);
          }

          setData(novosDados);
          setEstado('ativo');
          setMensagemErro('');
        }
      } catch (err: any) {
        if (!data) {
          setEstado('erro_comunicacao');
          setMensagemErro('Falha temporária de conexão com o servidor.');
        }
      } finally {
        if (isBackground) {
          setAtualizandoSilencioso(false);
        }
      }
    },
    [token, data, ultimoCheckinKey]
  );

  // Efeito de inicialização e polling suave a cada 5 segundos
  useEffect(() => {
    carregarPainel(false);

    timerPollingRef.current = setInterval(() => {
      setEstado((currState) => {
        if (currState === 'ativo') {
          carregarPainel(true);
        }
        return currState;
      });
    }, 5000);

    return () => {
      if (timerPollingRef.current) {
        clearInterval(timerPollingRef.current);
      }
    };
  }, [carregarPainel]);

  // Se a reunião estiver encerrada ou token inválido, para o polling
  useEffect(() => {
    if (estado === 'reuniao_encerrada' || estado === 'token_expirado' || estado === 'token_revogado') {
      if (timerPollingRef.current) {
        clearInterval(timerPollingRef.current);
      }
    }
  }, [estado]);

  // ─── ESTADOS DE ERRO / ENCERRAMENTO / BLOQUEIO ──────────────────────────────
  if (estado !== 'ativo' && estado !== 'carregando') {
    return (
      <main className="min-h-screen bg-[#060c18] text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="max-w-xl w-full bg-[#0a1529]/90 backdrop-blur-md border border-[#1b2a47] rounded-3xl p-10 text-center shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            {estado === 'reuniao_encerrada' && (
              <div className="w-20 h-20 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 rounded-3xl flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            )}
            {estado === 'token_expirado' && (
              <div className="w-20 h-20 bg-amber-950/60 border border-amber-500/30 text-amber-400 rounded-3xl flex items-center justify-center">
                <Clock className="w-10 h-10" />
              </div>
            )}
            {estado === 'token_revogado' && (
              <div className="w-20 h-20 bg-rose-950/60 border border-rose-500/30 text-rose-400 rounded-3xl flex items-center justify-center">
                <Lock className="w-10 h-10" />
              </div>
            )}
            {(estado === 'token_invalido' || estado === 'erro_comunicacao') && (
              <div className="w-20 h-20 bg-rose-950/60 border border-rose-500/30 text-rose-400 rounded-3xl flex items-center justify-center">
                <AlertTriangle className="w-10 h-10" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
              {estado === 'reuniao_encerrada' && 'Reunião Ministerial Encerrada'}
              {estado === 'token_expirado' && 'Link do Painel Expirado'}
              {estado === 'token_revogado' && 'Acesso Revogado'}
              {estado === 'token_invalido' && 'Link Não Reconhecido'}
              {estado === 'erro_comunicacao' && 'Erro de Conexão'}
            </h1>
            <p className="text-slate-400 text-sm lg:text-base leading-relaxed">
              {mensagemErro || 'O painel informativo não está disponível neste momento.'}
            </p>
          </div>

          <div className="pt-4 border-t border-[#1b2a47] text-xs text-slate-500 font-medium">
            Gestão Eklésia™ • Sistema de Gestão Ministerial
          </div>
        </div>
      </main>
    );
  }

  // ─── TELA DE CARREGAMENTO INICIAL ──────────────────────────────────────────
  if (estado === 'carregando' || !data) {
    return (
      <main className="min-h-screen bg-[#060c18] text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-12 h-12 text-teal-400 animate-spin" />
          <p className="text-lg font-bold text-slate-300 tracking-wider uppercase">
            Carregando Painel Informativo...
          </p>
          <p className="text-xs text-slate-500">Sincronizando dados da reunião em tempo real</p>
        </div>
      </main>
    );
  }

  // ─── TELA CHEIA OPERACIONAL DO PAINEL (TV / PROJETOR 16:9) ─────────────────
  const ind = data.indicadores;
  const reuniao = data.reuniao;
  const inst = data.instituicao;
  const ultimasEntradas = data.ultimas_entradas || [];

  const dataFormatada = reuniao.data
    ? new Date(reuniao.data + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <main className="min-h-screen bg-[#050b14] text-slate-100 flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none font-sans overflow-x-hidden">
      {/* ─── 1. CABEÇALHO DA REUNIÃO & RELÓGIO DIGITAL ─── */}
      <header className="bg-[#0b172a]/95 border border-[#1b2e4b] rounded-3xl p-4 lg:p-5 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-center lg:text-left">
          {inst.logo_url ? (
            <img
              src={inst.logo_url}
              alt={inst.nome}
              className="w-14 h-14 lg:w-16 lg:h-16 object-contain rounded-2xl bg-white/5 p-1 border border-[#1b2e4b]"
            />
          ) : (
            <div className="w-14 h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-teal-500 to-cyan-700 text-white font-black text-xl rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 justify-center lg:justify-start">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[11px] font-extrabold uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                Painel Ministerial Oficial
              </span>
            </div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight mt-0.5 uppercase">
              {reuniao.titulo}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm font-semibold tracking-wide">
              {inst.nome.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Metadados da Convocação + Relógio em Tempo Real */}
        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5 text-xs text-slate-300">
          <div className="flex items-center gap-2 bg-[#0d1e38] px-3.5 py-2 rounded-2xl border border-[#1f375b]">
            <Calendar className="w-4 h-4 text-teal-400" />
            <span className="font-semibold capitalize">{dataFormatada}</span>
          </div>

          <div className="flex items-center gap-2 bg-[#0d1e38] px-3.5 py-2 rounded-2xl border border-[#1f375b]">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold">{reuniao.horario_inicio}</span>
          </div>

          <div className="flex items-center gap-2 bg-[#0d1e38] px-3.5 py-2 rounded-2xl border border-[#1f375b]">
            <MapPin className="w-4 h-4 text-rose-400" />
            <span className="font-semibold">{reuniao.local}</span>
          </div>

          {/* Relógio Digital da TV */}
          <div className="bg-[#0a1b33] px-4 py-2 rounded-2xl border border-teal-500/50 text-right shadow-lg">
            <div className="text-cyan-400 font-mono text-base lg:text-lg font-black tracking-wider leading-none">
              {horaLocal || '00:00:00'}
            </div>
            <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-end gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Em tempo real
            </div>
          </div>
        </div>
      </header>

      {/* ─── 2. ÁREA PRINCIPAL: 2 COLUNAS (30% CARDS / 70% ÚLTIMAS ENTRADAS) ─── */}
      <section className="my-4 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        {/* COLUNA ESQUERDA (~30% / 4 colunas lg): 4 CARDS VERTICAIS */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3.5">
          {/* Card 1: Total Convocado */}
          <div className="bg-[#0b172a]/95 border border-[#1b2e4b] rounded-3xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Convocado
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                  {ind.total_esperado}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                  Ministros Elegíveis
                </span>
              </div>
            </div>
            <Users className="w-5 h-5 text-slate-600 mr-1" />
          </div>

          {/* Card 2: Presentes */}
          <div className="bg-[#0b172a]/95 border border-[#1b2e4b] rounded-3xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 block">
                  Presentes
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                  {ind.total_presente}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                  Check-in Registrado
                </span>
              </div>
            </div>
            {/* Círculo com Percentual */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-teal-400 transition-all duration-700 ease-out"
                  strokeDasharray={`${Math.min(100, ind.percentual_presenca)}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-black text-teal-300 font-mono">
                {Math.round(ind.percentual_presenca)}%
              </span>
            </div>
          </div>

          {/* Card 3: Ausentes */}
          <div className="bg-[#0b172a]/95 border border-[#1b2e4b] rounded-3xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
                  Ausentes
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                  {ind.total_ausente}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                  Sem Check-in
                </span>
              </div>
            </div>
            {/* Círculo com Percentual de Ausência */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-rose-400 transition-all duration-700 ease-out"
                  strokeDasharray={`${Math.min(100, ind.percentual_ausencia)}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-black text-rose-300 font-mono">
                {Math.round(ind.percentual_ausencia)}%
              </span>
            </div>
          </div>

          {/* Card 4: Justificados */}
          <div className="bg-[#0b172a]/95 border border-[#1b2e4b] rounded-3xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                  Justificados
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                  {ind.total_justificado}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                  Justificativas Aceitas
                </span>
              </div>
            </div>
            {/* Círculo com Percentual Justificados */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              {(() => {
                const pctJust = ind.total_esperado > 0 ? (ind.total_justificado / ind.total_esperado) * 100 : 0;
                return (
                  <>
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-800"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-amber-400 transition-all duration-700 ease-out"
                        strokeDasharray={`${Math.min(100, pctJust)}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-[11px] font-black text-amber-300 font-mono">
                      {Math.round(pctJust)}%
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (~70% / 8 colunas lg): CARD "ÚLTIMAS ENTRADAS" */}
        <div className="lg:col-span-8 bg-[#0b172a]/95 border border-[#1b2e4b] rounded-3xl p-5 lg:p-6 shadow-2xl flex flex-col justify-between">
          <div>
            {/* Título do Card */}
            <div className="flex items-center justify-between border-b border-[#1b2e4b] pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white tracking-wide uppercase">
                    Últimas Entradas
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Últimos check-ins registrados nesta reunião
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Atualização automática</span>
              </div>
            </div>

            {/* Lista dos Últimos 10 Check-ins */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
              {ultimasEntradas.length === 0 ? (
                <div className="py-14 text-center text-slate-500 space-y-2">
                  <UserCheck className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                  <p className="text-sm font-semibold">Aguardando primeiros check-ins da reunião...</p>
                  <p className="text-xs text-slate-600">As entradas registradas no terminal aparecerão aqui em tempo real.</p>
                </div>
              ) : (
                ultimasEntradas.map((item, idx) => {
                  const itemKey = `${item.nome}-${item.data_hora_checkin}`;
                  const isNovo = idx === 0 && checkinAnimadoKey === itemKey;
                  const horaCheckin = item.data_hora_checkin
                    ? new Date(item.data_hora_checkin).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '—';

                  return (
                    <div
                      key={itemKey || idx}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all duration-500 ${
                        idx === 0
                          ? 'bg-gradient-to-r from-teal-950/40 via-[#0d2138] to-[#0a182d] border-teal-500/40 shadow-md shadow-teal-950/30'
                          : 'bg-[#0a1628]/70 border-[#182945] hover:bg-[#0d1d33]'
                      } ${isNovo ? 'ring-2 ring-teal-400 animate-pulse' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Foto do Ministro ou Ícone Fallback */}
                        {item.foto_url ? (
                          <img
                            src={item.foto_url}
                            alt={item.nome}
                            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-teal-500/50 shadow"
                          />
                        ) : (
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#162744] border-2 border-slate-700 text-teal-300 flex items-center justify-center font-bold text-base shadow">
                            <User className="w-6 h-6 text-teal-400" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                              {item.nome}
                            </h3>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-teal-500 text-[#050b14] text-[10px] font-black uppercase tracking-wider">
                                Novo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            <span className="text-slate-300 font-semibold">{item.cargo}</span>
                            <span className="mx-1.5 opacity-40">•</span>
                            <span>{item.congregacao}</span>
                          </p>
                        </div>
                      </div>

                      {/* Horário de Entrada */}
                      <div className="flex items-center gap-1.5 pl-3 text-right">
                        <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-wider">
                          {horaCheckin}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. PARTE INFERIOR: ÍNDICE GERAL DE PRESENÇA & CONSOLIDAÇÃO POR CONGREGAÇÃO ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        {/* Gráfico do Quórum de Presença (4 colunas lg) */}
        <div className="lg:col-span-5 bg-[#0b172a]/95 border border-[#1b2e4b] rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-teal-400">📊</span>
              Índice Geral de Presença
            </h2>
            <span className="px-2.5 py-0.5 bg-teal-500/20 text-teal-300 text-[10px] font-bold rounded-full border border-teal-500/30">
              Quórum Atingido
            </span>
          </div>

          <div className="flex items-center justify-center my-auto py-2">
            <div className="text-center">
              <span className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-400 to-cyan-300 tracking-tighter">
                {ind.percentual_presenca}%
              </span>
              <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                Quórum Atingido
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="w-full bg-[#0d1e38] h-3.5 rounded-full overflow-hidden p-0.5 border border-[#1f375b]">
              <div
                className="bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-400 h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, ind.percentual_presenca)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400">
              <span>0%</span>
              <span>50% Quórum</span>
              <span>100% Total</span>
            </div>
          </div>
        </div>

        {/* Tabela Consolidada por Congregação (7 colunas lg) */}
        <div className="lg:col-span-7 bg-[#0b172a]/95 border border-[#1b2e4b] rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b2e4b] pb-2.5">
            <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              Consolidação por Congregação
            </h2>
            <span className="text-[11px] text-slate-400 font-semibold">
              {data.consolidado_congregacoes.length} Unidades
            </span>
          </div>

          <div className="overflow-y-auto max-h-36 pr-1 space-y-2.5 custom-scrollbar">
            {data.consolidado_congregacoes.length > 0 ? (
              data.consolidado_congregacoes.map((item, index) => (
                <div
                  key={index}
                  className="bg-[#0a1628]/80 border border-[#1b2e4b] rounded-2xl p-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">{item.congregacao}</p>
                    <div className="w-full bg-[#07101e] h-2 rounded-full overflow-hidden mt-1.5 border border-[#132238]">
                      <div
                        className="bg-teal-400 h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.min(100, item.percentual_presenca)}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2.5">
                    <div className="text-slate-400 text-[11px]">
                      <span className="text-white font-bold">{item.total_presente}</span> / {item.total_esperado}
                    </div>
                    <span className="px-2 py-0.5 bg-[#07101e] rounded-lg font-mono font-bold text-teal-300 text-xs border border-[#1b2e4b]">
                      {item.percentual_presenca}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs italic text-center py-4">
                Nenhum dado consolidado por congregação disponível.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ─── 4. RODAPÉ INSTITUCIONAL & SINCRONIZAÇÃO ─── */}
      <footer className="mt-4 pt-3 border-t border-[#1b2e4b] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-400">
            Painel Ativo • Atualização contínua a cada 5s
          </span>
          {atualizandoSilencioso && (
            <span className="text-teal-400 text-[11px] font-medium animate-pulse ml-2">
              (sincronizando...)
            </span>
          )}
        </div>

        <div className="text-center sm:text-right font-medium text-[11px]">
          Última sincronização:{' '}
          <span className="text-slate-400 font-bold">
            {new Date(data.atualizado_em).toLocaleTimeString('pt-BR')}
          </span>
          <span className="mx-2">•</span>
          <strong>GESTÃO EKLÉSIA™</strong>
        </div>
      </footer>
    </main>
  );
}
