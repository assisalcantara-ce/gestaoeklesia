'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function EBDPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('turmas');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'turmas', label: 'Turmas', icon: '📚' },
    { id: 'alunos', label: 'Alunos', icon: '👨' },
    { id: 'professores', label: 'Professores', icon: '🧑' }
  ];

  return (
    <PageLayout
      title="EBD"
      description="Escola Bíblica Dominical"
      activeMenu="ebd"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">Turmas Ativas</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Professores</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Alunos Matriculados</p>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="📚" title="Turmas">
          <p className="text-gray-500 text-center py-8">Nenhuma turma cadastrada</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Nova Turma
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
