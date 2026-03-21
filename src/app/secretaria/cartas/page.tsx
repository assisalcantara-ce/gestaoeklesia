'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function CartasPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('emitidas');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'emitidas', label: 'Emitidas', icon: '📤' },
    { id: 'pendentes', label: 'Pendentes', icon: '⏳' },
    { id: 'canceladas', label: 'Canceladas', icon: '❌' }
  ];

  return (
    <PageLayout
      title="Cartas Ministeriais"
      description="Gerenciar cartas ministeriais e credenciais"
      activeMenu="cartas"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm">Cartas Emitidas</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Cartas Pendentes</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Cartas Canceladas</p>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="📜" title="Cartas de Credencial">
          <p className="text-gray-500 text-center py-8">Nenhuma carta registrada</p>
          <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
            + Emitir Carta
          </button>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
