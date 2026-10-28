import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ParticipanteRelatorioEvento {
  numero: number;
  nome: string;
  tipoParticipante: 'Membro' | 'Externo';
  congregacao: string;
  situacaoInscricao: string;
  presenca: 'Presente' | 'Ausente';
  horarioCheckin?: string | null;
  comHospedagem?: boolean;
}

export interface ConsolidacaoCongregacao {
  congregacao: string;
  totalInscritos: number;
  confirmados: number;
  presentes: number;
  ausentes: number;
  taxaPresenca: string;
}

export interface ResumoFinanceiroEvento {
  eventoPago: boolean;
  valorInscricao: number;
  totalInscricoesValidas: number;
  totalPrevisto: number;
  totalRecebido: number;
  totalPendente: number;
  totalCanceladoEstornado: number;
  formasPagamento: Array<{ forma: string; qtd: number; valorTotal: number }>;
}

export interface BeneficiosOperacaoEvento {
  hospedagemHabilitada: boolean;
  hospedagemDescricao?: string | null;
  totalHospedagemSolicitada: number;
  totalHospedagemConfirmada: number;
  alimentacaoInclusa: boolean;
  brindeHabilitado: boolean;
  brindeQuantidade?: number | null;
  brindesEntregues: number;
  certificadoHabilitado: boolean;
  certificadosEmitidos: number;
}

export interface DadosRelatorioEvento {
  eventoId: string;
  tituloEvento: string;
  tipoEvento: string;
  dataInicio: string;
  dataFim?: string | null;
  horarioInicio?: string | null;
  localNome?: string | null;
  localEndereco?: string | null;
  nomeCongregacao?: string | null;
  statusEvento: string;
  capacidade?: number | null;

  // Resumo Executivo
  totalInscricoesValidas: number; // confirmados + presentes + aguardando_pagamento
  totalConfirmados: number;
  totalPresentes: number;
  totalAusentes: number;
  totalCancelados: number;
  totalListaEspera: number;
  taxaComparecimento: string; // Ex: "85%"
  taxaCancelamento: string;    // Ex: "5%"
  membrosQtd: number;
  externosQtd: number;

  // Participação por Congregação
  consolidacaoCongregacoes: ConsolidacaoCongregacao[];

  // Financeiro
  financeiro: ResumoFinanceiroEvento;

  // Benefícios e Operação
  beneficios: BeneficiosOperacaoEvento;

  // Identidade Institucional
  nomeMinisterio: string;
  subtituloMinisterio?: string | null;
  cnpjMinisterio?: string | null;
  cidadeUf?: string | null;
  logoMinisterioUrl?: string | null;
  dataEmissao: string;

  // Relação detalhada de participantes
  participantes: ParticipanteRelatorioEvento[];
}

/**
 * Tenta buscar o logo (Data URI, URL HTTP ou Base64) e converter para inclusão no jsPDF.
 */
async function carregarLogoBase64(url?: string | null): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const cleanUrl = url.trim();

  if (cleanUrl.startsWith('data:image/')) {
    const isPng = cleanUrl.includes('image/png') || !cleanUrl.includes('image/jpeg');
    return { data: cleanUrl, format: isPng ? 'PNG' : 'JPEG' };
  }

  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    try {
      const res = await fetch(cleanUrl, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) return null;

      const isPng = contentType.includes('png') || cleanUrl.toLowerCase().endsWith('.png');
      const base64 = buffer.toString('base64');
      return {
        data: `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${base64}`,
        format: isPng ? 'PNG' : 'JPEG',
      };
    } catch {
      return null;
    }
  }

  if (cleanUrl.length > 50 && /^[A-Za-z0-9+/=\r\n]+$/.test(cleanUrl.slice(0, 50))) {
    return {
      data: `data:image/png;base64,${cleanUrl.replace(/\r?\n|\r/g, '')}`,
      format: 'PNG',
    };
  }

  return null;
}

function fmtBRL(val: number): string {
  return `R$ ${val.toFixed(2).replace('.', ',')}`;
}

/**
 * Gera o documento institucional formal em PDF A4 do Relatório Gerencial do Evento
 */
export async function gerarRelatorioGerencialEventoPDF(dados: DadosRelatorioEvento): Promise<Uint8Array> {
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
          finalLogoW = logoBoxW;
          finalLogoH = logoBoxW / imgAspect;
        } else {
          finalLogoH = logoBoxH;
          finalLogoW = logoBoxH * imgAspect;
        }

        const logoX = margin + (logoBoxW - finalLogoW) / 2;
        const logoY = headerTop + (logoBoxH - finalLogoH) / 2;

        doc.addImage(logoInfo.data, logoInfo.format, logoX, logoY, finalLogoW, finalLogoH, undefined, 'FAST');
        textStartX = margin + logoBoxW + 4;
      } catch {
        textStartX = margin;
      }
    }

    // Nome da Instituição / Ministério
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(18, 59, 99); // Azul Marinho Eklésia
    const nomeIgreja = (dados.nomeMinisterio || 'GESTÃO EKLÉSIA').toUpperCase();
    doc.text(nomeIgreja, textStartX, headerTop + 3.8);

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    const sub = (dados.subtituloMinisterio || 'SISTEMA INTEGRADO DE GESTÃO MINISTERIAL • PRESTAÇÃO DE CONTAS').toUpperCase();
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
    doc.setFontSize(9);
    doc.setTextColor(18, 59, 99);
    doc.text('RELATÓRIO GERENCIAL DO EVENTO', pageWidth - margin, headerTop + 3.8, { align: 'right' });

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

  desenharCabecalho(1);
  let curY = 28;

  // ─── 2. Bloco: Ficha Técnica do Evento ─────────────────────────────────────
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, curY, contentWidth, 23, 1.5, 1.5, 'FD');

  // Título e Status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(dados.tituloEvento.toUpperCase(), margin + 4, curY + 5.5);

  const statusStr = dados.statusEvento.toUpperCase();
  const statusWidth = doc.getTextWidth(statusStr) + 6;
  const statusX = pageWidth - margin - statusWidth - 4;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(statusX, curY + 1.8, statusWidth, 4.8, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(statusStr, statusX + statusWidth / 2, curY + 5.1, { align: 'center' });

  // Metadados linha 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const linhaMeta1 = `Tipo: ${dados.tipoEvento}  •  Data: ${dados.dataInicio}${dados.dataFim ? ` até ${dados.dataFim}` : ''}${dados.horarioInicio ? ` às ${dados.horarioInicio}` : ''}  •  Congregação: ${dados.nomeCongregacao || 'Geral / Todas'}`;
  doc.text(linhaMeta1, margin + 4, curY + 11.5);

  // Metadados linha 2
  const localCompleto = [dados.localNome, dados.localEndereco].filter(Boolean).join(' - ') || 'Local não informado';
  const capacidadeTxt = dados.capacidade != null ? `Capacidade: ${dados.capacidade} vagas` : 'Capacidade: Livre';
  const precoTxt = dados.financeiro.eventoPago ? `Valor da Inscrição: ${fmtBRL(dados.financeiro.valorInscricao)}` : 'Inscrição Gratuita';
  const linhaMeta2 = `Local: ${localCompleto}  •  ${capacidadeTxt}  •  ${precoTxt}`;
  doc.text(linhaMeta2, margin + 4, curY + 16.5);

  curY += 27;

  // ─── 3. Resumo Executivo (Cards Estatísticos) ──────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(18, 59, 99);
  doc.text('1. RESUMO EXECUTIVO DE INSCRIÇÕES E COMPARECIMENTO', margin, curY);
  curY += 3;

  const cardCols = 6;
  const cardGap = 2.5;
  const cardW = (contentWidth - cardGap * (cardCols - 1)) / cardCols;
  const cardH = 15;

  const kpis = [
    { label: 'Inscrições Válidas', val: String(dados.totalInscricoesValidas), cor: [15, 23, 42], bg: [241, 245, 249] },
    { label: 'Confirmadas', val: String(dados.totalConfirmados), cor: [37, 99, 235], bg: [239, 246, 255] },
    { label: 'Presentes (Check-in)', val: String(dados.totalPresentes), cor: [5, 150, 105], bg: [236, 253, 245] },
    { label: 'Ausentes', val: String(dados.totalAusentes), cor: [100, 116, 139], bg: [248, 250, 252] },
    { label: 'Canceladas', val: String(dados.totalCancelados), cor: [225, 29, 72], bg: [255, 241, 242] },
    { label: 'Lista de Espera', val: String(dados.totalListaEspera), cor: [217, 119, 6], bg: [254, 243, 199] },
  ];

  kpis.forEach((kpi, idx) => {
    const kX = margin + idx * (cardW + cardGap);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(kX, curY, cardW, cardH, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(kpi.cor[0], kpi.cor[1], kpi.cor[2]);
    doc.text(kpi.val, kX + cardW / 2, curY + 6.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.label, kX + cardW / 2, curY + 11.5, { align: 'center' });
  });

  curY += cardH + 3.5;

  // Barra de Indicadores com denominadores explícitos
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, curY, contentWidth, 8, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  const indComparecimento = `Taxa de Comparecimento: ${dados.taxaComparecimento} (${dados.totalPresentes} presentes sobre ${dados.totalConfirmados} confirmados)`;
  const indCancelamento = `Taxa de Cancelamento: ${dados.taxaCancelamento} (${dados.totalCancelados} cancelados sobre ${dados.totalInscricoesValidas + dados.totalCancelados} solicitações)`;
  const indComposicao = `Composição: ${dados.membrosQtd} Membro(s)  •  ${dados.externosQtd} Participante(s) Externo(s)`;

  doc.text(indComparecimento, margin + 4, curY + 5.2);
  doc.text(indCancelamento, margin + 85, curY + 5.2);
  doc.text(indComposicao, pageWidth - margin - 4, curY + 5.2, { align: 'right' });

  curY += 12;

  // ─── 4. Bloco Financeiro e Operacional (Lado a Lado ou Seção) ───────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(18, 59, 99);
  doc.text('2. PRESTAÇÃO DE CONTAS FINANCEIRA E OPERAÇÃO DE BENEFÍCIOS', margin, curY);
  curY += 3;

  const finW = contentWidth * 0.54;
  const opW = contentWidth - finW - 3;
  const finH = 29;

  // Card Financeiro
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, curY, finW, finH, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(18, 59, 99);
  doc.text('ARRECADAÇÃO E CONCILIAÇÃO FINANCEIRA', margin + 3.5, curY + 4.5);

  if (!dados.financeiro.eventoPago) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Evento gratuito — sem arrecadação de inscrições.', margin + 3.5, curY + 12);
    doc.text('Nenhuma taxa cobrada aos participantes.', margin + 3.5, curY + 17);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);

    // Linha Previsto vs Recebido
    doc.text(`Valor Previsto (Inscrições Válidas):`, margin + 3.5, curY + 9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(fmtBRL(dados.financeiro.totalPrevisto), margin + 65, curY + 9.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Efetivamente Recebido (Conciliado):`, margin + 3.5, curY + 14.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text(fmtBRL(dados.financeiro.totalRecebido), margin + 65, curY + 14.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Valores Pendentes (Aguardando):`, margin + 3.5, curY + 19.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(217, 119, 6);
    doc.text(fmtBRL(dados.financeiro.totalPendente), margin + 65, curY + 19.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Valores Cancelados / Expirados:`, margin + 3.5, curY + 24.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(225, 29, 72);
    doc.text(fmtBRL(dados.financeiro.totalCanceladoEstornado), margin + 65, curY + 24.5, { align: 'right' });

    // Detalhe de Formas de Pagamento
    const formasStr = dados.financeiro.formasPagamento.length > 0
      ? dados.financeiro.formasPagamento.map(f => `${f.forma}: ${fmtBRL(f.valorTotal)} (${f.qtd})`).join(' • ')
      : 'Nenhuma transação registrada';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(`Formas: ${formasStr}`, margin + 3.5, curY + 27.5, { maxWidth: finW - 7 });
  }

  // Card Benefícios e Operação
  const opX = margin + finW + 3;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(opX, curY, opW, finH, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(18, 59, 99);
  doc.text('LOGÍSTICA E BENEFÍCIOS', opX + 3.5, curY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);

  const hospTxt = dados.beneficios.hospedagemHabilitada
    ? `Hospedagem: ${dados.beneficios.totalHospedagemConfirmada} confirmadas / ${dados.beneficios.totalHospedagemSolicitada} solicitadas`
    : 'Hospedagem: Não aplicável';
  doc.text(hospTxt, opX + 3.5, curY + 9.5);

  const alimTxt = dados.beneficios.alimentacaoInclusa ? 'Alimentação Inclusa: Sim (prevista)' : 'Alimentação: Não inclusa';
  doc.text(alimTxt, opX + 3.5, curY + 14.5);

  const brindeTxt = dados.beneficios.brindeHabilitado
    ? `Brindes: ${dados.beneficios.brindesEntregues} entregues${dados.beneficios.brindeQuantidade ? ` de ${dados.beneficios.brindeQuantidade} previstos` : ''}`
    : 'Brindes: Não habilitado';
  doc.text(brindeTxt, opX + 3.5, curY + 19.5);

  const certTxt = dados.beneficios.certificadoHabilitado
    ? `Certificados: ${dados.beneficios.certificadosEmitidos} emitidos`
    : 'Certificados: Não habilitado';
  doc.text(certTxt, opX + 3.5, curY + 24.5);

  curY += finH + 4;

  // ─── 5. Tabela de Consolidação por Congregação ─────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(18, 59, 99);
  doc.text('3. CONSOLIDAÇÃO DE PARTICIPAÇÃO POR CONGREGAÇÃO', margin, curY);
  curY += 2;

  const colunasCong = ['Congregação', 'Inscritos', 'Confirmados', 'Presentes', 'Ausentes', 'Comparecimento'];
  const linhasCong = dados.consolidacaoCongregacoes.map(c => [
    c.congregacao,
    String(c.totalInscritos),
    String(c.confirmados),
    String(c.presentes),
    String(c.ausentes),
    c.taxaPresenca,
  ]);

  autoTable(doc, {
    startY: curY,
    head: [colunasCong],
    body: linhasCong.length > 0 ? linhasCong : [['Nenhuma congregação registrada', '0', '0', '0', '0', '0%']],
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.5,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [18, 59, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) desenharCabecalho(hookData.pageNumber);
    },
  });

  const lastTableFinalY = (doc as any).lastAutoTable.finalY || curY + 20;
  curY = lastTableFinalY + 5;

  // ─── 6. Relação Detalhada de Participantes (com quebra limpa e sem dados sensíveis) ───
  // Se estiver muito perto do fim da página, força nova página para o início da lista
  if (curY > pageHeight - 40) {
    doc.addPage();
    desenharCabecalho(doc.getNumberOfPages());
    curY = 28;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(18, 59, 99);
  doc.text('4. LISTAGEM OFICIAL DE PARTICIPANTES', margin, curY);
  curY += 2;

  const colunasPart = ['Nº', 'Nome do Participante', 'Vínculo', 'Congregação', 'Situação', 'Presença', 'Hospedagem'];
  const linhasPart = dados.participantes.map(p => [
    String(p.numero),
    p.nome,
    p.tipoParticipante,
    p.congregacao,
    p.situacaoInscricao,
    p.presenca + (p.horarioCheckin ? ` (${p.horarioCheckin})` : ''),
    p.comHospedagem ? 'Sim' : '—',
  ]);

  autoTable(doc, {
    startY: curY,
    head: [colunasPart],
    body: linhasPart.length > 0 ? linhasPart : [['—', 'Nenhum participante inscrito', '—', '—', '—', '—', '—']],
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 15 },
    styles: {
      fontSize: 6.5,
      cellPadding: 1.6,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [18, 59, 99],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 54 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'left', cellWidth: 42 },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 14 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = String(data.cell.raw).toLowerCase();
        if (val.includes('presente')) {
          data.cell.styles.textColor = [5, 150, 105]; // Emerald
        } else {
          data.cell.styles.textColor = [100, 116, 139]; // Slate
        }
      }
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw).toLowerCase();
        if (val.includes('confirmad')) {
          data.cell.styles.textColor = [37, 99, 235]; // Blue
        } else if (val.includes('cancelad')) {
          data.cell.styles.textColor = [225, 29, 72]; // Rose
        } else if (val.includes('espera')) {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
        }
      }
    },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        desenharCabecalho(hookData.pageNumber);
      }
    },
  });

  // ─── 7. Rodapé Institucional em Todas as Páginas ───────────────────────────
  const totalPaginas = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 8.5;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);

    const rodapeEsquerda = `Gestão Eklésia • ${dados.nomeMinisterio || 'Ministério'} • Prestação de Contas do Evento`;
    doc.text(rodapeEsquerda, margin, footerY + 1.2);

    const rodapeDireita = `Página ${i} de ${totalPaginas}`;
    doc.text(rodapeDireita, pageWidth - margin, footerY + 1.2, { align: 'right' });
  }

  const output = doc.output('arraybuffer');
  return new Uint8Array(output);
}
