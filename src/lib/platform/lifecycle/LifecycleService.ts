import { LifecycleCalculatorInput, LifecycleResult, LifecycleStatus } from './types';
import { LifecycleRules } from './LifecycleRules';

export class LifecycleService {
  /**
   * Calcula dinamicamente o status do Lifecycle Comercial a partir do input fornecido.
   */
  calculate(input: LifecycleCalculatorInput): LifecycleResult {
    const now = new Date();
    const calculatedAt = now.toISOString();

    const { preRegistration, ministry, billingInvoices, opportunity } = input;
    const isTrial = ministry?.subscription_status === 'trial' || preRegistration?.status === 'trial';

    // 1. Sem Ministério e Sem Pré-Cadastro
    if (!ministry && !preRegistration) {
      return {
        status: 'LEAD',
        reason: 'Nenhum registro operacional (Ministério ou Pré-cadastro) foi localizado.',
        calculatedAt,
        isTrial
      };
    }

    // 2. Se Ministério existe
    if (ministry) {
      // 2a. Ministério Inativo ou Cancelado
      if (ministry.is_active === false || ministry.subscription_status === 'cancelled') {
        return {
          status: 'CANCELED',
          reason: 'O ministério está desativado ou a assinatura foi cancelada.',
          calculatedAt,
          isTrial
        };
      }

      // 2b. Ministério com assinatura ativa (ou trial produtivo ativo)
      if (ministry.subscription_status === 'active' || ministry.subscription_status === 'trial') {
        const endDate = ministry.subscription_end_date ? new Date(ministry.subscription_end_date) : null;

        if (endDate) {
          const diffTime = endDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Se a data de fim do contrato foi ultrapassada
          if (diffDays <= 0) {
            // Deixa continuar para avaliar se tem negociação ou cobrança pendente
          } else if (diffDays <= LifecycleRules.RenewalWindow) {
            return {
              status: 'RENEWAL',
              reason: `Vigência do contrato expira em menos de ${LifecycleRules.RenewalWindow} dias.`,
              daysRemaining: diffDays,
              calculatedAt,
              isTrial
            };
          } else {
            return {
              status: 'ACTIVE',
              reason: 'Assinatura ativa e dentro do período normal de vigência.',
              daysRemaining: diffDays,
              calculatedAt
            };
          }
        } else {
          // Sem data de vigência, mas com status ativo
          return {
            status: 'ACTIVE',
            reason: 'Assinatura ativa sem data de término estipulada.',
            calculatedAt
          };
        }
      }
    }

    // 3. Se existe pre_registration efetivado (pagamento confirmado)
    if (preRegistration && preRegistration.status === 'efetivado') {
      return {
        status: 'ACTIVE',
        reason: 'O pagamento foi confirmado e a conversão está efetivada.',
        calculatedAt
      };
    }

    // 4. Verificação de Cobranças em atraso / pendentes (Precedência superior sobre Trial Expirado / Negociação)
    if (billingInvoices && billingInvoices.length > 0) {
      const pendingInvoices = billingInvoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue');
      if (pendingInvoices.length > 0) {
        return {
          status: 'PAYMENT_PENDING',
          reason: 'Existem cobranças abertas pendentes de compensação.',
          calculatedAt
        };
      }
    }

    // 5. Oportunidade comercial em aberto (Precedência superior sobre Trial Expirado)
    if (opportunity) {
      if (opportunity.status === 'Aguardando Pagamento') {
        return {
          status: 'PAYMENT_PENDING',
          reason: 'Negociação convertida aguardando pagamento do boleto/PIX.',
          calculatedAt
        };
      }

      if (opportunity.status === 'Novo' || opportunity.status === 'Em Atendimento') {
        return {
          status: 'NEGOTIATION',
          reason: 'Existe uma negociação comercial ativa em andamento no CRM.',
          calculatedAt
        };
      }
    }

    // 6. Se não há cobranças ou negociações pendentes, avalia o estado de Trial ativo ou expirado
    if (preRegistration) {
      // Pré-cadastro pendente (ainda não ativou o trial pelo token do e-mail)
      if (preRegistration.status === 'pendente') {
        return {
          status: 'LEAD',
          reason: 'Cadastro realizado mas período de experimentação não iniciado.',
          calculatedAt
        };
      }

      // Pré-cadastro em período experimental de trial
      if (preRegistration.status === 'trial') {
        const expiresAt = preRegistration.trial_expires_at ? new Date(preRegistration.trial_expires_at) : null;

        if (expiresAt) {
          const diffTime = expiresAt.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Trial expirado por data
          if (diffDays <= 0) {
            return {
              status: 'TRIAL_EXPIRED',
              reason: `Período experimental encerrado em ${expiresAt.toLocaleDateString('pt-BR')}.`,
              daysRemaining: diffDays,
              calculatedAt
            };
          }

          // Trial perto de expirar (D-5)
          if (diffDays <= LifecycleRules.TrialExpiringThreshold) {
            return {
              status: 'TRIAL_EXPIRING',
              reason: `Período experimental expira em menos de ${LifecycleRules.TrialExpiringThreshold} dias.`,
              daysRemaining: diffDays,
              calculatedAt
            };
          }

          // Trial ativo normal
          return {
            status: 'TRIAL',
            reason: 'Período experimental ativo e dentro da validade.',
            daysRemaining: diffDays,
            calculatedAt
          };
        }
      }

      // Trial encerrado manualmente ou via sistema
      if (preRegistration.status === 'encerrado') {
        return {
          status: 'TRIAL_EXPIRED',
          reason: 'Período experimental encerrado oficialmente.',
          calculatedAt
        };
      }
    }

    // 7. Se tem ministério que a vigência foi vencida e não caiu em nenhuma condicional acima
    if (ministry && ministry.subscription_end_date) {
      const endDate = new Date(ministry.subscription_end_date);
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        return {
          status: 'TRIAL_EXPIRED',
          reason: `Vigência do contrato encerrada em ${endDate.toLocaleDateString('pt-BR')}.`,
          daysRemaining: diffDays,
          calculatedAt
        };
      }
    }

    // Fallback genérico
    return {
      status: 'LEAD',
      reason: 'Lead inicial sem outros parâmetros de faturamento ou negociação.',
      calculatedAt
    };
  }

  /**
   * Helper para verificar se o status representa um cliente com acesso ativo.
   */
  isActive(input: LifecycleCalculatorInput): boolean {
    const result = this.calculate(input);
    const activeStates: LifecycleStatus[] = ['ACTIVE', 'RENEWAL', 'TRIAL', 'TRIAL_EXPIRING'];
    return activeStates.includes(result.status);
  }

  /**
   * Helper para verificar se o status representa um período experimental.
   */
  isTrial(input: LifecycleCalculatorInput): boolean {
    const result = this.calculate(input);
    const trialStates: LifecycleStatus[] = ['TRIAL', 'TRIAL_EXPIRING'];
    return trialStates.includes(result.status);
  }

  /**
   * Helper para verificar se o status representa a janela de renovação.
   */
  isRenewal(input: LifecycleCalculatorInput): boolean {
    const result = this.calculate(input);
    return result.status === 'RENEWAL';
  }

  /**
   * Helper para verificar se o status representa cobrança em atraso/pendente.
   */
  isPaymentPending(input: LifecycleCalculatorInput): boolean {
    const result = this.calculate(input);
    return result.status === 'PAYMENT_PENDING';
  }

  /**
   * Helper para verificar se o status representa um cliente cancelado.
   */
  isCanceled(input: LifecycleCalculatorInput): boolean {
    const result = this.calculate(input);
    return result.status === 'CANCELED';
  }
}
