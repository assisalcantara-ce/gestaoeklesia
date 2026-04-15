import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { requireAdmin } from '@/lib/admin-guard'
import { buildPasswordFingerprint } from '@/lib/password-fingerprint'

function sanitizeAdminUser(row: any) {
  if (!row || typeof row !== 'object') return row
  const { password_hash, password, senha, ...rest } = row
  return rest
}

function getMissingColumnName(message: string): string | null {
  const patterns = [
    /'([a-zA-Z0-9_]+)' column/i,
    /column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

async function insertAdminUserCompat(supabase: any, payload: Record<string, any>) {
  const mutablePayload = { ...payload }

  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase
      .from('admin_users')
      .insert([mutablePayload])
      .select()
      .single()

    if (!error) return { data, error: null }

    const missingColumn = getMissingColumnName(error.message || '')
    if (!missingColumn || !(missingColumn in mutablePayload)) {
      return { data: null, error }
    }

    delete mutablePayload[missingColumn]
  }

  return {
    data: null,
    error: { message: 'Não foi possível compatibilizar colunas de admin_users na inserção.' },
  }
}

async function updateAdminUserCompat(supabase: any, id: string, payload: Record<string, any>) {
  const mutablePayload = { ...payload }

  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase
      .from('admin_users')
      .update(mutablePayload)
      .eq('id', id)
      .select()
      .single()

    if (!error) return { data, error: null }

    const missingColumn = getMissingColumnName(error.message || '')
    if (!missingColumn || !(missingColumn in mutablePayload)) {
      return { data: null, error }
    }

    delete mutablePayload[missingColumn]
  }

  return {
    data: null,
    error: { message: 'Não foi possível compatibilizar colunas de admin_users na atualização.' },
  }
}

function isActiveAdminUser(row: any) {
  if (typeof row?.status === 'string') return row.status === 'ATIVO'
  if (typeof row?.is_active === 'boolean') return row.is_active === true
  if (typeof row?.ativo === 'boolean') return row.ativo === true
  return true
}

function getAdminUserCreatedAt(row: any): number {
  const raw = row?.criado_em || row?.created_at || row?.data_admissao || row?.updated_at
  const ts = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(ts) ? ts : 0
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Busca um usuário específico
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', id)
        .single()

      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json(sanitizeAdminUser(data) || null)
    }

    // Lista todos os usuários
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const activeUsers = (data || [])
      .filter(isActiveAdminUser)
      .sort((a: any, b: any) => getAdminUserCreatedAt(b) - getAdminUserCreatedAt(a))

    return NextResponse.json(activeUsers.map(sanitizeAdminUser))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const body = await request.json()

    // Validações
    if (!body.email || !body.password || !body.nome) {
      return NextResponse.json(
        { error: 'Email, senha e nome são obrigatórios' },
        { status: 400 }
      )
    }

    // Verifica se email já existe
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', body.email)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      )
    }

      let passwordFingerprint = ''
      try {
        passwordFingerprint = buildPasswordFingerprint(String(body.password))
      } catch {
        return NextResponse.json(
          { error: 'Configuracao de senha nao definida' },
          { status: 500 }
        )
      }

      const { data: existingFingerprint } = await supabase
        .from('user_password_fingerprints')
        .select('user_id')
        .eq('fingerprint', passwordFingerprint)
        .maybeSingle()

      if (existingFingerprint?.user_id) {
        return NextResponse.json(
          { error: 'Senha ja utilizada por outro usuario' },
          { status: 400 }
        )
      }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Erro ao criar usuário no sistema de autenticação' },
        { status: 400 }
      )
    }

    const payloadBase: Record<string, any> = {
      user_id: authData.user.id,
      email: body.email,
      role: body.role || 'suporte',
      can_manage_ministries: ['admin', 'super_admin'].includes(body.role) || false,
      can_manage_payments: ['admin', 'super_admin', 'financeiro'].includes(body.role) || false,
      can_manage_plans: ['admin', 'super_admin'].includes(body.role) || false,
      can_manage_support: ['admin', 'super_admin', 'suporte'].includes(body.role) || false,
      nome: body.nome,
      name: body.nome,
      cpf: body.cpf,
      rg: body.rg,
      data_nascimento: body.data_nascimento,
      data_admissao: body.data_admissao || new Date().toISOString().split('T')[0],
      status: body.status || 'ATIVO',
      is_active: true,
      telefone: body.telefone,
      whatsapp: body.whatsapp,
      cep: body.cep,
      endereco: body.endereco,
      cidade: body.cidade,
      bairro: body.bairro,
      uf: body.uf,
      banco: body.banco,
      agencia: body.agencia,
      conta_corrente: body.conta_corrente,
      pix: body.pix,
      obs: body.obs,
      funcao: body.funcao,
      grupo: body.grupo,
    }

    const passwordHashProbe = await supabase
      .from('admin_users')
      .select('id,password_hash')
      .limit(1)

    if (!passwordHashProbe.error) {
      payloadBase.password_hash = await bcrypt.hash(body.password, 10)
    }

    // Cria registro em admin_users vinculado ao auth user
    const { data, error } = await insertAdminUserCompat(supabase, payloadBase)

    if (error) {
      // Rollback: remove o auth user criado para não deixar órfão
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

      const { error: fingerprintError } = await supabase
        .from('user_password_fingerprints')
        .insert({ user_id: authData.user.id, fingerprint: passwordFingerprint })

      if (fingerprintError) {
        await supabase.auth.admin.deleteUser(authData.user.id)
        await supabase.from('admin_users').delete().eq('id', data?.id || '')
        return NextResponse.json({ error: 'Senha ja utilizada por outro usuario' }, { status: 400 })
      }

    return NextResponse.json(sanitizeAdminUser(data), { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const { password, ...updateData } = body

    // Se senha fornecida, atualiza no Auth e no admin_users
    let passwordFingerprint = ''
    if (password && String(password).trim().length >= 6) {
      const newPassword = String(password).trim()
      try {
        passwordFingerprint = buildPasswordFingerprint(newPassword)
      } catch {
        return NextResponse.json(
          { error: 'Configuracao de senha nao definida' },
          { status: 500 }
        )
      }

      const { data: existingFingerprint } = await supabase
        .from('user_password_fingerprints')
        .select('user_id')
        .eq('fingerprint', passwordFingerprint)
        .maybeSingle()

      if (existingFingerprint?.user_id) {
        const { data: currentAdmin } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('id', id)
          .single()

        if (currentAdmin?.user_id && existingFingerprint.user_id !== currentAdmin.user_id) {
          return NextResponse.json(
            { error: 'Senha ja utilizada por outro usuario' },
            { status: 400 }
          )
        }
      }

      // Busca user_id vinculado para atualizar no Supabase Auth
      const { data: existing } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('id', id)
        .single()

      if (existing?.user_id) {
        await supabase.auth.admin.updateUserById(existing.user_id, { password: newPassword })
      }

      const passwordHashProbe = await supabase
        .from('admin_users')
        .select('id,password_hash')
        .limit(1)

      if (!passwordHashProbe.error) {
        updateData.password_hash = await bcrypt.hash(newPassword, 10)
      }
    }

    if (typeof updateData.nome === 'string') {
      updateData.name = updateData.nome
    }

    const { data, error } = await updateAdminUserCompat(supabase, id, updateData)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (passwordFingerprint) {
      await supabase
        .from('user_password_fingerprints')
        .upsert({ user_id: data?.user_id, fingerprint: passwordFingerprint })
    }

    return NextResponse.json(sanitizeAdminUser(data))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    // Busca o registro alvo para comparações
    const { data: targetUser } = await supabase
      .from('admin_users')
      .select('id, email, role, user_id')
      .eq('id', id)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // LOG para debug da trava de auto-exclusão
    console.error('[DELETE ADMIN_USER] Comparação de trava:', {
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        user_id: targetUser.user_id,
      },
      logged: {
        email: result.ctx.adminUser?.email || result.ctx.user?.email,
        user_id: result.ctx.user?.id,
        adminUser: result.ctx.adminUser?.id,
        authUser: result.ctx.user?.id,
      },
    })

    // Impede que o usuário logado delete a própria conta
    // Compara por email (mais confiável que id) e por user_id do Supabase Auth
    const loggedEmail = result.ctx.adminUser?.email || result.ctx.user?.email
    const loggedAuthId = result.ctx.user?.id

    if (
      targetUser.email === loggedEmail ||
      (loggedAuthId && targetUser.user_id === loggedAuthId)
    ) {
      return NextResponse.json(
        { error: 'Você não pode remover a sua própria conta enquanto estiver logado.' },
        { status: 403 }
      )
    }

    // Verifica se é o último admin
    const { data: adminRows, error: adminsError } = await supabase
      .from('admin_users')
      .select('id, role, status, is_active, ativo')

    if (adminsError) {
      return NextResponse.json({ error: adminsError.message }, { status: 400 })
    }

    const activeAdminCount = (adminRows || []).filter((u: any) => u.role === 'admin' && isActiveAdminUser(u)).length

    if (activeAdminCount === 1 && targetUser.role === 'admin') {
      return NextResponse.json(
        { error: 'Não é possível deletar o último usuário administrador' },
        { status: 400 }
      )
    }

    const softDeletePayload = {
      status: 'INATIVO',
      is_active: false,
      cpf: null,
    }

    // Soft delete — limpa campos com unique constraint para não bloquear novos cadastros
    const { error } = await updateAdminUserCompat(supabase, id, softDeletePayload)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Remove o usuário do Supabase Auth para liberar o email e revogar sessões
    if (targetUser.user_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUser.user_id)
      if (authDeleteError) {
        console.warn('[DELETE ADMIN_USER] Soft delete ok, mas falha ao remover do Auth:', authDeleteError.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
