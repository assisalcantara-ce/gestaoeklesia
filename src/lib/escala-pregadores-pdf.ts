import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ItemRelatorioEscala {
  numero: number;
  data: string;
  horario: string;
  diaSemana: string;
  cultoTitulo: string;
  tipoCulto?: string | null;
  congregacaoNome: string;
  isSede?: boolean;
  local?: string | null;
  pregadorNome: string;
  cargoMinisterial: string;
  situacaoEscala: 'confirmado' | 'escalado' | 'sem_pregador' | 'cancelado';
  temaMensagem?: string | null;
  textoBiblico?: string | null;
}

export interface DadosRelatorioEscala {
  nomeMinisterio: string;
  subtituloMinisterio?: string | null;
  cnpjMinisterio?: string | null;
  cidadeUf?: string | null;
  logoMinisterioUrl?: string | null;
  periodoReferencia: string;
  tipoEscala: 'Semanal' | 'Mensal' | 'Personalizada';
  congregacaoFiltro: string;
  situacaoFiltro: string;
  dataEmissao: string;
  totalEventos: number;
  totalEscalados: number;
  totalConfirmados: number;
  totalSemPregador: number;
  itens: ItemRelatorioEscala[];
}

async function carregarImagemBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarPdfEscalaPregadores(dados: DadosRelatorioEscala): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  let currentY = 14;

  // 1. Cabeçalho Institucional
  let logoBase64: string | null = null;
  if (dados.logoMinisterioUrl) {
    logoBase64 = await carregarImagemBase64(dados.logoMinisterioUrl);
  }

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', marginX, currentY, 22, 22);
    } catch {
      // Caso haja erro no parse de imagem, segue sem logo
    }
  }

  const textStartX = logoBase64 ? marginX + 26 : marginX;

  // Nome do Ministério / Igreja
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(24, 30, 42); // Slate-900
  doc.text((dados.nomeMinisterio || 'GESTÃO EKLÉSIA').toUpperCase(), textStartX, currentY + 6);

  // Subtítulo e CNPJ
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  const subLinha = [
    dados.subtituloMinisterio || 'Secretaria Geral • Gestão Integrada',
    dados.cnpjMinisterio ? `CNPJ: ${dados.cnpjMinisterio}` : null,
    dados.cidadeUf,
  ]
    .filter(Boolean)
    .join(' • ');

  doc.text(subLinha, textStartX, currentY + 11);

  // Título do Documento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138); // Blue-900
  doc.text('ESCALA DE PREGADORES', textStartX, currentY + 18);

  currentY += 25;

  // Linha divisória
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.5);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 4;

  // 2. Metadados do Relatório (Período, Filtros e Emissão)
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  doc.text('PERÍODO:', marginX + 3, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.periodoReferencia, marginX + 20, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('CONGREGAÇÃO:', marginX + 75, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.congregacaoFiltro, marginX + 102, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('SITUAÇÃO:', marginX + 3, currentY + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.situacaoFiltro, marginX + 20, currentY + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('EMISSÃO:', marginX + 75, currentY + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.dataEmissao, marginX + 92, currentY + 11);

  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text('Horário Oficial: America/Belém (UTC−3)', pageWidth - marginX - 55, currentY + 11);

  currentY += 19;

  // 3. Resumo Estatístico em Cards
  const cardWidth = (pageWidth - marginX * 2 - 9) / 4;
  const cards = [
    { label: 'TOTAL DE CULTOS', valor: dados.totalEventos, bg: [241, 245, 249], text: [30, 41, 59] },
    { label: 'CONFIRMADOS', valor: dados.totalConfirmados, bg: [236, 253, 245], text: [6, 95, 70] },
    { label: 'ESCALADOS', valor: dados.totalEscalados, bg: [239, 246, 255], text: [29, 78, 216] },
    { label: 'SEM PREGADOR', valor: dados.totalSemPregador, bg: [254, 243, 199], text: [146, 64, 14] },
  ];

  cards.forEach((c, idx) => {
    const cardX = marginX + idx * (cardWidth + 3);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.roundedRect(cardX, currentY, cardWidth, 12, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(c.text[0], c.text[1], c.text[2]);
    doc.text(c.label, cardX + 3, currentY + 4.5);

    doc.setFontSize(10);
    doc.text(String(c.valor), cardX + 3, currentY + 10);
  });

  currentY += 16;

  // 4. Tabela de Escala de Pregadores com AutoTable
  const bodyRows = dados.itens.map((item) => {
    const situacaoMap: Record<string, string> = {
      confirmado: 'Confirmado',
      escalado: 'Escalado',
      sem_pregador: 'Sem Pregador',
      cancelado: 'Cancelado',
    };

    const textoTema = item.temaMensagem ? `Tema: "${item.temaMensagem}"` : '';

    return [
      item.numero.toString(),
      `${item.data}\n${item.diaSemana}\n${item.horario}`,
      `${item.cultoTitulo}\n${item.congregacaoNome}${item.isSede ? ' (Sede)' : ''}${item.local ? `\nLocal: ${item.local}` : ''}`,
      item.pregadorNome ? `${item.pregadorNome}\n${item.cargoMinisterial || 'Ministro'}${textoTema ? `\n${textoTema}` : ''}` : '— Em Aberto —',
      situacaoMap[item.situacaoEscala] || item.situacaoEscala,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'DATA / HORA', 'CULTO / CONGREGAÇÃO', 'PREGADOR ESCALADO / CARGO', 'SITUAÇÃO']],
    body: bodyRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [30, 58, 138], // Blue-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 58 },
      3: { cellWidth: 62 },
      4: { cellWidth: 24, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Estilização condicional da coluna de Situação (coluna 4)
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw);
        if (text === 'Confirmado') {
          data.cell.styles.textColor = [6, 95, 70]; // Emerald
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'Escalado') {
          data.cell.styles.textColor = [29, 78, 216]; // Blue
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'Sem Pregador') {
          data.cell.styles.textColor = [180, 83, 9]; // Amber
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'Cancelado') {
          data.cell.styles.textColor = [185, 28, 28]; // Red
          data.cell.styles.fontStyle = 'bold';
        }
      }

      // Se não tiver pregador, destacar em aberto na coluna 3
      if (data.section === 'body' && data.column.index === 3) {
        const text = String(data.cell.raw);
        if (text.includes('— Em Aberto —')) {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'italic';
        }
      }
    },
    didDrawPage: (data) => {
      // Rodapé da Página
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      doc.text(
        'Documento Oficial da Secretaria Geral • Gestão Eklésia',
        marginX,
        pageHeight - 8
      );
      doc.text(str, pageWidth - marginX - 20, pageHeight - 8);
    },
    margin: { left: marginX, right: marginX, bottom: 15 },
  });

  return doc;
}
