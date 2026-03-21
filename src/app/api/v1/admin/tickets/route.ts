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
      query = query.eq('status', status)
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

    return NextResponse.json({
      data,
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
