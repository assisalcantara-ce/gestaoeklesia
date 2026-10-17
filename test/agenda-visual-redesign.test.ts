import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  getEventoVisual,
  CATEGORIES_CONFIG,
} from '../src/lib/agenda-visual-utils';
import { AgendaEvento } from '../src/hooks/agenda/useAgenda';

describe('Agenda da Igreja - Reprodução Visual do Mockup e Mapeamento de Categorias', () => {
  const baseEvento: AgendaEvento = {
    id: 'evt-1',
    ministry_id: 'min-1',
    church_id: 'church-1',
    planejamento_id: null,
    titulo: 'Culto de Oração',
    descricao: null,
    tipo: 'culto',
    tipo_id: null,
    origem: 'manual',
    data_inicio: '2026-10-16T19:30:00',
    data_fim: '2026-10-16T21:00:00',
    local: 'Templo Central',
    visibilidade: 'publico',
    status: 'agendado',
    recorrente: false,
    escopo: 'organizacao',
    prioridade: 1,
    calendario_oficial: true,
    gera_bloqueio: false,
    bloqueado: false,
    origem_tipo: 'cultos',
    origem_id: null,
    regra_posicionamento: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  test('1. Mapeia Culto padrão / Oração com tema laranja e ícone Church', () => {
    const visual = getEventoVisual({
      ...baseEvento,
      titulo: 'Culto de Oração e Clamor',
      tipo: 'culto',
    });
    assert.strictEqual(visual.category, 'culto');
    assert.strictEqual(visual.pillBg, 'bg-[#fff7ed]');
    assert.strictEqual(visual.pillBorder, 'border-[#fdba74]');
    assert.strictEqual(visual.pillText, 'text-[#9a3412]');
  });

  test('2. Mapeia variação Culto de Doutrina com tom ouro/âmbar nobre', () => {
    const visual = getEventoVisual({
      ...baseEvento,
      titulo: 'Culto de Doutrina e Ensino Bíblico',
      tipo: 'culto',
    });
    assert.strictEqual(visual.category, 'culto');
    assert.strictEqual(visual.label, 'Doutrina');
    assert.strictEqual(visual.pillBg, 'bg-[#fffbeb]');
    assert.strictEqual(visual.pillBorder, 'border-[#fcd34d]');
    assert.strictEqual(visual.pillText, 'text-[#854d0e]');
  });

  test('3. Mapeia variação Culto Evangelístico com tom pôr-do-sol e ícone Flame', () => {
    const visual = getEventoVisual({
      ...baseEvento,
      titulo: 'Culto Evangelístico e Celebração',
      tipo: 'culto',
    });
    assert.strictEqual(visual.category, 'culto');
    assert.strictEqual(visual.label, 'Evangelístico');
    assert.strictEqual(visual.pillBg, 'bg-[#fff7ed]');
    assert.strictEqual(visual.pillBorder, 'border-[#fb923c]');
  });

  test('4. Mapeia variação Culto da Família com tom terracota e ícone Users', () => {
    const visual = getEventoVisual({
      ...baseEvento,
      titulo: 'Culto da Família',
      tipo: 'culto',
    });
    assert.strictEqual(visual.category, 'culto');
    assert.strictEqual(visual.label, 'Família');
    assert.strictEqual(visual.pillBg, 'bg-[#fff8f1]');
    assert.strictEqual(visual.pillBorder, 'border-[#f97316]');
  });

  test('5. Mapeia Reuniões corretamente com tema verde e ícone Users', () => {
    const visual = getEventoVisual({
      ...baseEvento,
      titulo: 'Reunião de Obreiros',
      tipo: 'reuniao',
      origem_tipo: 'reunioes',
    });
    assert.strictEqual(visual.category, 'reuniao');
    assert.strictEqual(visual.pillBg, 'bg-[#f0fdf4]');
    assert.strictEqual(visual.pillBorder, 'border-[#86efac]');
    assert.strictEqual(visual.pillText, 'text-[#166534]');
  });

  test('6. Mapeia Escola Bíblica Dominical (EBD) com tema roxo', () => {
    const visual = getEventoVisual({
      ...baseEvento,
      titulo: 'Escola Bíblica Dominical',
      tipo: 'aula',
      origem_tipo: 'ebd',
    });
    assert.strictEqual(visual.category, 'ebd');
    assert.strictEqual(visual.pillBg, 'bg-[#faf5ff]');
    assert.strictEqual(visual.pillBorder, 'border-[#d8b4fe]');
    assert.strictEqual(visual.pillText, 'text-[#6b21a8]');
  });

  test('7. Mapeia Congresso de Jovens com tema azul e estrela', () => {
    const visual = getEventoVisual({
      ...baseEvento,
      titulo: 'Congresso de Jovens',
      tipo: 'evento',
    });
    assert.strictEqual(visual.category, 'congresso');
    assert.strictEqual(visual.pillBg, 'bg-[#f0f9ff]');
    assert.strictEqual(visual.pillBorder, 'border-[#38bdf8]');
    assert.strictEqual(visual.pillText, 'text-[#0369a1]');
  });

  test('8. Mapeia Ensaio / Coral com tema rosa e ícone musical', () => {
    const visual = getEventoVisual({
      ...baseEvento,
      titulo: 'Ensaio do Coral Principal',
      tipo: 'tarefa',
    });
    assert.strictEqual(visual.category, 'departamento');
    assert.strictEqual(visual.pillBg, 'bg-[#fdf2f8]');
    assert.strictEqual(visual.pillBorder, 'border-[#f472b6]');
    assert.strictEqual(visual.pillText, 'text-[#9d174d]');
  });

  test('9. Valida configuração dos 7 cards de filtro de categoria com bordas contrastadas', () => {
    assert.strictEqual(CATEGORIES_CONFIG.length, 7);
    const keys = CATEGORIES_CONFIG.map(c => c.key);
    assert.deepStrictEqual(keys, [
      'todos',
      'culto',
      'reuniao',
      'ebd',
      'departamento',
      'congresso',
      'outro',
    ]);
  });
});
