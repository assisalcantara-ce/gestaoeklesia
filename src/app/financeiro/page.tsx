'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function FinanceiroPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('visao-geral');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'visao-geral', label: 'Visão Geral', icon: '💳' },
    { id: 'receber', label: 'Contas a Receber', icon: '📥' },
    { id: 'pagar', label: 'Contas a Pagar', icon: '📤' }
  ];

  return (
    <PageLayout
      title="Financeiro"
      description="Gestão de contas, despesas e receitas"
      activeMenu="financeiro"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm">Total de Receitas</p>
          <p className="text-2xl font-bold text-[#123b63] mt-2">R$ 0,00</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm">Total de Despesas</p>
          <p className="text-2xl font-bold text-[#123b63] mt-2">R$ 0,00</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Saldo Líquido</p>
          <p className="text-2xl font-bold text-green-600 mt-2">R$ 0,00</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Contas Pendentes</p>
          <p className="text-2xl font-bold text-[#123b63] mt-2">0</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'visao-geral' && (
          <Section icon="💳" title="Resumo Financeiro">
            <p className="text-gray-500 text-center py-8">Nenhuma informação disponível</p>
          </Section>
        )}
        {activeTab === 'receber' && (
          <Section icon="📥" title="Contas a Receber">
            <p className="text-gray-500 text-center py-8">Nenhuma conta pendente</p>
            <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
              + Nova Conta a Receber
            </button>
          </Section>
        )}
        {activeTab === 'pagar' && (
          <Section icon="📤" title="Contas a Pagar">
            <p className="text-gray-500 text-center py-8">Nenhuma conta pendente</p>
            <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
              + Nova Conta a Pagar
            </button>
          </Section>
        )}
      </Tabs>
    </PageLayout>
  );
}
