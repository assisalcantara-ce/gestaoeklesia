'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireModulo } from '@/hooks/useRequireModulo';

export default function AprovacoesPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria');
  const router = useRouter();

  useEffect(() => {
    if (!ctx.loading && !bloqueado) {
      router.replace('/secretaria/fluxos?tab=aprovacoes');
    }
  }, [ctx.loading, bloqueado, router]);

  if (bloqueado) return null;
  return <div className="p-8">Redirecionando...</div>;
}
