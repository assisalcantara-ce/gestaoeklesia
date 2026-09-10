'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserContext } from '@/hooks/useUserContext';
import { authenticatedFetch } from '@/lib/api-client';

const EXEMPT_PREFIXES = [
  '/juridico/aceite',
  '/login',
  '/admin',
  '/redefinir-senha',
  '/pre-cadastro',
  '/registrar',
  '/trial-expirado',
  '/auth',
];

export default function GlobalJuridicoGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { ministryId, loading: userLoading, userId } = useUserContext();

  useEffect(() => {
    // Se a rota for isenta ou se o contexto do usuário ainda estiver carregando, ignorar
    const isExempt = EXEMPT_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
    );

    if (isExempt || userLoading || !ministryId || !userId) {
      return;
    }

    let isCancelled = false;

    const checarPendencias = async () => {
      try {
        const res = await authenticatedFetch(
          `/api/v1/juridico/verificar-pendencias?ministry_id=${encodeURIComponent(ministryId)}`
        );

        if (isCancelled) return;

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.possui_pendencias === true) {
            console.warn('[GlobalJuridicoGuard] Pendência jurídica detectada. Redirecionando para /juridico/aceite');
            router.replace('/juridico/aceite');
          }
        }
      } catch (err) {
        console.error('[GlobalJuridicoGuard] Erro ao verificar pendências jurídicas:', err);
      }
    };

    checarPendencias();

    return () => {
      isCancelled = true;
    };
  }, [pathname, ministryId, userId, userLoading, router]);

  return null;
}
