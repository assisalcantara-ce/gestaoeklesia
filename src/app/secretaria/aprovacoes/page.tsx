'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function AprovacoesPage() {
  const { loading } = useRequireSupabaseAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace('/secretaria/fluxos?tab=aprovacoes');
    }
  }, [loading, router]);

  return <div className="p-8">Redirecionando...</div>;
}
