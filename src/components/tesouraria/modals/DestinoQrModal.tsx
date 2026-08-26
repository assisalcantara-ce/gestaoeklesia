'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Printer, X, Grid, FileText } from 'lucide-react';

interface DestinoQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  destino: {
    id: string;
    label: string;
    pix_payload?: string | null;
    tipo_recebimento: string;
    valor_fixo?: number | null;
    congregacoes?: { nome: string } | null;
  } | null;
  fmtBRL: (v: number) => string;
}

export default function DestinoQrModal({ isOpen, onClose, destino, fmtBRL }: DestinoQrModalProps) {
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [showPrintOptionModal, setShowPrintOptionModal] = useState(false);
  const [printLayout, setPrintLayout] = useState<'1' | '8'>('1');

  if (!isOpen || !destino) return null;

  const qrCodeValue = destino.pix_payload ?? '';

  const handleCopyPayload = async () => {
    if (!destino.pix_payload) return;
    try {
      await navigator.clipboard.writeText(destino.pix_payload);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch {}
  };

  // Aciona a impressão no navegador após definir o layout desejado
  const executePrint = (layout: '1' | '8') => {
    setPrintLayout(layout);
    setShowPrintOptionModal(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const TIPO_LABELS: Record<string, string> = {
    dizimo: 'Dízimo',
    oferta: 'Oferta',
    missoes: 'Missões',
    doacao: 'Doação',
    campanha_local: 'Campanha',
    evento_local: 'Evento',
  };

  const congregacaoNome = destino.congregacoes?.nome ?? 'Sede / Todas as Congregações';
  const tipoFormatado = TIPO_LABELS[destino.tipo_recebimento] ?? destino.tipo_recebimento;

  // Componente Reutilizável da Arte Visual Fiel aos Modelos Uploaded
  const PosterCard = ({ isGrid = false }: { isGrid?: boolean }) => (
    <div className={`poster-card ${isGrid ? 'grid-card' : 'single-card'}`}>
      {/* Moldura Externa do Cartaz */}
      <div className="card-border">
        {/* Cabeçalho Azul com Faixa Verde */}
        <div className="card-header">
          <h2 className="header-title">CONTRIBUA VIA PIX</h2>
          <div className="header-green-line" />
        </div>

        {/* Orientação Curta */}
        <p className="instruction-text">Aponte a câmera do seu celular para o QR Code</p>

        {/* Moldura do QR Code */}
        <div className="qr-wrapper">
          <QRCodeSVG
            value={qrCodeValue}
            size={isGrid ? 100 : 250}
            level="H"
            includeMargin={false}
          />
        </div>

        {/* Valor Fixo (opcional) */}
        {destino.valor_fixo && (
          <div className="card-valor">
            Valor Sugerido: {fmtBRL(Number(destino.valor_fixo))}
          </div>
        )}

        {/* Barra de Instrução com Ícone do Celular */}
        <div className="action-bar">
          <div className="phone-icon-box">
            <svg className="phone-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="3" />
              <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="3" />
            </svg>
          </div>
          <div className="action-text">
            <span className="action-main">LEIA O QR CODE</span>
            <span className="action-sub">ESCOLHA O VALOR &bull; CONFIRME</span>
          </div>
        </div>

        {/* Rodapé Inspiracional Bíblico */}
        {!isGrid && (
          <div className="footer-biblical">
            <div className="divider-line">
              <span className="heart-icon">♡</span>
            </div>
            <p className="scripture-headline">Sua generosidade transforma vidas!</p>
            <p className="scripture-sub font-bold">DEUS AMA QUEM DÁ COM ALEGRIA.</p>
            <p className="scripture-ref">2 CORÍNTIOS 9:7</p>
          </div>
        )}

        {isGrid && (
          <div className="grid-footer-biblical">
            <p className="scripture-headline">Sua generosidade transforma vidas!</p>
            <p className="scripture-ref">2 CORÍNTIOS 9:7</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Modal Principal na Interface Web */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-100 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="text-center space-y-1">
            <span className="inline-block px-2.5 py-0.5 bg-[#123b63]/10 text-[#123b63] text-xs font-bold rounded-full uppercase tracking-wider">
              {tipoFormatado}
            </span>
            <h3 className="text-xl font-extrabold text-slate-800">{destino.label}</h3>
            <p className="text-xs text-slate-500 font-medium">
              📍 {congregacaoNome}
            </p>
          </div>

          {/* Destaque Explicativo */}
          <div className="p-3 rounded-xl text-center text-xs space-y-1 border bg-emerald-50 border-emerald-200 text-emerald-900">
            <p className="font-bold uppercase tracking-wide">
              QR Code PIX de Pagamento
            </p>
            <p className="text-[11px]">
              Abra o <strong>aplicativo do seu banco</strong> e leia este QR Code para contribuir via PIX.
            </p>
          </div>

          {/* QR Code Canvas na Interface Web */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
              <QRCodeSVG
                value={qrCodeValue}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>
            {destino.valor_fixo && (
              <p className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                Valor Sugerido: {fmtBRL(Number(destino.valor_fixo))}
              </p>
            )}
          </div>

          {/* Pix Copia e Cola */}
          {destino.pix_payload && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600">Pix Copia e Cola (Banco)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={destino.pix_payload}
                  className="flex-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono rounded-xl px-3 py-2.5 outline-none select-all truncate"
                />
                <button
                  onClick={handleCopyPayload}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    copiedPayload
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                >
                  {copiedPayload ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar PIX
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowPrintOptionModal(true)}
              className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <Printer className="h-4 w-4 text-[#123b63]" /> Imprimir Cartaz QR Code
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL SECUNDÁRIO: ESCOLHA DE LAYOUT DE IMPRESSÃO ── */}
      {showPrintOptionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 space-y-4 text-center animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 bg-[#123b63]/10 text-[#123b63] rounded-full flex items-center justify-center mx-auto">
              <Printer className="h-6 w-6" />
            </div>

            <div>
              <h4 className="text-base font-extrabold text-slate-800">Como deseja imprimir?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Escolha o formato de disposição do cartaz na folha A4.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => executePrint('1')}
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-3 text-left transition group"
              >
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-[#123b63] group-hover:border-[#123b63]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">1 por folha A4</p>
                  <p className="text-[11px] text-slate-500">Cartaz grande centralizado para púlpitos ou paredes</p>
                </div>
              </button>

              <button
                onClick={() => executePrint('8')}
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-3 text-left transition group"
              >
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-[#123b63] group-hover:border-[#123b63]">
                  <Grid className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">8 por folha A4</p>
                  <p className="text-[11px] text-slate-500">Grade 2x4 com mini-cartazes para panfletos ou bancos</p>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowPrintOptionModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ELEMENTOS EXCLUSIVOS DE IMPRESSÃO A4 (ISOLADOS E INDEPENDENTES) ── */}
      {printLayout === '1' && (
        <div className="pix-print-a4-single">
          <PosterCard isGrid={false} />
        </div>
      )}

      {printLayout === '8' && (
        <div className="pix-print-a4-grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <PosterCard key={idx} isGrid={true} />
          ))}
        </div>
      )}

      {/* ── CSS RIGOROSO DE IMPRESSÃO A4 (1 PÁGINA FIXA) ── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          /* Oculta absolutamente toda a aplicação e modais de tela */
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          /* Exibe exclusivamente o container de impressão ativo */
          .pix-print-a4-single, .pix-print-a4-single *,
          .pix-print-a4-grid, .pix-print-a4-grid * {
            visibility: visible !important;
          }

          /* ── MODELO 1 POR FOLHA (A4 COMPLETA 190mm x 277mm) ── */
          .pix-print-a4-single {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }

          .pix-print-a4-single .single-card {
            width: 190mm !important;
            height: 275mm !important;
            box-sizing: border-box !important;
          }

          .single-card .card-border {
            width: 100% !important;
            height: 100% !important;
            border: 4px solid #053361 !important;
            border-radius: 28px !important;
            padding: 20px 24px 18px 24px !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
          }

          .single-card .card-header {
            width: 100% !important;
            background: #053361 !important;
            border-radius: 16px !important;
            padding: 16px 20px 14px 20px !important;
            text-align: center !important;
          }

          .single-card .header-title {
            font-size: 36px !important;
            font-weight: 900 !important;
            letter-spacing: 0.06em !important;
          }

          .single-card .header-green-line {
            width: 70px !important;
            height: 5px !important;
            margin-top: 8px !important;
          }

          .single-card .instruction-text {
            font-size: 18px !important;
            font-weight: 800 !important;
            margin: 14px 0 10px 0 !important;
          }

          .single-card .qr-wrapper {
            border-radius: 32px !important;
            padding: 24px !important;
            border-width: 3px !important;
          }

          .single-card .action-bar {
            border-radius: 18px !important;
            padding: 14px 20px !important;
            gap: 16px !important;
          }

          .single-card .phone-svg {
            width: 38px !important;
            height: 38px !important;
          }

          .single-card .action-main {
            font-size: 20px !important;
          }

          .single-card .action-sub {
            font-size: 14px !important;
          }

          .single-card .footer-biblical {
            margin-top: 14px !important;
          }

          .single-card .scripture-headline {
            font-size: 20px !important;
          }

          .single-card .scripture-sub {
            font-size: 13px !important;
          }

          .single-card .scripture-ref {
            font-size: 12px !important;
          }


          /* ── MODELO 8 POR FOLHA (GRADE FIXA 2 colunas x 4 linhas EM 1 PÁGINA) ── */
          .pix-print-a4-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(4, 1fr) !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            padding: 6mm 5mm !important;
            gap: 3mm 4mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }

          .pix-print-a4-grid .grid-card {
            width: 96mm !important;
            height: 68mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }

          .grid-card .card-border {
            width: 100% !important;
            height: 100% !important;
            border: 2px solid #053361 !important;
            border-radius: 12px !important;
            padding: 5px 6px 4px 6px !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
          }

          .grid-card .card-header {
            width: 100% !important;
            background: #053361 !important;
            border-radius: 6px !important;
            padding: 3px 4px 2px 4px !important;
            text-align: center !important;
          }

          .grid-card .header-title {
            font-size: 10px !important;
            font-weight: 900 !important;
            letter-spacing: 0.02em !important;
            line-height: 1 !important;
          }

          .grid-card .header-green-line {
            width: 16px !important;
            height: 2px !important;
            margin: 2px auto 0 auto !important;
          }

          .grid-card .instruction-text {
            font-size: 7px !important;
            font-weight: 700 !important;
            margin: 2px 0 1px 0 !important;
          }

          .grid-card .qr-wrapper {
            border-radius: 8px !important;
            padding: 3px !important;
            border-width: 1px !important;
            margin: 1px 0 !important;
          }

          .grid-card .action-bar {
            border-radius: 5px !important;
            padding: 2px 4px !important;
            gap: 4px !important;
            margin-top: 1px !important;
          }

          .grid-card .phone-svg {
            width: 11px !important;
            height: 11px !important;
          }

          .grid-card .action-main {
            font-size: 7px !important;
            font-weight: 900 !important;
            line-height: 1 !important;
          }

          .grid-card .action-sub {
            font-size: 5.5px !important;
            font-weight: 800 !important;
            line-height: 1 !important;
          }

          .grid-card .grid-footer-biblical {
            margin-top: 1px !important;
            text-align: center !important;
          }

          .grid-card .grid-footer-biblical .scripture-headline {
            font-size: 6px !important;
            margin: 0 !important;
          }

          .grid-card .grid-footer-biblical .scripture-ref {
            font-size: 5px !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
