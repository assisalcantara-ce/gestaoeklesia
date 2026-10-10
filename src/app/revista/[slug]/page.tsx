'use client';

import { useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
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

const MESES_NOMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

type TipoPagina = 'capa' | 'editorial' | 'mes';

interface PaginaRevista {
  id: string;
  tipo: TipoPagina;
  titulo: string;
  numeroPagina: number;
  mesIndex?: number;
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

  const [data, setData] = useState<RevistaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Navegação de páginas da revista
  const [paginaAtual, setPaginaAtual] = useState<number>(0);
  const [animandoDirecao, setAnimandoDirecao] = useState<'next' | 'prev' | null>(null);
  const [isVirando, setIsVirando] = useState<boolean>(false);

  // Modo de visualização: 'revista' (com folheamento interativo) ou 'leitura' (fluxo contínuo)
  const [modoVisualizacao, setModoVisualizacao] = useState<'revista' | 'leitura'>('revista');

  // Filtro de categoria de eventos
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  // Controle de falha ao carregar logo
  const [logoImgError, setLogoImgError] = useState<boolean>(false);

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

    // Página 2: Editorial (Mensagem Pastoral, se existir)
    if (data?.mensagem_pastoral) {
      lista.push({
        id: 'editorial',
        tipo: 'editorial',
        titulo: 'Palavra Pastoral',
        numeroPagina: num++,
      });
    }

    // Páginas 3 a 14: Cada mês do ano
    for (let m = 0; m < 12; m++) {
      lista.push({
        id: `mes-${m}`,
        tipo: 'mes',
        titulo: MESES_NOMES[m],
        mesIndex: m,
        numeroPagina: num++,
      });
    }

    return lista;
  }, [data?.mensagem_pastoral]);

  const totalPaginas = paginas.length;

  // Função para mudar de página com efeito 3D
  const irParaPagina = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalPaginas || index === paginaAtual || isVirando) return;

      const direcao = index > paginaAtual ? 'next' : 'prev';
      setAnimandoDirecao(direcao);
      setIsVirando(true);

      // Metade da transição troca o índice ativo
      setTimeout(() => {
        setPaginaAtual(index);
      }, 250);

      // Conclui animação
      setTimeout(() => {
        setIsVirando(false);
        setAnimandoDirecao(null);
      }, 520);
    },
    [paginaAtual, totalPaginas, isVirando]
  );

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
  const paginaCorrente = paginas[paginaAtual] || paginas[0];

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-slate-800 flex flex-col selection:bg-teal-100 selection:text-teal-900">
      {/* ─── ESTILOS CSS DO EFEITO 3D DE FOLHEAR ───────────────────── */}
      <style jsx global>{`
        .book-perspective {
          perspective: 2000px;
        }
        .page-sheet {
          transform-origin: left center;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
          backface-visibility: hidden;
        }
        .page-flip-next-exit {
          transform: rotateY(-70deg) scale(0.96);
          opacity: 0.3;
        }
        .page-flip-prev-exit {
          transform: rotateY(70deg) scale(0.96);
          opacity: 0.3;
        }
        .page-flip-enter {
          transform: rotateY(0deg) scale(1);
          opacity: 1;
        }
        .page-spine {
          box-shadow: inset 24px 0 35px -15px rgba(0, 0, 0, 0.12),
                      inset -24px 0 35px -15px rgba(0, 0, 0, 0.05);
        }
      `}</style>

      {/* ─── BARRA SUPERIOR INSTITUCIONAL ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {instituicao.logo_url ? (
              <img
                src={instituicao.logo_url}
                alt={instituicao.nome}
                className="w-10 h-10 object-contain rounded-xl border border-slate-200/70 p-0.5 bg-white shadow-xs shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center font-black border border-teal-100 shrink-0">
                <Church className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate">
                {instituicao.nome}
              </h1>
              <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" /> Revista Digital {ano}
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
        className="bg-white/80 border-b border-slate-200/60 px-4 py-2 sticky top-[57px] z-30 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200"
      >
        <div className="max-w-6xl mx-auto flex items-center gap-1.5 min-w-max text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Índice:
          </span>
          {paginas.map((pg, idx) => {
            const isAtual = paginaAtual === idx;
            return (
              <button
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

      {/* ─── CORPO PRINCIPAL ──────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col">
        {modoVisualizacao === 'revista' ? (
          /* ══════════════════════════════════════════════════════════════
             MODO REVISTA: FOLHEAMENTO INTERATIVO COM TRANSIÇÃO 3D
             ══════════════════════════════════════════════════════════════ */
          <div className="flex-1 flex flex-col justify-between space-y-6">
            {/* CONTAINER PERSPECTIVA DO LIVRO / REVISTA */}
            <div className="book-perspective w-full flex-1 flex items-center justify-center min-h-[520px]">
              <div
                className={`page-sheet page-spine w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden relative ${
                  animandoDirecao === 'next'
                    ? 'page-flip-next-exit'
                    : animandoDirecao === 'prev'
                    ? 'page-flip-prev-exit'
                    : 'page-flip-enter'
                }`}
              >
                {/* ─── PÁGINA: CAPA ───────────────────────────────────── */}
                {paginaCorrente.tipo === 'capa' && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-slate-950 text-white p-6 sm:p-12 lg:p-14 min-h-[520px] flex flex-col justify-between">
                    <div className="absolute -right-24 -top-24 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -left-24 -bottom-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

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

                    {/* Rodapé da Capa */}
                    <div className="relative z-10 pt-8 mt-6 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-teal-200/80">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {instituicao.endereco && (
                          <span className="flex items-center gap-1.5">
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

                      <button
                        onClick={avancarPagina}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg self-start sm:self-auto cursor-pointer"
                      >
                        <span>Abrir Revista</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── PÁGINA: EDITORIAL PASTORAL ─────────────────────── */}
                {paginaCorrente.tipo === 'editorial' && mensagem_pastoral && (
                  <div className="p-6 sm:p-10 lg:p-12 min-h-[520px] flex flex-col justify-between space-y-6">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-teal-700 tracking-wider uppercase">
                              Página Editorial
                            </span>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                              {mensagem_pastoral.titulo}
                            </h3>
                          </div>
                        </div>

                        <span className="text-xs font-mono font-bold text-slate-400">p.{paginaCorrente.numeroPagina}</span>
                      </div>

                      <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-sm sm:text-base space-y-4 whitespace-pre-line max-h-[360px] overflow-y-auto pr-2">
                        {mensagem_pastoral.conteudo_texto}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {mensagem_pastoral.video_url ? (
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

                      <span className="text-xs text-slate-400 italic">Gestão Eklésia • Palavra Institucional</span>
                    </div>
                  </div>
                )}

                {/* ─── PÁGINA: MÊS DO CALENDÁRIO ──────────────────────── */}
                {paginaCorrente.tipo === 'mes' && paginaCorrente.mesIndex !== undefined && (
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
                              {eventosPorMes[paginaCorrente.mesIndex]?.length || 0} eventos
                            </span>
                          </div>
                          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                            {MESES_NOMES[paginaCorrente.mesIndex]}
                          </h3>
                        </div>

                        {/* Filtro rápido dentro da página */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { id: 'todos', label: 'Todos' },
                            { id: 'oficial', label: 'Oficiais' },
                            { id: 'culto', label: 'Cultos' },
                            { id: 'evento', label: 'Eventos' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setFiltroCategoria(f.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
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
                        const listaMes = eventosPorMes[paginaCorrente.mesIndex] || [];
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
                      <span className="font-mono font-bold">p.{paginaCorrente.numeroPagina}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── CONTROLES DE FOLHEAR PÁGINAS (ANTERIOR / PRÓXIMA / INDICADOR) ─── */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-center justify-between gap-4 max-w-4xl w-full mx-auto">
              <button
                onClick={retrocederPagina}
                disabled={paginaAtual === 0 || isVirando}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs text-slate-700 transition flex items-center gap-2 active:scale-95 shadow-xs"
              >
                <ChevronLeft className="w-4 h-4 text-teal-700" />
                <span className="hidden sm:inline">Página Anterior</span>
                <span className="sm:hidden">Anterior</span>
              </button>

              {/* Indicador de Páginas e Título da Página Corrente */}
              <div className="text-center min-w-0">
                <span className="text-xs font-black text-slate-900 block truncate">
                  {paginaCorrente.titulo}
                </span>
                <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium mt-0.5">
                  <span>Página</span>
                  <span className="font-bold text-teal-800">{paginaAtual + 1}</span>
                  <span>de</span>
                  <span>{totalPaginas}</span>
                </div>
              </div>

              <button
                onClick={avancarPagina}
                disabled={paginaAtual === totalPaginas - 1 || isVirando}
                className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs transition flex items-center gap-2 active:scale-95 shadow-xs"
              >
                <span className="hidden sm:inline">Próxima Página</span>
                <span className="sm:hidden">Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════
             MODO LEITURA VERTICAL: OTIMIZADO PARA SMARTPHONES E FLUXO CONTÍNUO
             ══════════════════════════════════════════════════════════════ */
          <div className="space-y-8">
            {/* CAPA INSTITUCIONAL COMPACTA */}
            <section
              id="capa"
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-800 to-slate-950 text-white shadow-xl p-6 sm:p-10"
            >
              <div className="space-y-4">
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
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-slate-900">{ev.titulo}</h4>
                              {ev.descricao && <p className="text-xs text-slate-600 mt-0.5">{ev.descricao}</p>}
                              <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-500 mt-1">
                                {horario && <span>{horario}</span>}
                                {ev.local && <span>{ev.local}</span>}
                              </div>
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

        {/* ─── RODAPÉ INSTITUCIONAL ─────────────────────────────────── */}
        <footer className="text-center pt-8 mt-8 border-t border-slate-200/80 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">
            {instituicao.nome} • Edição Oficial {ano}
          </p>
          <p className="text-[11px] text-slate-400">
            Revista Digital Pública • Plataforma Gestão Eklésia
          </p>
        </footer>
      </main>
    </div>
  );
}
