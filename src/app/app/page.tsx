'use client';

/**
 * /app — root redirect
 * Redireciona o usuário para o estado correto do App:
 * - Não autenticado: /app/login
 * - Autenticado + Vinculado: /app/inicio
 * - Autenticado + Não Vinculado: /app/vincular
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AppRootPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLinked, isLoading: memberLoading } = useMobileMember();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || memberLoading) return;

    if (!user) {
      router.replace('/app/login');
    } else if (isLinked) {
      router.replace('/app/inicio');
    } else {
      router.replace('/app/vincular');
    }
  }, [user, isLinked, authLoading, memberLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <Loader2 size={36} className="text-blue-500 animate-spin" />
    </div>
  );
}

