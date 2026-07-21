'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { Calendar, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';

export interface CrmNextActionData {
  id: string;
  oportunidadeId: string;
  ministryId: string | null;
  nome: string;
  acao: string;
  prioridade: 'baixa' | 'media' | 'alta' | string;
  vencimento: string;
  lifecycle: {
    status: string;
    daysRemaining?: number;
    reason: string;
  };
}

export default function CrmNextActions() {
  const [actions, setActions] = useState<CrmNextActionData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchActions() {
      try {
        const res = await authenticatedFetch('/api/v1/admin/crm/next-actions');
        if (!res.ok) {
          throw new Error('Erro ao carregar próximas ações comerciais');
        }
        const data = await res.json();
        setActions(data);
      } catch (err: any) {
        setError(err instanceof Error ? err : new Error(err?.message || 'Erro desconhecido'));
      } finally {
        setLoading(false);
      }
    }

    fetchActions();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-xl border border-gray-700/50"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-950/30 border border-red-900/50 text-red-400 rounded-xl text-sm">
        Erro ao obter próximas ações comerciais.
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-gray-800 rounded-xl text-center">
        <ShieldAlert className="h-10 w-10 text-gray-500 mb-2" />
        <h4 className="text-white font-semibold text-sm">Nenhuma ação pendente</h4>
        <p className="text-gray-400 text-xs mt-1">Todos os contatos e negociações estão em dia!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-950 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Calendar className="text-blue-500 h-4 w-4" />
          Próximas Ações do Comercial
        </h3>
        <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-900 font-bold px-2 py-0.5 rounded-full">
          {actions.length} pendentes
        </span>
      </div>

      <div className="divide-y divide-gray-800">
        {actions.map((act) => {
          const isAlta = act.prioridade === 'alta';
          const statusColors: Record<string, string> = {
            LEAD: 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/50',
            TRIAL: 'bg-sky-950/40 text-sky-400 border border-sky-900/50',
            TRIAL_EXPIRING: 'bg-amber-950/40 text-amber-400 border border-amber-900/50',
            PAYMENT_PENDING: 'bg-rose-950/40 text-rose-400 border border-rose-900/50',
            NEGOTIATION: 'bg-violet-950/40 text-violet-400 border border-violet-900/50',
            RENEWAL: 'bg-amber-950/40 text-amber-400 border border-amber-900/50'
          };

          return (
            <div key={act.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-900/50 transition">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{act.nome}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[act.lifecycle.status] || 'bg-gray-800 text-gray-400'}`}>
                    {act.lifecycle.status}
                  </span>
                </div>
                <p className="text-gray-400 text-xs flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />
                  <span className="font-medium text-gray-300">{act.acao}</span>
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold shrink-0">
                <span className="text-gray-500 text-[11px] font-medium">
                  Vence em: {new Date(act.vencimento).toLocaleDateString('pt-BR')}
                </span>

                <div className="flex items-center gap-1">
                  {isAlta ? (
                    <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/30 border border-rose-900/40 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      <AlertTriangle className="h-3 w-3 text-rose-500" />
                      urgente
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 bg-gray-800/80 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      média
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
