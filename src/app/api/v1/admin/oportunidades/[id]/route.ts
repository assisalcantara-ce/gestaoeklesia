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

    // 1. Tenta atualizar na tabela oportunidades_comerciais
    const { error: optError } = await supabaseAdmin
      .from('oportunidades_comerciais')
      .update({
        status,
        observacao_interna,
        updated_at: new Date().toISOString(),
        updated_by: adminEmail
      })
      .eq('id', id)


    // 2. Se a tabela não existir ou der erro, faz fallback para support_tickets
    if (optError) {
      console.warn('Oportunidades comerciais erro ao atualizar, tentando support_tickets:', optError.message)

      // Mapeia status de funil para status de suporte
      let ticketStatus = 'open'
      if (status === 'Convertido') {
        ticketStatus = 'resolved'
      } else if (status === 'Perdido') {
        ticketStatus = 'closed'
      } else if (status === 'Em Atendimento' || status === 'Proposta Enviada') {
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
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
