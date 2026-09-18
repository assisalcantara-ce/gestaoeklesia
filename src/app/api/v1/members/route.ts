/**
 * API ROUTE: Listar / Criar Membros
 * GET  /api/v1/members
 * POST /api/v1/members
 *
 * Multi-tenancy:
 * - O `ministry_id` é resolvido no servidor a partir do usuário autenticado (ministry_users).
 * - Evita depender de `ministry_id` vindo do cliente.
 */

import { resolveTenantAuth } from '@/lib/tenant-auth'
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer'
import { authTenantErrorResponse } from '@/lib/api-errors'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context

    // ministryId ja foi resolvido pelo contexto multi-tenant central.
    if (!ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado', code: 'NO_MINISTRY' },
        { status: 403 }
      )
    }

    // Resolve escopo do usuário (congregação ou supervisão) a partir de ministry_users
    const admin = context.admin
    const { data: muScope } = await admin
      .from('ministry_users')
      .select('role, permissions, congregacao_id, supervisao_id')
      .eq('user_id', context.userId)
      .maybeSingle()

    const permsSet = new Set(
      (Array.isArray(muScope?.permissions) ? muScope.permissions : []).map((p: any) => String(p).toUpperCase())
    )
    const isAdminLocal  = permsSet.has('ADMIN_LOCAL') || permsSet.has('SECRETARIA_LOCAL') || context.nivel === 'admin_local' || context.nivel === 'secretaria_local'
    const isFinLocal    = permsSet.has('FINANCEIRO_LOCAL') || permsSet.has('TESOURARIA_LOCAL') || context.nivel === 'financeiro_local' || context.nivel === 'tesouraria_local'
    const isOperadorLocal = context.nivel === 'operador' || context.nivel === 'coordenador' || context.nivel === 'coordenador_ebd'
    const isSupervisor  = permsSet.has('SUPERVISOR') || context.nivel === 'supervisor'
    const scopeCongId   = (isAdminLocal || isFinLocal || isOperadorLocal) ? (muScope?.congregacao_id ?? context.congregacaoId ?? null) : null

    // Supervisor: busca congregações da sua supervisão e filtra membros por elas
    let scopeSupCongIds: string[] | null = null
    if (isSupervisor && muScope?.supervisao_id) {
      const { data: congsDaSup } = await admin
        .from('congregacoes')
        .select('id')
        .eq('supervisao_id', muScope.supervisao_id)
      scopeSupCongIds = (congsDaSup || []).map((c: any) => c.id)
    }

    // Extrair query params
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.max(1, Math.min(1000, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const statusParam = searchParams.get('status')?.trim()
    const searchParam = searchParams.get('search')?.trim()
    const tipoCadastro = searchParams.get('tipoCadastro')?.trim()
    const cargoParam = searchParams.get('cargo')?.trim()
    const congregacaoParam = searchParams.get('congregacao_id')?.trim() || searchParams.get('congregacaoId')?.trim()
    const sortParam = searchParams.get('sort')?.trim()

    const offset = (page - 1) * limit

    // Construir query — sempre filtrada por ministry_id
    let query = supabase
      .from('members')
      .select('*', { count: 'exact' })
      .eq('ministry_id', ministryId)

    // Aplicar escopo por nível
    if (scopeCongId) {
      query = query.eq('congregacao_id', scopeCongId)
    } else if (scopeSupCongIds !== null) {
      if (scopeSupCongIds.length > 0) {
        query = query.in('congregacao_id', scopeSupCongIds)
      } else {
        // Supervisão sem congregações → retorna vazio
        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
      }
    } else if (congregacaoParam && congregacaoParam !== 'TODAS') {
      query = query.eq('congregacao_id', congregacaoParam)
    }

    // Aplicar filtros
    if (statusParam && statusParam.toUpperCase() !== 'TODOS') {
      const normalizedStatus =
        statusParam.toLowerCase() === 'ativo' || statusParam.toLowerCase() === 'active'
          ? 'active'
          : statusParam.toLowerCase() === 'inativo' || statusParam.toLowerCase() === 'inactive'
            ? 'inactive'
            : statusParam.toLowerCase()
      query = query.eq('status', normalizedStatus)
    }

    if (cargoParam && cargoParam.toUpperCase() !== 'TODOS') {
      query = query.ilike('cargo_ministerial', `%${cargoParam}%`)
    }

    if (searchParam) {
      // Sanitizar caracteres especiais de regex/postgrest para busca segura
      const sanitized = searchParam.replace(/[,()]/g, '')
      if (sanitized) {
        query = query.or(`name.ilike.%${sanitized}%,cpf.ilike.%${sanitized}%,matricula.ilike.%${sanitized}%`)
      }
    }

    if (tipoCadastro && tipoCadastro.toUpperCase() !== 'TODOS') {
      const tipo = String(tipoCadastro).toLowerCase()
      query = query.or(`role.eq.${tipo},tipo_cadastro.eq.${tipo}`)
    }

    // Ordenação determinística com desempate por id
    if (sortParam === 'name_asc' || sortParam === 'name' || sortParam === 'nome_asc') {
      query = query.order('name', { ascending: true }).order('id', { ascending: true })
    } else if (sortParam === 'name_desc' || sortParam === 'nome_desc') {
      query = query.order('name', { ascending: false }).order('id', { ascending: true })
    } else if (sortParam === 'created_desc') {
      query = query.order('created_at', { ascending: false }).order('id', { ascending: true })
    } else {
      // Default: created_at ASC determinístico
      query = query.order('created_at', { ascending: true }).order('id', { ascending: true })
    }

    // Aplicar paginação server-side
    query = query.range(offset, offset + limit - 1)

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
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
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
    const context = await resolveTenantAuth(request)
    const { supabase, ministryId } = context

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
        'latitude',
        'longitude',
        'cargoMinisterial',
        'cargo_ministerial',
        'procedencia',
        'dados_cargos',
        // Campos com valores controlados (enums lowercase no banco)
        'tipo_cadastro',
        'role',
        'status',
        'email',
        'is_dizimista',
      ],
    })

    if (context.nivel === 'auxiliar_secretaria') {
      delete normalizedBody.cargo_ministerial
      delete normalizedBody.dados_cargos
      delete normalizedBody.observacoes_ministeriais
      delete normalizedBody.data_consagracao
      delete normalizedBody.data_emissao
      delete normalizedBody.data_validade_credencial
      if (context.congregacaoId) {
        normalizedBody.congregacao_id = context.congregacaoId
      }
    }

    const resolvedMinistryId = ministryId
    if (!resolvedMinistryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado', code: 'NO_MINISTRY' },
        { status: 403 }
      )
    }

    // Verificar limite de membros do plano via subscription_plans.max_members
    const { data: ministryData } = await supabase
      .from('ministries')
      .select('subscription_plan_id, subscription_plans(name, max_members)')
      .eq('id', ministryId)
      .maybeSingle();

    const planData = (ministryData as any)?.subscription_plans;
    const maxMembers: number = planData?.max_members ?? 0;

    if (maxMembers > 0) {
      const { count: totalMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministryId);

      if ((totalMembers ?? 0) >= maxMembers) {
        const planoNome: string = planData?.name || 'seu plano';
        return NextResponse.json(
          { error: `Limite de cadastros atingido para o plano ${planoNome} (máximo: ${maxMembers}). Faça upgrade para adicionar mais cadastros.` },
          { status: 403 }
        );
      }
    }

    // Validar campos obrigatórios
    if (!normalizedBody.name) {
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
          name: normalizedBody.name,
          email: typeof normalizedBody.email === 'string' ? normalizedBody.email.toLowerCase() : normalizedBody.email || null,
          phone: normalizedBody.phone || null,
          cpf: normalizedBody.cpf || null,
          data_consagracao: normalizedBody.data_consagracao || null,
          data_emissao: normalizedBody.data_emissao || null,
          data_validade_credencial: normalizedBody.data_validade_credencial || null,
          // Aba Dados
          matricula: normalizedBody.matricula || null,
          unique_id: normalizedBody.unique_id || null,
          tipo_cadastro: normalizedBody.tipo_cadastro || 'ministro',
          data_nascimento: normalizedBody.data_nascimento || null,
          sexo: normalizedBody.sexo || null,
          tipo_sanguineo: normalizedBody.tipo_sanguineo || null,
          escolaridade: normalizedBody.escolaridade || null,
          estado_civil: normalizedBody.estado_civil || null,
          nome_conjuge: normalizedBody.nome_conjuge || null,
          cpf_conjuge: normalizedBody.cpf_conjuge || null,
          data_nascimento_conjuge: normalizedBody.data_nascimento_conjuge || null,
          nome_pai: normalizedBody.nome_pai || null,
          nome_mae: normalizedBody.nome_mae || null,
          rg: normalizedBody.rg || null,
          orgao_emissor: normalizedBody.orgao_emissor || null,
          nacionalidade: normalizedBody.nacionalidade || null,
          naturalidade: normalizedBody.naturalidade || null,
          uf_naturalidade: normalizedBody.uf_naturalidade || null,
          titulo_eleitoral: normalizedBody.titulo_eleitoral || null,
          zona_eleitoral: normalizedBody.zona_eleitoral || null,
          secao_eleitoral: normalizedBody.secao_eleitoral || null,
          data_batismo_aguas: normalizedBody.data_batismo_aguas || null,
          data_batismo_espirito_santo: normalizedBody.data_batismo_espirito_santo || null,
          // Aba Endereço
          cep: normalizedBody.cep || null,
          logradouro: normalizedBody.logradouro || null,
          numero: normalizedBody.numero || null,
          bairro: normalizedBody.bairro || null,
          complemento: normalizedBody.complemento || null,
          cidade: normalizedBody.cidade || null,
          estado: normalizedBody.estado || null,
          // Aba Contato
          celular: normalizedBody.celular || null,
          whatsapp: normalizedBody.whatsapp || null,
          // Geolocalização
          congregacao_id: normalizedBody.congregacao_id || null,
          latitude: typeof normalizedBody.latitude === 'number' ? normalizedBody.latitude : null,
          longitude: typeof normalizedBody.longitude === 'number' ? normalizedBody.longitude : null,
          // Aba Ministerial
          profissao: normalizedBody.profissao || null,
          curso_teologico: normalizedBody.curso_teologico || null,
          instituicao_teologica: normalizedBody.instituicao_teologica || null,
          pastor_auxiliar: normalizedBody.pastor_auxiliar ?? false,
          procedencia: normalizedBody.procedencia || null,
          procedencia_local: normalizedBody.procedencia_local || null,
          cargo_ministerial: normalizedBody.cargo_ministerial || null,
          dados_cargos: normalizedBody.dados_cargos || {},
          tem_funcao_igreja: normalizedBody.tem_funcao_igreja ?? false,
          qual_funcao: normalizedBody.qual_funcao || null,
          setor_departamento: normalizedBody.setor_departamento || null,
          observacoes_ministeriais: normalizedBody.observacoes_ministeriais || null,
          // Aba Foto
          foto_url: normalizedBody.foto_url || null,
           // Sistema
          is_dizimista: normalizedBody.is_dizimista ?? false,
          member_since: normalizedBody.member_since || new Date(),
          role: normalizedBody.role || null,
          status: normalizedBody.status || 'active',
          custom_fields: normalizedBody.custom_fields || {},
          observacoes: normalizedBody.observacoes || null,
        },
      ])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('POST /api/v1/members:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
