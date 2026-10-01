import crypto from 'crypto';

/**
 * Utilitários de Segurança e Manipulação de Tokens de Check-in para o Módulo de Eventos
 */

function getSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'gestaoeklesia_secure_checkin_token_key';
}

/**
 * Gera um token assinado criptograficamente contendo o ID do evento e a data de expiração
 */
export function gerarTokenCheckinEvento(eventoId: string, expiraEmMs: number): string {
  const secret = getSecret();
  const cleanId = eventoId.replace(/-/g, '').toLowerCase();
  const expHex = Math.floor(expiraEmMs / 1000).toString(16);
  const payload = `${cleanId}.${expHex}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 32);
  return `chk_${payload}.${sig}`;
}

/**
 * Valida a assinatura do token e extrai o ID do evento e timestamp de expiração
 */
export function decodificarEValidarTokenCheckin(token: string): {
  valido: boolean;
  eventoId?: string;
  expiraEm?: Date;
  motivo?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valido: false, motivo: 'Token não fornecido.' };
  }

  const clean = token.trim().replace(/^chk_/, '');
  const parts = clean.split('.');
  if (parts.length !== 3) {
    return { valido: false, motivo: 'Formato de token inválido.' };
  }

  const [cleanId, expHex, sig] = parts;
  if (!cleanId || !expHex || !sig || sig.length !== 32) {
    return { valido: false, motivo: 'Estrutura de token inválida.' };
  }

  const secret = getSecret();
  const payload = `${cleanId}.${expHex}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 32);

  try {
    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedSigBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
      return { valido: false, motivo: 'Assinatura do link de check-in inválida.' };
    }
  } catch {
    return { valido: false, motivo: 'Erro na validação da assinatura.' };
  }

  const expSeconds = parseInt(expHex, 16);
  if (isNaN(expSeconds)) {
    return { valido: false, motivo: 'Timestamp de expiração inválido.' };
  }

  const expiraDate = new Date(expSeconds * 1000);
  if (Date.now() > expiraDate.getTime()) {
    return { valido: false, motivo: 'Este link de check-in expirou.' };
  }

  // Reconstroi o UUID formatado (8-4-4-4-12)
  let formattedUuid = cleanId;
  if (cleanId.length === 32) {
    formattedUuid = `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20)}`;
  }

  return { valido: true, eventoId: formattedUuid, expiraEm: expiraDate };
}

/**
 * Gera o hash SHA-256 de um token para persistência segura no banco de dados (se tabela existir)
 */
export function hashTokenCheckinEvento(token: string): string {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Extrai o identificador ou código de inscrição a partir do input lido (QR Code ou texto manual)
 * Suporta:
 * 1. UUID completo (ex: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
 * 2. Código curto com ou sem hashtag (ex: '#A1B2C3D4', 'A1B2C3D4')
 * 3. JSON contendo inscricao_id, id ou codigo (ex: '{"id":"..."}')
 * 4. URL com query param ou path (ex: 'https://.../eventos/check-in?id=...')
 * 5. String formatada 'eklesia:inscricao:...' ou 'eklesia:checkin:...'
 */
export function extrairCodigoInscricao(rawInput: string): string {
  if (!rawInput || typeof rawInput !== 'string') return '';
  let trimmed = rawInput.trim();

  // 1. Remover aspas extras
  trimmed = trimmed.replace(/^["']|["']$/g, '').trim();

  // 2. Se for JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const possibleId = parsed.id || parsed.inscricao_id || parsed.inscricaoId || parsed.codigo;
      if (possibleId && typeof possibleId === 'string') {
        return extrairCodigoInscricao(possibleId);
      }
    } catch {
      // continua para os outros métodos se JSON falhar
    }
  }

  // 3. Se for URL
  if (trimmed.includes('://') || trimmed.startsWith('/') || trimmed.includes('?')) {
    try {
      const urlObj = new URL(trimmed.startsWith('/') ? `http://localhost${trimmed}` : trimmed);
      const queryId = urlObj.searchParams.get('id') || urlObj.searchParams.get('inscricao_id') || urlObj.searchParams.get('codigo');
      if (queryId) return queryId.trim();

      // Último segmento do path se não for 'check-in'
      const segments = urlObj.pathname.split('/').filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      if (lastSeg && lastSeg !== 'check-in' && lastSeg !== 'eventos') {
        return lastSeg.trim();
      }
    } catch {
      // continua
    }
  }

  // 4. Formato prefixado eklesia:inscricao:...
  const prefixMatch = trimmed.match(/^eklesia:(?:inscricao|checkin):(.+)$/i);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].trim();
  }

  // 5. Remover hashtag inicial se houver
  if (trimmed.startsWith('#')) {
    trimmed = trimmed.substring(1).trim();
  }

  return trimmed;
}

/**
 * Valida se um evento está ativo e elegível para check-in
 */
export function isEventoElegivelCheckin(evento: {
  status: string;
  data_inicio: string;
  data_fim?: string | null;
}): { elegivel: boolean; motivo?: string } {
  if (evento.status === 'cancelado') {
    return { elegivel: false, motivo: 'Este evento foi cancelado.' };
  }

  if (evento.status === 'realizado') {
    // Se o evento foi marcado como realizado, permite check-in somente até 24h após a data_fim ou data_inicio
    const dataRef = evento.data_fim ? new Date(evento.data_fim) : new Date(evento.data_inicio);
    const limite = new Date(dataRef.getTime() + 24 * 60 * 60 * 1000);
    if (new Date() > limite) {
      return { elegivel: false, motivo: 'Este evento já foi finalizado e o período de check-in expirou.' };
    }
  }

  return { elegivel: true };
}
