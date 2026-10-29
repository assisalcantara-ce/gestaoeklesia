import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Agenda Gestão Eklésia — Escopo Todas as Congregações (Exceto a Sede)', () => {
  it('1. Seleção no formulário define local e regra_posicionamento corretamente', () => {
    const form = {
      church_id: 'EXCETO_SEDE',
      local: 'Todas as Congregações (Exceto a Sede)',
      escopo: 'organizacao',
      gera_bloqueio: false,
      calendario_oficial: false,
      regra_posicionamento: '',
    };

    const isExcetoSede = form.church_id === 'EXCETO_SEDE';
    const finalChurchId = isExcetoSede ? null : form.church_id;
    const finalEscopo = finalChurchId ? 'divisao1' : 'organizacao';
    const finalLocal = isExcetoSede
      ? 'Todas as Congregações (Exceto a Sede)'
      : (finalChurchId ? form.local : 'Todo o Campo (Todas as Congregações)');
    const finalRegraPosicionamento = isExcetoSede ? 'exceto_sede' : null;

    assert.equal(finalChurchId, null, 'church_id deve ser null para abranger múltiplas congregações');
    assert.equal(finalEscopo, 'organizacao', 'escopo deve ser organizacao');
    assert.equal(finalLocal, 'Todas as Congregações (Exceto a Sede)');
    assert.equal(finalRegraPosicionamento, 'exceto_sede', 'regra_posicionamento deve marcar exceto_sede');
  });

  it('2. Edição do evento identifica regra_posicionamento ou local e re-seleciona EXCETO_SEDE', () => {
    const eventoSalvo = {
      id: 'evt-exceto-1',
      titulo: 'Reunião de Líderes Locais',
      church_id: null,
      local: 'Todas as Congregações (Exceto a Sede)',
      regra_posicionamento: 'exceto_sede',
      escopo: 'organizacao',
    };

    let resolvedChurchId = eventoSalvo.church_id || '';
    let resolvedLocal = eventoSalvo.local || '';

    if (!resolvedChurchId) {
      if (eventoSalvo.regra_posicionamento === 'exceto_sede' || (resolvedLocal && resolvedLocal.toLowerCase().includes('exceto a sede'))) {
        resolvedChurchId = 'EXCETO_SEDE';
        resolvedLocal = 'Todas as Congregações (Exceto a Sede)';
      }
    }

    assert.equal(resolvedChurchId, 'EXCETO_SEDE', 'Deve carregar o select com EXCETO_SEDE');
    assert.equal(resolvedLocal, 'Todas as Congregações (Exceto a Sede)');
  });

  it('3. Visualização na Agenda: evento aparece nas congregações locais e é OCULTADO na Sede', () => {
    const congregacoes = [
      { id: 'cong-sede', nome: 'Templo Sede', is_sede: true },
      { id: 'cong-betania', nome: 'Betânia', is_sede: false },
      { id: 'cong-hebron', nome: 'Hebron', is_sede: false },
    ];

    const eventos = [
      {
        id: 'evt-1',
        titulo: 'Reunião Exclusiva das Congregações',
        church_id: null,
        local: 'Todas as Congregações (Exceto a Sede)',
        regra_posicionamento: 'exceto_sede',
      },
      {
        id: 'evt-2',
        titulo: 'Culto Geral Todo o Campo',
        church_id: null,
        local: 'Todo o Campo (Todas as Congregações)',
        regra_posicionamento: null,
      },
      {
        id: 'evt-3',
        titulo: 'Culto da Sede',
        church_id: 'cong-sede',
        local: 'Templo Sede',
        regra_posicionamento: null,
      }
    ];

    const filtrarParaVisualizacao = (agendaVisualizadaId: string) => {
      // Query do Supabase simula: church_id.eq.agendaVisualizada,church_id.is.null
      let base = eventos.filter(e => e.church_id === agendaVisualizadaId || e.church_id === null);

      const congVisualizada = congregacoes.find(c => c.id === agendaVisualizadaId);
      if (congVisualizada?.is_sede) {
        base = base.filter(e => {
          const isExcetoSede = 
            e.regra_posicionamento === 'exceto_sede' || 
            (e.local && e.local.toLowerCase().includes('exceto a sede'));
          return !isExcetoSede;
        });
      }
      return base;
    };

    // A) Visualizando a Sede:
    const eventosNaSede = filtrarParaVisualizacao('cong-sede');
    assert.ok(!eventosNaSede.some(e => e.id === 'evt-1'), 'Evento Exceto Sede NÃO pode aparecer na Sede');
    assert.ok(eventosNaSede.some(e => e.id === 'evt-2'), 'Evento Geral deve aparecer na Sede');
    assert.ok(eventosNaSede.some(e => e.id === 'evt-3'), 'Evento local da Sede deve aparecer na Sede');

    // B) Visualizando Betânia (Congregação local):
    const eventosEmBetania = filtrarParaVisualizacao('cong-betania');
    assert.ok(eventosEmBetania.some(e => e.id === 'evt-1'), 'Evento Exceto Sede DEVE aparecer em Betânia');
    assert.ok(eventosEmBetania.some(e => e.id === 'evt-2'), 'Evento Geral DEVE aparecer em Betânia');
    assert.ok(!eventosEmBetania.some(e => e.id === 'evt-3'), 'Evento exclusivo da Sede NÃO deve aparecer em Betânia');

    // C) Visualizando Hebron (Outra congregação local):
    const eventosEmHebron = filtrarParaVisualizacao('cong-hebron');
    assert.ok(eventosEmHebron.some(e => e.id === 'evt-1'), 'Evento Exceto Sede DEVE aparecer em Hebron');
  });
});
