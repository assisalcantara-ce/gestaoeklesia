import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CelulasService } from '../../src/services/celulas-service';

// Mock do Supabase Client focado no Lote 8 (Assistente de Implantação e Transição de Ativação)
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
        single: () => {
          isSingle = true;
          return chain.execute();
        },
        maybeSingle: () => {
          isMaybeSingle = true;
          return chain.execute();
        },
        upsert: (data: any, _options?: any) => {
          if (!dbState[currentTable]) {
            dbState[currentTable] = [];
          }
          const existingIdx = dbState[currentTable].findIndex((r: any) => r.ministry_id === data.ministry_id);
          const savedRow = {
            id: existingIdx >= 0 ? dbState[currentTable][existingIdx].id : 'mock-config-id',
            ...data,
          };
          if (existingIdx >= 0) {
            dbState[currentTable][existingIdx] = savedRow;
          } else {
            dbState[currentTable].push(savedRow);
          }

          return {
            select: () => ({
              single: () => Promise.resolve({ data: savedRow, error: null }),
            }),
          };
        },
        execute: async () => {
          const rows = dbState[currentTable] || [];
          const filtered = rows.filter((r: any) => {
            return filters.every(f => {
              if (f.op === 'eq') return r[f.field] === f.value;
              return true;
            });
          });

          if (isSingle) {
            if (filtered.length === 0) return { data: null, error: new Error('Row not found') };
            return { data: filtered[0], error: null };
          }
          if (isMaybeSingle) {
            return { data: filtered[0] || null, error: null };
          }
          return { data: filtered, error: null };
        },
        then: (resolve: any) => {
          return chain.execute().then(resolve);
        }
      };

      return chain;
    }
  } as any;
}

describe('Módulo Células — Lote 8: Assistente de Implantação e Transições de Ativação', () => {
  const ministryAlpha = 'ministry-alpha-1111';

  it('1. Retorna status inicial com etapa "metodologia" quando ministério ainda não configurou o módulo', async () => {
    const dbState = {
      celulas_configuracoes: [],
      celulas_redes: [],
      celulas: [],
    };

    const mockSupabase = createMockSupabase(dbState);
    const service = new CelulasService(mockSupabase);

    const status = await service.obterStatusImplantacao(ministryAlpha);

    assert.strictEqual(status.etapa_atual, 'metodologia');
    assert.strictEqual(status.concluido, false);
    assert.strictEqual(status.total_redes, 0);
    assert.strictEqual(status.total_celulas, 0);
    assert.strictEqual(status.etapas_status.metodologia, false);
  });

  it('2. Avança etapas conforme metodologia, redes, células e lideranças são cadastradas', async () => {
    const dbState = {
      celulas_configuracoes: [
        {
          id: 'cfg-1',
          ministry_id: ministryAlpha,
          metodologia: 'igreja_em_celulas',
          termo_celula: 'Grupo Familiar',
          termo_lider: 'Facilitador',
          dia_padrao_reuniao: 3,
          frequencia_obrigatoria: 'individual',
          is_ativo: true,
        }
      ],
      celulas_redes: [
        { id: 'rede-1', ministry_id: ministryAlpha, nome: 'Rede Jovem' }
      ],
      celulas: [
        { id: 'cel-1', ministry_id: ministryAlpha, nome: 'GF Betel', lider_member_id: 'lider-1' }
      ],
    };

    const mockSupabase = createMockSupabase(dbState);
    const service = new CelulasService(mockSupabase);

    const status = await service.obterStatusImplantacao(ministryAlpha);

    assert.strictEqual(status.etapas_status.metodologia, true);
    assert.strictEqual(status.etapas_status.organizacao, true);
    assert.strictEqual(status.etapas_status.lideranca, true);
    assert.strictEqual(status.etapas_status.reunioes, true);
    assert.strictEqual(status.etapa_atual, 'revisao');
    assert.strictEqual(status.concluido, true);
  });

  it('3. Permite alternar ativação do módulo sem apagar históricos ou cadastros prévios', async () => {
    const dbState = {
      celulas_configuracoes: [
        {
          id: 'cfg-1',
          ministry_id: ministryAlpha,
          metodologia: 'g12',
          termo_celula: 'Célula',
          is_ativo: true,
        }
      ],
    };

    const mockSupabase = createMockSupabase(dbState);
    const service = new CelulasService(mockSupabase);

    // Desativa o módulo
    const desativado = await service.alternarAtivacaoModulo(ministryAlpha, false);
    assert.strictEqual(desativado.is_ativo, false);

    // Reativa o módulo
    const reativado = await service.alternarAtivacaoModulo(ministryAlpha, true);
    assert.strictEqual(reativado.is_ativo, true);
  });
});
