import { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction =
  | 'criar'
  | 'editar'
  | 'deletar'
  | 'visualizar'
  | 'exportar'
  | 'importar'
  | 'responder'
  | 'login'
  | 'logout'
  | 'atualizar_status'
  | 'atualizar_permissoes'
  | 'reclassificar'
  | 'download'
  | 'upload'
  | 'outro'

export type AuditStatus = 'sucesso' | 'erro' | 'aviso'

export interface ServerAuditLogParams {
  ministryId: string
  userId?: string | null
  userEmail?: string | null
  acao: AuditAction
  modulo: string
  area?: string | null
  tabelaAfetada?: string | null
  registroId?: string | null
  descricao?: string | null
  dadosAnteriores?: Record<string, any> | null
  dadosNovos?: Record<string, any> | null
  status?: AuditStatus
  mensagemErro?: string | null
  ip?: string | null
  userAgent?: string | null
}

const actionMap: Record<string, string> = {
  criar: 'CREATE',
  editar: 'UPDATE',
  deletar: 'DELETE',
  visualizar: 'READ',
  exportar: 'EXPORT',
  importar: 'IMPORT',
  responder: 'UPDATE',
  login: 'LOGIN',
  logout: 'LOGOUT',
  atualizar_status: 'UPDATE',
  atualizar_permissoes: 'UPDATE',
  reclassificar: 'UPDATE',
  download: 'DOWNLOAD',
  upload: 'UPLOAD',
  outro: 'READ',
}

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'hash',
  'api_key',
  'apikey',
  'auth_token',
  'jwt',
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toValidUuidOrNull(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function toValidIpOrNull(ip?: string | null): string | null {
  if (!ip || typeof ip !== 'string') return null;
  const trimmed = ip.trim();
  // Se for "unknown", "localhost", ou lista de proxies "1.2.3.4, 5.6.7.8"
  if (trimmed.includes(',')) {
    const first = trimmed.split(',')[0].trim();
    return toValidIpOrNull(first);
  }
  if (trimmed === '::1' || trimmed === '127.0.0.1') return trimmed;
  // Regex básica para IPv4 ou IPv6
  const isIpv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(trimmed);
  const isIpv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(trimmed);
  return isIpv4 || isIpv6 ? trimmed : null;
}

export function sanitizeAuditData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item))
  }

  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('senha') || lowerKey.includes('token')) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeAuditData(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Registra uma entrada na tabela audit_logs usando o cliente admin (service_role ou contexto autenticado).
 * Compatível tanto com o esquema atual (usuario_id, modulo, acao, etc.) quanto com o esquema legado.
 */
export async function logServerAudit(
  adminClient: SupabaseClient,
  params: ServerAuditLogParams
): Promise<void> {
  try {
    const validMinistryId = toValidUuidOrNull(params.ministryId);
    if (!validMinistryId) {
      console.warn('[AuditLogger] ministryId inválido (deve ser UUID), pulando log de auditoria:', params.ministryId);
      return;
    }

    const status = params.status || 'sucesso';
    const statusCode = status === 'erro' ? 500 : status === 'aviso' ? 400 : 200;
    const mappedAction = actionMap[params.acao] || 'READ';

    const cleanDadosAnteriores = sanitizeAuditData(params.dadosAnteriores);
    const cleanDadosNovos = sanitizeAuditData(params.dadosNovos);

    const validUserId = toValidUuidOrNull(params.userId);
    const validRegistroId = toValidUuidOrNull(params.registroId);
    const validIp = toValidIpOrNull(params.ip);

    // Se registroId não for UUID (ex: REG-2026-000001 ou código alfanumérico), preservamos no campo de descrição e dados novos
    let descricaoFinal = params.descricao || '';
    if (params.registroId && !validRegistroId && !descricaoFinal.includes(params.registroId)) {
      descricaoFinal = descricaoFinal ? `${descricaoFinal} [Ref: ${params.registroId}]` : `[Ref: ${params.registroId}]`;
    }

    const payloadAtual: Record<string, any> = {
      ministry_id: validMinistryId,
      usuario_id: validUserId,
      usuario_email: params.userEmail || null,
      acao: params.acao,
      modulo: params.modulo,
      area: params.area || null,
      tabela_afetada: params.tabelaAfetada || null,
      registro_id: validRegistroId,
      descricao: descricaoFinal || null,
      dados_anteriores: cleanDadosAnteriores,
      dados_novos: cleanDadosNovos,
      ip_address: validIp,
      user_agent: params.userAgent || null,
      status,
      mensagem_erro: params.mensagemErro || null,
      // Suporte cruzado de colunas do esquema legado
      user_id: validUserId,
      action: mappedAction,
      resource_type: params.modulo || params.tabelaAfetada || 'geral',
      resource_id: validRegistroId,
      old_data: cleanDadosAnteriores,
      new_data: cleanDadosNovos,
      status_code: statusCode,
      error_message: params.mensagemErro || null,
    };

    const { error } = await adminClient.from('audit_logs').insert([payloadAtual]);

    if (error) {
      // Se a tabela tiver restrição de colunas, tenta payload estrito de esquema novo
      const { error: retryError } = await adminClient.from('audit_logs').insert([
        {
          ministry_id: validMinistryId,
          usuario_id: validUserId,
          usuario_email: params.userEmail || null,
          acao: params.acao,
          modulo: params.modulo,
          area: params.area || null,
          tabela_afetada: params.tabelaAfetada || null,
          registro_id: validRegistroId,
          descricao: descricaoFinal || null,
          dados_anteriores: cleanDadosAnteriores,
          dados_novos: cleanDadosNovos,
          status,
          mensagem_erro: params.mensagemErro || null,
        },
      ]);

      if (retryError) {
        // Tenta esquema legado alternativo
        const { error: legacyError } = await adminClient.from('audit_logs').insert([
          {
            ministry_id: validMinistryId,
            user_id: validUserId,
            action: mappedAction,
            resource_type: params.modulo,
            resource_id: validRegistroId,
            old_data: cleanDadosAnteriores,
            new_data: cleanDadosNovos,
            status_code: statusCode,
            error_message: params.mensagemErro || null,
          },
        ]);

        if (legacyError) {
          console.error('[AuditLogger] Falha crítica ao persistir log de auditoria em todos os esquemas:', {
            errorPrincipal: error?.message,
            retryError: retryError?.message,
            legacyError: legacyError?.message,
          });
        }
      }
    }
  } catch (err) {
    // Auditoria nunca interrompe a operação principal
    console.warn('[AuditLogger] Falha silenciosa ao registrar log:', err)
  }
}
