import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gerarPdfEscalaPregadores, DadosRelatorioEscala } from '../../src/lib/escala-pregadores-pdf.js';

describe('Relatórios da Escala de Pregadores - Geração de PDF (Etapa 4)', () => {
  it('deve gerar documento jsPDF para impressão institucional A4 com os dados formatados', async () => {
    const dadosMock: DadosRelatorioEscala = {
      nomeMinisterio: 'Igreja Evangélica Assembleia de Deus',
      subtituloMinisterio: 'Secretaria Geral • Campo Sede',
      cnpjMinisterio: '12.345.678/0001-99',
      cidadeUf: 'Belém/PA',
      logoMinisterioUrl: null,
      periodoReferencia: 'Novembro de 2026',
      tipoEscala: 'Mensal',
      congregacaoFiltro: 'Todas as Congregações (Campo Geral)',
      situacaoFiltro: 'Todos os Cultos da Agenda',
      dataEmissao: '29/10/2026 15:30',
      totalEventos: 2,
      totalEscalados: 1,
      totalConfirmados: 1,
      totalSemPregador: 0,
      itens: [
        {
          numero: 1,
          data: '01/11/2026',
          horario: '19:00 às 21:00',
          diaSemana: 'DOM',
          cultoTitulo: 'Culto da Família',
          tipoCulto: 'Culto Público',
          congregacaoNome: 'Templo Central',
          isSede: true,
          local: 'Nave Principal',
          pregadorNome: 'Pastor João da Silva',
          cargoMinisterial: 'Pastor',
          situacaoEscala: 'confirmado',
          temaMensagem: 'A Família no Altar',
          textoBiblico: 'Josué 24:15',
        },
        {
          numero: 2,
          data: '08/11/2026',
          horario: '19:00 às 21:00',
          diaSemana: 'DOM',
          cultoTitulo: 'Culto de Missões',
          tipoCulto: 'Culto Público',
          congregacaoNome: 'Congregação Canaã',
          isSede: false,
          local: null,
          pregadorNome: 'Evangelista Marcos Santos',
          cargoMinisterial: 'Evangelista',
          situacaoEscala: 'escalado',
          temaMensagem: 'O Clamor das Nações',
          textoBiblico: 'Marcos 16:15',
        },
      ],
    };

    const doc = await gerarPdfEscalaPregadores(dadosMock);
    assert.ok(doc, 'O documento jsPDF deve ser instanciado');
    assert.equal(doc.getNumberOfPages(), 1, 'Deve possuir 1 página para 2 itens');

    const outputBuffer = doc.output('arraybuffer');
    assert.ok(outputBuffer.byteLength > 1000, 'O buffer PDF gerado deve ser maior que 1KB');
  });

  it('deve gerar corretamente o PDF para eventos com cultos sem pregador', async () => {
    const dadosMockVago: DadosRelatorioEscala = {
      nomeMinisterio: 'Igreja Evangélica Assembleia de Deus',
      periodoReferencia: 'Semana 44',
      tipoEscala: 'Semanal',
      congregacaoFiltro: 'Congregação Betel',
      situacaoFiltro: 'Apenas Sem Pregador',
      dataEmissao: '29/10/2026 15:35',
      totalEventos: 1,
      totalEscalados: 0,
      totalConfirmados: 0,
      totalSemPregador: 1,
      itens: [
        {
          numero: 1,
          data: '05/11/2026',
          horario: '19:30 às 21:00',
          diaSemana: 'QUI',
          cultoTitulo: 'Culto de Doutrina',
          congregacaoNome: 'Congregação Betel',
          pregadorNome: '',
          cargoMinisterial: '',
          situacaoEscala: 'sem_pregador',
        },
      ],
    };

    const doc = await gerarPdfEscalaPregadores(dadosMockVago);
    assert.ok(doc);
    const outputBuffer = doc.output('arraybuffer');
    assert.ok(outputBuffer.byteLength > 1000);
  });
});
