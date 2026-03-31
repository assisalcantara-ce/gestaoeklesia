/**
 * API ROUTE: Gerenciar Funcionário por ID
 * GET /api/v1/employees/[id] - Obter funcionário
 * DELETE /api/v1/employees/[id] - Deletar funcionário
 * PATCH /api/v1/employees/[id] - Atualizar funcionário
 */

import { createServerClientFromRequest } from '@/lib/supabase-server'
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseErrorText(error: any): string {
  if (!error) return ''
  const parts = [
    error?.code ? `(${String(error.code)})` : '',
    error?.message ? String(error.message) : '',
    error?.details ? String(error.details) : '',
    error?.hint ? String(error.hint) : '',
  ].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  try {
    const s = JSON.stringify(error)
    return s && s !== '{}' ? s : String(error)
  } catch {
    return String(error)
  }
}

function isMissingEmployeesViewError(error: any): boolean {
  const text = getSupabaseErrorText(error).toLowerCase()
  return (
    text.includes('employees_with_member_info') &&
    (text.includes('pgrst205') || text.includes('schema cache') || text.includes('could not find the table') || text.includes('does not exist'))
  )
}

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
      if (isMissingEmployeesViewError(error)) {
        const { data: employee, error: employeeErr } = await supabase
          .from('employees')
          .select('*')
          .eq('id', id)
          .eq('ministry_id', ministryId)
          .single()

        if (employeeErr || !employee) {
          return NextResponse.json(
            { error: getSupabaseErrorText(employeeErr) || 'Funcionário não encontrado' },
            { status: 404 }
          )
        }

        let memberData: any = null
        if ((employee as any).member_id) {
          const { data: m, error: mErr } = await supabase
            .from('members')
            .select('id,name,cpf,phone,birth_date')
            .eq('ministry_id', ministryId)
            .eq('id', (employee as any).member_id)
            .maybeSingle()

          if (!mErr) memberData = m
        }

        return NextResponse.json({
          data: {
            ...(employee as any),
            member_name: memberData?.name || null,
            member_cpf: memberData?.cpf || null,
            member_phone: memberData?.phone || null,
            member_birth_date: memberData?.birth_date || null,
          }
        })
      }
      return NextResponse.json(
        { error: getSupabaseErrorText(error) || error.message },
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
    const normalizedBody = normalizePayloadToUppercase(body, {
      preserveKeys: ['data_admissao'],
    }) as Record<string, any>

    if (typeof normalizedBody.email === 'string') {
      normalizedBody.email = normalizedBody.email.toLowerCase()
    }

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
      .update(normalizedBody)
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
