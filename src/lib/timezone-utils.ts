/**
 * timezone-utils.ts
 * Utilitários para normalização e cálculo de datas e fusos horários locais no Gestão Eklésia.
 * Padrão: Horário Local Oficial de Brasília (GMT-3).
 */

/**
 * Converte qualquer Date ou string de data (ISO UTC ou string local) para 'YYYY-MM-DD' no fuso local.
 * Preserva integridade de cultos e eventos sem deslocamento de dia por conversão UTC.
 */
export function getLocalDateStr(val: string | Date = new Date()): string {
  if (!val) return '';
  if (typeof val === 'string' && !val.includes('Z') && !val.includes('+') && !val.slice(11).includes('-')) {
    return val.slice(0, 10);
  }
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return typeof val === 'string' ? val.split('T')[0] : '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
