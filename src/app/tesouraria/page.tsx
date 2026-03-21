'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';

export default function TesourariaPage() {
  const { loading } = useRequireSupabaseAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (loading) return <div className="p-8">Carregando...</div>;

  const tabs = [
    { id: 'overview', label: '💰 Visão Geral', icon: '📊' },
    { id: 'movimentacoes', label: '📋 Movimentações', icon: '💸' },
    { id: 'relatorios', label: '📈 Relatórios', icon: '📊' }
  ];

  return (
    <PageLayout
      title="Tesouraria"
      description="Gestão financeira do tesouro da congregação"
      activeMenu="tesouraria"
    >
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Saldo em Caixa</p>
                  <p className="text-3xl font-bold text-[#123b63]">R$ 0,00</p>
                </div>
                <span className="text-4xl">💰</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Receitas (Mês)</p>
                  <p className="text-3xl font-bold text-green-600">R$ 0,00</p>
                </div>
                <span className="text-4xl">📈</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Despesas (Mês)</p>
                  <p className="text-3xl font-bold text-red-600">R$ 0,00</p>
                </div>
                <span className="text-4xl">📉</span>
              </div>
            </div>
          </div>

          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
            <p className="text-gray-500 text-center py-8">Visão geral do tesouro</p>
          </Tabs>
        </div>
      )}

      {activeTab === 'movimentacoes' && (
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
          <Section icon="💸" title="Movimentações Recentes">
            <p className="text-gray-500 text-center py-8">Nenhuma movimentação registrada</p>
            <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
              + Registrar Movimentação
            </button>
          </Section>
        </Tabs>
      )}

      {activeTab === 'relatorios' && (
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
          <Section icon="📊" title="Relatórios">
            <p className="text-gray-500 text-center py-8">Nenhum relatório disponível</p>
            <button className="mt-4 bg-[#123b63] text-white px-6 py-2 rounded hover:bg-[#0f2a45] transition w-full">
              + Gerar Relatório
            </button>
          </Section>
        </Tabs>
      )}
    </PageLayout>
  );
}
