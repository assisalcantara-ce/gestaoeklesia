'use client';

/**
 * /pastor/indicadores — Crescimento da Igreja / Indicadores Espirituais
 * (Etapa 1: placeholder estrutural)
 *
 * Implementação funcional completa: Etapa 2.
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart2, Clock } from 'lucide-react';
import PastorBottomNav from '@/components/pastor/PastorBottomNav';

export default function PastorIndicadoresPage() {
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
          <h1 className="text-base font-black text-white leading-tight">Crescimento da Igreja</h1>
          <p className="text-[11px] text-slate-400">Membros, almas, batismos e reconciliações</p>
        </div>
      </header>

      {/* Conteúdo — placeholder estrutural */}
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <BarChart2 size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Indicadores Espirituais</h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
          Acompanhe o crescimento da igreja: membros, almas alcançadas, batismos no Espírito Santo,
          reconciliações e visitantes.
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-emerald-400/70">
          <Clock size={14} />
          Implementação completa: Etapa 2
        </div>
        <button
          onClick={() => router.push('/secretaria/relatorio-espiritual')}
          className="mt-4 text-xs font-semibold text-slate-400 hover:text-white underline cursor-pointer"
        >
          Ver Livro Espiritual →
        </button>
      </main>

      <PastorBottomNav />
    </div>
  );
}
