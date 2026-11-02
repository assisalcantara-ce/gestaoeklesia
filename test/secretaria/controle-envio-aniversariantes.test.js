import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const INSTITUTIONAL_TIMEZONE = 'America/Belem';

function getHojeLocalBelem(refDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: INSTITUTIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dataStr = formatter.format(refDate); // YYYY-MM-DD
  const [ano, mes, dia] = dataStr.split('-').map((v) => parseInt(v, 10));
  return { dataStr, dia, mes, ano };
}

function extrairDiaMesNascimento(dataNascimento) {
  if (!dataNascimento || typeof dataNascimento !== 'string') return null;
  const raw = dataNascimento.trim();
  if (!raw) return null;

  let dia = 0;
  let mes = 0;

  if (raw.includes('-')) {
    const parts = raw.split('T')[0].split('-');
    if (parts.length >= 3) {
      mes = parseInt(parts[1], 10);
      dia = parseInt(parts[2], 10);
    }
  } else if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts.length >= 2) {
      dia = parseInt(parts[0], 10);
      mes = parseInt(parts[1], 10);
    }
  }

  if (isNaN(dia) || isNaN(mes) || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
    return null;
  }

  return { dia, mes };
}

function isAniversarianteHoje(dataNascimento, refDate = new Date()) {
  const bday = extrairDiaMesNascimento(dataNascimento);
  if (!bday) return false;

  const hoje = getHojeLocalBelem(refDate);
  return bday.dia === hoje.dia && bday.mes === hoje.mes;
}

describe('Controle de Envio por Data de Aniversário (Fuso America/Belem)', () => {
  test('1. Extração de dia e mês suporta formato ISO (YYYY-MM-DD) e BR (DD/MM/YYYY)', () => {
    const iso = extrairDiaMesNascimento('1985-11-14');
    assert.deepStrictEqual(iso, { dia: 14, mes: 11 });

    const br = extrairDiaMesNascimento('16/11/1990');
    assert.deepStrictEqual(br, { dia: 16, mes: 11 });

    const invalido = extrairDiaMesNascimento('data-invalida');
    assert.strictEqual(invalido, null);
  });

  test('2. No dia 02/11/2026, aniversariantes de 14/11 e 16/11 devem estar bloqueados', () => {
    // Simula a data 02/11/2026 no horário de Belém
    const refData02Nov = new Date('2026-11-02T12:00:00-03:00');

    const alex14Nov = isAniversarianteHoje('1985-11-14', refData02Nov);
    const miguel16Nov = isAniversarianteHoje('1990-11-16', refData02Nov);
    const joao02Nov = isAniversarianteHoje('1995-11-02', refData02Nov);

    assert.strictEqual(alex14Nov, false, 'Alex (14/11) deve estar bloqueado em 02/11');
    assert.strictEqual(miguel16Nov, false, 'Miguel (16/11) deve estar bloqueado em 02/11');
    assert.strictEqual(joao02Nov, true, 'Membro nascido em 02/11 deve estar habilitado');
  });

  test('3. No dia 14/11/2026, somente Alex (14/11) pode receber; Miguel (16/11) permanece bloqueado', () => {
    const refData14Nov = new Date('2026-11-14T10:00:00-03:00');

    const alex14Nov = isAniversarianteHoje('1985-11-14', refData14Nov);
    const miguel16Nov = isAniversarianteHoje('1990-11-16', refData14Nov);

    assert.strictEqual(alex14Nov, true, 'Alex (14/11) deve estar liberado em 14/11');
    assert.strictEqual(miguel16Nov, false, 'Miguel (16/11) deve estar bloqueado em 14/11');
  });

  test('4. No dia 16/11/2026, somente Miguel (16/11) pode receber; Alex (14/11) volta a ficar bloqueado', () => {
    const refData16Nov = new Date('2026-11-16T15:30:00-03:00');

    const alex14Nov = isAniversarianteHoje('1985-11-14', refData16Nov);
    const miguel16Nov = isAniversarianteHoje('1990-11-16', refData16Nov);

    assert.strictEqual(alex14Nov, false, 'Alex (14/11) deve estar bloqueado em 16/11');
    assert.strictEqual(miguel16Nov, true, 'Miguel (16/11) deve estar liberado em 16/11');
  });

  test('5. Fuso America/Belem: não sofre distorção na transição UTC (ex: 22h UTC-3 = 01h UTC do dia seguinte)', () => {
    // 23h30 em Belém no dia 14/11 é 02h30 UTC do dia 15/11
    const quaseMeiaNoite = new Date('2026-11-14T23:30:00-03:00');
    const hojeBelem = getHojeLocalBelem(quaseMeiaNoite);

    assert.strictEqual(hojeBelem.dia, 14);
    assert.strictEqual(hojeBelem.mes, 11);
    assert.strictEqual(isAniversarianteHoje('1985-11-14', quaseMeiaNoite), true);
  });
});
