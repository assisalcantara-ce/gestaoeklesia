/**
 * ImpersonationService — Serviço de Arquitetura para Assumir Sessão (Admin Impersonation)
 * 
 * HARDENING 1.1: Reforço Arquitetural e Matriz Estrita de Permissões.
 * 
 * REGRA EXCLUSIVA DE ACESSO:
 * - SUPER_ADMIN:  ✓ Pode iniciar Impersonação
 * - ADMIN:        ✗ Não pode
 * - FINANCEIRO:   ✗ Não pode
 * - SUPORTE:      ✗ Não pode
 * - COMERCIAL:    ✗ Não pode
 */

export type ImpersonationEndedReason = 'user_action' | 'timeout' | 'security_revocation';

export interface ImpersonationSessionRecord {
  id: string;
  adminId: string;
  adminEmail: string;
  tenantId: string;
  tenantName?: string;
  startedAt: string;
  endedAt?: string | null;
  endedBy?: ImpersonationEndedReason | null;
  reason: string;
  readOnly: boolean;
  ip: string;
  userAgent: string;
  jwtId: string;
  status: 'active' | 'completed' | 'expired' | 'revoked';
}

export interface StartImpersonationInput {
  originalAdminId: string;
  originalAdminEmail: string;
  originalAdminRole: 'super_admin' | string;
  targetTenantId: string;
  targetTenantName?: string;
  reason: string;
  readOnly?: boolean;
  ip?: string;
  userAgent?: string;
  durationMinutes?: number;
}

export class ImpersonationService {
  /**
   * Valida se a role do operador possui permissão exclusiva para iniciar impersonação.
   * EXCLUSIVIDADE: Apenas SUPER_ADMIN é autorizado.
   */
  static isRoleAuthorizedForImpersonation(role: string): boolean {
    const normRole = String(role || '').toLowerCase().trim();
    return normRole === 'super_admin';
  }

  /**
   * Inicia a sessão de impersonação para um Super Admin assumir um Tenant/Ministério.
   * EXIGE: role === 'super_admin' e motivo (reason) preenchido.
   * FASE 1.1: Stub/Contrato oficial da API.
   */
  static async startImpersonation(
    input: StartImpersonationInput
  ): Promise<ImpersonationSessionRecord> {
    if (!this.isRoleAuthorizedForImpersonation(input.originalAdminRole)) {
      throw new Error('Acesso negado: Apenas o perfil SUPER_ADMIN possui permissão para assumir sessão de um tenant.');
    }
    if (!input.reason || input.reason.trim().length < 5) {
      throw new Error('Justificativa obrigatória: Um motivo com no mínimo 5 caracteres é exigido para auditoria.');
    }
    throw new Error('Not Implemented: ImpersonationService.startImpersonation() será ativado na Fase 2.');
  }

  /**
   * Valida a integridade e expiração de uma sessão/token de impersonação em vigência.
   * FASE 1.1: Stub/Contrato oficial da API.
   */
  static async validateImpersonation(
    _tokenOrSessionId: string
  ): Promise<{ valid: boolean; session?: ImpersonationSessionRecord; error?: string }> {
    return {
      valid: false,
      error: 'Not Implemented: ImpersonationService.validateImpersonation() será ativado na Fase 2.',
    };
  }

  /**
   * Encerra a sessão de impersonação ativa e restaura a identidade nativa do Super Admin.
   * FASE 1.1: Stub/Contrato oficial da API.
   */
  static async endImpersonation(
    _sessionId: string,
    _endedBy: ImpersonationEndedReason = 'user_action'
  ): Promise<boolean> {
    throw new Error('Not Implemented: ImpersonationService.endImpersonation() será ativado na Fase 2.');
  }

  /**
   * Verifica no contexto do cliente/servidor se há uma impersonação em andamento.
   * FASE 1.1: Stub/Contrato oficial da API.
   */
  static isImpersonating(): boolean {
    return false;
  }

  /**
   * Retorna os dados do Super Admin original que iniciou a impersonação.
   * FASE 1.1: Stub/Contrato oficial da API.
   */
  static getOriginalAdmin(): { id: string; email: string; role: 'super_admin' } | null {
    return null;
  }
}
