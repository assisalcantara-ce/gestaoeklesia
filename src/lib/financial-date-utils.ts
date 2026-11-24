/**
 * financial-date-utils.ts
 * Utilitário canônico centralizado para interpretação, normalização,
 * conversão e filtragem de datas no ecossistema financeiro do Gestão Eklésia.
 *
 * Padrão Institucional: America/Belem (UTC−3, sem horário de verão).
 *
 * Distinções Semânticas Fundamentais:
 * 1. Data Civil Contábil ('YYYY-MM-DD'): dia civil em que o evento financeiro ocorreu (competência/caixa).
 * 2. Timestamp Real (ISO UTC): momento cronológico exato em que o webhook ou registro ocorreu.
 * 3. Timestamp de Data Civil ASAAS: string ISO terminada em 'T00:00:00Z' que representa apenas a data civil (ex: paymentDate),
 *    e NÃO deve sofrer deslocamento de fuso UTC-3 (o que recuaria um dia).
 */

export const FINANCIAL_TIMEZONE = 'America/Belem';

export interface FinancialDateOptions {
  /**
   * Indica a origem semântica do campo (ex: 'asaas_payment_date', 'database_paid_at', 'webhook_created_at', 'generic_timestamp').
   * Quando 'asaas_payment_date' ou 'database_paid_at', garante preservação estrita da data civil do ASAAS.
   */
  sourceField?: 'asaas_payment_date' | 'database_paid_at' | 'database_created_at' | 'generic_timestamp';
  gateway?: string;
}

/**
 * Avalia se uma string ou campo representa semanticamente uma data civil (ex: ASAAS paymentDate).
 * Considera:
 * 1. Campo semântico informado explicitly nas opções ('asaas_payment_date' ou gateway 'asaas' em paid_at).
 * 2. Formato de data pura ('YYYY-MM-DD').
 * 3. String ISO terminada exatamente em meia-noite UTC ('T00:00:00Z' ou '+00:00') típica de gateways bancários que não gravam horário.
 */
export function isAsaasCivilDateTimestamp(
  dateStr: string | null | undefined,
  options?: FinancialDateOptions
): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const s = dateStr.trim();
  if (options?.sourceField === 'asaas_payment_date') return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  return /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?(?:\+00:00|Z)$/.test(s);
}

/**
 * Extrai com segurança a data civil 'YYYY-MM-DD' de qualquer representação de data financeira.
 * Regras Canônicas:
 * 1. Se já for 'YYYY-MM-DD', retorna diretamente.
 * 2. Se a origem semântica for data civil (ASAAS paymentDate / paid_at à meia-noite UTC),
 *    extrai a data civil sem deslocamento indevido de dia.
 * 3. Se for um timestamp real com horário (ex: created_at, webhook timestamp),
 *    converte com precisão para o fuso institucional America/Belem (UTC-3).
 */
export function getFinancialCivilDateStr(
  val: string | Date | null | undefined,
  options?: FinancialDateOptions
): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (isAsaasCivilDateTimestamp(s, options)) return s.slice(0, 10);
    const d = new Date(s);
    if (isNaN(d.getTime())) return s.split('T')[0] || '';
    return formatToInstitutionalDateStr(d);
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return formatToInstitutionalDateStr(val);
  }
  return '';
}

/**
 * Formata um objeto Date válido para 'YYYY-MM-DD' estritamente no fuso America/Belem.
 */
function formatToInstitutionalDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FINANCIAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Formatação para exibição no frontend e impressão: 'dd/MM/yyyy HH:mm'
 * Respeita datas civis puras (exibindo apenas a data sem forçar hora 21:00 do dia anterior).
 */
export function formatFinancialDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  if (isAsaasCivilDateTimestamp(str)) {
    const [y, m, d] = str.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: FINANCIAL_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return formatted.replace(', ', ' ');
  } catch {
    return str;
  }
}

/**
 * Constrói limites ISO fechados para consultas no PostgreSQL/Supabase baseados em datas civis 'YYYY-MM-DD'.
 * Utiliza o fuso institucional UTC-3.
 *
 * Exemplo:
 * buildPeriodFilterBounds('2026-11-01', '2026-11-23')
 * -> { startIso: '2026-11-01T00:00:00.000-03:00', endIso: '2026-11-23T23:59:59.999-03:00' }
 */
export function buildPeriodFilterBounds(
  dataInicio?: string | null,
  dataFim?: string | null,
  mesRef?: string | null
): { startIso?: string; endIso?: string } {
  if (dataInicio && dataFim) {
    return {
      startIso: `${dataInicio.trim()}T00:00:00.000-03:00`,
      endIso: `${dataFim.trim()}T23:59:59.999-03:00`,
    };
  }
  if (dataInicio) {
    return {
      startIso: `${dataInicio.trim()}T00:00:00.000-03:00`,
    };
  }
  if (dataFim) {
    return {
      endIso: `${dataFim.trim()}T23:59:59.999-03:00`,
    };
  }
  if (mesRef && /^\d{4}-\d{2}$/.test(mesRef.trim())) {
    const [anoStr, mesStr] = mesRef.trim().split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const ultimoDiaStr = String(ultimoDia).padStart(2, '0');

    const startIso = `${anoStr}-${mesStr}-01T00:00:00.000-03:00`;
    const endIso = `${anoStr}-${mesStr}-${ultimoDiaStr}T23:59:59.999-03:00`;

    return { startIso, endIso };
  }
  return {};
}

/**
 * Filtro em memória canônico para avaliar se uma cobrança/lançamento pertence ao período filtrado.
 */
export function isDateInCivilPeriod(
  dateValue: string | Date | null | undefined,
  dataInicio?: string | null,
  dataFim?: string | null
): boolean {
  if (!dataInicio && !dataFim) return true;
  const civilDate = getFinancialCivilDateStr(dateValue);
  if (!civilDate) return false;

  if (dataInicio && civilDate < dataInicio) return false;
  if (dataFim && civilDate > dataFim) return false;
  return true;
}
