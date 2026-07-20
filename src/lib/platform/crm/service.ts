import { SupabaseClient } from '@supabase/supabase-js'
import { OportunidadeComercial, HistoricoComercial } from './types'

export interface ConvertOpportunityInput {
  oportunidadeId: string
  novoStatus: 'Convertido' | 'Aguardando Pagamento'
  planName: string
  adminEmail: string
  adminUserId?: string | null
}

export interface ConvertOpportunityResult {
  success: boolean
  oportunidade: OportunidadeComercial | null
  ministryId: string
  isFallback: boolean
  historico: HistoricoComercial | null
}

export interface ResolvedOpportunity {
  oportunidade: OportunidadeComercial
  ministry: any
  planRow: any
  isFallback: boolean
}

export class CrmService {
  async getOportunidade(_id: string): Promise<OportunidadeComercial | null> {
    // Esqueleto para obter oportunidade comercial no futuro
    return null
  }

  async recordHistory(
    _oportunidadeId: string,
    _statusAnterior: string,
    _statusNovo: string,
    _usuario: string,
    _obs: string
  ): Promise<HistoricoComercial | null> {
    // Esqueleto para persistir histórico comercial no futuro
    return null
  }

  /**
   * Resolve oportunidade e dados associados (ministério e plano).
   * Aplica fallback para support_tickets se não houver registro em oportunidades_comerciais.
   */
  async resolveOpportunityContext(
    supabaseAdmin: SupabaseClient,
    oportunidadeId: string,
    planoSlug: string
  ): Promise<ResolvedOpportunity> {
    // 1. Busca oportunidade direta
    const { data: opt, error: optErr } = await supabaseAdmin
      .from('oportunidades_comerciais')
      .select('*')
      .eq('id', oportunidadeId)
      .maybeSingle()

    let isFallback = false
    let oportunidade: OportunidadeComercial

    if (optErr || !opt) {
      isFallback = true
      // Fallback: busca em support_tickets
      const { data: ticket, error: ticketErr } = await supabaseAdmin
        .from('support_tickets')
        .select('*')
        .eq('id', oportunidadeId)
        .maybeSingle()

      if (ticketErr || !ticket) {
        throw new Error('Oportunidade/Ticket não encontrado')
      }

      oportunidade = {
        id: ticket.id,
        ministry_id: ticket.ministry_id,
        ministry_name: ticket.ministry_name || '',
        responsavel: ticket.responsavel || '',
        email: ticket.email || '',
        telefone: ticket.telefone || '',
        plano_solicitado: planoSlug,
        observacao: null,
        observacao_interna: null,
        status: ticket.status === 'resolved' || ticket.status === 'closed' ? 'Convertido' : 'Novo',
        created_at: ticket.created_at
      }
    } else {
      oportunidade = opt as OportunidadeComercial
    }

    const ministryId = oportunidade.ministry_id

    // 2. Busca ministério
    const { data: ministry, error: mError } = await supabaseAdmin
      .from('ministries')
      .select('*')
      .eq('id', ministryId)
      .single()

    if (mError || !ministry) {
      throw new Error('Ministério correspondente não encontrado')
    }

    // 3. Busca plano
    const { data: planRow, error: pError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('slug', planoSlug)
      .maybeSingle()

    if (pError || !planRow) {
      throw new Error('Plano selecionado inválido')
    }

    return { oportunidade, ministry, planRow, isFallback }
  }

  /**
   * Converte uma oportunidade para novo status, registrando histórico e fallback.
   * Responsabilidade exclusivamente comercial: NÃO aciona assinatura nem cobrança.
   */
  async convertOpportunity(
    supabaseAdmin: SupabaseClient,
    input: ConvertOpportunityInput
  ): Promise<ConvertOpportunityResult> {
    const { oportunidadeId, novoStatus, planName, adminEmail, adminUserId } = input

    // Busca oportunidade atual (para capturar status anterior)
    const { data: currentOpt } = await supabaseAdmin
      .from('oportunidades_comerciais')
      .select('id, status, ministry_id')
      .eq('id', oportunidadeId)
      .maybeSingle()

    let isFallback = !currentOpt
    const statusAnterior = currentOpt?.status || 'Novo'
    const ministryId = currentOpt?.ministry_id || ''
    const obs = novoStatus === 'Convertido'
      ? `Conversão efetuada diretamente pelo administrador no plano ${planName}.`
      : `Fatura gerada via ASAAS no plano ${planName}. Aguardando confirmação de pagamento.`

    let historico: HistoricoComercial | null = null

    if (!isFallback) {
      // Atualiza oportunidade em oportunidades_comerciais
      await supabaseAdmin
        .from('oportunidades_comerciais')
        .update({
          status: novoStatus,
          observacao_interna: obs,
          updated_at: new Date().toISOString(),
          updated_by: adminEmail
        })
        .eq('id', oportunidadeId)

      // Registra histórico
      const { data: hist } = await supabaseAdmin
        .from('oportunidades_comerciais_historico')
        .insert([{
          oportunidade_id: oportunidadeId,
          status_anterior: statusAnterior,
          status_novo: novoStatus,
          usuario: adminEmail,
          observacao: obs,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      historico = hist as HistoricoComercial | null
    } else {
      // Fallback para support_tickets
      const ticketStatus = novoStatus === 'Convertido' ? 'resolved' : 'in_progress'

      await supabaseAdmin
        .from('support_tickets')
        .update({
          status: ticketStatus,
          resolution_notes: obs,
          updated_at: new Date().toISOString()
        })
        .eq('id', oportunidadeId)

      const systemMessage = `[Histórico Comercial] Status alterado para \"${novoStatus}\".\nUsuário: ${adminEmail}\n\nObservação:\n${obs}`
      await supabaseAdmin
        .from('support_ticket_messages')
        .insert([{
          ticket_id: oportunidadeId,
          user_id: adminUserId || '00000000-0000-0000-0000-000000000000',
          message: systemMessage,
          created_at: new Date().toISOString()
        }])
    }

    return {
      success: true,
      oportunidade: currentOpt as OportunidadeComercial | null,
      ministryId,
      isFallback,
      historico
    }
  }
}
