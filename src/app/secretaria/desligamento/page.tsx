'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function DesligamentoPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('pendentes');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'pendentes', label: 'Pendentes', icon: '⏳' },
    { id: 'aprovados', label: 'Aprovados', icon: '✅' },
    { id: 'rejeitados', label: 'Rejeitados', icon: '❌' }
  ];

  return (
    <PageLayout
      title="Solicitação de Desligamento"
      description="Gerenciar solicitações de desligamento"
      activeMenu="desligamento"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">Solicitações Pendentes</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Desligamentos Aprovados</p>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-gray-600 text-sm">Solicitações Rejeitadas</p>
          <p className="text-3xl font-bold text-red-600 mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="📋" title="Solicitações em Aberto">
          <p className="text-gray-500 text-center py-8">Nenhuma solicitação pendente</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Nova Solicitação
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
