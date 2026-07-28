'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

export default function ComissaoPage() {
  const { ctx, bloqueado } = useRequireModulo('comissao');
  const planFeatures = usePlanFeatures();
  const [activeTab, setActiveTab] = useState('ativas');

  if (ctx.loading || planFeatures.loading) return <div className="p-8 text-gray-500">Carregando...</div>;

  if (!planFeatures.has_modulo_comissao || !planFeatures.hasFeature('ordination_module')) {
    return (
      <PageLayout title="Comissão" description="Gestão de comissões e grupos de trabalho" activeMenu="comissoes">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto text-purple-600 shadow-sm border border-purple-200/60">
            <span className="text-3xl">👥</span>
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Intermediário
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Comissão Indisponível no seu Plano</h2>
          </div>
          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A Gestão de Comissões e Grupos de Trabalho está disponível a partir do Plano Intermediário.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
            Faça o upgrade para criar e gerenciar comissões especiais, acompanhamento de projetos e equipes ministeriais.
          </p>
          <div className="pt-3">
            <a
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos
            </a>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (bloqueado) return null;

  const tabs = [
    { id: 'ativas', label: 'Ativas', icon: '✅' },
    { id: 'inativas', label: 'Inativas', icon: '❌' },
    { id: 'projetos', label: 'Projetos', icon: '📋' }
  ];

  return (
    <PageLayout
      title="Comissão"
      description="Gestão de comissões e grupos de trabalho"
      activeMenu="comissoes"
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
