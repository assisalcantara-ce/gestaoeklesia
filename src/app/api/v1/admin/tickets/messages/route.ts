import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    const ticketId = request.nextUrl.searchParams.get('ticket_id')
    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin, user } = result.ctx

    const body = await request.json()
    const { ticket_id, message, is_internal, next_status } = body || {}

    if (!ticket_id || !message) {
      return NextResponse.json({ error: 'ticket_id e message são obrigatórios' }, { status: 400 })
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('support_ticket_messages')
      .insert({
        ticket_id,
        user_id: user.id,
        message,
        is_internal: is_internal === true,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    if (next_status && typeof next_status === 'string') {
      const updatePayload: Record<string, any> = {
        status: next_status,
        response_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (next_status === 'resolved' || next_status === 'closed') {
        updatePayload.resolved_at = new Date().toISOString()
      }

      const { error: updateError } = await supabaseAdmin
        .from('support_tickets')
        .update(updatePayload)
        .eq('id', ticket_id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ data: inserted })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
