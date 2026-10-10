import { LifecycleService } from '../lifecycle/LifecycleService';
import { ComercialViewModel } from './types';

export class CommercialBuilder {
  private lifecycleService = new LifecycleService();

  /**
   * Constrói e unifica as diferentes tabelas em ComercialViewModels aplicando precedência de dados
   * e eliminando duplicidades de leads já convertidos.
   */
  buildList(params: {
    ministries: any[];
    preRegs: any[];
    invoices: any[];
    opportunities: any[];
    opportunitiesHistory: any[];
    configurations: any[];
    crmInteractions?: any[];
    members?: any[];
    congregacoes?: any[];
  }): ComercialViewModel[] {
    const {
      ministries,
      preRegs,
      invoices,
      opportunities,
      opportunitiesHistory,
      configurations,
      crmInteractions = [],
      members = [],
      congregacoes = []
    } = params;

    const list: ComercialViewModel[] = [];
    const processedUserIds = new Set<string>();

    // Mapear contagem de membros por ministry_id
    const membersCountByMinMap = new Map<string, number>();
    members.forEach(m => {
      if (m.ministry_id) {
        membersCountByMinMap.set(m.ministry_id, (membersCountByMinMap.get(m.ministry_id) || 0) + 1);
      }
    });

    // Mapear contagem de congregações por ministry_id
    const congCountByMinMap = new Map<string, number>();
    congregacoes.forEach(c => {
      if (c.ministry_id) {
        congCountByMinMap.set(c.ministry_id, (congCountByMinMap.get(c.ministry_id) || 0) + 1);
      }
    });

    // Mapear interações do CRM por ministry_id
    const interactionsByMinMap = new Map<string, any[]>();
    crmInteractions.forEach(it => {
      if (it.ministry_id) {
        const arr = interactionsByMinMap.get(it.ministry_id) || [];
        arr.push(it);
        interactionsByMinMap.set(it.ministry_id, arr);
      }
    });

    // Mapear relacionamentos
    const preRegMap = new Map<string, any>();
    preRegs.forEach(p => { if (p.user_id) preRegMap.set(p.user_id, p); });

    const invoicesByMinMap = new Map<string, any[]>();
    invoices.forEach(inv => {
      if (inv.ministry_id) {
        const list = invoicesByMinMap.get(inv.ministry_id) || [];
        list.push(inv);
        invoicesByMinMap.set(inv.ministry_id, list);
      }
    });

    const optByMinMap = new Map<string, any>();
    opportunities.forEach(opt => {
      if (opt.ministry_id) optByMinMap.set(opt.ministry_id, opt);
    });

    const configMap = new Map<string, any>();
    configurations.forEach(c => {
      if (c.ministry_id) configMap.set(c.ministry_id, c.church_profile || {});
    });

    const historyByOptMap = new Map<string, any[]>();
    opportunitiesHistory.forEach(h => {
      if (h.oportunidade_id) {
        const list = historyByOptMap.get(h.oportunidade_id) || [];
        list.push(h);
        historyByOptMap.set(h.oportunidade_id, list);
      }
    });

    // 1. Processar Ministérios cadastrados (Prioridade máxima de precedência)
    ministries.forEach(m => {
      if (m.user_id) processedUserIds.add(m.user_id);

      const preReg = m.user_id ? preRegMap.get(m.user_id) : null;
      const minInvoices = invoicesByMinMap.get(m.id) || [];
      const opt = optByMinMap.get(m.id) || null;
      const churchProfile = configMap.get(m.id) || {};
      const rawHistory = opt ? (historyByOptMap.get(opt.id) || []) : [];

      // Calcular Lifecycle Comercial
      const lifecycleResult = this.lifecycleService.calculate({
        ministry: m,
        preRegistration: preReg,
        billingInvoices: minInvoices,
        opportunity: opt
      });

      // Status financeiro consolidado
      const statusFinanceiro = this.resolveStatusFinanceiro(minInvoices);

      // Formatar histórico comercial
      const historico = rawHistory.map((h: any) => ({
        id: h.id,
        status_anterior: h.status_anterior || '',
        status_novo: h.status_novo || '',
        usuario: h.usuario || 'Sistema',
        observacao: h.observacao || '',
        created_at: h.created_at
      }));

      // Interações reais registradas no CRM
      const minInteractions = interactionsByMinMap.get(m.id) || [];
      const latestInteraction = minInteractions[0] || null;

      list.push({
        id: m.id,
        origem: 'ministries',
        nome: m.name || 'Ministério Sem Nome',
        responsavel: churchProfile.responsavel || 'Não Informado',
        email: m.email_admin || preReg?.email || '',
        telefone: m.phone || churchProfile.telefone || preReg?.phone || preReg?.whatsapp || '',
        lifecycle: lifecycleResult,
        plano: m.plan || 'basic',
        statusFinanceiro,
        ultimaInteracao: latestInteraction?.created_at || opt?.updated_at || m.updated_at || null,
        proximaAcao: latestInteraction?.proxima_acao || opt?.observacao_interna || null,
        daysRemaining: lifecycleResult.daysRemaining,
        dataExpiracao: m.subscription_end_date || preReg?.trial_expires_at || null,
        reason: lifecycleResult.reason,
        usageStats: {
          totalMembros: membersCountByMinMap.get(m.id) || 0,
          totalCongregacoes: congCountByMinMap.get(m.id) || 0,
          maxMembros: m.quantity_members || undefined,
          maxCongregacoes: m.quantity_temples || undefined
        },

        // Mapeamento Legado
        ministry_name: m.name || 'Ministério Sem Nome',
        plano_solicitado: opt?.plano_solicitado || m.plan || 'basic',
        observacao: opt?.observacao || null,
        observacao_interna: latestInteraction?.descricao || opt?.observacao_interna || null,
        created_at: opt?.created_at || m.created_at,
        status: opt?.status || 'Novo',
        historico
      });
    });

    // 2. Processar Pré-cadastros restantes (Leads experimentais não convertidos em ministérios)
    preRegs.forEach(p => {
      if (p.user_id && processedUserIds.has(p.user_id)) return; // desduplica lead já convertido

      const opt = opportunities.find(o => o.id === p.id) || null;
      const rawHistory = opt ? (historyByOptMap.get(opt.id) || []) : [];

      const lifecycleResult = this.lifecycleService.calculate({
        preRegistration: p,
        opportunity: opt,
        billingInvoices: null,
        ministry: null
      });

      const historico = rawHistory.map((h: any) => ({
        id: h.id,
        status_anterior: h.status_anterior || '',
        status_novo: h.status_novo || '',
        usuario: h.usuario || 'Sistema',
        observacao: h.observacao || '',
        created_at: h.created_at
      }));

      // Interações reais registradas no CRM (buscando por id do pre_reg ou email)
      const preInteractions = interactionsByMinMap.get(p.id) || [];
      const latestInteraction = preInteractions[0] || null;

      list.push({
        id: p.id,
        origem: 'pre_registrations',
        nome: p.ministry_name || 'Novo Lead',
        responsavel: p.pastor_name || p.responsible_name || 'Não Informado',
        email: p.email || '',
        telefone: p.phone || p.whatsapp || '',
        lifecycle: lifecycleResult,
        plano: p.plan || 'starter',
        statusFinanceiro: 'none',
        ultimaInteracao: latestInteraction?.created_at || opt?.updated_at || p.created_at || null,
        proximaAcao: latestInteraction?.proxima_acao || opt?.observacao_interna || null,
        daysRemaining: lifecycleResult.daysRemaining,
        dataExpiracao: p.trial_expires_at || null,
        reason: lifecycleResult.reason,
        usageStats: {
          totalMembros: 0,
          totalCongregacoes: 0
        },

        // Mapeamento Legado
        ministry_name: p.ministry_name || 'Novo Lead',
        plano_solicitado: opt?.plano_solicitado || p.plan || 'starter',
        observacao: opt?.observacao || null,
        observacao_interna: latestInteraction?.descricao || opt?.observacao_interna || null,
        created_at: opt?.created_at || p.created_at,
        status: opt?.status || 'Novo',
        historico
      });
    });


    return list;
  }

  private resolveStatusFinanceiro(invoices: any[]): ComercialViewModel['statusFinanceiro'] {
    if (!invoices || invoices.length === 0) return 'none';
    if (invoices.some(i => i.status === 'overdue')) return 'overdue';
    if (invoices.some(i => i.status === 'pending')) return 'pending';
    if (invoices.some(i => i.status === 'paid')) return 'paid';
    return 'cancelled';
  }
}
