import { getAccessibleCongregacaoIds, resolveTenantAuth } from '@/lib/tenant-auth'
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer'
import { authTenantErrorResponse } from '@/lib/api-errors'
import { logServerAudit } from '@/lib/audit-logger'
import { NextRequest, NextResponse } from 'next/server'

function buildMemberPayload(normalizedBody: Record<string, any>) {
  return {
    name: normalizedBody.name,
    email: typeof normalizedBody.email === 'string' ? normalizedBody.email.toLowerCase() : normalizedBody.email ?? null,
    phone: normalizedBody.phone ?? null,
    cpf: normalizedBody.cpf ?? null,
    matricula:
      normalizedBody.matricula && /^\d+$/.test(String(normalizedBody.matricula).trim())
        ? String(normalizedBody.matricula).trim().padStart(3, '0')
        : (normalizedBody.matricula ?? null),
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
    status: normalizedBody.status
      ? ((s: string) => {
          const lower = s.toLowerCase();
          if (lower === 'ativo' || lower === 'active') return 'active';
          if (lower === 'inativo' || lower === 'inactive') return 'inactive';
          return lower;
        })(String(normalizedBody.status))
      : undefined,
    custom_fields: normalizedBody.custom_fields ?? undefined,
    observacoes: normalizedBody.observacoes ?? null,
    is_dizimista: normalizedBody.is_dizimista ?? undefined,
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
      'is_dizimista',
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

    if (context.nivel === 'auxiliar_secretaria') {
      delete normalizedBody.cargo_ministerial
      delete normalizedBody.dados_cargos
      delete normalizedBody.observacoes_ministeriais
      delete normalizedBody.data_consagracao
      delete normalizedBody.data_emissao
      delete normalizedBody.data_validade_credencial
    }

    let existingQuery = supabase
      .from('members')
      .select('id, name, matricula, cargo_ministerial, tipo_cadastro, status, congregacao_id, custom_fields')
      .eq('id', id)
      .eq('ministry_id', ministryId)

    existingQuery = applyMemberCongregacaoScope(existingQuery, congregacaoIds)
    const { data: existing } = await existingQuery.single()

    if (!existing) {
      return NextResponse.json({ error: 'Membro nao encontrado' }, { status: 404 })
    }

    const existingCustomFields =
      existing.custom_fields && typeof existing.custom_fields === 'object'
        ? { ...existing.custom_fields }
        : {}

    const incomingCustomFields =
      normalizedBody.custom_fields && typeof normalizedBody.custom_fields === 'object'
        ? { ...normalizedBody.custom_fields }
        : {}

    const mergedCustomFields: Record<string, any> = {
      ...existingCustomFields,
      ...incomingCustomFields,
    }

    // Reativação futura: se o membro era inativo e agora está sendo alterado para ativo
    const rawStatus = normalizedBody.status ? String(normalizedBody.status).toLowerCase() : null
    const dbNovoStatus = rawStatus
      ? (rawStatus === 'ativo' || rawStatus === 'active' ? 'active' : 'inactive')
      : null

    const isExistingInactive = existing.status === 'inactive' || existing.status === 'inativo'
    const isReativacao = isExistingInactive && dbNovoStatus === 'active'

    if (isReativacao) {
      const historicoAtual = Array.isArray(existingCustomFields.historico_processos)
        ? [...existingCustomFields.historico_processos]
        : Array.isArray(existingCustomFields.historicoProcessos)
        ? [...existingCustomFields.historicoProcessos]
        : []

      const nowIso = new Date().toISOString()
      const reativacaoEventId = `reativ_${Date.now()}_${Math.random().toString(16).slice(2)}`
      const eventoReativacao = {
        id: reativacaoEventId,
        processo_id: reativacaoEventId,
        ministry_id: ministryId,
        member_id: id,
        tipo_evento: 'reativacao',
        tipo_documento: 'Reativação Cadastral',
        data: nowIso.slice(0, 10),
        data_hora: nowIso,
        status_anterior: existing.status,
        status_resultante: 'active',
        motivo: body.motivo_reativacao || body.motivo || 'Reativação cadastral no rol de membros',
        observacoes: body.observacoes || null,
        responsavel: 'Administração',
        usuario_id: context.userId || null,
        descricao: 'Membro reativado no rol de membros ativos. Histórico anterior preservado integralmente.',
        criado_em: nowIso,
      }

      const nextHistorico = [...historicoAtual, eventoReativacao]
      mergedCustomFields.historico_processos = nextHistorico
      mergedCustomFields.historicoProcessos = nextHistorico
    } else {
      // Se não for reativação, garante preservação do histórico existente caso o payload não o tenha enviado
      if (!incomingCustomFields.historico_processos && existingCustomFields.historico_processos) {
        mergedCustomFields.historico_processos = existingCustomFields.historico_processos
      }
      if (!incomingCustomFields.historicoProcessos && existingCustomFields.historicoProcessos) {
        mergedCustomFields.historicoProcessos = existingCustomFields.historicoProcessos
      }
    }

    const updatePayload = buildMemberPayload(normalizedBody)
    updatePayload.custom_fields = mergedCustomFields
    if (dbNovoStatus) {
      updatePayload.status = dbNovoStatus
    }

    let updateQuery = supabase
      .from('members')
      .update(updatePayload)
      .eq('id', id)
      .eq('ministry_id', ministryId)

    updateQuery = applyMemberCongregacaoScope(updateQuery, congregacaoIds)
    const { data, error } = await updateQuery.select()

    if (error) {
      await logServerAudit(context.admin, {
        ministryId,
        userId: context.userId,
        acao: 'editar',
        modulo: 'membros',
        area: 'cadastro',
        tabelaAfetada: 'members',
        registroId: id,
        descricao: `Falha ao editar membro: ${existing.name || id}`,
        status: 'erro',
        mensagemErro: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha atualizada' }, { status: 404 })
    }

    const updated = data[0]

    await logServerAudit(context.admin, {
      ministryId,
      userId: context.userId,
      acao: 'editar',
      modulo: 'membros',
      area: 'cadastro',
      tabelaAfetada: 'members',
      registroId: id,
      descricao: `Membro atualizado: ${updated.name || existing.name} (Matrícula: ${updated.matricula || existing.matricula || '-'})`,
      dadosAnteriores: {
        nome: existing.name,
        matricula: existing.matricula,
        cargo_ministerial: existing.cargo_ministerial,
        tipo_cadastro: existing.tipo_cadastro,
        status: existing.status,
      },
      dadosNovos: {
        nome: updated.name,
        matricula: updated.matricula,
        cargo_ministerial: updated.cargo_ministerial,
        tipo_cadastro: updated.tipo_cadastro,
        status: updated.status,
      },
      status: 'sucesso',
    })

    return NextResponse.json(updated)
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
    if (context.nivel === 'auxiliar_secretaria') {
      return NextResponse.json({ error: 'Auxiliar de Secretaria não possui permissão para excluir membros.' }, { status: 403 })
    }
    const { supabase, ministryId } = context
    const congregacaoIds = await getAccessibleCongregacaoIds(context)

    let existingQuery = supabase
      .from('members')
      .select('id, name, matricula, cargo_ministerial, tipo_cadastro, status, congregacao_id')
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
      await logServerAudit(context.admin, {
        ministryId,
        userId: context.userId,
        acao: 'deletar',
        modulo: 'membros',
        area: 'cadastro',
        tabelaAfetada: 'members',
        registroId: id,
        descricao: `Falha ao excluir membro: ${existing.name || id}`,
        status: 'erro',
        mensagemErro: error.message,
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logServerAudit(context.admin, {
      ministryId,
      userId: context.userId,
      acao: 'deletar',
      modulo: 'membros',
      area: 'cadastro',
      tabelaAfetada: 'members',
      registroId: id,
      descricao: `Membro excluído: ${existing.name || 'Sem nome'} (Matrícula: ${existing.matricula || '-'})`,
      dadosAnteriores: {
        nome: existing.name,
        matricula: existing.matricula,
        cargo_ministerial: existing.cargo_ministerial,
        tipo_cadastro: existing.tipo_cadastro,
        status: existing.status,
      },
      status: 'sucesso',
    })

    return NextResponse.json({ success: true, deleted_id: id })
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('DELETE /api/v1/members/:id:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
