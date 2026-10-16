import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Testes para resolução de user_id e criação de tickets no Admin Backoffice
 * Rota: POST /api/v1/admin/tickets
 * Garante que a constraint NOT NULL de support_tickets.user_id nunca seja violada.
 */

// Lógica pura espelhando a resolução implementada em src/app/api/v1/admin/tickets/route.ts
async function resolveTicketUserId({ body, supabaseMock, adminUser }) {
  let resolvedUserId = body.user_id || null;

  if (!resolvedUserId) {
    // 1. Tentar obter o user_id do proprietário do ministério
    const { data: ministry } = await supabaseMock
      .from('ministries')
      .select('user_id')
      .eq('id', body.ministry_id)
      .maybeSingle();

    if (ministry?.user_id) {
      resolvedUserId = ministry.user_id;
    }
  }

  if (!resolvedUserId) {
    // 2. Tentar obter qualquer usuário vinculado ao ministério
    const { data: ministryUser } = await supabaseMock
      .from('ministry_users')
      .select('user_id')
      .eq('ministry_id', body.ministry_id)
      .limit(1)
      .maybeSingle();

    if (ministryUser?.user_id) {
      resolvedUserId = ministryUser.user_id;
    }
  }

  if (!resolvedUserId) {
    // 3. Fallback: usuário autenticado no painel admin
    resolvedUserId = adminUser?.id || null;
  }

  return resolvedUserId;
}

function validateTicketBody(body) {
  if (!body.ministry_id || !body.subject || !body.description || !body.category) {
    return {
      isValid: false,
      error: 'Campos obrigatórios: ministry_id, subject, description, category'
    };
  }
  return { isValid: true };
}

function buildTicketInsertPayload({ body, resolvedUserId }) {
  if (!resolvedUserId) {
    throw new Error('null value in column "user_id" of relation "support_tickets" violates not-null constraint');
  }

  return {
    ministry_id: body.ministry_id,
    user_id: resolvedUserId,
    subject: body.subject,
    description: body.description,
    category: body.category,
    priority: body.priority || 'medium',
    status: 'open',
    sla_minutes: body.sla_minutes || 480,
  };
}

describe('Admin Suporte — Resolução de user_id e Criação de Tickets', () => {
  const adminUser = {
    id: 'admin-uuid-9999',
    email: 'admin@gestaoeklesia.com.br'
  };

  it('deve rejeitar requisição sem campos obrigatórios', () => {
    const invalidBodies = [
      {},
      { ministry_id: 'm-1' },
      { ministry_id: 'm-1', subject: 'Problema' },
      { ministry_id: 'm-1', subject: 'Problema', description: 'Ajuda' }, // sem category
      { subject: 'Problema', description: 'Ajuda', category: 'duvida' }, // sem ministry_id
    ];

    for (const body of invalidBodies) {
      const validation = validateTicketBody(body);
      assert.strictEqual(validation.isValid, false);
      assert.match(validation.error, /Campos obrigatórios/);
    }
  });

  it('deve usar user_id fornecido explicitamente no body', async () => {
    const body = {
      ministry_id: 'm-123',
      user_id: 'user-explicit-111',
      subject: 'Dúvida sobre relatório',
      description: 'Como exportar os dados em Excel?',
      category: 'duvida'
    };

    const supabaseMock = {
      from: () => {
        throw new Error('Não deveria consultar banco se user_id já foi fornecido');
      }
    };

    const resolved = await resolveTicketUserId({ body, supabaseMock, adminUser });
    assert.strictEqual(resolved, 'user-explicit-111');

    const payload = buildTicketInsertPayload({ body, resolvedUserId: resolved });
    assert.strictEqual(payload.user_id, 'user-explicit-111');
    assert.strictEqual(payload.ministry_id, 'm-123');
    assert.strictEqual(payload.status, 'open');
  });

  it('deve resolver user_id a partir do proprietário do ministério (ministries.user_id)', async () => {
    const body = {
      ministry_id: 'm-123',
      subject: 'Erro ao emitir carta',
      description: 'Falha ao salvar carta de recomendação',
      category: 'problema_tecnico'
    };

    const supabaseMock = {
      from: (table) => {
        assert.strictEqual(table, 'ministries');
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { user_id: 'pastor-owner-uuid-456' } })
            })
          })
        };
      }
    };

    const resolved = await resolveTicketUserId({ body, supabaseMock, adminUser });
    assert.strictEqual(resolved, 'pastor-owner-uuid-456');

    const payload = buildTicketInsertPayload({ body, resolvedUserId: resolved });
    assert.strictEqual(payload.user_id, 'pastor-owner-uuid-456');
    assert.notStrictEqual(payload.user_id, null);
  });

  it('deve resolver user_id a partir de ministry_users se ministries.user_id for nulo', async () => {
    const body = {
      ministry_id: 'm-789',
      subject: 'Ajuste de permissão',
      description: 'Secretário precisa de acesso extra',
      category: 'duvida'
    };

    const supabaseMock = {
      from: (table) => {
        if (table === 'ministries') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { user_id: null } })
              })
            })
          };
        }
        if (table === 'ministry_users') {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: { user_id: 'secretario-user-uuid-789' } })
                })
              })
            })
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      }
    };

    const resolved = await resolveTicketUserId({ body, supabaseMock, adminUser });
    assert.strictEqual(resolved, 'secretario-user-uuid-789');

    const payload = buildTicketInsertPayload({ body, resolvedUserId: resolved });
    assert.strictEqual(payload.user_id, 'secretario-user-uuid-789');
  });

  it('deve utilizar fallback para adminUser.id se o ministério não tiver nenhum usuário associado', async () => {
    const body = {
      ministry_id: 'm-orphan',
      subject: 'Contato proativo de suporte',
      description: 'Iniciando suporte pelo time de atendimento',
      category: 'outro'
    };

    const supabaseMock = {
      from: (table) => {
        if (table === 'ministries') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { user_id: null } })
              })
            })
          };
        }
        if (table === 'ministry_users') {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null })
                })
              })
            })
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      }
    };

    const resolved = await resolveTicketUserId({ body, supabaseMock, adminUser });
    assert.strictEqual(resolved, 'admin-uuid-9999');

    const payload = buildTicketInsertPayload({ body, resolvedUserId: resolved });
    assert.strictEqual(payload.user_id, 'admin-uuid-9999');
    assert.ok(payload.user_id, 'user_id nunca deve ser nulo');
  });

  it('deve lançar erro se não for possível resolver nenhum user_id', async () => {
    const body = {
      ministry_id: 'm-orphan',
      subject: 'Sem usuário',
      description: 'Teste de falha',
      category: 'duvida'
    };

    const supabaseMock = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
            limit: () => ({
              maybeSingle: async () => ({ data: null })
            })
          })
        })
      })
    };

    const resolved = await resolveTicketUserId({ body, supabaseMock, adminUser: null });
    assert.strictEqual(resolved, null);

    assert.throws(
      () => buildTicketInsertPayload({ body, resolvedUserId: resolved }),
      /violates not-null constraint/
    );
  });
});
