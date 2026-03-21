'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { NivelAcesso } from '@/hooks/usePermissions';

interface Membro {
  id: string;
  nome: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';
  status: 'ativo' | 'inativo';
  congregacao?: string;
  dizimista?: boolean;
  dataCadastro?: string | Date;
}

interface MembrosOverviewProps {
  membros: Membro[];
  nivelUsuario?: NivelAcesso;
  congregacaoUsuario?: string;
  supervisaoUsuario?: string;
}

export default function MembrosOverview({ 
  membros, 
  nivelUsuario = 'administrador',
  congregacaoUsuario,
  supervisaoUsuario
}: MembrosOverviewProps) {
  const [membrosFiltrados, setMembrosFiltrados] = useState<Membro[]>(membros);

  // Filtrar membros baseado no nível do usuário
  useEffect(() => {
    let filtrados = membros;

    if (nivelUsuario === 'operador' && congregacaoUsuario) {
      // Operador vê apenas de sua congregação
      filtrados = membros.filter(m => m.congregacao === congregacaoUsuario);
    } else if (nivelUsuario === 'supervisor' && supervisaoUsuario) {
      // Supervisor vê membros de suas congregações (precisaria de relacionamento)
      // Por enquanto, filtra por supervisão se existisse o campo
      // filtrados = membros.filter(m => m.supervisao === supervisaoUsuario);
    }
    // Admin vê tudo

    setMembrosFiltrados(filtrados);
  }, [membros, nivelUsuario, congregacaoUsuario, supervisaoUsuario]);
  // Calcular estatísticas com base nos membros filtrados
  const totalMembros = membrosFiltrados.length;
  const ativos = membrosFiltrados.filter(m => m.status === 'ativo').length;
  const dizimistas = membrosFiltrados.filter(m => m.dizimista === true).length;
  
  const tiposContagem = {
    membro: membrosFiltrados.filter(m => m.tipoCadastro === 'membro').length,
    congregado: membrosFiltrados.filter(m => m.tipoCadastro === 'congregado').length,
    ministro: membrosFiltrados.filter(m => m.tipoCadastro === 'ministro').length,
    crianca: membrosFiltrados.filter(m => m.tipoCadastro === 'crianca').length,
  };

  const percentualAtivo = totalMembros > 0 ? ((ativos / totalMembros) * 100).toFixed(1) : 0;
  const percentualDizimista = totalMembros > 0 ? ((dizimistas / totalMembros) * 100).toFixed(1) : 0;
  const percentualCongregado = totalMembros > 0 ? ((tiposContagem.congregado / totalMembros) * 100).toFixed(1) : 0;

  // Gerar dados de cadastro por mês (últimos 12 meses)
  const gerarDadosCadastrosPorMes = () => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const hoje = new Date();
    const dados: { mes: string; cadastros: number; mesNum: number; anoNum: number }[] = [];

    // Criar 12 meses anteriores
    for (let i = 11; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mes = meses[data.getMonth()];
      const ano = data.getFullYear();
      const mesNum = data.getMonth() + 1;
      
      dados.push({
        mes: `${mes}/${ano.toString().slice(-2)}`,
        cadastros: 0,
        mesNum,
        anoNum: ano,
      });
    }

    // Contar cadastros por mês
    membrosFiltrados.forEach(membro => {
      if (membro.dataCadastro) {
        const dataCadastro = new Date(membro.dataCadastro);
        const mesIdx = dados.findIndex(
          d => d.mesNum === dataCadastro.getMonth() + 1 && 
               d.anoNum === dataCadastro.getFullYear()
        );
        if (mesIdx !== -1) {
          dados[mesIdx].cadastros++;
        }
      }
    });

    return dados;
  };

  const dadosCadastros = gerarDadosCadastrosPorMes();

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas - Visão Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Membros */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 font-medium">Total de Membros</p>
              <p className="text-3xl font-bold mt-2">{totalMembros}</p>
            </div>
            <span className="text-4xl opacity-70">👥</span>
          </div>
        </div>

        {/* Membros Ativos */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 font-medium">Membros Ativos</p>
              <p className="text-3xl font-bold mt-2">{ativos}</p>
              <p className="text-xs opacity-75 mt-1">{percentualAtivo}%</p>
            </div>
            <span className="text-4xl opacity-70">✅</span>
          </div>
        </div>

        {/* Dizimistas */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 font-medium">Dizimistas</p>
              <p className="text-3xl font-bold mt-2">{dizimistas}</p>
              <p className="text-xs opacity-75 mt-1">{percentualDizimista}%</p>
            </div>
            <span className="text-4xl opacity-70">💰</span>
          </div>
        </div>

        {/* Congregados */}
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 font-medium">Congregados</p>
              <p className="text-3xl font-bold mt-2">{tiposContagem.congregado}</p>
              <p className="text-xs opacity-75 mt-1">{percentualCongregado}%</p>
            </div>
            <span className="text-4xl opacity-70">🤝</span>
          </div>
        </div>
      </div>

      {/* Gráfico de Distribuição por Tipo de Cadastro */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span>📊</span> Distribuição por Tipo de Cadastro
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Membros */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-700">Membros</span>
              <span className="text-2xl">⛪</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">{tiposContagem.membro}</div>
            <div className="w-full bg-blue-200 rounded-full h-2 mt-3">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${(tiposContagem.membro / totalMembros) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {totalMembros > 0 ? ((tiposContagem.membro / totalMembros) * 100).toFixed(1) : 0}%
            </p>
          </div>

          {/* Congregados */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-700">Congregados</span>
              <span className="text-2xl">🤝</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{tiposContagem.congregado}</div>
            <div className="w-full bg-green-200 rounded-full h-2 mt-3">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all" 
                style={{ width: `${(tiposContagem.congregado / totalMembros) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {totalMembros > 0 ? ((tiposContagem.congregado / totalMembros) * 100).toFixed(1) : 0}%
            </p>
          </div>

          {/* Ministros */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-700">Ministros</span>
              <span className="text-2xl">🎓</span>
            </div>
            <div className="text-3xl font-bold text-purple-600">{tiposContagem.ministro}</div>
            <div className="w-full bg-purple-200 rounded-full h-2 mt-3">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all" 
                style={{ width: `${(tiposContagem.ministro / totalMembros) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {totalMembros > 0 ? ((tiposContagem.ministro / totalMembros) * 100).toFixed(1) : 0}%
            </p>
          </div>

          {/* Crianças */}
          <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-700">Crianças</span>
              <span className="text-2xl">👶</span>
            </div>
            <div className="text-3xl font-bold text-pink-600">{tiposContagem.crianca}</div>
            <div className="w-full bg-pink-200 rounded-full h-2 mt-3">
              <div 
                className="bg-pink-600 h-2 rounded-full transition-all" 
                style={{ width: `${(tiposContagem.crianca / totalMembros) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {totalMembros > 0 ? ((tiposContagem.crianca / totalMembros) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Gráfico de Cadastros por Mês */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span>📅</span> Cadastros por Mês (Últimos 12 Meses)
        </h3>
        
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosCadastros} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="mes" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value) => [`${value} cadastros`, 'Novos Cadastros']}
                labelStyle={{ color: '#374151' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
              <Bar 
                dataKey="cadastros" 
                fill="#3b82f6" 
                radius={[8, 8, 0, 0]}
                name="Novos Cadastros"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-gray-600">Total de Cadastros</p>
            <p className="text-2xl font-bold text-blue-600">{totalMembros}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <p className="text-gray-600">Mês com Mais Cadastros</p>
            <p className="text-2xl font-bold text-green-600">
              {Math.max(...dadosCadastros.map(d => d.cadastros))}
            </p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
            <p className="text-gray-600">Média por Mês</p>
            <p className="text-2xl font-bold text-purple-600">
              {dadosCadastros.length > 0 ? (totalMembros / 12).toFixed(1) : 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
