import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    let oportunidades: any[] = []
    let isFallback = false

    // 1. Tenta carregar da tabela oportunidades_comerciais
    const { data: optData, error: optError } = await supabaseAdmin
      .from('oportunidades_comerciais')
      .select('*')
      .order('created_at', { ascending: false })

    if (optError) {
      console.warn('Oportunidades comerciais não encontrada, usando support_tickets como fallback:', optError.message)
      isFallback = true
    } else {
      oportunidades = optData || []
    }

    // 2. Se for fallback, carrega de support_tickets (billing ou que tenham "Proposta" no assunto)
    if (isFallback) {
      const { data: ticketsData, error: ticketError } = await supabaseAdmin
        .from('support_tickets')
        .select('*')
        .or('category.eq.billing,subject.ilike.%Proposta%')
        .order('created_at', { ascending: false })

      if (ticketError) {
        return NextResponse.json({ error: ticketError.message }, { status: 400 })
      }

      oportunidades = (ticketsData || []).map((ticket: any) => {
        // Extrai plano do assunto
        let plano = 'Intermediário'
        if (ticket.subject?.toLowerCase().includes('profissional')) {
          plano = 'Profissional'
        } else if (ticket.subject?.toLowerCase().includes('starter')) {
          plano = 'Starter'
        }

        // Mapeia status de suporte para status de funil
        let optStatus = 'Novo'
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          optStatus = 'Convertido'
        } else if (ticket.status === 'in_progress') {
          optStatus = 'Em Atendimento'
        }

        return {
          id: ticket.id,
          ministry_id: ticket.ministry_id,
          plano_solicitado: plano,
          observacao: ticket.description,
          observacao_interna: ticket.resolution_notes || '',
          created_at: ticket.created_at,
          status: optStatus,
          is_ticket: true
        }
      })
    }

    // 3. Enriquecer as oportunidades com informações completas do Ministério e Histórico
    const enriched = await Promise.all(
      oportunidades.map(async (opt: any) => {
        const [ministryResult, configResult, histResult] = await Promise.all([
          // Detalhes do ministério
          supabaseAdmin
            .from('ministries')
            .select('name, email_admin, phone')
            .eq('id', opt.ministry_id)
            .maybeSingle(),
          // Configurações (onde fica o responsável)
          supabaseAdmin
            .from('configurations')
            .select('church_profile')
            .eq('ministry_id', opt.ministry_id)
            .maybeSingle(),
          // Histórico (tabela customizada ou mensagens)
          opt.is_ticket
            ? supabaseAdmin
                .from('support_ticket_messages')
                .select('*')
                .eq('ticket_id', opt.id)
                .order('created_at', { ascending: false })
            : supabaseAdmin
                .from('oportunidades_comerciais_historico')
                .select('*')
                .eq('oportunidade_id', opt.id)
                .order('created_at', { ascending: false })
        ])

        const mData = ministryResult.data
        const churchProfile = (configResult.data as any)?.church_profile || {}

        // Mapear histórico para formato padrão
        let historicoFormatado: any[] = []
        const rawHistory = histResult.data || []

        if (opt.is_ticket) {
          historicoFormatado = rawHistory.map((msg: any) => {
            // Se for mensagem de sistema que gravamos no PATCH
            if (msg.message?.startsWith('[Histórico Comercial]')) {
              // Parse simples ou exibir a mensagem
              return {
                id: msg.id,
                status_anterior: '',
                status_novo: '',
                usuario: 'Admin',
                observacao: msg.message.replace('[Histórico Comercial]', '').trim(),
                created_at: msg.created_at
              }
            }
            return {
              id: msg.id,
              status_anterior: '',
              status_novo: '',
              usuario: 'Mensagem do Ticket',
              observacao: msg.message,
              created_at: msg.created_at
            }
          })
        } else {
          historicoFormatado = rawHistory.map((h: any) => ({
            id: h.id,
            status_anterior: h.status_anterior || '',
            status_novo: h.status_novo || '',
            usuario: h.usuario || 'Sistema',
            observacao: h.observacao || '',
            created_at: h.created_at
          }))
        }

        return {
          ...opt,
          ministry_name: mData?.name || 'Ministério Desconhecido',
          email: mData?.email_admin || '',
          telefone: mData?.phone || churchProfile.telefone || '',
          responsavel: churchProfile.responsavel || 'Não Informado',
          historico: historicoFormatado
        }
      })
    )

    // Contagem de oportunidades com status "Novo" (case-insensitive)
    const newCount = enriched.filter(
      (opt: any) => String(opt.status).toLowerCase().trim() === 'novo'
    ).length

    return NextResponse.json({
      oportunidades: enriched,
      new_count: newCount
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
