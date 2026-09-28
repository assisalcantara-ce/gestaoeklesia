import crypto from 'crypto';

/**
 * Utilitários para o Módulo de Reuniões Ministeriais
 *
 * Cálculo determinístico de fuso horário brasileiro (UTC-3)
 * e formatação de timestamps absolutos para corte de check-in.
 */

/**
 * Converte data (AAAA-MM-DD) e horário (HH:MM ou HH:MM:SS) em TIMESTAMPTZ ISO String
 * no fuso horário de Brasília (UTC-3).
 *
 * Ex: '2026-05-10', '09:00' -> '2026-05-10T09:00:00-03:00'
 */
export function calcularLimiteCheckinTimestamp(dataStr: string, horarioStr: string): string {
  const cleanData = dataStr.trim();
  let cleanHora = horarioStr.trim();

  // Adicionar segundos se não fornecidos
  if (/^\d{2}:\d{2}$/.test(cleanHora)) {
    cleanHora = `${cleanHora}:00`;
  }

  // Montar string no padrão ISO com offset -03:00 (Brasília)
  const isoLocal = `${cleanData}T${cleanHora}-03:00`;
  const dateObj = new Date(isoLocal);

  if (isNaN(dateObj.getTime())) {
    throw new Error(`Data ou horário inválido para cálculo de limite: ${dataStr} ${horarioStr}`);
  }

  return dateObj.toISOString();
}

/**
 * Valida se horário de limite é igual ou posterior ao horário de início
 */
export function validarHorariosReuniao(horarioInicio: string, horarioLimite: string): boolean {
  const normInicio = horarioInicio.trim().slice(0, 5);
  const normLimite = horarioLimite.trim().slice(0, 5);
  return normLimite >= normInicio;
}

/**
 * Extrai o identificador (unique_id ou id) a partir de uma leitura de QR Code.
 * Suporta:
 * 1. URL canônica completa (ex: 'https://.../validar/credencial/MIN-12345' ou '.../validar/credencial/uuid')
 * 2. unique_id puro (ex: 'MIN-12345', 'ALC-9988')
 * 3. UUID puro do membro
 */
export function extrairIdentificadorMinistroQrCode(rawQrInput: string): string {
  if (!rawQrInput || typeof rawQrInput !== 'string') return '';
  const trimmed = rawQrInput.trim();

  // Caso 1: URL com caminho /validar/credencial/
  const matchUrl = trimmed.match(/\/validar\/credencial\/([^/?#]+)/i);
  if (matchUrl && matchUrl[1]) {
    return decodeURIComponent(matchUrl[1]).trim();
  }

  // Caso 2: URL terminando com parâmetro
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) return decodeURIComponent(last).trim();
    } catch {
      // continua para fallback
    }
  }

  // Caso 3: String direta (unique_id ou id)
  return trimmed;
}

/**
 * Gera um token criptograficamente seguro e aleatório para acesso ao painel informativo.
 * Retorna string hexadecimal de 32 bytes (64 caracteres).
 */
export function gerarTokenPainel(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Gera o hash SHA-256 de um token para persistência e busca segura no banco de dados.
 */
export function hashTokenPainel(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export type StatusReuniaoEfetivo = 'agendada' | 'em_andamento' | 'encerrada' | 'cancelada';

/**
 * Calcula o status efetivo/operacional da reunião de forma consistente.
 * Regras:
 * 1. Se o status persistido for 'encerrada' ou 'cancelada', preserva o status persistido.
 * 2. Se a data/hora de início da reunião já chegou (ou passou) e a reunião não está encerrada,
 *    o status operacional é 'em_andamento'.
 * 3. Se a data/hora de início ainda é futura, o status é 'agendada'.
 * 4. Nenhuma reunião cuja data/hora já passou permanece como 'agendada'.
 */
export function calcularStatusEfetivoReuniao(reuniao: {
  data_reuniao?: string | null;
  horario_inicio?: string | null;
  status?: string | null;
}): StatusReuniaoEfetivo {
  if (reuniao.status === 'encerrada') return 'encerrada';
  if (reuniao.status === 'cancelada') return 'cancelada';

  if (!reuniao.data_reuniao) {
    return (reuniao.status as StatusReuniaoEfetivo) || 'agendada';
  }

  try {
    const horaInicio = (reuniao.horario_inicio || '00:00').trim().slice(0, 5);
    const isoInicio = `${reuniao.data_reuniao.trim()}T${horaInicio.length === 5 ? horaInicio + ':00' : '00:00:00'}-03:00`;
    const inicioDate = new Date(isoInicio);

    if (isNaN(inicioDate.getTime())) {
      return (reuniao.status as StatusReuniaoEfetivo) || 'agendada';
    }

    const agora = new Date();
    // Se a data/hora de início já chegou ou passou
    if (agora >= inicioDate) {
      return 'em_andamento';
    }

    return 'agendada';
  } catch {
    return (reuniao.status as StatusReuniaoEfetivo) || 'agendada';
  }
}

