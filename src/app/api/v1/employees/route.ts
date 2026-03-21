/**
 * API ROUTE: Gerenciar Funcionários
 * GET /api/v1/employees - Listar funcionários
 * POST /api/v1/employees - Criar funcionário
 * 
 * Query params:
 * - ministry_id: ID do ministério (requerido)
 * - page: número da página (padrão: 1)
 * - limit: itens por página (padrão: 20)
 * - status: filtrar por status (ATIVO, INATIVO)
 * - grupo: filtrar por grupo
 */

import { createServerClientFromRequest } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

async function resolveMinistryId(supabase: any, userId: string): Promise<string | null> {
  const { data: mu, error: muErr } = await supabase
    .from('ministry_users')
    .select('ministry_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!muErr && mu?.ministry_id) return String(mu.ministry_id)

  const { data: m, error: mErr } = await supabase
    .from('ministries')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!mErr && m?.id) return String(m.id)

  return null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClientFromRequest(request)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ministryId = await resolveMinistryId(supabase, user.id)
    if (!ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado', code: 'NO_MINISTRY' },
        { status: 403 }
      )
    }

    // Extrair query params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const grupo = searchParams.get('grupo')

    const offset = (page - 1) * limit

    // Construir query
    let query = supabase
      .from('employees_with_member_info')
      .select('*', { count: 'exact' })
      .eq('ministry_id', ministryId)

    // Aplicar filtros
    if (status) {
      query = query.eq('status', status)
    }

    if (grupo) {
      query = query.eq('grupo', grupo)
    }

    // Aplicar paginação
    query = query.range(offset, offset + limit - 1)

    // Ordenar por data de criação
    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data,
      count,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit)
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientFromRequest(request)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ministryId = await resolveMinistryId(supabase, user.id)
    if (!ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado', code: 'NO_MINISTRY' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    const {
      member_id,
      grupo,
      funcao,
      data_admissao,
      email,
      telefone,
      whatsapp,
      rg,
      endereco,
      cep,
      bairro,
      cidade,
      uf,
      banco,
      agencia,
      conta_corrente,
      pix,
      obs,
      status = 'ATIVO'
    } = body

    // Validar campos obrigatórios
    if (!member_id || !grupo || !funcao || !data_admissao) {
      return NextResponse.json(
        { error: 'Campo(s) obrigatório(s) faltando: member_id, grupo, funcao, data_admissao' },
        { status: 400 }
      )
    }

    // Criar funcionário
    const { data, error } = await supabase
      .from('employees')
      .insert([
        {
          ministry_id: ministryId,
          member_id,
          grupo,
          funcao,
          data_admissao,
          email,
          telefone,
          whatsapp,
          rg,
          endereco,
          cep,
          bairro,
          cidade,
          uf,
          banco,
          agencia,
          conta_corrente,
          pix,
          obs,
          status
        }
      ])
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { data, message: 'Funcionário criado com sucesso' },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
