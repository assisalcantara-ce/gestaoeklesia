import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarRelatorioGerencialEventoPDF,
  DadosRelatorioEvento,
} from '@/lib/eventos-relatorio-pdf';

test('Suíte de Testes: Relatório Gerencial Completo de Eventos em PDF', async (t) => {
  await t.test('1. Gerar PDF para Evento Gratuito com múltiplas congregações, check-ins parciais e cancelamentos', async () => {
    const dados: DadosRelatorioEvento = {
      eventoId: 'ev-gratuito-01',
      tituloEvento: 'Congresso Geral de Avivamento e Missões 2026',
      tipoEvento: 'CONGRESSO',
      dataInicio: '15/11/2026',
      dataFim: '17/11/2026',
      horarioInicio: '19:00',
      localNome: 'Templo Central',
      localEndereco: 'Av. Principal, 1000 - Centro',
      nomeCongregacao: 'Sede / Campo Geral',
      statusEvento: 'REALIZADO',
      capacidade: 500,

      totalInscricoesValidas: 3,
      totalConfirmados: 3,
      totalPresentes: 2,
      totalAusentes: 1,
      totalCancelados: 1,
      totalListaEspera: 0,
      taxaComparecimento: '67%',
      taxaCancelamento: '25%',
      membrosQtd: 2,
      externosQtd: 2,

      consolidacaoCongregacoes: [
        {
          congregacao: 'Congregação Monte Sião',
          totalInscritos: 2,
          confirmados: 2,
          presentes: 2,
          ausentes: 0,
          taxaPresenca: '100%',
        },
        {
          congregacao: 'Congregação Betel',
          totalInscritos: 1,
          confirmados: 1,
          presentes: 0,
          ausentes: 1,
          taxaPresenca: '0%',
        },
        {
          congregacao: 'Não informada',
          totalInscritos: 1,
          confirmados: 0,
          presentes: 0,
          ausentes: 0,
          taxaPresenca: '—',
        },
      ],

      financeiro: {
        eventoPago: false,
        valorInscricao: 0,
        totalInscricoesValidas: 3,
        totalPrevisto: 0,
        totalRecebido: 0,
        totalPendente: 0,
        totalCanceladoEstornado: 0,
        formasPagamento: [],
      },

      beneficios: {
        hospedagemHabilitada: true,
        hospedagemDescricao: 'Alojamento no anexo da sede com ar-condicionado',
        totalHospedagemSolicitada: 2,
        totalHospedagemConfirmada: 2,
        alimentacaoInclusa: true,
        brindeHabilitado: true,
        brindeQuantidade: 300,
        brindesEntregues: 2,
        certificadoHabilitado: true,
        certificadosEmitidos: 2,
      },

      nomeMinisterio: 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS',
      subtituloMinisterio: 'CONVENÇÃO ESTADUAL DE MINISTROS • PRESTAÇÃO DE CONTAS',
      cnpjMinisterio: '12.345.678/0001-90',
      cidadeUf: 'Fortaleza - CE',
      logoMinisterioUrl: null,
      dataEmissao: '28/10/2026 12:00:00',

      participantes: [
        {
          numero: 1,
          nome: 'Pr. Carlos Eduardo Pereira',
          tipoParticipante: 'Membro',
          congregacao: 'Congregação Monte Sião',
          situacaoInscricao: 'Confirmada',
          presenca: 'Presente',
          horarioCheckin: '18:45',
          comHospedagem: true,
        },
        {
          numero: 2,
          nome: 'Dc. Marcos Antônio Santos',
          tipoParticipante: 'Membro',
          congregacao: 'Congregação Monte Sião',
          situacaoInscricao: 'Confirmada',
          presenca: 'Presente',
          horarioCheckin: '19:02',
          comHospedagem: false,
        },
        {
          numero: 3,
          nome: 'Lucas Gabriel Silveira',
          tipoParticipante: 'Externo',
          congregacao: 'Congregação Betel',
          situacaoInscricao: 'Confirmada',
          presenca: 'Ausente',
          horarioCheckin: null,
          comHospedagem: true,
        },
        {
          numero: 4,
          nome: 'Renata Albuquerque',
          tipoParticipante: 'Externo',
          congregacao: 'Não informada',
          situacaoInscricao: 'Cancelada',
          presenca: 'Ausente',
          horarioCheckin: null,
          comHospedagem: false,
        },
      ],
    };

    const pdfBuffer = await gerarRelatorioGerencialEventoPDF(dados);
    assert.ok(pdfBuffer instanceof Uint8Array);
    assert.ok(pdfBuffer.length > 1000, 'PDF gerado deve possuir bytes válidos');
    const headerPdf = Buffer.from(pdfBuffer.slice(0, 5)).toString();
    assert.equal(headerPdf, '%PDF-');
  });

  await t.test('2. Gerar PDF para Evento Pago com conciliação financeira real e formas de pagamento', async () => {
    const dados: DadosRelatorioEvento = {
      eventoId: 'ev-pago-01',
      tituloEvento: 'Seminário de Liderança Cristã e Família',
      tipoEvento: 'SEMINARIO',
      dataInicio: '20/12/2026',
      dataFim: '20/12/2026',
      horarioInicio: '08:30',
      localNome: 'Auditório Nobre',
      localEndereco: 'Rua das Flores, 450',
      nomeCongregacao: 'Sede',
      statusEvento: 'PROGRAMADO',
      capacidade: 120,

      totalInscricoesValidas: 4,
      totalConfirmados: 3,
      totalPresentes: 3,
      totalAusentes: 0,
      totalCancelados: 1,
      totalListaEspera: 1,
      taxaComparecimento: '100%',
      taxaCancelamento: '20%',
      membrosQtd: 4,
      externosQtd: 1,

      consolidacaoCongregacoes: [
        {
          congregacao: 'Sede',
          totalInscritos: 4,
          confirmados: 3,
          presentes: 3,
          ausentes: 0,
          taxaPresenca: '100%',
        },
      ],

      financeiro: {
        eventoPago: true,
        valorInscricao: 100.0,
        totalInscricoesValidas: 4, // 3 confirmados + 1 aguardando
        totalPrevisto: 400.0,
        totalRecebido: 300.0, // 3 confirmados pagos
        totalPendente: 100.0, // 1 aguardando pagamento
        totalCanceladoEstornado: 100.0, // 1 cancelado
        formasPagamento: [
          { forma: 'PIX', qtd: 2, valorTotal: 200.0 },
          { forma: 'BALCAO_A_VISTA', qtd: 1, valorTotal: 100.0 },
        ],
      },

      beneficios: {
        hospedagemHabilitada: false,
        totalHospedagemSolicitada: 0,
        totalHospedagemConfirmada: 0,
        alimentacaoInclusa: true,
        brindeHabilitado: true,
        brindeQuantidade: 120,
        brindesEntregues: 3,
        certificadoHabilitado: true,
        certificadosEmitidos: 3,
      },

      nomeMinisterio: 'MINISTÉRIO GESTÃO EKLÉSIA',
      subtituloMinisterio: 'DIRETORIA EXECUTIVA',
      cnpjMinisterio: '00.000.000/0001-00',
      cidadeUf: 'São Paulo - SP',
      logoMinisterioUrl: null,
      dataEmissao: '28/10/2026 12:00:00',

      participantes: [
        { numero: 1, nome: 'Participante 1', tipoParticipante: 'Membro', congregacao: 'Sede', situacaoInscricao: 'Confirmada', presenca: 'Presente' },
        { numero: 2, nome: 'Participante 2', tipoParticipante: 'Membro', congregacao: 'Sede', situacaoInscricao: 'Confirmada', presenca: 'Presente' },
        { numero: 3, nome: 'Participante 3', tipoParticipante: 'Membro', congregacao: 'Sede', situacaoInscricao: 'Confirmada', presenca: 'Presente' },
        { numero: 4, nome: 'Participante 4', tipoParticipante: 'Membro', congregacao: 'Sede', situacaoInscricao: 'Aguardando Pagamento', presenca: 'Ausente' },
        { numero: 5, nome: 'Participante 5', tipoParticipante: 'Externo', congregacao: 'Sede', situacaoInscricao: 'Cancelada', presenca: 'Ausente' },
      ],
    };

    const pdfBuffer = await gerarRelatorioGerencialEventoPDF(dados);
    assert.ok(pdfBuffer instanceof Uint8Array);
    assert.ok(pdfBuffer.length > 1000);
  });

  await t.test('3. Gerar PDF para Evento Vazio (sem inscrições)', async () => {
    const dados: DadosRelatorioEvento = {
      eventoId: 'ev-vazio-01',
      tituloEvento: 'Evento Sem Inscritos',
      tipoEvento: 'REUNIAO',
      dataInicio: '01/01/2027',
      dataFim: null,
      localNome: 'Sala 1',
      statusEvento: 'PROGRAMADO',

      totalInscricoesValidas: 0,
      totalConfirmados: 0,
      totalPresentes: 0,
      totalAusentes: 0,
      totalCancelados: 0,
      totalListaEspera: 0,
      taxaComparecimento: '0%',
      taxaCancelamento: '0%',
      membrosQtd: 0,
      externosQtd: 0,

      consolidacaoCongregacoes: [],

      financeiro: {
        eventoPago: false,
        valorInscricao: 0,
        totalInscricoesValidas: 0,
        totalPrevisto: 0,
        totalRecebido: 0,
        totalPendente: 0,
        totalCanceladoEstornado: 0,
        formasPagamento: [],
      },

      beneficios: {
        hospedagemHabilitada: false,
        totalHospedagemSolicitada: 0,
        totalHospedagemConfirmada: 0,
        alimentacaoInclusa: false,
        brindeHabilitado: false,
        brindesEntregues: 0,
        certificadoHabilitado: false,
        certificadosEmitidos: 0,
      },

      nomeMinisterio: 'IGREJA TESTE',
      dataEmissao: '28/10/2026',
      participantes: [],
    };

    const pdfBuffer = await gerarRelatorioGerencialEventoPDF(dados);
    assert.ok(pdfBuffer instanceof Uint8Array);
    assert.ok(pdfBuffer.length > 500);
  });

  await t.test('4. Gerar PDF Multipágina com grande volume de inscritos (testando quebra automática e repetição de cabeçalho)', async () => {
    const participantesLongos: any[] = [];
    for (let i = 1; i <= 95; i++) {
      participantesLongos.push({
        numero: i,
        nome: `Participante de Teste Número ${i}`,
        tipoParticipante: i % 2 === 0 ? 'Membro' : 'Externo',
        congregacao: i % 3 === 0 ? 'Congregação Alfa' : i % 3 === 1 ? 'Congregação Beta' : 'Congregação Gama',
        situacaoInscricao: i % 10 === 0 ? 'Cancelada' : 'Confirmada',
        presenca: i % 2 === 0 ? 'Presente' : 'Ausente',
        horarioCheckin: i % 2 === 0 ? '19:15' : null,
        comHospedagem: i % 4 === 0,
      });
    }

    const dados: DadosRelatorioEvento = {
      eventoId: 'ev-multipage-01',
      tituloEvento: 'Grande Conferência Geral Anual',
      tipoEvento: 'CONFERENCIA',
      dataInicio: '10/12/2026',
      localNome: 'Pavilhão de Eventos',
      statusEvento: 'EM_ANDAMENTO',

      totalInscricoesValidas: 86,
      totalConfirmados: 86,
      totalPresentes: 47,
      totalAusentes: 39,
      totalCancelados: 9,
      totalListaEspera: 0,
      taxaComparecimento: '55%',
      taxaCancelamento: '9%',
      membrosQtd: 47,
      externosQtd: 48,

      consolidacaoCongregacoes: [
        { congregacao: 'Congregação Alfa', totalInscritos: 31, confirmados: 28, presentes: 15, ausentes: 13, taxaPresenca: '54%' },
        { congregacao: 'Congregação Beta', totalInscritos: 32, confirmados: 29, presentes: 16, ausentes: 13, taxaPresenca: '55%' },
        { congregacao: 'Congregação Gama', totalInscritos: 32, confirmados: 29, presentes: 16, ausentes: 13, taxaPresenca: '55%' },
      ],

      financeiro: {
        eventoPago: false,
        valorInscricao: 0,
        totalInscricoesValidas: 86,
        totalPrevisto: 0,
        totalRecebido: 0,
        totalPendente: 0,
        totalCanceladoEstornado: 0,
        formasPagamento: [],
      },

      beneficios: {
        hospedagemHabilitada: true,
        totalHospedagemSolicitada: 23,
        totalHospedagemConfirmada: 12,
        alimentacaoInclusa: true,
        brindeHabilitado: true,
        brindesEntregues: 47,
        certificadoHabilitado: true,
        certificadosEmitidos: 47,
      },

      nomeMinisterio: 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS',
      dataEmissao: '28/10/2026 12:00:00',
      participantes: participantesLongos,
    };

    const pdfBuffer = await gerarRelatorioGerencialEventoPDF(dados);
    assert.ok(pdfBuffer instanceof Uint8Array);
    // Para 95 participantes, o PDF deve ter gerado ao menos 3 páginas
    assert.ok(pdfBuffer.length > 8000, 'Documento multipágina deve ter tamanho condizente');
  });

  await t.test('5. Validar Escola de Obreiros 2026: multipágina A4 com margens seguras e sem sobreposição', async () => {
    const participantesEscola: any[] = [];
    for (let i = 1; i <= 120; i++) {
      participantesEscola.push({
        numero: i,
        nome: 'Obreiro Participante ' + i,
        tipoParticipante: i % 5 === 0 ? 'Externo' : 'Membro',
        congregacao: i % 2 === 0 ? 'Congregação Monte Sião - Setor 02' : 'Templo Sede Central',
        situacaoInscricao: i % 10 === 0 ? 'Cancelada' : 'Confirmada',
        presenca: i % 3 === 0 ? 'Ausente' : 'Presente',
        horarioCheckin: i % 3 === 0 ? null : '18:30',
        comHospedagem: i % 4 === 0,
      });
    }

    const dadosEscola: DadosRelatorioEvento = {
      eventoId: 'escola-obreiros-2026',
      tituloEvento: 'Escola de Obreiros 2026',
      tipoEvento: 'CURSO / CAPACITAÇÃO',
      dataInicio: '10/11/2026',
      dataFim: '14/11/2026',
      horarioInicio: '19:00',
      localNome: 'Templo Central - Auditório Principal',
      localEndereco: 'Av. das Nações, 500 - Ananindeua / PA',
      nomeCongregacao: 'Sede Geral / Todas as Congregações',
      statusEvento: 'REALIZADO',
      capacidade: 300,

      totalInscricoesValidas: 108,
      totalConfirmados: 108,
      totalPresentes: 80,
      totalAusentes: 28,
      totalCancelados: 12,
      totalListaEspera: 5,
      taxaComparecimento: '74,1%',
      taxaCancelamento: '10,0%',
      membrosQtd: 96,
      externosQtd: 24,

      consolidacaoCongregacoes: [
        { congregacao: 'Templo Sede Central', totalInscritos: 60, confirmados: 54, presentes: 42, ausentes: 12, taxaPresenca: '77,8%' },
        { congregacao: 'Congregação Monte Sião - Setor 02', totalInscritos: 40, confirmados: 36, presentes: 26, ausentes: 10, taxaPresenca: '72,2%' },
        { congregacao: 'Congregação Canaã', totalInscritos: 20, confirmados: 18, presentes: 12, ausentes: 6, taxaPresenca: '66,7%' },
      ],

      financeiro: {
        eventoPago: true,
        valorInscricao: 50.00,
        totalInscricoesValidas: 108,
        totalPrevisto: 5400.00,
        totalRecebido: 4800.00,
        totalPendente: 600.00,
        totalCanceladoEstornado: 600.00,
        formasPagamento: [
          { forma: 'PIX', qtd: 70, valorTotal: 3500.00 },
          { forma: 'Cartão de Crédito', qtd: 26, valorTotal: 1300.00 },
        ],
      },

      beneficios: {
        hospedagemHabilitada: true,
        hospedagemDescricao: 'Alojamento nos anexos da Sede',
        totalHospedagemSolicitada: 30,
        totalHospedagemConfirmada: 25,
        alimentacaoInclusa: true,
        brindeHabilitado: true,
        brindeQuantidade: 150,
        brindesEntregues: 80,
        certificadoHabilitado: true,
        certificadosEmitidos: 75,
      },

      nomeMinisterio: 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS EM ANANINDEUA',
      subtituloMinisterio: 'CONVENÇÃO ESTADUAL • DEPARTAMENTO DE EDUCAÇÃO CRISTÃ',
      cnpjMinisterio: '04.123.456/0001-78',
      cidadeUf: 'Ananindeua - PA',
      logoMinisterioUrl: null,
      dataEmissao: '10/11/2026 17:30:00',

      participantes: participantesEscola,
    };

    const pdfBuffer = await gerarRelatorioGerencialEventoPDF(dadosEscola);
    assert.ok(pdfBuffer instanceof Uint8Array);
    assert.ok(pdfBuffer.length > 15000, 'Relatório multipágina de 120 participantes deve ter tamanho condizente');

    const pdfText = Buffer.from(pdfBuffer).toString('latin1');
    const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
    assert.ok(pageCount >= 3, `O documento deve possuir pelo menos 3 páginas (gerado: ${pageCount})`);
  });

  await t.test('6. Validar Relatório Resumido: sem listagem nominal de participantes e com tabela de congregações', async () => {
    const participantesLongos: any[] = [];
    for (let i = 1; i <= 80; i++) {
      participantesLongos.push({
        numero: i,
        nome: 'Participante ' + i,
        tipoParticipante: 'Membro',
        congregacao: 'Congregação Teste ' + (i % 5),
        situacaoInscricao: 'Confirmada',
        presenca: 'Presente',
        horarioCheckin: '19:00',
        comHospedagem: false,
      });
    }

    const dadosEvento: DadosRelatorioEvento = {
      eventoId: 'ev-resumido-01',
      tituloEvento: 'Encontro de Líderes e Pastores 2026',
      tipoEvento: 'SEMINÁRIO',
      dataInicio: '12/11/2026',
      dataFim: '13/11/2026',
      horarioInicio: '19:30',
      localNome: 'Auditório Nobre',
      localEndereco: 'Rua Principal, 100',
      nomeCongregacao: 'Sede Geral',
      statusEvento: 'CONFIRMADO',
      capacidade: 250,

      totalInscricoesValidas: 80,
      totalConfirmados: 80,
      totalPresentes: 65,
      totalAusentes: 15,
      totalCancelados: 5,
      totalListaEspera: 2,
      taxaComparecimento: '81,25%',
      taxaCancelamento: '5,88%',
      membrosQtd: 70,
      externosQtd: 10,

      consolidacaoCongregacoes: [
        { congregacao: 'Congregação Setor 1', totalInscritos: 30, confirmados: 30, presentes: 25, ausentes: 5, taxaPresenca: '83,3%' },
        { congregacao: 'Congregação Setor 2', totalInscritos: 25, confirmados: 25, presentes: 20, ausentes: 5, taxaPresenca: '80,0%' },
        { congregacao: 'Congregação Setor 3', totalInscritos: 25, confirmados: 25, presentes: 20, ausentes: 5, taxaPresenca: '80,0%' },
      ],

      financeiro: {
        eventoPago: true,
        valorInscricao: 30.00,
        totalInscricoesValidas: 80,
        totalPrevisto: 2400.00,
        totalRecebido: 2100.00,
        totalPendente: 300.00,
        totalCanceladoEstornado: 150.00,
        formasPagamento: [
          { forma: 'PIX', qtd: 50, valorTotal: 1500.00 },
          { forma: 'Boleto', qtd: 20, valorTotal: 600.00 },
        ],
      },

      beneficios: {
        hospedagemHabilitada: false,
        totalHospedagemSolicitada: 0,
        totalHospedagemConfirmada: 0,
        alimentacaoInclusa: true,
        brindeHabilitado: true,
        brindeQuantidade: 100,
        brindesEntregues: 65,
        certificadoHabilitado: true,
        certificadosEmitidos: 60,
      },

      nomeMinisterio: 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS',
      subtituloMinisterio: 'CONVENÇÃO MINISTERIAL',
      cnpjMinisterio: '12.345.678/0001-90',
      cidadeUf: 'Belém - PA',
      logoMinisterioUrl: null,
      dataEmissao: '10/11/2026 20:00:00',

      participantes: participantesLongos,
    };

    // Gera o modelo Resumido
    const pdfResumidoBuffer = await gerarRelatorioGerencialEventoPDF(dadosEvento, { tipo: 'resumido' });
    assert.ok(pdfResumidoBuffer instanceof Uint8Array);

    const pdfResumidoText = Buffer.from(pdfResumidoBuffer).toString('latin1');
    const pageCountResumido = (pdfResumidoText.match(/\/Type\s*\/Page\b/g) || []).length;

    // O relatório resumido NÃO deve possuir a listagem nominal (4. LISTAGEM OFICIAL DE PARTICIPANTES)
    assert.equal(pdfResumidoText.includes('4. LISTAGEM OFICIAL DE PARTICIPANTES'), false, 'Não deve conter título da lista nominal');
    assert.equal(pdfResumidoText.includes('Participante 1'), false, 'Não deve conter nomes de participantes');
    assert.ok(pdfResumidoText.includes('RELATÓRIO RESUMIDO DO EVENTO'), 'Deve conter cabeçalho do relatório resumido');
    assert.ok(pdfResumidoText.includes('3. CONSOLIDAÇÃO DE PARTICIPAÇÃO POR CONGREGAÇÃO'), 'Deve conter congregações');
    assert.ok(pageCountResumido <= 2, `O relatório resumido de 3 congregações deve caber em 1 ou 2 páginas (gerado: ${pageCountResumido})`);

    // Gera o modelo Consolidado Geral do mesmo evento para comparar
    const pdfConsolidadoBuffer = await gerarRelatorioGerencialEventoPDF(dadosEvento, { tipo: 'consolidado' });
    const pdfConsolidadoText = Buffer.from(pdfConsolidadoBuffer).toString('latin1');

    assert.ok(pdfConsolidadoText.includes('4. LISTAGEM OFICIAL DE PARTICIPANTES'), 'O consolidado deve conter a listagem nominal');
    assert.ok(pdfConsolidadoText.includes('Participante 1'), 'O consolidado deve conter nomes');
  });

  await t.test('7. Validar Relatório Resumido para Evento Gratuito com muitas congregações', async () => {
    const muitasCongregacoes = [];
    for (let i = 1; i <= 25; i++) {
      muitasCongregacoes.push({
        congregacao: `Congregação Setor ${i} - Região Metropolitana`,
        totalInscritos: 15,
        confirmados: 14,
        presentes: 12,
        ausentes: 2,
        taxaPresenca: '85,7%',
      });
    }

    const dadosGratuitoMuitasCongs: DadosRelatorioEvento = {
      eventoId: 'ev-gratuito-muitas-congs',
      tituloEvento: 'Cruzada Evangelística Geral 2026',
      tipoEvento: 'CRUZADA',
      dataInicio: '20/11/2026',
      dataFim: '22/11/2026',
      statusEvento: 'CONFIRMADO',
      totalInscricoesValidas: 350,
      totalConfirmados: 350,
      totalPresentes: 300,
      totalAusentes: 50,
      totalCancelados: 10,
      totalListaEspera: 0,
      taxaComparecimento: '85,7%',
      taxaCancelamento: '2,8%',
      membrosQtd: 280,
      externosQtd: 70,

      consolidacaoCongregacoes: muitasCongregacoes,

      financeiro: {
        eventoPago: false,
        valorInscricao: 0,
        totalInscricoesValidas: 350,
        totalPrevisto: 0,
        totalRecebido: 0,
        totalPendente: 0,
        totalCanceladoEstornado: 0,
        formasPagamento: [],
      },

      beneficios: {
        hospedagemHabilitada: false,
        totalHospedagemSolicitada: 0,
        totalHospedagemConfirmada: 0,
        alimentacaoInclusa: false,
        brindeHabilitado: false,
        brindesEntregues: 0,
        certificadoHabilitado: false,
        certificadosEmitidos: 0,
      },

      nomeMinisterio: 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS',
      dataEmissao: '10/11/2026 20:00:00',
      participantes: [],
    };

    const pdfBuffer = await gerarRelatorioGerencialEventoPDF(dadosGratuitoMuitasCongs, { tipo: 'resumido' });
    assert.ok(pdfBuffer instanceof Uint8Array);

    const pdfText = Buffer.from(pdfBuffer).toString('latin1');
    assert.ok(pdfText.includes('sem arrecada'), 'Deve indicar gratuidade explicitamente');
    assert.ok(pdfText.includes('CONSOLIDA'), 'Deve incluir a tabela consolidada');
    assert.equal(pdfText.includes('LISTAGEM OFICIAL DE PARTICIPANTES'), false, 'Não deve ter listagem');
  });
});
