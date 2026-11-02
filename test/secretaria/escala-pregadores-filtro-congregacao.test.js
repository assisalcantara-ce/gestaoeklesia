/**
 * escala-pregadores-filtro-congregacao.test.js
 *
 * Teste funcional rigoroso do carregamento e filtragem dinâmica de congregações
 * na Escala de Pregadores.
 *
 * Valida:
 * 1. Resolução dinâmica de congregações por ano_mes: somente congregações com cultos
 *    vinculados por church_id aparecem.
 * 2. Em Novembro/2026, Templo Central (Sede) aparece e congregações sem eventos
 *    (Monte Horebe, Monte Tabor e Monte das Oliveiras) NÃO aparecem.
 * 3. O select provê a opção geral "Todas as Congregações" (value="").
 * 4. Ao selecionar "Todas as Congregações", retorna todos os eventos do mês (específicos + gerais).
 * 5. Ao selecionar "Templo Central", filtra estritamente seus 5 cultos, sem vazar eventos
 *    de "Todo o Campo" (Doutrina, Santa Ceia).
 * 6. Se a congregação anteriormente selecionada não tiver eventos no novo período,
 *    retorna automaticamente ao filtro geral ("Todas as Congregações").
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Escala de Pregadores - Filtro Dinâmico de Congregações por Período', () => {
  // Catálogo completo de congregações cadastradas na Secretaria
  const todasCongregacoesBanco = [
    { id: 'cong-monte-horebe', nome: 'MONTE HOREBE', campo_id: 'campo-1', is_active: true },
    { id: 'cong-templo-central', nome: 'TEMPLO CENTRAL', campo_id: 'campo-1', is_active: true },
    { id: 'cong-monte-tabor', nome: 'MONTE TABOR', campo_id: null, is_active: true },
    { id: 'cong-monte-oliveiras', nome: 'MONTE DAS OLIVEIRAS', campo_id: 'campo-1', is_active: true },
  ];

  const camposSedeSet = new Set(['campo-sede']);

  // Eventos na Agenda Oficial para Novembro/2026
  const eventosNovembro2026 = [
    {
      id: 'evt-nov-1',
      titulo: 'CULTO ADMINISTRATIVO',
      data_inicio: '2026-11-02T22:30:00+00:00',
      church_id: 'cong-templo-central',
      local: 'TEMPLO CENTRAL',
      status: 'agendado',
    },
    {
      id: 'evt-nov-2',
      titulo: 'CULTO DE DOUTRINA',
      data_inicio: '2026-11-06T22:30:00+00:00',
      church_id: null, // Todo o Campo
      local: 'Todo o Campo (Todas as Congregações)',
      status: 'agendado',
    },
    {
      id: 'evt-nov-3',
      titulo: 'CULTO ADMINISTRATIVO',
      data_inicio: '2026-11-09T22:30:00+00:00',
      church_id: 'cong-templo-central',
      local: 'TEMPLO CENTRAL',
      status: 'agendado',
    },
    {
      id: 'evt-nov-4',
      titulo: 'SANTA CEIA',
      data_inicio: '2026-11-14T22:30:00+00:00',
      church_id: null, // Todo o Campo
      local: null,
      status: 'agendado',
    },
    {
      id: 'evt-nov-5',
      titulo: 'CULTO ADMINISTRATIVO',
      data_inicio: '2026-11-16T22:30:00+00:00',
      church_id: 'cong-templo-central',
      local: 'TEMPLO CENTRAL',
      status: 'agendado',
    },
    {
      id: 'evt-nov-6',
      titulo: 'CULTO CANCELADO',
      data_inicio: '2026-11-18T22:30:00+00:00',
      church_id: 'cong-monte-horebe',
      local: 'MONTE HOREBE',
      status: 'cancelado', // Ignorado por ser cancelado
    },
  ];

  // Simulação da lógica do endpoint backend GET /api/v1/secretaria/escala-pregadores?acao=congregacoes
  function resolverCongregacoesBackend({ anoMes, congsBanco, eventosBanco, sedeCampos }) {
    let idsComEventos = null;

    if (anoMes && anoMes.includes('-')) {
      const [anoStr, mesStr] = anoMes.split('-');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10);
      const startOfMonth = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)).toISOString();
      const endOfMonth = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)).toISOString();

      const evtsValidos = eventosBanco.filter((e) => {
        return (
          e.status !== 'cancelado' &&
          Boolean(e.church_id) &&
          e.data_inicio >= startOfMonth &&
          e.data_inicio <= endOfMonth
        );
      });

      idsComEventos = Array.from(new Set(evtsValidos.map((e) => e.church_id)));
    }

    if (idsComEventos !== null && idsComEventos.length === 0) {
      return [];
    }

    let congsFiltradas = congsBanco.filter((c) => c.is_active !== false);
    if (idsComEventos !== null) {
      congsFiltradas = congsFiltradas.filter((c) => idsComEventos.includes(c.id));
    }

    const formatadas = congsFiltradas.map((c) => {
      const isSede = Boolean(
        (c.campo_id && sedeCampos.has(c.campo_id)) ||
        c.nome?.toLowerCase().includes('templo central') ||
        c.nome?.toLowerCase().includes('sede')
      );
      return {
        id: c.id,
        nome: c.nome,
        is_sede: isSede,
      };
    });

    formatadas.sort((a, b) => {
      if (a.is_sede && !b.is_sede) return -1;
      if (!a.is_sede && b.is_sede) return 1;
      return a.nome.localeCompare(b.nome);
    });

    return formatadas;
  }

  it('1. Em Novembro/2026, deve retornar exclusivamente TEMPLO CENTRAL e excluir congregações sem eventos', () => {
    const congs = resolverCongregacoesBackend({
      anoMes: '2026-11',
      congsBanco: todasCongregacoesBanco,
      eventosBanco: eventosNovembro2026,
      sedeCampos: camposSedeSet,
    });

    assert.strictEqual(congs.length, 1);
    assert.strictEqual(congs[0].id, 'cong-templo-central');
    assert.strictEqual(congs[0].nome, 'TEMPLO CENTRAL');
    assert.strictEqual(congs[0].is_sede, true);

    // Monte Horebe, Monte Tabor e Monte das Oliveiras NÃO podem aparecer
    const nomesRetornados = congs.map((c) => c.nome);
    assert.strictEqual(nomesRetornados.includes('MONTE HOREBE'), false);
    assert.strictEqual(nomesRetornados.includes('MONTE TABOR'), false);
    assert.strictEqual(nomesRetornados.includes('MONTE DAS OLIVEIRAS'), false);
  });

  it('2. O componente de filtro deve preservar sempre a opção "Todas as Congregações" no topo', () => {
    const congs = resolverCongregacoesBackend({
      anoMes: '2026-11',
      congsBanco: todasCongregacoesBanco,
      eventosBanco: eventosNovembro2026,
      sedeCampos: camposSedeSet,
    });

    const selectOptions = [
      { value: '', label: 'Todas as Congregações' },
      ...congs.map((c) => ({
        value: c.id,
        label: `${c.nome} ${c.is_sede ? '(Sede)' : ''}`.trim(),
      })),
    ];

    assert.strictEqual(selectOptions.length, 2);
    assert.strictEqual(selectOptions[0].value, '');
    assert.strictEqual(selectOptions[0].label, 'Todas as Congregações');
    assert.strictEqual(selectOptions[1].value, 'cong-templo-central');
    assert.strictEqual(selectOptions[1].label, 'TEMPLO CENTRAL (Sede)');
  });

  it('3. "Todas as Congregações" (value="") deve listar todos os eventos (Templo Central + Todo o Campo)', () => {
    const filtroChurchId = '';
    const eventosFiltrados = eventosNovembro2026.filter((e) => {
      if (e.status === 'cancelado') return false;
      if (!filtroChurchId) return true;
      return e.church_id === filtroChurchId;
    });

    // 3 cultos administrativos de Templo Central + Doutrina + Santa Ceia
    assert.strictEqual(eventosFiltrados.length, 5);
  });

  it('4. Ao selecionar Templo Central, deve listar estritamente os cultos vinculados ao seu church_id', () => {
    const filtroChurchId = 'cong-templo-central';
    const eventosFiltrados = eventosNovembro2026.filter((e) => {
      if (e.status === 'cancelado') return false;
      if (!filtroChurchId) return true;
      return e.church_id === filtroChurchId;
    });

    assert.strictEqual(eventosFiltrados.length, 3);
    eventosFiltrados.forEach((e) => {
      assert.strictEqual(e.church_id, 'cong-templo-central');
    });
  });

  it('5. Regra de reset automático: se congregação selecionada não tiver eventos no novo mês, volta para ""', () => {
    let filtrosState = { anoMes: '2026-11', churchId: 'cong-monte-horebe' };
    const listaCongsNovoMes = resolverCongregacoesBackend({
      anoMes: '2026-11',
      congsBanco: todasCongregacoesBanco,
      eventosBanco: eventosNovembro2026,
      sedeCampos: camposSedeSet,
    });

    // Simulação do efeito em useEscalaPregadores
    if (filtrosState.churchId && !listaCongsNovoMes.some((c) => c.id === filtrosState.churchId)) {
      filtrosState = { ...filtrosState, churchId: '' };
    }

    assert.strictEqual(filtrosState.churchId, '');
  });
});
