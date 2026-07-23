import { createServerClient } from '@/lib/supabase-server';
import {
  signImpersonationToken,
  verifyImpersonationToken,
  ImpersonationTokenPayload,
} from './impersonation-jwt';

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
  originalAdminRole: string;
  targetTenantId: string;
  reason: string;
  readOnly?: boolean;
  ip?: string;
  userAgent?: string;
  durationMinutes?: number;
}

export interface StartImpersonationResult {
  token: string;
  expiresAt: string;
  sessionId: string;
  sessionRecord: ImpersonationSessionRecord;
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
   * 1. Valida role === 'super_admin'
   * 2. Valida motivo (mínimo 5 caracteres)
   * 3. Valida se o tenant/ministério existe no banco
   * 4. Registra sessão em admin_impersonation_sessions
   * 5. Emite JWT exclusivo de impersonação (30 min)
   */
  static async startImpersonation(
    input: StartImpersonationInput
  ): Promise<StartImpersonationResult> {
    if (!this.isRoleAuthorizedForImpersonation(input.originalAdminRole)) {
      throw new Error(
        'Acesso negado: Apenas o perfil SUPER_ADMIN possui permissão para assumir sessão de um tenant.'
      );
    }

    if (!input.reason || input.reason.trim().length < 5) {
      throw new Error(
        'Justificativa obrigatória: Um motivo detalhado (mínimo 5 caracteres) é exigido para auditoria.'
      );
    }

    const supabase = createServerClient();

    // Validar se o ministério/tenant alvo existe
    const { data: tenant, error: tenantError } = await supabase
      .from('ministries')
      .select('id, name')
      .eq('id', input.targetTenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error(
        `Tenant de destino não encontrado no banco de dados (ID: ${input.targetTenantId}).`
      );
    }

    const jwtId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const readOnly = !!input.readOnly;
    const ip = input.ip || '127.0.0.1';
    const userAgent = input.userAgent || 'Unknown';

    // Inserir registro de sessão na tabela admin_impersonation_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('admin_impersonation_sessions')
      .insert({
        admin_id: input.originalAdminId,
        tenant_id: input.targetTenantId,
        started_at: startedAt,
        reason: input.reason.trim(),
        read_only: readOnly,
        ip,
        user_agent: userAgent,
        jwt_id: jwtId,
        status: 'active',
      })
      .select('*')
      .single();

    if (sessionError || !sessionData) {
      console.error('Erro ao gravar admin_impersonation_sessions:', sessionError);
      throw new Error(
        `Falha ao registrar sessão de impersonação no banco: ${
          sessionError?.message || 'Erro desconhecido'
        }`
      );
    }

    // Assinar JWT exclusivo de impersonação (30 minutos)
    const { token, expiresAt } = signImpersonationToken({
      sessionId: sessionData.id,
      originalAdminId: input.originalAdminId,
      targetTenantId: input.targetTenantId,
      readOnly,
      durationMinutes: input.durationMinutes || 30,
    });

    const sessionRecord: ImpersonationSessionRecord = {
      id: sessionData.id,
      adminId: sessionData.admin_id,
      adminEmail: input.originalAdminEmail,
      tenantId: sessionData.tenant_id,
      tenantName: tenant.name,
      startedAt: sessionData.started_at,
      endedAt: sessionData.ended_at,
      endedBy: sessionData.ended_by,
      reason: sessionData.reason,
      readOnly: sessionData.read_only,
      ip: sessionData.ip,
      userAgent: sessionData.user_agent,
      jwtId: sessionData.jwt_id,
      status: sessionData.status,
    };

    return {
      token,
      expiresAt,
      sessionId: sessionData.id,
      sessionRecord,
    };
  }

  /**
   * Valida a integridade, expiração e status de uma sessão/token de impersonação em vigência.
   */
  static async validateImpersonation(token: string): Promise<{
    valid: boolean;
    session?: ImpersonationSessionRecord;
    payload?: ImpersonationTokenPayload;
    status: 'active' | 'expired' | 'revoked' | 'invalid';
    error?: string;
  }> {
    const result = verifyImpersonationToken(token);

    if (!result.valid || !result.payload) {
      // Se o token expirou pelo timestamp JWT, verificar se a sessão no banco precisa ser marcada como expirada
      if (result.error === 'EXPIRED' && result.payload?.sessionId) {
        try {
          const supabase = createServerClient();
          await supabase
            .from('admin_impersonation_sessions')
            .update({
              status: 'expired',
              ended_at: new Date().toISOString(),
              ended_by: 'timeout',
            })
            .eq('id', result.payload.sessionId)
            .eq('status', 'active');
        } catch (e) {
          console.warn('Erro ao atualizar status de sessão expirada:', e);
        }
        return {
          valid: false,
          payload: result.payload,
          status: 'expired',
          error: 'Sessão de impersonação expirada por limite de tempo (30 min).',
        };
      }

      return {
        valid: false,
        status: 'invalid',
        error: `Token de impersonação inválido ou malformado (${result.error || 'INVALID'}).`,
      };
    }

    const payload = result.payload;
    const supabase = createServerClient();

    // Buscar a sessão no banco para verificar revogação ou encerramento manual
    const { data: dbSession, error: dbError } = await supabase
      .from('admin_impersonation_sessions')
      .select('*, ministries(name), admin_users(email)')
      .eq('id', payload.sessionId)
      .single();

    if (dbError || !dbSession) {
      return {
        valid: false,
        payload,
        status: 'invalid',
        error: 'Sessão de impersonação não encontrada no banco de dados.',
      };
    }

    if (dbSession.status !== 'active') {
      const statusMapped = dbSession.status === 'revoked' ? 'revoked' : 'expired';
      return {
        valid: false,
        payload,
        status: statusMapped,
        error: `A sessão de impersonação foi ${
          dbSession.status === 'revoked' ? 'revogada por segurança' : 'encerrada'
        }.`,
      };
    }

    const sessionRecord: ImpersonationSessionRecord = {
      id: dbSession.id,
      adminId: dbSession.admin_id,
      adminEmail: dbSession.admin_users?.email || '',
      tenantId: dbSession.tenant_id,
      tenantName: dbSession.ministries?.name || '',
      startedAt: dbSession.started_at,
      endedAt: dbSession.ended_at,
      endedBy: dbSession.ended_by,
      reason: dbSession.reason,
      readOnly: dbSession.read_only,
      ip: dbSession.ip,
      userAgent: dbSession.user_agent,
      jwtId: dbSession.jwt_id,
      status: dbSession.status,
    };

    return {
      valid: true,
      session: sessionRecord,
      payload,
      status: 'active',
    };
  }

  /**
   * Encerra a sessão de impersonação ativa e grava o motivo do término.
   */
  static async endImpersonation(
    sessionId: string,
    endedBy: ImpersonationEndedReason = 'user_action'
  ): Promise<{ success: boolean; session?: ImpersonationSessionRecord }> {
    if (!sessionId) {
      throw new Error('ID da sessão de impersonação é obrigatório.');
    }

    const supabase = createServerClient();
    const endedAt = new Date().toISOString();

    const { data: updatedSession, error } = await supabase
      .from('admin_impersonation_sessions')
      .update({
        status: 'completed',
        ended_at: endedAt,
        ended_by: endedBy,
      })
      .eq('id', sessionId)
      .select('*, ministries(name), admin_users(email)')
      .single();

    if (error) {
      console.error('Erro ao encerrar admin_impersonation_sessions:', error);
      throw new Error(`Falha ao encerrar sessão de impersonação: ${error.message}`);
    }

    const sessionRecord: ImpersonationSessionRecord = {
      id: updatedSession.id,
      adminId: updatedSession.admin_id,
      adminEmail: updatedSession.admin_users?.email || '',
      tenantId: updatedSession.tenant_id,
      tenantName: updatedSession.ministries?.name || '',
      startedAt: updatedSession.started_at,
      endedAt: updatedSession.ended_at,
      endedBy: updatedSession.ended_by,
      reason: updatedSession.reason,
      readOnly: updatedSession.read_only,
      ip: updatedSession.ip,
      userAgent: updatedSession.user_agent,
      jwtId: updatedSession.jwt_id,
      status: updatedSession.status,
    };

    return { success: true, session: sessionRecord };
  }

  /**
   * Helper para checar se a sessão atual no contexto é impersonada.
   */
  static isImpersonating(): boolean {
    return false;
  }

  /**
   * Helper para obter os dados do Super Admin original.
   */
  static getOriginalAdmin(): { id: string; email: string; role: 'super_admin' } | null {
    return null;
  }
}
