'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import { RefreshCw } from 'lucide-react';

export default function PrestacaoContasRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirecionamento permanente e transparente para a Prestação de Contas Oficial
    router.replace('/presidencia/prestacao-contas-oficial');
  }, [router]);

  return (
    <PageLayout
      title="Prestação de Contas Oficial"
      description="Redirecionando para o demonstrativo consolidado oficial..."
      activeMenu="prestacao-contas-oficial"
    >
      <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#123b63]" />
        <p className="text-sm font-medium">Carregando Prestação de Contas Oficial...</p>
      </div>
    </PageLayout>
  );
}
