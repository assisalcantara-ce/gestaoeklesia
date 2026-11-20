import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Funções espelho para validação unitária estrita da lógica de negócio e transformação de datas

function memberToMembroTransform(member) {
  const cf = member.custom_fields && typeof member.custom_fields === 'object' ? member.custom_fields : {};
  return {
    id: member.id,
    nome: member.name || cf.nome || '',
    status: member.status || 'ativo',
    created_at: member.created_at || cf.created_at || undefined,
    member_since: member.member_since || cf.member_since || undefined,
    dataCadastro:
      member.created_at ||
      member.member_since ||
      cf.dataCadastro ||
      cf.data_cadastro ||
      undefined,
  };
}

function parseDataMembro(membro) {
  const raw = membro.created_at || membro.dataCadastro || membro.member_since;
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function gerarDadosCadastrosPorMes(membros, dataReferencia = new Date()) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dados = [];

  for (let i = 11; i >= 0; i--) {
    const data = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() - i, 1);
    dados.push({
      mes: `${meses[data.getMonth()]}/${data.getFullYear().toString().slice(-2)}`,
      cadastros: 0,
      mesNum: data.getMonth() + 1,
      anoNum: data.getFullYear(),
    });
  }

  membros.forEach(membro => {
    const dataCadastro = parseDataMembro(membro);
    if (dataCadastro) {
      const mesIdx = dados.findIndex(
        d => d.mesNum === dataCadastro.getMonth() + 1 && d.anoNum === dataCadastro.getFullYear()
      );
      if (mesIdx !== -1) dados[mesIdx].cadastros++;
    }
  });

  return dados;
}

describe('Dashboard de Membros — Resolução de Datas e Gráfico dos Últimos 12 Meses', () => {
  test('1. memberToMembro mapeia created_at, member_since e dataCadastro a partir do registro do Supabase', () => {
    const rawMember = {
      id: 'm1',
      name: 'João Silva',
      created_at: '2026-11-19T22:30:00.000Z',
      member_since: '2026-11-19',
      custom_fields: {},
      status: 'active',
    };

    const membro = memberToMembroTransform(rawMember);

    assert.equal(membro.created_at, '2026-11-19T22:30:00.000Z');
    assert.equal(membro.member_since, '2026-11-19');
    assert.equal(membro.dataCadastro, '2026-11-19T22:30:00.000Z');
  });

  test('2. memberToMembro usa member_since ou custom_fields quando created_at estiver ausente (resiliência legada)', () => {
    const legacyMember1 = {
      id: 'm2',
      name: 'Maria Santos',
      created_at: null,
      member_since: '2026-05-10',
      custom_fields: {},
    };

    const membro1 = memberToMembroTransform(legacyMember1);
    assert.equal(membro1.created_at, undefined);
    assert.equal(membro1.member_since, '2026-05-10');
    assert.equal(membro1.dataCadastro, '2026-05-10');

    const legacyMember2 = {
      id: 'm3',
      name: 'Carlos Oliveira',
      created_at: null,
      member_since: null,
      custom_fields: { dataCadastro: '2026-03-15' },
    };

    const membro2 = memberToMembroTransform(legacyMember2);
    assert.equal(membro2.dataCadastro, '2026-03-15');
  });

  test('3. parseDataMembro converte com segurança strings ISO completas e YYYY-MM-DD sem distorção de fuso', () => {
    const d1 = parseDataMembro({ created_at: '2026-11-01' });
    assert.ok(d1 !== null);
    assert.equal(d1.getFullYear(), 2026);
    assert.equal(d1.getMonth(), 10); // Novembro é index 10

    const d2 = parseDataMembro({ created_at: '2026-11-20T03:00:00.000Z' });
    assert.ok(d2 !== null);
    assert.equal(d2.getFullYear(), 2026);

    const dInvalido = parseDataMembro({ created_at: 'data_invalida' });
    assert.equal(dInvalido, null);

    const dVazio = parseDataMembro({});
    assert.equal(dVazio, null);
  });

  test('4. Gráfico dos Últimos 12 Meses agrupa cadastros reais nos meses correspondentes e inclui meses com 0', () => {
    const hoje = new Date(2026, 10, 20); // 20/Nov/2026

    const membros = [
      { id: '1', created_at: '2026-11-05T10:00:00Z' },
      { id: '2', created_at: '2026-11-15T12:00:00Z' },
      { id: '3', created_at: '2026-10-02T10:00:00Z' },
      { id: '4', created_at: '2026-08-20T10:00:00Z' },
      { id: '5', created_at: '2025-12-10T10:00:00Z' },
      { id: '6', created_at: '2024-01-01T10:00:00Z' }, // Mais antigo que 12 meses
      { id: '7' }, // Sem data de cadastro
    ];

    const dados = gerarDadosCadastrosPorMes(membros, hoje);

    assert.equal(dados.length, 12, 'Deve ter exatamente 12 meses');

    // Último mês do array é Nov/26
    const mesNov26 = dados[dados.length - 1];
    assert.equal(mesNov26.mes, 'Nov/26');
    assert.equal(mesNov26.cadastros, 2, 'Dois membros cadastrados em Nov/26');

    // Mês Out/26
    const mesOut26 = dados[dados.length - 2];
    assert.equal(mesOut26.mes, 'Out/26');
    assert.equal(mesOut26.cadastros, 1, 'Um membro em Out/26');

    // Mês Set/26 deve ser 0
    const mesSet26 = dados[dados.length - 3];
    assert.equal(mesSet26.mes, 'Set/26');
    assert.equal(mesSet26.cadastros, 0, 'Zero membros em Set/26');

    // Mês Dez/25 (11 meses atrás)
    const mesDez25 = dados.find(d => d.mes === 'Dez/25');
    assert.ok(mesDez25, 'Dez/25 deve estar presente nos 12 meses');
    assert.equal(mesDez25.cadastros, 1);
  });

  test('5. Estatísticas do Gráfico calculam pico mensal e média dos últimos 12 meses a partir dos dados do gráfico', () => {
    const hoje = new Date(2026, 10, 20);

    const membros = [
      { id: '1', created_at: '2026-11-01T10:00:00Z' },
      { id: '2', created_at: '2026-11-05T10:00:00Z' },
      { id: '3', created_at: '2026-11-10T10:00:00Z' },
      { id: '4', created_at: '2026-10-01T10:00:00Z' },
      { id: '5', created_at: '2026-10-15T10:00:00Z' },
      { id: '6', created_at: '2026-09-01T10:00:00Z' },
    ];

    const dadosCadastros = gerarDadosCadastrosPorMes(membros, hoje);
    const totalCadastros12m = dadosCadastros.reduce((acc, d) => acc + d.cadastros, 0);
    const mediaMensal12m = (totalCadastros12m / 12).toFixed(1);
    const picoMensal12m = Math.max(0, ...dadosCadastros.map(d => d.cadastros));

    assert.equal(totalCadastros12m, 6);
    assert.equal(mediaMensal12m, '0.5'); // 6 / 12 = 0.5
    assert.equal(picoMensal12m, 3); // Novembro teve 3
  });

  test('6. Não inventa datas para registros sem created_at/dataCadastro e preserva total geral de membros', () => {
    const membros = [
      { id: '1', nome: 'Membro Antigo Sem Data' },
      { id: '2', nome: 'Membro com Data', created_at: '2026-11-10T00:00:00Z' },
    ];

    const dadosCadastros = gerarDadosCadastrosPorMes(membros);
    const totalCadastros12m = dadosCadastros.reduce((acc, d) => acc + d.cadastros, 0);

    assert.equal(totalCadastros12m, 1, 'Membros sem data não entram arbitrariamente no gráfico');
    assert.equal(membros.length, 2, 'Total geral da listagem permanece íntegro');
  });
});
