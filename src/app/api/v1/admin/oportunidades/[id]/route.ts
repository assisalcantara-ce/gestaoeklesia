import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin(request)
    if (!result.ok) return result.response
    const { supabaseAdmin, adminUser } = result.ctx

    const resolvedParams = await params
    const id = resolvedParams.id
    const { status, observacao_interna } = await request.json()

    const adminEmail = adminUser?.email || 'admin@gestaoeklesia.com.br'

    // 1. Busca o status anterior de oportunidades_comerciais
    const { data: currentOpt, error: getOptError } = await supabaseAdmin
      .from('oportunidades_comerciais')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    let statusAnterior = 'Novo'
    let isFallback = false

    if (getOptError || !currentOpt) {
      isFallback = true
    } else {
      statusAnterior = currentOpt.status || 'Novo'
    }

    if (!isFallback) {
      // 2. Atualiza oportunidades_comerciais
      const { error: optError } = await supabaseAdmin
        .from('oportunidades_comerciais')
        .update({
          status,
          observacao_interna,
          updated_at: new Date().toISOString(),
          updated_by: adminEmail
        })
        .eq('id', id)

      if (optError) {
        return NextResponse.json({ error: optError.message }, { status: 400 })
      }

      // 3. Registra histórico na tabela oportunidades_comerciais_historico
      const { error: histError } = await supabaseAdmin
        .from('oportunidades_comerciais_historico')
        .insert([{
          oportunidade_id: id,
          status_anterior: statusAnterior,
          status_novo: status,
          usuario: adminEmail,
          observacao: observacao_interna || '',
          created_at: new Date().toISOString()
        }])

      if (histError) {
        console.warn('Falha ao gravar na tabela de histórico oportunidades_comerciais_historico:', histError.message)
      }
    } else {
      // 4. Fallback para support_tickets
      const { data: currentTicket, error: getTicketError } = await supabaseAdmin
        .from('support_tickets')
        .select('status')
        .eq('id', id)
        .maybeSingle()

      if (getTicketError || !currentTicket) {
        return NextResponse.json({ error: 'Oportunidade/Ticket não encontrado.' }, { status: 404 })
      }

      const rawStatusAnterior = currentTicket.status || 'open'
      // Mapeamento simples de suporte para funil
      let statusAnteriorFunil = 'Novo'
      if (rawStatusAnterior === 'resolved' || rawStatusAnterior === 'closed') {
        statusAnteriorFunil = 'Convertido'
      } else if (rawStatusAnterior === 'in_progress') {
        statusAnteriorFunil = 'Em Atendimento'
      }

      // Mapeia status de funil para status de suporte
      let ticketStatus = 'open'
      if (status === 'Convertido') {
        ticketStatus = 'resolved'
      } else if (status === 'Perdido') {
        ticketStatus = 'closed'
      } else if (status === 'Em Atendimento' || status === 'Proposta Enviada' || status === 'Primeiro Contato' || status === 'Em Negociação' || status === 'Aguardando Cliente') {
        ticketStatus = 'in_progress'
      }

      const { error: ticketError } = await supabaseAdmin
        .from('support_tickets')
        .update({
          status: ticketStatus,
          resolution_notes: observacao_interna,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (ticketError) {
        return NextResponse.json({ error: ticketError.message }, { status: 400 })
      }

      // Gravando o histórico em support_ticket_messages como mensagem de sistema
      const systemMessage = `[Histórico Comercial] Status alterado de "${statusAnteriorFunil}" para "${status}".\nUsuário: ${adminEmail}\n\nObservação:\n${observacao_interna || 'Sem observações.'}`

      // Tenta obter o ID do admin user na tabela auth.users se existir ou usa id nulo
      await supabaseAdmin
        .from('support_ticket_messages')
        .insert([{
          ticket_id: id,
          user_id: adminUser?.id || '00000000-0000-0000-0000-000000000000', // uuid padrão ou id do admin
          message: systemMessage,
          created_at: new Date().toISOString()
        }])
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
