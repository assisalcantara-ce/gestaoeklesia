'use client';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';

export default function BoletimAulaPage() {
  const { ctx, bloqueado } = useRequireModulo('ebd');
  if (ctx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;

  return (
    <PageLayout title="Boletim de Aula" description="Detalhes da aula e presenças" activeMenu="ebd-relatorios-boletim">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-2">Boletim de Aula</h2>
        <p className="text-gray-500">Relatório com o boletim de cada aula por turma.</p>
      </div>
    </PageLayout>
  );
}
