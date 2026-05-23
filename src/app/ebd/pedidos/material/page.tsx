'use client';

import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';

export default function EbdMaterialExtraPage() {
  const { ctx, bloqueado } = useRequireModulo('ebd');
  if (ctx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;

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
