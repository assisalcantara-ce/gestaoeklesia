'use client';

import PageLayout from '@/components/PageLayout';

export default function EbdMaterialPage() {
  return (
    <PageLayout
      title="EBD — Material de Apoio"
      description="Material de apoio para as aulas da EBD"
      activeMenu="ebd-aulas-material"
    >
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-5xl mb-4">📎</span>
        <p className="text-lg font-semibold text-gray-500">Material de Apoio</p>
        <p className="text-sm mt-1">Módulo em desenvolvimento</p>
      </div>
    </PageLayout>
  );
}
