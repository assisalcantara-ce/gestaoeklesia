import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CrmService } from '../src/lib/platform/crm/service.js';

test('Fila de Ações - Presença de dados de contato, WhatsApp e histórico para os 15 trials expirados', async () => {
  const crmService = new CrmService();

  // Simulação com 15 ministérios em trial expirado e pré-cadastros correspondentes
  // Alguns com telefone válido, outros sem telefone, alguns com interação registrada
  const mockMinistries = Array.from({ length: 15 }, (_, i) => ({
    id: `min-trial-${i}`,
    name: `Igreja Nova Vida ${i}`,
    user_id: `user-trial-${i}`,
    subscription_status: 'trial',
    subscription_end_date: '2026-09-01T00:00:00Z',
    created_at: '2026-08-01T00:00:00Z',
    is_active: true,
    phone: i % 2 === 0 ? `(11) 98765-432${i}` : '', // Metade com telefone
  }));

  // 5 pré-cadastros com mesmo user_id (desduplicados mas que complementam telefone/email)
  const mockPreRegs = Array.from({ length: 5 }, (_, i) => ({
    id: `pr-${i}`,
    ministry_name: `Igreja Nova Vida ${i}`,
    user_id: `user-trial-${i}`,
    status: 'trial',
    email: `pastor${i}@novavida.com`,
    whatsapp: `1199999000${i}`,
    created_at: '2026-08-01T00:00:00Z'
  }));

  // Interações registradas apenas para os primeiros 3
  const mockInteractions = [
    {
      id: 'int-1',
      ministry_id: 'min-trial-0',
      tipo: 'whatsapp',
      descricao: 'Enviada apresentação de valores.',
      proxima_acao: 'Aguardar assembleia da igreja',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 dias atrás
    },
    {
      id: 'int-2',
      ministry_id: 'min-trial-1',
      tipo: 'ligacao',
      descricao: 'Pastores reunidos.',
      proxima_acao: 'Follow-up urgente',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 dias atrás
    }
  ];

  const mockDb = {
    from: (table: string) => ({
      select: () => ({
        order: () => Promise.resolve({ data: table === 'crm_interactions' ? mockInteractions : [], error: null }),
        then: (resolve: (val: any) => void) => {
          if (table === 'ministries') resolve({ data: mockMinistries, error: null });
          else if (table === 'pre_registrations') resolve({ data: mockPreRegs, error: null });
          else if (table === 'crm_interactions') resolve({ data: mockInteractions, error: null });
          else resolve({ data: [], error: null });
        }
      })
    })
  };

  const { CommercialCache } = await import('../src/lib/platform/commercial-cache/CommercialCache.js');
  CommercialCache.getInstance().clear();

  const nextActions = await crmService.getNextActions(mockDb as any);

  // Deve haver exatamente 15 tarefas geradas (todas correspondentes aos 15 trials expirados)
  assert.equal(nextActions.length, 15);

  // Item 0: Contato recente (2 dias atrás) -> média prioridade, 'Acompanhar proposta pós-trial'
  const item0 = nextActions.find(a => a.ministryId === 'min-trial-0');
  assert.ok(item0);
  assert.equal(item0.acao, 'Acompanhar proposta pós-trial');
  assert.equal(item0.prioridade, 'media');
  assert.equal(item0.diasSemContato, 2);

  // Item 1: Contato antigo (10 dias atrás) -> alta prioridade, 'Realizar follow-up de recuperação pós-trial'
  const item1 = nextActions.find(a => a.ministryId === 'min-trial-1');
  assert.ok(item1);
  assert.equal(item1.acao, 'Realizar follow-up de recuperação pós-trial');
  assert.equal(item1.prioridade, 'alta');
  assert.equal(item1.diasSemContato, 10);

  // Item sem contato registrado anterior: alta prioridade, 'Contatar trial expirado para fechamento'
  const itemSemContato = nextActions.find(a => a.ministryId === 'min-trial-2');
  assert.ok(itemSemContato);
  assert.equal(itemSemContato.acao, 'Contatar trial expirado para fechamento');
  assert.equal(itemSemContato.prioridade, 'alta');
  assert.ok(itemSemContato.diasSemContato !== undefined);

  // Validação de presença de dados de contato e telefone
  const comTelefone = nextActions.filter(a => !!a.telefone);
  const semTelefone = nextActions.filter(a => !a.telefone);
  assert.ok(comTelefone.length > 0, 'Deve haver itens com telefone');
  assert.ok(semTelefone.length > 0, 'Deve haver itens sem telefone para validação');
});
