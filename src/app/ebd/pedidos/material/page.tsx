'use client';

import PageLayout from '@/components/PageLayout';

export default function EbdMaterialExtraPage() {
  return (
    <PageLayout
      title="EBD — Material Extra"
      description="Pedidos de material extra para as aulas"
      activeMenu="ebd-pedidos-material"
    >
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-5xl mb-4">📦</span>
        <p className="text-lg font-semibold text-gray-500">Material Extra</p>
        <p className="text-sm mt-1">Módulo em desenvolvimento</p>
      </div>
    </PageLayout>
  );
}
