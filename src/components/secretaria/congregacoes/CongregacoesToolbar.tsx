'use client';

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
        className={`mb-6 w-full px-6 py-3 font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2 ${
          isBlocked ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-teal-500 text-white hover:bg-teal-600'
        }`}
      >
        <span className="md:hidden">+ {nomeD1}</span>
        <span className="hidden md:inline">+ Adicionar {nomeD1}</span>
        {planLimits.max_divisao3 > 0 && (
          <span className="text-xs opacity-80">({divisoes3Length}/{planLimits.max_divisao3})</span>
        )}
        {planLimits.max_divisao3 === 0 && <span className="text-xs opacity-80">(bloqueado no plano)</span>}
      </button>
    );
  }

  if (activeTab === 'divisao2' && !showFormD2) {
    const isBlocked = planLimits.max_divisao2 === 0 || (planLimits.max_divisao2 > 0 && divisoes2Length >= planLimits.max_divisao2);
    return (
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
        className={`mb-6 w-full px-6 py-3 font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2 ${
          isBlocked ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-teal-500 text-white hover:bg-teal-600'
        }`}
      >
        <span className="md:hidden">+ {nomeD2}</span>
        <span className="hidden md:inline">+ Adicionar {nomeD2}</span>
        {planLimits.max_divisao2 > 0 && (
          <span className="text-xs opacity-80">({divisoes2Length}/{planLimits.max_divisao2})</span>
        )}
        {planLimits.max_divisao2 === 0 && <span className="text-xs opacity-80">(bloqueado no plano)</span>}
      </button>
    );
  }

  if (activeTab === 'divisao3' && !showFormD1) {
    return (
      <button
        onClick={onOpenNewD1}
        className="mb-6 w-full px-6 py-3 font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2 bg-teal-500 text-white hover:bg-teal-600"
      >
        <span className="md:hidden">+ {nomeD3}</span>
        <span className="hidden md:inline">+ Adicionar {nomeD3}</span>
      </button>
    );
  }

  return null;
}
