'use client';

export const dynamic = 'force-dynamic';

import PageLayout from '@/components/PageLayout';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { QrCode, ArrowRight } from 'lucide-react';
import TesourariaPage from '../page';

export default function ArrecadacaoDigitalPage() {
  const { loading: authLoading } = useRequireSupabaseAuth();
  useRequireModulo('tesouraria');
  const planFeatures = usePlanFeatures();

  if (authLoading || planFeatures.loading) {
    return (
      <PageLayout title="Arrecadação Digital" description="Links PIX, cobranças e webhooks" activeMenu="tesouraria">
        <div className="flex items-center justify-center p-12 text-gray-400 text-sm">
          Carregando informações do plano...
        </div>
      </PageLayout>
    );
  }

  // Se o tenant NÃO possuir o Plano Intermediário ou superior, bloqueia e exibe a tela de recurso indisponível
  if (!planFeatures.has_arrecadacao_digital) {
    return (
      <PageLayout title="Arrecadação Digital" description="Controle de Licenciamento por Plano" activeMenu="tesouraria">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 shadow-sm border border-amber-200/60">
            <QrCode className="h-8 w-8" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Intermediário
            </span>
            <h2 className="text-xl font-bold text-slate-800">Funcionalidade Indisponível no seu Plano</h2>
          </div>

          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A funcionalidade Arrecadação Digital está disponível a partir do Plano Intermediário.
          </p>

          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
            Faça o upgrade para liberar links PIX automatizados, geração de QR Codes dinâmicos e conciliação bancária automática no módulo financeiro.
          </p>

          <div className="pt-3">
            <a
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Tenant com Plano Intermediário ou superior: exibe a página de Tesouraria
  return <TesourariaPage />;
}
