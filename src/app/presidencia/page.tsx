'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function PresidenciaPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('visao-geral');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'visao-geral', label: 'Visão Geral', icon: '📊' },
    { id: 'dirigentes', label: 'Dirigentes', icon: '👥' },
    { id: 'decisoes', label: 'Decisões', icon: '📋' }
  ];

  return (
    <PageLayout
      title="Presidência"
      description="Gestão da presidência e liderança da congregação"
      activeMenu="presidencia"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Presidente</p>
              <p className="text-2xl font-bold text-[#123b63]">-</p>
            </div>
            <span className="text-4xl">👑</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Dirigentes Ativos</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="📋" title="Decisões da Presidência">
          <p className="text-gray-500 text-center py-8">Nenhuma decisão registrada</p>
        </Section>
      </Tabs>
    </PageLayout>
  );
}
