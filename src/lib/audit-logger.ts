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
])

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
    if (!params.ministryId) {
      console.warn('[AuditLogger] ministryId ausente, pulando log de auditoria')
      return
    }

    const status = params.status || 'sucesso'
    const statusCode = status === 'erro' ? 500 : status === 'aviso' ? 400 : 200
    const mappedAction = actionMap[params.acao] || 'READ'

    const cleanDadosAnteriores = sanitizeAuditData(params.dadosAnteriores)
    const cleanDadosNovos = sanitizeAuditData(params.dadosNovos)

    const payloadAtual: Record<string, any> = {
      ministry_id: params.ministryId,
      usuario_id: params.userId || null,
      usuario_email: params.userEmail || null,
      acao: params.acao,
      modulo: params.modulo,
      area: params.area || null,
      tabela_afetada: params.tabelaAfetada || null,
      registro_id: params.registroId || null,
      descricao: params.descricao || null,
      dados_anteriores: cleanDadosAnteriores,
      dados_novos: cleanDadosNovos,
      ip_address: params.ip || null,
      user_agent: params.userAgent || null,
      status,
      mensagem_erro: params.mensagemErro || null,
      // Suporte cruzado de colunas do esquema legado
      user_id: params.userId || null,
      action: mappedAction,
      resource_type: params.modulo || params.tabelaAfetada || 'geral',
      resource_id: params.registroId || null,
      old_data: cleanDadosAnteriores,
      new_data: cleanDadosNovos,
      status_code: statusCode,
      error_message: params.mensagemErro || null,
    }

    const { error } = await adminClient.from('audit_logs').insert([payloadAtual])

    if (error) {
      // Se a tabela tiver restrição de colunas, tenta payload estrito de esquema novo
      const { error: retryError } = await adminClient.from('audit_logs').insert([
        {
          ministry_id: params.ministryId,
          usuario_id: params.userId || null,
          usuario_email: params.userEmail || null,
          acao: params.acao,
          modulo: params.modulo,
          area: params.area || null,
          tabela_afetada: params.tabelaAfetada || null,
          registro_id: params.registroId || null,
          descricao: params.descricao || null,
          dados_anteriores: cleanDadosAnteriores,
          dados_novos: cleanDadosNovos,
          status,
          mensagem_erro: params.mensagemErro || null,
        },
      ])

      if (retryError) {
        // Tenta esquema legado alternativo
        await adminClient.from('audit_logs').insert([
          {
            ministry_id: params.ministryId,
            user_id: params.userId || null,
            action: mappedAction,
            resource_type: params.modulo,
            resource_id: params.registroId || null,
            old_data: cleanDadosAnteriores,
            new_data: cleanDadosNovos,
            status_code: statusCode,
            error_message: params.mensagemErro || null,
          },
        ])
      }
    }
  } catch (err) {
    // Auditoria nunca interrompe a operação principal
    console.warn('[AuditLogger] Falha silenciosa ao registrar log:', err)
  }
}
