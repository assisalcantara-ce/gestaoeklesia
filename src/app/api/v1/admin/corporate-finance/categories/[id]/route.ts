import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const resolvedParams = await params
    const id = resolvedParams.id
    if (!id) {
      return NextResponse.json({ error: 'ID da categoria não informado' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, is_active } = body

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json({ error: 'Nome da categoria é obrigatório' }, { status: 400 })
      }
      updates.name = String(name).trim()
    }

    if (description !== undefined) {
      updates.description = description ? String(description).trim() : null
    }

    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active)
    }

    const { data, error } = await supabase
      .from('platform_financial_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const resolvedParams = await params
    const id = resolvedParams.id
    if (!id) {
      return NextResponse.json({ error: 'ID da categoria não informado' }, { status: 400 })
    }

    // Verificar se categoria está vinculada a receitas ou despesas
    const [revCountRes, expCountRes] = await Promise.all([
      supabase.from('platform_manual_revenues').select('id', { count: 'exact', head: true }).eq('category_id', id),
      supabase.from('platform_expenses').select('id', { count: 'exact', head: true }).eq('category_id', id),
    ])

    const totalUsages = (revCountRes.count || 0) + (expCountRes.count || 0)

    if (totalUsages > 0) {
      return NextResponse.json(
        {
          error: `Esta categoria possui ${totalUsages} movimentação(ões) vinculada(s). Para preservar o histórico financeiro, desative a categoria em vez de excluí-la.`,
        },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('platform_financial_categories')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Categoria excluída com sucesso' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}