/**
 * timezone-utils.ts
 * Utilitários para normalização e cálculo de datas e fusos horários locais no Gestão Eklésia.
 * Padrão Institucional: America/Belem (UTC−3, sem horário de verão).
 */

export const INSTITUTIONAL_TIMEZONE = 'America/Belem';

/**
 * Converte qualquer Date ou string de data (ISO UTC ou string local) para 'YYYY-MM-DD' no fuso institucional (America/Belem).
 * Garante dia civil exato mesmo quando o evento cruza a meia-noite em UTC.
 */
export function getLocalDateStr(val: string | Date = new Date()): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return typeof val === 'string' ? val.split('T')[0] : '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: INSTITUTIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Converte qualquer timestamp (ISO UTC ou Date) para o horário local 'HH:mm' no fuso institucional (America/Belem).
 */
export function formatHoraLocal(val: string | Date | null | undefined): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: INSTITUTIONAL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Converte componentes de data e hora (ano, mes [0..11], dia, hora, minuto, segundo)
 * assumindo estritamente o fuso de Belém (UTC-3), e retorna a string ISO 8601 UTC correspondente.
 */
export function buildUtcIsoFromLocal(
  year: number,
  monthZeroBased: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number = 0
): string {
  const y = String(year);
  const m = String(monthZeroBased + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const h = String(hours).padStart(2, '0');
  const min = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');
  const dt = new Date(`${y}-${m}-${d}T${h}:${min}:${s}-03:00`);
  return isNaN(dt.getTime()) ? '' : dt.toISOString();
}

/**
 * Converte um timestamp do banco (ISO UTC) para o valor de input datetime-local 'YYYY-MM-DDTHH:mm'
 * no fuso institucional (America/Belem), evitando que o formulário abra com +3h de deslocamento.
 */
export function isoToDateTimeLocalInput(val: string | Date | null | undefined): string {
  if (!val) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';

  const dateStr = getLocalDateStr(d);
  const timeStr = formatHoraLocal(d);
  return `${dateStr}T${timeStr}`;
}

/**
 * Converte uma entrada de datetime-local ('YYYY-MM-DDTHH:mm') preenchida pelo usuário
 * interpretando-a estritamente no fuso institucional (America/Belem, UTC−3) e produzindo
 * o timestamp ISO 8601 UTC exato para gravação no banco de dados.
 */
export function localInputToUtcIso(val: string | null | undefined): string {
  if (!val) return '';
  const str = val.trim();
  // Se já possui indicador de fuso, delega para Date.toISOString()
  if (str.includes('Z') || str.includes('+')) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  const [datePart, timePart] = str.split('T');
  if (!timePart) {
    const d = new Date(`${datePart}T00:00:00-03:00`);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  const cleanTime = timePart.length === 5 ? `${timePart}:00` : timePart;
  const d = new Date(`${datePart}T${cleanTime}-03:00`);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * Avalia se um culto está atualmente na janela válida para acolhimento de visitantes.
 * Regras estritas:
 * 1. O culto não pode estar 'Encerrado' ou 'Consolidado'.
 * 2. A data do culto ('YYYY-MM-DD') deve coincidir com a data de hoje no fuso local.
 * 3. Se a data do culto for futura (> hoje), o link não aceita acolhimentos antecipados (fica como 'Programado').
 * 4. Se a data do culto for passada (< hoje), a janela de acolhimento do dia já foi expirada.
 */
export function isCultoAbertoHoje(
  dataCulto: string | null | undefined,
  status: string | null | undefined,
  dataReferencia: Date = new Date()
): { elegivel: boolean; motivo?: 'CULTO_FUTURO' | 'CULTO_PASSADO' | 'CULTO_ENCERRADO' } {
  const statusNorm = (status || '').trim().toLowerCase();
  if (statusNorm !== 'aberto') {
    return { elegivel: false, motivo: 'CULTO_ENCERRADO' };
  }

  if (!dataCulto || typeof dataCulto !== 'string') {
    return { elegivel: false, motivo: 'CULTO_PASSADO' };
  }

  const hojeLocal = getLocalDateStr(dataReferencia);
  const dataCultoLocal = dataCulto.slice(0, 10);

  if (dataCultoLocal > hojeLocal) {
    return { elegivel: false, motivo: 'CULTO_FUTURO' };
  }

  if (dataCultoLocal < hojeLocal) {
    return { elegivel: false, motivo: 'CULTO_PASSADO' };
  }

  return { elegivel: true };
}
