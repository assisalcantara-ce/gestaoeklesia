import { NextRequest, NextResponse } from 'next/server'
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

    // Cria usuário
    const { data, error } = await supabase
      .from('admin_users')
      .insert([
        {
          email: body.email,
          password_hash: body.password, // TODO: Fazer hash com bcrypt
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

    // Verifica se é o último admin
    const { count } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('status', 'ATIVO')

    if (count === 1) {
      const { data: user } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', id)
        .single()

      if (user?.role === 'admin') {
        return NextResponse.json(
          { error: 'Não é possível deletar o último usuário administrador' },
          { status: 400 }
        )
      }
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
