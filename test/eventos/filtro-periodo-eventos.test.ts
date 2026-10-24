import test from 'node:test';
import assert from 'node:assert/strict';

// Helper de fuso horário de Brasília
const hojeBrasiliaDataStr = (d: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
};

interface EventoSimulado {
  id: string;
  titulo: string;
  status: 'programado' | 'em_andamento' | 'realizado' | 'cancelado';
  data_inicio: string;
  data_fim?: string | null;
}

// Simulação da lógica de filtragem da agenda no Supabase / Aplicação
function filtrarEventos(
  eventos: EventoSimulado[],
  periodo: string,
  hojeRef: Date = new Date()
): EventoSimulado[] {
  const hojeStr = hojeBrasiliaDataStr(hojeRef);
  const hojeInicio = `${hojeStr}T00:00:00`;

  if (periodo === 'todos') {
    return eventos.filter(e => {
      if (e.status === 'cancelado' || e.status === 'realizado') return false;
      // Regra corrigida: evento futuro por data_inicio, em andamento,
      // com status programado, ou ainda vigente por data_fim
      const futuroPorInicio = e.data_inicio >= hojeInicio;
      const emAndamento = e.status === 'em_andamento';
      const programado = e.status === 'programado';
      const vigentePorFim = !!(e.data_fim && e.data_fim >= hojeInicio);

      return futuroPorInicio || emAndamento || programado || vigentePorFim;
    });
  }

  if (periodo === 'historico_completo') {
    return [...eventos];
  }

  return eventos;
}

test('Correção do Filtro de Período dos Eventos - Agenda Operacional', async (t) => {
  // Cenário de teste representando 23/10/2026 às 21:11 no fuso de Brasília (UTC-3)
  const agoraMock = new Date('2026-10-23T21:11:00-03:00');

  const eventosMock: EventoSimulado[] = [
    {
      id: '1',
      titulo: 'ESCOLA DE OBREIROS 2026',
      status: 'programado',
      data_inicio: '2026-10-23T19:00:00', // Iniciou às 19:00 de hoje
      data_fim: '2026-10-23T22:00:00',    // Término às 22:00 de hoje
    },
    {
      id: '2',
      titulo: 'Culto de Celebração de Domingo',
      status: 'programado',
      data_inicio: '2026-10-25T18:00:00',
    },
    {
      id: '3',
      titulo: 'Conferência de Mulheres em Andamento',
      status: 'em_andamento',
      data_inicio: '2026-10-22T19:00:00',
    },
    {
      id: '4',
      titulo: 'Seminário Passado Encerrado',
      status: 'realizado',
      data_inicio: '2026-10-10T09:00:00',
    },
    {
      id: '5',
      titulo: 'Vigília Cancelada',
      status: 'cancelado',
      data_inicio: '2026-10-24T23:00:00',
    },
    {
      id: '6',
      titulo: 'Encontro com data_inicio da manhã mas status programado',
      status: 'programado',
      data_inicio: '2026-10-23T08:00:00',
    }
  ];

  await t.test('1. Evento ESCOLA DE OBREIROS 2026 permanece visível na agenda padrão (todos os períodos)', () => {
    const visiveis = filtrarEventos(eventosMock, 'todos', agoraMock);
    const escola = visiveis.find(e => e.titulo === 'ESCOLA DE OBREIROS 2026');

    assert.ok(escola, 'O evento ESCOLA DE OBREIROS 2026 DEVE estar visível na agenda padrão');
    assert.equal(escola?.status, 'programado');
  });

  await t.test('2. Fuso de Brasília: data de referência não salta para o dia seguinte às 21:00 BRT', () => {
    // 21:11 no Brasil (UTC-3) corresponde a 00:11 UTC do dia seguinte
    const dataUtcIso = agoraMock.toISOString().split('T')[0]; // Seria 2026-10-24 em UTC puro!
    const dataBrasilia = hojeBrasiliaDataStr(agoraMock);      // Deve ser rigorosamente 2026-10-23

    assert.equal(dataUtcIso, '2026-10-24', 'UTC puro já está no dia 24');
    assert.equal(dataBrasilia, '2026-10-23', 'Brasília deve permanecer em 2026-10-23');
  });

  await t.test('3. Eventos cancelados e realizados não poluem a agenda padrão', () => {
    const visiveis = filtrarEventos(eventosMock, 'todos', agoraMock);

    assert.equal(visiveis.some(e => e.status === 'cancelado'), false);
    assert.equal(visiveis.some(e => e.status === 'realizado'), false);
  });

  await t.test('4. Histórico completo exibe todos os eventos, incluindo realizados e cancelados', () => {
    const historico = filtrarEventos(eventosMock, 'historico_completo', agoraMock);

    assert.equal(historico.length, eventosMock.length);
    assert.ok(historico.find(e => e.status === 'cancelado'));
    assert.ok(historico.find(e => e.status === 'realizado'));
  });

  await t.test('5. Eventos futuros e em andamento aparecem normalmente', () => {
    const visiveis = filtrarEventos(eventosMock, 'todos', agoraMock);

    assert.ok(visiveis.find(e => e.titulo === 'Culto de Celebração de Domingo'));
    assert.ok(visiveis.find(e => e.titulo === 'Conferência de Mulheres em Andamento'));
    assert.ok(visiveis.find(e => e.titulo === 'Encontro com data_inicio da manhã mas status programado'));
  });
});
