'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Printer, X, ExternalLink } from 'lucide-react';

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

  const handlePrint = () => {
    window.print();
  };

  const TIPO_LABELS: Record<string, string> = {
    dizimo: 'Dízimo',
    oferta: 'Oferta',
    missoes: 'Missões',
    doacao: 'Doação',
    campanha_local: 'Campanha',
    evento_local: 'Evento',
  };

  return (
    <>
      {/* Modal na Interface Web */}
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
              {TIPO_LABELS[destino.tipo_recebimento] ?? destino.tipo_recebimento}
            </span>
            <h3 className="text-xl font-extrabold text-slate-800">{destino.label}</h3>
            <p className="text-xs text-slate-500 font-medium">
              📍 {destino.congregacoes?.nome ?? 'Sede / Todas as Congregações'}
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

          {/* QR Code Canvas */}
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
              onClick={handlePrint}
              className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <Printer className="h-4 w-4" /> Imprimir Cartaz QR Code
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

      {/* Cartaz Exclusivo de Impressão A4 Profissional */}
      <div className="destino-print-only hidden">
        <div className="a4-poster">
          {/* Cabeçalho / Instituição e Congregação */}
          <div className="poster-header">
            <p className="poster-institution">GESTÃO EKLÉSIA</p>
            <p className="poster-[#123b63] poster-congregation">
              📍 {destino.congregacoes?.nome ?? 'Sede / Todas as Congregações'}
            </p>
            <h1 className="poster-destination-title">{destino.label}</h1>
            <div className="poster-tag">
              CONTRIBUA VIA PIX — {TIPO_LABELS[destino.tipo_recebimento] ?? destino.tipo_recebimento}
            </div>
          </div>

          {/* Área Central: QR Code Estático Grande */}
          <div className="poster-body">
            <div className="poster-qr-frame">
              <QRCodeSVG
                value={qrCodeValue}
                size={340}
                level="H"
                includeMargin={true}
              />
            </div>

            {destino.valor_fixo && (
              <div className="poster-valor-sugerido">
                Valor Sugerido: {fmtBRL(Number(destino.valor_fixo))}
              </div>
            )}

            <div className="poster-instructions">
              <p className="poster-main-action">
                {hasStaticPix
                  ? 'ABRA O APP DO SEU BANCO E LEIA O QR CODE'
                  : '📷 APONTE A CÂMERA DO SEU CELULAR'}
              </p>
              <p className="poster-sub-action">
                {hasStaticPix
                  ? 'Escolha pagar via PIX no seu banco, escaneie o código acima e confirme o valor desejado.'
                  : 'Acesse a página de contribuição para digitar o valor e pagar via PIX.'}
              </p>
            </div>
          </div>

          {/* Área Secundária: Pix Copia e Cola / Rodapé */}
          <div className="poster-footer">
            {hasStaticPix && destino.pix_payload && (
              <div className="poster-copia-cola-box">
                <span className="poster-copia-cola-label">PIX Copia e Cola:</span>
                <span className="poster-copia-cola-code">{destino.pix_payload}</span>
              </div>
            )}
            <p className="poster-[#123b63] poster-web-url">
              {publicUrl}
            </p>
          </div>
        </div>
      </div>

      {/* Regras CSS Específicas de Impressão para o Cartaz */}
      <style jsx global>{`
        @media print {
          /* Garante que o cartaz do destino tenha prioridade total se aberto */
          body * {
            visibility: hidden !important;
          }
          .destino-print-only, .destino-print-only * {
            visibility: visible !important;
          }
          .destino-print-only {
            display: flex !important;
            justify-content: center;
            align-items: center;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            min-height: 100vh;
            background: #ffffff !important;
            padding: 20px;
          }
          .a4-poster {
            width: 100%;
            max-width: 680px;
            margin: 0 auto;
            padding: 40px 32px;
            border: 4px solid #123b63;
            border-radius: 28px;
            background: #ffffff;
            text-align: center;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }
          .poster-header {
            margin-bottom: 24px;
            width: 100%;
          }
          .poster-institution {
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 0.15em;
            color: #123b63;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .poster-congregation {
            font-size: 16px;
            font-weight: 700;
            color: #475569;
            margin-bottom: 12px;
          }
          .poster-destination-title {
            font-size: 36px;
            font-weight: 900;
            color: #0f172a;
            line-height: 1.1;
            margin-bottom: 14px;
          }
          .poster-tag {
            display: inline-block;
            padding: 6px 18px;
            background: #f1f5f9;
            color: #0f172a;
            font-size: 13px;
            font-weight: 800;
            border-radius: 9999px;
            letter-spacing: 0.05em;
          }
          .poster-body {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 24px;
            width: 100%;
          }
          .poster-qr-frame {
            padding: 20px;
            background: #ffffff;
            border: 4px solid #0f172a;
            border-radius: 24px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .poster-valor-sugerido {
            font-size: 16px;
            font-weight: 800;
            color: #047857;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 6px 16px;
            border-radius: 12px;
            margin-bottom: 16px;
          }
          .poster-instructions {
            max-width: 500px;
          }
          .poster-main-action {
            font-size: 18px;
            font-weight: 900;
            color: #123b63;
            margin-bottom: 6px;
            letter-spacing: 0.02em;
          }
          .poster-sub-action {
            font-size: 13px;
            font-weight: 600;
            color: #64748b;
            line-height: 1.4;
          }
          .poster-footer {
            border-top: 2px border #e2e8f0;
            padding-top: 20px;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .poster-copia-cola-box {
            background: #f8fafc;
            border: 1px border #cbd5e1;
            border-radius: 12px;
            padding: 8px 14px;
            max-width: 90%;
            word-break: break-all;
            font-family: monospace;
            font-size: 10px;
            color: #334155;
          }
          .poster-copia-cola-label {
            font-weight: 800;
            color: #0f172a;
            margin-right: 6px;
          }
          .poster-web-url {
            font-size: 12px;
            font-weight: 700;
            font-family: monospace;
            color: #123b63;
          }
        }
      `}</style>
    </>
  );
}
