/**
 * ImpersonationService — Serviço de Arquitetura para Assumir Sessão (Admin Impersonation)
 * 
 * FASE 1: Infraestrutura de contrato e definição formal da API.
 * Nenhuma alteração na autenticação ativa ou middleware foi efetuada nesta etapa.
 */

export interface ImpersonationSession {
  impersonationId: string;
  originalAdminId: string;
  originalAdminEmail: string;
  targetTenantId: string;
  targetTenantName?: string;
  startedAt: string;
  expiresAt: string;
}

export interface StartImpersonationInput {
  originalAdminId: string;
  originalAdminEmail: string;
  targetTenantId: string;
  targetTenantName?: string;
  durationMinutes?: number;
}

export class ImpersonationService {
  /**
   * Inicia a sessão de impersonação para um Super Admin assumir um Tenant/Ministério.
   * FASE 1: Stub/Contrato oficial da API.
   */
  static async startImpersonation(
    _input: StartImpersonationInput
  ): Promise<ImpersonationSession> {
    throw new Error('Not Implemented: ImpersonationService.startImpersonation() será ativado na Fase 2.');
  }

  /**
   * Valida a integridade e expiração de uma sessão/token de impersonação em vigência.
   * FASE 1: Stub/Contrato oficial da API.
   */
  static async validateImpersonation(
    _tokenOrSessionId: string
  ): Promise<{ valid: boolean; session?: ImpersonationSession; error?: string }> {
    return {
      valid: false,
      error: 'Not Implemented: ImpersonationService.validateImpersonation() será ativado na Fase 2.',
    };
  }

  /**
   * Encerra a sessão de impersonação ativa e restaura a identidade nativa do Super Admin.
   * FASE 1: Stub/Contrato oficial da API.
   */
  static async endImpersonation(): Promise<boolean> {
    throw new Error('Not Implemented: ImpersonationService.endImpersonation() será ativado na Fase 2.');
  }

  /**
   * Verifica no contexto do cliente/servidor se há uma impersonação em andamento.
   * FASE 1: Stub/Contrato oficial da API.
   */
  static isImpersonating(): boolean {
    return false;
  }

  /**
   * Retorna os dados do Super Admin original que iniciou a impersonação.
   * FASE 1: Stub/Contrato oficial da API.
   */
  static getOriginalAdmin(): { id: string; email: string } | null {
    return null;
  }
}
