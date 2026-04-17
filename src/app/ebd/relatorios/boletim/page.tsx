'use client';
import PageLayout from '@/components/PageLayout';

export default function BoletimAulaPage() {
  return (
    <PageLayout title="Boletim de Aula" description="Detalhes da aula e presenças" activeMenu="ebd-relatorios-boletim">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-2">Boletim de Aula</h2>
        <p className="text-gray-500">Relatório com o boletim de cada aula por turma.</p>
      </div>
    </PageLayout>
  );
}
