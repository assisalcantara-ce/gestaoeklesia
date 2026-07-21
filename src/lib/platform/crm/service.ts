import { SupabaseClient } from '@supabase/supabase-js'
import { OportunidadeComercial, HistoricoComercial, CrmActivity, CrmTimelineItem, CrmNextAction, CrmSummary } from './types'
import { CommercialService } from '../commercial/CommercialService'

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
  /**
   * Retorna o resumo consolidado de métricas do CRM com base no CommercialService.
   */
  async getSummary(supabase: SupabaseClient): Promise<CrmSummary> {
    const commercialService = new CommercialService();
    const list = await commercialService.list(supabase);

    let totalLeads = 0;
    let totalTrials = 0;
    let totalClientesAtivos = 0;
    let totalRenovacoes = 0;
    let totalCobrancasPendentes = 0;
    let totalNegociacoes = 0;
    let totalCancelados = 0;

    list.forEach(item => {
      const status = item.lifecycle.status;
      if (status === 'LEAD') totalLeads++;
      else if (status === 'TRIAL' || status === 'TRIAL_EXPIRING') totalTrials++;
      else if (status === 'ACTIVE') totalClientesAtivos++;
      else if (status === 'RENEWAL') totalRenovacoes++;
      else if (status === 'PAYMENT_PENDING') totalCobrancasPendentes++;
      else if (status === 'NEGOTIATION') totalNegociacoes++;
      else if (status === 'CANCELED' || status === 'TRIAL_EXPIRED') totalCancelados++;
    });

    return {
      totalLeads,
      totalTrials,
      totalClientesAtivos,
      totalRenovacoes,
      totalCobrancasPendentes,
      totalNegociacoes,
      totalCancelados
    };
  }

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


  /**
   * Retorna a linha do tempo comercial (histórico) de um determinado lead ou cliente.
   * Une eventos cadastrais, comerciais e financeiros do Supabase em uma ordenação cronológica decrescente.
   */
  async getTimeline(supabase: SupabaseClient, id: string): Promise<CrmTimelineItem[]> {
    const timeline: CrmTimelineItem[] = [];

    // 1. Localizar pre_registration
    let preReg: any = null;
    const { data: preRegDirect } = await supabase
      .from('pre_registrations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (preRegDirect) {
      preReg = preRegDirect;
    }

    // 2. Localizar ministry
    let ministry: any = null;
    if (preRegDirect?.user_id) {
      const { data: minData } = await supabase
        .from('ministries')
        .select('*')
        .eq('user_id', preRegDirect.user_id)
        .maybeSingle();
      ministry = minData;
    } else {
      const { data: minDirect } = await supabase
        .from('ministries')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (minDirect) {
        ministry = minDirect;
        // Se achou ministério, tenta achar preReg pelo user_id do ministério
        if (minDirect.user_id) {
          const { data: preRegData } = await supabase
            .from('pre_registrations')
            .select('*')
            .eq('user_id', minDirect.user_id)
            .maybeSingle();
          preReg = preRegData;
        }
      }
    }

    const preRegId = preReg?.id || id;
    const ministryId = ministry?.id || null;

    // 3. Consultar Histórico do CRM (oportunidades_comerciais_historico)
    const { data: crmHistory } = await supabase
      .from('oportunidades_comerciais_historico')
      .select('*')
      .eq('oportunidade_id', preRegId);

    // 4. Consultar Faturas de faturamento (platform_billing_invoices)
    let invoices: any[] = [];
    if (ministryId) {
      const { data: minInvoices } = await supabase
        .from('platform_billing_invoices')
        .select('*')
        .eq('ministry_id', ministryId);
      invoices = minInvoices || [];
    }

    // -- MAPEAR EVENTOS --

    // A. Evento de Criação do Lead
    if (preReg) {
      timeline.push({
        id: `pr_create_${preReg.id}`,
        data: preReg.created_at,
        evento: 'Lead Criado',
        usuario: 'Sistema',
        descricao: `Pré-cadastro experimental no plano "${preReg.plan || 'starter'}" registrado com sucesso.`
      });
    }

    // B. Evento de Ativação do Ministério
    if (ministry) {
      timeline.push({
        id: `min_active_${ministry.id}`,
        data: ministry.subscription_start_date || ministry.created_at,
        evento: 'Assinatura Ativada',
        usuario: 'Sistema/Administrador',
        descricao: `Ministério "${ministry.name}" ativado com vigência comercial até ${new Date(ministry.subscription_end_date).toLocaleDateString('pt-BR')}.`
      });
    }

    // C. Eventos de Histórico Comercial do CRM
    if (crmHistory) {
      crmHistory.forEach((h: any) => {
        timeline.push({
          id: `crm_hist_${h.id}`,
          data: h.created_at,
          evento: `Funil: ${h.status_anterior} ➔ ${h.status_novo}`,
          usuario: h.usuario || 'Sistema',
          descricao: h.observacao || 'Transição de status efetuada.'
        });
      });
    }

    // D. Eventos de Faturamento
    invoices.forEach((inv: any) => {
      // Evento de Emissão
      timeline.push({
        id: `inv_create_${inv.id}`,
        data: inv.created_at,
        evento: 'Fatura Emitida',
        usuario: 'Sistema/Billing',
        descricao: `Cobrança de R$ ${Number(inv.amount).toFixed(2).replace('.', ',')} gerada com vencimento para ${new Date(inv.due_date).toLocaleDateString('pt-BR')}.`
      });

      // Evento de Compensação (se paga)
      if (inv.status === 'paid' && inv.updated_at) {
        timeline.push({
          id: `inv_paid_${inv.id}`,
          data: inv.updated_at,
          evento: 'Fatura Compensada',
          usuario: 'Gateway/Asaas',
          descricao: `Pagamento compensado com sucesso. Assinatura confirmada.`
        });
      }
    });

    // Ordenação cronológica decrescente (mais recente primeiro)
    return timeline.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }


  /**
   * Retorna a lista de oportunidades abertas (Novo, Em Atendimento, Aguardando Pagamento) mapeadas como atividades.
   */
  async getActivities(supabase: SupabaseClient, id?: string): Promise<CrmActivity[]> {
    // 1. Carregar oportunidades comerciais do banco filtrando pelos status abertos informados
    const { data, error } = await supabase
      .from('oportunidades_comerciais')
      .select('*')
      .in('status', ['Novo', 'Em Atendimento', 'Em Negociação', 'Aguardando Pagamento']);

    if (error) {
      console.error('[CrmService.getActivities] Erro:', error.message);
      return [];
    }

    let list = data || [];

    // 2. Se um id de filtro for fornecido, filtra as ocorrências associadas
    if (id) {
      list = list.filter(o => o.id === id || o.ministry_id === id);
    }

    // 3. Mapear para DTO CrmActivity
    return list.map((opt: any) => {
      // Prioridade heurística baseada no tempo de expiração ou criação
      let prioridade = 'média';
      const diffTime = Math.abs(Date.now() - new Date(opt.created_at).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 15) {
        prioridade = 'alta';
      } else if (diffDays < 3) {
        prioridade = 'baixa';
      }

      return {
        id: opt.id,
        oportunidadeId: opt.id,
        ministryId: opt.ministry_id || null,
        nome: opt.ministry_name || 'Negociação Comercial',
        responsavel: opt.responsavel || 'Não Informado',
        status: opt.status,
        prioridade,
        dataCriacao: opt.created_at,
        ultimaAtualizacao: opt.updated_at || opt.created_at
      };
    });
  }


  /**
   * Retorna as próximas ações planejadas para um lead ou negociação comercial com base no Lifecycle.
   * Filtra, mapeia tarefas operacionais e ordena por prioridade, data de vencimento e nome.
   */
  async getNextActions(supabase: SupabaseClient, id?: string): Promise<CrmNextAction[]> {
    const commercialService = new CommercialService();
    const list = await commercialService.list(supabase);

    const actions: CrmNextAction[] = [];

    list.forEach(item => {
      // Filtrar opcionalmente por ID de cliente se fornecido
      if (id && item.id !== id) {
        return;
      }

      const status = item.lifecycle.status;
      let acao = '';
      let prioridade: 'alta' | 'media' | 'baixa' = 'media';
      let vencimentoDate = new Date();

      if (status === 'NEGOTIATION') {
        acao = 'Realizar follow-up';
        prioridade = 'alta';
        const lastRef = item.ultimaInteracao ? new Date(item.ultimaInteracao) : new Date(item.created_at);
        vencimentoDate = new Date(lastRef.getTime() + 3 * 24 * 60 * 60 * 1000);
      } else if (status === 'TRIAL_EXPIRING') {
        acao = 'Entrar em contato antes do fim do trial';
        prioridade = 'alta';
        const daysLeft = item.daysRemaining || 3;
        vencimentoDate = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);
      } else if (status === 'PAYMENT_PENDING') {
        acao = 'Cobrar pagamento';
        prioridade = 'alta';
        vencimentoDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 dia útil para cobrança
      } else if (status === 'RENEWAL') {
        acao = 'Iniciar renovação';
        prioridade = 'media';
        const daysLeft = item.daysRemaining || 30;
        vencimentoDate = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);
      } else if (status === 'LEAD') {
        acao = 'Primeiro contato';
        prioridade = 'media';
        const lastRef = new Date(item.created_at);
        vencimentoDate = new Date(lastRef.getTime() + 1 * 24 * 60 * 60 * 1000);
      } else {
        // Ignora status que não exigem ações comerciais pendentes (ACTIVE, CANCELED, TRIAL_EXPIRED)
        return;
      }

      actions.push({
        id: `action_${item.id}_${status.toLowerCase()}`,
        oportunidadeId: item.id,
        ministryId: item.origem === 'ministries' ? item.id : null,
        nome: item.nome,
        acao,
        prioridade,
        vencimento: vencimentoDate.toISOString(),
        lifecycle: item.lifecycle,
        descricao: `${acao} para o cliente ${item.nome}.`,
        dataPrevista: vencimentoDate.toISOString()
      });
    });

    // Ordenação:
    // 1. Prioridade (Alta primeiro)
    // 2. Data de Vencimento (Mais próxima/antiga primeiro)
    // 3. Nome (Alfabético)
    return actions.sort((a, b) => {
      // Prioridade weight
      const weightA = a.prioridade === 'alta' ? 3 : a.prioridade === 'media' ? 2 : 1;
      const weightB = b.prioridade === 'alta' ? 3 : b.prioridade === 'media' ? 2 : 1;

      if (weightB !== weightA) {
        return weightB - weightA;
      }

      // Vencimento
      const timeA = new Date(a.vencimento).getTime();
      const timeB = new Date(b.vencimento).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      // Nome
      return a.nome.localeCompare(b.nome);
    });
  }
}
