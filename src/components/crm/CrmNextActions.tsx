'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CreditCard, 
  RefreshCw, 
  UserPlus, 
  ArrowUpRight, 
  Sparkles,
  Inbox
} from 'lucide-react';

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
  const router = useRouter();
  const [actions, setActions] = useState<CrmNextActionData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchActions() {
      try {
        const res = await authenticatedFetch('/api/v1/admin/crm/next-actions');
        if (!res.ok) {
          throw new Error('Erro ao carregar fila de trabalho comercial');
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

  const getTaskCategory = (status: string) => {
    switch (status) {
      case 'TRIAL_EXPIRING':
        return {
          titulo: 'Trial Expirando',
          icon: <Clock className="h-4 w-4 text-amber-400" />,
          badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
          route: '/admin/ministerios'
        };
      case 'TRIAL_EXPIRED':
        return {
          titulo: 'Trial Expirado',
          icon: <AlertTriangle className="h-4 w-4 text-rose-400" />,
          badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
          route: '/admin/ministerios'
        };
      case 'PAYMENT_PENDING':
        return {
          titulo: 'Cobrança Pendente',
          icon: <CreditCard className="h-4 w-4 text-rose-400" />,
          badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
          route: '/admin/pagamentos'
        };
      case 'RENEWAL':
        return {
          titulo: 'Renovação Próxima',
          icon: <RefreshCw className="h-4 w-4 text-sky-400" />,
          badgeClass: 'bg-sky-950/60 text-sky-300 border-sky-800/80',
          route: '/admin/ministerios'
        };
      case 'LEAD':
        return {
          titulo: 'Novo Lead em Onboarding',
          icon: <UserPlus className="h-4 w-4 text-indigo-400" />,
          badgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80',
          route: '/admin/comercial/oportunidades'
        };
      default:
        return {
          titulo: 'Atendimento Pendente',
          icon: <Sparkles className="h-4 w-4 text-blue-400" />,
          badgeClass: 'bg-blue-950/60 text-blue-300 border-blue-800/80',
          route: '/admin/comercial'
        };
    }
  };

  const handleOpenTask = (act: CrmNextActionData, defaultRoute: string) => {
    // Se existir ID de ministério ou oportunidade, navega para a página de gestão
    if (act.ministryId) {
      router.push(`/admin/ministerios?id=${encodeURIComponent(act.ministryId)}`);
    } else {
      router.push(defaultRoute);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="h-5 w-40 bg-gray-900 rounded animate-pulse"></div>
          <div className="h-5 w-20 bg-gray-900 rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-900/60 border border-gray-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-2xl text-xs flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Erro ao obter a fila de trabalho comercial. Tente recarregar a página.</span>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-8 text-center shadow-xl space-y-3">
        <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
          <Inbox className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">Fila de Trabalho Vazia</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Excelente! Nenhuma tarefa de trial, cobrança ou renovação pendente no momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
      
      {/* Header do Card */}
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-950/60 border border-blue-900/60 rounded-xl text-blue-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Fila de Trabalho Comercial</h3>
            <p className="text-[11px] text-gray-400">Próximas ações prioritárias para atendimento</p>
          </div>
        </div>
        <span className="text-[11px] bg-blue-950/80 text-blue-300 border border-blue-900 font-bold px-3 py-1 rounded-full shadow-xs">
          {actions.length} {actions.length === 1 ? 'tarefa' : 'tarefas'}
        </span>
      </div>

      {/* Lista de Tarefas (Work Queue) */}
      <div className="divide-y divide-gray-800/80">
        {actions.map((act) => {
          const category = getTaskCategory(act.lifecycle.status);
          const isAlta = act.prioridade === 'alta';

          return (
            <div 
              key={act.id} 
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-900/40 transition group"
            >
              {/* Informações da Tarefa */}
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl shrink-0 mt-0.5 group-hover:border-gray-700 transition">
                  {category.icon}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition truncate">
                      {category.titulo}
                    </h4>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${category.badgeClass}`}>
                      {act.nome}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">
                    <span className="font-semibold text-gray-300">{act.acao}</span>
                    {act.lifecycle.reason && (
                      <span className="text-gray-500 block text-[11px] mt-0.5">
                        {act.lifecycle.reason}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Lado Direito: Vencimento + Prioridade + Botão Abrir */}
              <div className="flex items-center gap-3.5 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-800/60">
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Vencimento</span>
                  <span className="text-xs font-semibold text-gray-300">
                    {new Date(act.vencimento).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  isAlta
                    ? 'bg-rose-950/60 text-rose-400 border-rose-900/60'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
                }`}>
                  {act.prioridade}
                </span>

                <button
                  onClick={() => handleOpenTask(act, category.route)}
                  className="px-3.5 py-1.5 bg-gray-900 hover:bg-blue-600 text-gray-300 hover:text-white border border-gray-800 hover:border-blue-500 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  Abrir
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
