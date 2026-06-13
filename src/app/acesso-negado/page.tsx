'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import PremiumCard from '@/components/ui/PremiumCard';
import PremiumButton from '@/components/ui/PremiumButton';
import { GRADIENTS } from '@/config/tokens';

export default function AcessoNegadoPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: GRADIENTS.APP_BACKGROUND }}
    >
      <PremiumCard
        hoverable={false}
        className="p-10 max-w-md w-full text-center border border-white/20"
        variant="glass"
      >
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldOff className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Acesso Negado</h1>
        <p className="text-white/80 text-sm mb-1">
          Você não tem permissão para acessar esta página.
        </p>
        <p className="text-white/50 text-xs mb-8">
          Caso acredite que isso é um erro, entre em contato com o administrador do sistema.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <PremiumButton
            variant="secondary"
            onClick={() => router.back()}
            className="w-full sm:w-auto text-slate-700 bg-white/95 border-none"
          >
            ← Voltar
          </PremiumButton>
          <Link href="/dashboard" passHref className="w-full sm:w-auto">
            <PremiumButton className="w-full">
              Ir para o Dashboard
            </PremiumButton>
          </Link>
        </div>
      </PremiumCard>
    </div>
  );
}
