'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Printer, Download, X, QrCode, Globe } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#123b63]/10 text-[#123b63]">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Cadastro Público de Membros
              </h3>
              <p className="text-xs text-slate-500">{institutionName}</p>
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
        <div className="p-6 space-y-6 flex-1 overflow-y-auto text-center">
          
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-900 leading-relaxed">
            <p className="font-semibold text-blue-950 mb-0.5">Orientações de Compartilhamento</p>
            Compartilhe este QR Code para que os membros possam consultar e atualizar seu cadastro através do celular.
          </div>

          {/* QR Code Grande e Centralizado */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-md">
              <QRCodeSVG
                id="public-member-qr-svg"
                value={publicUrl}
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>
            <span className="mt-3 text-[11px] font-mono font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
              {publicUrl}
            </span>
          </div>

          {/* Link Público com Ação de Copiar */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Link Público da Instituição
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-mono truncate flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{publicUrl}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2.5 bg-[#123b63] hover:bg-[#0d2a47] text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5 shrink-0"
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

        {/* Rodapé com Ações */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={handleDownloadQr}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            Baixar QR Code
          </button>
          
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>

      </div>
    </div>
  );
}
