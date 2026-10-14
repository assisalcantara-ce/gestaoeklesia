import test from 'node:test';
import assert from 'node:assert/strict';
import { CartasService } from '../src/services/cartas-service';
import { PresidenciaService } from '../src/services/presidencia-service';

// Mock Supabase Database Generator simulando o schema real do Supabase:
// - A tabela members possui: id, ministry_id, name, status ('active' | 'inactive'), custom_fields
// - A tabela members NÃO possui is_active (qualquer tentativa de query com is_active deve simular erro)
function createMockSupabase(initialState?: {
  members?: any[];
  cartaPedidos?: any[];
  failOnMemberUpdate?: boolean;
  enableRpc?: boolean;
}) {
  const members = (initialState?.members || []).map((m) => ({ ...m }));
  const cartaPedidos = (initialState?.cartaPedidos || []).map((p) => ({ ...p }));
  let failOnMemberUpdate = initialState?.failOnMemberUpdate || false;
  const enableRpc = initialState?.enableRpc ?? true;

  const mock = {
    setFailOnMemberUpdate(val: boolean) {
      failOnMemberUpdate = val;
    },
    getMembers() {
      return members;
    },
    getCartaPedidos() {
      return cartaPedidos;
    },
    rpc(funcName: string, params: any) {
      if (!enableRpc) {
        return Promise.resolve({ data: null, error: { message: `RPC ${funcName} não instalada.` } });
      }

      if (funcName === 'deliberar_carta_presidencia_rpc') {
        if (!params.p_autorizador_id) {
          return Promise.resolve({ data: null, error: { message: 'Acesso negado: Usuário não autenticado.' } });
        }

        const pedido = cartaPedidos.find((p) => p.id === params.p_pedido_id && p.ministry_id === params.p_ministry_id);
        if (!pedido) {
          return Promise.resolve({ data: null, error: { message: 'Pedido de carta não encontrado ou pertencente a outro ministério.' } });
        }

        if (pedido.status !== 'pendente') {
          return Promise.resolve({ data: null, error: { message: `Este pedido já se encontra ${pedido.status}.` } });
        }

        if (params.p_decisao === 'rejeitar') {
          if (!params.p_motivo_rejeicao || !params.p_motivo_rejeicao.trim()) {
            return Promise.resolve({ data: null, error: { message: 'O motivo do indeferimento da carta é obrigatório.' } });
          }
          pedido.status = 'rejeitado';
          pedido.motivo_rejeicao = params.p_motivo_rejeicao.trim();
          pedido.autorizador_id = params.p_autorizador_id;
          pedido.autorizador_nome = params.p_autorizador_nome || 'Presidência';
          pedido.data_autorizacao = new Date().toISOString();
          return Promise.resolve({
            data: { sucesso: true, pedido_id: pedido.id, status: 'rejeitado', membro_inativado: false },
            error: null,
          });
        }

        if (params.p_decisao === 'autorizar') {
          if (failOnMemberUpdate) {
            // Em falha atômica, o PostgreSQL reverte tudo (inclusive o pedido)
            return Promise.resolve({ data: null, error: { message: 'Falha atômica simulada no PostgreSQL ao atualizar membro.' } });
          }

          pedido.status = 'autorizado';
          pedido.autorizador_id = params.p_autorizador_id;
          pedido.autorizador_nome = params.p_autorizador_nome || 'Presidência';
          pedido.data_autorizacao = new Date().toISOString();

          let inativado = false;
          if ((pedido.tipo_carta === 'mudanca' || pedido.tipo_carta === 'desligamento') && pedido.member_id) {
            const member = members.find((m) => m.id === pedido.member_id && m.ministry_id === params.p_ministry_id);
            if (!member) {
              return Promise.resolve({ data: null, error: { message: 'Membro associado ao pedido não encontrado.' } });
            }

            member.status = 'inactive';
            const cf = { ...(member.custom_fields || {}) };
            const hist = [...(cf.historico_processos || [])];
            const eventId = `delib_${pedido.id}_carta_${pedido.tipo_carta}`;

            const alreadyExists = hist.some((h) => h.id === eventId);
            if (!alreadyExists) {
              hist.push({
                id: eventId,
                processo_id: pedido.id,
                pedido_id: pedido.id,
                tipo_evento: `carta_${pedido.tipo_carta}`,
                tipo_documento: pedido.tipo_carta === 'mudanca' ? 'Carta de Mudança' : 'Carta de Desligamento',
                status_anterior: member.status,
                status_resultante: 'inactive',
                destino: pedido.destino || null,
                responsavel: params.p_autorizador_nome || 'Presidência',
                usuario_id: params.p_autorizador_id,
                criado_em: new Date().toISOString(),
              });
              cf.historico_processos = hist;
              cf.historicoProcessos = hist;
              member.custom_fields = cf;
            }
            inativado = true;
          }

          return Promise.resolve({
            data: { sucesso: true, pedido_id: pedido.id, status: 'autorizado', membro_inativado: inativado },
            error: null,
          });
        }
      }

      if (funcName === 'registrar_evento_historico_membro') {
        const member = members.find((m) => m.id === params.p_member_id && m.ministry_id === params.p_ministry_id);
        if (!member) {
          return Promise.resolve({ data: null, error: { message: 'Membro não encontrado.' } });
        }

        const cf = { ...(member.custom_fields || {}) };
        const hist = [...(cf.historico_processos || [])];
        const eventId = params.p_evento_id;

        const exists = hist.some((h) => h.id === eventId || (params.p_documento_id && h.documento_id === params.p_documento_id));
        if (exists) {
          if (params.p_novo_status_membro && member.status !== params.p_novo_status_membro) {
            member.status = params.p_novo_status_membro;
          }
          return Promise.resolve({ data: { sucesso: true, evento_id: eventId, ja_registrado: true }, error: null });
        }

        if (params.p_novo_status_membro) {
          member.status = params.p_novo_status_membro;
        }

        hist.push({
          id: eventId,
          documento_id: params.p_documento_id || null,
          pedido_id: params.p_pedido_id || null,
          tipo_evento: params.p_tipo_evento,
          tipo_documento: params.p_tipo_documento || null,
          status_resultante: params.p_novo_status_membro || member.status,
          destino: params.p_destino || null,
          responsavel: params.p_responsavel || 'Presidência',
          criado_em: new Date().toISOString(),
        });

        cf.historico_processos = hist;
        cf.historicoProcessos = hist;
        member.custom_fields = cf;

        return Promise.resolve({ data: { sucesso: true, evento_id: eventId, ja_registrado: false }, error: null });
      }

      return Promise.resolve({ data: null, error: { message: `Função RPC desconhecida: ${funcName}` } });
    },
    from(tableName: string) {
      if (tableName === 'members') {
        let filters: Record<string, any> = {};
        let updateData: Record<string, any> | null = null;

        const chain: any = {
          select(fields: string) {
            // Se tentar selecionar is_active, simula o erro PostgreSQL 42703 do banco real!
            if (fields.includes('is_active')) {
              throw new Error('column members.is_active does not exist');
            }
            return chain;
          },
          eq(column: string, value: any) {
            filters[column] = value;
            return chain;
          },
          maybeSingle() {
            const found = members.find((m) => {
              return Object.entries(filters).every(([k, v]) => m[k] === v);
            });
            return Promise.resolve({ data: found ? { ...found } : null, error: null });
          },
          single() {
            const found = members.find((m) => {
              return Object.entries(filters).every(([k, v]) => m[k] === v);
            });
            if (!found) return Promise.resolve({ data: null, error: { message: 'Not found' } });
            return Promise.resolve({ data: { ...found }, error: null });
          },
          update(data: any) {
            // Se tentar atualizar is_active, simula o erro PostgreSQL 42703!
            if ('is_active' in data) {
              throw new Error('column members.is_active does not exist');
            }
            updateData = data;
            return {
              eq(col1: string, val1: any) {
                filters[col1] = val1;
                return {
                  eq(col2: string, val2: any) {
                    filters[col2] = val2;
                    if (failOnMemberUpdate) {
                      return Promise.resolve({
                        data: null,
                        error: { message: 'Erro forçado de banco ao atualizar membro' },
                      });
                    }
                    const target = members.find((m) => {
                      return Object.entries(filters).every(([k, v]) => m[k] === v);
                    });
                    if (target) {
                      Object.assign(target, updateData);
                      return Promise.resolve({ data: [target], error: null });
                    }
                    return Promise.resolve({ data: [], error: null });
                  },
                };
              },
            };
          },
        };
        return chain;
      }

      if (tableName === 'carta_pedidos') {
        let filters: Record<string, any> = {};
        let updateData: Record<string, any> | null = null;

        const chain: any = {
          select() {
            return chain;
          },
          eq(column: string, value: any) {
            filters[column] = value;
            return chain;
          },
          maybeSingle() {
            const found = cartaPedidos.find((p) => {
              return Object.entries(filters).every(([k, v]) => p[k] === v);
            });
            return Promise.resolve({ data: found ? { ...found } : null, error: null });
          },
          update(data: any) {
            updateData = data;
            return {
              eq(col1: string, val1: any) {
                filters[col1] = val1;
                return {
                  eq(col2: string, val2: any) {
                    filters[col2] = val2;
                    const target = cartaPedidos.find((p) => {
                      return Object.entries(filters).every(([k, v]) => p[k] === v);
                    });
                    if (target) {
                      Object.assign(target, updateData);
                    }
                    return {
                      select() {
                        return {
                          single() {
                            return Promise.resolve({ data: target ? { ...target } : null, error: null });
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
        return chain;
      }

      throw new Error(`Tabela mock não configurada: ${tableName}`);
    },
  };

  return mock;
}

test('1. Deliberação Presidencial Atômica via RPC: Mudança autorizada inativa membro (status="inactive") e grava histórico sem is_active', async () => {
  const ministryId = 'tenant-1';
  const memberId = 'member-101';
  const pedidoId = 'pedido-mudanca-1';

  const mockDb = createMockSupabase({
    members: [
      {
        id: memberId,
        ministry_id: ministryId,
        name: 'Carlos Oliveira',
        status: 'active',
        custom_fields: {},
      },
    ],
    cartaPedidos: [
      {
        id: pedidoId,
        ministry_id: ministryId,
        member_id: memberId,
        membro_nome: 'Carlos Oliveira',
        tipo_carta: 'mudanca',
        status: 'pendente',
        destino: 'Congregação Filial Sul',
        observacoes: 'Mudança de estado',
      },
    ],
    enableRpc: true,
  });

  const userPresidente = {
    userId: 'user-pres-1',
    userName: 'Pastor Presidente João',
    ministryId,
    roles: ['admin'],
    isAdmin: true,
    nivel: 'presidencia' as any,
  };

  const resultado = await PresidenciaService.deliberarCartaPedido(mockDb, userPresidente, {
    pedido_id: pedidoId,
    decisao: 'autorizar',
  });

  assert.equal(resultado.status, 'autorizado');

  // Verifica membro atualizado no schema real: status = 'inactive' e SEM coluna is_active
  const memberUpdated = mockDb.getMembers().find((m) => m.id === memberId);
  assert.ok(memberUpdated);
  assert.equal(memberUpdated.status, 'inactive');
  assert.equal((memberUpdated as any).is_active, undefined);

  // Verifica gravação no histórico dual-key
  const hist = memberUpdated.custom_fields.historico_processos;
  assert.ok(Array.isArray(hist));
  assert.equal(hist.length, 1);
  assert.equal(hist[0].tipo_evento, 'carta_mudanca');
  assert.equal(hist[0].status_resultante, 'inactive');
  assert.equal(hist[0].destino, 'Congregação Filial Sul');
});

test('2. Deliberação Presidencial Atômica via RPC: Desligamento autorizado inativa membro (status="inactive")', async () => {
  const ministryId = 'tenant-1';
  const memberId = 'member-102';
  const pedidoId = 'pedido-deslig-1';

  const mockDb = createMockSupabase({
    members: [
      {
        id: memberId,
        ministry_id: ministryId,
        name: 'Maria Santos',
        status: 'active',
        custom_fields: {},
      },
    ],
    cartaPedidos: [
      {
        id: pedidoId,
        ministry_id: ministryId,
        member_id: memberId,
        membro_nome: 'Maria Santos',
        tipo_carta: 'desligamento',
        status: 'pendente',
      },
    ],
    enableRpc: true,
  });

  const userPresidente = {
    userId: 'user-pres-1',
    userName: 'Pastor Presidente João',
    ministryId,
    roles: ['presidencia'],
    isAdmin: true,
    nivel: 'presidencia' as any,
  };

  await PresidenciaService.deliberarCartaPedido(mockDb, userPresidente, {
    pedido_id: pedidoId,
    decisao: 'autorizar',
  });

  const memberUpdated = mockDb.getMembers().find((m) => m.id === memberId);
  assert.ok(memberUpdated);
  assert.equal(memberUpdated.status, 'inactive');
  assert.equal((memberUpdated as any).is_active, undefined);
  assert.equal(memberUpdated.custom_fields.historico_processos.length, 1);
});

test('3. Pedido pendente ou rejeitado NÃO inativa membro', async () => {
  const ministryId = 'tenant-1';
  const memberId = 'member-103';
  const pedidoId = 'pedido-rejeitado-1';

  const mockDb = createMockSupabase({
    members: [
      {
        id: memberId,
        ministry_id: ministryId,
        name: 'Pedro Ferreira',
        status: 'active',
        custom_fields: {},
      },
    ],
    cartaPedidos: [
      {
        id: pedidoId,
        ministry_id: ministryId,
        member_id: memberId,
        tipo_carta: 'mudanca',
        status: 'pendente',
      },
    ],
    enableRpc: true,
  });

  const userPresidente = {
    userId: 'user-pres-1',
    userName: 'Pastor Presidente João',
    ministryId,
    roles: ['admin'],
    isAdmin: true,
    nivel: 'presidencia' as any,
  };

  await PresidenciaService.deliberarCartaPedido(mockDb, userPresidente, {
    pedido_id: pedidoId,
    decisao: 'rejeitar',
    motivo_rejeicao: 'Pendência patrimonial',
  });

  const memberUpdated = mockDb.getMembers().find((m) => m.id === memberId);
  assert.ok(memberUpdated);
  assert.equal(memberUpdated.status, 'active');
  assert.equal(memberUpdated.custom_fields.historico_processos, undefined);
});

test('4. Emissão de documentos (trânsito, declaração, recomendação) registra histórico mantendo status="active"', async () => {
  const ministryId = 'tenant-1';
  const memberId = 'member-104';
  const docId = 'doc-transito-99';

  const mockDb = createMockSupabase({
    members: [
      {
        id: memberId,
        ministry_id: ministryId,
        name: 'Lucas Pereira',
        status: 'active',
        custom_fields: {},
      },
    ],
  });

  const res = await CartasService.registrarEmissaoDocumentoNoHistoricoMembro(mockDb, {
    memberId,
    ministryId,
    documentoId: docId,
    tipoDocumento: 'Carta de Trânsito',
    tipoCarta: 'transito',
    destino: 'Igreja Parceira RJ',
    motivo: 'Viagem a trabalho',
    usuarioNome: 'Secretária Ana',
    usuarioId: 'sec-ana',
  });

  assert.equal(res.sucesso, true);

  const memberUpdated = mockDb.getMembers().find((m) => m.id === memberId);
  assert.ok(memberUpdated);
  // O membro DEVE permanecer ativo
  assert.equal(memberUpdated.status, 'active');
  assert.equal((memberUpdated as any).is_active, undefined);

  const hist = memberUpdated.custom_fields.historico_processos;
  assert.equal(hist.length, 1);
  assert.equal(hist[0].tipo_evento, 'carta_transito');
  assert.equal(hist[0].documento_id, docId);
});

test('5. Idempotência estrita: Reimpressões não duplicam histórico', async () => {
  const ministryId = 'tenant-1';
  const memberId = 'member-105';
  const docId = 'doc-declaracao-01';

  const mockDb = createMockSupabase({
    members: [
      {
        id: memberId,
        ministry_id: ministryId,
        name: 'Silvia Almeida',
        status: 'active',
        custom_fields: {},
      },
    ],
  });

  await CartasService.registrarEmissaoDocumentoNoHistoricoMembro(mockDb, {
    memberId,
    ministryId,
    documentoId: docId,
    tipoDocumento: 'Declaração de Membro Ativo',
    categoria: 'declaracao',
    usuarioNome: 'Secretaria',
  });

  // Repetição
  const res2 = await CartasService.registrarEmissaoDocumentoNoHistoricoMembro(mockDb, {
    memberId,
    ministryId,
    documentoId: docId,
    tipoDocumento: 'Declaração de Membro Ativo',
    categoria: 'declaracao',
    usuarioNome: 'Secretaria',
  });

  assert.equal(res2.sucesso, true);

  const memberUpdated = mockDb.getMembers().find((m) => m.id === memberId);
  const hist = memberUpdated.custom_fields.historico_processos;
  assert.equal(hist.length, 1);
});

test('6. Reativação futura: preserva integralmente o histórico prévio e define status="active"', async () => {
  const ministryId = 'tenant-1';
  const memberId = 'member-106';

  const eventoAnterior = {
    id: 'delib_ped-01_carta_mudanca',
    tipo_evento: 'carta_mudanca',
    tipo_documento: 'Carta de Mudança',
    status_resultante: 'inactive',
  };

  const mockDb = createMockSupabase({
    members: [
      {
        id: memberId,
        ministry_id: ministryId,
        name: 'Roberto Castro',
        status: 'inactive',
        custom_fields: {
          historico_processos: [eventoAnterior],
          historicoProcessos: [eventoAnterior],
        },
      },
    ],
  });

  const res = await CartasService.reativarMembro(mockDb, {
    memberId,
    ministryId,
    motivo: 'Retorno formal à congregação',
    usuarioNome: 'Pastor Presidente',
    usuarioId: 'user-pres-1',
  });

  assert.equal(res.sucesso, true);

  const memberUpdated = mockDb.getMembers().find((m) => m.id === memberId);
  assert.ok(memberUpdated);
  assert.equal(memberUpdated.status, 'active');
  assert.equal((memberUpdated as any).is_active, undefined);

  const hist = memberUpdated.custom_fields.historico_processos;
  assert.equal(hist.length, 2);
  assert.equal(hist[0].tipo_evento, 'carta_mudanca');
  assert.equal(hist[1].tipo_evento, 'reativacao');
  assert.equal(hist[1].status_resultante, 'active');
});

test('7. Atomicidade e Rollback no PostgreSQL: falha reverte a deliberação inteira', async () => {
  const ministryId = 'tenant-1';
  const memberId = 'member-107';
  const pedidoId = 'pedido-falha-1';

  const mockDb = createMockSupabase({
    members: [
      {
        id: memberId,
        ministry_id: ministryId,
        name: 'Joaquim Silva',
        status: 'active',
        custom_fields: {},
      },
    ],
    cartaPedidos: [
      {
        id: pedidoId,
        ministry_id: ministryId,
        member_id: memberId,
        tipo_carta: 'mudanca',
        status: 'pendente',
      },
    ],
    failOnMemberUpdate: true,
    enableRpc: true,
  });

  const userPresidente = {
    userId: 'user-pres-1',
    userName: 'Pastor Presidente João',
    ministryId,
    roles: ['admin'],
    isAdmin: true,
    nivel: 'presidencia' as any,
  };

  // Se a RPC falhar, o serviço aciona o fallback com rollback de consistência
  await assert.rejects(
    async () => {
      await PresidenciaService.deliberarCartaPedido(mockDb, userPresidente, {
        pedido_id: pedidoId,
        decisao: 'autorizar',
      });
    },
    /A deliberação foi revertida|Falha atômica/
  );

  // O pedido permanece rigorosamente pendente e não-deliberado
  const pedido = mockDb.getCartaPedidos().find((p) => p.id === pedidoId);
  assert.equal(pedido.status, 'pendente');
  assert.ok(!pedido.autorizador_id);
});
