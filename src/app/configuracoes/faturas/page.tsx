'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function FaturasPage() {
  const [activeMenu, setActiveMenu] = useState('faturas');
  const [filterStatus, setFilterStatus] = useState('TODAS');

  const faturas = [
    {
      id: 1,
      numero: 'FAT-2024-001',
      data: '2024-01-15',
      vencimento: '2024-02-15',
      valor: 599.90,
      status: 'paga',
      dataPagamento: '2024-02-10'
    },
    {
      id: 2,
      numero: 'FAT-2024-002',
      data: '2024-02-15',
      vencimento: '2024-03-15',
      valor: 599.90,
      status: 'paga',
      dataPagamento: '2024-03-12'
    },
    {
      id: 3,
      numero: 'FAT-2024-003',
      data: '2024-03-15',
      vencimento: '2024-04-15',
      valor: 599.90,
      status: 'vencida',
      dataPagamento: null
    },
    {
      id: 4,
      numero: 'FAT-2024-004',
      data: '2024-11-15',
      vencimento: '2024-12-15',
      valor: 599.90,
      status: 'vencer',
      dataPagamento: null
    },
    {
      id: 5,
      numero: 'FAT-2024-005',
      data: '2024-11-20',
      vencimento: '2024-12-20',
      valor: 799.90,
      status: 'vencer',
      dataPagamento: null
    }
  ];

  const faturasFiltered = filterStatus === 'TODAS' 
    ? faturas 
    : faturas.filter(f => f.status === filterStatus.toLowerCase());

  const totalPago = faturas.filter(f => f.status === 'paga').reduce((sum, f) => sum + f.valor, 0);
  const totalVencida = faturas.filter(f => f.status === 'vencida').reduce((sum, f) => sum + f.valor, 0);
  const totalVencer = faturas.filter(f => f.status === 'vencer').reduce((sum, f) => sum + f.valor, 0);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paga': return 'bg-green-100 text-green-800';
      case 'vencida': return 'bg-red-100 text-red-800';
      case 'vencer': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'paga': return '✓ Paga';
      case 'vencida': return '✕ Vencida';
      case 'vencer': return '⏰ A Vencer';
      default: return status;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <h1 className="text-3xl font-bold text-gray-800 mb-6">📄 Faturas</h1>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
              <p className="text-gray-600 text-sm font-semibold mb-1">FATURAS PAGAS</p>
              <p className="text-3xl font-bold text-green-600">R$ {totalPago.toFixed(2).replace('.', ',')}</p>
              <p className="text-xs text-gray-500 mt-2">{faturas.filter(f => f.status === 'paga').length} faturas</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
              <p className="text-gray-600 text-sm font-semibold mb-1">FATURAS VENCIDAS</p>
              <p className="text-3xl font-bold text-red-600">R$ {totalVencida.toFixed(2).replace('.', ',')}</p>
              <p className="text-xs text-gray-500 mt-2">{faturas.filter(f => f.status === 'vencida').length} faturas</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-600">
              <p className="text-gray-600 text-sm font-semibold mb-1">FATURAS A VENCER</p>
              <p className="text-3xl font-bold text-yellow-600">R$ {totalVencer.toFixed(2).replace('.', ',')}</p>
              <p className="text-xs text-gray-500 mt-2">{faturas.filter(f => f.status === 'vencer').length} faturas</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-2">
            {['TODAS', 'paga', 'vencida', 'vencer'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status === 'TODAS' ? 'TODAS' : status)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  filterStatus === (status === 'TODAS' ? 'TODAS' : status)
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status === 'TODAS' ? 'Todas' : status === 'paga' ? 'Pagas' : status === 'vencida' ? 'Vencidas' : 'A Vencer'}
              </button>
            ))}
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Número</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Emissão</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Vencimento</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Valor</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {faturasFiltered.map((fatura) => (
                  <tr key={fatura.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900 font-semibold">{fatura.numero}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(fatura.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(fatura.vencimento).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-semibold">
                      R$ {fatura.valor.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(fatura.status)}`}>
                        {getStatusLabel(fatura.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <button className="text-teal-600 hover:text-teal-800 font-semibold">
                        📥 Baixar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
