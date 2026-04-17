'use client';

import PageLayout from '@/components/PageLayout';

export default function EbdOfertasPage() {
  return (
    <PageLayout
      title="EBD — Caixa / Ofertas"
      description="Controle de ofertas e caixa da EBD"
      activeMenu="ebd-caixa-ofertas"
    >
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-5xl mb-4">💰</span>
        <p className="text-lg font-semibold text-gray-500">Caixa / Ofertas</p>
        <p className="text-sm mt-1">Módulo em desenvolvimento</p>
      </div>
    </PageLayout>
  );
}
