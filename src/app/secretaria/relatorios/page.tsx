'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function RelatoriosPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('gerados');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'gerados', label: 'Gerados', icon: '📊' },
    { id: 'baixados', label: 'Baixados', icon: '⬇️' },
    { id: 'compartilhados', label: 'Compartilhados', icon: '📤' }
  ];

  return (
    <PageLayout
      title="Relatórios"
      description="Gerar e visualizar relatórios da secretaria"
      activeMenu="relatorios"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Relatórios Gerados</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Relatórios Baixados</p>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">Relatórios Compartilhados</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="📊" title="Relatórios Disponíveis">
          <p className="text-gray-500 text-center py-8">Nenhum relatório disponível</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Gerar Relatório
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
