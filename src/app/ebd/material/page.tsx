'use client';

import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';

export default function EbdMaterialPage() {
  const { ctx, bloqueado } = useRequireModulo('ebd');
  if (ctx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;

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
