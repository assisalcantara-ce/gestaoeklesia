import crypto from 'crypto';

export interface ImpersonationTokenPayload {
  type: 'impersonation';
  sessionId: string;
  originalAdminId: string;
  targetTenantId: string;
  readOnly: boolean;
  issuedAt: number; // Unix timestamp em segundos
  expiresAt: number; // Unix timestamp em segundos
}

function getJwtSecret(): string {
  return (
    process.env.IMPERSONATION_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'gestaoeklesia-impersonation-secret-key-2026-secure'
  );
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Assina um JWT exclusivo para Admin Impersonation com HMAC-SHA256.
 * Duração estrita de 30 minutos (1800s).
 */
export function signImpersonationToken(
  params: Omit<ImpersonationTokenPayload, 'type' | 'issuedAt' | 'expiresAt'> & {
    durationMinutes?: number;
  }
): { token: string; expiresAt: string; payload: ImpersonationTokenPayload } {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const durationInSeconds = (params.durationMinutes || 30) * 60; // Padrão 30 minutos
  const expiresAtSeconds = nowInSeconds + durationInSeconds;

  const payload: ImpersonationTokenPayload = {
    type: 'impersonation',
    sessionId: params.sessionId,
    originalAdminId: params.originalAdminId,
    targetTenantId: params.targetTenantId,
    readOnly: !!params.readOnly,
    issuedAt: nowInSeconds,
    expiresAt: expiresAtSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const secret = getJwtSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  const token = `${encodedHeader}.${encodedPayload}.${signature}`;
  const expiresAtIso = new Date(expiresAtSeconds * 1000).toISOString();

  return { token, expiresAt: expiresAtIso, payload };
}

/**
 * Valida a assinatura, formato e expiração de um JWT de Impersonação.
 */
export function verifyImpersonationToken(token: string): {
  valid: boolean;
  payload?: ImpersonationTokenPayload;
  error?: 'INVALID_FORMAT' | 'INVALID_SIGNATURE' | 'INVALID_TYPE' | 'EXPIRED' | string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const secret = getJwtSecret();

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }
  } catch {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  try {
    const payload: ImpersonationTokenPayload = JSON.parse(
      base64UrlDecode(encodedPayload)
    );

    if (payload.type !== 'impersonation') {
      return { valid: false, error: 'INVALID_TYPE' };
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (nowInSeconds > payload.expiresAt) {
      return { valid: false, payload, error: 'EXPIRED' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'INVALID_FORMAT' };
  }
}
