'use client';

import { useState } from 'react';
import { X, User, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { CrmActivityData } from './CrmActivities';
import CrmTimeline from './CrmTimeline';
import CrmInteractionModal from './CrmInteractionModal';

interface CrmActivityDrawerProps {
  activity: CrmActivityData | null;
  onClose: () => void;
}

export default function CrmActivityDrawer({ activity, onClose }: CrmActivityDrawerProps) {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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

            {/* Informações do Cliente */}
            <div className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl space-y-3">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Informações do Cliente</span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">Nome</span>
                  <span className="font-semibold text-white">{activity.nome || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">Responsável</span>
                  <span className="font-semibold text-white">{activity.responsavel || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">E-mail</span>
                  <span className="font-medium text-gray-300 select-all">{activity.email || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">Telefone</span>
                  <span className="font-medium text-gray-300 select-all">{activity.telefone || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">Origem</span>
                  <span className="font-semibold text-gray-300">{activity.origem || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">Data Cadastro</span>
                  <span className="font-semibold text-gray-300">
                    {activity.dataCriacao ? new Date(activity.dataCriacao).toLocaleDateString('pt-BR') : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Resumo Comercial */}
            {activity.lifecycle && (
              <div className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl space-y-3">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Resumo Comercial</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold">Lifecycle</span>
                    <span className="font-bold text-indigo-400">{activity.lifecycle.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold">Plano</span>
                    <span className="font-bold text-gray-200">{activity.lifecycle.plano}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold">Faturamento</span>
                    <span className="font-semibold text-gray-300">{activity.lifecycle.statusFinanceiro}</span>
                  </div>
                  {activity.lifecycle.daysRemaining !== undefined && activity.lifecycle.daysRemaining !== null && (
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold">Dias Restantes</span>
                      <span className="font-bold text-amber-400">{activity.lifecycle.daysRemaining} dias</span>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-gray-800/80">
                  <span className="text-[10px] text-gray-400 block font-semibold">Motivo do Status</span>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{activity.lifecycle.reason}</p>
                </div>
              </div>
            )}

            {/* Próxima Ação */}
            <div className="p-4 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-3">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3" />
                Próxima Ação
              </span>
              {activity.nextAction ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">{activity.nextAction.acao}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      activity.nextAction.prioridade === 'alta'
                        ? 'bg-rose-950/60 text-rose-400 border-rose-900/60'
                        : 'bg-gray-800 text-gray-300 border-gray-700'
                    }`}>
                      {activity.nextAction.prioridade}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 block font-medium">
                    Vencimento: {new Date(activity.nextAction.vencimento).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Nenhuma ação pendente.</p>
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

            {/* Histórico Comercial (Timeline) */}
            <div className="pt-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-2">Histórico Comercial</span>
              <CrmTimeline ministryId={activity.id} />
            </div>

          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-gray-800 space-y-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
          >
            Registrar Interação
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>

      </div>

      {/* Modal de Registro de Interação (Visual Draft) */}
      <CrmInteractionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clienteNome={activity.nome}
      />
    </div>
  );
}
