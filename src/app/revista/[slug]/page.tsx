'use client';

import { useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  MESES_NOMES,
  getVisibleMonthsForEdition,
  resolveTargetPageIndex,
  getInstitutionalYearMonth,
  paginateDepartmentsForRevista,
  DEFAULT_INSTITUTIONAL_TIMEZONE,
  type PalavraPastorEdicao,
  type DepartamentoRevistaPublico,
} from '@/lib/revista-digital-utils';
import PageFlipBook from '@/components/revista/PageFlipBook';
import {
  Clock,
  MapPin,
  BookOpen,
  Share2,
  Sparkles,
  Award,
  Video,
  FileText,
  AlertCircle,
  Loader2,
  ExternalLink,
  Church,
  CalendarDays,
  Smartphone,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface EventoTipo {
  nome: string | null;
  categoria: string | null;
  cor: string | null;
  icone: string | null;
}

interface EventoPublico {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  status: string;
  calendario_oficial: boolean;
  tipo: EventoTipo | null;
}

interface RevistaData {
  instituicao: {
    nome: string;
    slug: string;
    descricao: string | null;
    logo_url: string | null;
    website: string | null;
    telefone: string | null;
    endereco: string | null;
    responsavel: string | null;
  };
  tema_anual: {
    ano: number;
    tema: string;
    descricao: string | null;
    publicado_em: string | null;
  } | null;
  palavra_pastor?: PalavraPastorEdicao | null;
  departamentos_secao?: {
    titulo: string;
    subtitulo: string;
    departamentos: DepartamentoRevistaPublico[];
  } | null;
  mensagem_pastoral: {
    titulo: string;
    conteudo_texto: string | null;
    video_url: string | null;
    video_tipo: string | null;
    data_inicio: string;
    data_fim: string;
  } | null;
  ano: number;
  total_eventos: number;
  eventos: EventoPublico[];
}

type TipoPagina = 'capa' | 'editorial' | 'institucional' | 'mes';

interface PaginaRevista {
  id: string;
  tipo: TipoPagina;
  titulo: string;
  numeroPagina: number;
  mesIndex?: number;
  departamentosChunk?: DepartamentoRevistaPublico[];
}

export default function RevistaPublicaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f4f7fa] flex flex-col items-center justify-center p-4">
          <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
        </div>
      }
    >
      <RevistaContent />
    </Suspense>
  );
}

function RevistaContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const anoParam = searchParams.get('ano');
  const mesParam = searchParams.get('mes');

  const [data, setData] = useState<RevistaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Navegação de páginas da revista
  const [paginaAtual, setPaginaAtual] = useState<number>(0);

  // Modo de visualização: 'revista' (com folheamento interativo) ou 'leitura' (fluxo contínuo)
  const [modoVisualizacao, setModoVisualizacao] = useState<'revista' | 'leitura'>('revista');

  // Filtro de categoria de eventos
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  // Controle de falha ao carregar logo
  const [logoImgError, setLogoImgError] = useState<boolean>(false);

  // Bloqueio de zoom por pinça (Safari iOS gesture*) e duplo toque exclusivamente na revista pública
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchend', preventDoubleTapZoom);
    };
  }, []);

  // Carregar dados públicos do endpoint existente
  useEffect(() => {
    if (!slug) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const queryStr = anoParam ? `?ano=${encodeURIComponent(anoParam)}` : '';
    const url = `/api/v1/public/agenda/${encodeURIComponent(slug)}${queryStr}`;

    fetch(url, { cache: 'no-cache' })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Esta publicação ou ministério não foi encontrado ou está temporariamente indisponível.');
          }
          if (res.status === 429) {
            throw new Error('Muitos acessos no momento. Por favor, aguarde alguns instantes e recarregue a página.');
          }
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Não foi possível carregar a revista digital.');
        }
        return res.json();
      })
      .then((jsonData: RevistaData) => {
        if (isMounted) {
          setData(jsonData);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Erro ao carregar a revista.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug, anoParam]);

  // Agrupamento de eventos por mês (0 a 11)
  const eventosPorMes = useMemo(() => {
    const mapa: Record<number, EventoPublico[]> = {};
    for (let i = 0; i < 12; i++) {
      mapa[i] = [];
    }

    if (!data?.eventos) return mapa;

    data.eventos.forEach((ev) => {
      try {
        const d = new Date(ev.data_inicio);
        const m = d.getMonth();
        if (mapa[m]) {
          mapa[m].push(ev);
        }
      } catch {
        // Ignora data inválida
      }
    });

    return mapa;
  }, [data?.eventos]);

  // Estruturação das páginas dinâmicas da revista
  const paginas = useMemo<PaginaRevista[]>(() => {
    const lista: PaginaRevista[] = [];
    let num = 1;

    // Página 1: Capa
    lista.push({
      id: 'capa',
      tipo: 'capa',
      titulo: 'Capa Oficial',
      numeroPagina: num++,
    });

    // Página 2: Palavra do Pastor / Editorial (se publicada)
    if (data?.palavra_pastor?.publicada || data?.mensagem_pastoral) {
      lista.push({
        id: 'editorial',
        tipo: 'editorial',
        titulo: data?.palavra_pastor?.titulo || 'Palavra do Pastor',
        numeroPagina: num++,
      });
    }

    // Páginas Institucionais: Nossos Departamentos (até 4 por página)
    if (data?.departamentos_secao?.departamentos?.length) {
      const depChunks = paginateDepartmentsForRevista(data.departamentos_secao.departamentos, 4);
      depChunks.forEach((chunk, idx) => {
        lista.push({
          id: `departamentos-${idx}`,
          tipo: 'institucional',
          titulo:
            depChunks.length > 1
              ? `${data.departamentos_secao!.titulo} (${idx + 1}/${depChunks.length})`
              : data.departamentos_secao!.titulo,
          departamentosChunk: chunk,
          numeroPagina: num++,
        });
      });
    }

    // Meses visíveis (apenas mês vigente e futuros da edição anual)
    const { year: currentYear } = getInstitutionalYearMonth(new Date(), DEFAULT_INSTITUTIONAL_TIMEZONE);
    const editionYear = data?.ano ?? currentYear;
    const visibleMonths = getVisibleMonthsForEdition(editionYear, new Date(), DEFAULT_INSTITUTIONAL_TIMEZONE);

    for (const m of visibleMonths) {
      lista.push({
        id: `mes-${m}`,
        tipo: 'mes',
        titulo: MESES_NOMES[m],
        mesIndex: m,
        numeroPagina: num++,
      });
    }

    return lista;
  }, [data?.mensagem_pastoral, data?.palavra_pastor, data?.departamentos_secao, data?.ano]);

  // Redirecionar parâmetro ?mes=... (incluindo meses encerrados -> mês vigente) e garantir índice válido
  useEffect(() => {
    if (!data || paginas.length === 0) return;
    if (mesParam) {
      const targetIdx = resolveTargetPageIndex(
        paginas,
        mesParam,
        data.ano,
        new Date(),
        DEFAULT_INSTITUTIONAL_TIMEZONE
      );
      setPaginaAtual(targetIdx);
    } else if (paginaAtual >= paginas.length) {
      setPaginaAtual(0);
    }
  }, [data, mesParam, paginas, paginaAtual]);

  const totalPaginas = paginas.length;

  // Função para mudar de página (sincronizada com PageFlipBook 3D)
  const irParaPagina = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalPaginas || index === paginaAtual) return;
      setPaginaAtual(index);
    },
    [paginaAtual, totalPaginas]
  );

  // Função utilitária para obter o índice da página correspondente ao mês vigente (Timezone: America/Belem)
  const getIndicePaginaMesVigente = useCallback((): number => {
    try {
      const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Belem',
        year: 'numeric',
        month: 'numeric',
      }).formatToParts(new Date());

      const anoAtualBrasil = Number(parts.find((p) => p.type === 'year')?.value);
      const mesAtualBrasil = Number(parts.find((p) => p.type === 'month')?.value); // 1 a 12

      // Se o ano da edição for o mesmo ano do calendário brasileiro vigente
      if (data?.ano && data.ano === anoAtualBrasil && !isNaN(mesAtualBrasil)) {
        const mesIndex0 = mesAtualBrasil - 1; // 0 a 11
        const indicePagina = paginas.findIndex(
          (pg) => pg.tipo === 'mes' && pg.mesIndex === mesIndex0
        );

        if (indicePagina !== -1) {
          return indicePagina;
        }
      }
    } catch {
      // Fallback seguro caso ocorra erro no formatador de fuso horário
    }

    // Fallback previsível: primeira página após a capa (editorial ou mês 0)
    return paginas.length > 1 ? 1 : 0;
  }, [data?.ano, paginas]);

  // Ação ao clicar no CTA principal "ABRIR REVISTA"
  const handleAbrirRevista = useCallback(() => {
    const destinoIndex = getIndicePaginaMesVigente();
    irParaPagina(destinoIndex);
  }, [getIndicePaginaMesVigente, irParaPagina]);

  const avancarPagina = useCallback(() => {
    if (paginaAtual < totalPaginas - 1) {
      irParaPagina(paginaAtual + 1);
    }
  }, [paginaAtual, totalPaginas, irParaPagina]);

  const retrocederPagina = useCallback(() => {
    if (paginaAtual > 0) {
      irParaPagina(paginaAtual - 1);
    }
  }, [paginaAtual, irParaPagina]);

  // Atalhos de teclado (setas esquerda/direita)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        avancarPagina();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        retrocederPagina();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [avancarPagina, retrocederPagina]);

  // Formatação amigável de data e hora
  const formatarDataHora = (dataInicioIso: string, dataFimIso: string | null) => {
    try {
      const inicio = new Date(dataInicioIso);
      const dia = inicio.getDate().toString().padStart(2, '0');
      const mes = MESES_NOMES[inicio.getMonth()].substring(0, 3).toUpperCase();
      const horas = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      let fimHoras = '';
      if (dataFimIso) {
        const fim = new Date(dataFimIso);
        fimHoras = ` às ${fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      }

      return { dia, mes, horario: `${horas}${fimHoras}` };
    } catch {
      return { dia: '--', mes: '---', horario: '' };
    }
  };

  const handleCompartilhar = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: data?.instituicao?.nome ? `Revista Digital — ${data.instituicao.nome}` : 'Revista Digital',
        url: window.location.href,
      }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert('Link da Revista copiado para a área de transferência!');
    }
  };

  // Auto-centralizar item ativo do índice quando paginaAtual mudar
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const activeBtn = document.getElementById(`indice-btn-${paginaAtual}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [paginaAtual]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f7fa] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center max-w-sm w-full border border-slate-100 text-center">
          <Loader2 className="w-12 h-12 text-teal-600 animate-spin mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Carregando Revista Digital...</h2>
          <p className="text-sm text-slate-500 mt-2">Buscando programação oficial e publicações do ministério.</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f4f7fa] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Revista Indisponível</h2>
          <p className="text-slate-600 mt-3 text-sm leading-relaxed">{error || 'Não foi possível encontrar as informações desta publicação.'}</p>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-semibold text-sm transition shadow-sm"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { instituicao, tema_anual, mensagem_pastoral, ano } = data;

  return (
    <div
      className={`${
        modoVisualizacao === 'revista' ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'
      } bg-[#f4f7fa] text-slate-800 flex flex-col overflow-x-hidden touch-pan-y selection:bg-teal-100 selection:text-teal-900`}
    >
      {/* ─── ESTILOS CSS EDITORIAIS E ROLAGEM DISCRETA ──────────────── */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .revista-scroll::-webkit-scrollbar {
          width: 3px;
          height: 3px;
        }
        .revista-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .revista-scroll::-webkit-scrollbar-thumb {
          background: rgba(15, 118, 110, 0.25);
          border-radius: 9999px;
        }
        @media (max-height: 680px) {
          .capa-editorial {
            padding: 0.875rem !important;
            gap: 0.5rem !important;
          }
          .capa-editorial h2 {
            font-size: 1.25rem !important;
            line-height: 1.2 !important;
          }
          .capa-editorial .capa-cta {
            padding-top: 0.625rem !important;
            padding-bottom: 0.625rem !important;
            font-size: 0.75rem !important;
          }
        }
      `}</style>

      {/* ─── BARRA SUPERIOR INSTITUCIONAL COMPACTA ────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 py-2 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {instituicao.logo_url ? (
              <img
                src={instituicao.logo_url}
                alt={instituicao.nome}
                className="w-8 h-8 object-contain rounded-lg border border-slate-200/70 p-0.5 bg-white shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center font-black border border-teal-100 shrink-0">
                <Church className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-serif font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                {instituicao.nome}
              </h1>
              <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider flex items-center gap-1">
                <BookOpen className="w-2.5 h-2.5" /> Edição {ano}
              </p>
            </div>
          </div>

          {/* Alternância de Modo (Revista Interativa vs Fluxo Contínuo) & Compartilhar */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
              <button
                onClick={() => setModoVisualizacao('revista')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  modoVisualizacao === 'revista'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Visualização em páginas folheáveis"
              >
                <Layers className="w-3.5 h-3.5 text-teal-700" />
                <span>Folhear Revista</span>
              </button>
              <button
                onClick={() => setModoVisualizacao('leitura')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  modoVisualizacao === 'leitura'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Visualização em lista contínua"
              >
                <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                <span>Leitura Vertical</span>
              </button>
            </div>

            <button
              onClick={handleCompartilhar}
              aria-label="Compartilhar"
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center gap-2 text-xs font-bold shadow-xs active:scale-95"
            >
              <Share2 className="w-4 h-4 text-teal-700" />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── ÍNDICE RÁPIDO HORIZONTAL (ACESSO RÁPIDO A QUALQUER PÁGINA) ── */}
      <nav
        aria-label="Sumário da Revista"
        className="bg-white/90 border-b border-slate-200/60 px-3 py-1.5 sticky top-[45px] z-30 overflow-x-auto no-scrollbar"
      >
        <div className="max-w-6xl mx-auto flex items-center gap-1.5 min-w-max text-xs">
          {paginas.map((pg, idx) => {
            const isAtual = paginaAtual === idx;
            return (
              <button
                id={`indice-btn-${idx}`}
                key={pg.id}
                onClick={() => {
                  irParaPagina(idx);
                  if (modoVisualizacao === 'leitura') {
                    const el = document.getElementById(pg.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition flex items-center gap-1 shrink-0 ${
                  isAtual
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                }`}
              >
                <span>{pg.titulo}</span>
                <span className={`text-[10px] opacity-70 ${isAtual ? 'text-teal-200' : 'text-slate-400'}`}>
                  p.{pg.numeroPagina}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─── CORPO PRINCIPAL (ÁREA ÚTIL MAXIMIZADA) ────────────────── */}
      <main
        className={`flex-1 min-h-0 max-w-6xl w-full mx-auto px-1.5 sm:px-3 py-1.5 sm:py-2 flex flex-col ${
          modoVisualizacao === 'revista' ? 'overflow-hidden' : ''
        }`}
      >
        {modoVisualizacao === 'revista' ? (
          /* ══════════════════════════════════════════════════════════════
             MODO REVISTA: FOLHEAMENTO INTERATIVO COM TRANSIÇÃO 3D
             ══════════════════════════════════════════════════════════════ */
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* CONTAINER PERSPECTIVA DO LIVRO / REVISTA 3D */}
            <PageFlipBook
              currentPage={paginaAtual}
              onPageChange={setPaginaAtual}
              bookKey={`${data.ano}-${paginas.map((p) => p.id).join(',')}-${filtroCategoria}`}
            >
              {paginas.map((pg) => (
                <div key={pg.id} className="w-full h-full">
                {/* ─── PÁGINA: CAPA ───────────────────────────────────── */}
                {pg.tipo === 'capa' && (
                  <div className="capa-editorial relative overflow-hidden bg-slate-950 text-white p-4 sm:p-10 lg:p-12 pb-5 sm:pb-10 h-full min-h-0 flex flex-col justify-between gap-2.5 sm:gap-4">
                    {/* Imagem de Fundo Oficial da Capa */}
                    <div
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
                      style={{ backgroundImage: "url('/img/bg_agenda.png')" }}
                    />
                    {/* Camada de Gradiente / Overlay para Contraste e Legibilidade */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-teal-950/20 mix-blend-multiply pointer-events-none" />

                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {instituicao.logo_url && !logoImgError ? (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2 flex items-center justify-center shrink-0 shadow-lg">
                              <img
                                src={instituicao.logo_url}
                                alt={instituicao.nome}
                                onError={() => setLogoImgError(true)}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-lg text-teal-200">
                              <Church className="w-6 h-6 sm:w-7 sm:h-7" />
                            </div>
                          )}

                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-teal-200 uppercase tracking-widest shadow-xs">
                            <Sparkles className="w-3.5 h-3.5 text-teal-300" /> Edição Anual {ano}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono text-teal-200/80 uppercase tracking-wider">
                            Revista Oficial
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4 max-w-2xl pt-4">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white drop-shadow-xs">
                          {tema_anual?.tema || instituicao.nome}
                        </h2>

                        {tema_anual?.descricao ? (
                          <p className="text-sm sm:text-base text-teal-100/90 leading-relaxed font-normal">
                            {tema_anual.descricao}
                          </p>
                        ) : instituicao.descricao ? (
                          <p className="text-sm sm:text-base text-teal-100/90 leading-relaxed font-normal">
                            {instituicao.descricao}
                          </p>
                        ) : (
                          <p className="text-sm sm:text-base text-teal-100/90 leading-relaxed font-normal">
                            Programação anual completa, cultos solenes, conferências e atividades ministeriais.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Rodapé e CTA Principal da Capa */}
                    <div className="relative z-10 pt-8 mt-6 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-xs text-teal-200/80">
                      {/* Informações Institucionais (Endereço e Website) */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 order-2 sm:order-1 max-w-md">
                        {instituicao.endereco && (
                          <span className="flex items-center gap-1.5 leading-relaxed">
                            <MapPin className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                            {instituicao.endereco}
                          </span>
                        )}
                        {instituicao.website && (
                          <a
                            href={instituicao.website.startsWith('http') ? instituicao.website : `https://${instituicao.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-white underline underline-offset-2 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {instituicao.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>

                      {/* Botão de Destaque Prioritário "ABRIR REVISTA" */}
                      <button
                        type="button"
                        onClick={handleAbrirRevista}
                        className="group relative order-1 sm:order-2 inline-flex items-center justify-center gap-3 h-[58px] min-w-[230px] px-8 rounded-2xl bg-teal-400 hover:bg-teal-300 active:scale-[0.98] text-slate-950 font-black text-[15px] sm:text-base uppercase tracking-wider cursor-pointer border border-teal-200/50 shadow-[0_10px_25px_-5px_rgba(20,184,166,0.4),0_0_20px_rgba(45,212,191,0.35)] hover:shadow-[0_14px_30px_-4px_rgba(20,184,166,0.55),0_0_28px_rgba(45,212,191,0.5)] hover:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-teal-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none w-full sm:w-auto shrink-0 select-none"
                      >
                        <BookOpen className="w-5 h-5 text-slate-950 shrink-0" />
                        <span className="font-extrabold tracking-wide">Abrir Revista</span>
                        <ArrowRight className="w-5 h-5 text-slate-950 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transform-none" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── PÁGINA 2: PALAVRA DO PASTOR / EDITORIAL ────────── */}
                {pg.tipo === 'editorial' && (data?.palavra_pastor?.publicada || mensagem_pastoral) && (
                  <div className="p-6 sm:p-10 min-h-[520px] flex flex-col justify-between space-y-5 bg-gradient-to-br from-white via-white to-teal-50/30">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-teal-700 tracking-widest uppercase">
                              Edição {data.ano} • Palavra Institucional
                            </span>
                            <h3 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 leading-tight">
                              {data?.palavra_pastor?.publicada
                                ? data.palavra_pastor.titulo || 'Palavra do Pastor'
                                : mensagem_pastoral?.titulo}
                            </h3>
                          </div>
                        </div>

                        <span className="text-xs font-mono font-bold text-slate-400">p.{pg.numeroPagina}</span>
                      </div>

                      {data?.palavra_pastor?.publicada ? (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                          {data.palavra_pastor.foto_url && (
                            <div className="md:col-span-5">
                              <div className="rounded-2xl overflow-hidden border-2 border-teal-50 shadow-md bg-slate-100">
                                <img
                                  src={data.palavra_pastor.foto_url}
                                  alt="Pastor e Esposa"
                                  className="w-full max-h-[30vh] sm:max-h-[34vh] md:max-h-none md:aspect-[4/5] object-cover object-top"
                                />
                              </div>
                            </div>
                          )}
                          <div className={data.palavra_pastor.foto_url ? 'md:col-span-7 space-y-3' : 'md:col-span-12 space-y-3'}>
                            <div
                              className="prose prose-sm sm:prose-base prose-slate max-w-none text-slate-700 leading-relaxed font-sans"
                              dangerouslySetInnerHTML={{
                                __html: data.palavra_pastor.conteudo_html || '',
                              }}
                            />

                            {(data.palavra_pastor.nome_pastor || data.palavra_pastor.nome_esposa || data.palavra_pastor.assinatura) && (
                              <div className="pt-3 border-t border-slate-200/70">
                                {(data.palavra_pastor.nome_pastor || data.palavra_pastor.nome_esposa) && (
                                  <p className="text-sm font-bold text-slate-900">
                                    {data.palavra_pastor.nome_pastor}
                                    {data.palavra_pastor.nome_pastor && data.palavra_pastor.nome_esposa ? ' & ' : ''}
                                    {data.palavra_pastor.nome_esposa}
                                  </p>
                                )}
                                {data.palavra_pastor.assinatura && (
                                  <p className="text-xs text-teal-700 font-semibold mt-0.5">
                                    {data.palavra_pastor.assinatura}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-sm sm:text-base space-y-4 whitespace-pre-line max-h-[380px] overflow-y-auto pr-2">
                          {mensagem_pastoral?.conteudo_texto}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {!data?.palavra_pastor?.publicada && mensagem_pastoral?.video_url ? (
                        <a
                          href={mensagem_pastoral.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition"
                        >
                          <Video className="w-4 h-4" /> Assistir Mensagem em Vídeo
                        </a>
                      ) : (
                        <div />
                      )}

                      <span className="text-xs text-slate-400 italic">{instituicao.nome} • Palavra Pastoral</span>
                    </div>
                  </div>
                )}

                {/* ─── PÁGINAS INSTITUCIONAIS: NOSSOS DEPARTAMENTOS ─────── */}
                {pg.tipo === 'institucional' && pg.departamentosChunk && (
                  <div className="p-6 sm:p-10 min-h-[520px] flex flex-col justify-between space-y-5 bg-gradient-to-br from-white via-white to-slate-50">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                        <div>
                          <span className="text-[10px] font-bold text-teal-700 tracking-widest uppercase">
                            Edição {data.ano} • Seção Institucional
                          </span>
                          <h3 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 leading-tight">
                            {data.departamentos_secao?.titulo || 'Nossos Departamentos'}
                          </h3>
                          {data.departamentos_secao?.subtitulo && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {data.departamentos_secao.subtitulo}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-400">p.{pg.numeroPagina}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 divide-y sm:divide-y-0 divide-slate-100">
                        {pg.departamentosChunk.map((dep) => (
                          <div
                            key={dep.id}
                            className="pt-4 sm:pt-0 pb-3 border-b border-slate-200/70 flex flex-col gap-2.5"
                          >
                            <div className="flex items-center gap-3">
                              {dep.logo_url ? (
                                <img
                                  src={dep.logo_url}
                                  alt={dep.sigla || dep.nome}
                                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-700 to-teal-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                                  {(dep.sigla || dep.nome.slice(0, 3)).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                {dep.sigla && (
                                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/70 mb-1">
                                    {dep.sigla}
                                  </span>
                                )}
                                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                  {dep.nome}
                                </h4>
                              </div>
                            </div>

                            {dep.lideranca.length > 0 && (
                              <div className="border-t border-slate-100 pt-2.5 space-y-1 max-h-[140px] overflow-y-auto pr-1">
                                {dep.lideranca.map((lid, lIdx) => (
                                  <div key={lIdx} className="text-xs flex items-baseline justify-between gap-2">
                                    <span className="text-slate-500 font-medium shrink-0">{lid.cargo}:</span>
                                    <span className="text-slate-800 font-semibold text-right">{lid.nome}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>{instituicao.nome}</span>
                      <span className="font-mono font-bold">p.{pg.numeroPagina}</span>
                    </div>
                  </div>
                )}

                {/* ─── PÁGINA: MÊS DO CALENDÁRIO ──────────────────────── */}
                {pg.tipo === 'mes' && pg.mesIndex !== undefined && (
                  <div className="p-6 sm:p-10 lg:p-12 min-h-[520px] flex flex-col justify-between space-y-6">
                    <div className="space-y-6">
                      {/* Cabeçalho do Mês */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-teal-700 tracking-wider uppercase">
                              Calendário {ano}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {eventosPorMes[pg.mesIndex]?.length || 0} eventos
                            </span>
                          </div>
                          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                            {MESES_NOMES[pg.mesIndex]}
                          </h3>
                        </div>

                        {/* Filtro rápido dentro da página */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { id: 'todos', label: 'Todos' },
                            { id: 'oficial', label: 'Oficiais' },
                            { id: 'culto', label: 'Cultos' },
                            { id: 'reuniao', label: 'Reuniões' },
                            { id: 'evento', label: 'Eventos' },
                            { id: 'departamento', label: 'Departamentos' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setFiltroCategoria(f.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                filtroCategoria === f.id
                                  ? 'bg-teal-700 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lista de Eventos do Mês */}
                      {(() => {
                        const listaMes = eventosPorMes[pg.mesIndex] || [];
                        const filtrados =
                          filtroCategoria === 'todos'
                            ? listaMes
                            : filtroCategoria === 'oficial'
                            ? listaMes.filter((e) => e.calendario_oficial)
                            : listaMes.filter((e) => e.tipo?.categoria === filtroCategoria);

                        if (filtrados.length === 0) {
                          return (
                            <div className="text-center py-16 px-4 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200">
                              <CalendarDays className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                              <h4 className="text-base font-bold text-slate-800">Sem eventos programados</h4>
                              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                Nenhuma atividade pública cadastrada para este mês com o filtro selecionado.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-1">
                            {filtrados.map((evento) => {
                              const { dia, mes, horario } = formatarDataHora(
                                evento.data_inicio,
                                evento.data_fim
                              );
                              const corTipo = evento.tipo?.cor || '#0f766e';

                              return (
                                <article
                                  key={evento.id}
                                  className="group bg-white rounded-2xl p-4 border border-slate-200/90 hover:border-teal-300 hover:shadow-xs transition flex gap-3.5 items-start"
                                >
                                  <div className="shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-xl bg-teal-50 border border-teal-100/80 text-teal-900 group-hover:bg-teal-700 group-hover:text-white transition">
                                    <span className="text-base font-black leading-none">{dia}</span>
                                    <span className="text-[9px] font-bold tracking-wider uppercase mt-1 opacity-80">
                                      {mes}
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {evento.tipo?.nome && (
                                        <span
                                          className="text-[9px] font-bold px-2 py-0.5 rounded-md text-white"
                                          style={{ backgroundColor: corTipo }}
                                        >
                                          {evento.tipo.nome}
                                        </span>
                                      )}
                                      {evento.calendario_oficial && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                          <Award className="w-2.5 h-2.5 text-amber-600" /> Oficial
                                        </span>
                                      )}
                                    </div>

                                    <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-teal-900 transition">
                                      {evento.titulo}
                                    </h4>

                                    {evento.descricao && (
                                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                        {evento.descricao}
                                      </p>
                                    )}

                                    <div className="pt-1 flex flex-col gap-0.5 text-[11px] text-slate-500 font-medium">
                                      {horario && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                          {horario}
                                        </span>
                                      )}
                                      {evento.local && (
                                        <span className="flex items-center gap-1 truncate">
                                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                          <span className="truncate">{evento.local}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>{instituicao.nome}</span>
                      <span className="font-mono font-bold">p.{pg.numeroPagina}</span>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </PageFlipBook>

          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════
             MODO LEITURA VERTICAL: OTIMIZADO PARA SMARTPHONES E FLUXO CONTÍNUO
             ══════════════════════════════════════════════════════════════ */
          <div className="space-y-8">
            {/* CAPA INSTITUCIONAL COMPACTA */}
            <section
              id="capa"
              className="relative overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl p-6 sm:p-10"
            >
              {/* Imagem de Fundo Oficial da Capa */}
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
                style={{ backgroundImage: "url('/img/bg_agenda.png')" }}
              />
              {/* Camada de Gradiente / Overlay para Contraste e Legibilidade */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-teal-950/20 mix-blend-multiply pointer-events-none" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  {instituicao.logo_url && !logoImgError ? (
                    <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-1.5 flex items-center justify-center shrink-0 shadow-md">
                      <img
                        src={instituicao.logo_url}
                        alt={instituicao.nome}
                        onError={() => setLogoImgError(true)}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-md text-teal-200">
                      <Church className="w-5 h-5" />
                    </div>
                  )}

                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-teal-200 uppercase tracking-widest">
                    <Sparkles className="w-3.5 h-3.5 text-teal-300" /> Edição Anual {ano}
                  </div>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white">{tema_anual?.tema || instituicao.nome}</h2>
                {tema_anual?.descricao && (
                  <p className="text-sm text-teal-100/90 leading-relaxed">{tema_anual.descricao}</p>
                )}
                {instituicao.endereco && (
                  <p className="text-xs text-teal-200/80 flex items-center gap-1.5 pt-2">
                    <MapPin className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                    {instituicao.endereco}
                  </p>
                )}
              </div>
            </section>

            {/* MENSAGEM PASTORAL */}
            {mensagem_pastoral && (
              <section
                id="editorial"
                className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/90 space-y-4"
              >
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <FileText className="w-5 h-5 text-teal-700" />
                  <div>
                    <span className="text-[11px] font-bold text-teal-700 uppercase">Editorial</span>
                    <h3 className="text-xl font-black text-slate-900">{mensagem_pastoral.titulo}</h3>
                  </div>
                </div>
                <div className="prose text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                  {mensagem_pastoral.conteudo_texto}
                </div>
                {mensagem_pastoral.video_url && (
                  <a
                    href={mensagem_pastoral.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white font-bold text-xs"
                  >
                    <Video className="w-4 h-4" /> Assistir Vídeo
                  </a>
                )}
              </section>
            )}

            {/* CALENDÁRIO MÊS A MÊS */}
            {MESES_NOMES.map((nomeMes, mIdx) => {
              const eventosMes = eventosPorMes[mIdx] || [];
              return (
                <section
                  key={nomeMes}
                  id={`mes-${mIdx}`}
                  className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-xl font-black text-slate-900">{nomeMes}</h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-bold text-slate-600">
                      {eventosMes.length} eventos
                    </span>
                  </div>

                  {eventosMes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">Nenhum evento neste mês.</p>
                  ) : (
                    <div className="space-y-3">
                      {eventosMes.map((ev) => {
                        const { dia, mes, horario } = formatarDataHora(ev.data_inicio, ev.data_fim);
                        return (
                          <article
                            key={ev.id}
                            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex gap-3 items-start"
                          >
                            <div className="w-11 h-12 rounded-xl bg-teal-100 text-teal-900 font-black flex flex-col items-center justify-center shrink-0">
                              <span className="text-sm leading-none">{dia}</span>
                              <span className="text-[9px] uppercase mt-0.5">{mes}</span>
                            </div>
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                {ev.tipo?.nome && (
                                  <span
                                    className="text-[9px] font-bold px-2 py-0.5 rounded-md text-white"
                                    style={{ backgroundColor: ev.tipo.cor || '#0f766e' }}
                                  >
                                    {ev.tipo.nome}
                                  </span>
                                )}
                                {ev.calendario_oficial && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                    <Award className="w-2.5 h-2.5 text-amber-600" /> Oficial
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-slate-900">{ev.titulo}</h4>
                              {ev.descricao && <p className="text-xs text-slate-600 mt-0.5">{ev.descricao}</p>}
                              <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-500 mt-1">
                                {horario && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                    {horario}
                                  </span>
                                )}
                                {ev.local && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{ev.local}</span>
                                  </span>
                                )}
                              </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
