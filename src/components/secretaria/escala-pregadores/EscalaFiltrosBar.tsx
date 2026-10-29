'use client';

import React from 'react';
import { Search, Calendar, Church, Filter, RefreshCw } from 'lucide-react';
import { FiltrosEscalaState } from '@/hooks/secretaria/useEscalaPregadores';

interface EscalaFiltrosBarProps {
  filtros: FiltrosEscalaState;
  setFiltros: React.Dispatch<React.SetStateAction<FiltrosEscalaState>>;
  congregacoes: { id: string; nome: string; is_sede?: boolean }[];
  isGlobalUser: boolean;
  loading: boolean;
  onRefresh: () => void;
}

export function EscalaFiltrosBar({
  filtros,
  setFiltros,
  congregacoes,
  isGlobalUser,
  loading,
  onRefresh,
}: EscalaFiltrosBarProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 transition-all">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
        {/* Mês de Referência */}
        <div className="lg:col-span-3">
          <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            Mês de Referência
          </label>
          <input
            type="month"
            value={filtros.anoMes}
            onChange={(e) =>
              setFiltros((prev) => ({
                ...prev,
                anoMes: e.target.value,
                semanaInicio: undefined,
                semanaFim: undefined,
              }))
            }
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>

        {/* Congregação (Desabilitada/Oculta se não for global) */}
        <div className="lg:col-span-4">
          <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
            <Church className="w-3.5 h-3.5 text-blue-600" />
            Congregação
          </label>
          <select
            value={filtros.churchId}
            disabled={!isGlobalUser}
            onChange={(e) => setFiltros((prev) => ({ ...prev, churchId: e.target.value }))}
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isGlobalUser && <option value="">Todas as Congregações (Campo Geral)</option>}
            {congregacoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} {c.is_sede ? '(Sede)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Busca por Título de Culto / Evento */}
        <div className="lg:col-span-3">
          <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-blue-600" />
            Buscar Culto / Evento
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Ex: Culto da Família, Santa Ceia..."
              value={filtros.filtroTitulo}
              onChange={(e) => setFiltros((prev) => ({ ...prev, filtroTitulo: e.target.value }))}
              className="w-full text-sm rounded-lg border border-slate-300 pl-8 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Botão de Atualizar */}
        <div className="lg:col-span-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Linha secundária de filtro: checkbox Apenas sem Pregador */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={filtros.apenasSemPregador}
            onChange={(e) => setFiltros((prev) => ({ ...prev, apenasSemPregador: e.target.checked }))}
            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 rounded"
          />
          <span className="font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
            Mostrar apenas cultos sem pregador escalado
          </span>
        </label>

        <span className="text-slate-400 flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Datas e horários em horário oficial (America/Belém - UTC−3)
        </span>
      </div>
    </div>
  );
}
