'use client';
import PageLayout from '@/components/PageLayout';

export default function RelatoriosProfessoresPage() {
  return (
    <PageLayout title="Relatório de Professores" description="Visualize atividades e estatísticas dos professores" activeMenu="ebd-relatorios-professores">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-2">Relatório de Professores</h2>
        <p className="text-gray-500">Desempenho e frequência dos professores da EBD.</p>
      </div>
    </PageLayout>
  );
}
