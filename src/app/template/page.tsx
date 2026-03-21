/**
 * TEMPLATE - USE ESTE ARQUIVO COMO BASE PARA NOVOS MÓDULOS
 * 
 * Passos:
 * 1. Copie este arquivo
 * 2. Mude o nome do módulo (ex: financeiro, relatorios, etc)
 * 3. Substitua "Novo Módulo" pelo nome real
 * 4. Adapte o conteúdo mantendo a estrutura de espaçamentos
 */

'use client';

import { useState } from 'react';
import { SPACING, COLORS, RADIUS, SHADOWS } from '@/config/design-system';

interface DadosExemplo {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
}

export default function NovoModuloTemplate() {
  const [dados] = useState<DadosExemplo[]>([
    { id: '1', nome: 'Item 1', descricao: 'Descrição 1', valor: 100 },
    { id: '2', nome: 'Item 2', descricao: 'Descrição 2', valor: 200 },
    { id: '3', nome: 'Item 3', descricao: 'Descrição 3', valor: 300 },
    { id: '4', nome: 'Item 4', descricao: 'Descrição 4', valor: 400 },
  ]);

  return (
    <div className={`${SPACING.containerPadding} min-h-screen bg-white`}>
      {/* ====== HEADER ====== */}
      <div className={SPACING.sectionMargin}>
        <h1 className="text-4xl font-bold" style={{ color: COLORS.darkBlue }}>
          Novo Módulo
        </h1>
        <p className="text-gray-600 mt-2">Descrição do módulo aqui</p>
      </div>

      {/* ====== CARDS GRID (4 COLUNAS) ====== */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${SPACING.sectionGap} ${SPACING.sectionMargin}`}>
        {dados.map((item) => (
          <div
            key={item.id}
            className={`${RADIUS.card} ${SHADOWS.cardShadow} ${SPACING.cardPadding} ${SHADOWS.cardHoverShadow} cursor-pointer transition`}
            style={{ borderLeft: `4px solid ${COLORS.mediumBlue}` }}
          >
            <h3 className="text-lg font-bold" style={{ color: COLORS.darkBlue }}>
              {item.nome}
            </h3>
            <p className="text-gray-600 text-sm mt-1">{item.descricao}</p>
            <p className="text-2xl font-bold mt-3" style={{ color: COLORS.mediumBlue }}>
              R$ {item.valor.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* ====== TABELA EXEMPLO ====== */}
      <div className={`${RADIUS.card} ${SHADOWS.cardShadow} ${SPACING.cardPadding} ${SPACING.sectionMargin}`}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.darkBlue }}>
          Lista Detalhada
        </h2>
        
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 font-semibold" style={{ color: COLORS.darkBlue }}>
                Nome
              </th>
              <th className="text-left py-3 px-2 font-semibold" style={{ color: COLORS.darkBlue }}>
                Descrição
              </th>
              <th className="text-right py-3 px-2 font-semibold" style={{ color: COLORS.darkBlue }}>
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {dados.map((item, index) => (
              <tr
                key={item.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="py-3 px-2">{item.nome}</td>
                <td className="py-3 px-2 text-gray-600">{item.descricao}</td>
                <td className="py-3 px-2 text-right font-semibold">R$ {item.valor.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ====== FORM SECTION ====== */}
      <div className={`${RADIUS.card} ${SHADOWS.cardShadow} ${SPACING.cardPadding} ${SPACING.sectionMargin}`}>
        <h2 className="text-2xl font-bold mb-6" style={{ color: COLORS.darkBlue }}>
          Adicionar Novo Item
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input 1 */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.darkBlue }}>
              Nome
            </label>
            <input
              type="text"
              placeholder="Digite o nome"
              className={`w-full ${RADIUS.input} border border-gray-300 ${SPACING.inputPadding} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Input 2 */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.darkBlue }}>
              Valor
            </label>
            <input
              type="number"
              placeholder="0.00"
              className={`w-full ${RADIUS.input} border border-gray-300 ${SPACING.inputPadding} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Input 3 - Full width */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.darkBlue }}>
              Descrição
            </label>
            <textarea
              placeholder="Digite a descrição"
              rows={3}
              className={`w-full ${RADIUS.input} border border-gray-300 ${SPACING.inputPadding} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 mt-6">
          <button
            className={`${SPACING.buttonPadding} ${RADIUS.button} font-semibold text-white transition bg-blue-600 hover:bg-blue-700`}
          >
            Salvar
          </button>
          <button
            className={`${SPACING.buttonPadding} ${RADIUS.button} font-semibold text-gray-700 transition bg-gray-200 hover:bg-gray-300`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
