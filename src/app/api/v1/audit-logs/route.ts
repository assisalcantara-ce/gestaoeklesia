import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const authClient = createServerClientFromRequest(request)
    const adminClient = createServerClient()

    // Obter usuário
    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Parse do body
    const body = await request.json()

    // Obter IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'desconhecido'

    // Obter User Agent
    const userAgent = request.headers.get('user-agent') || 'desconhecido'

    const tryInsert = async (payload: Record<string, any>) => {
      const { error } = await adminClient.from('audit_logs').insert(payload)
      return error || null
    }

    // Inserir log (schema simplificado)
    let error = await tryInsert({
      usuario_id: user.id,
      usuario_email: body.usuario_email || user.email,
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
      status: body.status || 'sucesso',
      mensagem_erro: body.mensagem_erro,
    })

    if (!error) {
      return NextResponse.json({ success: true, message: 'Log registrado' })
    }

    // Se tabela não existe, tenta criar
    if (error.code === 'PGRST116' || error.message?.includes('not found')) {
      return NextResponse.json(
        { message: 'Tabela ainda não existe, será criada na próxima requisição' },
        { status: 202 },
      )
    }

    // Fallback para schema antigo (ministry-based)
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

    const resolveMinistryId = async () => {
      const { data: mu, error: muErr } = await adminClient
        .from('ministry_users')
        .select('ministry_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!muErr && mu?.ministry_id) return mu.ministry_id as string

      const { data: m, error: mErr } = await adminClient
        .from('ministries')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!mErr && m?.id) return m.id as string

      return null
    }

    const ministryId = await resolveMinistryId()

    if (!ministryId) {
      return NextResponse.json(
        { message: 'Audit log ignorado: ministry não encontrado' },
        { status: 202 },
      )
    }

    const status = body.status || 'sucesso'
    const statusCode = status === 'erro' ? 500 : status === 'aviso' ? 400 : 200
    const mappedAction = actionMap[body.acao] || 'READ'

    error = await tryInsert({
      ministry_id: ministryId,
      user_id: user.id,
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
      return NextResponse.json({ success: true, message: 'Log registrado (fallback)' })
    }

    // Fallback para schema empresa-based
    const resolveEmpresaId = async () => {
      const { data: ue, error: ueErr } = await adminClient
        .from('usuario_empresas')
        .select('empresa_id')
        .eq('usuario_id', user.id)
        .maybeSingle()

      if (!ueErr && ue?.empresa_id) return ue.empresa_id as string
      return null
    }

    const empresaId = await resolveEmpresaId()

    if (empresaId) {
      error = await tryInsert({
        empresa_id: empresaId,
        usuario_id: user.id,
        usuario_email: body.usuario_email || user.email,
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
        status: body.status || 'sucesso',
        mensagem_erro: body.mensagem_erro,
      })

      if (!error) {
        return NextResponse.json({ success: true, message: 'Log registrado (empresa)' })
      }
    }

    console.error('Falha ao registrar auditoria:', error)
    return NextResponse.json(
      { success: false, message: 'Falha ao registrar auditoria' },
      { status: 200 },
    )
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
    return NextResponse.json(
      { success: false, message: 'Falha ao registrar auditoria' },
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClientFromRequest(request)

    // Obter usuário
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Obter query params
    const { searchParams } = new URL(request.url)
    const acao = searchParams.get('acao')
    const modulo = searchParams.get('modulo')
    const status = searchParams.get('status')
    const usuario_email = searchParams.get('usuario_email')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    // Montar query
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('usuario_id', user.id)

    // Aplicar filtros
    if (acao) query = query.eq('acao', acao)
    if (modulo) query = query.eq('modulo', modulo)
    if (status) query = query.eq('status', status)
    if (usuario_email) query = query.ilike('usuario_email', `%${usuario_email}%`)

    // Filtro de data
    if (dataInicio) query = query.gte('data_criacao', dataInicio)
    if (dataFim) query = query.lte('data_criacao', dataFim)

    // Ordenar e limitar
    const { data, error } = await query
      .order('data_criacao', { ascending: false })
      .limit(500)

    if (error) {
      // Se tabela não existe
      if (error.code === 'PGRST116' || error.message?.includes('not found')) {
        return NextResponse.json(
          { logs: [], message: 'Tabela será criada automaticamente' },
          { status: 200 },
        )
      }
      throw error
    }

    return NextResponse.json({ logs: data || [] })
  } catch (error) {
    console.error('Erro ao buscar auditoria:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar logs' },
      { status: 500 },
    )
  }
}
