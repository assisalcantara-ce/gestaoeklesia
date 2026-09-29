import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  ConfigAdvertenciaMinisterial,
  normalizarConfigAdvertencia,
  interpolarVariaveisAdvertencia,
} from '@/lib/reunioes-config-advertencia';

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
  dataFalta?: string | null;
  horarioInicio: string;
  localReuniao: string;
  dataEmissao: string;
  nomePresidente?: string | null;
  nomeSecretario?: string | null;
  configTextos?: ConfigAdvertenciaMinisterial | null;
}

/**
 * Tenta buscar o logo (Data URI, URL HTTP ou Base64) e converter para inclusão no jsPDF.
 */
async function carregarLogoBase64(url?: string | null): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const cleanUrl = url.trim();

  // 1. Data URI
  if (cleanUrl.startsWith('data:image/')) {
    const isPng = cleanUrl.includes('image/png') || !cleanUrl.includes('image/jpeg');
    const format = isPng ? 'PNG' : 'JPEG';
    return { data: cleanUrl, format };
  }

  // 2. URL externa HTTP / HTTPS
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

  // 3. Base64 pura
  if (cleanUrl.length > 50 && /^[A-Za-z0-9+/=\r\n]+$/.test(cleanUrl.slice(0, 50))) {
    return {
      data: `data:image/png;base64,${cleanUrl.replace(/\r?\n|\r/g, '')}`,
      format: 'PNG',
    };
  }

  return null;
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
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  const logoInfo = await carregarLogoBase64(dados.logoMinisterioUrl);
  const config = normalizarConfigAdvertencia(dados.configTextos);

  // ─── 1. Bordas Institucionais Decorativas ──────────────────────────────────
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.4);
  doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

  doc.setDrawColor(18, 59, 99); // Azul corporativo Eklésia
  doc.setLineWidth(0.8);
  doc.rect(9, 9, pageWidth - 18, pageHeight - 18);

  // ─── 2. Cabeçalho Institucional ───────────────────────────────────────────
  let y = 14;
  const logoBoxW = 20;
  const logoBoxH = 14;

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

      const logoX = margin + 2 + (logoBoxW - finalLogoW) / 2;
      const logoY = y + (logoBoxH - finalLogoH) / 2;

      doc.addImage(logoInfo.data, logoInfo.format, logoX, logoY, finalLogoW, finalLogoH, undefined, 'FAST');
    } catch {
      // continua sem logo
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(18, 59, 99);
  const nomeIgreja = (dados.nomeMinisterio || 'GESTÃO EKLÉSIA').toUpperCase();
  doc.text(nomeIgreja, pageWidth / 2, y + 4, { align: 'center' });

  y += 8.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const subCabecalho = (dados.subtituloMinisterio || 'SECRETARIA GERAL • MESA DIRETORA EXECUTIVA').toUpperCase();
  doc.text(subCabecalho, pageWidth / 2, y, { align: 'center' });

  if (dados.cnpjMinisterio || dados.cidadeUf) {
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
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
  y += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(185, 28, 28); // Vermelho institucional solene
  doc.text('CARTA DE ADVERTÊNCIA MINISTERIAL', pageWidth / 2, y, { align: 'center' });

  y += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`PROTOCOLO OFICIAL: ${dados.protocolo}`, pageWidth / 2, y, { align: 'center' });

  // ─── 4. Quadro de Identificação do Ministro e Falta ───────────────────────
  y += 5.5;
  const boxHeight = 35;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

  y += 5.2;
  doc.setFontSize(8);

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
  y += 5.2;
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
  y += 5.2;
  doc.setFont('helvetica', 'bold');
  doc.text('CONVOCAÇÃO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dados.tituloReuniao.toUpperCase(), margin + 38, y);

  // Linha 4: Data e Local
  y += 5.2;
  doc.setFont('helvetica', 'bold');
  doc.text('DATA DO ATO:', margin + 4, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${dados.dataReuniao} às ${dados.horarioInicio}`, margin + 38, y);

  doc.setFont('helvetica', 'bold');
  doc.text('LOCAL:', margin + 115, y);
  doc.setFont('helvetica', 'normal');
  doc.text((dados.localReuniao || 'TEMPLO SEDE').toUpperCase(), margin + 128, y);

  // Linha 5: Situação Formal
  y += 5.2;
  doc.setFont('helvetica', 'bold');
  doc.text('OCORRÊNCIA:', margin + 4, y);
  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.text('AUSÊNCIA NÃO JUSTIFICADA EM REUNIÃO CONVOCADA', margin + 38, y);

  // ─── 5. Texto Notificatório Formal com Variáveis Dinâmicas ───────────────
  y += 8.5;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setLineHeightFactor(1.3);

  const saudacao = `Prezado(a) Ministro(a) ${dados.nomeMinistro},`;
  doc.setFont('helvetica', 'bold');
  doc.text(saudacao, margin, y);
  y += 4.5;

  const variaveis = {
    nome_ministro: dados.nomeMinistro,
    cargo: dados.cargoMinistro,
    matricula: dados.matriculaMinistro || '—',
    ministerio: dados.nomeMinisterio,
    data_reuniao: dados.dataReuniao,
    data_falta: dados.dataFalta || dados.dataReuniao,
    protocolo: dados.protocolo,
    responsavel: dados.nomePresidente || dados.nomeSecretario || 'Diretoria Executiva / Secretaria Geral',
  };

  const textoAbertura = interpolarVariaveisAdvertencia(config.texto_abertura, variaveis);
  const fundamentacao = interpolarVariaveisAdvertencia(config.fundamentacao_estatutaria, variaveis);
  const textoComplementar = interpolarVariaveisAdvertencia(config.texto_complementar, variaveis);
  const textoEncerramento = interpolarVariaveisAdvertencia(config.texto_encerramento, variaveis);

  const paragrafos: string[] = [textoAbertura];
  if (fundamentacao && fundamentacao.trim().length > 0) {
    paragrafos.push(fundamentacao);
  }
  if (textoComplementar && textoComplementar.trim().length > 0) {
    paragrafos.push(textoComplementar);
  }
  if (textoEncerramento && textoEncerramento.trim().length > 0) {
    paragrafos.push(textoEncerramento);
  }

  doc.setFont('helvetica', 'normal');
  for (const p of paragrafos) {
    const linhas = doc.splitTextToSize(p, contentWidth);
    doc.text(linhas, margin, y);
    y += linhas.length * 3.8 + 2.2;
  }

  // ─── 6. Campo para Justificativa Manuscrita de Próprio Punho ─────────────
  y += 1.5;
  doc.setFillColor(254, 252, 232); // Amarelo suave institucional
  doc.setDrawColor(254, 240, 138);
  const justBoxHeight = 44;
  doc.roundedRect(margin, y, contentWidth, justBoxHeight, 2, 2, 'FD');

  y += 4.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(113, 63, 18);
  doc.text('CAMPO DESTINADO À JUSTIFICATIVA DE PRÓPRIO PUNHO (MANUSCRITA):', margin + 4, y);

  y += 5.2;
  doc.setDrawColor(220, 210, 170);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 4; i++) {
    doc.line(margin + 4, y + i * 7.5, margin + contentWidth - 4, y + i * 7.5);
  }

  y += 34;

  // ─── 7. Local, Data e Assinaturas dos Responsáveis ────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'normal');

  const cidadeData = dados.cidadeUf ? `${dados.cidadeUf}, ` : '';
  const dataHojeExtenso = dados.dataEmissao.split(' ')[0] || '';
  doc.text(`${cidadeData}${dataHojeExtenso}.`, pageWidth / 2, y, { align: 'center' });

  y += 10;

  const colWidth = (contentWidth - 10) / 2;

  // Assinatura 1: Ministro Notificado (Ciência)
  const x1 = margin;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(x1 + 6, y, x1 + colWidth - 6, y);
  doc.setFont('helvetica', 'bold');
  doc.text(dados.nomeMinistro.toUpperCase(), x1 + colWidth / 2, y + 3.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura e Ciência do Notificado', x1 + colWidth / 2, y + 7.2, { align: 'center' });
  doc.text(`Data: ____/____/________`, x1 + colWidth / 2, y + 10.5, { align: 'center' });

  // Assinatura 2: Pastor Presidente / Secretaria Geral
  const x2 = margin + colWidth + 10;
  doc.line(x2 + 6, y, x2 + colWidth - 6, y);
  doc.setFont('helvetica', 'bold');
  const nomeResp = dados.nomePresidente || dados.nomeSecretario || 'DIRETORIA EXECUTIVA / SECRETARIA GERAL';
  doc.text(nomeResp.toUpperCase(), x2 + colWidth / 2, y + 3.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Pastor Presidente / Secretaria Geral', x2 + colWidth / 2, y + 7.2, { align: 'center' });
  doc.text(`Data: ____/____/________`, x2 + colWidth / 2, y + 10.5, { align: 'center' });

  // ─── 8. Rodapé Institucional com Autenticação e QR Code ──────────────────
  const footerY = pageHeight - 20;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  try {
    const qrDataUrl = await QRCode.toDataURL(dados.protocolo, {
      margin: 1,
      width: 60,
    });
    doc.addImage(qrDataUrl, 'PNG', margin, footerY + 1.5, 11, 11);
  } catch {
    // fallback
  }

  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.text(`Documento emitido eletronicamente em ${dados.dataEmissao}`, margin + 14, footerY + 4.2);
  doc.text(`Autenticidade vinculada ao protocolo oficial: ${dados.protocolo}`, margin + 14, footerY + 7.8);
  doc.text('Gestão Eklésia™ — Sistema Integrado de Gestão Eclesiástica Ministerial', margin + 14, footerY + 11.2);

  return new Uint8Array(doc.output('arraybuffer'));
}
