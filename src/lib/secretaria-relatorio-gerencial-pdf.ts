import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ExecutiveMetrics,
  DemographicsSummary,
  GrowthTrendItem,
} from '@/services/secretary-reports-service';

export interface CongregacaoDistributionItem {
  id: string;
  nome: string;
  totalMembros: number;
  totalAtivos: number;
  totalCongregados: number;
  totalCriancas: number;
  totalMinistros: number;
  percentual: number;
}

export interface DadosRelatorioGerencialSecretaria {
  // Identificação do Ministério / Igreja
  nomeMinisterio: string;
  subtituloMinisterio?: string | null;
  cnpjMinisterio?: string | null;
  enderecoMinisterio?: string | null;
  telefoneMinisterio?: string | null;
  emailMinisterio?: string | null;
  responsavelMinisterio?: string | null;
  logoMinisterioUrl?: string | null;

  // Escopo e Metadados
  escopoCongregacao: string; // Ex: "Todas as Congregações" ou "Congregação Monte Sião"
  dataEmissao: string; // Formato amigável ou ISO
  emitidoPor?: string | null;

  // Dados Estatísticos Consolidados
  executiveMetrics: ExecutiveMetrics;
  demographics: DemographicsSummary;
  growthTrends: GrowthTrendItem[];
  congregacoesDistribution: CongregacaoDistributionItem[];
  lettersStats?: any;
  baptismsAndActs?: any;
}

/**
 * Tenta buscar o logo (Data URI, URL HTTP ou Base64) e converter para inclusão no jsPDF.
 */
async function carregarLogoBase64(url?: string | null): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const cleanUrl = url.trim();

  if (cleanUrl.startsWith('data:image/')) {
    const isPng = cleanUrl.includes('image/png') || !cleanUrl.includes('image/jpeg');
    return {
      data: cleanUrl,
      format: isPng ? 'PNG' : 'JPEG',
    };
  }

  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    try {
      const res = await fetch(cleanUrl, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const format: 'PNG' | 'JPEG' = contentType.includes('png') ? 'PNG' : 'JPEG';
      const arrayBuffer = await res.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return {
        data: `data:${contentType || 'image/png'};base64,${base64}`,
        format,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Desenha cabeçalho padrão nas páginas de conteúdo (a partir da pág. 2).
 */
function desenharCabecalhoPagina(
  doc: jsPDF,
  dados: DadosRelatorioGerencialSecretaria,
  tituloSecao: string,
  logoImg?: { data: string; format: 'PNG' | 'JPEG' } | null
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Barra superior azul marinho escuro (#0e2f50)
  doc.setFillColor(14, 47, 80);
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Faixa de destaque dourada (#c59b27)
  doc.setFillColor(197, 155, 39);
  doc.rect(0, 22, pageWidth, 1.5, 'F');

  // Mini-logo ou Ícone à esquerda
  let textStartX = 14;
  if (logoImg?.data) {
    try {
      doc.addImage(logoImg.data, logoImg.format, 14, 3, 16, 16, undefined, 'FAST');
      textStartX = 34;
    } catch {
      textStartX = 14;
    }
  }

  // Título e Subtítulo no cabeçalho
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(dados.nomeMinisterio.toUpperCase(), textStartX, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(215, 225, 240);
  doc.text(
    `RELATÓRIO GERENCIAL CONSOLIDADO DA SECRETARIA  •  ${dados.escopoCongregacao.toUpperCase()}`,
    textStartX,
    14
  );

  // Título da seção à direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(tituloSecao.toUpperCase(), pageWidth - 14, 13, { align: 'right' });
}

/**
 * Desenha rodapé padrão com paginação "Página X de Y" e carimbo institucional.
 */
function aplicarRodapes(doc: jsPDF, dados: DadosRelatorioGerencialSecretaria) {
  const totalPaginas = (doc.internal as any).getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);

    // Na capa (página 1), desenha rodapé simplificado e sem barra cinza
    if (i === 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 150, 165);
      doc.text(
        `Documento confidencial gerado via Plataforma Gestão Eklésia • ${dados.dataEmissao}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
      continue;
    }

    // Linha divisória suave
    doc.setDrawColor(220, 226, 235);
    doc.setLineWidth(0.4);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    // Informação à esquerda
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 145);
    const textoEsquerda = `${dados.nomeMinisterio} • Secretaria Geral • Gerado em: ${dados.dataEmissao}`;
    doc.text(textoEsquerda, 14, pageHeight - 8);

    // Paginação à direita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(14, 47, 80);
    doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

/**
 * PÁGINA 1: CAPA INSTITUCIONAL & EXECUTIVA
 */
function renderizarCapa(
  doc: jsPDF,
  dados: DadosRelatorioGerencialSecretaria,
  logoImg?: { data: string; format: 'PNG' | 'JPEG' } | null
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Fundo com suave gradiente / moldura lateral
  doc.setFillColor(18, 59, 99); // Azul corporativo Eklésia
  doc.rect(0, 0, 12, pageHeight, 'F');

  doc.setFillColor(197, 155, 39); // Linha vertical dourada
  doc.rect(12, 0, 2, pageHeight, 'F');

  // Área superior centralizada: Logo
  let currentY = 45;
  if (logoImg?.data) {
    try {
      const logoWidth = 38;
      const logoHeight = 38;
      const logoX = (pageWidth - logoWidth) / 2 + 6;
      doc.addImage(logoImg.data, logoImg.format, logoX, currentY, logoWidth, logoHeight, undefined, 'FAST');
      currentY += 46;
    } catch {
      currentY += 10;
    }
  } else {
    currentY += 15;
  }

  // Nome do Ministério
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(14, 47, 80);
  doc.text(dados.nomeMinisterio.toUpperCase(), pageWidth / 2 + 6, currentY, { align: 'center' });
  currentY += 7;

  if (dados.subtituloMinisterio) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 105, 120);
    doc.text(dados.subtituloMinisterio, pageWidth / 2 + 6, currentY, { align: 'center' });
    currentY += 8;
  }

  // Linha horizontal decorativa
  currentY += 8;
  doc.setDrawColor(197, 155, 39);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 40 + 6, currentY, pageWidth / 2 + 40 + 6, currentY);
  currentY += 18;

  // Caixa de Título Principal
  doc.setFillColor(245, 248, 252);
  doc.setDrawColor(215, 226, 240);
  doc.setLineWidth(0.6);
  const boxWidth = pageWidth - 60;
  const boxX = (pageWidth - boxWidth) / 2 + 6;
  doc.roundedRect(boxX, currentY, boxWidth, 42, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(14, 47, 80);
  doc.text('RELATÓRIO GERENCIAL CONSOLIDADO', pageWidth / 2 + 6, currentY + 14, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(197, 155, 39);
  doc.text('SECRETARIA GERAL & GESTÃO ESTRATÉGICA', pageWidth / 2 + 6, currentY + 23, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 95, 110);
  doc.text(`Documento Institucional para Apresentação à Presidência`, pageWidth / 2 + 6, currentY + 33, {
    align: 'center',
  });

  currentY += 60;

  // Cartão com Metadados da Emissão
  const metaBoxWidth = pageWidth - 70;
  const metaBoxX = (pageWidth - metaBoxWidth) / 2 + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(225, 232, 240);
  doc.roundedRect(metaBoxX, currentY, metaBoxWidth, 54, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 115, 130);

  let metaY = currentY + 10;
  doc.text('ESCOPO DE CONGREGAÇÃO:', metaBoxX + 12, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 47, 80);
  doc.setFontSize(9.5);
  doc.text(dados.escopoCongregacao, metaBoxX + 62, metaY);

  metaY += 9;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 115, 130);
  doc.setFontSize(8);
  doc.text('DATA DE EMISSÃO:', metaBoxX + 12, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 30, 45);
  doc.text(dados.dataEmissao, metaBoxX + 62, metaY);

  if (dados.emitidoPor) {
    metaY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 115, 130);
    doc.text('SOLICITANTE / EMISSOR:', metaBoxX + 12, metaY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 30, 45);
    doc.text(dados.emitidoPor, metaBoxX + 62, metaY);
  }

  if (dados.cnpjMinisterio) {
    metaY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 115, 130);
    doc.text('CNPJ INSTITUCIONAL:', metaBoxX + 12, metaY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 30, 45);
    doc.text(dados.cnpjMinisterio, metaBoxX + 62, metaY);
  }

  if (dados.enderecoMinisterio) {
    metaY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 115, 130);
    doc.text('ENDEREÇO DA SEDE:', metaBoxX + 12, metaY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 30, 45);
    const endTrunc =
      dados.enderecoMinisterio.length > 55
        ? dados.enderecoMinisterio.substring(0, 52) + '...'
        : dados.enderecoMinisterio;
    doc.text(endTrunc, metaBoxX + 62, metaY);
  }
}

/**
 * PÁGINA 2: RESUMO EXECUTIVO & SITUAÇÃO CADASTRAL
 */
function renderizarResumoExecutivo(
  doc: jsPDF,
  dados: DadosRelatorioGerencialSecretaria,
  logoImg?: { data: string; format: 'PNG' | 'JPEG' } | null
) {
  doc.addPage();
  desenharCabecalhoPagina(doc, dados, 'Resumo Executivo & Indicadores', logoImg);

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 32;

  // 1. TÍTULO DE SEÇÃO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 47, 80);
  doc.text('1. INDICADORES-CHAVE DE DESEMPENHO (KPIs)', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 115, 130);
  doc.text('Métricas consolidadas de membros, liderança e engajamento institucional.', 14, currentY + 4.5);

  currentY += 10;

  // 2. GRID DE 4 CARDS EXECUTIVOS
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 25;

  const kpis = [
    {
      label: 'TOTAL DE MEMBROS',
      valor: dados.executiveMetrics.totalMembros.toLocaleString('pt-BR'),
      sub: `${dados.executiveMetrics.membrosAtivos.toLocaleString('pt-BR')} ativos`,
      cor: [18, 59, 99], // Azul
    },
    {
      label: 'QUADRO MINISTERIAL',
      valor: dados.executiveMetrics.totalMinistros.toLocaleString('pt-BR'),
      sub: 'Pastores, Evang. e Diác.',
      cor: [197, 155, 39], // Dourado
    },
    {
      label: 'CONGREGADOS',
      valor: dados.executiveMetrics.totalCongregados.toLocaleString('pt-BR'),
      sub: 'Frequentadores em acolhimento',
      cor: [34, 139, 34], // Verde
    },
    {
      label: 'CRIANÇAS / DEP. INFANTIL',
      valor: dados.executiveMetrics.totalCriancas.toLocaleString('pt-BR'),
      sub: '0 a 11 anos cadastrados',
      cor: [120, 80, 180], // Roxo suave
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = 14 + idx * (cardWidth + 3);

    // Card background
    doc.setFillColor(248, 250, 253);
    doc.setDrawColor(220, 228, 238);
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    // Faixa superior colorida
    doc.setFillColor(kpi.cor[0], kpi.cor[1], kpi.cor[2]);
    doc.roundedRect(cardX, currentY, cardWidth, 2.5, 1, 1, 'F');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(110, 125, 140);
    doc.text(kpi.label, cardX + cardWidth / 2, currentY + 7.5, { align: 'center' });

    // Valor Principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(kpi.cor[0], kpi.cor[1], kpi.cor[2]);
    doc.text(kpi.valor, cardX + cardWidth / 2, currentY + 16, { align: 'center' });

    // Subtexto
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 130, 145);
    doc.text(kpi.sub, cardX + cardWidth / 2, currentY + 21.5, { align: 'center' });
  });

  currentY += cardHeight + 10;

  // 3. TABELA DE SITUAÇÃO CADASTRAL & CATEGORIAS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 47, 80);
  doc.text('2. SITUAÇÃO CADASTRAL & CATEGORIZAÇÃO', 14, currentY);
  currentY += 5;

  const totalGeral =
    dados.executiveMetrics.totalMembros +
    dados.executiveMetrics.totalCongregados +
    dados.executiveMetrics.totalCriancas;

  const situacaoRows = [
    [
      'Membros Ativos em Comunhão',
      dados.executiveMetrics.membrosAtivos.toLocaleString('pt-BR'),
      totalGeral > 0 ? `${((dados.executiveMetrics.membrosAtivos / totalGeral) * 100).toFixed(1)}%` : '0%',
      'Situação regular, com direito a cartas, certificados e participação plena.',
    ],
    [
      'Membros Inativos / Afastados',
      dados.executiveMetrics.membrosInativos.toLocaleString('pt-BR'),
      totalGeral > 0 ? `${((dados.executiveMetrics.membrosInativos / totalGeral) * 100).toFixed(1)}%` : '0%',
      'Necessitam de acolhimento e visita pastoral para reaproximação.',
    ],
    [
      'Membros Transferidos',
      dados.executiveMetrics.membrosTransferidos.toLocaleString('pt-BR'),
      totalGeral > 0 ? `${((dados.executiveMetrics.membrosTransferidos / totalGeral) * 100).toFixed(1)}%` : '0%',
      'Registros encerrados com emissão de carta de transferência.',
    ],
    [
      'Membros Falecidos / Em Memória',
      dados.executiveMetrics.membrosFalecidos.toLocaleString('pt-BR'),
      totalGeral > 0 ? `${((dados.executiveMetrics.membrosFalecidos / totalGeral) * 100).toFixed(1)}%` : '0%',
      'Registros arquivados no livro memorial e histórico ministerial.',
    ],
    [
      'Congregados (Não Membros)',
      dados.executiveMetrics.totalCongregados.toLocaleString('pt-BR'),
      totalGeral > 0 ? `${((dados.executiveMetrics.totalCongregados / totalGeral) * 100).toFixed(1)}%` : '0%',
      'Frequentadores assíduos em processo de integração e discipulado.',
    ],
    [
      'Departamento Infantil (Crianças)',
      dados.executiveMetrics.totalCriancas.toLocaleString('pt-BR'),
      totalGeral > 0 ? `${((dados.executiveMetrics.totalCriancas / totalGeral) * 100).toFixed(1)}%` : '0%',
      'Faixa etária de 0 a 11 anos sob cuidados do Ministério Infantil.',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Categoria / Situação', 'Quantidade', 'Participação', 'Observação Estratégica']],
    body: situacaoRows,
    theme: 'grid',
    headStyles: {
      fillColor: [14, 47, 80],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 'auto' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 253],
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 9;

  // 4. GRÁFICO VETORIAL DE DISTRIBUIÇÃO RELATIVA (Barras Horizontais Proporcionais)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(14, 47, 80);
  doc.text('3. COMPOSIÇÃO RELATIVA DO CORPO ECLESIÁSTICO', 14, currentY);
  currentY += 5;

  // Desenhar barras horizontais elegantes
  const composicaoItens = [
    { label: 'Membros Ativos', valor: dados.executiveMetrics.membrosAtivos, cor: [18, 59, 99] },
    { label: 'Congregados', valor: dados.executiveMetrics.totalCongregados, cor: [34, 139, 34] },
    { label: 'Crianças (0-11)', valor: dados.executiveMetrics.totalCriancas, cor: [120, 80, 180] },
    { label: 'Inativos', valor: dados.executiveMetrics.membrosInativos, cor: [180, 80, 50] },
  ];

  const maxVal = Math.max(...composicaoItens.map((c) => c.valor), 1);
  const barMaxWidth = pageWidth - 28 - 50 - 25; // Espaço para a barra gráfica

  composicaoItens.forEach((item) => {
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 75, 90);
    doc.text(item.label, 14, currentY + 3.5);

    // Barra de fundo (cinza)
    doc.setFillColor(235, 240, 246);
    doc.roundedRect(55, currentY, barMaxWidth, 4.5, 1, 1, 'F');

    // Barra de progresso preenchida
    const progWidth = Math.max((item.valor / maxVal) * barMaxWidth, 2);
    doc.setFillColor(item.cor[0], item.cor[1], item.cor[2]);
    doc.roundedRect(55, currentY, progWidth, 4.5, 1, 1, 'F');

    // Valor e Percentual ao lado
    const pct = totalGeral > 0 ? ((item.valor / totalGeral) * 100).toFixed(1) : '0';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(item.cor[0], item.cor[1], item.cor[2]);
    doc.text(`${item.valor.toLocaleString('pt-BR')} (${pct}%)`, 55 + barMaxWidth + 3, currentY + 3.5);

    currentY += 7;
  });

  currentY += 3;

  // 5. CAIXA DE ALERTA GERENCIAL / AUDITORIA DE CADASTROS
  const alertBoxY = currentY;
  const alertBoxHeight = 30;
  doc.setFillColor(254, 252, 243);
  doc.setDrawColor(240, 215, 140);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, alertBoxY, pageWidth - 28, alertBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(160, 100, 15);
  doc.text('AUDITORIA DE DADOS & QUALIDADE CADASTRAL (SECRETARIA)', 19, alertBoxY + 6);

  const alertas = dados.executiveMetrics.alertas;
  const alertItems = [
    { label: 'Sem CPF', val: alertas.semCpf },
    { label: 'Sem Data Nasc.', val: alertas.semDataNascimento },
    { label: 'Sem Telefone', val: alertas.semTelefone },
    { label: 'Sem Endereço', val: alertas.semEndereco },
    { label: 'Sem Foto Cadastral', val: alertas.semFoto },
    { label: 'Cartas Pendentes', val: alertas.cartasPendentes },
  ];

  const colW = (pageWidth - 38) / 3;
  alertItems.forEach((alt, idx) => {
    const colIdx = idx % 3;
    const rowIdx = Math.floor(idx / 3);
    const x = 19 + colIdx * colW;
    const y = alertBoxY + 14 + rowIdx * 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 90, 100);
    doc.text(`• ${alt.label}:`, x, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(alt.val > 0 ? 180 : 40, alt.val > 0 ? 40 : 120, alt.val > 0 ? 40 : 40);
    doc.text(`${alt.val.toLocaleString('pt-BR')} registros`, x + 30, y);
  });
}

/**
 * PÁGINA 3: PERFIL DEMOGRÁFICO & QUADRO MINISTERIAL
 */
function renderizarDemografiaEQuadro(
  doc: jsPDF,
  dados: DadosRelatorioGerencialSecretaria,
  logoImg?: { data: string; format: 'PNG' | 'JPEG' } | null
) {
  doc.addPage();
  desenharCabecalhoPagina(doc, dados, 'Demografia & Quadro Ministerial', logoImg);

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 32;

  // 1. TÍTULO DEMOGRAFIA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 47, 80);
  doc.text('4. PERFIL DEMOGRÁFICO DA IGREJA', 14, currentY);
  currentY += 6;

  // Gênero: Barra dividida proporcional
  const masc = dados.demographics.porSexo.masculino || 0;
  const fem = dados.demographics.porSexo.feminino || 0;
  const naoInf = dados.demographics.porSexo.naoInformado || 0;
  const totalSexo = masc + fem + naoInf;

  const pctMasc = totalSexo > 0 ? (masc / totalSexo) * 100 : 0;
  const pctFem = totalSexo > 0 ? (fem / totalSexo) * 100 : 0;
  const pctNaoInf = totalSexo > 0 ? (naoInf / totalSexo) * 100 : 0;

  // Barra de gênero
  const barW = pageWidth - 28;
  doc.setFillColor(22, 101, 192); // Homens - Azul
  const wM = (pctMasc / 100) * barW;
  doc.roundedRect(14, currentY, Math.max(wM, 2), 6, 1, 1, 'F');

  doc.setFillColor(219, 39, 119); // Mulheres - Rosa
  const wF = (pctFem / 100) * barW;
  doc.roundedRect(14 + wM, currentY, Math.max(wF, 2), 6, 1, 1, 'F');

  if (pctNaoInf > 0) {
    doc.setFillColor(156, 163, 175); // Cinza
    const wN = (pctNaoInf / 100) * barW;
    doc.roundedRect(14 + wM + wF, currentY, Math.max(wN, 2), 6, 1, 1, 'F');
  }

  currentY += 10;

  // Legendas de gênero
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 192);
  doc.text(`■ Masculino: ${masc.toLocaleString('pt-BR')} (${pctMasc.toFixed(1)}%)`, 14, currentY);

  doc.setTextColor(219, 39, 119);
  doc.text(`■ Feminino: ${fem.toLocaleString('pt-BR')} (${pctFem.toFixed(1)}%)`, 75, currentY);

  if (naoInf > 0) {
    doc.setTextColor(120, 130, 140);
    doc.text(`■ Não Informado: ${naoInf.toLocaleString('pt-BR')} (${pctNaoInf.toFixed(1)}%)`, 140, currentY);
  }

  currentY += 8;

  // Tabela lado a lado: Faixa Etária (esquerda) e Estado Civil (direita)
  const faixasRows = dados.demographics.porFaixaEtaria.map((f) => [
    f.label,
    f.total.toLocaleString('pt-BR'),
    `${f.percentual.toFixed(1)}%`,
  ]);

  const estadosCivisRows = Object.entries(dados.demographics.porEstadoCivil)
    .sort((a, b) => b[1] - a[1])
    .map(([ec, qtd]) => {
      const pct = totalSexo > 0 ? `${((qtd / totalSexo) * 100).toFixed(1)}%` : '0%';
      const nomeAmigavel =
        ec === 'casado'
          ? 'Casado(a)'
          : ec === 'solteiro'
          ? 'Solteiro(a)'
          : ec === 'viuvo'
          ? 'Viúvo(a)'
          : ec === 'divorciado'
          ? 'Divorciado(a)'
          : ec === 'uniao_estavel'
          ? 'União Estável'
          : ec;
      return [nomeAmigavel, qtd.toLocaleString('pt-BR'), pct];
    });

  const startYTable = currentY;

  // Tabela Faixa Etária (Col 1)
  autoTable(doc, {
    startY: startYTable,
    head: [['Faixa Etária', 'Qtd', '%']],
    body: faixasRows,
    theme: 'grid',
    headStyles: { fillColor: [18, 59, 99], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    margin: { left: 14, right: pageWidth / 2 + 3 },
  });

  const finalYFaixas = (doc as any).lastAutoTable.finalY;

  // Tabela Estado Civil (Col 2)
  autoTable(doc, {
    startY: startYTable,
    head: [['Estado Civil', 'Qtd', '%']],
    body: estadosCivisRows.length > 0 ? estadosCivisRows : [['Não informado', '0', '0%']],
    theme: 'grid',
    headStyles: { fillColor: [14, 47, 80], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 250, 253] },
    margin: { left: pageWidth / 2 + 3, right: 14 },
  });

  const finalYCivil = (doc as any).lastAutoTable.finalY;
  currentY = Math.max(finalYFaixas, finalYCivil) + 12;

  // 2. QUADRO MINISTERIAL & LIDERANÇA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 47, 80);
  doc.text('5. QUADRO MINISTERIAL & OFICIAIS ECLESIÁSTICOS', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 115, 130);
  doc.text('Distribuição consolidada de pastores, presbíteros, evangelistas, diáconos e cooperadores.', 14, currentY + 4.5);
  currentY += 8;

  const cargosEntries = Object.entries(dados.demographics.porCargoMinisterial)
    .filter(([cargo]) => cargo && cargo.toLowerCase() !== 'membro' && cargo.toLowerCase() !== 'nenhum')
    .sort((a, b) => b[1] - a[1]);

  const totalOficiais = cargosEntries.reduce((acc, curr) => acc + curr[1], 0);

  const cargosRows = cargosEntries.map(([cargo, qtd]) => {
    const pct = totalOficiais > 0 ? `${((qtd / totalOficiais) * 100).toFixed(1)}%` : '0%';
    return [cargo.toUpperCase(), qtd.toLocaleString('pt-BR'), pct, 'Consagrado pelo Ministério'];
  });

  if (cargosRows.length === 0) {
    cargosRows.push(['Nenhum cargo específico registrado', '0', '0%', 'Todos registrados como membros gerais']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Cargo / Função Eclesiástica', 'Quantidade', '% do Quadro', 'Observações']],
    body: cargosRows,
    theme: 'grid',
    headStyles: {
      fillColor: [197, 155, 39], // Dourado ministerial
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: 'bold' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 'auto' },
    },
    alternateRowStyles: {
      fillColor: [253, 251, 243],
    },
    margin: { left: 14, right: 14 },
  });
}

/**
 * PÁGINA 4: DISTRIBUIÇÃO POR CONGREGAÇÃO & EVOLUÇÃO TEMPORAL
 */
function renderizarCongregacoesEEvolucao(
  doc: jsPDF,
  dados: DadosRelatorioGerencialSecretaria,
  logoImg?: { data: string; format: 'PNG' | 'JPEG' } | null
) {
  doc.addPage();
  desenharCabecalhoPagina(doc, dados, 'Congregações & Crescimento', logoImg);

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 32;

  // 1. TÍTULO CONGREGAÇÕES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 47, 80);
  doc.text('6. DISTRIBUIÇÃO E PARTICIPAÇÃO POR CONGREGAÇÃO', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 115, 130);
  doc.text('Mapeamento geográfico e quantitativo do rebanho em cada unidade ministerial.', 14, currentY + 4.5);
  currentY += 8;

  const distRows = (dados.congregacoesDistribution || []).map((c: any) => [
    (c.nome || 'Não Identificada').toUpperCase(),
    (c.totalMembros ?? c.total ?? 0).toLocaleString('pt-BR'),
    (c.totalAtivos ?? 0).toLocaleString('pt-BR'),
    (c.totalCongregados ?? 0).toLocaleString('pt-BR'),
    (c.totalMinistros ?? 0).toLocaleString('pt-BR'),
    `${Number(c.percentual ?? 0).toFixed(1)}%`,
  ]);

  if (distRows.length === 0) {
    distRows.push(['Sede Geral (Sem congregações cadastradas)', '0', '0', '0', '0', '100%']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Congregação', 'Total', 'Ativos', 'Congregados', 'Ministros', 'Participação']],
    body: distRows,
    theme: 'grid',
    headStyles: {
      fillColor: [14, 47, 80],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 24, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 253],
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // 2. EVOLUÇÃO NOS ÚLTIMOS 12 MESES (CRESCIMENTO HISTÓRICO)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 47, 80);
  doc.text('7. EVOLUÇÃO E CRESCIMENTO NOS ÚLTIMOS 12 MESES', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 115, 130);
  doc.text('Novos cadastros mensais registrados e taxa de variação de expansão do rebanho.', 14, currentY + 4.5);
  currentY += 8;

  // Gráfico de Barras Verticais do Histórico Mensal
  const trends = dados.growthTrends || [];
  if (trends.length > 0) {
    const chartX = 14;
    const chartY = currentY;
    const chartW = pageWidth - 28;
    const chartH = 42;

    // Fundo da área do gráfico
    doc.setFillColor(250, 252, 254);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(chartX, chartY, chartW, chartH, 2, 2, 'FD');

    const maxNovos = Math.max(...trends.map((t) => t.novosCadastros), 5);
    const barCount = trends.length;
    const colStep = (chartW - 20) / barCount;
    const barWidth = Math.min(colStep * 0.55, 10);

    trends.forEach((t, i) => {
      const bX = chartX + 10 + i * colStep + (colStep - barWidth) / 2;
      const valHeight = (t.novosCadastros / maxNovos) * 25;
      const bY = chartY + chartH - 10 - valHeight;

      // Barra vertical
      doc.setFillColor(18, 59, 99);
      doc.roundedRect(bX, bY, barWidth, Math.max(valHeight, 1), 0.5, 0.5, 'F');

      // Valor no topo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(14, 47, 80);
      doc.text(String(t.novosCadastros), bX + barWidth / 2, bY - 1.5, { align: 'center' });

      // Label do mês no rodapé
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(100, 115, 130);
      doc.text(t.label, bX + barWidth / 2, chartY + chartH - 4, { align: 'center' });
    });

    currentY += chartH + 10;
  }

  // 3. CAMPO DE ASSINATURA / ENCERRAMENTO INSTITUCIONAL
  const signY = currentY + 12;
  const colSignW = (pageWidth - 48) / 2;

  // Assinatura 1: Secretaria Geral
  doc.setDrawColor(180, 190, 205);
  doc.setLineWidth(0.5);
  doc.line(20, signY, 20 + colSignW, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(14, 47, 80);
  doc.text('SECRETARIA GERAL', 20 + colSignW / 2, signY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 110, 125);
  doc.text('Responsável pela Consolidação Cadastral', 20 + colSignW / 2, signY + 8.5, { align: 'center' });

  // Assinatura 2: Presidência do Ministério
  const signX2 = 28 + colSignW;
  doc.line(signX2, signY, signX2 + colSignW, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(14, 47, 80);
  doc.text('PRESIDÊNCIA DO MINISTÉRIO', signX2 + colSignW / 2, signY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 110, 125);
  doc.text(dados.responsavelMinisterio || 'Pastor Presidente', signX2 + colSignW / 2, signY + 8.5, {
    align: 'center',
  });
}

/**
 * Função principal que gera e efetua o download do Relatório Gerencial Consolidado em PDF.
 */
export async function gerarRelatorioGerencialSecretariaPDF(
  dados: DadosRelatorioGerencialSecretaria
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Carregar logo se houver
  const logoImg = await carregarLogoBase64(dados.logoMinisterioUrl);

  // Página 1: Capa Executiva
  renderizarCapa(doc, dados, logoImg);

  // Página 2: Resumo Executivo & Auditoria
  renderizarResumoExecutivo(doc, dados, logoImg);

  // Página 3: Demografia & Quadro Ministerial
  renderizarDemografiaEQuadro(doc, dados, logoImg);

  // Página 4: Congregações & Histórico de Crescimento
  renderizarCongregacoesEEvolucao(doc, dados, logoImg);

  // Aplicar cabeçalhos dinâmicos e rodapés com totalização de páginas
  aplicarRodapes(doc, dados);

  return doc;
}
