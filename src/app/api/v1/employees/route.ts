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

async function listEmployeesFallback(
  supabase: any,
  ministryId: string,
  page: number,
  limit: number,
  status: string | null,
  grupo: string | null,
  accessibleMemberIds: string[] | null,
) {
  const offset = (page - 1) * limit

  let employeesQuery = supabase
    .from('employees')
    .select('*', { count: 'exact' })
    .eq('ministry_id', ministryId)

  if (accessibleMemberIds !== null) {
    employeesQuery = accessibleMemberIds.length > 0
      ? employeesQuery.in('member_id', accessibleMemberIds)
      : employeesQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  }
  if (status) employeesQuery = employeesQuery.eq('status', status)
  if (grupo) employeesQuery = employeesQuery.eq('grupo', grupo)

  employeesQuery = employeesQuery
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false })

  const { data: employeesRows, error: employeesErr, count } = await employeesQuery
  if (employeesErr) throw employeesErr

  const rows = (employeesRows as any[]) || []
  const memberIds = Array.from(new Set(rows.map((row: any) => row.member_id).filter(Boolean)))

  let membersMap = new Map<string, any>()
  if (memberIds.length > 0) {
    const { data: membersRows, error: membersErr } = await supabase
      .from('members')
      .select('id,name,cpf,phone,birth_date')
      .eq('ministry_id', ministryId)
      .in('id', memberIds)

    if (!membersErr) {
      membersMap = new Map(((membersRows as any[]) || []).map((member: any) => [String(member.id), member]))
    }
  }

  return {
    data: rows.map((row: any) => {
      const member = membersMap.get(String(row.member_id))
      return {
        ...row,
        member_name: member?.name || null,
        member_cpf: member?.cpf || null,
        member_phone: member?.phone || null,
        member_birth_date: member?.birth_date || null,
      }
    }),
    count: count || 0,
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context
    const accessibleMemberIds = await getAccessibleMemberIds(context)

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const grupo = searchParams.get('grupo')
    const offset = (page - 1) * limit

    let query = supabase
      .from('employees_with_member_info')
      .select('*', { count: 'exact' })
      .eq('ministry_id', ministryId)

    if (accessibleMemberIds !== null) {
      query = accessibleMemberIds.length > 0
        ? query.in('member_id', accessibleMemberIds)
        : query.eq('id', '00000000-0000-0000-0000-000000000000')
    }
    if (status) query = query.eq('status', status)
    if (grupo) query = query.eq('grupo', grupo)

    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      if (isMissingEmployeesViewError(error)) {
        try {
          const fallback = await listEmployeesFallback(supabase, ministryId, page, limit, status, grupo, accessibleMemberIds)
          return NextResponse.json({
            data: fallback.data,
            count: fallback.count,
            page,
            limit,
            total_pages: Math.ceil((fallback.count || 0) / limit),
          })
        } catch (fallbackErr: any) {
          return NextResponse.json(
            { error: getSupabaseErrorText(fallbackErr) || 'Estrutura de funcionarios indisponivel no Supabase' },
            { status: 400 }
          )
        }
      }
      return NextResponse.json(
        { error: getSupabaseErrorText(error) || error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data,
      count,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    })
  } catch (error: any) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context

    const body = await request.json()
    const normalizedBody = normalizePayloadToUppercase(body, {
      preserveKeys: ['data_admissao', 'email', 'member_id'],
    })

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
      status = 'ATIVO',
    } = normalizedBody

    if (!member_id || !grupo || !funcao || !data_admissao) {
      return NextResponse.json(
        { error: 'Campo(s) obrigatorio(s) faltando: member_id, grupo, funcao, data_admissao' },
        { status: 400 }
      )
    }

    const accessibleMemberIds = await getAccessibleMemberIds(context)
    if (accessibleMemberIds !== null && !accessibleMemberIds.includes(String(member_id))) {
      return forbiddenResponse()
    }

    const { data, error } = await supabase
      .from('employees')
      .insert([{
        ministry_id: ministryId,
        member_id,
        grupo,
        funcao,
        data_admissao,
        email: typeof email === 'string' ? email.toLowerCase().trim() || null : email,
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
        status,
      }])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { data, message: 'Funcionario criado com sucesso' },
      { status: 201 }
    )
  } catch (error: any) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
