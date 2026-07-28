'use client';

import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

export default function PresidenciaPage() {
  const { ctx, bloqueado } = useRequireModulo('presidencia');
  const planFeatures = usePlanFeatures();
  const [activeTab, setActiveTab] = useState('visao-geral');

  if (ctx.loading || planFeatures.loading) return <div className="p-8 text-gray-500">Carregando...</div>;

  if (!planFeatures.has_modulo_presidencial || !planFeatures.hasFeature('presidency_module')) {
    return (
      <PageLayout title="Presidência" description="Gestão da presidência e liderança da congregação" activeMenu="presidencia">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600 shadow-sm border border-red-200/60">
            <span className="text-3xl">👑</span>
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Profissional
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Presidência Indisponível no seu Plano</h2>
          </div>
          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A Gestão de Presidência e Liderança Corporativa está disponível exclusivamente no Plano Profissional e superiores.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
            Faça o upgrade para acessar relatórios consolidados, prestações de contas oficiais, auditorias e gestão da diretoria ministerial.
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
