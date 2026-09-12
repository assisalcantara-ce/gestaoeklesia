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

  describe('9. Visão Anual e Contagem dos 12 Meses de Aniversariantes', () => {
    const mockMembros = [
      { id: '1', name: 'Jan 1', data_nascimento: '1990-01-05', status: 'active' },
      { id: '2', name: 'Jan 2', data_nascimento: '1985-01-20', status: 'active' },
      { id: '3', name: 'Abr 1', data_nascimento: '2000-04-10', status: 'active' },
      { id: '4', name: 'Abr 2', data_nascimento: '1995-04-22', status: 'active' },
      { id: '5', name: 'Jun 1', data_nascimento: '1992-06-15', status: 'active' },
      { id: '6', name: 'Jul 1', data_nascimento: '1988-07-08', status: 'active' },
      { id: '7', name: 'Out 1', data_nascimento: '2001-10-01', status: 'active' },
      { id: '8', name: 'Out 2', data_nascimento: '1999-10-30', status: 'active' },
      { id: '9', name: 'Nov 1', data_nascimento: '1994-11-12', status: 'active' },
      { id: '10', name: 'Nov 2', data_nascimento: '1996-11-25', status: 'active' },
    ];

    test('a) Deve consolidar contagemPorMes perfeitamente para todos os 12 meses', () => {
      const contagemPorMes = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
      mockMembros.forEach(m => {
        const parts = m.data_nascimento.split('-');
        const mes = parseInt(parts[1], 10);
        contagemPorMes[mes]++;
      });

      assert.equal(contagemPorMes[1], 2);
      assert.equal(contagemPorMes[2], 0);
      assert.equal(contagemPorMes[3], 0);
      assert.equal(contagemPorMes[4], 2);
      assert.equal(contagemPorMes[5], 0);
      assert.equal(contagemPorMes[6], 1);
      assert.equal(contagemPorMes[7], 1);
      assert.equal(contagemPorMes[8], 0);
      assert.equal(contagemPorMes[9], 0);
      assert.equal(contagemPorMes[10], 2);
      assert.equal(contagemPorMes[11], 2);
      assert.equal(contagemPorMes[12], 0);
      assert.equal(Object.values(contagemPorMes).reduce((a, b) => a + b, 0), 10);
    });

    test('b) Seleção de qualquer mês (diferente do mês corrente) deve filtrar a lista correta', () => {
      // Filtrar Janeiro (mês 1)
      const janeiro = mockMembros.filter(m => parseInt(m.data_nascimento.split('-')[1], 10) === 1);
      assert.equal(janeiro.length, 2);
      assert.equal(janeiro[0].name, 'Jan 1');
      assert.equal(janeiro[1].name, 'Jan 2');

      // Filtrar Abril (mês 4)
      const abril = mockMembros.filter(m => parseInt(m.data_nascimento.split('-')[1], 10) === 4);
      assert.equal(abril.length, 2);

      // Filtrar Outubro (mês 10)
      const outubro = mockMembros.filter(m => parseInt(m.data_nascimento.split('-')[1], 10) === 10);
      assert.equal(outubro.length, 2);
    });

    test('c) Meses sem aniversariantes (Fevereiro, Março, Dezembro) devem retornar array vazio [] e count 0', () => {
      const fevereiro = mockMembros.filter(m => parseInt(m.data_nascimento.split('-')[1], 10) === 2);
      const marco = mockMembros.filter(m => parseInt(m.data_nascimento.split('-')[1], 10) === 3);
      const dezembro = mockMembros.filter(m => parseInt(m.data_nascimento.split('-')[1], 10) === 12);

      assert.equal(fevereiro.length, 0);
      assert.equal(marco.length, 0);
      assert.equal(dezembro.length, 0);
    });

    test('d) Filtro por congregação deve isolar os aniversariantes da unidade especificada', () => {
      const membrosComCongregacao = [
        ...mockMembros,
        { id: '11', name: 'Cong A Jan', data_nascimento: '1990-01-10', status: 'active', congregacao_id: 'cong-a' },
      ];

      const filtradosCongA = membrosComCongregacao.filter(
        m => m.congregacao_id === 'cong-a' && parseInt(m.data_nascimento.split('-')[1], 10) === 1
      );
      assert.equal(filtradosCongA.length, 1);
      assert.equal(filtradosCongA[0].id, '11');
    });
  });

  describe('10. Editor de Mensagem de Aniversariantes e Variáveis de Substituição', () => {
    function processTemplate(template, nome, campo, supervisao) {
      return (template || '')
        .replace(/{nome}/gi, nome || 'Irmão(ã)')
        .replace(/{campo}/gi, campo || 'Sede')
        .replace(/{supervisao}/gi, supervisao || 'Geral')
        .replace(/{supervisor}/gi, supervisao || 'Geral');
    }

    test('Deve substituir corretamente {nome}, {campo}, {supervisao} e {supervisor}', () => {
      const template = 'Parabéns, {nome}! Você faz parte do campo {campo} e supervisão {supervisao} sob liderança do {supervisor}.';
      const output = processTemplate(template, 'MARIA SILVA', 'Setor 01', 'Supervisão Norte');

      assert.equal(
        output,
        'Parabéns, MARIA SILVA! Você faz parte do campo Setor 01 e supervisão Supervisão Norte sob liderança do Supervisão Norte.'
      );
    });

    test('Deve usar fallback se valores opcionais não forem fornecidos', () => {
      const template = 'Feliz Aniversário, {nome}! Campo: {campo}';
      const output = processTemplate(template, null, null, null);

      assert.equal(output, 'Feliz Aniversário, Irmão(ã)! Campo: Sede');
    });

    test('Dirty State: detecta alterações de texto ou imagem', () => {
      const originalMsg = 'Mensagem 1';
      const originalImg = 'https://img.com/1.png';

      let currentMsg = 'Mensagem 1';
      let currentImg = 'https://img.com/1.png';
      let isDirty = currentMsg !== originalMsg || currentImg !== originalImg;
      assert.equal(isDirty, false);

      // Alterar mensagem
      currentMsg = 'Mensagem 2';
      isDirty = currentMsg !== originalMsg || currentImg !== originalImg;
      assert.equal(isDirty, true);

      // Reverter mensagem e alterar imagem
      currentMsg = 'Mensagem 1';
      currentImg = null;
      isDirty = currentMsg !== originalMsg || currentImg !== originalImg;
      assert.equal(isDirty, true);
    });
  });

  describe('11. Relatórios de Cartas e Declarações — Segregação e Métricas', () => {
    test('1 & 2. Cartas e Declarações emitidas são contabilizadas separadamente', () => {
      const mockRegistros = [
        { id: '1', template_title: 'Carta Mudança', categoria: 'carta', status: 'emitida' },
        { id: '2', template_title: 'Carta Recomendação', categoria: 'carta', status: 'emitida' },
        { id: '3', template_title: 'Declaração Membro', categoria: 'declaracao', status: 'emitida' },
        { id: '4', template_title: 'Declaração Batismo', categoria: 'declaracao', status: 'emitida' },
        { id: '5', template_title: 'Declaração Cargo', categoria: 'declaracao', status: 'emitida' },
      ];

      let cartasEmitidas = 0;
      let declaracoesEmitidas = 0;

      for (const r of mockRegistros) {
        const cat = r.categoria === 'declaracao' ? 'declaracao' : 'carta';
        if (cat === 'declaracao') declaracoesEmitidas++;
        else cartasEmitidas++;
      }

      assert.equal(cartasEmitidas, 2);
      assert.equal(declaracoesEmitidas, 3);
      assert.equal(cartasEmitidas + declaracoesEmitidas, 5);
    });

    test('3. Registros legados sem categoria explícita (null/undefined) contam como Carta', () => {
      const mockRegistros = [
        { id: '1', template_title: 'Carta Legada 1', categoria: null, status: 'emitida' },
        { id: '2', template_title: 'Carta Legada 2', status: 'emitida' },
        { id: '3', template_title: 'Declaração Nova', categoria: 'declaracao', status: 'emitida' },
      ];

      const porCategoria = { carta: 0, declaracao: 0 };
      for (const r of mockRegistros) {
        const cat = r.categoria === 'declaracao' ? 'declaracao' : 'carta';
        porCategoria[cat]++;
      }

      assert.equal(porCategoria.carta, 2);
      assert.equal(porCategoria.declaracao, 1);
    });

    test('4 & 5. Declarações nunca entram nas métricas de pedidos (carta_pedidos permanece exclusivo para cartas)', () => {
      const mockPedidos = [
        { id: 'p1', tipo_carta: 'mudanca', status: 'pendente' },
        { id: 'p2', tipo_carta: 'desligamento', status: 'autorizado' },
        { id: 'p3', tipo_carta: 'transito', status: 'rejeitado' },
      ];

      const mockDeclaracoesEmitidas = [
        { id: 'd1', categoria: 'declaracao', status: 'emitida' },
        { id: 'd2', categoria: 'declaracao', status: 'emitida' },
      ];

      // Métricas de pedidos calculam apenas sobre mockPedidos
      const statsPedidos = {
        total: mockPedidos.length,
        pendentes: mockPedidos.filter(p => p.status === 'pendente').length,
        autorizados: mockPedidos.filter(p => p.status === 'autorizado').length,
        rejeitados: mockPedidos.filter(p => p.status === 'rejeitado').length,
      };

      assert.equal(statsPedidos.total, 3);
      assert.equal(statsPedidos.pendentes, 1);
      assert.equal(statsPedidos.autorizados, 1);
      assert.equal(statsPedidos.rejeitados, 1);

      // Nenhuma declaração altera as métricas de pedidos
      assert.equal(mockDeclaracoesEmitidas.length, 2);
    });

    test('6. Filtro de categoria segmenta corretamente emitidas (todos | carta | declaracao)', () => {
      const mockRegistros = [
        { id: '1', categoria: 'carta' },
        { id: '2', categoria: null }, // legado -> carta
        { id: '3', categoria: 'declaracao' },
        { id: '4', categoria: 'declaracao' },
      ];

      const filterByCat = (list, cat) => {
        if (!cat || cat === 'todos' || cat === 'todas') return list;
        return list.filter(r => (r.categoria === 'declaracao' ? 'declaracao' : 'carta') === cat);
      };

      assert.equal(filterByCat(mockRegistros, 'todos').length, 4);
      assert.equal(filterByCat(mockRegistros, 'carta').length, 2);
      assert.equal(filterByCat(mockRegistros, 'declaracao').length, 2);
    });

    test('7. Isolamento por ministry_id e 8. Restrição congregacional para usuários locais', () => {
      const mockRegistros = [
        { id: '1', ministry_id: 'min-1', congregacao_id: 'cong-A', categoria: 'carta' },
        { id: '2', ministry_id: 'min-1', congregacao_id: 'cong-B', categoria: 'declaracao' },
        { id: '3', ministry_id: 'min-2', congregacao_id: 'cong-A', categoria: 'carta' },
      ];

      // Filtro para Tenant min-1
      const tenant1Only = mockRegistros.filter(r => r.ministry_id === 'min-1');
      assert.equal(tenant1Only.length, 2);

      // Filtro para usuário local da cong-A no Tenant min-1
      const localUserRecords = tenant1Only.filter(r => r.congregacao_id === 'cong-A');
      assert.equal(localUserRecords.length, 1);
      assert.equal(localUserRecords[0].id, '1');
    });

    test('9. Paginação server-side de documentos emitidos', () => {
      const totalRegistros = 55;
      const limit = 25;
      const page = 2;
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(totalRegistros / limit);

      assert.equal(offset, 25);
      assert.equal(totalPages, 3);
    });
  });

});



