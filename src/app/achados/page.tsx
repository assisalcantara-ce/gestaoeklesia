'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function AchadosPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('achados');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'achados', label: 'Achados', icon: '✅' },
    { id: 'perdidos', label: 'Perdidos', icon: '❌' },
    { id: 'devolvidos', label: 'Devolvidos', icon: '✔️' }
  ];

  return (
    <PageLayout
      title="Achados e Perdidos"
      description="Gestão de objetos achados e perdidos"
      activeMenu="achados"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">Itens Achados</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-gray-600 text-sm">Itens Perdidos</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Itens Devolvidos</p>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="🔍" title="Registros">
          <p className="text-gray-500 text-center py-8">Nenhum registro de achado ou perdido</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Registrar Item
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
