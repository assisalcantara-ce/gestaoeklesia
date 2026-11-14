import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CelulasService } from '../../src/services/celulas-service';

// Mock do Supabase Client focado no Lote 6
function createMockSupabase(dbState: any) {
  return {
    from: (table: string) => {
      let currentTable = table;
      let filters: Array<{ field: string; op: string; value: any }> = [];
      let isSingle = false;
      let isMaybeSingle = false;

      const chain: any = {
        select: (_fields: string = '*') => {
          return chain;
        },
        eq: (field: string, val: any) => {
          filters.push({ field, op: 'eq', value: val });
          return chain;
        },
        order: (_field: string, _options?: any) => {
          return chain;
        },
        single: () => {
          isSingle = true;
          return chain.execute();
        },
        maybeSingle: () => {
          isMaybeSingle = true;
          return chain.execute();
        },
        insert: (data: any) => {
          const rows = Array.isArray(data) ? data : [data];
          const inserted: any[] = [];
          for (const row of rows) {
            const newRow = {
              id: row.id || `mock-id-${Math.random().toString(36).substring(2, 9)}`,
              ...row,
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at || new Date().toISOString(),
            };
            if (!dbState[currentTable]) {
              dbState[currentTable] = [];
            }
            dbState[currentTable].push(newRow);
            inserted.push(newRow);
          }

          return {
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: inserted[0], error: null }),
              single: () => Promise.resolve({ data: inserted[0], error: null }),
            }),
            then: (resolve: any) => resolve({ data: inserted, error: null }),
          };
        },
        update: (data: any) => {
          return {
            eq: (field: string, val: any) => {
              filters.push({ field, op: 'eq', value: val });
              return {
                eq: (f2: string, v2: any) => {
                  filters.push({ field: f2, op: 'eq', value: v2 });
                  let updatedItem: any = null;
                  const records = dbState[currentTable] || [];
                  for (let i = 0; i < records.length; i++) {
                    const match = filters.every(f => records[i][f.field] === f.value);
                    if (match) {
                      records[i] = { ...records[i], ...data, updated_at: new Date().toISOString() };
                      updatedItem = records[i];
                    }
                  }
                  return {
                    select: () => ({
                      single: () => Promise.resolve({ data: updatedItem, error: null }),
                    }),
                    then: (resolve: any) => resolve({ data: updatedItem, error: null }),
                  };
                },
              };
            },
          };
        },
        execute: () => {
          const records = dbState[currentTable] || [];
          let filtered = records.filter((r: any) => {
            return filters.every(f => {
              if (f.op === 'eq') return r[f.field] === f.value;
              return true;
            });
          });

          if (isSingle) {
            return Promise.resolve({
              data: filtered[0] || null,
              error: filtered[0] ? null : { message: 'Row not found' },
            });
          }

          if (isMaybeSingle) {
            return Promise.resolve({
              data: filtered[0] || null,
              error: null,
            });
          }

          return Promise.resolve({
            data: filtered,
            error: null,
          });
        },
      };

      chain.then = (resolve: any) => chain.execute().then(resolve);
      return chain;
    },
  };
}

describe('Módulo Células — Lote 6: Comunicação Ministerial e Notificações', () => {
  const ministryA = 'ministry-alpha-uuid';
  const ministryB = 'ministry-beta-cross-tenant';
  const congregacaoA1 = 'congregacao-a1-uuid';
  const userLiderA = 'user-lider-a-uuid';
  const celulaA1 = 'celula-a1-uuid';
  const participanteA1 = 'part-a1-uuid';

  const initialDbState = {
    ministries: [{ id: ministryA }, { id: ministryB }],
    congregacoes: [{ id: congregacaoA1, ministry_id: ministryA, nome: 'Sede Alpha' }],
    celulas: [
      {
        id: celulaA1,
        ministry_id: ministryA,
        congregacao_id: congregacaoA1,
        nome: 'Célula Atos 2',
        horario: '19:30',
        dia_semana: 3,
        endereco: 'Rua das Oliveiras, 25',
      },
    ],
    celulas_participantes: [
      {
        id: participanteA1,
        ministry_id: ministryA,
        celula_id: celulaA1,
        nome_completo: 'Carlos Eduardo',
        telefone: '(11) 98765-4321',
        papel: 'membro',
        status: 'ativo',
      },
      {
        id: 'part-sem-fone',
        ministry_id: ministryA,
        celula_id: celulaA1,
        nome_completo: 'Mariana Silva',
        telefone: null,
        papel: 'membro',
        status: 'ativo',
      },
    ],
    celulas_comunicados: [] as any[],
    celulas_templates_mensagens: [] as any[],
    celulas_mensagens_logs: [] as any[],
  };

  it('1. Salva comunicado ministerial com público-alvo e prioridade', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    const com = await service.salvarComunicado(ministryA, {
      celula_id: celulaA1,
      publico_alvo: 'participantes',
      prioridade: 'alta',
      titulo: 'Reunião Especial de Oração',
      conteudo: 'Nesta terça teremos nosso clamor com toda a célula.',
    }, userLiderA);

    assert.ok(com.id);
    assert.strictEqual(com.titulo, 'Reunião Especial de Oração');
    assert.strictEqual(com.publico_alvo, 'participantes');
    assert.strictEqual(com.status, 'publicado');
  });

  it('2. Bloqueia criação de comunicado em célula de outro ministério (anti cross-tenant)', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    await assert.rejects(
      async () => {
        await service.salvarComunicado(ministryB, {
          celula_id: celulaA1, // Célula pertence ao ministério A!
          titulo: 'Comunicado Cross-tenant Inválido',
          conteudo: 'Teste de invasão entre tenants...',
        });
      },
      /A célula informada não pertence a este ministério/
    );
  });

  it('3. Prepara mensagem para WhatsApp manual com interpolação de tags e sanitização do número', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    const prep = await service.prepararMensagemWhatsAppManual(ministryA, {
      celula_id: celulaA1,
      participante_id: participanteA1,
      template_tipo: 'lembrete_reuniao',
    }, userLiderA);

    assert.strictEqual(prep.destinatario_nome, 'Carlos Eduardo');
    assert.strictEqual(prep.destinatario_telefone, '5511987654321');
    assert.ok(prep.mensagem.includes('Carlos Eduardo'));
    assert.ok(prep.mensagem.includes('Célula Atos 2'));
    assert.ok(prep.mensagem.includes('19:30'));
    assert.ok(prep.link_whatsapp.startsWith('https://wa.me/5511987654321?text='));
    
    // Confirma gravação em log auditável
    assert.strictEqual(dbState.celulas_mensagens_logs.length, 1);
    assert.strictEqual(dbState.celulas_mensagens_logs[0].status_envio, 'preparado');
    assert.strictEqual(dbState.celulas_mensagens_logs[0].canal, 'whatsapp_manual');
  });

  it('4. Rejeita preparação de WhatsApp para participante sem telefone cadastrado', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    await assert.rejects(
      async () => {
        await service.prepararMensagemWhatsAppManual(ministryA, {
          celula_id: celulaA1,
          participante_id: 'part-sem-fone',
          template_tipo: 'lembrete_reuniao',
        }, userLiderA);
      },
      /O participante selecionado não possui telefone de contato cadastrado/
    );
  });

  it('5. Salva e recupera templates customizados de comunicação por ministério', async () => {
    const dbState = JSON.parse(JSON.stringify(initialDbState));
    const service = new CelulasService(createMockSupabase(dbState) as any);

    const novoTemplate = await service.salvarTemplate(ministryA, {
      tipo: 'comunicado_geral',
      titulo: 'Aviso Ministerial',
      corpo_texto: 'Atenção membros da {celula}: {mensagem_extra}',
      variaveis_disponiveis: ['{celula}', '{mensagem_extra}'],
    });

    assert.ok(novoTemplate.id);
    assert.strictEqual(novoTemplate.tipo, 'comunicado_geral');
    assert.strictEqual(novoTemplate.titulo, 'Aviso Ministerial');
  });
});
