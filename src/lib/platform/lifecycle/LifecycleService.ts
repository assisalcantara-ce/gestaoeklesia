import { LifecycleCalculatorInput, LifecycleResult, LifecycleStatus } from './types';

export class LifecycleService {
  /**
   * Calcula dinamicamente o status do Lifecycle Comercial a partir do input fornecido.
   * Não grava nada no banco de dados e serve como motor puro de classificação.
   */
  async calculate(_input: LifecycleCalculatorInput): Promise<LifecycleResult> {
    // Esqueleto para lógica de cálculo comercial no futuro
    return {
      status: 'LEAD',
      calculatedAt: new Date().toISOString(),
      reason: 'Esqueleto inicial da infraestrutura de Lifecycle'
    };
  }

  /**
   * Helper para verificar se um determinado status é considerado ativo no sistema.
   */
  isActive(_status: LifecycleStatus): boolean {
    // Esqueleto: no futuro validará se status está entre ACTIVE, RENEWAL ou TRIAL ativo
    return false;
  }

  /**
   * Helper para verificar se o status representa um período experimental.
   */
  isTrial(_status: LifecycleStatus): boolean {
    // Esqueleto: no futuro validará se status é TRIAL ou TRIAL_EXPIRING
    return false;
  }

  /**
   * Helper para verificar se o status representa a janela de renovação de contrato.
   */
  isRenewal(_status: LifecycleStatus): boolean {
    // Esqueleto: no futuro validará se status é RENEWAL
    return false;
  }

  /**
   * Helper para verificar se o status representa faturas pendentes de pagamento.
   */
  isPaymentPending(_status: LifecycleStatus): boolean {
    // Esqueleto: no futuro validará se status é PAYMENT_PENDING
    return false;
  }

  /**
   * Helper para verificar se o status representa um cliente cancelado.
   */
  isCanceled(_status: LifecycleStatus): boolean {
    // Esqueleto: no futuro validará se status é CANCELED
    return false;
  }
}
