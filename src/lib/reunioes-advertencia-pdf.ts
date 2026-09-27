import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface DadosCartaAdvertencia {
  protocolo: string;
  nomeMinisterio: string;
  logoMinisterioUrl?: string | null;
  nomeMinistro: string;
  cargoMinistro: string;
  nomeCongregacao: string;
  tituloReuniao: string;
  dataReuniao: string;
  horarioInicio: string;
  localReuniao: string;
  dataEmissao: string;
}

/**
 * Gera o documento PDF da Carta de Advertência Ministerial em formato A4
 * utilizando jsPDF. Retorna um Uint8Array contendo o binário do PDF.
 */
export async function gerarCartaAdvertenciaPDF(dados: DadosCartaAdvertencia): Promise<Uint8Array> {
  // Inicializa documento A4 em modo retrato (portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ─── 1. Borda Institucional Decorativa ─────────────────────────────────────
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  doc.setDrawColor(18, 59, 99);
  doc.setLineWidth(1);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // ─── 2. Cabeçalho Institucional ───────────────────────────────────────────
  let y = 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(18, 59, 99); // #123b63 institucional
  doc.text((dados.nomeMinisterio || 'GESTÃO EKLÉSIA').toUpperCase(), pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('SECRETARIA GERAL • CONTROLE DE PRESENÇA MINISTERIAL', pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.setDrawColor(18, 59, 99);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // ─── 3. Título do Documento & Protocolo ───────────────────────────────────
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(185, 28, 28); // Vermelho solene
  doc.text('CARTA DE ADVERTÊNCIA MINISTERIAL', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`PROTOCOLO OFICIAL: ${dados.protocolo}`, pageWidth / 2, y, { align: 'center' });

  // ─── 4. Dados da Convocação & Identificação do Ministro ───────────────────
  y += 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, 'FD');

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('MINISTRO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.nomeMinistro.toUpperCase(), margin + 26, y);

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text('CARGO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.cargoMinistro.toUpperCase(), margin + 26, y);

  doc.setFont('helvetica', 'bold');
  doc.text('CONGREGAÇÃO:', margin + 90, y);
  doc.setFont('helvetica', 'normal');
  doc.text((dados.nomeCongregacao || 'SEDE').toUpperCase(), margin + 120, y);

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text('REUNIÃO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.tituloReuniao.toUpperCase(), margin + 26, y);

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text('DATA DO ATO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${dados.dataReuniao} às ${dados.horarioInicio}`, margin + 29, y);

  doc.setFont('helvetica', 'bold');
  doc.text('LOCAL:', margin + 90, y);
  doc.setFont('helvetica', 'normal');
  doc.text((dados.localReuniao || 'TEMPLO SEDE').toUpperCase(), margin + 105, y);

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text('SITUAÇÃO:', margin + 4, y);
  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.text('AUSÊNCIA NÃO REGISTRADA / FALTA FORMAL', margin + 26, y);

  // ─── 5. Texto Notificatório / Notificação Institucional ───────────────────
  y += 11;
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setLineHeightFactor(1.35);

  const textoNotificacao = [
    `Prezado(a) Ministro(a),`,
    ``,
    `Notificamos formalmente que Vossa Senhoria esteve ausente na Reunião Ministerial supracitada, convocada pela liderança desta instituição. O comparecimento às convocações oficiais e reuniões administrativas integra o zelo e os deveres inerentes ao exercício do ministério eclesiástico.`,
    ``,
    `Em observância à disciplina e ordem ministerial, concede-se o prazo regulamentar para apresentação de justificativa formal por escrito perante a Secretaria Geral, devidamente acompanhada da comprovação cabível (quando for o caso), para análise e deliberação da Mesa Diretora.`,
  ];

  const linhasTexto = doc.splitTextToSize(textoNotificacao.join('\n'), contentWidth);
  doc.text(linhasTexto, margin, y);

  y += 38;

  // ─── 6. Campo para Justificativa Manuscrita de Próprio Punho ─────────────
  doc.setFillColor(254, 252, 232); // Amarelo suave
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(margin, y, contentWidth, 54, 3, 3, 'FD');

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(113, 63, 18);
  doc.text('ESPAÇO DESTINADO À JUSTIFICATIVA DE PRÓPRIO PUNHO (MANUSCRITA):', margin + 4, y);

  y += 6;
  doc.setDrawColor(220, 210, 170);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 5; i++) {
    doc.line(margin + 4, y + i * 8, margin + contentWidth - 4, y + i * 8);
  }

  y += 44;

  // ─── 7. Campos de Assinaturas e Recebimento ──────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);

  const colWidth = (contentWidth - 10) / 2;

  // Assinatura do Ministro
  const x1 = margin;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(x1 + 10, y + 12, x1 + colWidth - 10, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura e Ciência do Ministro', x1 + colWidth / 2, y + 16, { align: 'center' });
  doc.text(`Data: ____/____/________`, x1 + colWidth / 2, y + 20, { align: 'center' });

  // Recebimento pela Secretaria
  const x2 = margin + colWidth + 10;
  doc.line(x2 + 10, y + 12, x2 + colWidth - 10, y + 12);
  doc.text('Recebido pela Secretaria Geral', x2 + colWidth / 2, y + 16, { align: 'center' });
  doc.text(`Data: ____/____/________`, x2 + colWidth / 2, y + 20, { align: 'center' });

  // ─── 8. Rodapé com QR Code e Autenticação do Protocolo ───────────────────
  const footerY = pageHeight - 28;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  try {
    const qrDataUrl = await QRCode.toDataURL(dados.protocolo, {
      margin: 1,
      width: 60,
    });
    doc.addImage(qrDataUrl, 'PNG', margin, footerY + 2, 14, 14);
  } catch {
    // fallback caso falhe geração do QR
  }

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.text(`Documento gerado eletronicamente em ${dados.dataEmissao}`, margin + 18, footerY + 6);
  doc.text(`Autenticidade vinculada ao protocolo ${dados.protocolo}`, margin + 18, footerY + 10);
  doc.text('Gestão Eklésia™ — Sistema Integrado de Gestão Eclesiástica', margin + 18, footerY + 14);

  return new Uint8Array(doc.output('arraybuffer'));
}
