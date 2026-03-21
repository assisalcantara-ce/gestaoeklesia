'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function ComissaoPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('ativas');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'ativas', label: 'Ativas', icon: '✅' },
    { id: 'inativas', label: 'Inativas', icon: '❌' },
    { id: 'projetos', label: 'Projetos', icon: '📋' }
  ];

  return (
    <PageLayout
      title="Comissão"
      description="Gestão de comissões e grupos de trabalho"
      activeMenu="comissao"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">Comissões Ativas</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Membros Envolvidos</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Projetos em Andamento</p>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="👥" title="Comissões Registradas">
          <p className="text-gray-500 text-center py-8">Nenhuma comissão registrada</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Nova Comissão
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
