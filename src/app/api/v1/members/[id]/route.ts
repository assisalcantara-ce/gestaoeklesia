/**
 * API ROUTE: Operações em Membro Individual
 * GET /api/v1/members/:id  - Obter um membro
 * PUT /api/v1/members/:id  - Atualizar membro
 * DELETE /api/v1/members/:id - Deletar membro
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

/**
 * GET: Obter um membro pelo ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Membro não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/v1/members/:id:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PUT: Atualizar membro
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
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

    // Verificar se membro existe
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Membro não encontrado' },
        { status: 404 }
      )
    }

    // Atualizar
    const { data, error } = await supabase
      .from('members')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma linha atualizada' },
        { status: 404 }
      )
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error('PUT /api/v1/members/:id:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Deletar membro
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    // Verificar se existe
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Membro não encontrado' },
        { status: 404 }
      )
    }

    // Deletar
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, deleted_id: id })
  } catch (error) {
    console.error('DELETE /api/v1/members/:id:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
