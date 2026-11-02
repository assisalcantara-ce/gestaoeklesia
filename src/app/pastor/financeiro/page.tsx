'use client';

/**
 * /pastor/financeiro — Financeiro Consolidado
 * (Etapa 1: placeholder estrutural)
 *
 * Implementação funcional completa: Etapa 2.
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft, DollarSign, Clock } from 'lucide-react';
import PastorBottomNav from '@/components/pastor/PastorBottomNav';

export default function PastorFinanceiroPage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a1628] text-slate-100 pb-24">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 border-b border-slate-800/60 bg-[#0d1f3c]"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)',
          paddingBottom: '16px',
        }}
      >
        <button
          onClick={() => router.push('/pastor')}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-black text-white leading-tight">Financeiro Consolidado</h1>
          <p className="text-[11px] text-slate-400">Saldo, entradas e saídas do ministério</p>
        </div>
      </header>

      {/* Conteúdo — placeholder estrutural */}
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <DollarSign size={28} className="text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Financeiro Consolidado</h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
          Acompanhe o saldo do mês, entradas, saídas e a evolução financeira do ministério nos últimos 6 meses.
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-blue-400/70">
          <Clock size={14} />
          Implementação completa: Etapa 2
        </div>
        <button
          onClick={() => router.push('/presidencia/consolidado-financeiro')}
          className="mt-4 text-xs font-semibold text-slate-400 hover:text-white underline cursor-pointer"
        >
          Ver Consolidado Financeiro →
        </button>
      </main>

      <PastorBottomNav />
    </div>
  );
}
