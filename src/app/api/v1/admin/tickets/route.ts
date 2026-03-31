/**
 * API ROUTE: Support Tickets Management
 * Gerenciar tickets de suporte técnico
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
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const ministry_id = searchParams.get('ministry_id')
    const category = searchParams.get('category')

    const offset = (page - 1) * limit
    let query = supabaseAdmin
      .from('support_tickets')
      .select(`
        *,
        ministries:ministry_id(name)
      `, { count: 'exact' })

    if (status) {
      if (status === 'active') {
        query = query.in('status', ['open', 'in_progress', 'waiting_customer'])
      } else {
        query = query.eq('status', status)
      }
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    if (ministry_id) {
      query = query.eq('ministry_id', ministry_id)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[TICKETS GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const ticketIds = (data || []).map((row: any) => row.id)
    let lastMessageByTicket: Record<string, { user_id: string; created_at: string }> = {}

    if (ticketIds.length > 0) {
      const { data: lastMessages } = await supabaseAdmin
        .from('support_ticket_messages')
        .select('ticket_id,user_id,created_at')
        .in('ticket_id', ticketIds)
        .eq('is_internal', false)
        .order('created_at', { ascending: false })

      lastMessageByTicket = (lastMessages || []).reduce((acc: any, msg: any) => {
        if (!acc[msg.ticket_id]) {
          acc[msg.ticket_id] = { user_id: msg.user_id, created_at: msg.created_at }
        }
        return acc
      }, {})
    }

    const enriched = (data || []).map((ticket: any) => {
      const lastMessage = lastMessageByTicket[ticket.id]
      return {
        ...ticket,
        last_message_user_id: lastMessage?.user_id || null,
        last_message_at: lastMessage?.created_at || null,
      }
    })

    return NextResponse.json({
      data: enriched,
      count,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx
    const body = await request.json()

    // Validar campos obrigatórios
    if (!body.ministry_id || !body.subject || !body.description || !body.category) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ministry_id, subject, description, category' },
        { status: 400 }
      )
    }

    // Criar ticket
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert([{
        ministry_id: body.ministry_id,
        user_id: body.user_id || null,
        subject: body.subject,
        description: body.description,
        category: body.category,
        priority: body.priority || 'medium',
        status: 'open',
        sla_minutes: body.sla_minutes || 480, // 8 horas padrão
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Enviar notificação ou e-mail (se implementado)
    // await notifyAdminAboutNewTicket(ticket)

    return NextResponse.json(ticket, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
