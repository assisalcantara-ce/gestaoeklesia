'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { X, User, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { CrmActivityData } from './CrmActivities';

export interface CrmNextActionItem {
  id: string;
  acao: string;
  vencimento: string;
  prioridade: string;
}

interface CrmActivityDrawerProps {
  activity: CrmActivityData | null;
  onClose: () => void;
}

export default function CrmActivityDrawer({ activity, onClose }: CrmActivityDrawerProps) {
  const [nextAction, setNextAction] = useState<CrmNextActionItem | null>(null);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  useEffect(() => {
    if (!activity) {
      setNextAction(null);
      return;
    }

    async function fetchNextAction() {
      if (!activity) return;
      setLoadingAction(true);
      try {
        const res = await authenticatedFetch(`/api/v1/admin/crm/next-actions?ministryId=${encodeURIComponent(activity.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setNextAction(data[0]);
          } else {
            setNextAction(null);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar próxima ação no Drawer:', err);
      } finally {
        setLoadingAction(false);
      }
    }

    fetchNextAction();
  }, [activity]);

  if (!activity) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gray-950 border-l border-gray-800 h-full p-6 flex flex-col justify-between overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Top Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="text-blue-500 h-5 w-5" />
              Detalhes da Oportunidade
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-900 transition cursor-pointer"
              title="Fechar painel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nome do Cliente */}
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Cliente</span>
            <h2 className="text-xl font-bold text-white mt-0.5">{activity.nome}</h2>
          </div>

          {/* Grid de Informações Detalhadas */}
          <div className="space-y-4 pt-2">
            
            {/* Status & Prioridade */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-900/50 border border-gray-800/80 rounded-xl">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Status</span>
                <span className="text-xs font-bold text-blue-400 mt-1 inline-block bg-blue-950/60 border border-blue-900/60 px-2.5 py-0.5 rounded-full">
                  {activity.status}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Prioridade</span>
                <span className={`text-xs font-bold mt-1 inline-block px-2.5 py-0.5 rounded-full border ${
                  activity.prioridade === 'alta' 
                    ? 'bg-rose-950/60 text-rose-400 border-rose-900/60' 
                    : 'bg-gray-800 text-gray-300 border-gray-700'
                }`}>
                  {activity.prioridade.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Responsável */}
            <div className="p-3 bg-gray-900/50 border border-gray-800/80 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-gray-800 rounded-lg text-blue-400">
                <User className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Responsável</span>
                <span className="text-xs font-semibold text-white">{activity.responsavel}</span>
              </div>
            </div>

            {/* Próxima Ação */}
            <div className="p-4 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-2">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3" />
                Próxima Ação
              </span>
              {loadingAction ? (
                <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4"></div>
              ) : nextAction ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">{nextAction.acao}</p>
                  <span className="text-[11px] text-gray-400 block">
                    Vencimento: {new Date(nextAction.vencimento).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Nenhuma ação imediata agendada para esta oportunidade.</p>
              )}
            </div>

            {/* Última Atualização */}
            <div className="p-3 bg-gray-900/50 border border-gray-800/80 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-gray-800 rounded-lg text-gray-400">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Última Atualização</span>
                <span className="text-xs font-semibold text-gray-200">
                  {new Date(activity.ultimaAtualizacao).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>

      </div>
    </div>
  );
}
