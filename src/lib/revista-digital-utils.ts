export const MESES_NOMES = [
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
] as const;

export const DEFAULT_INSTITUTIONAL_TIMEZONE = 'America/Belem';

export type TipoPaginaRevista = 'capa' | 'editorial' | 'institucional' | 'mes';

export interface PalavraPastorEdicao {
  ano: number;
  titulo: string;
  conteudo_html: string;
  foto_url: string | null;
  nome_pastor: string;
  nome_esposa: string;
  assinatura: string;
  publicada: boolean;
  updated_at?: string;
}

export interface DepartamentoLiderancaItem {
  cargo: string;
  nome: string;
}

export interface DepartamentoRevistaPublico {
  id: string;
  sigla: string;
  nome: string;
  logo_url: string | null;
  lideranca: DepartamentoLiderancaItem[];
}

export interface DepartamentosEdicaoConfig {
  publicada: boolean;
  titulo: string;
  subtitulo: string;
  departamento_ids: string[];
}

export interface PaginaRevistaBase {
  id: string;
  tipo: TipoPaginaRevista;
  titulo: string;
  numeroPagina: number;
  mesIndex?: number;
  departamentosChunk?: DepartamentoRevistaPublico[];
}

/**
 * Pagina os departamentos selecionados para a Revista Digital (até 4 por página).
 * Não gera páginas vazias quando a lista está vazia.
 */
export function paginateDepartmentsForRevista(
  departamentos: DepartamentoRevistaPublico[],
  maxPerPage: number = 4
): DepartamentoRevistaPublico[][] {
  if (!Array.isArray(departamentos) || departamentos.length === 0) {
    return [];
  }
  const safeMax = Math.max(1, maxPerPage);
  const pages: DepartamentoRevistaPublico[][] = [];
  for (let i = 0; i < departamentos.length; i += safeMax) {
    pages.push(departamentos.slice(i, i + safeMax));
  }
  return pages;
}

/**
 * Retorna o ano e o mês (0 a 11) vigentes no fuso horário institucional.
 */
export function getInstitutionalYearMonth(
  now: Date = new Date(),
  timeZone: string = DEFAULT_INSTITUTIONAL_TIMEZONE
): { year: number; month0: number } {
  try {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(now);

    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month1Based = Number(parts.find((p) => p.type === 'month')?.value);

    if (!isNaN(year) && !isNaN(month1Based) && month1Based >= 1 && month1Based <= 12) {
      return { year, month0: month1Based - 1 };
    }
  } catch {
    // Fallback seguro caso o ambiente não suporte o timezone informado
  }

  return {
    year: now.getFullYear(),
    month0: now.getMonth(),
  };
}

/**
 * Retorna os índices de meses (0 a 11) visíveis na Revista Digital pública
 * para o ano da edição, ocultando meses já encerrados.
 *
 * - Edição de ano passado: [] (mantém apenas a Capa Oficial)
 * - Edição do ano vigente: [mêsVigente .. 11]
 * - Edição de ano futuro: [0 .. 11]
 */
export function getVisibleMonthsForEdition(
  editionYear: number,
  now: Date = new Date(),
  timeZone: string = DEFAULT_INSTITUTIONAL_TIMEZONE
): number[] {
  const { year: currentYear, month0: currentMonth0 } = getInstitutionalYearMonth(now, timeZone);

  if (editionYear < currentYear) {
    return [];
  }

  const startMonth = editionYear === currentYear ? currentMonth0 : 0;
  const visible: number[] = [];
  for (let m = startMonth; m < 12; m++) {
    visible.push(m);
  }
  return visible;
}

/**
 * Filtra eventos públicos para a Revista Digital, mantendo apenas eventos
 * pertencentes aos meses visíveis da edição.
 */
export function filterPublicEventsForEdition<T extends { data_inicio: string }>(
  events: T[],
  editionYear: number,
  now: Date = new Date(),
  timeZone: string = DEFAULT_INSTITUTIONAL_TIMEZONE
): T[] {
  const visibleMonths = new Set(getVisibleMonthsForEdition(editionYear, now, timeZone));
  if (visibleMonths.size === 0) {
    return [];
  }

  return events.filter((ev) => {
    const d = new Date(ev.data_inicio);
    if (isNaN(d.getTime())) return false;
    const { year, month0 } = getInstitutionalYearMonth(d, timeZone);
    return year === editionYear && visibleMonths.has(month0);
  });
}

/**
 * Resolve o índice da página destino a partir de um parâmetro de mês (?mes=...).
 * Se o mês solicitado já estiver encerrado (ausente em `paginas`), direciona
 * para o mês vigente da edição, quando disponível, ou para a Capa (0).
 */
export function resolveTargetPageIndex(
  paginas: PaginaRevistaBase[],
  requestedMesParam: string | null,
  editionYear: number,
  now: Date = new Date(),
  timeZone: string = DEFAULT_INSTITUTIONAL_TIMEZONE
): number {
  const { year: currentYear, month0: currentMonth0 } = getInstitutionalYearMonth(now, timeZone);

  const getCurrentMonthPageIndex = (): number => {
    if (editionYear === currentYear) {
      const idx = paginas.findIndex((pg) => pg.tipo === 'mes' && pg.mesIndex === currentMonth0);
      if (idx !== -1) return idx;
    }
    const firstMonthIdx = paginas.findIndex((pg) => pg.tipo === 'mes');
    if (firstMonthIdx !== -1) return firstMonthIdx;
    return 0;
  };

  if (!requestedMesParam || !requestedMesParam.trim()) {
    return 0;
  }

  const raw = requestedMesParam.trim().toLowerCase();
  let targetMonth0: number | null = null;

  const num = Number(raw);
  if (!isNaN(num) && Number.isInteger(num) && num >= 1 && num <= 12) {
    targetMonth0 = num - 1;
  } else {
    const normalized = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const foundIdx = MESES_NOMES.findIndex(
      (nome) => nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') === normalized
    );
    if (foundIdx !== -1) {
      targetMonth0 = foundIdx;
    }
  }

  if (targetMonth0 !== null) {
    const pageIdx = paginas.findIndex((pg) => pg.tipo === 'mes' && pg.mesIndex === targetMonth0);
    if (pageIdx !== -1) {
      return pageIdx;
    }
    // Mês solicitado está encerrado ou indisponível: direciona para o mês vigente
    return getCurrentMonthPageIndex();
  }

  return 0;
}
