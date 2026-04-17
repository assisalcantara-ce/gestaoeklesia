'use client';

/**
 * useRequireModulo — guard de módulo
 *
 * Redireciona para /acesso-negado se o usuário não tiver permissão de leitura
 * no módulo informado. Aguarda o carregamento do contexto antes de redirecionar.
 *
 * Uso:
 *   const { ctx, bloqueado } = useRequireModulo('tesouraria');
 *   if (bloqueado) return null; // o hook já está redirecionando
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserContext, UserContext } from '@/hooks/useUserContext';

interface GuardResult {
  ctx: UserContext;
  bloqueado: boolean;
}

export function useRequireModulo(modulo: string): GuardResult {
  const router = useRouter();
  const ctx = useUserContext();
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    if (ctx.loading) return;

    // Sem nível carregado = usuário autenticado mas sem registro em ministry_users
    // Redireciona para login pois a sessão não tem perfil válido no sistema
    if (!ctx.nivel) {
      router.replace('/login');
      setBloqueado(true);
      return;
    }

    if (!ctx.podeAcessar(modulo)) {
      router.replace('/acesso-negado');
      setBloqueado(true);
    }
  }, [ctx.loading, ctx.nivel, ctx.podeAcessar, modulo, router]);

  return { ctx, bloqueado };
}
