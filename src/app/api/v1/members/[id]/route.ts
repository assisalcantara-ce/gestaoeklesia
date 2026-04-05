/**
 * API ROUTE: Operações em Membro Individual
 * GET /api/v1/members/:id  - Obter um membro
 * PUT /api/v1/members/:id  - Atualizar membro
 * DELETE /api/v1/members/:id - Deletar membro
 */

import { createServerClientFromRequest } from '@/lib/supabase-server'
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer'
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
    const normalizedBody = normalizePayloadToUppercase(body, {
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
      ],
    })
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

    const payload = {
      name: normalizedBody.name,
      email: typeof normalizedBody.email === 'string' ? normalizedBody.email.toLowerCase() : normalizedBody.email ?? null,
      phone: normalizedBody.phone ?? null,
      cpf: normalizedBody.cpf ?? null,
      // Aba Dados
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
      // Aba Endereço
      cep: normalizedBody.cep ?? null,
      logradouro: normalizedBody.logradouro ?? null,
      numero: normalizedBody.numero ?? null,
      bairro: normalizedBody.bairro ?? null,
      complemento: normalizedBody.complemento ?? null,
      cidade: normalizedBody.cidade ?? null,
      estado: normalizedBody.estado ?? null,
      // Aba Contato
      celular: normalizedBody.celular ?? null,
      whatsapp: normalizedBody.whatsapp ?? null,
      // Geolocalização
      congregacao_id: normalizedBody.congregacao_id ?? null,
      latitude: typeof normalizedBody.latitude === 'number' ? normalizedBody.latitude : null,
      longitude: typeof normalizedBody.longitude === 'number' ? normalizedBody.longitude : null,
      // Aba Ministerial
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
      // Aba Foto — só atualiza se o campo foi enviado explicitamente; caso contrário preserva o valor atual
      ...('foto_url' in normalizedBody ? { foto_url: normalizedBody.foto_url ?? null } : {}),
      // Sistema
      member_since: normalizedBody.member_since ?? undefined,
      role: normalizedBody.role ?? null,
      status: normalizedBody.status ?? undefined,
      custom_fields: normalizedBody.custom_fields ?? {},
      observacoes: normalizedBody.observacoes ?? null,
      updated_at: new Date().toISOString(),
    }

    // Atualizar
    let { data, error } = await supabase
      .from('members')
      .update(payload)
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
