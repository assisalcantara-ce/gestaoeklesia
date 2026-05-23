import { getAccessibleMemberIds, resolveTenantAuth } from '@/lib/tenant-auth'
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer'
import { authTenantErrorResponse, forbiddenResponse } from '@/lib/api-errors'
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
    const text = JSON.stringify(error)
    return text && text !== '{}' ? text : String(error)
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

function applyEmployeeMemberScope(query: any, accessibleMemberIds: string[] | null) {
  if (accessibleMemberIds === null) return query
  return accessibleMemberIds.length > 0
    ? query.in('member_id', accessibleMemberIds)
    : query.eq('id', '00000000-0000-0000-0000-000000000000')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context
    const accessibleMemberIds = await getAccessibleMemberIds(context)

    let query = supabase
      .from('employees_with_member_info')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)

    query = applyEmployeeMemberScope(query, accessibleMemberIds)

    const { data, error } = await query.single()

    if (error) {
      if (isMissingEmployeesViewError(error)) {
        let employeeQuery = supabase
          .from('employees')
          .select('*')
          .eq('id', id)
          .eq('ministry_id', ministryId)

        employeeQuery = applyEmployeeMemberScope(employeeQuery, accessibleMemberIds)
        const { data: employee, error: employeeErr } = await employeeQuery.single()

        if (employeeErr || !employee) {
          return NextResponse.json(
            { error: getSupabaseErrorText(employeeErr) || 'Funcionario nao encontrado' },
            { status: 404 }
          )
        }

        let memberData: any = null
        if ((employee as any).member_id) {
          const { data: member, error: memberErr } = await supabase
            .from('members')
            .select('id,name,cpf,phone,birth_date')
            .eq('ministry_id', ministryId)
            .eq('id', (employee as any).member_id)
            .maybeSingle()

          if (!memberErr) memberData = member
        }

        return NextResponse.json({
          data: {
            ...(employee as any),
            member_name: memberData?.name || null,
            member_cpf: memberData?.cpf || null,
            member_phone: memberData?.phone || null,
            member_birth_date: memberData?.birth_date || null,
          },
        })
      }
      return NextResponse.json(
        { error: getSupabaseErrorText(error) || error.message },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context
    const accessibleMemberIds = await getAccessibleMemberIds(context)

    let query = supabase
      .from('employees')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId)

    query = applyEmployeeMemberScope(query, accessibleMemberIds)
    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { message: 'Funcionario deletado com sucesso' },
      { status: 200 }
    )
  } catch (error: any) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context

    const body = await request.json()
    const normalizedBody = normalizePayloadToUppercase(body, {
      preserveKeys: ['data_admissao', 'email', 'member_id'],
    }) as Record<string, any>

    if (typeof normalizedBody.email === 'string') {
      normalizedBody.email = normalizedBody.email.toLowerCase().trim() || undefined
    }

    const accessibleMemberIds = await getAccessibleMemberIds(context)
    if (accessibleMemberIds !== null) {
      const targetMemberId = normalizedBody.member_id
        ? String(normalizedBody.member_id)
        : await resolveCurrentEmployeeMemberId(supabase, ministryId, id)

      if (!targetMemberId || !accessibleMemberIds.includes(targetMemberId)) {
        return forbiddenResponse()
      }
    }

    let query = supabase
      .from('employees')
      .update(normalizedBody)
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .select()

    query = applyEmployeeMemberScope(query, accessibleMemberIds)
    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha atualizada' }, { status: 404 })
    }

    return NextResponse.json(
      { data, message: 'Funcionario atualizado com sucesso' },
      { status: 200 }
    )
  } catch (error: any) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function resolveCurrentEmployeeMemberId(supabase: any, ministryId: string, employeeId: string): Promise<string | null> {
  const { data } = await supabase
    .from('employees')
    .select('member_id')
    .eq('id', employeeId)
    .eq('ministry_id', ministryId)
    .maybeSingle()

  return data?.member_id ? String(data.member_id) : null
}
