import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LifecycleService } from '../src/lib/platform/lifecycle/LifecycleService.js';
import { CommercialBuilder } from '../src/lib/platform/commercial/CommercialBuilder.js';

test('1. Classificação de trial com data de término vencida deve ser TRIAL_EXPIRED', () => {
  const lifecycle = new LifecycleService();
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 dias atrás

  const result = lifecycle.calculate({
    ministry: {
      subscription_status: 'trial',
      subscription_end_date: pastDate,
      created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
    }
  });

  assert.equal(result.status, 'TRIAL_EXPIRED');
  assert.equal(result.isTrial, true);
  assert.match(result.reason, /Período experimental encerrado/);
  assert.ok(result.daysRemaining !== undefined && result.daysRemaining <= 0);
});

test('2. Desduplicação por user_id entre ministries e pre_registrations', () => {
  const builder = new CommercialBuilder();
  const userId = 'user-uuid-1234';

  const ministries = [
    {
      id: 'min-1',
      name: 'Igreja Central',
      user_id: userId,
      subscription_status: 'trial',
      subscription_end_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
    }
  ];

  const preRegs = [
    {
      id: 'pr-1',
      church_name: 'Igreja Central Pré-cadastro',
      email: 'pastor@central.com',
      user_id: userId,
      status: 'trial',
      created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'pr-2-distinct',
      church_name: 'Igreja Independente Sem Ministério',
      email: 'outro@indep.com',
      user_id: 'another-user-999',
      status: 'trial',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ];

  const list = builder.buildList({
    ministries,
    preRegs,
    invoices: [],
    opportunities: [],
    opportunitiesHistory: [],
    configurations: [],
    crmInteractions: []
  });

  // Deve conter 2 itens: min-1 (que unificou com o lead pr-1) e pr-2-distinct.
  assert.equal(list.length, 2);
  const central = list.find(item => item.id === 'min-1');
  assert.ok(central);
  assert.equal(central.lifecycle.status, 'TRIAL_EXPIRED');
  assert.equal(central.email, 'pastor@central.com');
  // pr-1 NÃO foi adicionado como item separado
  assert.equal(list.some(item => item.id === 'pr-1'), false);
});

test('3. Enriquecimento de crm_interactions no ComercialBuilder', () => {
  const builder = new CommercialBuilder();
  const ministryId = 'min-alpha';

  const ministries = [
    {
      id: ministryId,
      name: 'Ministério Alpha',
      subscription_status: 'trial',
      subscription_end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
    }
  ];

  const crmInteractions = [
    {
      id: 'inter-1',
      ministry_id: ministryId,
      tipo: 'whatsapp',
      descricao: 'Conversamos sobre proposta de plano Pro.',
      proxima_acao: 'Aguardar retorno da diretoria até sexta-feira',
      created_at: '2026-10-08T10:00:00Z',
    }
  ];

  const list = builder.buildList({
    ministries,
    preRegs: [],
    invoices: [],
    opportunities: [],
    opportunitiesHistory: [],
    configurations: [],
    crmInteractions
  });

  const alpha = list.find(item => item.id === ministryId);
  assert.ok(alpha);
  assert.equal(alpha.ultimaInteracao, '2026-10-08T10:00:00Z');
  assert.equal(alpha.proximaAcao, 'Aguardar retorno da diretoria até sexta-feira');
  assert.equal(alpha.observacao_interna, 'Conversamos sobre proposta de plano Pro.');
});
