import test from 'node:test';
import assert from 'node:assert/strict';

// Simulação da lógica de cálculo e resolução de IDs para exclusão inteligente de eventos recorrentes
interface AgendaEventoMock {
  id: string;
  ministry_id: string;
  titulo: string;
  data_inicio: string;
  recorrente: boolean;
  recorrencia_tipo?: string;
  recorrencia_pai_id?: string | null;
  recorrencia_config?: any;
}

interface CultoRegistroMock {
  id: string;
  ministry_id: string;
  agenda_evento_id: string | null;
  status: 'Aberto' | 'Programado' | 'Encerrado' | 'Consolidado' | 'Cancelado';
  visitantes_presentes: number;
}

interface CultoTokenMock {
  id: string;
  culto_id: string;
  is_active: boolean;
  ministry_id: string;
}

function resolverExclusaoAgenda({
  targetId,
  modoExclusao = 'somente_esta',
  eventos,
  cultos,
  tokens,
  ministryId,
}: {
  targetId: string;
  modoExclusao: 'somente_esta' | 'esta_e_proximas' | 'toda_serie';
  eventos: AgendaEventoMock[];
  cultos: CultoRegistroMock[];
  tokens: CultoTokenMock[];
  ministryId: string;
}) {
  const existing = eventos.find(e => e.id === targetId && e.ministry_id === ministryId);
  if (!existing) {
    throw new Error('NOT_FOUND');
  }

  const isRecorrente = Boolean(
    existing.recorrente ||
    existing.recorrencia_pai_id ||
    (existing.recorrencia_tipo && existing.recorrencia_tipo !== 'nenhuma')
  );
  const rootId = existing.recorrencia_pai_id || existing.id;

  let idsToDelete: string[] = [targetId];

  if (isRecorrente && (modoExclusao === 'esta_e_proximas' || modoExclusao === 'toda_serie')) {
    const allSerie = eventos.filter(
      e => e.ministry_id === ministryId && (e.id === rootId || e.recorrencia_pai_id === rootId)
    );

    if (modoExclusao === 'toda_serie') {
      idsToDelete = allSerie.map(e => e.id);
    } else if (modoExclusao === 'esta_e_proximas') {
      const targetDataInicio = existing.data_inicio;
      const toDeleteList = allSerie.filter(e => e.data_inicio >= targetDataInicio);
      const toKeepList = allSerie.filter(e => e.data_inicio < targetDataInicio);

      idsToDelete = toDeleteList.map(e => e.id);

      // Promoção de pai caso o rootId esteja sendo deletado e restem itens anteriores
      if (idsToDelete.includes(rootId) && toKeepList.length > 0) {
        toKeepList.sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
        const newParent = toKeepList[0];
        const otherChildren = toKeepList.slice(1);

        newParent.recorrencia_pai_id = null;
        newParent.recorrente = true;

        for (const child of otherChildren) {
          child.recorrencia_pai_id = newParent.id;
        }
      }
    }
  } else if (isRecorrente && (modoExclusao === 'somente_esta')) {
    if (existing.id === rootId) {
      const filhas = eventos
        .filter(e => e.ministry_id === ministryId && e.recorrencia_pai_id === rootId)
        .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

      if (filhas.length > 0) {
        const newParent = filhas[0];
        const remainingFilhas = filhas.slice(1);

        newParent.recorrencia_pai_id = null;
        newParent.recorrente = true;

        for (const f of remainingFilhas) {
          f.recorrencia_pai_id = newParent.id;
        }
      }
    }
  }

  // Tratamento de cultos operacionais vinculados
  const cultosVinculados = cultos.filter(
    c => c.ministry_id === ministryId && c.agenda_evento_id && idsToDelete.includes(c.agenda_evento_id)
  );

  const cultoIds = cultosVinculados.map(c => c.id);
  for (const token of tokens) {
    if (cultoIds.includes(token.culto_id) && token.ministry_id === ministryId) {
      token.is_active = false;
    }
  }

  for (const c of cultosVinculados) {
    if (c.status === 'Aberto' || c.status === 'Programado') {
      c.status = 'Cancelado';
    }
    // Encerrado / Consolidado permanece inalterado!
  }

  // Efetuar delete dos eventos
  const eventosRestantes = eventos.filter(e => !idsToDelete.includes(e.id));

  return {
    idsToDelete,
    eventosRestantes,
    cultos,
    tokens,
  };
}

test('Motor de Exclusão Inteligente de Eventos Recorrentes', async (t) => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  await t.test('1. Excluir evento comum não recorrente: remove apenas ele mesmo', () => {
    const eventos: AgendaEventoMock[] = [
      { id: 'comum-1', ministry_id: TENANT_A, titulo: 'Reunião de Oração', data_inicio: '2026-10-05T19:30:00Z', recorrente: false },
      { id: 'comum-2', ministry_id: TENANT_A, titulo: 'Vigília Especial', data_inicio: '2026-10-10T22:00:00Z', recorrente: false },
    ];
    const cultos: CultoRegistroMock[] = [];
    const tokens: CultoTokenMock[] = [];

    const res = resolverExclusaoAgenda({
      targetId: 'comum-1',
      modoExclusao: 'somente_esta',
      eventos,
      cultos,
      tokens,
      ministryId: TENANT_A,
    });

    assert.deepEqual(res.idsToDelete, ['comum-1']);
    assert.equal(res.eventosRestantes.length, 1);
    assert.equal(res.eventosRestantes[0].id, 'comum-2');
  });

  await t.test('2. Modo "somente_esta" em série recorrente: remove exclusivamente a ocorrência selecionada', () => {
    const eventos: AgendaEventoMock[] = [
      { id: 'root-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-02T19:30:00Z', recorrente: true, recorrencia_tipo: 'semanal' },
      { id: 'child-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-2', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-16T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-3', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-23T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
    ];
    const cultos: CultoRegistroMock[] = [];
    const tokens: CultoTokenMock[] = [];

    // Excluir child-2
    const res = resolverExclusaoAgenda({
      targetId: 'child-2',
      modoExclusao: 'somente_esta',
      eventos: [...eventos],
      cultos,
      tokens,
      ministryId: TENANT_A,
    });

    assert.deepEqual(res.idsToDelete, ['child-2']);
    assert.equal(res.eventosRestantes.length, 3);
    assert.ok(res.eventosRestantes.some(e => e.id === 'root-1'));
    assert.ok(res.eventosRestantes.some(e => e.id === 'child-1'));
    assert.ok(res.eventosRestantes.some(e => e.id === 'child-3'));
  });

  await t.test('3. Modo "somente_esta" quando o alvo é o ROOT: promove child-1 a novo pai e preserva os irmãos', () => {
    const eventos: AgendaEventoMock[] = [
      { id: 'root-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-02T19:30:00Z', recorrente: true, recorrencia_tipo: 'semanal' },
      { id: 'child-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-2', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-16T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
    ];
    const cultos: CultoRegistroMock[] = [];
    const tokens: CultoTokenMock[] = [];

    const res = resolverExclusaoAgenda({
      targetId: 'root-1',
      modoExclusao: 'somente_esta',
      eventos: [...eventos],
      cultos,
      tokens,
      ministryId: TENANT_A,
    });

    assert.deepEqual(res.idsToDelete, ['root-1']);
    assert.equal(res.eventosRestantes.length, 2);

    const novoPai = res.eventosRestantes.find(e => e.id === 'child-1');
    const irmaoRestante = res.eventosRestantes.find(e => e.id === 'child-2');

    assert.ok(novoPai);
    assert.equal(novoPai.recorrencia_pai_id, null, 'child-1 foi promovido para root');
    assert.equal(novoPai.recorrente, true);

    assert.ok(irmaoRestante);
    assert.equal(irmaoRestante.recorrencia_pai_id, 'child-1', 'child-2 agora aponta para o novo pai');
  });

  await t.test('4. Modo "esta_e_proximas": exclui alvo e ocorrências posteriores, preservando ocorrências anteriores', () => {
    const eventos: AgendaEventoMock[] = [
      { id: 'root-1', ministry_id: TENANT_A, titulo: 'Culto de Sexta', data_inicio: '2026-10-02T19:30:00Z', recorrente: true },
      { id: 'child-1', ministry_id: TENANT_A, titulo: 'Culto de Sexta', data_inicio: '2026-10-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-2', ministry_id: TENANT_A, titulo: 'Culto de Sexta', data_inicio: '2026-10-16T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-3', ministry_id: TENANT_A, titulo: 'Culto de Sexta', data_inicio: '2026-10-23T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-4', ministry_id: TENANT_A, titulo: 'Culto de Sexta', data_inicio: '2026-10-30T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
    ];
    const cultos: CultoRegistroMock[] = [];
    const tokens: CultoTokenMock[] = [];

    // Alvo: child-2 (16/10). Deve excluir child-2, child-3 e child-4. Preservar root-1 e child-1.
    const res = resolverExclusaoAgenda({
      targetId: 'child-2',
      modoExclusao: 'esta_e_proximas',
      eventos: [...eventos],
      cultos,
      tokens,
      ministryId: TENANT_A,
    });

    assert.deepEqual(res.idsToDelete.sort(), ['child-2', 'child-3', 'child-4'].sort());
    assert.equal(res.eventosRestantes.length, 2);
    assert.ok(res.eventosRestantes.some(e => e.id === 'root-1'));
    assert.ok(res.eventosRestantes.some(e => e.id === 'child-1'));
  });

  await t.test('5. Modo "toda_serie": exclui todas as ocorrências da série (passadas, presentes e futuras)', () => {
    const eventos: AgendaEventoMock[] = [
      { id: 'root-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-01-02T19:30:00Z', recorrente: true },
      { id: 'child-jan', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-01-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-out-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-out-2', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-16T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-dez', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-12-25T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
    ];
    const cultos: CultoRegistroMock[] = [];
    const tokens: CultoTokenMock[] = [];

    // Alvo clicado em outubro: child-out-2
    const res = resolverExclusaoAgenda({
      targetId: 'child-out-2',
      modoExclusao: 'toda_serie',
      eventos: [...eventos],
      cultos,
      tokens,
      ministryId: TENANT_A,
    });

    assert.equal(res.idsToDelete.length, 5);
    assert.equal(res.eventosRestantes.length, 0, 'Todas as 5 ocorrências da série foram removidas');
  });

  await t.test('6. Isolamento de Séries e Tenants: eventos independentes com mesmo nome/dia NÃO são tocados', () => {
    const eventos: AgendaEventoMock[] = [
      // Série 1 (Tenant A)
      { id: 'root-serie-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-02T19:30:00Z', recorrente: true },
      { id: 'child-serie-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-serie-1' },

      // Série 2 (Tenant A) - Outra congregação ou outra programação independente
      { id: 'root-serie-2', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-02T19:30:00Z', recorrente: true },
      { id: 'child-serie-2', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-serie-2' },

      // Evento avulso com mesmo título
      { id: 'avulso-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-16T19:30:00Z', recorrente: false },

      // Série no Tenant B (Multi-tenant)
      { id: 'root-tenant-b', ministry_id: TENANT_B, titulo: 'Culto de Doutrina', data_inicio: '2026-10-02T19:30:00Z', recorrente: true },
      { id: 'child-tenant-b', ministry_id: TENANT_B, titulo: 'Culto de Doutrina', data_inicio: '2026-10-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-tenant-b' },
    ];
    const cultos: CultoRegistroMock[] = [];
    const tokens: CultoTokenMock[] = [];

    const res = resolverExclusaoAgenda({
      targetId: 'root-serie-1',
      modoExclusao: 'toda_serie',
      eventos: [...eventos],
      cultos,
      tokens,
      ministryId: TENANT_A,
    });

    assert.deepEqual(res.idsToDelete.sort(), ['root-serie-1', 'child-serie-1'].sort());

    // Verifica sobreviventes
    assert.ok(res.eventosRestantes.some(e => e.id === 'root-serie-2'));
    assert.ok(res.eventosRestantes.some(e => e.id === 'child-serie-2'));
    assert.ok(res.eventosRestantes.some(e => e.id === 'avulso-1'));
    assert.ok(res.eventosRestantes.some(e => e.id === 'root-tenant-b'));
    assert.ok(res.eventosRestantes.some(e => e.id === 'child-tenant-b'));
  });

  await t.test('7. Integridade Operacional: cultos futuros são cancelados e cultos encerrados são preservados', () => {
    const eventos: AgendaEventoMock[] = [
      { id: 'root-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-02T19:30:00Z', recorrente: true },
      { id: 'child-1', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-09T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
      { id: 'child-2', ministry_id: TENANT_A, titulo: 'Culto de Doutrina', data_inicio: '2026-10-16T19:30:00Z', recorrente: true, recorrencia_pai_id: 'root-1' },
    ];

    const cultos: CultoRegistroMock[] = [
      // Culto passado (já realizado e consolidado)
      { id: 'culto-passado', ministry_id: TENANT_A, agenda_evento_id: 'root-1', status: 'Encerrado', visitantes_presentes: 15 },
      // Culto de hoje em aberto
      { id: 'culto-hoje', ministry_id: TENANT_A, agenda_evento_id: 'child-1', status: 'Aberto', visitantes_presentes: 4 },
      // Culto futuro programado
      { id: 'culto-futuro', ministry_id: TENANT_A, agenda_evento_id: 'child-2', status: 'Programado', visitantes_presentes: 0 },
    ];

    const tokens: CultoTokenMock[] = [
      { id: 'tok-1', culto_id: 'culto-hoje', is_active: true, ministry_id: TENANT_A },
      { id: 'tok-2', culto_id: 'culto-futuro', is_active: true, ministry_id: TENANT_A },
    ];

    const res = resolverExclusaoAgenda({
      targetId: 'root-1',
      modoExclusao: 'toda_serie',
      eventos: [...eventos],
      cultos: [...cultos],
      tokens: [...tokens],
      ministryId: TENANT_A,
    });

    const cPassado = res.cultos.find(c => c.id === 'culto-passado');
    const cHoje = res.cultos.find(c => c.id === 'culto-hoje');
    const cFuturo = res.cultos.find(c => c.id === 'culto-futuro');

    assert.equal(cPassado?.status, 'Encerrado', 'Histórico de culto realizado é 100% preservado');
    assert.equal(cPassado?.visitantes_presentes, 15);

    assert.equal(cHoje?.status, 'Cancelado', 'Culto em aberto foi cancelado com integridade');
    assert.equal(cFuturo?.status, 'Cancelado', 'Culto futuro programado foi cancelado');

    const tok1 = res.tokens.find(t => t.id === 'tok-1');
    const tok2 = res.tokens.find(t => t.id === 'tok-2');
    assert.equal(tok1?.is_active, false, 'Token de acolhimento desativado');
    assert.equal(tok2?.is_active, false, 'Token de acolhimento desativado');
  });
});
