'use client';

import PageLayout from '@/components/PageLayout';

export default function EbdSuperintendentesPage() {
  return (
    <PageLayout
      title="EBD — Superintendente"
      description="Cadastro de superintendentes da EBD"
      activeMenu="ebd-cadastro-superintendente"
    >
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-5xl mb-4">👤</span>
        <p className="text-lg font-semibold text-gray-500">Superintendente</p>
        <p className="text-sm mt-1">Módulo em desenvolvimento</p>
      </div>
    </PageLayout>
  );
}
