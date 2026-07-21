'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/api-client';
import { 
  Building2, 
  User, 
  Calendar, 
  ArrowRight, 
  AlertCircle, 
  ExternalLink, 
  Sparkles,
  Inbox
} from 'lucide-react';
import CrmActivityDrawer from './CrmActivityDrawer';

export interface CrmActivityData {
  id: string;
  oportunidadeId: string;
  ministryId: string | null;
  nome: string;
  responsavel: string;
  status: string;
  prioridade: string;
  dataCriacao: string;
  ultimaAtualizacao: string;
  email?: string;
  telefone?: string;
  origem?: string;
  nextAction?: {
    acao: string;
    prioridade: string;
    vencimento: string;
  };
  lifecycle?: {
    status: string;
    plano?: string;
    statusFinanceiro?: string;
    daysRemaining?: number;
    reason: string;
  };
}

interface CrmActivitiesProps {
  onRefresh?: () => void;
}

export default function CrmActivities({ onRefresh }: CrmActivitiesProps = {}) {
  const router = useRouter();
  const [activities, setActivities] = useState<CrmActivityData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<CrmActivityData | null>(null);

  const fetchActivities = async () => {
    try {
      const res = await authenticatedFetch('/api/v1/admin/crm/activities');
      if (!res.ok) {
        throw new Error('Erro ao carregar oportunidades ativas');
      }
      const data = await res.json();
      setActivities(data || []);
      // Se tiver uma atividade selecionada no Drawer, atualizar o objeto em tempo real
      if (selectedActivity) {
        const updated = data.find((a: CrmActivityData) => a.id === selectedActivity.id);
        if (updated) setSelectedActivity(updated);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleSuccess = () => {
    fetchActivities();
    onRefresh?.();
  };

  // ORDENAÇÃO ESTRITA:
  // 1. Alta prioridade
  // 2. Próxima ação vencida
  // 3. Próxima ação mais próxima
  // 4. Data de criação mais recente
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      // 1. Prioridade (Alta primeiro)
      const weightA = a.prioridade === 'alta' ? 3 : a.prioridade === 'media' ? 2 : 1;
      const weightB = b.prioridade === 'alta' ? 3 : b.prioridade === 'media' ? 2 : 1;
      if (weightB !== weightA) return weightB - weightA;

      // 2. Próxima ação vencida (vencimento < hoje)
      const now = Date.now();
      const vencA = a.nextAction ? new Date(a.nextAction.vencimento).getTime() : Infinity;
      const vencB = b.nextAction ? new Date(b.nextAction.vencimento).getTime() : Infinity;
      const isVencidoA = vencA < now;
      const isVencidoB = vencB < now;
      if (isVencidoA !== isVencidoB) return isVencidoA ? -1 : 1;

      // 3. Próxima ação mais próxima
      if (vencA !== vencB) return vencA - vencB;

      // 4. Data de criação mais recente
      return new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime();
    });
  }, [activities]);

  if (loading) {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="h-5 w-48 bg-gray-900 rounded animate-pulse"></div>
          <div className="h-5 w-24 bg-gray-900 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-900/60 border border-gray-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-2xl text-xs flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Erro ao carregar oportunidades prioritárias do CRM.</span>
      </div>
    );
  }

  if (sortedActivities.length === 0) {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-8 text-center shadow-xl space-y-3">
        <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
          <Inbox className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">Oportunidades em Dia</h4>
          <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center justify-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Excelente! Não existem oportunidades críticas neste momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
      
      {/* Header do Painel */}
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-950/60 border border-blue-900/60 rounded-xl text-blue-400">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Oportunidades Prioritárias</h3>
            <p className="text-[11px] text-gray-400">{sortedActivities.length} negociações ativas sob acompanhamento</p>
          </div>
        </div>

        {/* Botão Discreto "Ver todas" */}
        <button
          onClick={() => router.push('/admin/comercial/oportunidades')}
          className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          Ver todas
          <ExternalLink className="h-3 w-3 text-gray-400" />
        </button>
      </div>

      {/* Grid de Cards Compactos */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedActivities.map((act) => {
          const isAlta = act.prioridade === 'alta';
          const isMedia = act.prioridade === 'media';
          const plano = act.lifecycle?.plano || 'Nenhum';
          const statusLifecycle = act.lifecycle?.status || act.status;
          const ultimaInteracaoStr = act.ultimaAtualizacao 
            ? new Date(act.ultimaAtualizacao).toLocaleDateString('pt-BR') 
            : 'Sem interação';

          return (
            <div 
              key={act.id} 
              className="p-4 bg-gray-900/40 border border-gray-800 hover:border-gray-700/80 rounded-xl flex flex-col justify-between space-y-3.5 hover:bg-gray-900/70 transition group"
            >
              {/* Topo do Card: Nome, Lifecycle & Prioridade */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition">
                      {act.nome}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-900/60 uppercase">
                        {statusLifecycle}
                      </span>
                      {plano !== 'Nenhum' && (
                        <span className="text-[10px] font-semibold text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                          Plano: {plano}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge de Prioridade */}
                  <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase shrink-0 ${
                    isAlta 
                      ? 'bg-rose-950/60 text-rose-400 border-rose-900/60' 
                      : isMedia 
                      ? 'bg-amber-950/60 text-amber-400 border-amber-900/60' 
                      : 'bg-gray-800 text-gray-300 border-gray-700'
                  }`}>
                    {act.prioridade}
                  </span>
                </div>
              </div>

              {/* Informações Intermediárias: Próxima Ação & Vencimento */}
              <div className="p-3 bg-gray-950/60 border border-gray-800/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Próxima Ação</span>
                  {act.nextAction?.vencimento && (
                    <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-blue-400" />
                      {new Date(act.nextAction.vencimento).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span>{act.nextAction?.acao || 'Atendimento comercial'}</span>
                </p>
              </div>

              {/* Rodapé do Card: Responsável, Última Interação & Botão Abrir */}
              <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3 text-gray-600" />
                    {act.responsavel || 'Não Informado'}
                  </span>
                  <span className="text-[10px] text-gray-500 block truncate">
                    Última interação: <strong className="text-gray-400 font-medium">{ultimaInteracaoStr}</strong>
                  </span>
                </div>

                <button
                  onClick={() => setSelectedActivity(act)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                >
                  Abrir
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Drawer Comercial Integrado */}
      <CrmActivityDrawer 
        activity={selectedActivity} 
        onClose={() => setSelectedActivity(null)} 
        onSuccess={handleSuccess}
      />

    </div>
  );
}
