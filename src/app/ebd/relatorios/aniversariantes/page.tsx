'use client';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';

export default function AniversariantesPage() {
  const { ctx, bloqueado } = useRequireModulo('ebd');
  if (ctx.loading) return <div className="p-8">Carregando...</div>;
  if (bloqueado) return null;

  return (
    <PageLayout title="Aniversariantes EBD" description="Lista de aniversariantes da Escola Bíblica" activeMenu="ebd-relatorios-aniversariantes">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-2">Aniversariantes</h2>
        <p className="text-gray-500">Lista de aniversariantes dos alunos da EBD.</p>
      </div>
    </PageLayout>
  );
}
