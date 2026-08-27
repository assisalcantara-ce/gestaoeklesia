'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Copy, Check, Printer, Download, X, QrCode, Globe, Smartphone, Building2 } from 'lucide-react';

interface PublicMemberQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionIdentifier: string; // slug ou id do ministério
  institutionName: string;
  logoUrl?: string;
}

export default function PublicMemberQrModal({
  isOpen,
  onClose,
  institutionIdentifier,
  institutionName,
  logoUrl,
}: PublicMemberQrModalProps) {
  const [copied, setCopied] = useState(false);
  const [generatingPng, setGeneratingPng] = useState(false);

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

  // Gerar a imagem PNG exatamente igual ao cartaz de impressão usando html2canvas
  const handleDownloadPosterPng = async () => {
    const posterElement = document.getElementById('a4-poster-printable-card');
    if (!posterElement) return;

    try {
      setGeneratingPng(true);

      const canvas = await html2canvas(posterElement, {
        scale: 3, // Alta resolução (impressão HD)
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const image = canvas.toDataURL('image/png', 1.0);
      const downloadLink = document.createElement('a');
      downloadLink.href = image;
      downloadLink.download = `cartaz-cadastro-membros-${institutionIdentifier}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('Erro ao gerar imagem PNG do cartaz:', err);
    } finally {
      setGeneratingPng(false);
    }
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
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={institutionName}
                  className="h-10 w-10 object-contain rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
                />
              ) : (
                <div className="p-2.5 rounded-xl bg-[#123b63] text-white shadow-md shadow-[#123b63]/20">
                  <QrCode className="h-5 w-5" />
                </div>
              )}
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
              onClick={handleDownloadPosterPng}
              disabled={generatingPng}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-slate-600" />
              {generatingPng ? 'Gerando PNG...' : 'Baixar Imagem PNG'}
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

      {/* ── LAYOUT DE IMPRESSÃO A4 PROFISSIONAL (VISÍVEL APENAS AO IMPRIMIR E USADO NA GERAÇÃO DO PNG) ── */}
      <div className="member-qr-print-a4">
        <div id="a4-poster-printable-card" className="a4-poster-container">
          
          {/* Topo / Header da Igreja com Logomarca Dinâmica */}
          <div className="poster-header">
            <div className="church-icon-badge">
              {logoUrl ? (
                <img src={logoUrl} alt={institutionName} className="church-logo-img" />
              ) : (
                <Building2 className="w-10 h-10 text-[#053361]" />
              )}
            </div>
            <h1 className="church-title">{institutionName}</h1>
            <div className="subtitle-badge">RECADASTRAMENTO & ATUALIZAÇÃO CADASTRAL</div>
          </div>

          {/* Chamada Principal */}
          <div className="instruction-box">
            <h2 className="headline-text">MANTENHA SEU CADASTRO ATUALIZADO!</h2>
            <p className="sub-headline">
              Aponte a câmera do seu celular para o QR Code abaixo e atualize suas informações de forma rápida e segura.
            </p>
          </div>

          {/* Moldura Centralizada do QR Code (SEM O LINK/URL NA IMPRESSÃO) */}
          <div className="qr-frame-wrapper">
            <div className="qr-inner-card">
              <QRCodeSVG
                value={publicUrl}
                size={340}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          {/* Instruções em Passos (EMPILHADOS UM ACIMA DO OUTRO) */}
          <div className="steps-container-vertical">
            <div className="step-card-row">
              <div className="step-number-badge">1</div>
              <div className="step-content-row">
                <strong>Aponte a Câmera</strong>
                <span>Abra a câmera do celular no QR Code acima</span>
              </div>
            </div>

            <div className="step-card-row">
              <div className="step-number-badge">2</div>
              <div className="step-content-row">
                <strong>Informe seu CPF</strong>
                <span>Digite seu CPF para consultar ou iniciar seu registro</span>
              </div>
            </div>

            <div className="step-card-row">
              <div className="step-number-badge">3</div>
              <div className="step-content-row">
                <strong>Atualize seus Dados</strong>
                <span>Confira e mantenha seus contatos e endereço atualizados</span>
              </div>
            </div>
          </div>

          {/* Rodapé do Cartaz */}
          <div className="poster-footer">
            <p className="footer-notice">
              Sem login ou senhas • Rápido, prático e 100% seguro
            </p>
            <p className="footer-brand">
              Gestão Eklésia — Plataforma de Gestão Eclesiástica
            </p>
          </div>

        </div>
      </div>

      {/* ── CSS DE IMPRESSÃO EXCLUSIVO PARA FOLHA A4 ── */}
      <style jsx global>{`
        /* Esconde o container de impressão na tela normal da web */
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
            padding: 8mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
          }
        }

        /* Estilos do Cartaz A4 (usado tanto no print quanto no html2canvas para PNG) */
        .a4-poster-container {
          width: 190mm !important;
          height: 277mm !important;
          border: 4px solid #053361 !important;
          border-radius: 24px !important;
          padding: 20px 24px !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: space-between !important;
          text-align: center !important;
          background: #ffffff !important;
          font-family: system-ui, -apple-system, sans-serif !important;
        }

        /* Topo */
        .poster-header {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }

        .church-icon-badge {
          width: 68px !important;
          height: 68px !important;
          background: #ffffff !important;
          border-radius: 18px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 auto 6px auto !important;
          border: 2px solid #e2e8f0 !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
          overflow: hidden !important;
        }

        .church-logo-img {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          padding: 4px !important;
        }

        .church-title {
          font-size: 24px !important;
          font-weight: 900 !important;
          color: #053361 !important;
          text-transform: uppercase !important;
          letter-spacing: -0.01em !important;
          margin: 0 0 4px 0 !important;
          line-height: 1.1 !important;
        }

        .subtitle-badge {
          display: inline-block !important;
          background: #053361 !important;
          color: #ffffff !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          padding: 4px 14px !important;
          border-radius: 20px !important;
          letter-spacing: 0.08em !important;
        }

        /* Caixa de Chamada */
        .instruction-box {
          margin: 4px 0 !important;
        }

        .headline-text {
          font-size: 21px !important;
          font-weight: 900 !important;
          color: #053361 !important;
          margin: 0 0 4px 0 !important;
          letter-spacing: 0.02em !important;
        }

        .sub-headline {
          font-size: 12px !important;
          color: #475569 !important;
          max-width: 150mm !important;
          margin: 0 auto !important;
          line-height: 1.3 !important;
        }

        /* Moldura do QR Code */
        .qr-frame-wrapper {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          margin: 4px 0 !important;
        }

        .qr-inner-card {
          background: #ffffff !important;
          padding: 16px !important;
          border-radius: 24px !important;
          border: 3px solid #053361 !important;
          box-shadow: 0 8px 20px -4px rgba(5, 51, 97, 0.15) !important;
        }

        /* Passos Empilhados Verticalmente */
        .steps-container-vertical {
          display: flex !important;
          flex-direction: column !important;
          width: 100% !important;
          gap: 8px !important;
          margin: 6px 0 !important;
        }

        .step-card-row {
          width: 100% !important;
          background: #f8fafc !important;
          border: 1.5px solid #cbd5e1 !important;
          border-radius: 12px !important;
          padding: 8px 14px !important;
          display: flex !important;
          align-items: center !important;
          gap: 14px !important;
          text-align: left !important;
          box-sizing: border-box !important;
        }

        .step-number-badge {
          width: 30px !important;
          height: 30px !important;
          background: #053361 !important;
          color: #ffffff !important;
          border-radius: 10px !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          shrink: 0 !important;
        }

        .step-content-row {
          display: flex !important;
          flex-direction: column !important;
        }

        .step-content-row strong {
          font-size: 12px !important;
          color: #0f172a !important;
          line-height: 1.2 !important;
        }

        .step-content-row span {
          font-size: 10px !important;
          color: #64748b !important;
          line-height: 1.1 !important;
        }

        /* Rodapé */
        .poster-footer {
          border-top: 1px solid #e2e8f0 !important;
          padding-top: 8px !important;
          width: 100% !important;
        }

        .footer-notice {
          font-size: 11px !important;
          font-weight: 800 !important;
          color: #053361 !important;
          margin: 0 0 2px 0 !important;
        }

        .footer-brand {
          font-size: 9.5px !important;
          color: #64748b !important;
          margin: 0 !important;
        }
      `}</style>
    </>
  );
}
