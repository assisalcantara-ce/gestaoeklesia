'use client';

import { useRef, useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import {
  FileText,
  Printer,
  Download,
  User,
  Users,
  Church,
  MapPin,
  ShieldCheck,
  Loader2,
  Award,
} from 'lucide-react';

export interface DadosMembroFicha {
  matricula: string;
  id: string;
  uniqueId: string;
  nome: string;
  cpf: string;
  tipoCadastro: string;
  cargo?: string;
  status?: string;
  dataNascimento?: string;
  sexo?: string;
  tipoSanguineo?: string;
  escolaridade?: string;
  estadoCivil?: string;
  rg?: string;
  nacionalidade?: string;
  naturalidade?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  email?: string;
  celular?: string;
  whatsapp?: string;
  nomeConjuge?: string;
  cpfConjuge?: string;
  dataNascimentoConjuge?: string;
  nomePai?: string;
  nomeMae?: string;
  qualFuncao?: string;
  setorDepartamento?: string;
  dataConsagracao?: string;
  dataBatismo?: string;
  dataValidadeCredencial?: string;
  congregacao?: string;
}

export interface DadosIgrejaFicha {
  nomeIgreja: string;
  endereco: string;
  telefone: string;
  email: string;
  logoUrl?: string;
}

export interface FichaMembroProps {
  membro: DadosMembroFicha;
  dadosIgreja: DadosIgrejaFicha;
  fotoUrl?: string;
  onClose?: () => void;
}

function formatDateDisplay(val?: string | null): string {
  if (!val) return '—';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

export default function FichaMembro({ membro, dadosIgreja, fotoUrl }: FichaMembroProps) {
  const fichaRef = useRef<HTMLDivElement>(null);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  // Geração da URL oficial de validação pública da credencial
  const uniqueIdentifier = membro.uniqueId || membro.id || '';
  const baseUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.gestaoeklesia.com.br');
  const qrValidationUrl = `${baseUrl}/validar/credencial/${encodeURIComponent(uniqueIdentifier)}`;

  const isAtivo = (membro.status || 'ativo').toLowerCase() === 'ativo';

  const imprimirFicha = () => {
    if (!fichaRef.current) return;
    const printWindow = window.open('', '', 'height=1000,width=920');
    if (printWindow) {
      const html = fichaRef.current.innerHTML;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Ficha do Membro - ${membro.nome}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              html, body {
                width: 210mm;
                background: white;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: #0f172a;
              }
              @page {
                size: A4 portrait;
                margin: 8mm 10mm;
              }
              @media print {
                html, body { width: 100%; }
                .no-print { display: none !important; }
              }
              img { max-width: 100%; }
            </style>
          </head>
          <body class="p-4">
            ${html}
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const sanitizeUnsupportedColorsInClone = (clonedDoc: Document, clonedRoot: HTMLElement) => {
    // Helper to convert oklch/lab/lch/color(...) using canvas context
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    const convertColorStr = (str: string): string => {
      if (!str || typeof str !== 'string') return str;
      if (!str.includes('oklch') && !str.includes('color(') && !str.includes('lab(') && !str.includes('lch(')) {
        return str;
      }
      return str.replace(/(?:oklch|color|lab|lch)\([^)]+\)/gi, (match) => {
        if (ctx) {
          try {
            ctx.fillStyle = '#000000';
            ctx.fillStyle = match;
            return ctx.fillStyle;
          } catch {
            return '#0f2a4a';
          }
        }
        return '#0f2a4a';
      });
    };

    // 1. Sanitize all <style> tags in clonedDoc
    try {
      const styleTags = clonedDoc.querySelectorAll('style');
      styleTags.forEach((styleTag) => {
        if (styleTag.textContent && (styleTag.textContent.includes('oklch') || styleTag.textContent.includes('color('))) {
          styleTag.textContent = convertColorStr(styleTag.textContent);
        }
      });
    } catch (e) {
      console.warn('Error sanitizing style tags for PDF:', e);
    }

    // 2. Sanitize inline styles and computed color properties on cloned elements
    const colorProps = [
      'color',
      'background-color',
      'border-color',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
      'outline-color',
      'box-shadow',
      'fill',
      'stroke',
      'text-decoration-color',
      'accent-color',
      'caret-color',
    ];

    const elements = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll('*'))] as HTMLElement[];
    elements.forEach((el) => {
      if (!el || !el.style) return;

      // Sanitize style attribute if present
      const rawStyle = el.getAttribute('style');
      if (rawStyle && (rawStyle.includes('oklch') || rawStyle.includes('color('))) {
        el.setAttribute('style', convertColorStr(rawStyle));
      }

      // Check computed styles and override if they contain oklch
      try {
        const computed = window.getComputedStyle(el);
        colorProps.forEach((prop) => {
          const val = computed.getPropertyValue(prop);
          if (val && (val.includes('oklch') || val.includes('color(') || val.includes('lab(') || val.includes('lch('))) {
            const converted = convertColorStr(val);
            el.style.setProperty(prop, converted, 'important');
          }
        });
      } catch {}
    });
  };

  const gerarPDF = async () => {
    if (!fichaRef.current) {
      alert('Erro: Ficha não encontrada.');
      return;
    }

    try {
      setGerandoPDF(true);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(fichaRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowHeight: fichaRef.current.scrollHeight,
        windowWidth: fichaRef.current.scrollWidth,
        onclone: (clonedDoc, clonedElement) => {
          sanitizeUnsupportedColorsInClone(clonedDoc, clonedElement);
        },
      });

      // Dimensões A4 em milímetros
      const pdfPageWidth = 210;
      const pdfPageHeight = 297;
      const margin = 8; // Margem de segurança de 8mm

      const usableWidth = pdfPageWidth - (2 * margin);
      const usableHeight = pdfPageHeight - (2 * margin);

      const canvasRatio = canvas.width / canvas.height;

      // Cálculo proporcional (contain) para caber exatamente em 1 página
      let renderWidth = usableWidth;
      let renderHeight = renderWidth / canvasRatio;

      if (renderHeight > usableHeight) {
        renderHeight = usableHeight;
        renderWidth = renderHeight * canvasRatio;
      }

      // Centralizar na página
      const posX = (pdfPageWidth - renderWidth) / 2;
      const posY = Math.max(margin, (pdfPageHeight - renderHeight) / 2);

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      // Adicionar exatamente em uma única página A4 sem quebras
      pdf.addImage(imgData, 'PNG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');

      const nomeArquivo = `Ficha_${membro.nome.replace(/\s+/g, '_')}_${membro.matricula || 'membro'}.pdf`;
      pdf.save(nomeArquivo);
    } catch (error) {
      console.error('Erro ao gerar PDF da ficha:', error);
      alert('Erro ao gerar PDF: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de Ações Superior */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <FileText className="w-4 h-4 text-teal-600" />
          <span>Ficha de Registro Cadastral</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={gerarPDF}
            disabled={gerandoPDF}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Download do documento em formato PDF"
          >
            {gerandoPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" /> : <Download className="w-3.5 h-3.5 text-teal-600" />}
            <span>{gerandoPDF ? 'Gerando...' : 'Baixar PDF'}</span>
          </button>

          <button
            onClick={imprimirFicha}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f2a4a] hover:bg-[#123b63] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            title="Imprimir documento em formato A4"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Ficha</span>
          </button>
        </div>
      </div>

      {/* Documento Imprimível (A4 Standard) */}
      <div
        ref={fichaRef}
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs max-w-[210mm] mx-auto text-slate-800 font-sans space-y-5"
      >
        {/* ─── 1. CABEÇALHO INSTITUCIONAL ─── */}
        <div className="border-b-2 border-teal-600 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {dadosIgreja.logoUrl ? (
              <img
                src={dadosIgreja.logoUrl}
                alt="Logo da Igreja"
                className="w-16 h-16 object-contain rounded-xl border border-slate-100 p-1 bg-white shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0 shadow-xs">
                <Church className="w-7 h-7" />
              </div>
            )}
            <div>
              <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-[#0f2a4a] leading-tight">
                {dadosIgreja.nomeIgreja || 'Ministério / Igreja'}
              </h1>
              {dadosIgreja.endereco && <p className="text-xs text-slate-500 font-medium">{dadosIgreja.endereco}</p>}
              {(dadosIgreja.telefone || dadosIgreja.email) && (
                <p className="text-[11px] text-slate-400 font-medium">
                  {dadosIgreja.telefone && `Tel: ${dadosIgreja.telefone}`}
                  {dadosIgreja.telefone && dadosIgreja.email && ' • '}
                  {dadosIgreja.email && `Email: ${dadosIgreja.email}`}
                </p>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              Registro Oficial
            </span>
          </div>
        </div>

        {/* ─── 2. HERO CARD: IDENTIFICAÇÃO + FOTO + CARTEIRINHA DIGITAL ─── */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center sm:items-stretch justify-between gap-4 sm:gap-5">
          {/* Foto e Informações Principais */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 flex-1 min-w-0">
            {/* Foto 3x4 */}
            <div className="w-[100px] h-[125px] sm:w-[108px] sm:h-[135px] rounded-xl overflow-hidden bg-slate-200 border-2 border-white shadow-md shrink-0 flex items-center justify-center">
              {fotoUrl ? (
                <img src={fotoUrl} alt={membro.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                  <User className="w-10 h-10 text-slate-300 mb-1" />
                  <span className="text-[10px] font-semibold">Sem foto</span>
                </div>
              )}
            </div>

            {/* Identificação Textual */}
            <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Membro Cadastrado</p>
                <h2 className="text-base sm:text-xl font-extrabold text-[#0f2a4a] leading-tight truncate">
                  {membro.nome}
                </h2>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold">
                <span className="px-2.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700 shadow-2xs">
                  Matrícula: <strong className="text-slate-900">{membro.matricula || '—'}</strong>
                </span>
                <span className="px-2.5 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-md capitalize shadow-2xs">
                  {membro.tipoCadastro || 'Membro'}
                </span>
                {membro.cargo && (
                  <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md shadow-2xs">
                    {membro.cargo}
                  </span>
                )}
              </div>

              {/* Status Evidente */}
              <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                    isAtivo
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isAtivo ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {isAtivo ? 'ATIVO' : 'INATIVO'}
                </span>

                {membro.congregacao && (
                  <span className="text-xs text-slate-500 font-medium">
                    Congregação: <strong className="text-slate-700">{membro.congregacao}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card da Carteirinha Digital / QR Code de Validação Pública */}
          <div className="w-full sm:w-[155px] bg-white border border-teal-200/80 rounded-xl p-3 text-center shadow-xs flex flex-col items-center justify-between gap-1.5 shrink-0">
            <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-teal-800">
              <Award className="w-3 h-3 text-teal-600" />
              <span>Carteirinha Digital</span>
            </div>

            <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
              <QRCode
                value={qrValidationUrl}
                size={74}
                level="M"
                includeMargin={false}
                fgColor="#0f2a4a"
                bgColor="#ffffff"
              />
            </div>

            <div className="space-y-0.5">
              <p className="text-[9px] font-semibold text-slate-500 leading-tight">Escaneie para validar</p>
              <div className="flex items-center justify-center gap-1 text-[8.5px] font-bold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{isAtivo ? 'Documento válido' : 'Documento inativo'}</span>
              </div>
              {membro.dataValidadeCredencial && (
                <p className="text-[8px] text-slate-400 font-medium">
                  Válida até {formatDateDisplay(membro.dataValidadeCredencial)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── 3. SEÇÕES DE DADOS ESTRUTURADAS ─── */}
        <div className="space-y-4 text-xs">
          {/* SEÇÃO: DADOS PESSOAIS */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span>Dados Pessoais</span>
            </div>
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white">
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">CPF</span>
                <span className="font-semibold text-slate-800">{membro.cpf || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">RG</span>
                <span className="font-semibold text-slate-800">{membro.rg || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Nascimento</span>
                <span className="font-semibold text-slate-800">{formatDateDisplay(membro.dataNascimento)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Sexo</span>
                <span className="font-semibold text-slate-800 capitalize">{membro.sexo || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Estado Civil</span>
                <span className="font-semibold text-slate-800 capitalize">{membro.estadoCivil || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Tipo Sanguíneo</span>
                <span className="font-semibold text-slate-800">{membro.tipoSanguineo || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Escolaridade</span>
                <span className="font-semibold text-slate-800">{membro.escolaridade || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Nacionalidade / Naturalidade</span>
                <span className="font-semibold text-slate-800">
                  {membro.nacionalidade || 'Brasileira'}
                  {membro.naturalidade && ` (${membro.naturalidade})`}
                </span>
              </div>
            </div>
          </div>

          {/* SEÇÃO: DADOS FAMILIARES */}
          {(membro.nomePai || membro.nomeMae || membro.nomeConjuge) && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <Users className="w-3.5 h-3.5 text-teal-600" />
                <span>Dados Familiares</span>
              </div>
              <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
                {membro.nomePai && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Nome do Pai</span>
                    <span className="font-semibold text-slate-800">{membro.nomePai}</span>
                  </div>
                )}
                {membro.nomeMae && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Nome da Mãe</span>
                    <span className="font-semibold text-slate-800">{membro.nomeMae}</span>
                  </div>
                )}
                {membro.nomeConjuge && (
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
                    <div className="sm:col-span-2">
                      <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Nome do Cônjuge</span>
                      <span className="font-semibold text-slate-800">{membro.nomeConjuge}</span>
                    </div>
                    {membro.dataNascimentoConjuge && (
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Nascimento do Cônjuge</span>
                        <span className="font-semibold text-slate-800">{formatDateDisplay(membro.dataNascimentoConjuge)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO: DADOS ECLESIÁSTICOS / MINISTERIAIS */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
              <Church className="w-3.5 h-3.5 text-teal-600" />
              <span>Dados Eclesiásticos & Ministeriais</span>
            </div>
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white">
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Tipo de Cadastro</span>
                <span className="font-semibold text-slate-800 capitalize">{membro.tipoCadastro || 'Membro'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Cargo / Ministério</span>
                <span className="font-semibold text-slate-800">{membro.cargo || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Função</span>
                <span className="font-semibold text-slate-800">{membro.qualFuncao || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Setor / Departamento</span>
                <span className="font-semibold text-slate-800">{membro.setorDepartamento || '—'}</span>
              </div>

              {membro.dataConsagracao && (
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Data de Consagração</span>
                  <span className="font-semibold text-slate-800">{formatDateDisplay(membro.dataConsagracao)}</span>
                </div>
              )}
              {membro.dataBatismo && (
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Data de Batismo</span>
                  <span className="font-semibold text-slate-800">{formatDateDisplay(membro.dataBatismo)}</span>
                </div>
              )}
              {membro.dataValidadeCredencial && (
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Validade da Credencial</span>
                  <span className="font-semibold text-slate-800">{formatDateDisplay(membro.dataValidadeCredencial)}</span>
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO: ENDEREÇO E CONTATO */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              <span>Endereço & Contato</span>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white">
              <div className="sm:col-span-2">
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Logradouro</span>
                <span className="font-semibold text-slate-800">
                  {membro.logradouro || '—'}
                  {membro.numero && `, nº ${membro.numero}`}
                  {membro.complemento && ` - ${membro.complemento}`}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Bairro</span>
                <span className="font-semibold text-slate-800">{membro.bairro || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Cidade / UF</span>
                <span className="font-semibold text-slate-800">
                  {membro.cidade || '—'}
                  {membro.uf && ` / ${membro.uf}`}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">CEP</span>
                <span className="font-semibold text-slate-800">{membro.cep || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Celular / WhatsApp</span>
                <span className="font-semibold text-slate-800">
                  {membro.celular || membro.whatsapp || '—'}
                </span>
              </div>
              {membro.email && (
                <div className="sm:col-span-3 pt-1 border-t border-slate-100">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">E-mail</span>
                  <span className="font-semibold text-slate-800">{membro.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── 4. RODAPÉ INSTITUCIONAL ─── */}
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <p>
            Documento gerado eletronicamente pelo <strong>Gestão Eklésia</strong>
          </p>
          <p>
            Emitido em {new Date().toLocaleDateString('pt-BR')} às{' '}
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
