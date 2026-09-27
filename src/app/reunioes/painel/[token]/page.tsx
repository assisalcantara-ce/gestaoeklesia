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
} from 'lucide-react';

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
          setData(json.painel);
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
    [token, data]
  );

  // Efeito de inicialização e polling suave a cada 5 segundos
  useEffect(() => {
    carregarPainel(false);

    timerPollingRef.current = setInterval(() => {
      // Executa polling somente se a tela ainda estiver no estado ativo
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

  // Se a reunião estiver encerrada, para o polling
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
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="max-w-xl w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-10 text-center shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
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

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 font-medium">
            Gestão Eklésia™ • Sistema de Gestão Ministerial
          </div>
        </div>
      </main>
    );
  }

  // ─── TELA DE CARREGAMENTO INICIAL ──────────────────────────────────────────
  if (estado === 'carregando' || !data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-6 select-none">
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

  // ─── TELA CHEIA OPERACIONAL DO PAINEL (TV / PROJETOR) ──────────────────────
  const ind = data.indicadores;
  const reuniao = data.reuniao;
  const inst = data.instituicao;

  const dataFormatada = reuniao.data
    ? new Date(reuniao.data + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none font-sans overflow-x-hidden">
      {/* ─── 1. CABEÇALHO INSTITUCIONAL DE ALTO CONTRASTE ─── */}
      <header className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-5 lg:p-6 backdrop-blur-md shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center lg:text-left">
          {inst.logo_url ? (
            <img
              src={inst.logo_url}
              alt={inst.nome}
              className="w-16 h-16 lg:w-20 lg:h-20 object-contain rounded-2xl bg-white/5 p-1 border border-slate-700/50"
            />
          ) : (
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-teal-500 to-cyan-700 text-white font-black text-2xl rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-9 h-9" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 justify-center lg:justify-start">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                Painel Ministerial Oficial
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight mt-1 uppercase">
              {reuniao.titulo}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm font-semibold tracking-wide">
              {inst.nome.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Metadados da Convocação + Relógio em Tempo Real */}
        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3 text-xs sm:text-sm text-slate-300">
          <div className="flex items-center gap-2 bg-slate-800/70 px-3.5 py-2 rounded-2xl border border-slate-700/50">
            <Calendar className="w-4 h-4 text-teal-400" />
            <span className="font-semibold capitalize">{dataFormatada}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/70 px-3.5 py-2 rounded-2xl border border-slate-700/50">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold">{reuniao.horario_inicio}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/70 px-3.5 py-2 rounded-2xl border border-slate-700/50">
            <MapPin className="w-4 h-4 text-rose-400" />
            <span className="font-semibold">{reuniao.local}</span>
          </div>

          {/* Relógio Digital da TV */}
          <div className="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 px-4 py-2 rounded-2xl border border-teal-500/40 text-teal-300 font-mono text-sm sm:text-base font-black shadow-inner">
            {horaLocal || '00:00:00'}
          </div>
        </div>
      </header>

      {/* ─── 2. ÁREA PRINCIPAL: CARDS DE INDICADORES GIGANTES ─── */}
      <section className="my-6 grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
        {/* Card 1: Total Esperado */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 lg:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-800/20 rounded-full blur-2xl" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Total Convocado</span>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div className="my-3">
            <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
              {ind.total_esperado}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-500 block mt-1">Ministros Elegíveis</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-slate-500 h-full w-full rounded-full" />
          </div>
        </div>

        {/* Card 2: Presentes Confirmados */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-3xl p-5 lg:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Presentes</span>
            <UserCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="my-3">
            <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-emerald-300 tracking-tight">
              {ind.total_presente}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-emerald-500/80 block mt-1">
              Check-in Registrado
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, ind.percentual_presenca)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Ausentes / Pendentes */}
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-3xl p-5 lg:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Ausentes</span>
            <UserX className="w-5 h-5 text-rose-400" />
          </div>
          <div className="my-3">
            <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-rose-300 tracking-tight">
              {ind.total_ausente}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-rose-500/80 block mt-1">
              Sem Check-in
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, ind.percentual_ausencia)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Justificados */}
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-3xl p-5 lg:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Justificados</span>
            <FileCheck2 className="w-5 h-5 text-amber-400" />
          </div>
          <div className="my-3">
            <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-amber-300 tracking-tight">
              {ind.total_justificado}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-amber-500/80 block mt-1">
              Justificativas Aceitas
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${
                  ind.total_esperado > 0
                    ? Math.min(100, Number(((ind.total_justificado / ind.total_esperado) * 100).toFixed(1)))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── 3. BARRA DE QUÓRUM GRÁFICO E CONSOLIDAÇÃO ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Gráfico do Quórum de Presença */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              Índice Geral de Presença
            </h2>
            <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs font-bold rounded-full border border-teal-500/30">
              Tempo Real
            </span>
          </div>

          <div className="flex items-center justify-center my-auto py-4">
            <div className="text-center">
              <span className="text-6xl sm:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-400 to-cyan-300 tracking-tighter">
                {ind.percentual_presenca}%
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">
                Quórum Atingido
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className="bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-400 h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, ind.percentual_presenca)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-bold text-slate-400">
              <span>0%</span>
              <span>50% Quórum</span>
              <span>100% Total</span>
            </div>
          </div>
        </div>

        {/* Tabela Consolidada por Congregação / Área */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              Consolidação por Congregação
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              {data.consolidado_congregacoes.length} Unidades
            </span>
          </div>

          <div className="overflow-y-auto max-h-56 pr-2 space-y-3 custom-scrollbar">
            {data.consolidado_congregacoes.length > 0 ? (
              data.consolidado_congregacoes.map((item, index) => (
                <div
                  key={index}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">{item.congregacao}</p>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="bg-teal-400 h-full rounded-full"
                        style={{ width: `${Math.min(100, item.percentual_presenca)}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div className="text-slate-400 text-xs">
                      <span className="text-white font-bold">{item.total_presente}</span> / {item.total_esperado}
                    </div>
                    <span className="px-2.5 py-1 bg-slate-900 rounded-xl font-mono font-bold text-teal-300 text-xs border border-slate-700">
                      {item.percentual_presenca}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs italic text-center py-6">
                Nenhum dado consolidado por congregação disponível.
              </p>
            )}
          </div>

          {/* Áreas Resumidas (se houver) */}
          {data.consolidado_areas.length > 0 && (
            <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2 items-center text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Por Área:</span>
              {data.consolidado_areas.slice(0, 4).map((a, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-slate-800/80 rounded-lg text-slate-300 font-medium border border-slate-700/40"
                >
                  {a.area}: <strong className="text-white">{a.percentual_presenca}%</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── 4. RODAPÉ INSTITUCIONAL & SINCRONIZAÇÃO ─── */}
      <footer className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-400">
            Painel Ativo • Atualização contínua
          </span>
          {atualizandoSilencioso && (
            <span className="text-teal-400 text-[11px] font-medium animate-pulse ml-2">
              (sincronizando...)
            </span>
          )}
        </div>

        <div className="text-center sm:text-right font-medium">
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
