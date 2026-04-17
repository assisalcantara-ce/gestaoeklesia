'use client';

import PageLayout from '@/components/PageLayout';

export default function EbdClassesPage() {
  return (
    <PageLayout
      title="EBD — Classes"
      description="Cadastro e gerenciamento de classes da EBD"
      activeMenu="ebd-cadastro-classes"
    >
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-5xl mb-4">🏷️</span>
        <p className="text-lg font-semibold text-gray-500">Classes da EBD</p>
        <p className="text-sm mt-1">Módulo em desenvolvimento</p>
      </div>
    </PageLayout>
  );
}
