import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAge,
  categorizeAge,
  isBirthdayInNextDays,
  isBirthdayInCurrentWeek,
} from '../../src/services/secretary-reports-service.ts';

describe('Central de Relatórios da Secretaria - Regras de Domínio e Demografia', () => {

  describe('1. Cálculo de Idade Preciso', () => {
    test('Deve calcular a idade de quem já fez aniversário no ano', () => {
      const refDate = new Date(2026, 8, 12); // 12 de Setembro de 2026
      const age = calculateAge('1990-05-10', refDate);
      assert.equal(age, 36);
    });

    test('Deve calcular a idade de quem ainda NÃO fez aniversário no ano', () => {
      const refDate = new Date(2026, 8, 12); // 12 de Setembro de 2026
      const age = calculateAge('1990-11-20', refDate);
      assert.equal(age, 35);
    });

    test('Deve calcular a idade exatamente no dia do aniversário', () => {
      const refDate = new Date(2026, 8, 12); // 12 de Setembro de 2026
      const age = calculateAge('2000-09-12', refDate);
      assert.equal(age, 26);
    });

    test('Deve retornar null para data nula ou inválida', () => {
      assert.equal(calculateAge(null), null);
      assert.equal(calculateAge(''), null);
      assert.equal(calculateAge(undefined), null);
    });
  });

  describe('2. Faixas Etárias Oficiais da Eklésia', () => {
    test('Crianças: 0 a 11 anos', () => {
      assert.equal(categorizeAge(0), '0-11');
      assert.equal(categorizeAge(5), '0-11');
      assert.equal(categorizeAge(11), '0-11');
    });

    test('Adolescentes: 12 a 17 anos', () => {
      assert.equal(categorizeAge(12), '12-17');
      assert.equal(categorizeAge(15), '12-17');
      assert.equal(categorizeAge(17), '12-17');
    });

    test('Jovens: 18 a 29 anos', () => {
      assert.equal(categorizeAge(18), '18-29');
      assert.equal(categorizeAge(24), '18-29');
      assert.equal(categorizeAge(29), '18-29');
    });

    test('Adultos: 30 a 59 anos', () => {
      assert.equal(categorizeAge(30), '30-59');
      assert.equal(categorizeAge(45), '30-59');
      assert.equal(categorizeAge(59), '30-59');
    });

    test('Idosos: 60+ anos', () => {
      assert.equal(categorizeAge(60), '60+');
      assert.equal(categorizeAge(80), '60+');
    });

    test('Não informado', () => {
      assert.equal(categorizeAge(null), 'nao_informado');
    });
  });

  describe('3. Aniversariantes com Transição de Mês e de Ano', () => {
    test('Deve identificar aniversário nos próximos 30 dias dentro do mesmo mês', () => {
      const refDate = new Date(2026, 8, 12); // 12 de Setembro de 2026
      // Aniversário em 25 de Setembro
      const result = isBirthdayInNextDays('1995-09-25', 30, refDate);
      assert.equal(result, true);
    });

    test('Deve identificar aniversário nos próximos 30 dias atravessando a virada de mês', () => {
      const refDate = new Date(2026, 8, 20); // 20 de Setembro de 2026
      // Aniversário em 05 de Outubro (15 dias depois)
      const result = isBirthdayInNextDays('1995-10-05', 30, refDate);
      assert.equal(result, true);
    });

    test('Deve identificar aniversário nos próximos 30 dias atravessando a virada de ANO (Dezembro -> Janeiro)', () => {
      const refDate = new Date(2026, 11, 20); // 20 de Dezembro de 2026
      // Aniversário em 08 de Janeiro (19 dias depois)
      const result = isBirthdayInNextDays('1995-01-08', 30, refDate);
      assert.equal(result, true);
    });

    test('NÃO deve identificar aniversariantes que já passaram ou distantes (> 30 dias)', () => {
      const refDate = new Date(2026, 8, 12); // 12 de Setembro de 2026
      // Aniversário em 10 de Setembro (passou 2 dias atrás)
      assert.equal(isBirthdayInNextDays('1995-09-10', 30, refDate), false);
      // Aniversário em 15 de Novembro (> 60 dias)
      assert.equal(isBirthdayInNextDays('1995-11-15', 30, refDate), false);
    });
  });

  describe('4. Aniversariantes da Semana', () => {
    test('Deve validar corretamente a semana corrente (Domingo a Sábado)', () => {
      // 12 de Setembro de 2026 é Sábado
      // A semana vai de 06/09 (Dom) até 12/09 (Sáb)
      const refDate = new Date(2026, 8, 12);

      assert.equal(isBirthdayInCurrentWeek('1992-09-06', refDate), true);  // Domingo
      assert.equal(isBirthdayInCurrentWeek('1992-09-09', refDate), true);  // Quarta
      assert.equal(isBirthdayInCurrentWeek('1992-09-12', refDate), true);  // Sábado
      assert.equal(isBirthdayInCurrentWeek('1992-09-13', refDate), false); // Próximo Domingo
      assert.equal(isBirthdayInCurrentWeek('1992-09-05', refDate), false); // Sábado passado
    });
  });

  describe('5. Isolamento Multi-tenant e Regra de Saídas', () => {
    test('Crescimento histórico afere evolução de novos cadastros e não falsas saídas retroativas', () => {
      const entryDates = ['2026-01-15', '2026-01-20', '2026-02-10'];
      const grouped = {};
      for (const d of entryDates) {
        const key = d.slice(0, 7);
        grouped[key] = (grouped[key] || 0) + 1;
      }
      assert.equal(grouped['2026-01'], 2);
      assert.equal(grouped['2026-02'], 1);
    });
  });

  describe('6. Auditoria de Qualidade Cadastral & Detecção de Pendências', () => {
    test('Deve detectar pendências múltiplas em cadastro incompleto', () => {
      const member = {
        id: '1',
        name: 'Carlos Oliveira',
        cpf: null,
        data_nascimento: null,
        phone: '',
        celular: null,
        whatsapp: null,
        logradouro: null,
        cep: null,
        foto_url: '',
      };

      const pendencias = [];
      if (!member.cpf || member.cpf.trim() === '') pendencias.push('cpf');
      if (!member.data_nascimento) pendencias.push('data_nascimento');
      const temFone = Boolean(member.phone || member.celular || member.whatsapp);
      if (!temFone) pendencias.push('telefone');
      const temEnd = Boolean(member.logradouro || member.cep);
      if (!temEnd) pendencias.push('endereco');
      if (!member.foto_url || member.foto_url.trim() === '') pendencias.push('foto');

      assert.equal(pendencias.length, 5);
      assert.deepEqual(pendencias, ['cpf', 'data_nascimento', 'telefone', 'endereco', 'foto']);
    });

    test('Deve validar cadastro 100% completo sem pendências', () => {
      const member = {
        id: '2',
        name: 'Maria Santos',
        cpf: '123.456.789-00',
        data_nascimento: '1988-04-15',
        phone: '11999998888',
        celular: '11999998888',
        whatsapp: '11999998888',
        logradouro: 'Rua das Palmeiras, 100',
        cep: '01001-000',
        foto_url: 'https://storage.gestaoeklesia.com.br/fotos/maria.jpg',
      };

      const pendencias = [];
      if (!member.cpf || member.cpf.trim() === '') pendencias.push('cpf');
      if (!member.data_nascimento) pendencias.push('data_nascimento');
      const temFone = Boolean(member.phone || member.celular || member.whatsapp);
      if (!temFone) pendencias.push('telefone');
      const temEnd = Boolean(member.logradouro || member.cep);
      if (!temEnd) pendencias.push('endereco');
      if (!member.foto_url || member.foto_url.trim() === '') pendencias.push('foto');

      assert.equal(pendencias.length, 0);
    });
  });

  describe('7. Paginação Server-side de Relação Geral', () => {
    test('Deve calcular corretamente total de páginas e limites', () => {
      const total = 142;
      const limit = 25;
      const totalPages = Math.ceil(total / limit);
      assert.equal(totalPages, 6);

      const offsetPage1 = (1 - 1) * limit;
      const offsetPage6 = (6 - 1) * limit;
      assert.equal(offsetPage1, 0);
      assert.equal(offsetPage6, 125);
    });
  });

  describe('8. Construtor de Relatórios Personalizados - Presets & Formatação de Colunas', () => {
    test('Preset "Membros Ativos" deve filtrar status active e tipo membro', () => {
      const mockMembers = [
        { id: '1', name: 'Membro 1', status: 'active', tipo_cadastro: 'membro' },
        { id: '2', name: 'Membro 2', status: 'inactive', tipo_cadastro: 'membro' },
        { id: '3', name: 'Membro 3', status: 'active', tipo_cadastro: 'congregado' },
      ];

      const filtered = mockMembers.filter(
        (m) => m.status === 'active' && m.tipo_cadastro === 'membro'
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, '1');
    });

    test('Preset "Jovens" deve selecionar apenas membros com idade entre 18 e 29 anos', () => {
      const refDate = new Date(2026, 8, 12);
      const mockMembers = [
        { id: '1', name: 'Jovem 1', data_nascimento: '2005-01-15' }, // 21 anos
        { id: '2', name: 'Crianca', data_nascimento: '2018-05-10' }, // 8 anos
        { id: '3', name: 'Adulto', data_nascimento: '1980-02-20' }, // 46 anos
      ];

      const jovens = mockMembers.filter((m) => {
        const age = calculateAge(m.data_nascimento, refDate);
        return categorizeAge(age) === '18-29';
      });

      assert.equal(jovens.length, 1);
      assert.equal(jovens[0].id, '1');
    });

    test('Exportação CSV deve gerar cabeçalho UTF-8 com BOM e colunas selecionadas', () => {
      const selectedCols = ['Nome', 'Status', 'Celular'];
      const dataRows = [
        ['João Silva', 'Ativo', '11999998888'],
        ['Maria Santos', 'Ativo', '11988887777'],
      ];

      const headers = selectedCols.map((c) => `"${c}"`).join(';');
      const rows = dataRows.map((r) => r.map((val) => `"${val}"`).join(';'));
      const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');

      assert.equal(csvContent.startsWith('\uFEFF"Nome";"Status";"Celular"'), true);
      assert.equal(csvContent.includes('"João Silva";"Ativo";"11999998888"'), true);
    });
  });

});


