'use client';
import PageLayout from '@/components/PageLayout';

export default function AniversariantesPage() {
  return (
    <PageLayout title="Aniversariantes EBD" description="Lista de aniversariantes da Escola Bíblica" activeMenu="ebd-relatorios-aniversariantes">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-2">Aniversariantes</h2>
        <p className="text-gray-500">Lista de aniversariantes dos alunos da EBD.</p>
      </div>
    </PageLayout>
  );
}
