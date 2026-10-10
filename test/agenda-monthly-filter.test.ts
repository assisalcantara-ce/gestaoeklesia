import { describe, it } from 'node:test';
import assert from 'node:assert';

interface AgendaEventoMock {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string | null;
}

/**
 * Função pura que reproduz com precisão a regra de filtro de sobreposição de intervalo
 * aplicada em useAgenda.ts (PostgREST / Supabase):
 *
 * data_inicio <= endOfMonth AND (data_fim >= startOfMonth OR (data_fim IS NULL AND data_inicio >= startOfMonth))
 */
function matchesMonthlyInterval(
  evento: AgendaEventoMock,
  startOfMonthIso: string,
  endOfMonthIso: string
): boolean {
  const inicioLteEnd = evento.data_inicio <= endOfMonthIso;
  const fimGteStartOrNullValid = evento.data_fim
    ? evento.data_fim >= startOfMonthIso
    : evento.data_inicio >= startOfMonthIso;

  return inicioLteEnd && fimGteStartOrNullValid;
}

/**
 * Função pura que reproduz o mapeamento multi-dias de eventosPorDia em useAgenda.ts
 */
function mapEventosPorDia(eventos: AgendaEventoMock[], filtroMes: string): Record<string, AgendaEventoMock[]> {
  const mapa: Record<string, AgendaEventoMock[]> = {};
  const [yearStr, monthStr] = filtroMes.split('-');
  const currentMonthPrefix = `${yearStr}-${monthStr.padStart(2, '0')}`;

  eventos.forEach(e => {
    const startDayStr = e.data_inicio.split('T')[0];
    const endDayStr = e.data_fim ? e.data_fim.split('T')[0] : startDayStr;

    if (!e.data_fim || startDayStr === endDayStr) {
      if (!mapa[startDayStr]) mapa[startDayStr] = [];
      mapa[startDayStr].push(e);
      return;
    }

    const startDate = new Date(`${startDayStr}T00:00:00`);
    const endDate = new Date(`${endDayStr}T00:00:00`);

    const cur = new Date(startDate);
    while (cur <= endDate) {
      const curStr = cur.toISOString().split('T')[0];
      if (curStr.startsWith(currentMonthPrefix)) {
        if (!mapa[curStr]) mapa[curStr] = [];
        mapa[curStr].push(e);
      }
      cur.setDate(cur.getDate() + 1);
    }
  });

  return mapa;
}

describe('Filtro mensal de eventos - Sobreposição de Intervalos (useAgenda)', () => {
  // Mês de referência: Outubro de 2026 (2026-10-01 a 2026-10-31)
  const startOfMonth = new Date(2026, 9, 1).toISOString(); // 2026-10-01T...
  const endOfMonth = new Date(2026, 10, 0, 23, 59, 59).toISOString(); // 2026-10-31T...

  const eventoDentroDoMes: AgendaEventoMock = {
    id: '1',
    titulo: 'Culto de Celebração',
    data_inicio: '2026-10-15T19:00:00.000Z',
    data_fim: '2026-10-15T21:00:00.000Z'
  };

  const eventoIniciadoMesAnteriorAindaVigente: AgendaEventoMock = {
    id: '2',
    titulo: 'Retiro Espiritual',
    data_inicio: '2026-09-28T18:00:00.000Z',
    data_fim: '2026-10-04T12:00:00.000Z'
  };

  const eventoAtravessaMesInteiro: AgendaEventoMock = {
    id: '3',
    titulo: 'Campanha de 40 Dias de Oração',
    data_inicio: '2026-09-15T00:00:00.000Z',
    data_fim: '2026-11-05T23:59:59.000Z'
  };

  const eventoPosteriorAoMes: AgendaEventoMock = {
    id: '4',
    titulo: 'Conferência de Missões',
    data_inicio: '2026-11-01T09:00:00.000Z',
    data_fim: '2026-11-03T18:00:00.000Z'
  };

  const eventoAnteriorAoMesSemAlcance: AgendaEventoMock = {
    id: '5',
    titulo: 'Seminário de Liderança Setembro',
    data_inicio: '2026-09-01T09:00:00.000Z',
    data_fim: '2026-09-05T18:00:00.000Z'
  };

  const eventoSemDataFimDentroDoMes: AgendaEventoMock = {
    id: '6',
    titulo: 'Vigília Especial',
    data_inicio: '2026-10-20T22:00:00.000Z',
    data_fim: null
  };

  const eventoSemDataFimForaDoMes: AgendaEventoMock = {
    id: '7',
    titulo: 'Vigília Setembro',
    data_inicio: '2026-09-20T22:00:00.000Z',
    data_fim: null
  };

  it('1. Evento inteiramente dentro do mês deve ser incluído', () => {
    assert.strictEqual(matchesMonthlyInterval(eventoDentroDoMes, startOfMonth, endOfMonth), true);
  });

  it('2. Evento iniciado no mês anterior e ainda vigente no mês consultado deve ser incluído', () => {
    assert.strictEqual(matchesMonthlyInterval(eventoIniciadoMesAnteriorAindaVigente, startOfMonth, endOfMonth), true);
  });

  it('3. Evento que atravessa o mês inteiro (início antes, fim depois) deve ser incluído', () => {
    assert.strictEqual(matchesMonthlyInterval(eventoAtravessaMesInteiro, startOfMonth, endOfMonth), true);
  });

  it('4. Evento posterior ao mês consultado deve ser excluído', () => {
    assert.strictEqual(matchesMonthlyInterval(eventoPosteriorAoMes, startOfMonth, endOfMonth), false);
  });

  it('5. Evento anterior ao mês consultado já finalizado deve ser excluído', () => {
    assert.strictEqual(matchesMonthlyInterval(eventoAnteriorAoMesSemAlcance, startOfMonth, endOfMonth), false);
  });

  it('6. Evento sem data_fim que ocorre dentro do mês deve ser incluído', () => {
    assert.strictEqual(matchesMonthlyInterval(eventoSemDataFimDentroDoMes, startOfMonth, endOfMonth), true);
  });

  it('7. Evento sem data_fim que ocorre em outro mês deve ser excluído', () => {
    assert.strictEqual(matchesMonthlyInterval(eventoSemDataFimForaDoMes, startOfMonth, endOfMonth), false);
  });

  it('8. Mapeamento visual nos dias do calendário (eventosPorDia) contempla os dias do mês atual', () => {
    const eventos = [
      eventoDentroDoMes,
      eventoIniciadoMesAnteriorAindaVigente,
      eventoSemDataFimDentroDoMes
    ];
    const mapa = mapEventosPorDia(eventos, '2026-10');

    // Evento dentro do mês (dia 15)
    assert.ok(mapa['2026-10-15']?.some(e => e.id === '1'));

    // Evento iniciado em 28/09 e com fim em 04/10 deve marcar os dias 01, 02, 03 e 04 de outubro
    assert.ok(mapa['2026-10-01']?.some(e => e.id === '2'));
    assert.ok(mapa['2026-10-02']?.some(e => e.id === '2'));
    assert.ok(mapa['2026-10-03']?.some(e => e.id === '2'));
    assert.ok(mapa['2026-10-04']?.some(e => e.id === '2'));

    // E não deve mapear no dia 05
    assert.ok(!mapa['2026-10-05']?.some(e => e.id === '2'));

    // Evento sem data_fim (dia 20)
    assert.ok(mapa['2026-10-20']?.some(e => e.id === '6'));
  });
});
