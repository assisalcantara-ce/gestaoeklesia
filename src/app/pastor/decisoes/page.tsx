'use client';

/**
 * /pastor/decisoes — Decisões Pendentes (Etapa 1: placeholder estrutural)
 *
 * Exibe lista básica de pendências.
 * Implementação funcional completa: Etapa 2.
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale, Clock } from 'lucide-react';
import PastorBottomNav from '@/components/pastor/PastorBottomNav';

export default function PastorDecisoesPage() {
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
          <h1 className="text-base font-black text-white leading-tight">Decisões Pendentes</h1>
          <p className="text-[11px] text-slate-400">Deliberações e pareceres</p>
        </div>
      </header>

      {/* Conteúdo — placeholder estrutural */}
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Scale size={28} className="text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Decisões Pendentes</h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
          Visualize e delibere sobre propostas de dirigentes, cartas ministeriais e solicitações da agenda.
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-amber-400/70">
          <Clock size={14} />
          Implementação completa: Etapa 2
        </div>
        <button
          onClick={() => router.push('/presidencia')}
          className="mt-4 text-xs font-semibold text-slate-400 hover:text-white underline cursor-pointer"
        >
          Acessar via Presidência →
        </button>
      </main>

      <PastorBottomNav />
    </div>
  );
}
