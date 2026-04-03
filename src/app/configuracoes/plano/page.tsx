'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/lib/supabase-client';
import { PLANOS_DISPONIBLES, formatarPreco } from '@/config/plans';
import type { PlanType } from '@/types/ministry';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { useAuditLog } from '@/hooks/useAuditLog';

export default function PlanoPage() {
  const [activeMenu, setActiveMenu] = useState('plano');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanType | null>(null);
  const [criandoTicket, setCriandoTicket] = useState(false);
  const dialog = useAppDialog();
  const { registrarAcao } = useAuditLog();

  const [planoAtualId, setPlanoAtualId] = useState<PlanType>('starter');
  const [planoInicio, setPlanoInicio] = useState<string>('');
  const [planoRenovacao, setPlanoRenovacao] = useState<string>('');
  const [planoStatus, setPlanoStatus] = useState<string>('ativo');
  const [loading, setLoading] = useState(true);

  const planosDisponiveis = Object.values(PLANOS_DISPONIBLES);
  const planoAtual = PLANOS_DISPONIBLES[planoAtualId] || PLANOS_DISPONIBLES.starter;

  const getPlanLabel = (planId: PlanType) => {
    switch (planId) {
      case 'intermediario':
        return 'Intermediário';
      case 'profissional':
        return 'Profissional';
      case 'expert':
        return 'Expert';
      default:
        return 'Starter';
    }
  };

  useEffect(() => {
    const supabase = createClient();

    const resolveMinistryId = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return null;

        const mu = await supabase
          .from('ministry_users')
          .select('ministry_id')
          .eq('user_id', user.id)
          .limit(1);

        const ministryIdFromMu = (mu.data as any)?.[0]?.ministry_id as string | undefined;
        if (ministryIdFromMu) return ministryIdFromMu;

        const m = await supabase.from('ministries').select('id').eq('user_id', user.id).limit(1);
        const ministryIdFromOwner = (m.data as any)?.[0]?.id as string | undefined;
        return ministryIdFromOwner || null;
      } catch {
        return null;
      }
    };

    const normalizePlanId = (value: string | null | undefined): PlanType => {
      const normalized = String(value || '').toLowerCase();
      if (normalized in PLANOS_DISPONIBLES) return normalized as PlanType;
      if (normalized.includes('profissional') || normalized.includes('professional')) return 'profissional';
      if (normalized.includes('intermediario') || normalized.includes('intermediate')) return 'intermediario';
      if (normalized.includes('expert') || normalized.includes('enterprise') || normalized.includes('empresarial')) return 'expert';
      return 'starter';
    };

    const loadPlanoAtual = async () => {
      try {
        const ministryId = await resolveMinistryId();
        if (!ministryId) return;

        const { data } = await supabase
          .from('ministries')
          .select('plan, subscription_status, subscription_start_date, subscription_end_date, created_at')
          .eq('id', ministryId)
          .maybeSingle();

        const planId = normalizePlanId(data?.plan);
        setPlanoAtualId(planId);
        setPlanoStatus(String(data?.subscription_status || 'ativo'));

        const inicio = data?.subscription_start_date || data?.created_at || '';
        const renovacao = data?.subscription_end_date || '';
        setPlanoInicio(inicio);
        setPlanoRenovacao(renovacao);
      } finally {
        setLoading(false);
      }
    };

    loadPlanoAtual();
  }, []);

  const handleUpgradeClick = (targetPlano: PlanType) => {
    setPlanoSelecionado(targetPlano);
    setShowUpgradeModal(true);
  };

  const handleConfirmUpgrade = async () => {
    try {
      setCriandoTicket(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        await dialog.alert({
          title: 'Erro',
          type: 'error',
          message: 'Você precisa estar logado para solicitar upgrade'
        });
        return;
      }

      // Obter informações do ministry
      const muResult = await supabase
        .from('ministry_users')
        .select('ministry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const ministryIdFromMu = (muResult.data as any)?.ministry_id as string | undefined;
      let ministryId = ministryIdFromMu;

      if (!ministryId) {
        const mResult = await supabase
          .from('ministries')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        ministryId = (mResult.data as any)?.id as string | undefined;
      }

      if (!ministryId) {
        await dialog.alert({
          title: 'Erro',
          type: 'error',
          message: 'Ministério não encontrado'
        });
        return;
      }

      // Montar dados do novo ticket
      const novoPlano = planoSelecionado ? PLANOS_DISPONIBLES[planoSelecionado] : null;
      const planoAtualObj = PLANOS_DISPONIBLES[planoAtualId];

      const titulo = `Solicitação de Upgrade de Plano: ${novoPlano?.nome || 'Desconhecido'}`;
      const descricao = `Solicitação de upgrade do plano "${planoAtualObj?.nome || 'Atual'}" para "${novoPlano?.nome || 'Desconhecido'}".\n\nNovo plano: ${formatarPreco(novoPlano?.preco_mensal || 0)}/mês\n\nFavor processar esta solicitação comercial.`;

      // Criar ticket na tabela support_tickets
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .insert([{
          ministry_id: ministryId,
          user_id: user.id,
          subject: titulo,
          description: descricao,
          category: 'Upgrade de Plano',
          priority: 'high',
          status: 'open',
        }])
        .select();

      if (ticketError) {
        await registrarAcao({
          acao: 'criar',
          modulo: 'configuracoes',
          area: 'plano',
          tabela_afetada: 'support_tickets',
          descricao: `Tentativa de criar ticket de upgrade falhou`,
          status: 'erro',
          mensagem_erro: ticketError.message
        });
        await dialog.alert({
          title: 'Erro',
          type: 'error',
          message: 'Erro ao criar ticket: ' + ticketError.message
        });
        return;
      }

      // Registrar ação
      await registrarAcao({
        acao: 'criar',
        modulo: 'configuracoes',
        area: 'plano',
        tabela_afetada: 'support_tickets',
        descricao: `Ticket de upgrade criado: ${titulo}`,
        dados_novos: {
          plano_atual: planoAtualId,
          plano_solicitado: planoSelecionado,
          titulo
        },
        status: 'sucesso'
      });

      // Sucesso!
      setShowUpgradeModal(false);
      setPlanoSelecionado(null);
      await dialog.alert({
        title: 'Sucesso!',
        type: 'success',
        message: 'Ticket comercial enviado com sucesso! Um membro da nossa equipe entrará em contato em breve para processar seu upgrade.'
      });
    } catch (error: any) {
      console.error('Erro ao confirmar upgrade:', error);
      await dialog.alert({
        title: 'Erro',
        type: 'error',
        message: 'Erro ao processar upgrade: ' + (error?.message || 'Erro desconhecido')
      });
    } finally {
      setCriandoTicket(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <h1 className="text-3xl font-bold text-gray-800 mb-6">📋 Plano de Assinatura</h1>

          {loading && (
            <p className="text-sm text-gray-500 mb-4">Carregando dados do plano...</p>
          )}

          {/* Plano Atual */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-2">Seu Plano Atual</h2>
            <p className="text-teal-100 mb-6">Gerencie sua assinatura e veja os benefícios do seu plano</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-teal-100 text-sm mb-1">Plano</p>
                <p className="text-2xl font-bold">{getPlanLabel(planoAtual.id)}</p>
                <p className="text-teal-100 text-xs">Status: {planoStatus}</p>
              </div>

              <div>
                <p className="text-teal-100 text-sm mb-1">Valor</p>
                <p className="text-2xl font-bold">{formatarPreco(planoAtual.preco_mensal)}</p>
                <p className="text-teal-100 text-xs">por mensal</p>
              </div>

              <div>
                <p className="text-teal-100 text-sm mb-1">Ativo desde</p>
                <p className="text-lg font-semibold">
                  {planoInicio ? new Date(planoInicio).toLocaleDateString('pt-BR') : '—'}
                </p>
              </div>

              <div>
                <p className="text-teal-100 text-sm mb-1">Próxima renovação</p>
                <p className="text-lg font-semibold">
                  {planoRenovacao ? new Date(planoRenovacao).toLocaleDateString('pt-BR') : '—'}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3">Seu Plano Inclui:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {planoAtual.recursos.map((feature, index) => (
                  <p key={index} className="text-teal-100">✓ {feature}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Planos Disponíveis */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Planos Disponíveis</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {planosDisponiveis.map((plano) => (
                <div
                  key={plano.id}
                  className={`rounded-lg shadow-lg overflow-hidden transition transform hover:scale-105 ${
                    plano.id === 'intermediario'
                      ? 'ring-2 ring-teal-500 bg-white'
                      : 'bg-white'
                  }`}
                >
                  {plano.id === 'intermediario' && (
                    <div className="bg-teal-500 text-white px-4 py-2 text-center text-sm font-bold">
                      ⭐ RECOMENDADO
                    </div>
                  )}

                  <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{getPlanLabel(plano.id)}</h3>
                    <p className="text-2xl font-bold text-teal-600 mb-1">
                      {formatarPreco(plano.preco_mensal)}
                    </p>
                    <p className="text-gray-600 text-sm">por mensal</p>
                    <p className="text-gray-500 text-xs mb-6">{formatarPreco(plano.preco_anual)}/ano</p>

                    <div className="space-y-2 mb-6">
                      {plano.recursos.map((feature, index) => (
                        <p key={index} className="text-sm text-gray-700">✓ {feature}</p>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        if (plano.id !== planoAtual.id) {
                          handleUpgradeClick(plano.id);
                        }
                      }}
                      disabled={plano.id === planoAtual.id}
                      className={`w-full py-2 rounded-lg font-semibold transition ${
                        plano.id === planoAtual.id
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      {plano.id === planoAtual.id ? '✓ Plano Atual' : 'Fazer Upgrade'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade Modal */}
          {showUpgradeModal && planoSelecionado && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Solicitar Upgrade</h2>
                <p className="text-gray-600 mb-4">
                  Um ticket comercial será criado e nossa equipe de suporte entrará em contato para processar seu upgrade para o plano <strong>{PLANOS_DISPONIBLES[planoSelecionado]?.nome}</strong>.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Você receberá uma resposta por email em breve com os próximos passos.
                </p>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setShowUpgradeModal(false);
                      setPlanoSelecionado(null);
                    }}
                    disabled={criandoTicket}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmUpgrade}
                    disabled={criandoTicket}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {criandoTicket ? 'Processando...' : 'Abrir Ticket'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
