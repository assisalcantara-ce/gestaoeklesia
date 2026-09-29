import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ParticipanteRelatorio {
  numero: number;
  nome: string;
  cargo: string;
  congregacao: string;
  setorArea?: string | null;
  statusPresenca: 'presente' | 'falta' | 'falta_justificada' | 'pendente' | string;
  horarioCheckin?: string | null;
  justificativa?: string | null;
}

export interface DadosRelatorioReuniao {
  reuniaoId: string;
  tituloReuniao: string;
  pauta?: string | null;
  dataReuniao: string;
  horarioInicio: string;
  horarioFim?: string | null;
  localReuniao: string;
  nomeCongregacao?: string | null;
  statusReuniao: string;
  
  // Estatísticas
  totalConvocados: number;
  totalPresentes: number;
  totalAusentes: number;
  totalJustificados: number;
  indicePresenca: string; // Ex: "85.5%"

  // Identidade do Tenant
  nomeMinisterio: string;
  subtituloMinisterio?: string | null;
  cnpjMinisterio?: string | null;
  cidadeUf?: string | null;
  logoMinisterioUrl?: string | null;
  
  // Metadados
  dataEmissao: string;
  filtrosAplicados?: string | null;

  // Participantes
  participantes: ParticipanteRelatorio[];
}

/**
 * Tenta buscar o logo via URL e converter para Base64 para inclusão no jsPDF.
 */
async function carregarLogoBase64(url?: string | null): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return null;

    const isPng = contentType.includes('png') || url.toLowerCase().endsWith('.png');
    const format = isPng ? 'PNG' : 'JPEG';
    const base64 = buffer.toString('base64');
    return {
      data: `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${base64}`,
      format,
    };
  } catch {
    return null;
  }
}

/**
 * Formata o rótulo de status de presença para exibição limpa.
 */
function formatarStatusPresenca(status: string): string {
  switch (status) {
    case 'presente':
      return 'Presente';
    case 'falta':
      return 'Falta';
    case 'falta_justificada':
      return 'Falta Justificada';
    case 'pendente':
      return 'Pendente';
    default:
      return status || '—';
  }
}

/**
 * Gera o documento PDF formal em formato A4 do Relatório da Reunião Ministerial.
 */
export async function gerarRelatorioReuniaoPDF(dados: DadosRelatorioReuniao): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const logoInfo = await carregarLogoBase64(dados.logoMinisterioUrl);

  // ─── Função de Desenho do Cabeçalho Institucional ─────────────────────────
  const desenharCabecalho = (_pageNumber?: number) => {
    const headerTop = 10;
    let textStartX = margin;
    const maxLogoWidth = 22;
    const maxLogoHeight = 16;

    if (logoInfo) {
      try {
        doc.addImage(logoInfo.data, logoInfo.format, margin, headerTop, maxLogoWidth, maxLogoHeight, undefined, 'FAST');
        textStartX = margin + maxLogoWidth + 4;
      } catch {
        textStartX = margin;
      }
    }

    // Nome da Instituição
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(18, 59, 99); // Azul corporativo
    const nomeIgreja = (dados.nomeMinisterio || 'GESTÃO EKLÉSIA').toUpperCase();
    doc.text(nomeIgreja, textStartX, headerTop + 4);

    // Subtítulo / Órgão
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const sub = (dados.subtituloMinisterio || 'SISTEMA INTEGRADO DE GESTÃO MINISTERIAL • MESA DIRETORA').toUpperCase();
    doc.text(sub, textStartX, headerTop + 8);

    // CNPJ e Localidade
    const infoLinha = [
      dados.cnpjMinisterio ? `CNPJ: ${dados.cnpjMinisterio}` : '',
      dados.cidadeUf ? dados.cidadeUf : '',
    ]
      .filter(Boolean)
      .join(' • ');

    if (infoLinha) {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(infoLinha, textStartX, headerTop + 12);
    }

    // Título do Documento à Direita / Linha Inferior
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(18, 59, 99);
    doc.text('DETALHES DA REUNIÃO MINISTERIAL', pageWidth - margin, headerTop + 4, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emissão: ${dados.dataEmissao}`, pageWidth - margin, headerTop + 8, { align: 'right' });

    // Linha Divisória Institucional
    const lineY = headerTop + 17;
    doc.setDrawColor(18, 59, 99);
    doc.setLineWidth(0.6);
    doc.line(margin, lineY, pageWidth - margin, lineY);
  };

  // Desenhar cabeçalho da página 1
  desenharCabecalho(1);

  let curY = 31;

  // ─── Bloco 1: Informações Principais da Reunião (Página 1) ─────────────────
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.3);

  // Estimativa de altura do box dependendo da pauta
  const temPauta = Boolean(dados.pauta && dados.pauta.trim());
  const boxHeight = temPauta ? 36 : 28;
  doc.roundedRect(margin, curY, contentWidth, boxHeight, 2, 2, 'FD');

  curY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(dados.tituloReuniao.toUpperCase(), margin + 3.5, curY);

  // Status Badge
  const statusStr = (dados.statusReuniao || 'AGENDADA').toUpperCase();
  const statusWidth = doc.getTextWidth(statusStr) + 6;
  const statusX = pageWidth - margin - statusWidth - 3.5;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(statusX, curY - 3.5, statusWidth, 5, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(statusStr, statusX + statusWidth / 2, curY - 0.2, { align: 'center' });

  // Detalhes em grade
  curY += 5;
  doc.setFontSize(7.5);

  // Coluna 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('DATA:', margin + 3.5, curY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dados.dataReuniao, margin + 16, curY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('HORÁRIO:', margin + 45, curY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const horarioTexto = dados.horarioFim ? `${dados.horarioInicio} às ${dados.horarioFim}` : dados.horarioInicio;
  doc.text(horarioTexto, margin + 61, curY);

  // Coluna 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('LOCAL:', margin + 95, curY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dados.localReuniao || 'Templo Sede', margin + 108, curY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('CONGREGAÇÃO:', margin + 140, curY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dados.nomeCongregacao || 'Geral / Todas', margin + 164, curY);

  // Pauta (se houver)
  if (temPauta) {
    curY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('PAUTA:', margin + 3.5, curY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const pautaTexto = doc.splitTextToSize(dados.pauta || '', contentWidth - 22);
    doc.text(pautaTexto[0] || '', margin + 16, curY);
  }

  // Linha de filtros aplicados
  if (dados.filtrosAplicados) {
    curY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text(`FILTROS APLICADOS: ${dados.filtrosAplicados}`, margin + 3.5, curY);
  }

  curY = curY + (temPauta ? 7 : 6);

  // ─── Bloco 2: Indicadores de Presença (KPI Cards) ──────────────────────────
  const kpiWidth = (contentWidth - 4 * 2.5) / 5;
  const kpiHeight = 13;

  const kpis = [
    { label: 'CONVOCADOS', valor: String(dados.totalConvocados), bg: [241, 245, 249], border: [203, 213, 225], text: [15, 23, 42] },
    { label: 'PRESENTES', valor: String(dados.totalPresentes), bg: [236, 253, 245], border: [167, 243, 208], text: [4, 120, 87] },
    { label: 'AUSENTES', valor: String(dados.totalAusentes), bg: [255, 241, 242], border: [254, 205, 211], text: [190, 18, 60] },
    { label: 'JUSTIFICADOS', valor: String(dados.totalJustificados), bg: [254, 243, 199], border: [253, 230, 138], text: [180, 83, 9] },
    { label: 'ÍNDICE PRESENÇA', valor: dados.indicePresenca, bg: [239, 246, 255], border: [191, 219, 254], text: [29, 78, 216] },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiWidth + 2.5);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.roundedRect(kpiX, curY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, kpiX + kpiWidth / 2, curY + 4, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
    doc.text(kpi.valor, kpiX + kpiWidth / 2, curY + 10, { align: 'center' });
  });

  curY += kpiHeight + 5;

  // ─── Bloco 3: Tabela de Ministros Convocados com autoTable ────────────────
  const tableData = dados.participantes.map((p) => {
    const congCompleta = [p.congregacao || 'Sede', p.setorArea ? `(${p.setorArea})` : ''].filter(Boolean).join(' ');
    return [
      String(p.numero),
      p.nome.toUpperCase(),
      p.cargo.toUpperCase(),
      congCompleta.toUpperCase(),
      formatarStatusPresenca(p.statusPresenca),
      p.horarioCheckin || '—',
      p.justificativa || '—',
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [['Nº', 'MINISTRO / OBREIRO', 'CARGO', 'CONGREGAÇÃO / ÁREA', 'PRESENÇA', 'CHECK-IN', 'JUSTIFICATIVA']],
    body: tableData,
    theme: 'grid',
    margin: { top: 30, bottom: 16, left: margin, right: margin },
    headStyles: {
      fillColor: [18, 59, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2,
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 48 },
      2: { halign: 'left', cellWidth: 30 },
      3: { halign: 'left', cellWidth: 35 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 23 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'left', cellWidth: 'auto' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Cores personalizadas para status de presença na tabela
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw).toLowerCase();
        if (val.includes('presente')) {
          data.cell.styles.textColor = [4, 120, 87]; // Emerald
        } else if (val.includes('justificada')) {
          data.cell.styles.textColor = [180, 83, 9]; // Amber
        } else if (val.includes('falta')) {
          data.cell.styles.textColor = [190, 18, 60]; // Rose
        } else {
          data.cell.styles.textColor = [100, 116, 139]; // Slate
        }
      }
    },
    didDrawPage: (hookData) => {
      // Repetir cabeçalho institucional em páginas subsequentes
      if (hookData.pageNumber > 1) {
        desenharCabecalho(hookData.pageNumber);
      }
    },
  });

  // ─── Rodapé Institucional em Todas as Páginas ─────────────────────────────
  const totalPaginas = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 9;

    // Linha do Rodapé
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    // Texto do Rodapé
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);

    const rodapeEsquerda = `Gestão Eklésia • ${dados.nomeMinisterio || 'Ministério'} • Documento emitido em ${dados.dataEmissao}`;
    doc.text(rodapeEsquerda, margin, footerY + 1.5);

    const rodapeDireita = `Página ${i} de ${totalPaginas}`;
    doc.text(rodapeDireita, pageWidth - margin, footerY + 1.5, { align: 'right' });
  }

  const output = doc.output('arraybuffer');
  return new Uint8Array(output);
}
