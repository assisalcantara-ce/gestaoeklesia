'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { 
  Clock, 
  AlertTriangle, 
  CreditCard, 
  RefreshCw, 
  UserPlus, 
  ArrowUpRight, 
  Sparkles,
  Inbox,
  Phone,
  MessageCircle,
  User,
  Flame,
  KeyRound,
  Users,
  Church,
  Activity
} from 'lucide-react';
import CrmActivityDrawer from './CrmActivityDrawer';
import { CrmActivityData } from './CrmActivities';
import TechnicalAccessModal from '@/components/admin/technical/TechnicalAccessModal';

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
  responsavel?: string;
  email?: string;
  telefone?: string;
  origem?: string;
  ultimaInteracao?: string | null;
  diasSemContato?: number;
  usageStats?: {
    totalMembros: number;
    totalCongregacoes: number;
    maxMembros?: number;
    maxCongregacoes?: number;
  };
}

interface CrmNextActionsProps {
  onRefresh?: () => void;
}

export default function CrmNextActions({ onRefresh }: CrmNextActionsProps = {}) {
  const [actions, setActions] = useState<CrmNextActionData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<CrmActivityData | null>(null);
  const [technicalAccessTenant, setTechnicalAccessTenant] = useState<{ id: string; name: string } | null>(null);

  const fetchActions = async () => {
    try {
      const res = await authenticatedFetch('/api/v1/admin/crm/next-actions');
      if (!res.ok) {
        throw new Error('Erro ao carregar fila de trabalho comercial');
      }
      const data = await res.json();
      setActions(data || []);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, []);

  const getTaskCategory = (status: string) => {
    switch (status) {
      case 'TRIAL_EXPIRED':
        return {
          titulo: 'Trial Expirado',
          icon: <AlertTriangle className="h-4 w-4 text-rose-400" />,
          badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
          route: '/admin/ministerios'
        };
      case 'TRIAL_EXPIRING':
        return {
          titulo: 'Trial Expirando',
          icon: <Clock className="h-4 w-4 text-amber-400" />,
          badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
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
          titulo: 'Novo Lead',
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

  const cleanPhone = (phone?: string) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) {
      return digits.startsWith('55') ? digits : `55${digits}`;
    }
    return null;
  };

  const handleOpenWhatsApp = (act: CrmNextActionData) => {
    const rawNumber = cleanPhone(act.telefone);
    if (!rawNumber) return;

    let saudacao = 'Olá';
    if (act.responsavel && act.responsavel !== 'Não Informado') {
      saudacao = `Olá, ${act.responsavel.split(' ')[0]}`;
    }

    let msg = `${saudacao}! Sou da equipe comercial do Gestão Eklésia.`;
    if (act.lifecycle.status === 'TRIAL_EXPIRED') {
      msg += ` Notei que o período de teste do ${act.nome} expirou recentemente. Como foi sua experiência com a plataforma? Gostaria de conhecer nossas condições especiais para continuar utilizando o sistema?`;
    } else if (act.lifecycle.status === 'TRIAL_EXPIRING') {
      msg += ` O período de avaliação do ${act.nome} está nos últimos dias. Gostaria de tirar dúvidas ou já ativar seu plano definitivo?`;
    } else if (act.lifecycle.status === 'PAYMENT_PENDING') {
      msg += ` Gostaria de saber se você precisa de ajuda com a fatura em aberto da sua assinatura no Gestão Eklésia.`;
    } else {
      msg += ` Gostaria de conversar sobre a implantação do Gestão Eklésia para ${act.nome}.`;
    }

    const url = `https://wa.me/${rawNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleOpenDrawer = (act: CrmNextActionData) => {
    const dto: CrmActivityData = {
      id: act.oportunidadeId,
      oportunidadeId: act.oportunidadeId,
      ministryId: act.ministryId,
      nome: act.nome,
      responsavel: act.responsavel || 'Não Informado',
      status: act.lifecycle.status,
      prioridade: act.prioridade,
      dataCriacao: new Date().toISOString(),
      ultimaAtualizacao: act.ultimaInteracao || new Date().toISOString(),
      email: act.email,
      telefone: act.telefone,
      origem: act.origem,
      nextAction: {
        acao: act.acao,
        prioridade: act.prioridade,
        vencimento: act.vencimento
      },
      lifecycle: {
        status: act.lifecycle.status,
        reason: act.lifecycle.reason,
        daysRemaining: act.lifecycle.daysRemaining
      }
    };
    setSelectedActivity(dto);
  };

  const handleDrawerSuccess = () => {
    fetchActions();
    if (onRefresh) onRefresh();
  };

  if (loading) {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="h-5 w-48 bg-gray-900 rounded animate-pulse"></div>
          <div className="h-5 w-24 bg-gray-900 rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-900/60 border border-gray-800 rounded-xl animate-pulse"></div>
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
            Excelente! Nenhuma tarefa de trial expirado, cobrança pendente ou negociação atrasada no momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
      
      {/* Header da Fila */}
      <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-950/60 border border-rose-900/60 rounded-xl text-rose-400">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Fila de Ações Comerciais Prioritárias</h3>
            <p className="text-[11px] text-gray-400">
              Ordenada por urgência e tempo de espera para recuperação e fechamento
            </p>
          </div>
        </div>
        <span className="text-[11px] bg-rose-950/80 text-rose-300 border border-rose-900 font-bold px-3 py-1 rounded-full shadow-xs">
          {actions.length} {actions.length === 1 ? 'pendência ativa' : 'pendências ativas'}
        </span>
      </div>

      {/* Lista de Ações Operacionais */}
      <div className="divide-y divide-gray-800/80">
        {actions.map((act) => {
          const category = getTaskCategory(act.lifecycle.status);
          const isAlta = act.prioridade === 'alta';
          const validPhone = cleanPhone(act.telefone);

          return (
            <div 
              key={act.id} 
              className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-gray-900/40 transition group"
            >
              {/* Bloco de Informações do Prospect / Ministério */}
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl shrink-0 mt-0.5 group-hover:border-gray-700 transition">
                  {category.icon}
                </div>
                
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition truncate">
                      {act.nome}
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${category.badgeClass}`}>
                      {category.titulo}
                    </span>
                    <span className="text-[10px] text-gray-500 bg-gray-900 px-2 py-0.5 rounded-md border border-gray-800">
                      {act.origem === 'ministries' ? 'Ministério' : 'Lead'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-snug">
                    <span className="font-semibold text-white">{act.acao}</span>
                    {act.lifecycle.reason && (
                      <span className="text-gray-400 block text-[11px] mt-0.5">
                        {act.lifecycle.reason}
                      </span>
                    )}
                  </p>

                  {/* Metadados: Responsável, Último Contato & Telefone */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 text-gray-500" />
                      {act.responsavel || 'Não informado'}
                    </span>

                    {act.diasSemContato !== undefined ? (
                      <span className="flex items-center gap-1 text-amber-400/90 font-medium">
                        <Clock className="h-3 w-3 text-amber-500" />
                        {act.diasSemContato === 0 ? 'Contato hoje' : `${act.diasSemContato} dias sem contato`}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400/90 font-medium">
                        <AlertTriangle className="h-3 w-3 text-rose-500" />
                        Sem contato anterior registrado
                      </span>
                    )}

                    {act.telefone ? (
                      <span className="flex items-center gap-1 text-gray-400 font-mono text-[10px]">
                        <Phone className="h-3 w-3 text-gray-500" />
                        {act.telefone}
                      </span>
                    ) : (
                      <span className="text-rose-400/80 text-[10px] italic">
                        Sem telefone cadastrado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bloco Central: Registros e Uso durante o Teste (Membros, Congregações, Cotas) */}
              <div className="hidden xl:flex items-center gap-2.5 px-4 py-2 bg-gray-900/80 border border-gray-800/80 rounded-xl shrink-0 my-auto">
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 leading-none">Membros</span>
                    <span className="font-bold text-white text-xs mt-0.5">
                      {act.usageStats?.totalMembros ?? 0}
                      {act.usageStats?.maxMembros ? (
                        <span className="text-[10px] text-gray-500 font-normal"> / {act.usageStats.maxMembros}</span>
                      ) : null}
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-gray-800" />

                <div className="flex items-center gap-1.5 text-xs">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Church className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 leading-none">Congregações</span>
                    <span className="font-bold text-white text-xs mt-0.5">
                      {act.usageStats?.totalCongregacoes ?? 0}
                      {act.usageStats?.maxCongregacoes ? (
                        <span className="text-[10px] text-gray-500 font-normal"> / {act.usageStats.maxCongregacoes}</span>
                      ) : null}
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-gray-800" />

                <div className="flex items-center gap-1.5 text-xs">
                  <div className={`p-1.5 rounded-lg border ${
                    (act.usageStats?.totalMembros ?? 0) > 0 || (act.usageStats?.totalCongregacoes ?? 0) > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-gray-800 text-gray-500 border-gray-700'
                  }`}>
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 leading-none">Atividade</span>
                    <span className={`text-[11px] font-semibold mt-0.5 ${
                      (act.usageStats?.totalMembros ?? 0) > 0 || (act.usageStats?.totalCongregacoes ?? 0) > 0
                        ? 'text-emerald-400'
                        : 'text-gray-500'
                    }`}>
                      {(act.usageStats?.totalMembros ?? 0) > 0 || (act.usageStats?.totalCongregacoes ?? 0) > 0
                        ? 'Experimentou'
                        : 'Sem registros'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloco de Ações e Prazos */}
              <div className="flex flex-wrap items-center gap-2.5 justify-between lg:justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-800/60">
                <div className="text-left lg:text-right mr-2">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Vencimento</span>
                  <span className="text-xs font-semibold text-gray-300">
                    {new Date(act.vencimento).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase ${
                  isAlta
                    ? 'bg-rose-950/60 text-rose-400 border-rose-900/60'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
                }`}>
                  {act.prioridade}
                </span>

                {/* Ação 1: WhatsApp Direto */}
                {validPhone ? (
                  <button
                    onClick={() => handleOpenWhatsApp(act)}
                    title="Abrir conversa no WhatsApp com mensagem de recuperação"
                    className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-900/80 hover:border-emerald-500 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenDrawer(act)}
                    title="Telefone não informado ou inválido. Abra o cadastro para verificar."
                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-500 border border-gray-800 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5 opacity-50" />
                    Sem tel.
                  </button>
                )}



                {/* Ação 3: Acesso Técnico ao Tenant (Suporte Nativo com bypass de expiração) */}
                {act.ministryId && (
                  <button
                    onClick={() => setTechnicalAccessTenant({ id: act.ministryId!, name: act.nome })}
                    title="Gerar Acesso Técnico de Suporte ao Tenant (válido mesmo com plano expirado)"
                    className="px-2.5 py-1.5 bg-[#032C28] hover:bg-[#0B453B] text-[#A7C4BC] hover:text-[#10B981] border border-[#0E4D43] rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>Acesso Técnico</span>
                  </button>
                )}

                {/* Ação 4: Abrir Ficha Completa / Atendimento */}
                <button
                  onClick={() => handleOpenDrawer(act)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  Atendimento
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Drawer Integrado */}
      <CrmActivityDrawer
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onSuccess={handleDrawerSuccess}
      />

      {/* Modal de Acesso Técnico Nativo */}
      {technicalAccessTenant && (
        <TechnicalAccessModal
          isOpen={!!technicalAccessTenant}
          onClose={() => setTechnicalAccessTenant(null)}
          tenantId={technicalAccessTenant.id}
          tenantName={technicalAccessTenant.name}
        />
      )}

    </div>
  );
}
