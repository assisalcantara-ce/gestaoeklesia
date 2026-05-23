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
  importar: 'EXPORT',
  responder: 'UPDATE',
  login: 'LOGIN',
  logout: 'LOGOUT',
  download: 'DOWNLOAD',
  upload: 'UPDATE',
  outro: 'READ',
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

    const tryInsert = async (payload: Record<string, any>) => {
      const { error } = await admin.from('audit_logs').insert(payload)
      return error || null
    }

    let error = await tryInsert({
      ministry_id: ministryId,
      user_id: userId,
      action: mappedAction,
      resource_type: body.modulo || body.tabela_afetada || 'geral',
      resource_id: body.registro_id || null,
      old_data: body.dados_anteriores || null,
      new_data: body.dados_novos || null,
      changes: null,
      ip_address: ip,
      user_agent: userAgent,
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
      dados_anteriores: body.dados_anteriores,
      dados_novos: body.dados_novos,
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

    if (context.nivel === 'administrador') {
      query = query.eq('ministry_id', ministryId)
    } else {
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

      if (context.nivel === 'administrador') {
        fallbackQuery = fallbackQuery.eq('ministry_id', ministryId)
      } else {
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
