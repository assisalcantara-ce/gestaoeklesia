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
      return NextResponse.json({ error: 'ID da despesa não informado' }, { status: 400 })
    }

    const body = await request.json()
    const {
      category_id,
      description,
      amount,
      reference_date,
      due_date,
      paid_at,
      status,
      payment_method,
      is_recurring,
      recipient_name,
      receipt_url,
      notes,
    } = body

    // 1. Verificar se registro existe
    const { data: existing, error: findError } = await supabase
      .from('platform_expenses')
      .select('*')
      .eq('id', id)
      .single()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Despesa corporativa não encontrada' }, { status: 404 })
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
        return NextResponse.json({ error: 'O valor da despesa deve ser maior que zero' }, { status: 400 })
      }
      updates.amount = numAmt
    }

    if (reference_date !== undefined) {
      if (!reference_date) {
        return NextResponse.json({ error: 'Data de referência/competência é obrigatória' }, { status: 400 })
      }
      updates.reference_date = reference_date
    }

    if (due_date !== undefined) {
      if (!due_date) {
        return NextResponse.json({ error: 'Data de vencimento é obrigatória' }, { status: 400 })
      }
      updates.due_date = due_date
    }

    if (category_id !== undefined) {
      if (category_id) {
        // Validar se categoria é EXPENSE
        const { data: cat } = await supabase
          .from('platform_financial_categories')
          .select('id, type')
          .eq('id', category_id)
          .single()

        if (!cat || cat.type !== 'EXPENSE') {
          return NextResponse.json({ error: 'A categoria selecionada deve ser do tipo Despesa (EXPENSE)' }, { status: 400 })
        }
        updates.category_id = category_id
      } else {
        updates.category_id = null
      }
    }

    if (payment_method !== undefined) {
      updates.payment_method = payment_method || null
    }

    if (is_recurring !== undefined) {
      updates.is_recurring = Boolean(is_recurring)
    }

    if (recipient_name !== undefined) {
      updates.recipient_name = recipient_name ? String(recipient_name).trim() : null
    }

    if (receipt_url !== undefined) {
      updates.receipt_url = receipt_url ? String(receipt_url).trim() : null
    }

    if (notes !== undefined) {
      updates.notes = notes ? String(notes).trim() : null
    }

    if (status !== undefined) {
      if (!['pending', 'paid', 'canceled'].includes(status)) {
        return NextResponse.json({ error: 'Status inválido. Use pending, paid ou canceled' }, { status: 400 })
      }
      updates.status = status
      if (status === 'paid') {
        updates.paid_at = paid_at || existing.paid_at || new Date().toISOString()
      } else {
        updates.paid_at = null
      }
    } else if (paid_at !== undefined) {
      updates.paid_at = paid_at
    }

    const { data: updated, error: updateError } = await supabase
      .from('platform_expenses')
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
      .from('platform_expenses')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Despesa corporativa excluída com sucesso' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}