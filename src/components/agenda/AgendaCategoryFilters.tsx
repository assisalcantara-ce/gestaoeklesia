'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import {
  CATEGORIES_CONFIG,
  AgendaCategoryKey,
  getEventoCategoryKey,
} from '@/lib/agenda-visual-utils';
import { AgendaEvento } from '@/hooks/agenda/useAgenda';

interface AgendaCategoryFiltersProps {
  eventos: AgendaEvento[];
  selectedCategory: AgendaCategoryKey;
  onSelectCategory: (key: AgendaCategoryKey) => void;
  isEscritaPermitida?: boolean;
  onNovoEvento?: () => void;
}

export default function AgendaCategoryFilters({
  eventos,
  selectedCategory,
  onSelectCategory,
  isEscritaPermitida = false,
  onNovoEvento,
}: AgendaCategoryFiltersProps) {
  // Contagem real dos eventos por categoria
  const counts = React.useMemo(() => {
    const map: Record<AgendaCategoryKey, number> = {
      todos: eventos.length,
      culto: 0,
      reuniao: 0,
      ebd: 0,
      departamento: 0,
      congresso: 0,
      outro: 0,
    };

    eventos.forEach((evt) => {
      const cat = getEventoCategoryKey(evt);
      map[cat] = (map[cat] || 0) + 1;
    });

    return map;
  }, [eventos]);

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 w-full">
      {/* Cards de Filtros Horizontais distribuídos proporcionalmente */}
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 w-full">
          {CATEGORIES_CONFIG.map((cat) => {
            const Icon = cat.icon;
            const count = counts[cat.key] || 0;
            const isSelected = selectedCategory === cat.key;

            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => onSelectCategory(cat.key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border transition-all cursor-pointer text-left select-none w-full h-[62px] ${
                  cat.bgClass
                } ${cat.borderClass} ${
                  isSelected
                    ? `${cat.activeRingClass} shadow-xs`
                    : 'shadow-2xs hover:shadow-xs'
                }`}
              >
                {/* Ícone com container suave reforçado */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border border-white/60"
                  style={{
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.85)',
                    color: cat.color,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Título e Quantidade Real */}
                <div className="min-w-0 flex-1">
                  <span
                    className={`text-xs font-bold block leading-tight truncate ${cat.textClass}`}
                  >
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold block leading-tight mt-0.5 truncate">
                    {count} {count === 1 ? 'evento' : 'eventos'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Botão + Novo Evento */}
      {isEscritaPermitida && onNovoEvento && (
        <button
          type="button"
          onClick={onNovoEvento}
          className="bg-[#1d4ed8] hover:bg-[#1e40af] active:bg-[#1e3a8a] text-white font-bold rounded-2xl px-5 h-[62px] text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span className="whitespace-nowrap">Novo Evento</span>
        </button>
      )}
    </div>
  );
}
