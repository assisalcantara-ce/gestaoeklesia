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
 * Tenta buscar o logo (Data URI, URL HTTP ou Base64) e converter para inclusão no jsPDF.
 */
async function carregarLogoBase64(url?: string | null): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const cleanUrl = url.trim();

  // 1. Se já for Data URI (ex: data:image/png;base64,...)
  if (cleanUrl.startsWith('data:image/')) {
    const isPng = cleanUrl.includes('image/png') || !cleanUrl.includes('image/jpeg');
    const format = isPng ? 'PNG' : 'JPEG';
    return {
      data: cleanUrl,
      format,
    };
  }

  // 2. Se for uma URL externa HTTP / HTTPS
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    try {
      const res = await fetch(cleanUrl, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) return null;

      const isPng = contentType.includes('png') || cleanUrl.toLowerCase().endsWith('.png');
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

  // 3. Se for string Base64 pura (sem data:image/...)
  if (cleanUrl.length > 50 && /^[A-Za-z0-9+/=\r\n]+$/.test(cleanUrl.slice(0, 50))) {
    return {
      data: `data:image/png;base64,${cleanUrl.replace(/\r?\n|\r/g, '')}`,
      format: 'PNG',
    };
  }

  return null;
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
  const contentWidth = pageWidth - margin * 2; // 182mm

  const logoInfo = await carregarLogoBase64(dados.logoMinisterioUrl);

  // ─── 1. Função de Desenho do Cabeçalho Institucional ─────────────────────
  const desenharCabecalho = (_pageNumber?: number) => {
    const headerTop = 8;
    const logoBoxW = 20;
    const logoBoxH = 15;
    let textStartX = margin;

    // Logo do Tenant no Timbre (à esquerda com contenção proporcional e centralização vertical)
    if (logoInfo) {
      try {
        const imgProps = (doc as any).getImageProperties(logoInfo.data);
        const origW = imgProps.width || 1;
        const origH = imgProps.height || 1;
        const imgAspect = origW / origH;
        const boxAspect = logoBoxW / logoBoxH;

        let finalLogoW = logoBoxW;
        let finalLogoH = logoBoxH;

        if (imgAspect >= boxAspect) {
          // Imagem mais larga que a caixa
          finalLogoW = logoBoxW;
          finalLogoH = logoBoxW / imgAspect;
        } else {
          // Imagem mais alta que a caixa
          finalLogoH = logoBoxH;
          finalLogoW = logoBoxH * imgAspect;
        }

        // Centralização exata dentro do box reservado [margin, headerTop, logoBoxW, logoBoxH]
        const logoX = margin + (logoBoxW - finalLogoW) / 2;
        const logoY = headerTop + (logoBoxH - finalLogoH) / 2;

        doc.addImage(logoInfo.data, logoInfo.format, logoX, logoY, finalLogoW, finalLogoH, undefined, 'FAST');
        textStartX = margin + logoBoxW + 4;
      } catch {
        textStartX = margin;
      }
    }

    // Nome da Instituição
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(18, 59, 99); // Azul institucional Eklésia
    const nomeIgreja = (dados.nomeMinisterio || 'GESTÃO EKLÉSIA').toUpperCase();
    doc.text(nomeIgreja, textStartX, headerTop + 3.8);

    // Subtítulo / Órgão
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    const sub = (dados.subtituloMinisterio || 'SISTEMA INTEGRADO DE GESTÃO MINISTERIAL • MESA DIRETORA').toUpperCase();
    doc.text(sub, textStartX, headerTop + 8.2);

    // CNPJ e Localidade
    const infoLinha = [
      dados.cnpjMinisterio ? `CNPJ: ${dados.cnpjMinisterio}` : '',
      dados.cidadeUf ? dados.cidadeUf : '',
    ]
      .filter(Boolean)
      .join(' • ');

    if (infoLinha) {
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(infoLinha, textStartX, headerTop + 12.2);
    }

    // Título do Documento à Direita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(18, 59, 99);
    doc.text('DETALHES DA REUNIÃO MINISTERIAL', pageWidth - margin, headerTop + 3.8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emissão: ${dados.dataEmissao}`, pageWidth - margin, headerTop + 8.2, { align: 'right' });

    // Linha Divisória Institucional
    const lineY = 25.5;
    doc.setDrawColor(18, 59, 99);
    doc.setLineWidth(0.5);
    doc.line(margin, lineY, pageWidth - margin, lineY);
  };

  // Desenhar cabeçalho da página 1
  desenharCabecalho(1);

  let curY = 28.5;

  // ─── 2. Bloco: Informações Principais da Reunião ─────────────────────────
  const temPauta = Boolean(dados.pauta && dados.pauta.trim());
  const temFiltros = Boolean(dados.filtrosAplicados && dados.filtrosAplicados.trim());

  let boxHeight = 18;
  if (temPauta && temFiltros) boxHeight = 29;
  else if (temPauta) boxHeight = 24;
  else if (temFiltros) boxHeight = 23;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, curY, contentWidth, boxHeight, 1.5, 1.5, 'FD');

  // Título da Reunião
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(dados.tituloReuniao.toUpperCase(), margin + 4, curY + 5.2);

  // Status Badge
  const statusStr = (dados.statusReuniao || 'AGENDADA').toUpperCase();
  const statusWidth = doc.getTextWidth(statusStr) + 6;
  const statusX = pageWidth - margin - statusWidth - 4;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(statusX, curY + 1.8, statusWidth, 4.8, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text(statusStr, statusX + statusWidth / 2, curY + 5.1, { align: 'center' });

  // Grade de 4 Colunas Perfeita
  const rowGridY = curY + 11.2;
  doc.setFontSize(7.2);

  // Coluna 1: DATA
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('DATA:', margin + 4, rowGridY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dados.dataReuniao, margin + 14.5, rowGridY);

  // Coluna 2: HORÁRIO
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('HORÁRIO:', margin + 46, rowGridY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const horarioTexto = dados.horarioFim ? `${dados.horarioInicio} às ${dados.horarioFim}` : dados.horarioInicio;
  doc.text(horarioTexto, margin + 61, rowGridY);

  // Coluna 3: LOCAL
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('LOCAL:', margin + 94, rowGridY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dados.localReuniao || 'Templo Sede', margin + 106, rowGridY);

  // Coluna 4: CONGREGAÇÃO
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('CONGREGAÇÃO:', margin + 138, rowGridY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dados.nomeCongregacao || 'Geral / Todas', margin + 162, rowGridY);

  let nextInnerY = rowGridY + 5.2;

  // Linha de Pauta (se houver)
  if (temPauta) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('PAUTA:', margin + 4, nextInnerY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const pautaTexto = doc.splitTextToSize(dados.pauta || '', contentWidth - 22);
    doc.text(pautaTexto[0] || '', margin + 16, nextInnerY);
    nextInnerY += 5.2;
  }

  // Linha de Filtros Aplicados (se houver)
  if (temFiltros) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text(`FILTROS APLICADOS: ${dados.filtrosAplicados}`, margin + 4, nextInnerY);
  }

  curY += boxHeight + 4;

  // ─── 3. Cards de Indicadores de Presença (KPIs Uniformes) ─────────────────
  const gap = 2.5;
  const kpiWidth = (contentWidth - 4 * gap) / 5; // 34.4mm
  const kpiHeight = 13.5;

  const kpis = [
    { label: 'CONVOCADOS', valor: String(dados.totalConvocados), bg: [241, 245, 249], border: [203, 213, 225], text: [15, 23, 42] },
    { label: 'PRESENTES', valor: String(dados.totalPresentes), bg: [236, 253, 245], border: [167, 243, 208], text: [4, 120, 87] },
    { label: 'AUSENTES', valor: String(dados.totalAusentes), bg: [255, 241, 242], border: [254, 205, 211], text: [190, 18, 60] },
    { label: 'JUSTIFICADOS', valor: String(dados.totalJustificados), bg: [254, 243, 199], border: [253, 230, 138], text: [180, 83, 9] },
    { label: 'ÍNDICE PRESENÇA', valor: dados.indicePresenca, bg: [239, 246, 255], border: [191, 219, 254], text: [29, 78, 216] },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiWidth + gap);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.roundedRect(kpiX, curY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');

    // Título do Indicador
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, kpiX + kpiWidth / 2, curY + 4.3, { align: 'center' });

    // Valor do Indicador
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
    doc.text(kpi.valor, kpiX + kpiWidth / 2, curY + 10.5, { align: 'center' });
  });

  curY += kpiHeight + 4.5;

  // ─── 4. Tabela de Ministros Convocados com autoTable ───────────────────────
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
    head: [['Nº', 'MINISTRO / CONVOCADO', 'CARGO', 'CONGREGAÇÃO / ÁREA', 'PRESENÇA', 'CHECK-IN', 'JUSTIFICATIVA']],
    body: tableData,
    theme: 'grid',
    margin: { top: 29, bottom: 14, left: margin, right: margin },
    headStyles: {
      fillColor: [18, 59, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2.2,
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
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 52 },
      2: { halign: 'left', cellWidth: 28 },
      3: { halign: 'left', cellWidth: 36 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'left', cellWidth: 20 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Cores semânticas para status de presença na tabela
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

  // ─── 5. Rodapé Institucional em Todas as Páginas ───────────────────────────
  const totalPaginas = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 8.5;

    // Linha do Rodapé
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    // Texto do Rodapé
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);

    const rodapeEsquerda = `Gestão Eklésia • ${dados.nomeMinisterio || 'Ministério'} • Documento emitido em ${dados.dataEmissao}`;
    doc.text(rodapeEsquerda, margin, footerY + 1.2);

    const rodapeDireita = `Página ${i} de ${totalPaginas}`;
    doc.text(rodapeDireita, pageWidth - margin, footerY + 1.2, { align: 'right' });
  }

  const output = doc.output('arraybuffer');
  return new Uint8Array(output);
}
