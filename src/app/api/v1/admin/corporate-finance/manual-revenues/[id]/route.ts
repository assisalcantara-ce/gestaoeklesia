import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const resolvedParams = await params
    const id = resolvedParams.id
    if (!id) {
      return NextResponse.json({ error: 'ID da receita não informado' }, { status: 400 })
    }

    const body = await request.json()
    const {
      category_id,
      description,
      amount,
      reference_date,
      received_at,
      status,
      payment_method,
      payer_name,
      notes,
    } = body

    // 1. Verificar se registro existe
    const { data: existing, error: findError } = await supabase
      .from('platform_manual_revenues')
      .select('*')
      .eq('id', id)
      .single()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Receita manual não encontrada' }, { status: 404 })
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (description !== undefined) {
      if (!String(description).trim()) {
        return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 })
      }
      updates.description = String(description).trim()
    }

    if (amount !== undefined) {
      const numAmt = Number(amount)
      if (!Number.isFinite(numAmt) || numAmt <= 0) {
        return NextResponse.json({ error: 'O valor da receita deve ser maior que zero' }, { status: 400 })
      }
      updates.amount = numAmt
    }

    if (reference_date !== undefined) {
      if (!reference_date) {
        return NextResponse.json({ error: 'Data de referência é obrigatória' }, { status: 400 })
      }
      updates.reference_date = reference_date
    }

    if (category_id !== undefined) {
      if (category_id) {
        // Validar se categoria é INCOME
        const { data: cat } = await supabase
          .from('platform_financial_categories')
          .select('id, type')
          .eq('id', category_id)
          .single()

        if (!cat || cat.type !== 'INCOME') {
          return NextResponse.json({ error: 'A categoria selecionada deve ser do tipo Receita (INCOME)' }, { status: 400 })
        }
        updates.category_id = category_id
      } else {
        updates.category_id = null
      }
    }

    if (payment_method !== undefined) {
      updates.payment_method = payment_method || null
    }

    if (payer_name !== undefined) {
      updates.payer_name = payer_name ? String(payer_name).trim() : null
    }

    if (notes !== undefined) {
      updates.notes = notes ? String(notes).trim() : null
    }

    if (status !== undefined) {
      if (!['pending', 'received', 'canceled'].includes(status)) {
        return NextResponse.json({ error: 'Status inválido. Use pending, received ou canceled' }, { status: 400 })
      }
      updates.status = status
      if (status === 'received') {
        updates.received_at = received_at || existing.received_at || new Date().toISOString()
      } else {
        updates.received_at = null
      }
    } else if (received_at !== undefined) {
      updates.received_at = received_at
    }

    const { data: updated, error: updateError } = await supabase
      .from('platform_manual_revenues')
      .update(updates)
      .eq('id', id)
      .select('*, platform_financial_categories(name, type)')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: updated })
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

    const { error } = await supabase
      .from('platform_manual_revenues')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Receita manual excluída com sucesso' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}