import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAuth } from '@/lib/tenant-auth'
import { authTenantErrorResponse } from '@/lib/api-errors'

function requestMeta(request: NextRequest) {
  return {
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'desconhecido',
    userAgent: request.headers.get('user-agent') || 'desconhecido',
  }
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

function sanitizeAuditData(data: any): any {
  if (!data || typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map(sanitizeAuditData)
  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes('password') ||
      lowerKey.includes('senha') ||
      lowerKey.includes('token')
    ) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeAuditData(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request)
    const { admin, ministryId, userId } = context
    const body = await request.json()
    const { ip, userAgent } = requestMeta(request)

    const status = body.status || 'sucesso'
    const statusCode = status === 'erro' ? 500 : status === 'aviso' ? 400 : 200
    const mappedAction = actionMap[body.acao] || 'READ'

    const cleanDadosAnteriores = sanitizeAuditData(body.dados_anteriores) || null
    const cleanDadosNovos = sanitizeAuditData(body.dados_novos) || null

    const tryInsert = async (payload: Record<string, any>) => {
      const { error } = await admin.from('audit_logs').insert(payload)
      return error || null
    }

    let error = await tryInsert({
      ministry_id: ministryId,
      usuario_id: userId,
      usuario_email: body.usuario_email || null,
      acao: body.acao,
      modulo: body.modulo,
      area: body.area || null,
      tabela_afetada: body.tabela_afetada || null,
      registro_id: body.registro_id || null,
      descricao: body.descricao || null,
      dados_anteriores: cleanDadosAnteriores,
      dados_novos: cleanDadosNovos,
      ip_address: ip,
      user_agent: userAgent,
      status,
      mensagem_erro: body.mensagem_erro || null,
      user_id: userId,
      action: mappedAction,
      resource_type: body.modulo || body.tabela_afetada || 'geral',
      resource_id: body.registro_id || null,
      old_data: cleanDadosAnteriores,
      new_data: cleanDadosNovos,
      status_code: statusCode,
      error_message: body.mensagem_erro || null,
    })

    if (!error) {
      return NextResponse.json({ success: true, message: 'Log registrado' })
    }

    error = await tryInsert({
      ministry_id: ministryId,
      usuario_id: userId,
      usuario_email: body.usuario_email || null,
      acao: body.acao,
      modulo: body.modulo,
      area: body.area,
      tabela_afetada: body.tabela_afetada,
      registro_id: body.registro_id,
      descricao: body.descricao,
      dados_anteriores: cleanDadosAnteriores,
      dados_novos: cleanDadosNovos,
      ip_address: ip,
      user_agent: userAgent,
      status,
      mensagem_erro: body.mensagem_erro,
    })

    if (!error) {
      return NextResponse.json({ success: true, message: 'Log registrado (legado)' })
    }

    if (error.code === 'PGRST116' || error.message?.includes('not found')) {
      return NextResponse.json(
        { message: 'Tabela de auditoria indisponivel' },
        { status: 202 },
      )
    }

    console.error('Falha ao registrar auditoria:', error)
    return NextResponse.json(
      { success: false, message: 'Falha ao registrar auditoria' },
      { status: 200 },
    )
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('Erro ao registrar auditoria:', error)
    return NextResponse.json(
      { success: false, message: 'Falha ao registrar auditoria' },
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request)
    const { admin, ministryId, userId } = context
    const { searchParams } = new URL(request.url)
    const acao = searchParams.get('acao')
    const modulo = searchParams.get('modulo')
    const status = searchParams.get('status')
    const usuarioEmail = searchParams.get('usuario_email')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    let query = admin
      .from('audit_logs')
      .select('*')
      .eq('ministry_id', ministryId)

    if (context.nivel !== 'administrador' && context.nivel !== 'presidencia' && context.nivel !== 'conselho_fiscal') {
      query = query.eq('usuario_id', userId)
    }

    if (acao) query = query.eq('acao', acao)
    if (modulo) query = query.eq('modulo', modulo)
    if (status) query = query.eq('status', status)
    if (usuarioEmail) query = query.ilike('usuario_email', `%${usuarioEmail}%`)
    if (dataInicio) query = query.gte('data_criacao', dataInicio)
    if (dataFim) query = query.lte('data_criacao', dataFim)

    let { data, error } = await query
      .order('data_criacao', { ascending: false })
      .limit(500)

    if (error) {
      let fallbackQuery = admin
        .from('audit_logs')
        .select('*')
        .eq('ministry_id', ministryId)

      if (context.nivel !== 'administrador' && context.nivel !== 'presidencia' && context.nivel !== 'conselho_fiscal') {
        fallbackQuery = fallbackQuery.eq('user_id', userId)
      }

      if (acao) fallbackQuery = fallbackQuery.eq('action', actionMap[acao] || acao)
      if (modulo) fallbackQuery = fallbackQuery.eq('resource_type', modulo)
      if (status) {
        const statusCode = status === 'erro' ? 500 : status === 'aviso' ? 400 : 200
        fallbackQuery = fallbackQuery.eq('status_code', statusCode)
      }
      if (dataInicio) fallbackQuery = fallbackQuery.gte('created_at', dataInicio)
      if (dataFim) fallbackQuery = fallbackQuery.lte('created_at', dataFim)

      const fallback = await fallbackQuery
        .order('created_at', { ascending: false })
        .limit(500)

      data = fallback.data
      error = fallback.error
    }

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('not found')) {
        return NextResponse.json({ logs: [], message: 'Tabela de auditoria indisponivel' })
      }
      throw error
    }

    return NextResponse.json({ logs: data || [] })
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('Erro ao buscar auditoria:', error)
    return NextResponse.json({ error: 'Erro ao buscar logs' }, { status: 500 })
  }
}
