import { NextRequest } from 'next/server';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const ipRequestMap = new Map<string, RateLimitStore>();

// Limpar registros antigos da memória a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestMap.entries()) {
    if (now > record.resetAt) {
      ipRequestMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export function getClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  return '127.0.0.1';
}

/**
 * Rate Limiter simples em memória por IP ou por Chave customizada.
 * @param reqOrKey NextRequest ou string key
 * @param limit Número máximo de requisições por janela
 * @param windowMs Duração da janela em milissegundos
 * @returns objeto com allowed, remaining, resetAt e retryAfterSeconds
 */
export function checkRateLimit(
  reqOrKey: NextRequest | string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetAt: number; retryAfterSeconds: number } {
  const key = typeof reqOrKey === 'string' ? reqOrKey : getClientIp(reqOrKey);
  const now = Date.now();
  const record = ipRequestMap.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    ipRequestMap.set(key, {
      count: 1,
      resetAt,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (record.count >= limit) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : 1,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: limit - record.count,
    resetAt: record.resetAt,
    retryAfterSeconds: 0,
  };
}
