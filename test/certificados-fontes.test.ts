import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { FONTES_CERTIFICADOS, getFontesCertificadosHeadHtml, getFontesReadyPrintScript } from '../src/lib/certificados-fontes';

test('FONTES_CERTIFICADOS inclui Great Vibes e Allura preservando fontes existentes', () => {
  assert.ok(FONTES_CERTIFICADOS.includes('Great Vibes'), 'Deve conter Great Vibes');
  assert.ok(FONTES_CERTIFICADOS.includes('Allura'), 'Deve conter Allura');
  assert.ok(FONTES_CERTIFICADOS.includes('Arial'), 'Deve preservar Arial');
  assert.ok(FONTES_CERTIFICADOS.includes('Times New Roman'), 'Deve preservar Times New Roman');
  assert.ok(FONTES_CERTIFICADOS.includes('Comic Sans MS'), 'Deve preservar Comic Sans MS');
  assert.ok(FONTES_CERTIFICADOS.length >= 16);
});

test('Arquivos WOFF2 locais existem no diretório public/fonts', () => {
  const greatVibesPath = path.join(process.cwd(), 'public', 'fonts', 'GreatVibes-Regular.woff2');
  const alluraPath = path.join(process.cwd(), 'public', 'fonts', 'Allura-Regular.woff2');

  assert.ok(fs.existsSync(greatVibesPath), 'Arquivo GreatVibes-Regular.woff2 deve existir');
  assert.ok(fs.existsSync(alluraPath), 'Arquivo Allura-Regular.woff2 deve existir');

  const gvSize = fs.statSync(greatVibesPath).size;
  const alluraSize = fs.statSync(alluraPath).size;

  assert.ok(gvSize > 20000, `Great Vibes deve ter tamanho válido (>20KB), obteve: ${gvSize}`);
  assert.ok(alluraSize > 20000, `Allura deve ter tamanho válido (>20KB), obteve: ${alluraSize}`);
});

test('getFontesCertificadosHeadHtml inclui @font-face local e fallback do Google Fonts', () => {
  const html = getFontesCertificadosHeadHtml();
  assert.ok(html.includes("font-family: 'Great Vibes'"), 'Deve conter font-family Great Vibes');
  assert.ok(html.includes("font-family: 'Allura'"), 'Deve conter font-family Allura');
  assert.ok(html.includes('/fonts/GreatVibes-Regular.woff2'), 'Deve apontar para woff2 de Great Vibes');
  assert.ok(html.includes('/fonts/Allura-Regular.woff2'), 'Deve apontar para woff2 de Allura');
  assert.ok(html.includes('fonts.googleapis.com'), 'Deve conter fallback Google Fonts');
});

test('getFontesReadyPrintScript aguarda document.fonts.ready antes de disparar window.print', () => {
  const script = getFontesReadyPrintScript();
  assert.ok(script.includes('document.fonts.ready'), 'Deve verificar document.fonts.ready');
  assert.ok(script.includes('window.print()'), 'Deve disparar window.print()');
});

test('calcularFontSizeAutoAjustado ajusta nomes curtos, médios e longos sem alterar o modelo', async () => {
  const { calcularFontSizeAutoAjustado, buildTextoEstiloRenderizacao } = await import('../src/lib/certificados-fontes');

  // Elemento do participante: largura 603, altura 42, base 22px
  const el = {
    x: 117,
    y: 271,
    largura: 603,
    altura: 42,
    fontSize: 22,
    fonte: 'Great Vibes',
  };

  // Nome curto
  const curto = 'Ana Lima';
  const sizeCurto = calcularFontSizeAutoAjustado({
    texto: curto,
    larguraElemento: el.largura,
    alturaElemento: el.altura,
    fontSizeBase: el.fontSize,
    fonte: el.fonte,
    isSingleLine: true,
  });
  assert.equal(sizeCurto, 22, 'Nome curto deve manter o fontSize original de 22px');

  // Nome completo realista (sem sufixo artificial): cabe com tamanho normal/confortável
  const nomeRealista = 'Carlos Eduardo Oliveira';
  const sizeRealista = calcularFontSizeAutoAjustado({
    texto: nomeRealista,
    larguraElemento: el.largura,
    alturaElemento: el.altura,
    fontSizeBase: el.fontSize,
    fonte: el.fonte,
    isSingleLine: true,
  });
  assert.equal(sizeRealista, 22, 'Nome completo realista em Title Case cabe no tamanho original de 22px sem redução desnecessária');

  // Nome extremamente longo em caixa alta (ex: com sufixo demonstrativo em ALL CAPS): é reduzido proporcionalmente
  const longoAllCaps = 'CARLOS EDUARDO OLIVEIRA (PARTICIPANTE DEMONSTRATIVO)';
  const sizeLongoUpper = calcularFontSizeAutoAjustado({
    texto: longoAllCaps,
    larguraElemento: el.largura,
    alturaElemento: el.altura,
    fontSizeBase: el.fontSize,
    fonte: el.fonte,
    isSingleLine: true,
  });
  assert.ok(sizeLongoUpper < 22, 'Nome muito longo em maiúsculas deve ser reduzido automaticamente');
  assert.ok(sizeLongoUpper >= 10, 'Deve respeitar tamanho mínimo legível');

  // Testar também com a fonte Allura
  const sizeAllura = calcularFontSizeAutoAjustado({
    texto: nomeRealista,
    larguraElemento: el.largura,
    alturaElemento: el.altura,
    fontSizeBase: el.fontSize,
    fonte: 'Allura',
    isSingleLine: true,
  });
  assert.equal(sizeAllura, 22, 'Allura em Title Case cabe no tamanho original');

  // Testar buildTextoEstiloRenderizacao
  const { containerStyle, innerStyle, fontSizeEfetivo } = buildTextoEstiloRenderizacao(el, nomeRealista, true);
  assert.ok(containerStyle.includes('overflow:hidden'), 'Container deve conter overflow:hidden');
  assert.ok(containerStyle.includes('display:flex'), 'Container deve usar flex');
  assert.ok(innerStyle.includes('white-space:nowrap'), 'Nome do participante deve priorizar linha única');
  assert.ok(innerStyle.includes(`font-size:${fontSizeEfetivo}px`), 'Inner style deve refletir font-size calculado');
});

test('buildEventoPlaceholderMap formata evento_data estritamente como DD/MM/YYYY sem hora', async () => {
  const { buildEventoPlaceholderMap } = await import('../src/lib/evento-status-utils');

  const eventoFake: any = {
    id: 'evt-1',
    titulo: 'ESCOLA DE OBREIROS 2026',
    data_inicio: '2026-10-23T19:00:00.000Z',
    data_fim: '2026-10-23T21:30:00.000Z',
    local_nome: 'ASSEMBLEIA DE DEUS',
    local_endereco: 'BR 316',
    tipo: 'conferencia',
  };

  const inscFake: any = {
    id: 'insc-1',
    nome_display: 'Carlos Eduardo Oliveira (Participante Demonstrativo)',
    cpf: '123.456.789-00',
  };

  const map = buildEventoPlaceholderMap(eventoFake, inscFake, {} as any);

  // evento_data deve ser apenas data (ex: 23/10/2026)
  assert.match(map.evento_data, /^\d{2}\/\d{2}\/\d{4}$/, `evento_data deve conter estritamente DD/MM/YYYY, recebido: "${map.evento_data}"`);
  assert.match(map.data_evento, /^\d{2}\/\d{2}\/\d{4}$/, `data_evento deve conter estritamente DD/MM/YYYY, recebido: "${map.data_evento}"`);
  assert.ok(!map.evento_data.includes(':'), 'evento_data não deve conter horário nem dois-pontos');
  assert.ok(map.evento_data_inicio.includes(':'), 'evento_data_inicio preserva data e horário para quem precisar');
});

test('formatarNomeProprio e substituirPlaceholdersCertificado preservam nomes próprios sem forçar maiúsculas', async () => {
  const { formatarNomeProprio, substituirPlaceholdersCertificado } = await import('../src/lib/certificados-utils');

  // Testar formatarNomeProprio com preposições e acentuação
  assert.equal(formatarNomeProprio('CARLOS EDUARDO OLIVEIRA'), 'Carlos Eduardo Oliveira');
  assert.equal(formatarNomeProprio('carlos eduardo de oliveira'), 'Carlos Eduardo de Oliveira');
  assert.equal(formatarNomeProprio('JOÃO DA SILVA E SOUZA'), 'João da Silva e Souza');
  assert.equal(formatarNomeProprio('MARIA DAS DORES DOS SANTOS'), 'Maria das Dores dos Santos');
  assert.equal(formatarNomeProprio('josé antônio de sousa'), 'José Antônio de Sousa');
  assert.equal(formatarNomeProprio('Carlos Eduardo Oliveira (Participante Demonstrativo)'), 'Carlos Eduardo Oliveira (Participante Demonstrativo)');

  // Testar substituição no template de evento
  const templateTexto = 'Certificamos que {{participante_nome}} participou do evento {{evento_nome}} em {{cidade}} - {{estado}}.';
  const dados = {
    participante_nome: 'CARLOS EDUARDO OLIVEIRA',
    evento_nome: 'ESCOLA DE OBREIROS 2026',
    cidade: 'Ananindeua',
    estado: 'PA',
  };

  const resultado = substituirPlaceholdersCertificado(templateTexto, dados, 'eventos');
  assert.ok(resultado.includes('Carlos Eduardo Oliveira'), `O nome deve ser formatado em Title Case: ${resultado}`);
  assert.ok(!resultado.includes('CARLOS EDUARDO OLIVEIRA'), 'Não deve manter o nome em maiúsculas forçadas');
  assert.ok(resultado.includes('ESCOLA DE OBREIROS 2026'), 'Nome do evento deve ser mantido');
  assert.ok(resultado.includes('Ananindeua - PA'), 'Cidade e estado devem ser mantidos');
});


