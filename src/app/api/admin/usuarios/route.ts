import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { requireAdmin } from '@/lib/admin-guard'

function sanitizeAdminUser(row: any) {
  if (!row || typeof row !== 'object') return row
  const { password_hash, password, senha, ...rest } = row
  return rest
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
      .eq('status', 'ATIVO')
      .order('criado_em', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json((data || []).map(sanitizeAdminUser))
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

    // Cria usuário no Supabase Auth (necessário para login)
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

    // Cria registro em admin_users vinculado ao auth user
    const { data, error } = await supabase
      .from('admin_users')
      .insert([
        {
          user_id: authData.user.id,
          email: body.email,
          password_hash: await bcrypt.hash(body.password, 10),
          role: body.role || 'suporte',
          nome: body.nome,
          cpf: body.cpf,
          rg: body.rg,
          data_nascimento: body.data_nascimento,
          data_admissao: body.data_admissao || new Date().toISOString().split('T')[0],
          status: body.status || 'ATIVO',
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
        },
      ])
      .select()
      .single()

    if (error) {
      // Rollback: remove o auth user criado para não deixar órfão
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: error.message }, { status: 400 })
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
    if (password && String(password).trim().length >= 6) {
      const newPassword = String(password).trim()

      // Busca user_id vinculado para atualizar no Supabase Auth
      const { data: existing } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('id', id)
        .single()

      if (existing?.user_id) {
        await supabase.auth.admin.updateUserById(existing.user_id, { password: newPassword })
      }

      updateData.password_hash = await bcrypt.hash(newPassword, 10)
    }

    const { data, error } = await supabase
      .from('admin_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
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
    const { count } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('status', 'ATIVO')

    if (count === 1 && targetUser.role === 'admin') {
      return NextResponse.json(
        { error: 'Não é possível deletar o último usuário administrador' },
        { status: 400 }
      )
    }

    // Soft delete
    const { error } = await supabase
      .from('admin_users')
      .update({ status: 'INATIVO' })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
