'use client';

import { Plus } from 'lucide-react';

interface CongregacoesToolbarProps {
  activeTab: string;
  nomeD1: string;
  nomeD2: string;
  nomeD3: string;
  showFormD1: boolean;
  showFormD2: boolean;
  showFormD3: boolean;
  planLimits: {
    max_divisao2: number;
    max_divisao3: number;
    planName: string;
  };
  divisoes2Length: number;
  divisoes3Length: number;
  onOpenNewD1: () => void;
  onOpenNewD2: () => void;
  onOpenNewD3: () => void;
}

export default function CongregacoesToolbar({
  activeTab,
  nomeD1,
  nomeD2,
  nomeD3,
  showFormD1,
  showFormD2,
  showFormD3,
  planLimits,
  divisoes2Length,
  divisoes3Length,
  onOpenNewD1,
  onOpenNewD2,
  onOpenNewD3,
}: CongregacoesToolbarProps) {
  if (activeTab === 'divisao1' && !showFormD3) {
    const isBlocked = planLimits.max_divisao3 === 0 || (planLimits.max_divisao3 > 0 && divisoes3Length >= planLimits.max_divisao3);
    return (
      <div className="mb-6 flex justify-end">
        <button
          onClick={onOpenNewD3}
          disabled={isBlocked}
          title={
            planLimits.max_divisao3 === 0
              ? `Plano atual não permite ${nomeD1}`
              : planLimits.max_divisao3 > 0 && divisoes3Length >= planLimits.max_divisao3
                ? `Limite do plano atingido (${planLimits.max_divisao3})`
                : undefined
          }
          className={`w-full sm:w-auto px-5 py-2.5 font-bold rounded-xl text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
            isBlocked
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 border border-emerald-700'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar {nomeD1}</span>
          {planLimits.max_divisao3 > 0 && (
            <span className="text-xs opacity-80">({divisoes3Length}/{planLimits.max_divisao3})</span>
          )}
          {planLimits.max_divisao3 === 0 && <span className="text-xs opacity-80">(bloqueado no plano)</span>}
        </button>
      </div>
    );
  }

  if (activeTab === 'divisao2' && !showFormD2) {
    const isBlocked = planLimits.max_divisao2 === 0 || (planLimits.max_divisao2 > 0 && divisoes2Length >= planLimits.max_divisao2);
    return (
      <div className="mb-6 flex justify-end">
        <button
          onClick={onOpenNewD2}
          disabled={isBlocked}
          title={
            planLimits.max_divisao2 === 0
              ? `Plano atual não permite ${nomeD2}`
              : planLimits.max_divisao2 > 0 && divisoes2Length >= planLimits.max_divisao2
                ? `Limite do plano atingido (${planLimits.max_divisao2})`
                : undefined
          }
          className={`w-full sm:w-auto px-5 py-2.5 font-bold rounded-xl text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
            isBlocked
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 border border-emerald-700'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar {nomeD2}</span>
          {planLimits.max_divisao2 > 0 && (
            <span className="text-xs opacity-80">({divisoes2Length}/{planLimits.max_divisao2})</span>
          )}
          {planLimits.max_divisao2 === 0 && <span className="text-xs opacity-80">(bloqueado no plano)</span>}
        </button>
      </div>
    );
  }

  if (activeTab === 'divisao3' && !showFormD1) {
    return (
      <div className="mb-6 flex justify-end">
        <button
          onClick={onOpenNewD1}
          className="w-full sm:w-auto px-5 py-2.5 font-bold rounded-xl text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 border border-emerald-700 cursor-pointer active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar {nomeD3}</span>
        </button>
      </div>
    );
  }

  return null;
}
