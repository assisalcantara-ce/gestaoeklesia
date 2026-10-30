'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginacaoEscala } from '@/hooks/secretaria/useEscalaPregadores';

interface EscalaPaginacaoProps {
  paginacao: PaginacaoEscala;
  onChangePagina: (novaPagina: number) => void;
  loading?: boolean;
}

export function EscalaPaginacao({
  paginacao,
  onChangePagina,
  loading = false,
}: EscalaPaginacaoProps) {
  const { pagina, itensPorPagina, total, totalPaginas } = paginacao;

  if (total === 0) {
    return null;
  }

  const inicio = (pagina - 1) * itensPorPagina + 1;
  const fim = Math.min(pagina * itensPorPagina, total);

  const temAnterior = pagina > 1;
  const temProxima = pagina < totalPaginas;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
      {/* Texto de intervalo e total */}
      <div className="text-xs sm:text-sm text-slate-600">
        Mostrando <span className="font-semibold text-slate-900">{inicio}</span> a{' '}
        <span className="font-semibold text-slate-900">{fim}</span> de{' '}
        <span className="font-semibold text-slate-900">{total}</span> cultos cadastrados
      </div>

      {/* Controles de navegação */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChangePagina(pagina - 1)}
          disabled={!temAnterior || loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Anterior</span>
        </button>

        <div className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg">
          Página <span className="text-blue-600">{pagina}</span> de{' '}
          <span>{Math.max(1, totalPaginas)}</span>
        </div>

        <button
          type="button"
          onClick={() => onChangePagina(pagina + 1)}
          disabled={!temProxima || loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Próxima página"
        >
          <span>Próxima</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
