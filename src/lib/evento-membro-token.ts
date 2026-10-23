import crypto from 'crypto';

function getHmacSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'gestaoeklesia_evento_membro_secret_key';
}

/**
 * Assina um token temporário HMAC para confirmação de preenchimento de membro no evento
 * Validade padrão: 15 minutos (900.000 ms)
 */
export function signMemberPrefillToken(payload: {
  memberId: string;
  eventoId: string;
  ministryId: string;
  expiraEmMs?: number;
}): string {
  const secret = getHmacSecret();
  const expiraEmMs = payload.expiraEmMs ?? (Date.now() + 15 * 60 * 1000);
  const data = `${payload.memberId}:${payload.eventoId}:${payload.ministryId}:${expiraEmMs}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('hex').slice(0, 32);
  return Buffer.from(JSON.stringify({ ...payload, expiraEmMs, sig })).toString('base64url');
}

/**
 * Valida a integridade e expiração do token de preenchimento
 */
export function verifyMemberPrefillToken(token: string): {
  valido: boolean;
  memberId?: string;
  eventoId?: string;
  ministryId?: string;
  motivo?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valido: false, motivo: 'Token ausente.' };
  }

  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    const { memberId, eventoId, ministryId, expiraEmMs, sig } = parsed;

    if (!memberId || !eventoId || !ministryId || !expiraEmMs || !sig) {
      return { valido: false, motivo: 'Estrutura do token inválida.' };
    }

    if (Date.now() > Number(expiraEmMs)) {
      return { valido: false, motivo: 'Token expirado. Realize a confirmação novamente.' };
    }

    const secret = getHmacSecret();
    const data = `${memberId}:${eventoId}:${ministryId}:${expiraEmMs}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('hex').slice(0, 32);

    const sigBuf = Buffer.from(sig);
    const expectedSigBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
      return { valido: false, motivo: 'Assinatura inválida.' };
    }

    return {
      valido: true,
      memberId,
      eventoId,
      ministryId,
    };
  } catch {
    return { valido: false, motivo: 'Falha ao decodificar token.' };
  }
}
