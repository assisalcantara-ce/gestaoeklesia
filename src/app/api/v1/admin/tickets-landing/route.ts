/**
 * API ROUTE: Landing Support Tickets
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx
    const searchParams = request.nextUrl.searchParams

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '15')
    const status = searchParams.get('status')

    const offset = (page - 1) * limit
    let query = supabaseAdmin
      .from('support_tickets_landing')
      .select('*', { count: 'exact' })

    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.in('status', [
          'open',
          'in_progress',
          'waiting_customer',
          'em_atendimento',
          'aguardando_contrato',
        ])
      } else {
        query = query.eq('status', status)
      }
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      data: data || [],
      count,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    const body = await request.json()
    const { id, status, note } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    }

    // Se for apenas uma nota, busca o ticket atual para fazer append
    if (note && !status) {
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('support_tickets_landing')
        .select('notes')
        .eq('id', id)
        .single()

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 400 })
      }

      const existingNotes: any[] = current?.notes || []
      const newNote = {
        text: note,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabaseAdmin
        .from('support_tickets_landing')
        .update({
          notes: [...existingNotes, newNote],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ data })
    }

    // Atualização de status (com nota opcional simultaneamente)
    if (!status) {
      return NextResponse.json({ error: 'status ou note são obrigatórios' }, { status: 400 })
    }

    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    // Se vier nota junto com status, faz append também
    if (note) {
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('support_tickets_landing')
        .select('notes')
        .eq('id', id)
        .single()

      if (!fetchError && current) {
        const existingNotes: any[] = current.notes || []
        updatePayload.notes = [...existingNotes, { text: note, created_at: new Date().toISOString() }]
      }
    }

    const { data, error } = await supabaseAdmin
      .from('support_tickets_landing')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
