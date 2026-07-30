import { NextRequest } from 'next/server';

/**
 * Resolve a URL base pública oficial da aplicação com prioridade estrita.
 * NUNCA utiliza request.nextUrl.origin para evitar que a porta de escuta interna
 * do servidor Node.js (http://localhost:3000) seja vazada em produção.
 */
export function getAppBaseUrl(request?: NextRequest): string {
  // 1º: NEXT_PUBLIC_APP_URL (Ex: https://app.gestaoeklesia.com.br)
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, '');
  }

  // 2º: APP_URL
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }

  // 3º: VERCEL_PROJECT_PRODUCTION_URL (Adiciona https:// se necessário)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL.trim() !== '') {
    const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/\/+$/, '');
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  }

  // 4º: Header x-forwarded-host com protocolo x-forwarded-proto
  if (request) {
    const forwardedHost = request.headers.get('x-forwarded-host');
    if (forwardedHost) {
      const proto = request.headers.get('x-forwarded-proto') || 'https';
      return `${proto}://${forwardedHost.split(',')[0].trim()}`.replace(/\/+$/, '');
    }

    // 5º: Header host tradicional da requisição HTTP (quando não for localhost)
    const host = request.headers.get('host');
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const proto = request.headers.get('x-forwarded-proto') || 'https';
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  // 6º: Somente em desenvolvimento local (fallback final)
  return 'http://localhost:3000';
}
