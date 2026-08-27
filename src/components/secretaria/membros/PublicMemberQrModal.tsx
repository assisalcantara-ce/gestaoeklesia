'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Printer, Download, X, QrCode, Globe, Smartphone, Building2 } from 'lucide-react';

interface PublicMemberQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionIdentifier: string; // slug ou id do ministério
  institutionName: string;
}

export default function PublicMemberQrModal({
  isOpen,
  onClose,
  institutionIdentifier,
  institutionName,
}: PublicMemberQrModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !institutionIdentifier) return null;

  // Construir a URL pública completa
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = `${origin}/membro/${institutionIdentifier}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownloadQr = () => {
    const svgElement = document.getElementById('public-member-qr-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 80;
      canvas.height = img.height + 80;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 40, 40);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngFile;
        downloadLink.download = `qr-code-cadastro-membros-${institutionIdentifier}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* ── INTERFACE DO MODAL (VISÍVEL SOMENTE NA TELA DA APLICAÇÃO) ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Cabeçalho do Modal */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#123b63] text-white shadow-md shadow-[#123b63]/20">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">
                  Cadastro Público de Membros
                </h3>
                <p className="text-xs font-semibold text-[#123b63]">{institutionName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Corpo do Modal */}
          <div className="p-6 space-y-5 flex-1 overflow-y-auto text-center">
            
            {/* Orientações de Compartilhamento */}
            <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-950 text-left leading-relaxed flex items-start gap-3">
              <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg shrink-0 mt-0.5">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-blue-950 mb-0.5">Orientações de Uso & Compartilhamento</p>
                Exiba ou imprima este QR Code no aviso dos cultos para que os membros consultem e atualizem seus dados diretamente no celular pelo CPF.
              </div>
            </div>

            {/* QR Code Grande e Estilizado na Web */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-lg relative group">
                <QRCodeSVG
                  id="public-member-qr-svg"
                  value={publicUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <span className="mt-3 text-[11px] font-mono font-medium text-slate-600 bg-white px-3.5 py-1 rounded-full border border-slate-200 shadow-sm">
                {publicUrl}
              </span>
            </div>

            {/* Link Público com Ação de Copiar */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Link Público da Instituição
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-mono truncate flex items-center gap-2">
                  <Globe className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="truncate font-semibold">{publicUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Rodapé do Modal */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-2"
            >
              <Download className="h-4 w-4 text-slate-600" />
              Baixar Imagem PNG
            </button>
            
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Cartaz A4
            </button>
          </div>

        </div>
      </div>

      {/* ── LAYOUT DE IMPRESSÃO A4 PROFISSIONAL (VISÍVEL APENAS AO IMPRIMIR) ── */}
      <div className="member-qr-print-a4">
        <div className="a4-poster-container">
          
          {/* Topo / Header da Igreja */}
          <div className="poster-header">
            <div className="church-icon-badge">
              <Building2 className="w-10 h-10 text-[#053361]" />
            </div>
            <h1 className="church-title">{institutionName}</h1>
            <div className="subtitle-badge">RECADASTRAMENTO & ATUALIZAÇÃO CADASTRAIL</div>
          </div>

          {/* Chamada Principal */}
          <div className="poster-[#053361] instruction-box">
            <h2 className="headline-text">MANTENHA SEU CADASTRO ATUALIZADO!</h2>
            <p className="sub-headline">
              Aponte a câmera do seu celular para o QR Code abaixo e atualize suas informações de forma rápida e segura.
            </p>
          </div>

          {/* Moldura Centralizada do QR Code */}
          <div className="qr-frame-wrapper">
            <div className="qr-inner-card">
              <QRCodeSVG
                value={publicUrl}
                size={340}
                level="H"
                includeMargin={true}
              />
            </div>
            <div className="qr-url-badge">{publicUrl}</div>
          </div>

          {/* Instruções em Passos */}
          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-content">
                <strong>Aponte a Câmera</strong>
                <span>Abra a câmera do celular no QR Code</span>
              </div>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-content">
                <strong>Informe seu CPF</strong>
                <span>Digite seu CPF para identificar seu registro</span>
              </div>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-content">
                <strong>Atualize seus Dados</strong>
                <span>Confira e atualize seu endereço e contatos</span>
              </div>
            </div>
          </div>

          {/* Rodapé do Cartaz */}
          <div className="poster-footer">
            <p className="footer-notice">
              Sem login ou senhas • Rápido, prático e 100% seguro
            </p>
            <p className="footer-[#123b63] brand">
              Gestão Eklésia — Plataforma de Gestão Eclesiástica
            </p>
          </div>

        </div>
      </div>

      {/* ── CSS DE IMPRESSÃO EXCLUSIVO PARA FOLHA A4 ── */}
      <style jsx global>{`
        /* Esconde o container de impressão na tela normal */
        .member-qr-print-a4 {
          display: none !important;
        }

        @media print {
          /* Esconder elementos da aplicação na impressão */
          body * {
            visibility: hidden !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }

          /* Configuração da Página A4 */
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }

          /* Tornar visível apenas a folha de impressão A4 */
          .member-qr-print-a4, .member-qr-print-a4 * {
            visibility: visible !important;
          }

          .member-qr-print-a4 {
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
          }

          .a4-poster-container {
            width: 190mm !important;
            height: 277mm !important;
            border: 4px solid #053361 !important;
            border-radius: 24px !important;
            padding: 24px !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
            text-align: center !important;
            background: #ffffff !important;
          }

          /* Topo */
          .church-icon-badge {
            width: 60px !important;
            height: 60px !important;
            background: #f0f4f8 !important;
            border-radius: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 auto 8px auto !important;
            border: 1px solid #cbd5e1 !important;
          }

          .church-title {
            font-size: 26px !important;
            font-weight: 900 !important;
            color: #053361 !important;
            text-transform: uppercase !important;
            letter-spacing: -0.02em !important;
            margin: 0 0 6px 0 !important;
            line-height: 1.1 !important;
          }

          .subtitle-badge {
            display: inline-block !important;
            background: #053361 !important;
            color: #ffffff !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            padding: 4px 14px !important;
            border-radius: 20px !important;
            letter-spacing: 0.08em !important;
          }

          /* Caixa de Chamada */
          .instruction-box {
            margin: 10px 0 !important;
          }

          .headline-text {
            font-size: 22px !important;
            font-weight: 900 !important;
            color: #053361 !important;
            margin: 0 0 6px 0 !important;
            letter-spacing: 0.02em !important;
          }

          .sub-headline {
            font-size: 13px !important;
            color: #475569 !important;
            max-width: 140mm !important;
            margin: 0 auto !important;
            line-height: 1.3 !important;
          }

          /* Moldura do QR Code */
          .qr-frame-wrapper {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            margin: 8px 0 !important;
          }

          .qr-inner-card {
            background: #ffffff !important;
            padding: 20px !important;
            border-radius: 24px !important;
            border: 3px solid #053361 !important;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1) !important;
          }

          .qr-url-badge {
            margin-top: 12px !important;
            font-family: monospace !important;
            font-size: 11px !important;
            color: #334155 !important;
            background: #f1f5f9 !important;
            padding: 4px 16px !important;
            border-radius: 20px !important;
            border: 1px solid #cbd5e1 !important;
          }

          /* Passos */
          .steps-container {
            display: flex !important;
            justify-content: space-between !important;
            width: 100% !important;
            gap: 12px !important;
            margin: 10px 0 !important;
          }

          .step-card {
            flex: 1 !important;
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 14px !important;
            padding: 10px 8px !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            text-align: left !important;
          }

          .step-number {
            width: 32px !important;
            height: 32px !important;
            background: #053361 !important;
            color: #ffffff !important;
            border-radius: 10px !important;
            font-size: 16px !important;
            font-weight: 900 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            shrink: 0 !important;
          }

          .step-content {
            display: flex !important;
            flex-direction: column !important;
          }

          .step-content strong {
            font-size: 11px !important;
            color: #0f172a !important;
            line-height: 1.2 !important;
          }

          .step-content span {
            font-size: 9px !important;
            color: #64748b !important;
            line-height: 1.1 !important;
          }

          /* Rodapé */
          .poster-footer {
            border-top: 1px border #e2e8f0 !important;
            padding-top: 8px !important;
            width: 100% !important;
          }

          .footer-notice {
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #053361 !important;
            margin: 0 0 2px 0 !important;
          }

          .footer-brand {
            font-size: 9px !important;
            color: #94a3b8 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
