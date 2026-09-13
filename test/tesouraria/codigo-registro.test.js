import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper simulando a lógica de sequencial e unicidade do TesourariaRepository / TesourariaService
class MockTesourariaRepository {
  constructor() {
    this.lancamentos = [];
    this.sequencias = new Map(); // key: `${ministryId}_${ano}` -> number
  }

  async obterPreviaCodigoRegistro(ministryId, ano) {
    const prefix = 'REG-' + ano + '-';
    const regex = new RegExp('^REG-' + ano + '-(\\d+)$', 'i');
    let maxTabela = 0;

    for (const item of this.lancamentos) {
      if (item.ministry_id === ministryId && item.codigo_registro) {
        const match = item.codigo_registro.trim().match(regex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxTabela) {
            maxTabela = num;
          }
        }
      }
    }

    const key = `${ministryId}_${ano}`;
    const ultimoSeq = this.sequencias.get(key) || 0;
    const proximoNum = Math.max(ultimoSeq, maxTabela) + 1;
    return prefix + String(proximoNum).padStart(6, '0');
  }

  async alocarProximoCodigoRegistro(ministryId, ano) {
    const prefix = 'REG-' + ano + '-';
    const regex = new RegExp('^REG-' + ano + '-(\\d+)$', 'i');
    let maxTabela = 0;

    for (const item of this.lancamentos) {
      if (item.ministry_id === ministryId && item.codigo_registro) {
        const match = item.codigo_registro.trim().match(regex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxTabela) {
            maxTabela = num;
          }
        }
      }
    }

    const key = `${ministryId}_${ano}`;
    const ultimoSeq = this.sequencias.get(key) || 0;
    const novoNum = Math.max(ultimoSeq, maxTabela) + 1;
    this.sequencias.set(key, novoNum);
    return prefix + String(novoNum).padStart(6, '0');
  }

  async obterProximoCodigoRegistro(ministryId, ano) {
    return this.obterPreviaCodigoRegistro(ministryId, ano);
  }

  async verificarCodigoExiste(ministryId, codigo, excludeId) {
    if (!codigo || !codigo.trim()) return false;
    const target = codigo.trim().toLowerCase();
    return this.lancamentos.some(
      (l) => l.ministry_id === ministryId &&
             l.codigo_registro &&
             l.codigo_registro.trim().toLowerCase() === target &&
             l.id !== excludeId
    );
  }

  async criarLancamento(payload) {
    if (payload.codigo_registro && payload.codigo_registro.trim()) {
      const existe = await this.verificarCodigoExiste(payload.ministry_id, payload.codigo_registro);
      if (existe) {
        const err = new Error('duplicate key value violates unique constraint "idx_tesouraria_lancamentos_codigo_registro"');
        err.code = '23505';
        throw err;
      }
    }

    const row = {
      id: 'lanc-' + Math.random().toString(36).substring(2, 9),
      ...payload,
      created_at: new Date().toISOString(),
    };
    this.lancamentos.push(row);
    return row;
  }

  async atualizarLancamento(id, ministryId, payload) {
    const index = this.lancamentos.findIndex((l) => l.id === id && l.ministry_id === ministryId);
    if (index === -1) throw new Error('Lançamento não encontrado');
    this.lancamentos[index] = {
      ...this.lancamentos[index],
      ...payload,
      updated_at: new Date().toISOString(),
    };
    return this.lancamentos[index];
  }
}

class MockTesourariaService {
  constructor(repository) {
    this.repository = repository;
  }

  async obterProximoCodigo(ministryId, dataLancamento) {
    const ano = dataLancamento ? parseInt(dataLancamento.split('-')[0], 10) : new Date().getFullYear();
    return this.repository.obterPreviaCodigoRegistro(ministryId, ano);
  }

  async criarLancamento(ministryId, dto) {
    if (!ministryId) throw new Error('O ministry_id é obrigatório.');
    if (!dto.data_lancamento) throw new Error('data_lancamento é obrigatória.');
    if (!dto.valor || dto.valor <= 0) throw new Error('O valor deve ser positivo.');

    const ano = parseInt(dto.data_lancamento.split('-')[0], 10) || new Date().getFullYear();
    const isManual = Boolean(
      dto.codigo_registro &&
      dto.codigo_registro.trim().length > 0 &&
      !/^REG-\d{4}-\d+$/i.test(dto.codigo_registro.trim())
    );

    const montarPayload = (codigo) => ({
      ministry_id: ministryId,
      ...dto,
      codigo_registro: codigo,
    });

    if (isManual) {
      const codigoManual = dto.codigo_registro.trim();
      const jaExiste = await this.repository.verificarCodigoExiste(ministryId, codigoManual);
      if (jaExiste) {
        throw new Error('Já existe um lançamento registrado com este Código/ID.');
      }
      return this.repository.criarLancamento(montarPayload(codigoManual));
    }

    // Código automático
    const maxTentativas = 5;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        const codigoAlocado = await this.repository.alocarProximoCodigoRegistro(ministryId, ano);
        return await this.repository.criarLancamento(montarPayload(codigoAlocado));
      } catch (err) {
        const isCollision = err?.message?.includes('Já existe um lançamento registrado com este Código/ID') ||
                            err?.message?.includes('23505') ||
                            err?.code === '23505';
        if (isCollision && tentativa < maxTentativas) {
          continue;
        }
        if (isCollision) {
          throw new Error('Já existe um lançamento registrado com este Código/ID.');
        }
        throw err;
      }
    }
  }

  async atualizarLancamento(id, ministryId, dto) {
    if (dto.codigo_registro !== undefined) {
      if (dto.codigo_registro && dto.codigo_registro.trim().length > 0) {
        const codigoTrim = dto.codigo_registro.trim();
        const jaExiste = await this.repository.verificarCodigoExiste(ministryId, codigoTrim, id);
        if (jaExiste) {
          throw new Error('Já existe um lançamento registrado com este Código/ID.');
        }
      }
    }
    return this.repository.atualizarLancamento(id, ministryId, dto);
  }
}

describe('Módulo Tesouraria - Código / ID de Registro e Concorrência Atômica Multi-tenant', () => {
  const repo = new MockTesourariaRepository();
  const service = new MockTesourariaService(repo);

  const tenantA = 'tenant-uuid-1111';
  const tenantB = 'tenant-uuid-2222';

  it('1. Deve gerar automaticamente o primeiro código sequencial do ano (REG-2026-000001) para Entrada', async () => {
    const lanc = await service.criarLancamento(tenantA, {
      data_lancamento: '2026-03-15',
      tipo_movimento: 'entrada',
      tipo_recebimento: 'oferta',
      valor: 250.0,
    });

    assert.equal(lanc.codigo_registro, 'REG-2026-000001');
    assert.equal(lanc.tipo_movimento, 'entrada');
  });

  it('2. Deve gerar sequencial incremental (REG-2026-000002) para Saída no mesmo tenant', async () => {
    const lanc = await service.criarLancamento(tenantA, {
      data_lancamento: '2026-03-16',
      tipo_movimento: 'saida',
      tipo_recebimento: 'energia',
      valor: 480.0,
    });

    assert.equal(lanc.codigo_registro, 'REG-2026-000002');
    assert.equal(lanc.tipo_movimento, 'saida');
  });

  it('3. Deve permitir inserção com código customizado manual sem substituí-lo', async () => {
    const lanc = await service.criarLancamento(tenantA, {
      data_lancamento: '2026-03-20',
      tipo_movimento: 'entrada',
      tipo_recebimento: 'evento',
      valor: 1200.0,
      codigo_registro: 'EVENTO-AGO-2026-015',
    });

    assert.equal(lanc.codigo_registro, 'EVENTO-AGO-2026-015');
  });

  it('4. Próximo código automático deve continuar incremental a partir do maior sequencial numérico REG-2026-XXXXXX', async () => {
    const lanc = await service.criarLancamento(tenantA, {
      data_lancamento: '2026-03-21',
      tipo_movimento: 'saida',
      tipo_recebimento: 'aluguel',
      valor: 1500.0,
    });

    assert.equal(lanc.codigo_registro, 'REG-2026-000003');
  });

  it('5. Deve bloquear tentativa de código manual duplicado no mesmo tenant', async () => {
    await assert.rejects(
      async () => {
        await service.criarLancamento(tenantA, {
          data_lancamento: '2026-03-22',
          tipo_movimento: 'entrada',
          tipo_recebimento: 'evento',
          valor: 300.0,
          codigo_registro: 'EVENTO-AGO-2026-015',
        });
      },
      {
        name: 'Error',
        message: 'Já existe um lançamento registrado com este Código/ID.',
      }
    );
  });

  it('6. Deve permitir o mesmo código em tenants diferentes (isolamento multi-tenant)', async () => {
    const lancTenantB = await service.criarLancamento(tenantB, {
      data_lancamento: '2026-03-15',
      tipo_movimento: 'entrada',
      tipo_recebimento: 'oferta',
      valor: 500.0,
    });

    assert.equal(lancTenantB.codigo_registro, 'REG-2026-000001');
    assert.equal(lancTenantB.ministry_id, tenantB);
  });

  it('7. Deve permitir edição de lançamento mantendo seu próprio código', async () => {
    const lancs = repo.lancamentos.filter((l) => l.ministry_id === tenantA);
    const lanc1 = lancs[0];

    const updated = await service.atualizarLancamento(lanc1.id, tenantA, {
      valor: 350.0,
      codigo_registro: 'REG-2026-000001',
    });

    assert.equal(updated.valor, 350.0);
    assert.equal(updated.codigo_registro, 'REG-2026-000001');
  });

  it('8. Deve bloquear edição para código já utilizado por outro lançamento do mesmo tenant', async () => {
    const lancs = repo.lancamentos.filter((l) => l.ministry_id === tenantA);
    const lanc2 = lancs[1];

    await assert.rejects(
      async () => {
        await service.atualizarLancamento(lanc2.id, tenantA, {
          codigo_registro: 'REG-2026-000001',
        });
      },
      {
        name: 'Error',
        message: 'Já existe um lançamento registrado com este Código/ID.',
      }
    );
  });

  it('9. Concorrência: dois operadores simultâneos devem ambos receber códigos sequenciais distintos e válidos', async () => {
    // Simula duas requisições de criação disparadas simultaneamente
    const [lancOp1, lancOp2] = await Promise.all([
      service.criarLancamento(tenantA, {
        data_lancamento: '2026-03-25',
        tipo_movimento: 'entrada',
        tipo_recebimento: 'oferta',
        valor: 100.0,
      }),
      service.criarLancamento(tenantA, {
        data_lancamento: '2026-03-25',
        tipo_movimento: 'saida',
        tipo_recebimento: 'energia',
        valor: 150.0,
      }),
    ]);

    assert.notEqual(lancOp1.codigo_registro, lancOp2.codigo_registro);
    assert.equal(lancOp1.codigo_registro, 'REG-2026-000004');
    assert.equal(lancOp2.codigo_registro, 'REG-2026-000005');
  });

  it('10. Abrir o modal de criação e cancelar não deve persistir lançamento nem consumir sequência definitiva', async () => {
    // Modal abre e consulta sugestão
    const sugestao = await service.obterProximoCodigo(tenantA, '2026-03-26');
    assert.equal(sugestao, 'REG-2026-000006');

    // Operador fecha o modal (nenhuma gravação)
    const countAntes = repo.lancamentos.filter(l => l.ministry_id === tenantA).length;

    // Próximo operador abre e deve receber exatamente a mesma sugestão
    const proximaSugestao = await service.obterProximoCodigo(tenantA, '2026-03-26');
    assert.equal(proximaSugestao, 'REG-2026-000006');
    assert.equal(repo.lancamentos.filter(l => l.ministry_id === tenantA).length, countAntes);
  });

  it('11. Registro legado sem codigo_registro (null ou vazio) não deve conflitar com outros legados', async () => {
    const legado1 = await repo.criarLancamento({
      ministry_id: tenantA,
      data_lancamento: '2025-12-01',
      tipo_movimento: 'entrada',
      tipo_recebimento: 'oferta',
      valor: 50.0,
      codigo_registro: null,
    });

    const legado2 = await repo.criarLancamento({
      ministry_id: tenantA,
      data_lancamento: '2025-12-02',
      tipo_movimento: 'saida',
      tipo_recebimento: 'limpeza',
      valor: 75.0,
      codigo_registro: '',
    });

    assert.equal(legado1.codigo_registro, null);
    assert.equal(legado2.codigo_registro, '');
  });

  it('12. Código manual deve respeitar comparação case-insensitive com trim', async () => {
    await service.criarLancamento(tenantA, {
      data_lancamento: '2026-04-01',
      tipo_movimento: 'entrada',
      tipo_recebimento: 'oferta',
      valor: 300.0,
      codigo_registro: '  OFERTA-2026-001  ',
    });

    await assert.rejects(
      async () => {
        await service.criarLancamento(tenantA, {
          data_lancamento: '2026-04-02',
          tipo_movimento: 'entrada',
          tipo_recebimento: 'oferta',
          valor: 150.0,
          codigo_registro: 'oferta-2026-001',
        });
      },
      {
        name: 'Error',
        message: 'Já existe um lançamento registrado com este Código/ID.',
      }
    );
  });
});


