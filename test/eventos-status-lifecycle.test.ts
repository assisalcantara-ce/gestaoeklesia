import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliarStatusInscricao,
  isEventoExpirado,
  parseDataHoraBrasilia,
} from '../src/lib/evento-status-utils';

test('1. Evento futuro com inscrições abertas: permite inscrição direta', () => {
  const agora = new Date('2026-10-19T14:00:00Z'); // 11:00 em Brasília
  const res = avaliarStatusInscricao({
    status: 'programado',
    aceita_inscricao: true,
    data_inicio: '2026-10-23T19:00:00',
    data_fim: '2026-10-23T21:30:00',
    capacidade: 100,
    inscritos_confirmados: 25,
    aguardando_pagamento: 5,
    agora,
  });

  assert.equal(res.status_inscricao, 'aberto');
  assert.equal(res.permite_inscricao, true);
  assert.equal(res.is_lista_espera, false);
  assert.equal(res.motivo_bloqueio, null);
});

test('2. Encerramento manual pelo administrador: bloqueia inscrições mesmo em evento futuro', () => {
  const agora = new Date('2026-10-19T14:00:00Z');
  const res = avaliarStatusInscricao({
    status: 'programado',
    aceita_inscricao: false,
    data_inicio: '2026-10-23T19:00:00',
    data_fim: '2026-10-23T21:30:00',
    capacidade: 100,
    agora,
  });

  assert.equal(res.status_inscricao, 'encerrado_manual');
  assert.equal(res.permite_inscricao, false);
  assert.equal(res.is_lista_espera, false);
  assert.match(res.motivo_bloqueio ?? '', /encerradas pela organização/i);
});

test('3. Prazo expirado (data_fim já passou no fuso de Brasília): bloqueia inscrições', () => {
  const agora = new Date('2026-10-24T01:00:00Z'); // 23/10 22:00 em Brasília (após término 21:30)
  const res = avaliarStatusInscricao({
    status: 'programado',
    aceita_inscricao: true,
    data_inicio: '2026-10-23T19:00:00',
    data_fim: '2026-10-23T21:30:00',
    capacidade: 100,
    agora,
  });

  assert.equal(res.status_inscricao, 'expirado');
  assert.equal(res.permite_inscricao, false);
  assert.equal(res.is_lista_espera, false);
  assert.match(res.motivo_bloqueio ?? '', /já foi realizado ou o prazo de inscrições expirou/i);
});

test('3b. Status "realizado" explícito: bloqueia inscrições independentemente da data', () => {
  const agora = new Date('2026-10-19T14:00:00Z');
  const res = avaliarStatusInscricao({
    status: 'realizado',
    aceita_inscricao: true,
    data_inicio: '2026-10-23T19:00:00',
    capacidade: 100,
    agora,
  });

  assert.equal(res.status_inscricao, 'expirado');
  assert.equal(res.permite_inscricao, false);
});

test('4. Evento lotado: permite inscrição na lista de espera quando atinge capacidade', () => {
  const agora = new Date('2026-10-19T14:00:00Z');
  const res = avaliarStatusInscricao({
    status: 'programado',
    aceita_inscricao: true,
    data_inicio: '2026-10-23T19:00:00',
    data_fim: '2026-10-23T21:30:00',
    capacidade: 50,
    inscritos_confirmados: 48,
    aguardando_pagamento: 2, // 48 + 2 = 50 vagas preenchidas
    agora,
  });

  assert.equal(res.status_inscricao, 'lotado');
  assert.equal(res.permite_inscricao, true);
  assert.equal(res.is_lista_espera, true);
  assert.equal(res.motivo_bloqueio, null);
});

test('5. Evento cancelado: bloqueia inscrições com mensagem clara de cancelamento', () => {
  const agora = new Date('2026-10-19T14:00:00Z');
  const res = avaliarStatusInscricao({
    status: 'cancelado',
    aceita_inscricao: true,
    data_inicio: '2026-10-23T19:00:00',
    agora,
  });

  assert.equal(res.status_inscricao, 'cancelado');
  assert.equal(res.permite_inscricao, false);
  assert.equal(res.is_lista_espera, false);
  assert.match(res.motivo_bloqueio ?? '', /cancelado/i);
});

test('6. Fuso horário de Brasília (UTC-3): verificação determinística de horários', () => {
  // Teste de parsing no fuso de Brasília
  const data = parseDataHoraBrasilia('2026-10-23T19:00:00');
  assert.ok(data !== null);
  // 19:00 no fuso -03:00 deve corresponder a 22:00:00Z em UTC
  assert.equal(data.toISOString(), '2026-10-23T22:00:00.000Z');

  // Antes do término: não expirado
  const antesFim = new Date('2026-10-23T21:00:00-03:00');
  assert.equal(isEventoExpirado('2026-10-23T21:30:00', '2026-10-23T19:00:00', antesFim), false);

  // Após término: expirado
  const aposFim = new Date('2026-10-23T21:31:00-03:00');
  assert.equal(isEventoExpirado('2026-10-23T21:30:00', '2026-10-23T19:00:00', aposFim), true);
});
