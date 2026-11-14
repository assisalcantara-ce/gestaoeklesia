import test from 'node:test';
import assert from 'node:assert/strict';
import { CelulasService } from '../../src/services/celulas-service';
import { temAcesso, temAcessoEscrita } from '../../src/lib/access-control';

test('Módulo Células — Lote 1: Fundação, Multi-tenant e Regras de Negócio', async (t) => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const congA = 'aaaa1111-aaaa-1111-aaaa-111111111111';
  const congB = 'bbbb2222-bbbb-2222-bbbb-222222222222';
  const memberA = '33333333-3333-3333-3333-333333333333';
  const memberB = '44444444-4444-4444-4444-444444444444';

  // Mock do Supabase com isolamento multi-tenant
  const fakeDb: Record<string, any[]> = {
    celulas: [],
    celulas_redes: [],
    celulas_configuracoes: [],
    congregacoes: [
      { id: congA, ministry_id: tenantA, nome: 'Congregação Alpha' },
      { id: congB, ministry_id: tenantB, nome: 'Congregação Beta' },
    ],
    members: [
      { id: memberA, ministry_id: tenantA, name: 'João Líder' },
      { id: memberB, ministry_id: tenantB, name: 'Carlos Outro Tenant' },
    ],
  };

  const createFakeSupabase = () => {
    return {
      from: (table: string) => {
        let currentData = [...(fakeDb[table] || [])];
        let filterMinistryId: string | null = null;
        let filterId: string | null = null;

        const chain = {
          select: () => chain,
          order: () => chain,
          eq: (field: string, val: any) => {
            if (field === 'ministry_id') filterMinistryId = val;
            if (field === 'id') filterId = val;
            currentData = currentData.filter((item) => item[field] === val);
            return chain;
          },
          maybeSingle: async () => {
            return { data: currentData[0] || null, error: null };
          },
          single: async () => {
            return { data: currentData[0] || null, error: null };
          },
          insert: (payload: any) => {
            const newItem = { id: `id-${Date.now()}-${Math.random()}`, ...payload };
            fakeDb[table].push(newItem);
            currentData = [newItem];
            return chain;
          },
          update: (payload: any) => {
            fakeDb[table] = fakeDb[table].map((item) => {
              if (item.id === filterId && item.ministry_id === filterMinistryId) {
                return { ...item, ...payload };
              }
              return item;
            });
            const updated = fakeDb[table].find((i) => i.id === filterId);
            currentData = updated ? [updated] : [];
            return chain;
          },
          upsert: (payload: any) => {
            const idx = fakeDb[table].findIndex(
              (i) => i.ministry_id === payload.ministry_id
            );
            if (idx >= 0) {
              fakeDb[table][idx] = { ...fakeDb[table][idx], ...payload };
              currentData = [fakeDb[table][idx]];
            } else {
              const newItem = { id: `id-${Date.now()}`, ...payload };
              fakeDb[table].push(newItem);
              currentData = [newItem];
            }
            return chain;
          },
        };
        return chain;
      },
    } as any;
  };

  const service = new CelulasService(createFakeSupabase());

  await t.test('1. Permite criar e atualizar configurações de células para um ministério', async () => {
    const cfg = await service.salvarConfiguracao(tenantA, {
      metodologia: 'visao_celular',
      termo_celula: 'Grupo Familiar',
      dia_padrao_reuniao: 4,
    });

    assert.equal(cfg.metodologia, 'visao_celular');
    assert.equal(cfg.termo_celula, 'Grupo Familiar');
    assert.equal(cfg.dia_padrao_reuniao, 4);

    const obtido = await service.obterConfiguracao(tenantA);
    assert.equal(obtido.termo_celula, 'Grupo Familiar');
  });

  await t.test('2. Permite criar rede ministerial com validação de dados obrigatórios', async () => {
    const rede = await service.criarRede(tenantA, {
      nome: 'Rede de Jovens',
      cor: '#e11d48',
    });

    assert.equal(rede.nome, 'Rede de Jovens');
    assert.equal(rede.cor, '#e11d48');
    assert.equal(rede.ministry_id, tenantA);
  });

  await t.test('3. Bloqueia criação de rede com coordenador de outro ministério (anti cross-tenant)', async () => {
    await assert.rejects(
      async () => {
        await service.criarRede(tenantA, {
          nome: 'Rede Casais',
          coordenador_member_id: memberB, // Pertence ao tenantB!
        });
      },
      (err: any) => {
        assert.match(err.message, /O coordenador selecionado não pertence a este ministério/);
        return true;
      }
    );
  });

  await t.test('4. Cria célula válida vinculada a congregação do mesmo ministério', async () => {
    const celula = await service.salvarCelula(tenantA, {
      nome: 'Célula Boas Novas',
      codigo: 'CEL-001',
      dia_semana: 3,
      horario: '19:30',
      congregacao_id: congA,
      lider_member_id: memberA,
    });

    assert.equal(celula.nome, 'Célula Boas Novas');
    assert.equal(celula.codigo, 'CEL-001');
    assert.equal(celula.congregacao_id, congA);
    assert.equal(celula.ministry_id, tenantA);
  });

  await t.test('5. Bloqueia vínculo de célula com congregação de outro ministério (anti cross-tenant)', async () => {
    await assert.rejects(
      async () => {
        await service.salvarCelula(tenantA, {
          nome: 'Célula Inválida',
          dia_semana: 3,
          horario: '20:00',
          congregacao_id: congB, // Pertence ao tenantB!
        });
      },
      (err: any) => {
        assert.match(err.message, /A congregação informada não pertence a este ministério/);
        return true;
      }
    );
  });

  await t.test('6. Bloqueia vínculo de célula com líder de outro ministério (anti cross-tenant)', async () => {
    await assert.rejects(
      async () => {
        await service.salvarCelula(tenantA, {
          nome: 'Célula Invasora',
          dia_semana: 3,
          horario: '20:00',
          lider_member_id: memberB, // Pertence ao tenantB!
        });
      },
      (err: any) => {
        assert.match(err.message, /O membro selecionado como líder não pertence a este ministério/);
        return true;
      }
    );
  });

  await t.test('7. Bloqueia ciclos diretos e indiretos de genealogia entre células', async () => {
    // Cria célula 1 (Pai)
    const celula1 = await service.salvarCelula(tenantA, {
      nome: 'Célula Raiz',
      dia_semana: 3,
      horario: '20:00',
    });

    // Cria célula 2 (Filha da 1)
    const celula2 = await service.salvarCelula(tenantA, {
      nome: 'Célula Filha',
      dia_semana: 3,
      horario: '20:00',
      celula_mae_id: celula1.id,
    });

    // Cria célula 3 (Neta da 1, filha da 2)
    const celula3 = await service.salvarCelula(tenantA, {
      nome: 'Célula Neta',
      dia_semana: 3,
      horario: '20:00',
      celula_mae_id: celula2.id,
    });

    // Tentar atualizar Célula 1 definindo Célula 3 como sua mãe deve ser BLOQUEADO (Ciclo indireto C1 -> C2 -> C3 -> C1)
    await assert.rejects(
      async () => {
        await service.salvarCelula(tenantA, {
          id: celula1.id,
          nome: 'Célula Raiz com Ciclo',
          dia_semana: 3,
          horario: '20:00',
          celula_mae_id: celula3.id,
        });
      },
      (err: any) => {
        assert.match(err.message, /Ciclo.*genealogia detectado/);
        return true;
      }
    );
  });

  await t.test('8. Validação de RBAC: Administrador e Secretarias possuem permissão no módulo celulas', () => {
    assert.equal(temAcesso('administrador', 'celulas'), true);
    assert.equal(temAcessoEscrita('administrador', 'celulas'), true);

    assert.equal(temAcesso('secretario_geral', 'celulas'), true);
    assert.equal(temAcessoEscrita('secretario_geral', 'celulas'), true);

    assert.equal(temAcesso('secretaria_local', 'celulas'), true);
    assert.equal(temAcessoEscrita('secretaria_local', 'celulas'), true);

    // Perfis restritos não têm acesso
    assert.equal(temAcesso('superintendente_ebd', 'celulas'), false);
    assert.equal(temAcessoEscrita('superintendente_ebd', 'celulas'), false);
    assert.equal(temAcesso('tesouraria_local', 'celulas'), false);
  });
});
