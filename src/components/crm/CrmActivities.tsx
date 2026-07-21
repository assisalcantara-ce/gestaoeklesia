'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { AlertCircle, ShieldAlert, CheckCircle } from 'lucide-react';
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
  lifecycle?: {
    status: string;
    plano?: string;
    statusFinanceiro?: string;
    daysRemaining?: number;
    reason: string;
  };
}

export default function CrmActivities() {
  const [activities, setActivities] = useState<CrmActivityData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<CrmActivityData | null>(null);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await authenticatedFetch('/api/v1/admin/crm/activities');
        if (!res.ok) {
          throw new Error('Erro ao carregar oportunidades abertas (atividades)');
        }
        const data = await res.json();
        setActivities(data);
      } catch (err: any) {
        setError(err instanceof Error ? err : new Error(err?.message || 'Erro desconhecido'));
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse p-4">
        <div className="h-10 bg-gray-800 rounded-lg w-full"></div>
        <div className="h-32 bg-gray-800 rounded-lg w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-950/30 border border-red-900/50 text-red-400 rounded-xl text-sm">
        Erro ao carregar oportunidades ativas do CRM.
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-gray-800 rounded-xl text-center">
        <ShieldAlert className="h-10 w-10 text-gray-500 mb-2" />
        <h4 className="text-white font-semibold text-sm">Nenhuma oportunidade aberta</h4>
        <p className="text-gray-400 text-xs mt-1">Todas as negociações estão fechadas ou convertidas.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-950 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <CheckCircle className="text-blue-500 h-4 w-4" />
          Oportunidades Comerciais Ativas
        </h3>
        <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-900 font-bold px-2 py-0.5 rounded-full">
          {activities.length} abertas
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-[10px] text-gray-400 uppercase tracking-wider bg-gray-900/40">
              <th className="py-3 px-5 font-bold">Cliente</th>
              <th className="py-3 px-5 font-bold">Responsável</th>
              <th className="py-3 px-5 font-bold">Status</th>
              <th className="py-3 px-5 font-bold">Prioridade</th>
              <th className="py-3 px-5 font-bold text-right">Última Atualização</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-xs text-gray-300">
            {activities.map((act) => {
              const isAlta = act.prioridade === 'alta';
              return (
                <tr 
                  key={act.id} 
                  className="hover:bg-gray-900/40 transition cursor-pointer"
                  onClick={() => setSelectedActivity(act)}
                >
                  <td className="py-3 px-5 font-semibold text-white">{act.nome}</td>
                  <td className="py-3 px-5">{act.responsavel}</td>
                  <td className="py-3 px-5">
                    <span className="bg-blue-950/40 text-blue-400 border border-blue-900/50 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                      {act.status}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    {isAlta ? (
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                        Alta
                      </span>
                    ) : (
                      <span className="text-gray-400">Média</span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right font-medium text-gray-500">
                    {new Date(act.ultimaAtualizacao).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CrmActivityDrawer 
        activity={selectedActivity} 
        onClose={() => setSelectedActivity(null)} 
      />
    </div>
  );
}
