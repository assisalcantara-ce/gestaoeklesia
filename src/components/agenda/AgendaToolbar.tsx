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
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Navegação de Mês/Ano */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl p-1 shadow-xs">
          <button
            onClick={onPrevMonth}
            className="p-1.5 hover:bg-white rounded-lg text-slate-700 hover:text-slate-900 transition cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs sm:text-sm font-black text-slate-900 px-2 min-w-[130px] text-center tracking-tight">
            {MESES_PT[currentMonth - 1].toUpperCase()} {currentYear}
          </span>
          <button
            onClick={onNextMonth}
            className="p-1.5 hover:bg-white rounded-lg text-slate-700 hover:text-slate-900 transition cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Filtros Rápidos (Pills) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={onGoToToday}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shrink-0 shadow-xs cursor-pointer"
          >
            Hoje
          </button>
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'oficiais', label: '🔵 Oficiais' },
            { key: 'locais', label: '🟢 Locais' },
            { key: 'bloqueados', label: '🔴 Gerenciados' },
          ] as { key: QuickFilter; label: string }[]).map(f => {
            const isSelected = quickFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onQuickFilterChange(f.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-700 text-white border-teal-800 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Trigger Filtros Avançados */}
        <button
          onClick={onToggleAdvancedFilters}
          className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
            showAdvancedFilters || filtroTipoId || filtroCongregacao || filtroVisibilidade
              ? 'border-teal-700 text-teal-800 bg-teal-50'
              : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span>Filtros avançados</span>
          {showAdvancedFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Filtros Avançados Recolhíveis */}
      {showAdvancedFilters && (
        <div className="pt-4 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Tipo de Compromisso
            </label>
            <select
              value={filtroTipoId}
              onChange={(e) => onFiltroTipoChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
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
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              {orgHelper ? orgHelper.label('divisao1') : 'Congregação'}
            </label>
            <select
              value={filtroCongregacao}
              onChange={(e) => onFiltroCongregacaoChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
            >
              <option value="">Todas</option>
              {congregacoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Visibilidade
            </label>
            <select
              value={filtroVisibilidade}
              onChange={(e) => onFiltroVisibilidadeChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
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
