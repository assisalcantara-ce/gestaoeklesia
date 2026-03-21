/**
 * API ROUTE: Gerenciar Funcionário por ID
 * GET /api/v1/employees/[id] - Obter funcionário
 * DELETE /api/v1/employees/[id] - Deletar funcionário
 * PATCH /api/v1/employees/[id] - Atualizar funcionário
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
      .from('employees_with_member_info')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: 'Funcionário deletado com sucesso' },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const { data, error } = await supabase
      .from('employees')
      .update(body)
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

    return NextResponse.json(
      { data, message: 'Funcionário atualizado com sucesso' },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
