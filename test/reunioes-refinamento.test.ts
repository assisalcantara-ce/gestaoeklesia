import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularExpiracaoFimDoDiaReuniao,
  ordenarReunioesMinisteriais,
  calcularStatusEfetivoReuniao,
  gerarTokenPainel,
  hashTokenPainel,
} from '@/lib/reunioes-utils';

test('Reuniões Ministeriais - Ordenação: futuras em ordem crescente antes de encerradas', () => {
  const lista: any[] = [
    { id: '1', data_reuniao: '2026-12-12', horario_inicio: '19:00', status: 'agendada' },
    { id: '2', data_reuniao: '2026-11-14', horario_inicio: '19:00', status: 'agendada' },
    { id: '3', data_reuniao: '2026-11-20', horario_inicio: '19:30', status: 'em_andamento' },
    { id: '4', data_reuniao: '2026-10-10', horario_inicio: '19:00', status: 'encerrada' },
    { id: '5', data_reuniao: '2026-10-15', horario_inicio: '19:00', status: 'encerrada' },
  ];

  const ordenada = ordenarReunioesMinisteriais(lista);

  // 14/11 antes de 20/11 e antes de 12/12
  assert.equal(ordenada[0].id, '2', 'Reunião de 14/11 deve ser a primeira');
  assert.equal(ordenada[1].id, '3', 'Reunião de 20/11 deve ser a segunda');
  assert.equal(ordenada[2].id, '1', 'Reunião de 12/12 deve ser a terceira');

  // Encerradas devem ficar no final, em ordem decrescente (15/10 antes de 10/10)
  assert.equal(ordenada[3].id, '5', 'Encerrada mais recente (15/10) vem primeiro entre as encerradas');
  assert.equal(ordenada[4].id, '4', 'Encerrada mais antiga (10/10) vem por último');
});

test('Reuniões Ministeriais - Expiração: cálculo exato às 23:59:59 da data da reunião (UTC-3)', () => {
  const expiraIso = calcularExpiracaoFimDoDiaReuniao('2026-11-14');
  const d = new Date(expiraIso);

  // Em UTC-3, 23:59:59 equivale a 02:59:59 UTC do dia seguinte
  assert.equal(d.toISOString(), '2026-11-15T02:59:59.000Z');
});

test('Reuniões Ministeriais - Tokens Criptográficos SHA-256 e Unicidade', () => {
  const token1 = gerarTokenPainel();
  const token2 = gerarTokenPainel();

  assert.notEqual(token1, token2, 'Tokens gerados devem ser únicos');
  assert.ok(token1.length >= 40, 'Token bruto deve ter entropia suficiente');

  const hash1 = hashTokenPainel(token1);
  const hash2 = hashTokenPainel(token1);
  const hashOutro = hashTokenPainel(token2);

  assert.equal(hash1, hash2, 'Hash SHA-256 deve ser determinístico');
  assert.notEqual(hash1, hashOutro, 'Hashes de tokens diferentes devem ser distintos');
  assert.equal(hash1.length, 64, 'Hash SHA-256 deve ter 64 caracteres hexadecimais');
});

test('Reuniões Ministeriais - Status Efetivo com Limite de Entrada', () => {
  const reuniaoFutura: any = {
    status: 'agendada',
    data_reuniao: '2099-01-01',
    horario_inicio: '19:00',
    horario_limite_entrada: '19:30',
  };
  assert.equal(calcularStatusEfetivoReuniao(reuniaoFutura), 'agendada');

  const reuniaoEncerrada: any = {
    status: 'encerrada',
    data_reuniao: '2026-11-14',
    horario_inicio: '19:00',
  };
  assert.equal(calcularStatusEfetivoReuniao(reuniaoEncerrada), 'encerrada');
});
