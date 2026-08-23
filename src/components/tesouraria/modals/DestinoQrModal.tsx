'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Printer, X, ExternalLink, Grid, FileText } from 'lucide-react';

interface DestinoQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  destino: {
    id: string;
    label: string;
    public_token: string;
    pix_payload?: string | null;
    tipo_recebimento: string;
    valor_fixo?: number | null;
    congregacoes?: { nome: string } | null;
  } | null;
  fmtBRL: (v: number) => string;
}

export default function DestinoQrModal({ isOpen, onClose, destino, fmtBRL }: DestinoQrModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [showPrintOptionModal, setShowPrintOptionModal] = useState(false);
  const [printLayout, setPrintLayout] = useState<'1' | '8'>('1');

  if (!isOpen || !destino) return null;

  const hasStaticPix = Boolean(destino.pix_payload);
  const qrCodeValue = destino.pix_payload || `https://app.gestaoeklesia.com.br/pagar/${destino.public_token}`;
  const publicUrl = `https://app.gestaoeklesia.com.br/pagar/${destino.public_token}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

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
          <div className={`p-3 rounded-xl text-center text-xs space-y-1 border ${
            hasStaticPix
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <p className="font-bold uppercase tracking-wide">
              {hasStaticPix ? 'QR Code PIX de Pagamento' : 'QR Code de Acesso à Arrecadação'}
            </p>
            <p className="text-[11px]">
              {hasStaticPix ? (
                <>Abra o <strong>aplicativo do seu banco</strong> e leia este QR Code para contribuir via PIX.</>
              ) : (
                <>Aponte a <strong>câmera do celular</strong> para abrir a página de contribuição.</>
              )}
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

          {/* Pix Copia e Cola / Link Público */}
          {hasStaticPix ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600">Pix Copia e Cola (Banco)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={destino.pix_payload ?? ''}
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
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600">Link Público de Doação</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono rounded-xl px-3 py-2.5 outline-none select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar
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
              className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <Printer className="h-4 w-4 text-[#123b63]" /> Imprimir Cartaz QR Code
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-[#123b63] hover:bg-[#1a4f85] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Testar Link Web
            </a>
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

      {/* ── ELEMENTOS EXCLUSIVOS DE IMPRESSÃO A4 (ISOLADO) ── */}
      <div className="destino-print-only hidden">
        {printLayout === '1' ? (
          <div className="print-page-single">
            <PosterCard isGrid={false} />
          </div>
        ) : (
          <div className="print-page-grid">
            {Array.from({ length: 8 }).map((_, idx) => (
              <PosterCard key={idx} isGrid={true} />
            ))}
          </div>
        )}
      </div>

      {/* ── CSS ISOLADO DE IMPRESSÃO A4 ── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          /* Esconde todo o resto da aplicação de forma absoluta */
          body, body * {
            visibility: hidden !important;
            overflow: hidden !important;
          }

          /* Exibe exclusivamente o container do cartaz */
          .destino-print-only, .destino-print-only * {
            visibility: visible !important;
          }

          .destino-print-only {
            display: block !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            z-index: 999999 !important;
          }

          /* ── ESTILOS DA ARTE VISUAL FIEL AOS MODELOS ── */
          .poster-card {
            box-sizing: border-box !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          }

          .card-border {
            width: 100% !important;
            height: 100% !important;
            border: 3px solid #053361 !important;
            border-radius: 24px !important;
            padding: 16px 14px 12px 14px !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
            background: #ffffff !important;
          }

          .grid-card .card-border {
            border-width: 2px !important;
            border-radius: 14px !important;
            padding: 6px 6px 4px 6px !important;
          }

          /* Cabeçalho Azul com Faixa Verde */
          .card-header {
            width: 100% !important;
            background: #053361 !important;
            border-radius: 12px !important;
            padding: 12px 16px 10px 16px !important;
            text-align: center !important;
            box-sizing: border-box !important;
          }

          .grid-card .card-header {
            border-radius: 8px !important;
            padding: 4px 6px 3px 6px !important;
          }

          .header-title {
            color: #ffffff !important;
            font-size: 26px !important;
            font-weight: 900 !important;
            letter-spacing: 0.05em !important;
            margin: 0 !important;
            text-transform: uppercase !important;
            line-height: 1 !important;
          }

          .grid-card .header-title {
            font-size: 11px !important;
            letter-spacing: 0.02em !important;
          }

          .header-green-line {
            width: 48px !important;
            height: 4px !important;
            background: #048a47 !important;
            margin: 6px auto 0 auto !important;
            border-radius: 2px !important;
          }

          .grid-card .header-green-line {
            width: 20px !important;
            height: 2px !important;
            margin-top: 2px !important;
          }

          /* Texto de Instrução Direta */
          .instruction-text {
            color: #0f2942 !important;
            font-size: 14px !important;
            font-weight: 800 !important;
            margin: 12px 0 8px 0 !important;
            text-align: center !important;
          }

          .grid-card .instruction-text {
            font-size: 7.5px !important;
            margin: 3px 0 2px 0 !important;
            font-weight: 700 !important;
          }

          /* Moldura do QR Code */
          .qr-wrapper {
            background: #ffffff !important;
            border: 2px solid #e2e8f0 !important;
            border-radius: 24px !important;
            padding: 16px !important;
            box-shadow: 0 4px 14px rgba(0,0,0,0.04) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 4px 0 !important;
          }

          .single-card .qr-wrapper {
            border-radius: 28px !important;
            padding: 22px !important;
          }

          .grid-card .qr-wrapper {
            border-radius: 10px !important;
            padding: 4px !important;
            border-width: 1px !important;
          }

          .card-valor {
            font-size: 14px !important;
            font-weight: 800 !important;
            color: #047857 !important;
            background: #ecfdf5 !important;
            border: 1px solid #a7f3d0 !important;
            padding: 3px 12px !important;
            border-radius: 8px !important;
            margin: 2px 0 !important;
          }

          .grid-card .card-valor {
            font-size: 7.5px !important;
            padding: 1px 4px !important;
          }

          /* Barra de Instrução com Ícone do Celular */
          .action-bar {
            width: 100% !important;
            background: #ebf6f0 !important;
            border-radius: 14px !important;
            padding: 10px 14px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 12px !important;
            box-sizing: border-box !important;
            margin-top: 6px !important;
          }

          .grid-card .action-bar {
            border-radius: 6px !important;
            padding: 3px 6px !important;
            gap: 4px !important;
            margin-top: 2px !important;
          }

          .phone-icon-box {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: #048a47 !important;
          }

          .phone-svg {
            width: 28px !important;
            height: 28px !important;
            stroke: #048a47 !important;
          }

          .grid-card .phone-svg {
            width: 12px !important;
            height: 12px !important;
          }

          .action-text {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            text-align: left !important;
          }

          .grid-card .action-text {
            align-items: center !important;
            text-align: center !important;
          }

          .action-main {
            color: #048a47 !important;
            font-size: 15px !important;
            font-weight: 900 !important;
            letter-spacing: 0.04em !important;
            line-height: 1.1 !important;
          }

          .grid-card .action-main {
            font-size: 7.5px !important;
          }

          .action-sub {
            color: #0f2942 !important;
            font-size: 11px !important;
            font-weight: 900 !important;
            letter-spacing: 0.03em !important;
          }

          .grid-card .action-sub {
            font-size: 5.5px !important;
          }

          /* Rodapé Bíblico Inspiracional */
          .footer-biblical {
            width: 100% !important;
            text-align: center !important;
            margin-top: 10px !important;
          }

          .divider-line {
            width: 80% !important;
            height: 1px !important;
            background: #a7f3d0 !important;
            margin: 0 auto 8px auto !important;
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .heart-icon {
            background: #ffffff !important;
            padding: 0 6px !important;
            color: #048a47 !important;
            font-size: 14px !important;
          }

          .scripture-headline {
            font-family: 'Georgia', serif, italic !important;
            font-style: italic !important;
            color: #048a47 !important;
            font-size: 16px !important;
            margin: 0 0 2px 0 !important;
          }

          .scripture-sub {
            color: #1e293b !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            letter-spacing: 0.05em !important;
            margin: 0 0 1px 0 !important;
          }

          .scripture-ref {
            color: #475569 !important;
            font-size: 9.5px !important;
            font-weight: 700 !important;
            letter-spacing: 0.06em !important;
            margin: 0 !important;
          }

          .grid-footer-biblical {
            text-align: center !important;
            margin-top: 2px !important;
          }

          .grid-footer-biblical .scripture-headline {
            font-size: 6.5px !important;
          }

          .grid-footer-biblical .scripture-ref {
            font-size: 5.5px !important;
          }
        }
      `}</style>
    </>
  );
}
