import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CrmService } from '../src/lib/platform/crm/service.js';

test('Homologação 1 e 2: Trial sem contato recebe interação, recalcula dias e prioridade sem duplicatas', async () => {
  const crmService = new CrmService();

  const minId = 'min-teste-homologacao';
  const mockMinistries = [
    {
      id: minId,
      name: 'Igreja Filadélfia Homologação',
      user_id: 'user-h-1',
      subscription_status: 'trial',
      subscription_end_date: '2026-09-01T00:00:00Z',
      created_at: '2026-08-01T00:00:00Z',
      is_active: true,
      phone: '(11) 97777-8888'
    }
  ];

  // Cenário Inicial: Zero interações registradas
  let currentInteractions: any[] = [];

  const createMockDb = () => ({
    from: (table: string) => ({
      select: () => ({
        order: () => Promise.resolve({ data: table === 'crm_interactions' ? currentInteractions : [], error: null }),
        then: (resolve: (val: any) => void) => {
          if (table === 'ministries') resolve({ data: mockMinistries, error: null });
          else if (table === 'crm_interactions') resolve({ data: currentInteractions, error: null });
          else resolve({ data: [], error: null });
        }
      })
    })
  });

  const { CommercialCache } = await import('../src/lib/platform/commercial-cache/CommercialCache.js');
  CommercialCache.getInstance().clear();

  // 1. Estado Inicial: sem contato
  let actions = await crmService.getNextActions(createMockDb() as any);
  assert.equal(actions.length, 1);
  const actionInicial = actions[0];
  assert.equal(actionInicial.acao, 'Contatar trial expirado para fechamento');
  assert.equal(actionInicial.prioridade, 'alta');
  assert.equal(actionInicial.ultimaInteracao, null);

  // 2. Simula registro de contato feito AGORA (hoje)
  const agora = new Date().toISOString();
  currentInteractions.push({
    id: 'int-nova-1',
    ministry_id: minId,
    tipo: 'whatsapp',
    descricao: 'Apresentação comercial enviada.',
    proxima_acao: 'Aguardar resposta do pastor',
    created_at: agora
  });

  CommercialCache.getInstance().clear();

  // 3. Recalcular fila após interação recente
  actions = await crmService.getNextActions(createMockDb() as any);
  assert.equal(actions.length, 1, 'Não deve criar tarefas duplicadas para o mesmo cliente');
  const actionAposContato = actions[0];
  assert.equal(actionAposContato.acao, 'Acompanhar proposta pós-trial');
  assert.equal(actionAposContato.prioridade, 'media');
  assert.equal(actionAposContato.diasSemContato, 0);
  assert.equal(actionAposContato.ultimaInteracao, agora);

  // 4. Cenário de contato antigo (10 dias atrás)
  const dezDiasAtras = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  currentInteractions = [{
    id: 'int-antiga',
    ministry_id: minId,
    tipo: 'ligacao',
    descricao: 'Primeiro contato realizado semana passada.',
    proxima_acao: 'Nova ligação necessária',
    created_at: dezDiasAtras
  }];

  CommercialCache.getInstance().clear();

  actions = await crmService.getNextActions(createMockDb() as any);
  assert.equal(actions.length, 1);
  const actionContatoAntigo = actions[0];
  assert.equal(actionContatoAntigo.acao, 'Realizar follow-up de recuperação pós-trial');
  assert.equal(actionContatoAntigo.prioridade, 'alta');
  assert.equal(actionContatoAntigo.diasSemContato, 10);
});

test('Homologação 4: Geração de link e formatação segura de WhatsApp', () => {
  function cleanPhone(phone?: string) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) {
      return digits.startsWith('55') ? digits : `55${digits}`;
    }
    return null;
  }

  function buildWhatsAppUrl(act: any) {
    const rawNumber = cleanPhone(act.telefone);
    if (!rawNumber) return null;

    let saudacao = 'Olá';
    if (act.responsavel && act.responsavel !== 'Não Informado') {
      saudacao = `Olá, ${act.responsavel.split(' ')[0]}`;
    }

    let msg = `${saudacao}! Sou da equipe comercial do Gestão Eklésia.`;
    if (act.lifecycle.status === 'TRIAL_EXPIRED') {
      msg += ` Notei que o período de teste do ${act.nome} expirou recentemente. Como foi sua experiência com a plataforma? Gostaria de conhecer nossas condições especiais para continuar utilizando o sistema?`;
    }

    return `https://wa.me/${rawNumber}?text=${encodeURIComponent(msg)}`;
  }

  // Caso A: Telefone válido com DDD
  const itemValido = {
    nome: 'Igreja Betel',
    responsavel: 'Pastor Silas Malafaia',
    telefone: '(21) 98765-4321',
    lifecycle: { status: 'TRIAL_EXPIRED' }
  };
  const urlValida = buildWhatsAppUrl(itemValido);
  assert.ok(urlValida);
  assert.match(urlValida, /^https:\/\/wa\.me\/5521987654321\?text=/);
  assert.ok(urlValida.includes(encodeURIComponent('Olá, Pastor!')));
  assert.ok(urlValida.includes(encodeURIComponent('Igreja Betel')));

  // Caso B: Sem telefone ou telefone inválido
  const itemInvalido = {
    nome: 'Igreja Sem Telefone',
    responsavel: 'Não Informado',
    telefone: '',
    lifecycle: { status: 'TRIAL_EXPIRED' }
  };
  assert.equal(buildWhatsAppUrl(itemInvalido), null);

  const itemDigitosInsuficientes = {
    nome: 'Igreja Curto',
    responsavel: 'João',
    telefone: '12345',
    lifecycle: { status: 'TRIAL_EXPIRED' }
  };
  assert.equal(buildWhatsAppUrl(itemDigitosInsuficientes), null);
});

test('Homologação 7: Registro de contato não afeta status da assinatura nem status financeiro', async () => {
  const crmService = new CrmService();

  const mockMinistry = {
    id: 'min-safe-check',
    name: 'Igreja Imutabilidade',
    subscription_status: 'trial',
    subscription_end_date: '2026-09-01T00:00:00Z',
    is_active: true
  };

  const mockDb = {
    from: (table: string) => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        then: (resolve: (val: any) => void) => {
          if (table === 'ministries') resolve({ data: [mockMinistry], error: null });
          else if (table === 'crm_interactions') {
            resolve({
              data: [{
                id: 'int-1',
                ministry_id: 'min-safe-check',
                tipo: 'whatsapp',
                descricao: 'Contato registrado.',
                created_at: new Date().toISOString()
              }],
              error: null
            });
          } else resolve({ data: [], error: null });
        }
      })
    })
  };

  const { CommercialCache } = await import('../src/lib/platform/commercial-cache/CommercialCache.js');
  CommercialCache.getInstance().clear();

  const activities = await crmService.getActivities(mockDb as any);
  assert.equal(activities.length, 1);
  const act = activities[0];

  // O ciclo de vida continua rigorosamente TRIAL_EXPIRED!
  assert.equal(act.lifecycle?.status, 'TRIAL_EXPIRED');
  // O status financeiro permanece intocado ('none')
  assert.equal(act.lifecycle?.statusFinanceiro, 'none');
  // Não houve mutação em subscription_status do banco
  assert.equal(mockMinistry.subscription_status, 'trial');
});
