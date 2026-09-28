import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface DadosCartaAdvertencia {
  protocolo: string;
  nomeMinisterio: string;
  subtituloMinisterio?: string | null;
  cnpjMinisterio?: string | null;
  cidadeUf?: string | null;
  logoMinisterioUrl?: string | null;
  nomeMinistro: string;
  matriculaMinistro?: string | null;
  cargoMinistro: string;
  nomeCongregacao: string;
  setorArea?: string | null;
  tituloReuniao: string;
  dataReuniao: string;
  horarioInicio: string;
  localReuniao: string;
  dataEmissao: string;
  nomePresidente?: string | null;
  nomeSecretario?: string | null;
}

/**
 * Gera o documento PDF da Carta de Advertência Ministerial em formato A4
 * utilizando jsPDF com layout oficial e dados dinâmicos do obreiro e da instituição.
 * Retorna um Uint8Array contendo o binário do PDF.
 */
export async function gerarCartaAdvertenciaPDF(dados: DadosCartaAdvertencia): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // ─── 1. Bordas Institucionais Decorativas ──────────────────────────────────
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.4);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(18, 59, 99); // Azul corporativo Eklésia
  doc.setLineWidth(0.8);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // ─── 2. Cabeçalho Institucional ───────────────────────────────────────────
  let y = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(18, 59, 99);
  const nomeIgreja = (dados.nomeMinisterio || 'GESTÃO EKLÉSIA').toUpperCase();
  doc.text(nomeIgreja, pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const subCabecalho = (dados.subtituloMinisterio || 'SECRETARIA GERAL • MESA DIRETORA EXECUTIVA').toUpperCase();
  doc.text(subCabecalho, pageWidth / 2, y, { align: 'center' });

  if (dados.cnpjMinisterio || dados.cidadeUf) {
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const infoExtra = [
      dados.cnpjMinisterio ? `CNPJ: ${dados.cnpjMinisterio}` : '',
      dados.cidadeUf ? dados.cidadeUf : '',
    ]
      .filter(Boolean)
      .join(' • ');
    doc.text(infoExtra, pageWidth / 2, y, { align: 'center' });
  }

  y += 3.5;
  doc.setDrawColor(18, 59, 99);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // ─── 3. Título do Documento & Protocolo ───────────────────────────────────
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(185, 28, 28); // Vermelho institucional solene
  doc.text('CARTA DE ADVERTÊNCIA MINISTERIAL', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`PROTOCOLO OFICIAL: ${dados.protocolo}`, pageWidth / 2, y, { align: 'center' });

  // ─── 4. Quadro de Identificação do Ministro e Falta ───────────────────────
  y += 6;
  const boxHeight = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2.5, 2.5, 'FD');

  y += 5.5;
  doc.setFontSize(8.5);

  // Linha 1: Nome do Ministro e Matrícula
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('OBREIRO / MINISTRO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.nomeMinistro.toUpperCase(), margin + 38, y);

  if (dados.matriculaMinistro) {
    doc.setFont('helvetica', 'bold');
    doc.text('MATRÍCULA:', margin + 115, y);
    doc.setFont('helvetica', 'normal');
    doc.text(dados.matriculaMinistro.toUpperCase(), margin + 138, y);
  }

  // Linha 2: Cargo e Congregação/Setor
  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text('CARGO / FUNÇÃO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.cargoMinistro.toUpperCase(), margin + 38, y);

  doc.setFont('helvetica', 'bold');
  doc.text('CONGREGAÇÃO:', margin + 115, y);
  doc.setFont('helvetica', 'normal');
  const congNome = dados.nomeCongregacao || 'SEDE';
  const setorTexto = dados.setorArea ? ` (${dados.setorArea})` : '';
  doc.text((congNome + setorTexto).toUpperCase(), margin + 142, y);

  // Linha 3: Reunião Convocada
  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text('CONVOCAÇÃO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.tituloReuniao.toUpperCase(), margin + 38, y);

  // Linha 4: Data e Local
  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text('DATA DO ATO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${dados.dataReuniao} às ${dados.horarioInicio}`, margin + 38, y);

  doc.setFont('helvetica', 'bold');
  doc.text('LOCAL:', margin + 115, y);
  doc.setFont('helvetica', 'normal');
  doc.text((dados.localReuniao || 'TEMPLO SEDE').toUpperCase(), margin + 128, y);

  // Linha 5: Situação Formal
  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text('OCORRÊNCIA:', margin + 4, y);
  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.text('AUSÊNCIA NÃO JUSTIFICADA EM REUNIÃO CONVOCADA', margin + 38, y);

  // ─── 5. Texto Notificatório Formal com Fundamentação ─────────────────────
  y += 10;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setLineHeightFactor(1.35);

  const saudacao = `Prezado(a) Ministro(a) ${dados.nomeMinistro},`;
  doc.setFont('helvetica', 'bold');
  doc.text(saudacao, margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  const corpoTexto = [
    `Servimo-nos da presente para NOTIFICAR formalmente Vossa Senhoria acerca do registro de AUSÊNCIA NÃO JUSTIFICADA na convocação ministerial supracitada, promovida pela Diretoria e Liderança Geral desta instituição.`,
    ``,
    `Ressaltamos que a pontualidade e a assiduidade aos atos convocatórios integram os deveres solenes, a comunhão e o compromisso eclesiástico assumido no exercício do ministério, conforme preceituam o Estatuto e o Regimento Interno em vigor.`,
    ``,
    `Nos termos das normas disciplinares e regimentais, faculta-se a apresentação de JUSTIFICATIVA FORMAL por escrito perante a Secretaria Geral, no prazo regulamentar, acompanhada da devida comprovação, para apreciação e deliberação da Mesa Diretora.`,
  ];

  const linhasCorpo = doc.splitTextToSize(corpoTexto.join('\n'), contentWidth);
  doc.text(linhasCorpo, margin, y);

  y += 34;

  // ─── 6. Campo para Justificativa Manuscrita de Próprio Punho ─────────────
  doc.setFillColor(254, 252, 232); // Amarelo suave institucional
  doc.setDrawColor(254, 240, 138);
  const justBoxHeight = 50;
  doc.roundedRect(margin, y, contentWidth, justBoxHeight, 2.5, 2.5, 'FD');

  y += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(113, 63, 18);
  doc.text('CAMPO DESTINADO À JUSTIFICATIVA DE PRÓPRIO PUNHO (MANUSCRITA):', margin + 4, y);

  y += 5.5;
  doc.setDrawColor(220, 210, 170);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 5; i++) {
    doc.line(margin + 4, y + i * 7.5, margin + contentWidth - 4, y + i * 7.5);
  }

  y += 40;

  // ─── 7. Local, Data e Assinaturas dos Responsáveis ────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const cidadeData = dados.cidadeUf ? `${dados.cidadeUf}, ` : '';
  const dataHojeExtenso = dados.dataEmissao.split(' ')[0] || '';
  doc.text(`${cidadeData}${dataHojeExtenso}.`, pageWidth / 2, y, { align: 'center' });

  y += 12;

  const colWidth = (contentWidth - 10) / 2;

  // Assinatura 1: Ministro Notificado (Ciência)
  const x1 = margin;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(x1 + 6, y, x1 + colWidth - 6, y);
  doc.setFont('helvetica', 'bold');
  doc.text(dados.nomeMinistro.toUpperCase(), x1 + colWidth / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura e Ciência do Notificado', x1 + colWidth / 2, y + 7.5, { align: 'center' });
  doc.text(`Data: ____/____/________`, x1 + colWidth / 2, y + 11, { align: 'center' });

  // Assinatura 2: Pastor Presidente / Secretaria Geral
  const x2 = margin + colWidth + 10;
  doc.line(x2 + 6, y, x2 + colWidth - 6, y);
  doc.setFont('helvetica', 'bold');
  const nomeResp = dados.nomePresidente || dados.nomeSecretario || 'DIRETORIA EXECUTIVA / SECRETARIA GERAL';
  doc.text(nomeResp.toUpperCase(), x2 + colWidth / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Pastor Presidente / Secretaria Geral', x2 + colWidth / 2, y + 7.5, { align: 'center' });
  doc.text(`Data: ____/____/________`, x2 + colWidth / 2, y + 11, { align: 'center' });

  // ─── 8. Rodapé Institucional com Autenticação e QR Code ──────────────────
  const footerY = pageHeight - 24;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  try {
    const qrDataUrl = await QRCode.toDataURL(dados.protocolo, {
      margin: 1,
      width: 60,
    });
    doc.addImage(qrDataUrl, 'PNG', margin, footerY + 2, 13, 13);
  } catch {
    // fallback caso falhe geração de QR
  }

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.text(`Documento emitido eletronicamente em ${dados.dataEmissao}`, margin + 16, footerY + 5);
  doc.text(`Autenticidade vinculada ao protocolo oficial: ${dados.protocolo}`, margin + 16, footerY + 9);
  doc.text('Gestão Eklésia™ — Sistema Integrado de Gestão Eclesiástica Ministerial', margin + 16, footerY + 13);

  return new Uint8Array(doc.output('arraybuffer'));
}
