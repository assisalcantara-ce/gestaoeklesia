'use client';

import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { NivelAcesso } from '@/hooks/usePermissions';
import { getCargosMinisteriais } from '@/lib/cargos-utils';

interface Membro {
  id: string;
  nome: string;
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';
  status: 'ativo' | 'inativo';
  congregacao?: string;
  dizimista?: boolean;
  dataCadastro?: string | Date;
  cargoMinisterial?: string;
}

interface MembrosOverviewProps {
  membros: Membro[];
  nivelUsuario?: NivelAcesso;
  congregacaoUsuario?: string;
  supervisaoUsuario?: string;
  maxMembros?: number;
}

const CARGO_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#a855f7',
];

export default function MembrosOverview({
  membros,
  nivelUsuario = 'administrador',
  congregacaoUsuario,
  supervisaoUsuario,
  maxMembros = 0,
}: MembrosOverviewProps) {
  const [membrosFiltrados, setMembrosFiltrados] = useState<Membro[]>(membros);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let filtrados = membros;
    if (nivelUsuario === 'operador' && congregacaoUsuario) {
      filtrados = membros.filter(m => m.congregacao === congregacaoUsuario);
    }
    setMembrosFiltrados(filtrados);
  }, [membros, nivelUsuario, congregacaoUsuario, supervisaoUsuario]);

  const totalMembros = membrosFiltrados.length;
  const ativos = membrosFiltrados.filter(m => m.status === 'ativo').length;
  const inativos = membrosFiltrados.filter(m => m.status === 'inativo').length;

  const percentualAtivo = totalMembros > 0 ? ((ativos / totalMembros) * 100).toFixed(1) : '0';
  const percentualInativo = totalMembros > 0 ? ((inativos / totalMembros) * 100).toFixed(1) : '0';

  const pctPlano = maxMembros > 0 ? Math.min(100, Math.round((totalMembros / maxMembros) * 100)) : 0;
  const planoBarColor = pctPlano >= 90 ? '#fca5a5' : pctPlano >= 70 ? '#fde68a' : '#ffffff';
  const planoCardFrom = pctPlano >= 90 ? 'from-red-700' : pctPlano >= 70 ? 'from-amber-500' : 'from-red-500';
  const planoCardTo   = pctPlano >= 90 ? 'to-red-800'   : pctPlano >= 70 ? 'to-amber-600'  : 'to-red-600';

  const cargos = getCargosMinisteriais().filter((c: any) => c.ativo);
  const cargoStats = cargos.map((cargo: any, idx: number) => {
    const count = membrosFiltrados.filter(m => {
      const cm = (m.cargoMinisterial || '').toUpperCase().trim();
      return cm === cargo.nome.toUpperCase().trim();
    }).length;
    return { nome: cargo.nome, count, color: CARGO_COLORS[idx % CARGO_COLORS.length] };
  }).filter((c: any) => c.count > 0);

  const semCargo = membrosFiltrados.filter(m => !m.cargoMinisterial || m.cargoMinisterial.trim() === '').length;
  if (semCargo > 0) {
    cargoStats.push({ nome: 'Sem Cargo', count: semCargo, color: '#9ca3af' });
  }

  const scrollSlider = (dir: 'left' | 'right') => {
    const el = sliderRef.current;
    if (!el) return;
    el.scrollLeft += dir === 'left' ? -220 : 220;
  };

  const gerarDadosCadastrosPorMes = () => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const hoje = new Date();
    const dados: { mes: string; cadastros: number; mesNum: number; anoNum: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      dados.push({
        mes: `${meses[data.getMonth()]}/${data.getFullYear().toString().slice(-2)}`,
        cadastros: 0,
        mesNum: data.getMonth() + 1,
        anoNum: data.getFullYear(),
      });
    }

    membrosFiltrados.forEach(membro => {
      if (membro.dataCadastro) {
        const dataCadastro = new Date(membro.dataCadastro);
        const mesIdx = dados.findIndex(
          d => d.mesNum === dataCadastro.getMonth() + 1 && d.anoNum === dataCadastro.getFullYear()
        );
        if (mesIdx !== -1) dados[mesIdx].cadastros++;
      }
    });

    return dados;
  };

  const dadosCadastros = gerarDadosCadastrosPorMes();

  return (
    <div className="space-y-6">
      {/* Cards de Estatisticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 font-medium">Total de Ministros</p>
              <p className="text-3xl font-bold mt-2">{totalMembros}</p>
            </div>
            <svg className="w-10 h-10 opacity-60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </div>
        </div>

        {/* Ativos */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 font-medium">Ministros Ativos</p>
              <p className="text-3xl font-bold mt-2">{ativos}</p>
              <p className="text-xs opacity-75 mt-1">{percentualAtivo}% do total</p>
            </div>
            <svg className="w-10 h-10 opacity-60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
        </div>

        {/* Inativos */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 font-medium">Ministros Inativos</p>
              <p className="text-3xl font-bold mt-2">{inativos}</p>
              <p className="text-xs opacity-75 mt-1">{percentualInativo}% do total</p>
            </div>
            <svg className="w-10 h-10 opacity-60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </div>
        </div>

        {/* Uso de Cadastros */}
        <div className={`bg-gradient-to-br ${planoCardFrom} ${planoCardTo} text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition`}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm opacity-90 font-medium">Uso de Cadastros</p>
              <p className="text-3xl font-bold mt-2">
                {totalMembros}
                {maxMembros > 0 && <span className="text-lg font-normal opacity-80"> / {maxMembros}</span>}
              </p>
              {maxMembros > 0 ? (
                <>
                  <p className="text-xs opacity-75 mt-1">{pctPlano}% do plano utilizado</p>
                  <div className="w-full bg-white/30 rounded-full h-2 mt-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${pctPlano}%`, backgroundColor: planoBarColor }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs opacity-75 mt-1">Sem limite definido</p>
              )}
            </div>
            <svg className="w-10 h-10 opacity-60 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Slider de Cargos */}
      {cargoStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              Distribuicao por Cargo Ministerial
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => scrollSlider('left')}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition text-gray-600 font-bold text-sm select-none"
              >&#9664;</button>
              <button
                onClick={() => scrollSlider('right')}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition text-gray-600 font-bold text-sm select-none"
              >&#9654;</button>
            </div>
          </div>

          <div
            ref={sliderRef}
            className="flex gap-4 pb-2"
            style={{
              overflowX: 'scroll',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            } as React.CSSProperties}
          >
            {cargoStats.map((cargo: any) => {
              const pct = totalMembros > 0 ? ((cargo.count / totalMembros) * 100).toFixed(1) : '0';
              return (
                <div
                  key={cargo.nome}
                  className="flex-none w-44 p-4 rounded-lg border"
                  style={{ borderColor: cargo.color + '60', backgroundColor: cargo.color + '12' }}
                >
                  <p className="font-semibold text-gray-700 text-sm truncate mb-2">{cargo.nome}</p>
                  <p className="text-3xl font-bold" style={{ color: cargo.color }}>{cargo.count}</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cargo.color }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grafico por Mes */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6">
          Cadastros por Mes (Ultimos 12 Meses)
        </h3>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosCadastros} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                formatter={(value: any) => [`${value} cadastros`, 'Novos Cadastros']}
                labelStyle={{ color: '#374151' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="rect" />
              <Bar dataKey="cadastros" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Novos Cadastros" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-gray-600">Total de Cadastros</p>
            <p className="text-2xl font-bold text-blue-600">{totalMembros}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <p className="text-gray-600">Mes com Mais Cadastros</p>
            <p className="text-2xl font-bold text-green-600">
              {Math.max(0, ...dadosCadastros.map((d: any) => d.cadastros))}
            </p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
            <p className="text-gray-600">Media por Mes</p>
            <p className="text-2xl font-bold text-purple-600">
              {(totalMembros / 12).toFixed(1)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
