/**
 * src/lib/public-routes.ts
 * Utilitários para detecção e isolamento de rotas públicas autônomas no Gestão Eklésia.
 */

/**
 * Retorna true se o caminho corresponder à rota pública do Agente de Acolhimento (/acolhimento/[token]).
 * Preserva estritamente as rotas administrativas internas (/acolhimento/visitantes e /acolhimento/relatorios)
 * como rotas autenticadas com exibição do menu lateral (Sidebar) do ERP.
 */
export function isPublicAcolhimentoPath(pathname: string | null | undefined): boolean {
  if (!pathname || typeof pathname !== 'string') return false;

  // Apenas rotas sob o prefixo /acolhimento/
  if (!pathname.startsWith('/acolhimento/')) return false;

  // Sub-rotas administrativas que exigem login e exibem a Sidebar do ERP
  const adminPaths = [
    '/acolhimento/visitantes',
    '/acolhimento/relatorios',
  ];

  const isAdmin = adminPaths.some(
    (admin) => pathname === admin || pathname.startsWith(admin + '/')
  );

  return !isAdmin;
}
