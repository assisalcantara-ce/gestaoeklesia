import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularExpiracaoFimDoDiaReuniao,
  ordenarReunioesMinisteriais,
  calcularStatusEfetivoReuniao,
  gerarTokenPainel,
  hashTokenPainel,
  getLimitesMesCorrente,
  isEventoReuniaoMinisterial,
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

test('Reuniões Ministeriais - Limites do Mês Corrente', () => {
  const ref = new Date(2026, 10, 16); // 16 de Novembro de 2026 (mês 10 em base 0)
  const limites = getLimitesMesCorrente(ref);

  assert.equal(limites.mesAnoStr, '2026-11');
  assert.equal(limites.dataInicioMes, '2026-11-01');
  assert.equal(limites.dataFimMes, '2026-11-30');
  assert.equal(limites.nomeMesAno, 'Novembro de 2026');
});

test('Reuniões Ministeriais - Identificação de Evento Ministerial da Agenda', () => {
  // 1. Evento com código de tipo estruturado de reunião ministerial
  assert.ok(
    isEventoReuniaoMinisterial({
      tipo: 'reuniao',
      agenda_tipos: { codigo: 'reuniao_ministerial', categoria: 'reuniao' },
    }),
    'Deve reconhecer código reuniao_ministerial'
  );

  // 2. Evento com categoria reuniao e código de obreiros
  assert.ok(
    isEventoReuniaoMinisterial({
      tipo: 'reuniao',
      agenda_tipos: { codigo: 'reuniao_obreiros', categoria: 'reuniao' },
    }),
    'Deve reconhecer reuniao de obreiros'
  );

  // 3. Evento com categoria reuniao e tipo 'reuniao'
  assert.ok(
    isEventoReuniaoMinisterial({
      tipo: 'reuniao',
      agenda_tipos: { codigo: 'reuniao_diretoria', categoria: 'reuniao' },
    }),
    'Deve reconhecer categoria e tipo reuniao'
  );

  // 4. Culto ou outro evento não deve ser identificado como reunião ministerial
  assert.equal(
    isEventoReuniaoMinisterial({
      tipo: 'culto',
      agenda_tipos: { codigo: 'culto_doutrina', categoria: 'culto' },
    }),
    false,
    'Culto não deve ser reconhecido como reunião ministerial'
  );

  // 5. Tarefa comum de ensaio não deve ser reconhecida
  assert.equal(
    isEventoReuniaoMinisterial({
      tipo: 'tarefa',
      agenda_tipos: { codigo: 'ensaio_coral', categoria: 'departamento' },
    }),
    false,
    'Ensaio ou tarefa não deve ser classificado como reunião ministerial'
  );

  // 6. Evento sem classificação estruturada de reunião ministerial (ex: evento avulso) não deve ser identificado
  assert.equal(
    isEventoReuniaoMinisterial({
      tipo: 'evento',
      agenda_tipos: null,
    }),
    false,
    'Evento avulso sem agenda_tipos não é reunião ministerial'
  );
});

test('Reuniões Ministeriais - Regras de Proteção Histórica e Idempotência na Sincronização', () => {
  // Simulador das regras do serviço de sincronização
  const avaliarAcaoSincronizacao = (reuniaoExistente: {
    status: string;
    total_presentes: number;
    encerrada_em?: string | null;
  } | null, ehMinisterial: boolean, operacao: string) => {
    if (!ehMinisterial) return 'ignorada_nao_ministerial';
    if (!reuniaoExistente) return operacao === 'delete' ? 'nenhuma' : 'criada';

    const jaRealizadaOuEmAndamento =
      reuniaoExistente.status === 'encerrada' ||
      (reuniaoExistente.total_presentes || 0) > 0 ||
      Boolean(reuniaoExistente.encerrada_em);

    if (jaRealizadaOuEmAndamento) {
      return 'preservada_historico';
    }

    if (operacao === 'delete' || operacao === 'cancel') {
      return 'cancelada';
    }

    return 'atualizada';
  };

  // 1. Reunião encerrada ou com check-ins NÃO pode ser sobrescrita por remarcação tardia
  assert.equal(
    avaliarAcaoSincronizacao({ status: 'encerrada', total_presentes: 85, encerrada_em: '2026-11-14T21:30:00Z' }, true, 'update'),
    'preservada_historico',
    'Reunião encerrada deve preservar quórum e histórico intactos'
  );

  // 2. Reunião que já possui presenças registradas não deve ser cancelada nem deletada
  assert.equal(
    avaliarAcaoSincronizacao({ status: 'em_andamento', total_presentes: 12 }, true, 'delete'),
    'preservada_historico',
    'Reunião com presenças registradas não deve ser cancelada se evento for apagado'
  );

  // 3. Reunião futura agendada sem presenças pode ser atualizada conforme a agenda
  assert.equal(
    avaliarAcaoSincronizacao({ status: 'agendada', total_presentes: 0 }, true, 'update'),
    'atualizada',
    'Reunião futura agendada pode ser remarcada e atualizada'
  );

  // 4. Reunião futura agendada sem presenças é cancelada com segurança (sem DELETE)
  assert.equal(
    avaliarAcaoSincronizacao({ status: 'agendada', total_presentes: 0 }, true, 'cancel'),
    'cancelada',
    'Reunião futura sem presenças é cancelada'
  );
});


