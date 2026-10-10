import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CrmService } from '../src/lib/platform/crm/service.js';

// Mock do SupabaseClient
function createMockSupabase(overrides: Record<string, any> = {}) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        }),
        order: () => Promise.resolve({ data: overrides[table] || [], error: null }),
        then: (resolve: (val: any) => void) => resolve({ data: overrides[table] || [], error: null })
      })
    })
  };
}

test('4. Geração de Próximas Ações (getNextActions) com TRIAL_EXPIRED e regras de interação', async () => {
  const crmService = new CrmService();

  const now = Date.now();
  const pastEnd = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

  // Caso A: Trial expirado SEM nenhuma interação registrada -> 'Contatar trial expirado para fechamento' (alta prioridade)
  // Caso B: Trial expirado COM interação recente (2 dias atrás) -> 'Acompanhar proposta pós-trial' (média prioridade)
  // Caso C: Trial expirado COM interação antiga (10 dias atrás) -> 'Realizar follow-up de recuperação pós-trial' (alta prioridade)
  const mockMinistries = [
    {
      id: 'min-sem-interacao',
      name: 'Igreja Sem Contato',
      user_id: 'u-1',
      subscription_status: 'trial',
      subscription_end_date: pastEnd,
      created_at: pastEnd,
      is_active: true
    },
    {
      id: 'min-contato-recente',
      name: 'Igreja Contato Recente',
      user_id: 'u-2',
      subscription_status: 'trial',
      subscription_end_date: pastEnd,
      created_at: pastEnd,
      is_active: true
    },
    {
      id: 'min-contato-antigo',
      name: 'Igreja Contato Antigo',
      user_id: 'u-3',
      subscription_status: 'trial',
      subscription_end_date: pastEnd,
      created_at: pastEnd,
      is_active: true
    }
  ];

  const mockInteractions = [
    {
      id: 'int-recent',
      ministry_id: 'min-contato-recente',
      tipo: 'whatsapp',
      descricao: 'Conversamos ontem.',
      proxima_acao: 'Enviar proposta comercial atualizada',
      created_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 dia atrás
    },
    {
      id: 'int-old',
      ministry_id: 'min-contato-antigo',
      tipo: 'ligacao',
      descricao: 'Falamos há 10 dias.',
      proxima_acao: 'Ligar novamente',
      created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 dias atrás
    }
  ];

  const mockDb = createMockSupabase({
    ministries: mockMinistries,
    pre_registrations: [],
    platform_billing_invoices: [],
    oportunidades_comerciais: [],
    oportunidades_comerciais_historico: [],
    configurations: [],
    crm_interactions: mockInteractions
  });

  // Limpa cache se existir
  const { CommercialCache } = await import('../src/lib/platform/commercial-cache/CommercialCache.js');
  CommercialCache.getInstance().clear();

  const nextActions = await crmService.getNextActions(mockDb as any);

  const actionSemInteracao = nextActions.find(a => a.ministryId === 'min-sem-interacao');
  assert.ok(actionSemInteracao);
  assert.equal(actionSemInteracao.acao, 'Contatar trial expirado para fechamento');
  assert.equal(actionSemInteracao.prioridade, 'alta');

  const actionRecente = nextActions.find(a => a.ministryId === 'min-contato-recente');
  assert.ok(actionRecente);
  assert.equal(actionRecente.acao, 'Acompanhar proposta pós-trial');
  assert.equal(actionRecente.prioridade, 'media');

  const actionAntiga = nextActions.find(a => a.ministryId === 'min-contato-antigo');
  assert.ok(actionAntiga);
  assert.equal(actionAntiga.acao, 'Realizar follow-up de recuperação pós-trial');
  assert.equal(actionAntiga.prioridade, 'alta');
});

test('5. Contrato e Resposta de CrmService.getActivities sem tabela legada', async () => {
  const crmService = new CrmService();

  const pastEnd = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const mockMinistries = [
    {
      id: 'min-exp',
      name: 'Igreja Esperança',
      user_id: 'u-exp',
      subscription_status: 'trial',
      subscription_end_date: pastEnd,
      created_at: pastEnd,
      is_active: true
    }
  ];

  const mockDb = createMockSupabase({
    ministries: mockMinistries,
    pre_registrations: [],
    platform_billing_invoices: [],
    oportunidades_comerciais: [],
    oportunidades_comerciais_historico: [],
    configurations: [],
    crm_interactions: []
  });

  const { CommercialCache } = await import('../src/lib/platform/commercial-cache/CommercialCache.js');
  CommercialCache.getInstance().clear();

  const activities = await crmService.getActivities(mockDb as any);

  assert.equal(activities.length, 1);
  const act = activities[0];
  assert.equal(act.id, 'min-exp');
  assert.equal(act.nome, 'Igreja Esperança');
  assert.equal(act.origem, 'Ministério');
  assert.equal(act.lifecycle?.status, 'TRIAL_EXPIRED');
  assert.equal(act.nextAction?.acao, 'Contatar trial expirado para fechamento');
  assert.equal(act.prioridade, 'alta');
});
