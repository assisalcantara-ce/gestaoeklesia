import { getAccessibleCongregacaoIds, resolveTenantAuth } from '@/lib/tenant-auth'
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer'
import { authTenantErrorResponse } from '@/lib/api-errors'
import { NextRequest, NextResponse } from 'next/server'

function buildMemberPayload(normalizedBody: Record<string, any>) {
  return {
    name: normalizedBody.name,
    email: typeof normalizedBody.email === 'string' ? normalizedBody.email.toLowerCase() : normalizedBody.email ?? null,
    phone: normalizedBody.phone ?? null,
    cpf: normalizedBody.cpf ?? null,
    matricula: normalizedBody.matricula ?? null,
    unique_id: normalizedBody.unique_id ?? null,
    tipo_cadastro: normalizedBody.tipo_cadastro ?? null,
    data_nascimento: normalizedBody.data_nascimento ?? null,
    sexo: normalizedBody.sexo ?? null,
    tipo_sanguineo: normalizedBody.tipo_sanguineo ?? null,
    escolaridade: normalizedBody.escolaridade ?? null,
    estado_civil: normalizedBody.estado_civil ?? null,
    nome_conjuge: normalizedBody.nome_conjuge ?? null,
    cpf_conjuge: normalizedBody.cpf_conjuge ?? null,
    data_nascimento_conjuge: normalizedBody.data_nascimento_conjuge ?? null,
    nome_pai: normalizedBody.nome_pai ?? null,
    nome_mae: normalizedBody.nome_mae ?? null,
    rg: normalizedBody.rg ?? null,
    orgao_emissor: normalizedBody.orgao_emissor ?? null,
    nacionalidade: normalizedBody.nacionalidade ?? null,
    naturalidade: normalizedBody.naturalidade ?? null,
    uf_naturalidade: normalizedBody.uf_naturalidade ?? null,
    titulo_eleitoral: normalizedBody.titulo_eleitoral ?? null,
    zona_eleitoral: normalizedBody.zona_eleitoral ?? null,
    secao_eleitoral: normalizedBody.secao_eleitoral ?? null,
    data_batismo_aguas: normalizedBody.data_batismo_aguas ?? null,
    data_batismo_espirito_santo: normalizedBody.data_batismo_espirito_santo ?? null,
    cep: normalizedBody.cep ?? null,
    logradouro: normalizedBody.logradouro ?? null,
    numero: normalizedBody.numero ?? null,
    bairro: normalizedBody.bairro ?? null,
    complemento: normalizedBody.complemento ?? null,
    cidade: normalizedBody.cidade ?? null,
    estado: normalizedBody.estado ?? null,
    celular: normalizedBody.celular ?? null,
    whatsapp: normalizedBody.whatsapp ?? null,
    congregacao_id: normalizedBody.congregacao_id ?? null,
    latitude: typeof normalizedBody.latitude === 'number' ? normalizedBody.latitude : null,
    longitude: typeof normalizedBody.longitude === 'number' ? normalizedBody.longitude : null,
    profissao: normalizedBody.profissao ?? null,
    curso_teologico: normalizedBody.curso_teologico ?? null,
    instituicao_teologica: normalizedBody.instituicao_teologica ?? null,
    pastor_auxiliar: normalizedBody.pastor_auxiliar ?? false,
    procedencia: normalizedBody.procedencia ?? null,
    procedencia_local: normalizedBody.procedencia_local ?? null,
    cargo_ministerial: normalizedBody.cargo_ministerial ?? null,
    dados_cargos: normalizedBody.dados_cargos ?? {},
    tem_funcao_igreja: normalizedBody.tem_funcao_igreja ?? false,
    qual_funcao: normalizedBody.qual_funcao ?? null,
    setor_departamento: normalizedBody.setor_departamento ?? null,
    observacoes_ministeriais: normalizedBody.observacoes_ministeriais ?? null,
    data_consagracao: normalizedBody.data_consagracao ?? null,
    data_emissao: normalizedBody.data_emissao ?? null,
    data_validade_credencial: normalizedBody.data_validade_credencial ?? null,
    ...('foto_url' in normalizedBody ? { foto_url: normalizedBody.foto_url ?? null } : {}),
    member_since: normalizedBody.member_since ?? undefined,
    role: normalizedBody.role ?? null,
    status: normalizedBody.status ?? undefined,
    custom_fields: normalizedBody.custom_fields ?? {},
    observacoes: normalizedBody.observacoes ?? null,
    updated_at: new Date().toISOString(),
  }
}

function normalizeMemberBody(body: unknown) {
  return normalizePayloadToUppercase(body, {
    preserveKeys: [
      'member_since',
      'data_nascimento',
      'data_nascimento_conjuge',
      'data_batismo_aguas',
      'data_batismo_espirito_santo',
      'data_consagracao',
      'data_emissao',
      'data_validade_credencial',
      'dados_cargos',
      'latitude',
      'longitude',
      'cargo_ministerial',
      'procedencia',
      'tipo_cadastro',
      'role',
      'status',
      'email',
    ],
  }) as Record<string, any>
}

function applyMemberCongregacaoScope(query: any, congregacaoIds: string[] | null) {
  if (congregacaoIds === null) return query
  return congregacaoIds.length > 0
    ? query.in('congregacao_id', congregacaoIds)
    : query.eq('id', '00000000-0000-0000-0000-000000000000')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context
    const congregacaoIds = await getAccessibleCongregacaoIds(context)

    let query = supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .eq('ministry_id', ministryId)

    query = applyMemberCongregacaoScope(query, congregacaoIds)
    const { data, error } = await query.single()

    if (error) {
      return NextResponse.json({ error: 'Membro nao encontrado' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('GET /api/v1/members/:id:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context
    const congregacaoIds = await getAccessibleCongregacaoIds(context)
    const body = await request.json()
    const normalizedBody = normalizeMemberBody(body)

    let existingQuery = supabase
      .from('members')
      .select('id')
      .eq('id', id)
      .eq('ministry_id', ministryId)

    existingQuery = applyMemberCongregacaoScope(existingQuery, congregacaoIds)
    const { data: existing } = await existingQuery.single()

    if (!existing) {
      return NextResponse.json({ error: 'Membro nao encontrado' }, { status: 404 })
    }

    let updateQuery = supabase
      .from('members')
      .update(buildMemberPayload(normalizedBody))
      .eq('id', id)
      .eq('ministry_id', ministryId)

    updateQuery = applyMemberCongregacaoScope(updateQuery, congregacaoIds)
    const { data, error } = await updateQuery.select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha atualizada' }, { status: 404 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('PUT /api/v1/members/:id:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context
    const congregacaoIds = await getAccessibleCongregacaoIds(context)

    let existingQuery = supabase
      .from('members')
      .select('id')
      .eq('id', id)
      .eq('ministry_id', ministryId)

    existingQuery = applyMemberCongregacaoScope(existingQuery, congregacaoIds)
    const { data: existing } = await existingQuery.single()

    if (!existing) {
      return NextResponse.json({ error: 'Membro nao encontrado' }, { status: 404 })
    }

    let deleteQuery = supabase
      .from('members')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId)

    deleteQuery = applyMemberCongregacaoScope(deleteQuery, congregacaoIds)
    const { error } = await deleteQuery

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, deleted_id: id })
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('DELETE /api/v1/members/:id:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
