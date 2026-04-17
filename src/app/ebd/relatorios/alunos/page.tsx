'use client';
import PageLayout from '@/components/PageLayout';

export default function RelatoriosAlunosPage() {
  return (
    <PageLayout title="Relatório de Alunos" description="Visualize dados e frequência dos alunos" activeMenu="ebd-relatorios-alunos">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-2">Relatório de Alunos</h2>
        <p className="text-gray-500">Histórico e desempenho dos alunos da EBD.</p>
      </div>
    </PageLayout>
  );
}
