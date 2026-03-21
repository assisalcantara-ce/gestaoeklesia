'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function KidsPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('criancas');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'criancas', label: 'Crianças', icon: '👧' },
    { id: 'atividades', label: 'Atividades', icon: '🎮' },
    { id: 'monitores', label: 'Monitores', icon: '🤝' }
  ];

  return (
    <PageLayout
      title="KIDs"
      description="Programa de crianças e atividades infantis"
      activeMenu="kids"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-pink-500">
          <p className="text-gray-600 text-sm">Crianças Registradas</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Atividades Agendadas</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Monitores Ativos</p>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="👶" title="Crianças">
          <p className="text-gray-500 text-center py-8">Nenhuma criança registrada</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Registrar Criança
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
