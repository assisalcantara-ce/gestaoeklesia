/**
 * API ROUTE: Listar / Criar Membros
 * GET  /api/v1/members
 * POST /api/v1/members
 *
 * Multi-tenancy:
 * - O `ministry_id` é resolvido no servidor a partir do usuário autenticado (ministry_users).
 * - Evita depender de `ministry_id` vindo do cliente.
 */

import { createServerClientFromRequest } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

async function resolveMinistryId(supabase: any, userId: string): Promise<string | null> {
  // 1) Preferencial: ministry_users
  const { data: mu, error: muErr } = await supabase
    .from('ministry_users')
    .select('ministry_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!muErr && mu?.ministry_id) return String(mu.ministry_id)

  // 2) Fallback: owner em ministries
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
    const search = searchParams.get('search')
    const tipoCadastro = searchParams.get('tipoCadastro')

    const offset = (page - 1) * limit

    // Construir query - FILTRAR SEMPRE POR MINISTRY_ID
    let query = supabase
      .from('members')
      .select('*', { count: 'exact' })
      .eq('ministry_id', ministryId)

    // Aplicar filtros
    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    if (tipoCadastro) {
      const tipo = String(tipoCadastro).toLowerCase()
      query = query.eq('role', tipo)
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
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/v1/members:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * API ROUTE: Criar Membro
 * POST /api/v1/members
 * 
 * Body esperado:
 * {
 *   "name": "João Silva",
 *   "email": "joao@exemplo.com",
 *   "phone": "11999999999",
 *   "cpf": "12345678901",
 *   "birth_date": "1990-01-15",
 *   "gender": "M",
 *   "marital_status": "single",
 *   "address": "Rua X, 123",
 *   "city": "São Paulo",
 *   "state": "SP"
 * }
 * 
 * ⚠️  Necessário estar autenticado e ter ministry_id no JWT
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClientFromRequest(request)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const ministryId = await resolveMinistryId(supabase, user.id)
    if (!ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado', code: 'NO_MINISTRY' },
        { status: 403 }
      )
    }

    // Validar campos obrigatórios
    if (!body.name) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    // Inserir membro
    const { data, error } = await supabase
      .from('members')
      .insert([
        {
          ministry_id: ministryId,
          name: body.name,
          email: body.email || null,
          phone: body.phone || null,
          cpf: body.cpf || null,
          birth_date: body.birth_date || null,
          gender: body.gender || null,
          marital_status: body.marital_status || null,
          occupation: body.occupation || null,
          address: body.address || null,
          complement: body.complement || null,
          city: body.city || null,
          state: body.state || null,
          zipcode: body.zipcode || null,
          latitude: typeof body.latitude === 'number' ? body.latitude : null,
          longitude: typeof body.longitude === 'number' ? body.longitude : null,
          member_since: body.member_since || new Date(),
          role: body.role || null,
          status: body.status || 'active',
          custom_fields: body.custom_fields || {},
          notes: body.notes || null,
        },
      ])
      .select()

    // Compatibilidade: bases que ainda não têm colunas latitude/longitude
    if (error && /column\s+"?(latitude|longitude)"?\s+of\s+relation\s+"?members"?\s+does\s+not\s+exist/i.test(error.message)) {
      const { data: data2, error: error2 } = await supabase
        .from('members')
        .insert([
          {
            ministry_id: ministryId,
            name: body.name,
            email: body.email || null,
            phone: body.phone || null,
            cpf: body.cpf || null,
            birth_date: body.birth_date || null,
            gender: body.gender || null,
            marital_status: body.marital_status || null,
            occupation: body.occupation || null,
            address: body.address || null,
            complement: body.complement || null,
            city: body.city || null,
            state: body.state || null,
            zipcode: body.zipcode || null,
            member_since: body.member_since || new Date(),
            role: body.role || null,
            status: body.status || 'active',
            custom_fields: body.custom_fields || {},
            notes: body.notes || null,
          },
        ])
        .select()

      if (error2) {
        return NextResponse.json({ error: error2.message }, { status: 400 })
      }

      return NextResponse.json(data2[0], { status: 201 })
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('POST /api/v1/members:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
