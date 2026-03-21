'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function MissoesPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('projetos');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'projetos', label: 'Projetos', icon: '✏️' },
    { id: 'missionarios', label: 'Missionários', icon: '👨' },
    { id: 'arrecadacoes', label: 'Arrecadações', icon: '💵' }
  ];

  return (
    <PageLayout
      title="Missões"
      description="Gestão de atividades missionárias"
      activeMenu="missoes"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-gray-600 text-sm">Projetos Missionários</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Missionários Ativos</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Recursos Arrecadados</p>
          <p className="text-2xl font-bold text-green-600 mt-2">R$ 0,00</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="✈️" title="Projetos Missionários">
          <p className="text-gray-500 text-center py-8">Nenhum projeto registrado</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Novo Projeto
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
