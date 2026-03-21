import { NextRequest, NextResponse } from 'next/server'
import { createServerClientFromRequest } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientFromRequest(request)

    // Obter usuário
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    // Obter empresa_id do usuário
    const { data: usuarioEmpresa } = await supabase
      .from('usuario_empresas')
      .select('empresa_id')
      .eq('usuario_id', user.id)
      .single()

    if (!usuarioEmpresa) {
      return NextResponse.json(
        { error: 'Usuário não associado a empresa' },
        { status: 400 },
      )
    }

    // Inserir log
    const { error } = await supabase.from('audit_logs').insert({
      empresa_id: usuarioEmpresa.empresa_id,
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

    if (error) {
      // Se tabela não existe, tenta criar
      if (error.code === 'PGRST116' || error.message?.includes('not found')) {
        // Tabela será criada automaticamente pelo endpoint de migração
        return NextResponse.json(
          { message: 'Tabela ainda não existe, será criada na próxima requisição' },
          { status: 202 },
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, message: 'Log registrado' })
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
    return NextResponse.json(
      { error: 'Erro ao registrar auditoria' },
      { status: 500 },
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

    // Obter empresa_id do usuário
    const { data: usuarioEmpresa } = await supabase
      .from('usuario_empresas')
      .select('empresa_id, eh_administrador')
      .eq('usuario_id', user.id)
      .single()

    if (!usuarioEmpresa) {
      return NextResponse.json(
        { error: 'Usuário não associado a empresa' },
        { status: 400 },
      )
    }

    // Montar query
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('empresa_id', usuarioEmpresa.empresa_id)

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
