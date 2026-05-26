'use client';

/**
 * /app — root redirect
 * O MobileMemberProvider cuida do redirecionamento correto conforme o estado auth.
 * Esta página é intermediária e só exibe loading enquanto o guard processa.
 */

import { useMobileMember } from '@/providers/MobileMemberProvider';

export const dynamic = 'force-dynamic';

export default function AppRootPage() {
  const { isLoading } = useMobileMember();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-blue">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white/70 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return null;
}
