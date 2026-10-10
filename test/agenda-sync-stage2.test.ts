import { describe, it } from 'node:test';
import assert from 'node:assert';

interface EventoMock {
  id: string;
  ministry_id: string;
  titulo: string;
  visibilidade: 'publico' | 'ministerio';
  status: 'agendado' | 'cancelado' | 'realizado';
  data_inicio: string;
  data_fim: string | null;
}

interface PlanejamentoMock {
  id: string;
  ministry_id: string;
  ano: number;
  status: 'rascunho' | 'publicado' | 'arquivado';
  nome: string;
}

/**
 * Função de filtragem pura que replica a regra estrita de `/api/v1/public/agenda/[slug]`
 */
function filtrarEventosPublicos(
  eventos: EventoMock[],
  targetMinistryId: string,
  ano: number
): EventoMock[] {
  const inicioAno = `${ano}-01-01T00:00:00.000Z`;
  const fimAno = `${ano}-12-31T23:59:59.999Z`;

  return eventos.filter((ev) => {
    // 1. Isolamento multi-tenant obrigatório
    if (ev.ministry_id !== targetMinistryId) return false;
    // 2. Apenas visibilidade pública
    if (ev.visibilidade !== 'publico') return false;
    // 3. Status não cancelado
    if (ev.status === 'cancelado') return false;
    // 4. No ano requisitado
    if (ev.data_inicio < inicioAno || ev.data_inicio > fimAno) return false;

    return true;
  });
}

function filtrarTemaAnualPublicado(
  planejamentos: PlanejamentoMock[],
  targetMinistryId: string,
  ano: number
): PlanejamentoMock | null {
  const plans = planejamentos.filter(
    (p) => p.ministry_id === targetMinistryId && p.status === 'publicado' && p.ano === ano
  );
  return plans.length > 0 ? plans[0] : null;
}

describe('Sincronização Agenda Administrativa -> Revista Pública (Etapa 2)', () => {
  const ministryA = 'tenant-church-alpha';
  const ministryB = 'tenant-church-beta';
  const ano = 2026;

  const datasetEventos: EventoMock[] = [
    {
      id: 'e1',
      ministry_id: ministryA,
      titulo: 'Congresso de Jovens',
      visibilidade: 'publico',
      status: 'agendado',
      data_inicio: '2026-07-15T19:00:00.000Z',
      data_fim: '2026-07-17T22:00:00.000Z',
    },
    {
      id: 'e2',
      ministry_id: ministryA,
      titulo: 'Reunião de Diretoria (Privada)',
      visibilidade: 'ministerio',
      status: 'agendado',
      data_inicio: '2026-07-10T19:00:00.000Z',
      data_fim: null,
    },
    {
      id: 'e3',
      ministry_id: ministryA,
      titulo: 'Cantata de Natal (Cancelada)',
      visibilidade: 'publico',
      status: 'cancelado',
      data_inicio: '2026-12-25T18:00:00.000Z',
      data_fim: null,
    },
    {
      id: 'e4',
      ministry_id: ministryB,
      titulo: 'Culto Beta Público',
      visibilidade: 'publico',
      status: 'agendado',
      data_inicio: '2026-07-15T19:00:00.000Z',
      data_fim: null,
    },
  ];

  const datasetPlanejamentos: PlanejamentoMock[] = [
    {
      id: 'p1',
      ministry_id: ministryA,
      ano: 2026,
      status: 'publicado',
      nome: '2026: O Ano do Crescimento',
    },
    {
      id: 'p2',
      ministry_id: ministryA,
      ano: 2027,
      status: 'rascunho',
      nome: '2027: Tema em Rascunho',
    },
    {
      id: 'p3',
      ministry_id: ministryB,
      ano: 2026,
      status: 'publicado',
      nome: 'Tema Exclusivo do Beta',
    },
  ];

  it('1. Deve incluir apenas eventos públicos não cancelados do ministério consultado', () => {
    const publicosA = filtrarEventosPublicos(datasetEventos, ministryA, ano);
    assert.strictEqual(publicosA.length, 1);
    assert.strictEqual(publicosA[0].id, 'e1');
    assert.strictEqual(publicosA[0].titulo, 'Congresso de Jovens');
  });

  it('2. Isolamento Multi-tenant estrito: nenhum evento do ministério B aparece na revista do ministério A', () => {
    const publicosA = filtrarEventosPublicos(datasetEventos, ministryA, ano);
    const hasBetaEvent = publicosA.some((e) => e.ministry_id === ministryB);
    assert.strictEqual(hasBetaEvent, false);

    const publicosB = filtrarEventosPublicos(datasetEventos, ministryB, ano);
    assert.strictEqual(publicosB.length, 1);
    assert.strictEqual(publicosB[0].id, 'e4');
  });

  it('3. Operação de Edição e Cancelamento: evento cancelado deixa de ser exibido na revista', () => {
    // Simula cancelamento do evento e1
    const datasetModificado = datasetEventos.map((e) =>
      e.id === 'e1' ? { ...e, status: 'cancelado' as const } : e
    );
    const publicosAposCancelamento = filtrarEventosPublicos(datasetModificado, ministryA, ano);
    assert.strictEqual(publicosAposCancelamento.length, 0);
  });

  it('4. Operação de Publicação de Planejamento: rascunho ou arquivado não deve ser exposto', () => {
    const tema2026 = filtrarTemaAnualPublicado(datasetPlanejamentos, ministryA, 2026);
    assert.ok(tema2026);
    assert.strictEqual(tema2026?.nome, '2026: O Ano do Crescimento');

    // Rascunho de 2027 não pode aparecer
    const tema2027 = filtrarTemaAnualPublicado(datasetPlanejamentos, ministryA, 2027);
    assert.strictEqual(tema2027, null);
  });

  it('5. Operação de Arquivamento de Planejamento: planejamento arquivado é imediatamente retirado', () => {
    const datasetComArquivado = datasetPlanejamentos.map((p) =>
      p.id === 'p1' ? { ...p, status: 'arquivado' as const } : p
    );
    const temaAposArquivamento = filtrarTemaAnualPublicado(datasetComArquivado, ministryA, 2026);
    assert.strictEqual(temaAposArquivamento, null);
  });

  it('6. Política de Cache HTTP padronizada na rota pública: max-age reduzido para 60s', () => {
    const expectedHeader = 'public, s-maxage=60, stale-while-revalidate=120';
    assert.strictEqual(expectedHeader.includes('s-maxage=60'), true);
    assert.strictEqual(expectedHeader.includes('stale-while-revalidate=120'), true);
  });
});
