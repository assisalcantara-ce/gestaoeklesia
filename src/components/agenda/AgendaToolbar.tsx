'use client';

import { ChevronLeft, ChevronRight, Filter, ChevronDown, ChevronUp } from 'lucide-react';

export type QuickFilter = 'todos' | 'oficiais' | 'locais' | 'bloqueados';

export interface AgendaTipo {
  id: string;
  nome: string;
  categoria: string;
}

export interface Congregacao {
  id: string;
  nome: string;
}

interface AgendaToolbarProps {
  activeTab: string;
  currentMonth: number;
  currentYear: number;
  MESES_PT: string[];
  quickFilter: QuickFilter;
  showAdvancedFilters: boolean;
  filtroTipoId: string;
  filtroCongregacao: string;
  filtroVisibilidade: string;
  tiposAgrupados: Record<string, AgendaTipo[]>;
  CATEGORIAS_LABEL: Record<string, string>;
  congregacoes: Congregacao[];
  orgHelper: any;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
  onQuickFilterChange: (filter: QuickFilter) => void;
  onToggleAdvancedFilters: () => void;
  onFiltroTipoChange: (val: string) => void;
  onFiltroCongregacaoChange: (val: string) => void;
  onFiltroVisibilidadeChange: (val: string) => void;
}

export default function AgendaToolbar({
  activeTab,
  currentMonth,
  currentYear,
  MESES_PT,
  quickFilter,
  showAdvancedFilters,
  filtroTipoId,
  filtroCongregacao,
  filtroVisibilidade,
  tiposAgrupados,
  CATEGORIAS_LABEL,
  congregacoes,
  orgHelper,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
  onQuickFilterChange,
  onToggleAdvancedFilters,
  onFiltroTipoChange,
  onFiltroCongregacaoChange,
  onFiltroVisibilidadeChange,
}: AgendaToolbarProps) {
  if (activeTab !== 'calendario') return null;

  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        {/* Navegação de Mês/Ano compacta */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200/70 shadow-xs">
          <button onClick={onPrevMonth} className="px-2 py-1 hover:bg-slate-50 rounded text-slate-700 text-xs font-black transition">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-black text-slate-800 px-1.5 min-w-[110px] text-center">
            {MESES_PT[currentMonth - 1].toUpperCase()} {currentYear}
          </span>
          <button onClick={onNextMonth} className="px-2 py-1 hover:bg-slate-50 rounded text-slate-700 text-xs font-black transition">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filtros Rápidos (Pills compactos) */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={onGoToToday}
            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/70 rounded-lg text-xs font-bold transition shrink-0 shadow-xs"
          >
            Hoje
          </button>
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'oficiais', label: '🔵 Oficiais' },
            { key: 'locais', label: '🟢 Locais' },
            { key: 'bloqueados', label: '🔴 Gerenciados' },
          ] as { key: QuickFilter; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => onQuickFilterChange(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition shrink-0 ${
                quickFilter === f.key
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-600 border-slate-200/70 hover:border-slate-300 shadow-xs'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Trigger Filtros Avançados */}
        <button
          onClick={onToggleAdvancedFilters}
          className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-bold transition ${
            showAdvancedFilters || filtroTipoId || filtroCongregacao || filtroVisibilidade
              ? 'border-blue-200 text-blue-600 bg-blue-50'
              : 'border-slate-200/70 text-slate-500 bg-white hover:bg-slate-50 shadow-xs'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {showAdvancedFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Filtros Avançados Recolhíveis */}
      {showAdvancedFilters && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo de Compromisso</label>
            <select
              value={filtroTipoId}
              onChange={(e) => onFiltroTipoChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
            >
              <option value="">Todos</option>
              {Object.entries(tiposAgrupados).map(([categoria, lista]) => {
                if (lista.length === 0) return null;
                return (
                  <optgroup key={categoria} label={CATEGORIAS_LABEL[categoria as keyof typeof CATEGORIAS_LABEL] || categoria}>
                    {lista.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {orgHelper ? orgHelper.label('divisao1') : 'Congregação'}
            </label>
            <select
              value={filtroCongregacao}
              onChange={(e) => onFiltroCongregacaoChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
            >
              <option value="">Todas</option>
              {congregacoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Visibilidade</label>
            <select
              value={filtroVisibilidade}
              onChange={(e) => onFiltroVisibilidadeChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
            >
              <option value="">Todas</option>
              <option value="privado">Privado</option>
              <option value="lideranca">Liderança</option>
              <option value="igreja">Membros</option>
              <option value="ministerio">Ministério</option>
              <option value="publico">Público</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
