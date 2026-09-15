/**
 * Service Worker — Gestão Eklésia Mobile PWA
 *
 * Estratégia de Cache e Segurança:
 * - Cache estático SEGURO: Apenas assets imutáveis (JS, CSS, fontes, ícones, logos).
 * - Rede OBRIGATÓRIA (Network Only): Todas as requisições para /api/*, autenticação,
 *   dados financeiros, PIX, perfil e dados do membro NUNCA são cacheados em disco
 *   para proteger estritamente a privacidade e evitar vazamento multi-usuário no dispositivo.
 */

const CACHE_NAME = 'eklesia-static-v1';

// Assets públicos e estáticos seguros para pré-cacheamento do shell
const STATIC_PRECACHE = [
  '/',
  '/app/login',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/brand/logo-horizontal.png',
  '/brand/logo-icon.png',
  '/favicon.ico',
];

// Instalação: Cache dos assets estáticos públicos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] Falha ao pré-cachear alguns assets estáticos:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptação de Requisições (Fetch)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. REQUISIÇÕES DE API / AUTENTICAÇÃO / DADOS PRIVADOS -> SEMPRE NETWORK ONLY
  // Nunca armazena em cache dados dinâmicos, tokens, PIX, extrato ou inscrições
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    request.headers.has('Authorization') ||
    request.method !== 'GET'
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        // Fallback offline seguro para chamadas de API
        return new Response(
          JSON.stringify({
            error: 'Você está offline. Conecte-se à internet para continuar.',
            offline: true,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. ASSETS ESTÁTICOS IMUTÁVEIS (/_next/static/*, imagens, fontes) -> Cache First / Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Atualiza em background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            return new Response('Asset indisponível offline', { status: 503 });
          });
      })
    );
    return;
  }

  // 3. NAVEGAÇÃO DE PÁGINAS (/app/*) -> Network First com fallback para shell
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      // Fallback para o shell de login/início se offline
      const fallback = await caches.match('/app/login');
      if (fallback) return fallback;

      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Gestão Eklésia</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#fff;text-align:center;padding:20px}h1{font-size:20px}p{color:#94a3b8;font-size:14px}</style></head><body><div><h1>Você está offline</h1><p>Conecte-se à internet para acessar o aplicativo do membro.</p></div></body></html>',
        {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    })
  );
});
