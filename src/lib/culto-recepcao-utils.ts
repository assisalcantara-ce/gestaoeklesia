import crypto from 'crypto';

/**
 * Utilitários de Segurança e Gestão da Central de Recepção dos Cultos
 * Gestão Eklésia
 */

/**
 * Gera um token criptograficamente seguro com 256 bits de entropia (hexadecimal de 32 bytes).
 * Prefixo crp_ para identificação unívoca nos logs e URLs.
 */
export function generateCultoRecepcaoToken(): string {
  const bytes = crypto.randomBytes(32).toString('hex');
  return `crp_${bytes}`;
}

/**
 * Calcula o hash SHA-256 do token para armazenamento seguro no banco de dados.
 * O token bruto NUNCA deve ser persistido em texto claro na tabela de tokens.
 */
export function hashCultoRecepcaoToken(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new Error('Token inválido para hashing.');
  }
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Calcula a data e hora de expiração estrita: 23h59:59 do dia do culto
 * no fuso horário oficial de Brasília (UTC-3).
 * 
 * @param dataCulto Data no formato 'YYYY-MM-DD' ou ISO string
 */
export function calculateCultoExpiration(
  dataCulto: string,
  options?: { allowCurrentDayIfPast?: boolean; now?: Date }
): string {
  if (!dataCulto || typeof dataCulto !== 'string') {
    throw new Error('Data do culto inválida.');
  }
  const cleanDate = dataCulto.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    throw new Error(`Formato de data inválido para o culto: ${dataCulto}`);
  }

  // Fuso horário de Brasília (UTC-3)
  const isoLocal = `${cleanDate}T23:59:59-03:00`;
  const serviceDayEnd = new Date(isoLocal);
  if (isNaN(serviceDayEnd.getTime())) {
    throw new Error(`Data inválida após conversão: ${cleanDate}`);
  }

  if (options?.allowCurrentDayIfPast) {
    const now = options.now || new Date();
    // Obter data atual no fuso de Brasília (UTC-3)
    const nowBrasiliaStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
    const todayEnd = new Date(`${nowBrasiliaStr}T23:59:59-03:00`);
    if (serviceDayEnd.getTime() < now.getTime()) {
      return todayEnd.toISOString();
    }
  }

  return serviceDayEnd.toISOString();
}

/**
 * Verifica se um token está válido, expirado ou revogado.
 */
export function verifyRecepcaoTokenStatus(params: {
  expira_em: string | Date;
  revogado_em?: string | Date | null;
  status_culto?: string | null;
  now?: Date;
}): {
  valido: boolean;
  motivo?: 'TOKEN_REVOGADO' | 'TOKEN_EXPIRADO' | 'CULTO_CANCELADO';
  mensagem?: string;
} {
  const now = params.now || new Date();

  if (params.revogado_em) {
    return {
      valido: false,
      motivo: 'TOKEN_REVOGADO',
      mensagem: 'Este link da Central de Recepção foi revogado pela administração.',
    };
  }

  if (params.status_culto && params.status_culto.trim().toLowerCase() === 'cancelado') {
    return {
      valido: false,
      motivo: 'CULTO_CANCELADO',
      mensagem: 'Este culto foi cancelado.',
    };
  }

  const expDate = new Date(params.expira_em);
  if (isNaN(expDate.getTime()) || expDate.getTime() <= now.getTime()) {
    return {
      valido: false,
      motivo: 'TOKEN_EXPIRADO',
      mensagem: 'Este link da Central de Recepção expirou às 23h59 do dia do culto.',
    };
  }

  return { valido: true };
}
