import assert from 'node:assert/strict';
import test from 'node:test';
import { PresidenciaService } from '../../src/services/presidencia-service.ts';

function createMockSupabase(records: any[] = [], fechamentos: any[] = []) {
  const calls: { table: string; select?: string; filters: Record<string, any> }[] = [];

  return {
    calls,
    from(table: string) {
      const currentCall: { table: string; select?: string; filters: Record<string, any> } = {
        table,
        filters: {},
      };
      calls.push(currentCall);

      const chain: any = {
        select(cols: string) {
          currentCall.select = cols;
          return chain;
        },
        eq(col: string, val: any) {
          currentCall.filters[col] = val;
          return chain;
        },
        gte(col: string, val: any) {
          currentCall.filters[`${col}_gte`] = val;
          return chain;
        },
        lte(col: string, val: any) {
          currentCall.filters[`${col}_lte`] = val;
          return chain;
        },
        then(resolve: any) {
          if (table === 'relatorio_espiritual_registros') {
            resolve({ data: records, error: null });
          } else if (table === 'relatorio_espiritual_fechamentos') {
            resolve({ data: fechamentos, error: null });
          } else {
            resolve({ data: [], error: null });
          }
        },
      };
      return chain;
    },
  };
}

test('PresidenciaService.obterIndicadoresEspirituaisConsolidados - Queries apenas os períodos necessários com colunas explicitadas', async () => {
  const mockDb = createMockSupabase([], []);
  
  await PresidenciaService.obterIndicadoresEspirituaisConsolidados(
    mockDb as any,
    'tenant-123',
    11,
    2026
  );

  const regCall = mockDb.calls.find((c) => c.table === 'relatorio_espiritual_registros');
  assert.ok(regCall, 'Consulta relatorio_espiritual_registros deve existir');
  assert.equal(regCall.filters.ministry_id, 'tenant-123', 'Deve filtrar por ministry_id');
  assert.equal(regCall.filters.data_atividade_gte, '2026-10-01', 'Filtro de data inicial deve ser 01 do mês anterior');
  assert.equal(regCall.filters.data_atividade_lte, '2026-11-30', 'Filtro de data final deve ser último dia do mês corrente');
  assert.ok(!regCall.select?.includes('*'), 'Não deve usar select *');
  assert.ok(regCall.select?.includes('almas_alcancadas'), 'Deve selecionar colunas requeridas');

  const fechCall = mockDb.calls.find((c) => c.table === 'relatorio_espiritual_fechamentos');
  assert.ok(fechCall, 'Consulta relatorio_espiritual_fechamentos deve existir');
  assert.equal(fechCall.filters.ministry_id, 'tenant-123');
  assert.equal(fechCall.filters.mes, 11);
  assert.equal(fechCall.filters.ano, 2026);
  assert.ok(!fechCall.select?.includes('*'), 'Não deve usar select *');
});

test('PresidenciaService.obterIndicadoresEspirituaisConsolidados - Virada de ano (Janeiro) consulta Dezembro do ano anterior', async () => {
  const mockDb = createMockSupabase([], []);
  
  await PresidenciaService.obterIndicadoresEspirituaisConsolidados(
    mockDb as any,
    'tenant-123',
    1,
    2027
  );

  const regCall = mockDb.calls.find((c) => c.table === 'relatorio_espiritual_registros');
  assert.equal(regCall?.filters.data_atividade_gte, '2026-12-01', 'Janeiro deve consultar a partir de 01/12 do ano anterior');
  assert.equal(regCall?.filters.data_atividade_lte, '2027-01-31', 'Janeiro deve ir até 31/01');
});

test('PresidenciaService.obterIndicadoresEspirituaisConsolidados - Preserva cálculos e variações oficiais', async () => {
  const mockRecords = [
    // Mês anterior (10/2026)
    {
      id: '1',
      congregacao_id: 'cong-a',
      data_atividade: '2026-10-15',
      almas_alcancadas: 10,
      reconciliacoes: 4,
      batismos_espirito_santo: 2,
      visitantes_presentes: 20,
      membros_cearam: 50,
      cultos_realizados: 4,
    },
    // Mês atual (11/2026)
    {
      id: '2',
      congregacao_id: 'cong-a',
      data_atividade: '2026-11-05',
      almas_alcancadas: 15,
      reconciliacoes: 6,
      batismos_espirito_santo: 5,
      visitantes_presentes: 30,
      membros_cearam: 60,
      cultos_realizados: 5,
    },
    {
      id: '3',
      congregacao_id: 'cong-b',
      data_atividade: '2026-11-12',
      almas_alcancadas: 5,
      reconciliacoes: 2,
      batismos_espirito_santo: 1,
      visitantes_presentes: 10,
      membros_cearam: 40,
      cultos_realizados: 3,
    },
  ];

  const mockDb = createMockSupabase(mockRecords, [{ status: 'Fechada', mes: 11, ano: 2026, congregacao_id: 'cong-a' }]);
  
  const res = await PresidenciaService.obterIndicadoresEspirituaisConsolidados(
    mockDb as any,
    'tenant-123',
    11,
    2026
  );

  assert.equal(res.temDados, true);
  assert.equal(res.statusFechamento, 'Fechada');
  assert.equal(res.congregaçõesParticipantesCount, 2);
  assert.equal(res.totalAtividadesRegistradas, 2);
  assert.equal(res.almasAlcancadas, 20); // 15 + 5
  assert.equal(res.reconciliacoes, 8); // 6 + 2
  assert.equal(res.batismosEspiritoSanto, 6); // 5 + 1
  assert.equal(res.visitantesPresentes, 40); // 30 + 10
  assert.equal(res.membrosCearam, 100); // 60 + 40
  assert.equal(res.cultosRealizados, 8); // 5 + 3

  // Variações:
  // Almas: (20 - 10) / 10 * 100 = 100%
  assert.equal(res.comparativoMesAnterior?.almasVarPct, 100);
  // Reconciliações: (8 - 4) / 4 * 100 = 100%
  assert.equal(res.comparativoMesAnterior?.reconciliacoesVarPct, 100);
  // Batismos: (6 - 2) / 2 * 100 = 200%
  assert.equal(res.comparativoMesAnterior?.batismosVarPct, 200);
  // Visitantes: (40 - 20) / 20 * 100 = 100%
  assert.equal(res.comparativoMesAnterior?.visitantesVarPct, 100);
});

test('PresidenciaService.carregarCentralDecisoes - Aceita indicadores pré-carregados evitando consulta duplicada', async () => {
  const dummyIndicadores: any = {
    periodo: { mes: 11, ano: 2026, mesNome: 'Novembro', label: 'Novembro/2026' },
    temDados: true,
    almasAlcancadas: 99,
  };

  const calls: string[] = [];
  const fakeDb: any = {
    from(table: string) {
      calls.push(table);
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() { return this; },
        then(resolve: any) {
          resolve({ data: [], error: null, count: 0 });
        },
      };
    },
  };

  const { resumo } = await PresidenciaService.carregarCentralDecisoes(
    fakeDb,
    'tenant-123',
    { indicadoresEspirituaisPrecarregados: dummyIndicadores }
  );

  assert.equal(resumo.indicadoresEspirituais?.almasAlcancadas, 99);
  assert.ok(!calls.includes('relatorio_espiritual_registros'), 'Não deve reconsultar relatorio_espiritual_registros');
  assert.ok(!calls.includes('relatorio_espiritual_fechamentos'), 'Não deve reconsultar relatorio_espiritual_fechamentos');
});
