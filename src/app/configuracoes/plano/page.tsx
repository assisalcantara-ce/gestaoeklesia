'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function PlanoPage() {
  const [activeMenu, setActiveMenu] = useState('plano');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const planoAtual = {
    nome: 'Plano Profissional',
    preco: 599.90,
    ciclo: 'mensal',
    dataInicio: '2024-01-01',
    dataRenovacao: '2024-12-15',
    features: [
      '✓ Até 500 membros',
      '✓ Módulo de Secretaria',
      '✓ Módulo de Tesouraria',
      '✓ Relatórios básicos',
      '✓ Suporte por email',
      '✗ Geolocalização avançada',
      '✗ API customizada'
    ]
  };

  const planosDisponiveis = [
    {
      id: 1,
      nome: 'Starter',
      preco: 199.90,
      ciclo: 'mensal',
      features: [
        '✓ Até 100 membros',
        '✓ Módulo de Secretaria',
        '✓ Relatórios básicos',
        '✓ Suporte por email',
      ],
      recomendado: false
    },
    {
      id: 2,
      nome: 'Profissional',
      preco: 599.90,
      ciclo: 'mensal',
      features: [
        '✓ Até 500 membros',
        '✓ Módulo de Secretaria',
        '✓ Módulo de Tesouraria',
        '✓ Relatórios avançados',
        '✓ Suporte prioritário',
        '✓ Branding customizado',
      ],
      recomendado: true
    },
    {
      id: 3,
      nome: 'Empresarial',
      preco: 1299.90,
      ciclo: 'mensal',
      features: [
        '✓ Membros ilimitados',
        '✓ Todos os módulos',
        '✓ Geolocalização avançada',
        '✓ Relatórios customizados',
        '✓ Suporte 24/7',
        '✓ API completa',
        '✓ Multi-organização',
      ],
      recomendado: false
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <h1 className="text-3xl font-bold text-gray-800 mb-6">📋 Plano de Assinatura</h1>

          {/* Plano Atual */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-2">Seu Plano Atual</h2>
            <p className="text-teal-100 mb-6">Gerencie sua assinatura e veja os benefícios do seu plano</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-teal-100 text-sm mb-1">Plano</p>
                <p className="text-2xl font-bold">{planoAtual.nome}</p>
              </div>

              <div>
                <p className="text-teal-100 text-sm mb-1">Valor</p>
                <p className="text-2xl font-bold">R$ {planoAtual.preco.toFixed(2).replace('.', ',')}</p>
                <p className="text-teal-100 text-xs">por {planoAtual.ciclo}</p>
              </div>

              <div>
                <p className="text-teal-100 text-sm mb-1">Ativo desde</p>
                <p className="text-lg font-semibold">
                  {new Date(planoAtual.dataInicio).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div>
                <p className="text-teal-100 text-sm mb-1">Próxima renovação</p>
                <p className="text-lg font-semibold">
                  {new Date(planoAtual.dataRenovacao).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3">Seu Plano Inclui:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {planoAtual.features.map((feature, index) => (
                  <p key={index} className="text-teal-100">{feature}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Planos Disponíveis */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Faça Upgrade para um Plano Melhor</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {planosDisponiveis.map((plano) => (
                <div
                  key={plano.id}
                  className={`rounded-lg shadow-lg overflow-hidden transition transform hover:scale-105 ${
                    plano.recomendado
                      ? 'ring-2 ring-teal-500 bg-white'
                      : 'bg-white'
                  }`}
                >
                  {plano.recomendado && (
                    <div className="bg-teal-500 text-white px-4 py-2 text-center text-sm font-bold">
                      ⭐ RECOMENDADO
                    </div>
                  )}

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{plano.nome}</h3>
                    <p className="text-3xl font-bold text-teal-600 mb-1">
                      R$ {plano.preco.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-gray-600 text-sm mb-6">por {plano.ciclo}</p>

                    <div className="space-y-2 mb-6">
                      {plano.features.map((feature, index) => (
                        <p key={index} className="text-sm text-gray-700">{feature}</p>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        if (plano.nome !== planoAtual.nome) {
                          setShowUpgradeModal(true);
                        }
                      }}
                      disabled={plano.nome === planoAtual.nome}
                      className={`w-full py-2 rounded-lg font-semibold transition ${
                        plano.nome === planoAtual.nome
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      {plano.nome === planoAtual.nome ? '✓ Plano Atual' : 'Fazer Upgrade'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade Modal */}
          {showUpgradeModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Confirmar Upgrade</h2>
                <p className="text-gray-600 mb-6">
                  Deseja realmente fazer upgrade do seu plano? A alteração será aplicada imediatamente e você receberá um novo recibo por email.
                </p>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      alert('Upgrade realizado com sucesso!');
                      setShowUpgradeModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
