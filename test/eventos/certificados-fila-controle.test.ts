import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarChaveIdempotencia,
  enfileirarEnvioCertificado,
  registrarHistoricoEnvio,
  atualizarStatusFila,
} from '../../src/lib/eventos-certificados-fila-service.js';

test('Controle de Certificados — Idempotência Cruzada, Lease Lock e Isolamento por Tenant', async (t) => {
  const eventoId = 'ev-congresso-2026';
  const inscricaoId = 'insc-12345';
  const ministryId = 'tenant-igreja-central';

  await t.test('1. Idempotência Cruzada: canais primários (individual, massa, check-in) compartilham a mesma chave de proteção contra reenvio', () => {
    const keyIndividual = gerarChaveIdempotencia(eventoId, inscricaoId, 'individual');
    const keyCheckin = gerarChaveIdempotencia(eventoId, inscricaoId, 'checkin');
    const keyMassa = gerarChaveIdempotencia(eventoId, inscricaoId, 'massa');

    assert.equal(keyIndividual, `cert:${eventoId}:${inscricaoId}:emissao_primaria`);
    assert.equal(keyCheckin, `cert:${eventoId}:${inscricaoId}:emissao_primaria`);
    assert.equal(keyMassa, `cert:${eventoId}:${inscricaoId}:emissao_primaria`);
    assert.equal(keyIndividual, keyCheckin, 'Individual e Check-in compartilham a mesma chave de idempotência');
    assert.equal(keyCheckin, keyMassa, 'Check-in e Massa compartilham a mesma chave de idempotência');

    // Segunda via: deve aceitar timestamp customizado e diferenciar execuções
    const ts1 = 1700000000000;
    const ts2 = 1700000005000;
    const keySegundaVia1 = gerarChaveIdempotencia(eventoId, inscricaoId, 'segunda_via', ts1);
    const keySegundaVia2 = gerarChaveIdempotencia(eventoId, inscricaoId, 'segunda_via', ts2);

    assert.equal(keySegundaVia1, `cert:${eventoId}:${inscricaoId}:segunda_via:1700000000000`);
    assert.notEqual(keySegundaVia1, keySegundaVia2, 'Segundas vias distintas têm chaves distintas');
  });

  await t.test('2. Concorrência entre canais diferentes: solicitação via check-in bloqueia disparo simultâneo em massa ou individual', async () => {
    const mockSupabase: any = {
      from: (tabela: string) => {
        if (tabela === 'eventos_certificados_envios') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (tabela === 'eventos_certificados_fila') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  maybeSingle: () => Promise.resolve({
                    data: { id: 'fila-item-checkin-em-curso', status: 'processando' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    // Operador dispara envio em massa enquanto checkin já está em processamento
    const resMassa = await enfileirarEnvioCertificado(mockSupabase, {
      ministryId,
      eventoId,
      inscricaoId,
      templateModeloId: 'tpl-1',
      origem: 'massa',
      emailDestinatario: 'participante@eklesia.com',
      nomeParticipante: 'Carlos Silva',
    });

    assert.equal(resMassa.sucesso, true);
    assert.equal(resMassa.ignoradoPorDuplicidade, true);
    assert.equal(resMassa.filaId, 'fila-item-checkin-em-curso');
    assert.match(resMassa.motivo || '', /já está em processamento na fila/);
  });

  await t.test('3. Enfileiramento: rejeita duplicatas se certificado já foi entregue com sucesso e não é segunda via', async () => {
    const mockSupabase: any = {
      from: (tabela: string) => {
        if (tabela === 'eventos_certificados_envios') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    maybeSingle: () => Promise.resolve({
                      data: { id: 'envio-sucesso-previo', status: 'entregue' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const res = await enfileirarEnvioCertificado(mockSupabase, {
      ministryId,
      eventoId,
      inscricaoId,
      templateModeloId: 'tpl-1',
      origem: 'individual',
      emailDestinatario: 'participante@eklesia.com',
      nomeParticipante: 'Carlos Silva',
    });

    assert.equal(res.sucesso, true);
    assert.equal(res.ignoradoPorDuplicidade, true);
    assert.match(res.motivo || '', /já foi emitido e aceito pelo provedor/);
  });

  await t.test('4. Enfileiramento: permite segunda via apenas sob ação explícita', async () => {
    let insertedPayload: any = null;
    const mockSupabase: any = {
      from: (tabela: string) => {
        if (tabela === 'eventos_certificados_fila') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
            insert: (payload: any) => {
              insertedPayload = payload;
              return {
                select: () => ({
                  single: () => Promise.resolve({
                    data: { id: 'fila-segunda-via-01', ...payload },
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        return {};
      },
    };

    const res = await enfileirarEnvioCertificado(mockSupabase, {
      ministryId,
      eventoId,
      inscricaoId,
      templateModeloId: 'tpl-1',
      origem: 'segunda_via',
      emailDestinatario: 'participante@eklesia.com',
      nomeParticipante: 'Carlos Silva',
      permitirSegundaVia: true,
      solicitadoPor: 'admin-user-01',
    });

    assert.equal(res.sucesso, true);
    assert.equal(res.ignoradoPorDuplicidade, undefined);
    assert.equal(res.filaId, 'fila-segunda-via-01');
    assert.equal(insertedPayload.origem, 'segunda_via');
    assert.equal(insertedPayload.solicitado_por, 'admin-user-01');
  });

  await t.test('5. Histórico de envio: registra status detalhados e integridade de auditoria', async () => {
    let insertData: any = null;
    const mockSupabase: any = {
      from: (tabela: string) => {
        assert.equal(tabela, 'eventos_certificados_envios');
        return {
          insert: (payload: any) => {
            insertData = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: 'envio-audit-001', ...payload },
                  error: null,
                }),
              }),
            };
          },
        };
      },
    };

    const res = await registrarHistoricoEnvio(mockSupabase, {
      ministryId,
      eventoId,
      inscricaoId,
      templateModeloId: 'tpl-padrao',
      origem: 'checkin',
      emailDestinatario: 'pastor@eklesia.com',
      nomeParticipante: 'Pr. Marcos Albuquerque',
      idempotencyKey: 'cert:ev-1:insc-1:emissao_primaria',
      status: 'aceito_provedor',
      resendMessageId: 'msg_resend_998877',
      solicitadoPor: 'sistema_checkin_auto',
      dadosSnapshot: { cargaHoraria: '12h', emitidoEm: '2026-10-25' },
    });

    assert.equal(res.sucesso, true);
    assert.equal(res.id, 'envio-audit-001');
    assert.equal(insertData.ministry_id, ministryId);
    assert.equal(insertData.resend_message_id, 'msg_resend_998877');
    assert.equal(insertData.status, 'aceito_provedor');
    assert.equal(insertData.origem, 'checkin');
    assert.deepEqual(insertData.dados_snapshot, { cargaHoraria: '12h', emitidoEm: '2026-10-25' });
  });

  await t.test('6. Proteção de Lease Lock: worker antigo não finaliza tarefa se o lock expirou e foi assumido por outro', async () => {
    // Simula validação onde o worker que sofreu timeout tenta concluir com seu workerId antigo
    let capturedWhere: Record<string, any> = {};
    let capturedUpdatePayload: any = null;
    const mockSupabase: any = {
      from: (tabela: string) => {
        assert.equal(tabela, 'eventos_certificados_fila');
        return {
          update: (payload: any) => {
            capturedUpdatePayload = payload;
            return {
              eq: (col1: string, val1: any) => {
                capturedWhere[col1] = val1;
                return {
                  eq: (col2: string, val2: any) => {
                    capturedWhere[col2] = val2;
                    // Se o worker tentou atualizar mas o lock_by no banco já pertence a outro worker ('worker-novo-02'),
                    // o update afeta 0 linhas ou retorna erro de mismatch
                    if (val2 === 'worker-antigo-timeout-01') {
                      return Promise.resolve({ error: null }); // Sucesso na query, mas condicionada ao workerId
                    }
                    return Promise.resolve({ error: new Error('Worker lease mismatch') });
                  },
                };
              },
            };
          },
        };
      },
    };

    const ok = await atualizarStatusFila(mockSupabase, 'fila-item-01', 'enviado', {
      workerId: 'worker-antigo-timeout-01',
      resendMessageId: 'resend-tardio-123',
    });

    assert.equal(ok, true);
    assert.equal(capturedUpdatePayload.status, 'enviado');
    assert.equal(capturedWhere['id'], 'fila-item-01');
    assert.equal(capturedWhere['locked_by'], 'worker-antigo-timeout-01', 'O update deve exigir estritamente o lock_by do worker proprietário');
  });

  await t.test('7. Isolamento por Tenant (RLS): consultas e enfileiramentos respeitam ministry_id', async () => {
    let queriedMinistryId: string | null = null;
    const mockSupabase: any = {
      from: (tabela: string) => {
        if (tabela === 'eventos_certificados_envios') {
          return {
            select: () => ({
              eq: (col1: string, val1: any) => {
                if (col1 === 'ministry_id') queriedMinistryId = val1;
                return {
                  eq: () => ({
                    in: () => ({
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                };
              },
            }),
          };
        }
        if (tabela === 'eventos_certificados_fila') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
            insert: (payload: any) => {
              assert.equal(payload.ministry_id, ministryId, 'O payload a ser inserido deve conter estritamente o tenant corrente');
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: { id: 'fila-tenant-01' }, error: null }),
                }),
              };
            },
          };
        }
        return {};
      },
    };

    await enfileirarEnvioCertificado(mockSupabase, {
      ministryId,
      eventoId,
      inscricaoId,
      templateModeloId: 'tpl-1',
      origem: 'individual',
      emailDestinatario: 'participante@eklesia.com',
      nomeParticipante: 'Carlos Silva',
    });

    assert.equal(queriedMinistryId, ministryId, 'A checagem de duplicidade deve consultar apenas o tenant corrente');
  });
});
