'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare, 
  Plus, 
  Phone, 
  Mail, 
  Calendar, 
  Users, 
  CheckCircle,
  FileText
} from 'lucide-react';
import { CrmActivityData } from './CrmActivities';
import CrmTimeline from './CrmTimeline';
import CrmInteractionModal from './CrmInteractionModal';
import { authenticatedFetch } from '@/lib/api-client';

export interface InteractionRecord {
  id: string;
  ministry_id: string | null;
  tipo: string;
  descricao: string;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_by: string;
  created_at: string;
}

interface CrmActivityDrawerProps {
  activity: CrmActivityData | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CrmActivityDrawer({ activity, onClose, onSuccess }: CrmActivityDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'interactions'>('overview');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [interactions, setInteractions] = useState<InteractionRecord[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchInteractions = useCallback(async () => {
    if (!activity) return;
    setLoadingInteractions(true);
    try {
      const res = await authenticatedFetch(`/api/v1/admin/crm/interactions?ministryId=${encodeURIComponent(activity.id)}`);
      if (res.ok) {
        const data = await res.json();
        setInteractions(data);
      }
    } catch (err) {
      console.error('Erro ao carregar interações do cliente:', err);
    } finally {
      setLoadingInteractions(false);
    }
  }, [activity]);

  useEffect(() => {
    if (activity) {
      fetchInteractions();
    }
  }, [activity, fetchInteractions]);

  if (!activity) return null;

  const handleInteractionSaved = () => {
    // 1. Mostrar Toast de sucesso
    setToastMessage('Interação registrada com sucesso!');
    setTimeout(() => setToastMessage(null), 4000);

    // 2. Atualizar lista de interações da aba
    fetchInteractions();

    // 3. Atualizar callbacks globais da página (Timeline e Cards do CRM)
    onSuccess?.();
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case 'whatsapp':
        return <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />;
      case 'ligação':
        return <Phone className="h-3.5 w-3.5 text-blue-400" />;
      case 'e-mail':
        return <Mail className="h-3.5 w-3.5 text-violet-400" />;
      case 'reunião':
        return <Calendar className="h-3.5 w-3.5 text-amber-400" />;
      case 'visita':
        return <Users className="h-3.5 w-3.5 text-rose-400" />;
      default:
        return <FileText className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gray-950 border-l border-gray-800 h-full p-6 flex flex-col justify-between overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300 relative">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-top duration-200">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="text-blue-500 h-5 w-5" />
              Painel de Atendimento
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-900 transition cursor-pointer"
              title="Fechar painel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nome do Cliente & Origem */}
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Cliente</span>
            <h2 className="text-xl font-bold text-white mt-0.5">{activity.nome}</h2>
          </div>

          {/* NAVEGAÇÃO DE ABAS */}
          <div className="flex border-b border-gray-800 gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('interactions')}
              className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'interactions'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Interações
              <span className="text-[10px] bg-gray-800 text-gray-300 font-bold px-2 py-0.5 rounded-full">
                {interactions.length}
              </span>
            </button>
          </div>

          {/* ABA 1: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-4 pt-2 animate-in fade-in duration-200">
              
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

              {/* Timeline do CRM */}
              <div className="pt-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-2">Histórico Comercial</span>
                <CrmTimeline ministryId={activity.id} />
              </div>

            </div>
          )}

          {/* ABA 2: INTERAÇÕES REGISTRADAS */}
          {activeTab === 'interactions' && (
            <div className="space-y-4 pt-2 animate-in fade-in duration-200">
              
              {/* Action Header: Nova Interação */}
              <div className="flex items-center justify-between bg-gray-900/40 p-3.5 border border-gray-800 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-white">Histórico de Atendimentos</h4>
                  <p className="text-[11px] text-gray-400">Registros de contatos comerciais</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova Interação
                </button>
              </div>

              {/* Lista de Interações */}
              {loadingInteractions ? (
                <div className="space-y-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl"></div>
                  ))}
                </div>
              ) : interactions.length === 0 ? (
                <div className="p-8 text-center bg-gray-900/40 border border-gray-800 rounded-xl space-y-2">
                  <MessageSquare className="h-8 w-8 text-gray-500 mx-auto" />
                  <h4 className="text-xs font-bold text-gray-300">Nenhuma interação registrada</h4>
                  <p className="text-[11px] text-gray-500">Clique em "Nova Interação" para registrar o primeiro atendimento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map((item) => (
                    <div key={item.id} className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl space-y-2.5 hover:bg-gray-900/80 transition">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-white bg-gray-800 px-2.5 py-0.5 rounded-full border border-gray-700">
                          {getTipoIcon(item.tipo)}
                          {item.tipo}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(item.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed">{item.descricao}</p>

                      {item.proxima_acao && (
                        <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-blue-400 font-semibold flex items-center gap-1">
                            <ArrowRight className="h-3 w-3 text-blue-500" />
                            {item.proxima_acao}
                          </span>
                          {item.data_proxima_acao && (
                            <span className="text-gray-400">
                              {new Date(item.data_proxima_acao).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-gray-500 flex items-center gap-1 pt-1">
                        <User className="h-3 w-3 text-gray-600" />
                        <span>Por: {item.created_by || 'Atendente'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-gray-800 space-y-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Interação
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>

      </div>

      {/* Modal de Registro de Interação (Formulário Operacional de Gravação) */}
      <CrmInteractionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clienteNome={activity.nome}
        ministryId={activity.id}
        onSuccess={handleInteractionSaved}
      />
    </div>
  );
}
