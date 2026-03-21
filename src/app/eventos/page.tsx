'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function EventosPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('programados');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'programados', label: 'Programados', icon: '📅' },
    { id: 'realizados', label: 'Realizados', icon: '✅' },
    { id: 'cancelados', label: 'Cancelados', icon: '❌' }
  ];

  return (
    <PageLayout
      title="Eventos"
      description="Gerenciamento de eventos da congregação"
      activeMenu="eventos"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
          <p className="text-gray-600 text-sm">Eventos Programados</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Eventos Realizados</p>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">Eventos Cancelados</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="📅" title="Próximos Eventos">
          <p className="text-gray-500 text-center py-8">Nenhum evento agendado</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Novo Evento
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
