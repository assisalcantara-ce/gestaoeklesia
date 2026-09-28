'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { createClient } from '@/lib/supabase-client';
import { calcularStatusEfetivoReuniao, StatusReuniaoEfetivo } from '@/lib/reunioes-utils';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  UserCheck,
  UserX,
  FileCheck2,
  QrCode,
  Tv,
  Lock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Search,
  Printer,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ParticipanteSnapshot {
  id: string;
  reuniao_id: string;
  member_id: string;
  nome_ministro_snapshot: string;
  cargo_snapshot: string;
  congregacao_id_snapshot?: string | null;
  nome_congregacao_snapshot?: string | null;
  area_snapshot?: string | null;
  carteirinha_numero_snapshot?: string | null;
  unique_id_snapshot?: string | null;
  status_presenca: 'pendente' | 'presente' | 'falta' | 'falta_justificada';
  created_at: string;
  data_hora_checkin?: string | null;
}

interface ReuniaoDetalhes {
  id: string;
  ministry_id: string;
  congregacao_id?: string | null;
  titulo: string;
  pauta?: string | null;
  local: string;
  data_reuniao: string;
  horario_inicio: string;
  horario_limite_entrada?: string | null;
  limite_checkin_em?: string | null;
  status: 'agendada' | 'em_andamento' | 'encerrada' | 'cancelada';
  iniciada_em?: string | null;
  encerrada_em?: string | null;
  total_esperados: number;
  total_presentes: number;
  total_ausentes: number;
  total_justificados: number;
  created_at: string;
  updated_at: string;
  congregacoes?: {
    id: string;
    nome: string;
  } | null;
}

export default function DetalhesReuniaoPage() {
  const params = useParams();
  const reuniaoId = typeof params?.id === 'string' ? params.id : '';

  const { ctx, bloqueado } = useRequireModulo('reunioes');
  const planFeatures = usePlanFeatures();

  // Estados de dados
  const [reuniao, setReuniao] = useState<ReuniaoDetalhes | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Filtros da lista de ministros
  const [buscaMinistro, setBuscaMinistro] = useState<string>('');
  const [filtroCongregacao, setFiltroCongregacao] = useState<string>('todas');
  const [filtroCargo, setFiltroCargo] = useState<string>('todos');
  const [filtroPresenca, setFiltroPresenca] = useState<string>('todos');

  // Paginação
  const [itensPorPagina, setItensPorPagina] = useState<number>(10);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);

  // Modais de Ação
  const [modalCheckinAberto, setModalCheckinAberto] = useState<boolean>(false);
  const [copiadoCheckin, setCopiadoCheckin] = useState<boolean>(false);

  const [modalPainelAberto, setModalPainelAberto] = useState<boolean>(false);
  const [carregandoToken, setCarregandoToken] = useState<boolean>(false);
  const [tokenInfo, setTokenInfo] = useState<{ url_painel?: string; token?: string } | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  const [modalEncerrarAberto, setModalEncerrarAberto] = useState<boolean>(false);
  const [encerrando, setEncerrando] = useState<boolean>(false);

  // Data/hora para exibição no relatório de impressão
  const [dataHoraImpressao, setDataHoraImpressao] = useState<string>('');

  // ─── Helper de Autenticação ───────────────────────────────────────────────
  const fetchAutenticado = useCallback(async (url: string, options: RequestInit = {}) => {
    const supabase = createClient();
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

    if (sessionErr || !session?.access_token) {
      throw new Error('Sessão expirada ou não autenticada. Faça login novamente.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${session.access_token}`);

    return fetch(url, {
      ...options,
      headers,
    });
  }, []);

  // ─── 1. Carregar Detalhes da Reunião ───────────────────────────────────────
  const carregarDetalhes = useCallback(async () => {
    if (!reuniaoId) {
      setError('ID da reunião não especificado.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setErrorCode(null);

      const res = await fetchAutenticado(`/api/v1/reunioes/${reuniaoId}`, {
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorCode(data.code || (res.status === 404 ? 'NAO_ENCONTRADA' : 'ERRO'));
        throw new Error(data.error || 'Erro ao consultar detalhes da reunião.');
      }

      setReuniao(data.reuniao || null);
      setParticipantes(data.participantes || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao buscar prontuário da reunião.');
    } finally {
      setLoading(false);
    }
  }, [reuniaoId, fetchAutenticado]);

  useEffect(() => {
    if (!bloqueado && planFeatures.hasFeature('meetings_module')) {
      carregarDetalhes();
    }
  }, [bloqueado, planFeatures, carregarDetalhes]);

  const statusEfetivo: StatusReuniaoEfetivo = useMemo(() => {
    if (!reuniao) return 'agendada';
    return calcularStatusEfetivoReuniao(reuniao);
  }, [reuniao]);

  // ─── Verificação de Horário Limite de Check-in ─────────────────────────────
  const isCheckinExpirado = useMemo(() => {
    if (!reuniao) return false;
    if (reuniao.status === 'encerrada' || reuniao.status === 'cancelada') return true;
    if (reuniao.limite_checkin_em) {
      return new Date().toISOString() > reuniao.limite_checkin_em;
    }
    return false;
  }, [reuniao]);

  const urlCheckinTerminal = useMemo(() => {
    if (typeof window !== 'undefined' && reuniao?.id) {
      return `${window.location.origin}/reunioes/${reuniao.id}/checkin`;
    }
    return '';
  }, [reuniao?.id]);

  const copiarLinkCheckin = () => {
    if (urlCheckinTerminal) {
      navigator.clipboard.writeText(urlCheckinTerminal);
      setCopiadoCheckin(true);
      setTimeout(() => setCopiadoCheckin(false), 2500);
    }
  };

  // ─── 2. Ação: Painel TV ───────────────────────────────────────────────────
  const abrirPainelTv = async () => {
    if (!reuniao) return;
    if (reuniao.status === 'encerrada') return;

    setModalPainelAberto(true);
    setCarregandoToken(true);
    setCopiado(false);

    try {
      const resGet = await fetchAutenticado(`/api/v1/reunioes/${reuniao.id}/painel/token`);
      const dataGet = await resGet.json();

      if (dataGet.success && dataGet.status_efetivo === 'ativo' && dataGet.token_info) {
        setTokenInfo({
          url_painel: `${window.location.origin}/reunioes/painel/${dataGet.token_info.id}`,
        });
      }

      const resPost = await fetchAutenticado(`/api/v1/reunioes/${reuniao.id}/painel/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duracao_horas: 24 }),
      });
      const dataPost = await resPost.json();
      if (dataPost.success) {
        setTokenInfo({
          url_painel: `${window.location.origin}/reunioes/painel/${dataPost.token}`,
          token: dataPost.token,
        });
      }
    } catch (err) {
      console.warn('Erro ao obter token do painel:', err);
    } finally {
      setCarregandoToken(false);
    }
  };

  const copiarLinkPainel = () => {
    if (tokenInfo?.url_painel) {
      navigator.clipboard.writeText(tokenInfo.url_painel);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  // ─── 3. Ação: Encerrar Reunião ─────────────────────────────────────────────
  const executarEncerramento = async () => {
    if (!reuniao || encerrando) return;

    try {
      setEncerrando(true);
      const res = await fetchAutenticado(`/api/v1/reunioes/${reuniao.id}/encerrar`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao encerrar reunião.');
      }

      setModalEncerrarAberto(false);
      await carregarDetalhes();
    } catch (err: any) {
      alert(err?.message || 'Falha ao encerrar a reunião.');
    } finally {
      setEncerrando(false);
    }
  };

  // ─── Listas Dinâmicas de Opções para os Filtros (derivadas do Snapshot) ───
  const congregacoesDisponiveis = useMemo(() => {
    const setCong = new Set<string>();
    participantes.forEach((p) => {
      const nome = p.nome_congregacao_snapshot?.trim();
      if (nome) {
        setCong.add(nome);
      }
    });
    return Array.from(setCong).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [participantes]);

  const cargosDisponiveis = useMemo(() => {
    const setCargos = new Set<string>();
    participantes.forEach((p) => {
      const cargo = p.cargo_snapshot?.trim();
      if (cargo) {
        setCargos.add(cargo);
      }
    });
    return Array.from(setCargos).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [participantes]);

  // ─── Filtro dos Participantes do Snapshot ──────────────────────────────────
  const participantesFiltrados = useMemo(() => {
    const busca = buscaMinistro.trim().toLowerCase();

    return participantes.filter((p) => {
      // 1. Busca por nome do ministro
      const matchBusca =
        !busca ||
        p.nome_ministro_snapshot.toLowerCase().includes(busca) ||
        p.cargo_snapshot.toLowerCase().includes(busca) ||
        (p.nome_congregacao_snapshot &&
          p.nome_congregacao_snapshot.toLowerCase().includes(busca)) ||
        (p.area_snapshot && p.area_snapshot.toLowerCase().includes(busca)) ||
        (p.unique_id_snapshot && p.unique_id_snapshot.toLowerCase().includes(busca)) ||
        (p.carteirinha_numero_snapshot &&
          p.carteirinha_numero_snapshot.toLowerCase().includes(busca));

      // 2. Filtro Congregação
      const matchCongregacao =
        filtroCongregacao === 'todas' ||
        p.nome_congregacao_snapshot?.trim().toLowerCase() === filtroCongregacao.toLowerCase();

      // 3. Filtro Cargo
      const matchCargo =
        filtroCargo === 'todos' ||
        p.cargo_snapshot?.trim().toLowerCase() === filtroCargo.toLowerCase();

      // 4. Filtro Presença
      const matchPresenca =
        filtroPresenca === 'todos' || p.status_presenca === filtroPresenca;

      return matchBusca && matchCongregacao && matchCargo && matchPresenca;
    });
  }, [participantes, buscaMinistro, filtroCongregacao, filtroCargo, filtroPresenca]);

  // ─── Reset automático de página ao alterar qualquer filtro ─────────────────
  const limparFiltros = () => {
    setBuscaMinistro('');
    setFiltroCongregacao('todas');
    setFiltroCargo('todos');
    setFiltroPresenca('todos');
    setPaginaAtual(1);
  };

  const handleBuscaChange = (val: string) => {
    setBuscaMinistro(val);
    setPaginaAtual(1);
  };

  const handleCongregacaoChange = (val: string) => {
    setFiltroCongregacao(val);
    setPaginaAtual(1);
  };

  const handleCargoChange = (val: string) => {
    setFiltroCargo(val);
    setPaginaAtual(1);
  };

  const handlePresencaChange = (val: string) => {
    setFiltroPresenca(val);
    setPaginaAtual(1);
  };

  const handleItensPorPaginaChange = (val: number) => {
    setItensPorPagina(val);
    setPaginaAtual(1);
  };

  // ─── Paginação Client-Side ────────────────────────────────────────────────
  const totalRegistrosFiltrados = participantesFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistrosFiltrados / itensPorPagina));
  const paginaCorrigida = Math.min(paginaAtual, totalPaginas);

  const participantesPaginados = useMemo(() => {
    const inicio = (paginaCorrigida - 1) * itensPorPagina;
    return participantesFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [participantesFiltrados, paginaCorrigida, itensPorPagina]);

  const indiceInicioExibicao = totalRegistrosFiltrados > 0 ? (paginaCorrigida - 1) * itensPorPagina + 1 : 0;
  const indiceFimExibicao = Math.min(paginaCorrigida * itensPorPagina, totalRegistrosFiltrados);

  // ─── Ação: Imprimir Lista Filtrada ─────────────────────────────────────────
  const handleImprimir = () => {
    setDataHoraImpressao(new Date().toLocaleString('pt-BR'));
    // Pequeno delay para garantir que dataHoraImpressao seja renderizada antes do print
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Tem filtros ativos?
  const temFiltrosAtivos =
    Boolean(buscaMinistro.trim()) ||
    filtroCongregacao !== 'todas' ||
    filtroCargo !== 'todos' ||
    filtroPresenca !== 'todos';

  // Contadores de Presença
  const countPresentes = useMemo(
    () => participantes.filter((p) => p.status_presenca === 'presente').length,
    [participantes]
  );
  const countFaltas = useMemo(
    () => participantes.filter((p) => p.status_presenca === 'falta').length,
    [participantes]
  );
  const countJustificadas = useMemo(
    () => participantes.filter((p) => p.status_presenca === 'falta_justificada').length,
    [participantes]
  );
  const countPendentes = useMemo(
    () => participantes.filter((p) => p.status_presenca === 'pendente').length,
    [participantes]
  );
  const totalConvocados = participantes.length;
  const percentualPresenca =
    totalConvocados > 0 ? Number(((countPresentes / totalConvocados) * 100).toFixed(1)) : 0;

  // ─── Verificação de Plano ──────────────────────────────────────────────────
  if (ctx.loading || planFeatures.loading) {
    return (
      <PageLayout
        title="Detalhes da Reunião"
        description="Prontuário operacional da reunião ministerial"
        activeMenu="reunioes"
      >
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
          <span>Carregando prontuário...</span>
        </div>
      </PageLayout>
    );
  }

  if (!planFeatures.has_modulo_reunioes || !planFeatures.hasFeature('meetings_module')) {
    return (
      <PageLayout
        title="Detalhes da Reunião"
        description="Prontuário operacional da reunião ministerial"
        activeMenu="reunioes"
      >
        <div className="bg-white rounded-3xl border border-slate-200 p-10 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">Recurso Indisponível no seu Plano</h2>
          <p className="text-slate-600 text-sm">
            O módulo de reuniões ministeriais está disponível a partir do Plano Intermediário.
          </p>
        </div>
      </PageLayout>
    );
  }

  // ─── Estados de Carregamento / Erro ───────────────────────────────────────
  if (loading) {
    return (
      <PageLayout
        title="Detalhes da Reunião"
        description="Prontuário operacional da reunião ministerial"
        activeMenu="reunioes"
      >
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-500 shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-3" />
          <p className="text-sm font-bold text-slate-700">Carregando prontuário da reunião...</p>
          <p className="text-xs text-slate-400 mt-1">Sincronizando snapshot e quórum de ministros</p>
        </div>
      </PageLayout>
    );
  }

  if (error || !reuniao) {
    return (
      <PageLayout
        title="Detalhes da Reunião"
        description="Prontuário operacional da reunião ministerial"
        activeMenu="reunioes"
      >
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center max-w-lg mx-auto my-8 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {errorCode === 'NAO_ENCONTRADA' ? 'Reunião Não Encontrada' : 'Não foi possível carregar a reunião'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {error || 'O registro da reunião não existe ou não pertence a esta instituição.'}
            </p>
          </div>
          <Link
            href="/reunioes"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Reuniões</span>
          </Link>
        </div>
      </PageLayout>
    );
  }

  const dataFormatada = reuniao.data_reuniao
    ? new Date(reuniao.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <PageLayout
      title="Detalhes da Reunião"
      description="Prontuário e histórico operacional da convocação ministerial"
      activeMenu="reunioes"
      headerExtra={
        <div className="flex items-center gap-2.5">
          <Link
            href="/reunioes"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-300 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Reuniões</span>
          </Link>

          {/* Botão Terminal Check-in com Validação de Horário Limite */}
          {isCheckinExpirado ? (
            <button
              type="button"
              disabled
              title="Check-in encerrado. O horário limite foi atingido."
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl border border-slate-200 cursor-not-allowed shadow-none"
            >
              <QrCode className="w-4 h-4 text-slate-400" />
              <span>Terminal Check-in (Encerrado)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalCheckinAberto(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Terminal Check-in</span>
            </button>
          )}
        </div>
      }
    >
      {/* ─── 1. CABEÇALHO DO PRONTUÁRIO ─── */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Badge de Status Oficial */}
              {statusEfetivo === 'agendada' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Agendada
                </span>
              )}
              {statusEfetivo === 'em_andamento' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Em Andamento
                </span>
              )}
              {statusEfetivo === 'encerrada' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-slate-500" />
                  Reunião Encerrada
                </span>
              )}
              {statusEfetivo === 'cancelada' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                  Cancelada
                </span>
              )}

              {reuniao.encerrada_em && (
                <span className="text-xs text-slate-500 font-medium">
                  • Encerrada em {new Date(reuniao.encerrada_em).toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {reuniao.titulo}
            </h1>

            {reuniao.pauta && (
              <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80 max-w-3xl">
                <strong className="text-slate-800">Pauta:</strong> {reuniao.pauta}
              </p>
            )}
          </div>

          {/* Botões Operacionais */}
          <div className="flex flex-wrap items-center gap-2">
            {reuniao.status === 'encerrada' ? (
              <button
                type="button"
                disabled
                title="Painel indisponível. A reunião foi encerrada."
                className="px-3.5 py-2 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl border border-slate-200 cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <Tv className="w-4 h-4 text-slate-400" />
                <span>Painel TV</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={abrirPainelTv}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 border border-slate-300"
              >
                <Tv className="w-4 h-4 text-cyan-600" />
                <span>Painel TV</span>
              </button>
            )}

            {reuniao.status === 'encerrada' && (
              <Link
                href={`/reunioes/faltas?reuniao_id=${reuniao.id}`}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
              >
                <FileCheck2 className="w-4 h-4 text-amber-600" />
                <span>Prontuário de Faltas</span>
              </Link>
            )}

            {reuniao.status !== 'encerrada' && reuniao.status !== 'cancelada' && (
              <button
                onClick={() => setModalEncerrarAberto(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
              >
                <Lock className="w-4 h-4 text-rose-600" />
                <span>Encerrar Reunião</span>
              </button>
            )}
          </div>
        </div>

        {/* Metadados da Reunião */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Data</span>
            <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 capitalize">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              {dataFormatada}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Horário</span>
            <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-cyan-600" />
              {reuniao.horario_inicio ? reuniao.horario_inicio.slice(0, 5) : '—'}
              {reuniao.horario_limite_entrada && (
                <span className="text-slate-500 font-normal">
                  (limite: {reuniao.horario_limite_entrada.slice(0, 5)})
                </span>
              )}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Local</span>
            <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              {reuniao.local}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Congregação</span>
            <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              {reuniao.congregacoes?.nome || 'Geral / Todas'}
            </span>
          </div>
        </div>
      </section>

      {/* ─── 2. CARDS DE QUÓRUM E PRESENÇA ─── */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Convocados</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalConvocados}</p>
          <span className="text-[10px] text-slate-400 font-semibold">Snapshot congelado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-bold uppercase">
            <span>Presentes</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">{countPresentes}</p>
          <span className="text-[10px] text-emerald-700/80 font-semibold">Check-in realizado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 text-xs font-bold uppercase">
            <span>Ausentes</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
            {reuniao.status === 'encerrada' ? countFaltas : countPendentes}
          </p>
          <span className="text-[10px] text-rose-600/80 font-semibold">
            {reuniao.status === 'encerrada' ? 'Faltas oficiais' : 'Pendentes'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 text-xs font-bold uppercase">
            <span>Justificados</span>
            <FileCheck2 className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">{countJustificadas}</p>
          <span className="text-[10px] text-amber-700/80 font-semibold">Ausências abonadas</span>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-teal-900 to-teal-950 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-300 text-xs font-bold uppercase">
            <span>Índice de Presença</span>
          </div>
          <div className="my-auto">
            <p className="text-2xl sm:text-3xl font-black text-teal-300">{percentualPresenca}%</p>
            <div className="w-full bg-teal-950 h-1.5 rounded-full overflow-hidden mt-1 border border-teal-800">
              <div
                className="bg-teal-400 h-full rounded-full"
                style={{ width: `${Math.min(100, percentualPresenca)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. SNAPSHOT DE PARTICIPANTES (MINISTROS CONVOCADOS) ─── */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden print:hidden">
        {/* Barra de Título */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Ministros Convocados</h2>
            <p className="text-xs text-slate-500">Snapshot de elegibilidade ministerial desta reunião</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              {totalRegistrosFiltrados} {totalRegistrosFiltrados === 1 ? 'ministro convocado' : 'ministros convocados'}
            </span>
          </div>
        </div>

        {/* Barra Única e Responsiva de Filtros e Ações */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Busca por nome do ministro */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome do ministro..."
                value={buscaMinistro}
                onChange={(e) => handleBuscaChange(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 shadow-sm transition"
              />
            </div>

            {/* 2. Filtro Congregação */}
            <div className="w-full sm:w-auto min-w-[150px]">
              <select
                value={filtroCongregacao}
                onChange={(e) => handleCongregacaoChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 shadow-sm transition"
              >
                <option value="todas">Congregação: Todas</option>
                {congregacoesDisponiveis.map((cong) => (
                  <option key={cong} value={cong}>
                    {cong}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Filtro Cargo */}
            <div className="w-full sm:w-auto min-w-[130px]">
              <select
                value={filtroCargo}
                onChange={(e) => handleCargoChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 shadow-sm transition"
              >
                <option value="todos">Cargo: Todos</option>
                {cargosDisponiveis.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Filtro Presença */}
            <div className="w-full sm:w-auto min-w-[130px]">
              <select
                value={filtroPresenca}
                onChange={(e) => handlePresencaChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-teal-500 shadow-sm transition"
              >
                <option value="todos">Presença: Todos</option>
                <option value="presente">Presentes</option>
                <option value="pendente">Pendentes</option>
                <option value="falta">Faltas</option>
                <option value="falta_justificada">Faltas Justificadas</option>
              </select>
            </div>

            {/* 5. Botão Limpar */}
            {temFiltrosAtivos && (
              <button
                onClick={limparFiltros}
                title="Limpar todos os filtros"
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Limpar</span>
              </button>
            )}

            {/* 6. Botão Imprimir Lista */}
            <button
              onClick={handleImprimir}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 shadow-sm active:scale-95 ml-auto"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Lista</span>
            </button>
          </div>
        </div>

        {/* Tabela de Ministros Convocados */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-4 w-12 text-center">Nº</th>
                <th className="py-3 px-4">Ministro</th>
                <th className="py-3 px-4">Cargo</th>
                <th className="py-3 px-4">Congregação / Área</th>
                <th className="py-3 px-4">Identificador</th>
                <th className="py-3 px-4 text-center">Horário Check-in</th>
                <th className="py-3 px-4 text-right">Status de Presença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {participantesPaginados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 italic space-y-2">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                    <p>Nenhum ministro encontrado com os filtros selecionados.</p>
                    {temFiltrosAtivos && (
                      <button
                        onClick={limparFiltros}
                        className="text-teal-600 hover:text-teal-700 font-bold text-xs underline mt-1"
                      >
                        Limpar filtros aplicados
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                participantesPaginados.map((p, idx) => {
                  const numeroGlobal = (paginaCorrigida - 1) * itensPorPagina + idx + 1;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {numeroGlobal}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {p.nome_ministro_snapshot}
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-semibold">
                        {p.cargo_snapshot}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <p className="font-semibold">{p.nome_congregacao_snapshot || 'Sede'}</p>
                        {p.area_snapshot && (
                          <p className="text-[10px] text-slate-400">{p.area_snapshot}</p>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {p.unique_id_snapshot || p.carteirinha_numero_snapshot || '—'}
                      </td>

                      <td className="py-3 px-4 text-center text-slate-600 font-mono text-[11px]">
                        {p.data_hora_checkin ? (
                          <span className="inline-flex items-center gap-1 text-slate-700">
                            <Clock className="w-3 h-3 text-cyan-600" />
                            {new Date(p.data_hora_checkin).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : p.status_presenca === 'presente' ? (
                          <span className="text-emerald-700 text-[10px] font-semibold">Confirmado</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {p.status_presenca === 'presente' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Presente
                          </span>
                        )}
                        {p.status_presenca === 'falta' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                            <UserX className="w-3.5 h-3.5 text-rose-500" />
                            Falta
                          </span>
                        )}
                        {p.status_presenca === 'falta_justificada' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                            <FileCheck2 className="w-3.5 h-3.5 text-amber-500" />
                            Justificada
                          </span>
                        )}
                        {p.status_presenca === 'pendente' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                            Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela: Paginação Client-Side */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          {/* Mostrando X–Y de Z ministros */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <span className="font-semibold text-slate-700">
              {totalRegistrosFiltrados > 0
                ? `Mostrando ${indiceInicioExibicao}–${indiceFimExibicao} de ${totalRegistrosFiltrados} ministros`
                : 'Nenhum registro'}
            </span>

            {/* Seletor de itens por página */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Exibir:</span>
              <select
                value={itensPorPagina}
                onChange={(e) => handleItensPorPaginaChange(Number(e.target.value))}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none focus:border-teal-500"
              >
                <option value={10}>10 por página</option>
                <option value={20}>20 por página</option>
                <option value={50}>50 por página</option>
              </select>
            </div>
          </div>

          {/* Controles de Navegação de Página */}
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
              <button
                onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
                disabled={paginaCorrigida <= 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold inline-flex items-center gap-1 transition shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              {/* Botões numéricos de páginas */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((p) => {
                    // Mostrar primeiras, últimas e páginas vizinhas da atual
                    return (
                      p === 1 ||
                      p === totalPaginas ||
                      Math.abs(p - paginaCorrigida) <= 1
                    );
                  })
                  .map((num, i, arr) => {
                    const prevNum = arr[i - 1];
                    const showEllipsis = prevNum && num - prevNum > 1;

                    return (
                      <div key={num} className="flex items-center gap-1">
                        {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                        <button
                          onClick={() => setPaginaAtual(num)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                            num === paginaCorrigida
                              ? 'bg-teal-600 text-white shadow-sm'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {num}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
                disabled={paginaCorrigida >= totalPaginas}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold inline-flex items-center gap-1 transition shadow-sm"
              >
                <span>Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ─── DOCUMENTO EXCLUSIVO DE IMPRESSÃO (CSS @media print) ─── */}
      <div className="hidden print:block text-black bg-white p-6 font-sans">
        {/* Cabeçalho Institucional Gestão Eklésia */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight uppercase text-slate-900">Gestão Eklésia</span>
              <span className="text-xs bg-slate-900 text-white font-bold px-2 py-0.5 rounded">Reuniões</span>
            </div>
            <p className="text-xs text-slate-600 font-semibold mt-0.5">Sistema Integrado de Gestão Ministerial</p>
          </div>
          <div className="text-right text-xs text-slate-600 space-y-0.5">
            <p className="font-bold text-slate-900">Lista de Ministros Convocados</p>
            <p>Emissão: {dataHoraImpressao || new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>

        {/* Metadados da Reunião Impressa */}
        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4 text-xs space-y-1">
          <div className="flex justify-between items-start">
            <h1 className="text-sm font-black text-slate-900 uppercase">{reuniao.titulo}</h1>
            <span className="font-bold uppercase text-[11px] px-2 py-0.5 rounded border border-slate-400">
              Status: {reuniao.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
            <p><strong>Data:</strong> {dataFormatada}</p>
            <p><strong>Horário:</strong> {reuniao.horario_inicio ? reuniao.horario_inicio.slice(0, 5) : '—'}</p>
            <p><strong>Local:</strong> {reuniao.local}</p>
            <p><strong>Congregação:</strong> {reuniao.congregacoes?.nome || 'Geral / Todas'}</p>
          </div>
          {reuniao.pauta && (
            <p className="text-slate-600 pt-1 border-t border-slate-200">
              <strong>Pauta:</strong> {reuniao.pauta}
            </p>
          )}

          {/* Filtros Utilizados na Impressão */}
          {temFiltrosAtivos && (
            <div className="pt-1.5 border-t border-slate-200 text-[11px] text-slate-600 flex flex-wrap gap-x-4">
              <strong>Filtros aplicados:</strong>
              {buscaMinistro.trim() && <span>Busca: &ldquo;{buscaMinistro}&rdquo;</span>}
              {filtroCongregacao !== 'todas' && <span>Congregação: {filtroCongregacao}</span>}
              {filtroCargo !== 'todos' && <span>Cargo: {filtroCargo}</span>}
              {filtroPresenca !== 'todos' && <span>Presença: {filtroPresenca}</span>}
            </div>
          )}
        </div>

        {/* Tabela de Impressão com TODOS os Registros Filtrados */}
        <table className="w-full text-left text-xs border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-300">
              <th className="p-2 border border-slate-300 w-8 text-center">Nº</th>
              <th className="p-2 border border-slate-300">Ministro</th>
              <th className="p-2 border border-slate-300">Cargo</th>
              <th className="p-2 border border-slate-300">Congregação / Área</th>
              <th className="p-2 border border-slate-300 text-center">Horário Check-in</th>
              <th className="p-2 border border-slate-300 text-center">Status de Presença</th>
            </tr>
          </thead>
          <tbody>
            {participantesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500 italic border border-slate-300">
                  Nenhum registro para os filtros selecionados.
                </td>
              </tr>
            ) : (
              participantesFiltrados.map((p, idx) => (
                <tr key={p.id} className="border-b border-slate-200">
                  <td className="p-2 border border-slate-300 text-center font-mono text-[11px]">{idx + 1}</td>
                  <td className="p-2 border border-slate-300 font-bold text-slate-900">{p.nome_ministro_snapshot}</td>
                  <td className="p-2 border border-slate-300 text-slate-800">{p.cargo_snapshot}</td>
                  <td className="p-2 border border-slate-300 text-slate-700">
                    {p.nome_congregacao_snapshot || 'Sede'}
                    {p.area_snapshot ? ` - ${p.area_snapshot}` : ''}
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-mono text-[11px]">
                    {p.data_hora_checkin
                      ? new Date(p.data_hora_checkin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : p.status_presenca === 'presente'
                      ? 'Confirmado'
                      : '—'}
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-bold uppercase text-[10px]">
                    {p.status_presenca === 'presente' && 'Presente'}
                    {p.status_presenca === 'falta' && 'Falta'}
                    {p.status_presenca === 'falta_justificada' && 'Falta Justificada'}
                    {p.status_presenca === 'pendente' && 'Pendente'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Rodapé do Documento Impresso */}
        <div className="mt-4 pt-3 border-t border-slate-300 flex justify-between items-center text-[11px] text-slate-600">
          <p>
            <strong>Total de registros impressos:</strong> {participantesFiltrados.length} ministro(s)
          </p>
          <p>
            Documento gerado eletronicamente pelo <strong>Gestão Eklésia</strong> em {dataHoraImpressao || new Date().toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* ─── MODAL: TERMINAL CHECK-IN ─── */}
      {modalCheckinAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Terminal de Check-in</h2>
                  <p className="text-[11px] text-slate-500">Registro de presença dos ministros</p>
                </div>
              </div>
              <button
                onClick={() => setModalCheckinAberto(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {isCheckinExpirado ? (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-center space-y-1">
                  <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
                  <p className="font-bold text-xs">Check-in encerrado.</p>
                  <p className="text-[11px] text-amber-700">O horário limite foi atingido.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                      {/* QR Code gerado dinamicamente para o link do terminal */}
                      {urlCheckinTerminal && (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                            urlCheckinTerminal
                          )}&bgcolor=FFFFFF&color=0F172A`}
                          alt="QR Code Terminal Check-in"
                          className="w-40 h-40 object-contain rounded-lg"
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold mt-2">
                      Aponte a câmera do dispositivo ou leitor
                    </span>
                  </div>

                  {/* URL Box */}
                  <div className="p-3 bg-slate-900 text-teal-300 font-mono text-xs rounded-xl break-all border border-slate-800 flex items-center justify-between gap-2">
                    <span className="truncate">{urlCheckinTerminal}</span>
                    <button
                      onClick={copiarLinkCheckin}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition shrink-0"
                      title="Copiar link"
                    >
                      {copiadoCheckin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={copiarLinkCheckin}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                    >
                      {copiadoCheckin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiadoCheckin ? 'Link Copiado!' : 'Copiar Link'}</span>
                    </button>

                    <Link
                      href={`/reunioes/${reuniao.id}/checkin`}
                      className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5 transition text-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Check-in</span>
                    </Link>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setModalCheckinAberto(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: PAINEL TV ─── */}
      {modalPainelAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
                  <Tv className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Painel Informativo TV</h2>
                  <p className="text-[11px] text-slate-500">Exibição pública em projetor/TV</p>
                </div>
              </div>
              <button
                onClick={() => setModalPainelAberto(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {reuniao.status === 'encerrada' ? (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs text-center font-medium">
                  Painel indisponível. A reunião foi encerrada.
                </div>
              ) : (
                <>
                  <p className="text-slate-600 font-medium leading-relaxed">
                    Este link seguro exibe apenas indicadores agregados e consolidados em tempo real, sem necessidade de login.
                  </p>

                  {carregandoToken ? (
                    <div className="p-6 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-600 mb-2" />
                      <span>Obtendo chave de exibição segura...</span>
                    </div>
                  ) : tokenInfo?.url_painel ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-slate-900 text-teal-300 font-mono text-xs rounded-xl break-all border border-slate-800 flex items-center justify-between gap-2">
                        <span className="truncate">{tokenInfo.url_painel}</span>
                        <button
                          onClick={copiarLinkPainel}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                          title="Copiar link"
                        >
                          {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={copiarLinkPainel}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                        >
                          {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiado ? 'Link Copiado!' : 'Copiar Link'}</span>
                        </button>

                        <a
                          href={tokenInfo.url_painel}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir na TV</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs">
                      Painel inativo ou não inicializado.
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setModalPainelAberto(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONFIRMAÇÃO DE ENCERRAMENTO ─── */}
      {modalEncerrarAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-800">Encerrar Reunião Ministerial?</h2>
              <p className="text-xs text-slate-500 font-semibold">{reuniao.titulo}</p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1.5 leading-relaxed">
              <p>• Novos check-ins serão bloqueados imediatamente.</p>
              <p>• Os ministros sem presença confirmada receberão registro de <strong>falta</strong>.</p>
              <p>• Cartas de advertência com protocolo serão geradas automaticamente.</p>
              <p>• O painel público de exibição será desativado.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalEncerrarAberto(false)}
                disabled={encerrando}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Voltar
              </button>
              <button
                onClick={executarEncerramento}
                disabled={encerrando}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {encerrando ? 'Encerrando e Processando Faltas...' : 'Confirmar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
