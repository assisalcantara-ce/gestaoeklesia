import { 
  formatHoraLocal, 
  isoToDateTimeLocalInput, 
  localInputToUtcIso, 
  getLocalDateStr,
} from '@/lib/timezone-utils';
import { AgendaRecorrenciaService } from '@/lib/agenda-recorrencia-service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${msg}`);
  }
}

console.log('=== BATERIA COMPLETA DE TESTES DE FUSO HORÁRIO E RECORRÊNCIAS ===');
console.log(`Process TZ inicial: ${process.env.TZ || 'Sistema'}`);

// Testes simulando múltiplos fusos de navegadores de clientes
const fusosTeste = ['America/Belem', 'UTC', 'America/Sao_Paulo', 'America/New_York', 'Asia/Tokyo'];

for (const tz of fusosTeste) {
  process.env.TZ = tz;
  console.log(`\n--- Testando sob emulação de TZ do cliente: ${tz} ---`);

  // 1. Criação: Usuário digita 19:00 no input
  const inputCriacao = '2026-10-29T19:00';
  const utcGerado = localInputToUtcIso(inputCriacao);
  assert(utcGerado === '2026-10-29T22:00:00.000Z', `[${tz}] Esperado 22:00:00.000Z mas obteve ${utcGerado}`);

  // 2. Exibição: O calendário recebe o UTC e deve exibir 19:00
  const horaExibida = formatHoraLocal(utcGerado);
  assert(horaExibida === '19:00', `[${tz}] Esperado 19:00 mas obteve ${horaExibida}`);

  // 3. Edição: O formulário abre o evento existente a partir do UTC
  const inputEdicao = isoToDateTimeLocalInput(utcGerado);
  assert(inputEdicao === '2026-10-29T19:00', `[${tz}] Input na edição deve ser 2026-10-29T19:00, recebeu ${inputEdicao}`);

  // 4. Idempotência estrita: Salvar sem alterar preserva o exato instante original
  const resalvoUtc = localInputToUtcIso(inputEdicao);
  assert(resalvoUtc === utcGerado, `[${tz}] Resalvar deve ser 100% idempotente: ${resalvoUtc} !== ${utcGerado}`);

  // 5. Virada de dia / Evento Noturno: 22h30 em Belém = 01:30 UTC do dia seguinte
  const inputNoturno = '2026-10-29T22:30';
  const utcNoturno = localInputToUtcIso(inputNoturno);
  assert(utcNoturno === '2026-10-30T01:30:00.000Z', `[${tz}] Noturno esperado 2026-10-30T01:30:00.000Z mas foi ${utcNoturno}`);
  const dataCivil = getLocalDateStr(utcNoturno);
  const horaNoturna = formatHoraLocal(utcNoturno);
  assert(dataCivil === '2026-10-29', `[${tz}] Data civil em Belém deve ser 2026-10-29 mas foi ${dataCivil}`);
  assert(horaNoturna === '22:30', `[${tz}] Hora em Belém deve ser 22:30 mas foi ${horaNoturna}`);

  // 6. Evento com Início e Fim (duração)
  const inputFim = '2026-10-29T21:00';
  const utcFim = localInputToUtcIso(inputFim);
  assert(utcFim === '2026-10-30T00:00:00.000Z', `[${tz}] Fim esperado 2026-10-30T00:00:00.000Z mas foi ${utcFim}`);
  const horaFim = formatHoraLocal(utcFim);
  assert(horaFim === '21:00', `[${tz}] Hora de fim deve ser 21:00 mas foi ${horaFim}`);

  console.log(`  ✔ Criação, exibição, edição, virada de dia e idempotência OK em ${tz}`);
}

console.log('\n--- Testando Recorrências: Semanal, Mensal (Dia Fixo e Ordinal) e Anual ---');

// Recorrência Semanal
const recSemanal = AgendaRecorrenciaService.gerarOcorrencias({
  dataInicio: '2026-10-01T22:00:00.000Z', // Quinta-feira às 19:00 Belém
  dataFim: '2026-10-01T23:30:00.000Z',   // Quinta-feira às 20:30 Belém
  config: {
    frequencia: 'semanal',
    diasSemana: [4],
    maxOcorrencias: 4,
    anoReferencia: 2026
  }
});
assert(recSemanal.length === 4, 'Deveria gerar exatamente 4 ocorrências semanais');
const datasSemanais = recSemanal.map(o => o.dataBaseStr);
const uniqueDatasSemanais = new Set(datasSemanais);
assert(uniqueDatasSemanais.size === 4, 'Não pode haver datas duplicadas nas recorrências semanais');
for (const o of recSemanal) {
  assert(formatHoraLocal(o.dataInicio) === '19:00', `Hora de início semanal deve ser 19:00, obteve ${formatHoraLocal(o.dataInicio)}`);
  assert(formatHoraLocal(o.dataFim!) === '20:30', `Hora de término semanal deve ser 20:30, obteve ${formatHoraLocal(o.dataFim!)}`);
}
console.log('  ✔ Recorrência Semanal: 4 ocorrências geradas sem duplicação e horários preservados.');

// Recorrência Mensal por Dia Fixo (ex: Todo dia 15 às 19:30)
const recMensalDia = AgendaRecorrenciaService.gerarOcorrencias({
  dataInicio: '2026-01-15T22:30:00.000Z', // 15 de Jan às 19:30 Belém
  dataFim: '2026-01-15T23:30:00.000Z',
  config: {
    frequencia: 'mensal_dia',
    diaDoMes: 15,
    anoReferencia: 2026
  }
});
assert(recMensalDia.length === 12, `Esperado 12 meses, gerou ${recMensalDia.length}`);
const datasMensais = recMensalDia.map(o => o.dataBaseStr);
const uniqueDatasMensais = new Set(datasMensais);
assert(uniqueDatasMensais.size === 12, 'Não pode haver datas duplicadas na recorrência mensal por dia');
for (const o of recMensalDia) {
  assert(formatHoraLocal(o.dataInicio) === '19:30', `Hora de início mensal deve ser 19:30, obteve ${formatHoraLocal(o.dataInicio)}`);
  assert(o.dataBaseStr.endsWith('-15'), `Dia base deve ser sempre 15: ${o.dataBaseStr}`);
}
console.log('  ✔ Recorrência Mensal por Dia: 12 meses gerados sem duplicação e horários preservados.');

// Recorrência Mensal por Ordinal (ex: 2º Sábado de cada mês às 09:00)
const recMensalOrdinal = AgendaRecorrenciaService.gerarOcorrencias({
  dataInicio: '2026-01-10T12:00:00.000Z', // 09:00 Belém (+3h = 12:00 UTC)
  dataFim: '2026-01-10T14:00:00.000Z',   // 11:00 Belém (+3h = 14:00 UTC)
  config: {
    frequencia: 'mensal_ordinal',
    ordinal: 'segundo',
    diaSemanaOrdinal: 6, // Sábado
    anoReferencia: 2026
  }
});
assert(recMensalOrdinal.length === 12, `Esperado 12 meses para 2º sábado, obteve ${recMensalOrdinal.length}`);
const uniqueDatasOrdinal = new Set(recMensalOrdinal.map(o => o.dataBaseStr));
assert(uniqueDatasOrdinal.size === 12, 'Não pode haver datas duplicadas na recorrência mensal ordinal');
for (const o of recMensalOrdinal) {
  assert(formatHoraLocal(o.dataInicio) === '09:00', `Hora de início ordinal deve ser 09:00, obteve ${formatHoraLocal(o.dataInicio)}`);
  assert(formatHoraLocal(o.dataFim!) === '11:00', `Hora de término ordinal deve ser 11:00, obteve ${formatHoraLocal(o.dataFim!)}`);
}
console.log('  ✔ Recorrência Mensal Ordinal: 12 meses gerados sem duplicação e horários preservados.');

// Recorrência Anual (ex: 25 de Dezembro às 18:00 por 3 anos)
const recAnual = AgendaRecorrenciaService.gerarOcorrencias({
  dataInicio: '2026-12-25T21:00:00.000Z', // 18:00 Belém (+3h = 21:00 UTC)
  dataFim: '2026-12-25T23:00:00.000Z',
  config: {
    frequencia: 'anual',
    anoLimite: 2028,
    anoReferencia: 2026
  }
});
assert(recAnual.length === 3, `Esperado 3 anos (2026, 2027, 2028), obteve ${recAnual.length}`);
const uniqueDatasAnual = new Set(recAnual.map(o => o.dataBaseStr));
assert(uniqueDatasAnual.size === 3, 'Não pode haver datas duplicadas na recorrência anual');
for (const o of recAnual) {
  assert(formatHoraLocal(o.dataInicio) === '18:00', `Hora de início anual deve ser 18:00, obteve ${formatHoraLocal(o.dataInicio)}`);
  assert(o.dataBaseStr.endsWith('-12-25'), `Data anual deve ser 25 de dezembro: ${o.dataBaseStr}`);
}
console.log('  ✔ Recorrência Anual: 3 anos gerados sem duplicação e horários preservados.');

console.log('\n✅ TODAS AS VALIDAÇÕES DE MULTI-FUSO, TRANSIÇÃO E RECORRÊNCIAS FORAM CONCLUÍDAS COM SUCESSO!');
