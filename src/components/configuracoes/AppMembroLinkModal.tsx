'use client';

/**
 * AppMembroLinkModal
 * 
 * Modal na área administrativa para divulgar o App do Membro / Página Pública:
 * - Exibe o slug público e link oficial
 * - Permite copiar o link com 1 clique
 * - Exibe QR Code gerado em tempo real com opção de download/impressão
 * - Botão de Pré-visualização da página pública (/igreja/[slug])
 */

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Download,
  X,
  Globe,
} from 'lucide-react';

interface AppMembroLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  igrejaNome: string;
  logoUrl?: string | null;
}

export default function AppMembroLinkModal({
  isOpen,
  onClose,
  slug,
  igrejaNome,
  logoUrl: _logoUrl,
}: AppMembroLinkModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !slug) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.gestaoeklesia.com.br';
  const publicUrl = `${origin}/igreja/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownloadQr = () => {
    const svg = document.getElementById('qr-code-app-membro-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 100, 100, 800, 800);
      }
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qrcode-app-${slug}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl relative border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs border border-blue-100">
            <Smartphone size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">
              Divulgação do App da Igreja
            </h3>
            <p className="text-xs text-slate-500 font-medium">{igrejaNome}</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-5 leading-relaxed">
          Compartilhe este link ou QR Code com os membros e visitantes. Qualquer pessoa poderá acessar a programação, cultos, eventos, notícias e pedidos de oração direto no celular, sem necessidade de senha.
        </p>

        {/* Link Oficial */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Link Público e Permanente
          </label>
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-200">
            <Globe size={18} className="text-blue-500 ml-2 shrink-0" />
            <input
              type="text"
              readOnly
              value={publicUrl}
              className="w-full bg-transparent text-xs font-mono font-semibold text-slate-800 outline-none truncate"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check size={14} />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copiar Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* QR Code */}
        <div className="p-5 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-5 mb-5">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm shrink-0">
            <QRCodeSVG
              id="qr-code-app-membro-svg"
              value={publicUrl}
              size={140}
              level="H"
              includeMargin
            />
          </div>

          <div className="space-y-2 text-center sm:text-left flex-1">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
              Acesso Móvel Imediato
            </span>
            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              Escaneie com a câmera do celular
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ideal para colocar em boletins, telões de transmissão, cartazes e púlpito da igreja.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                <Download size={13} />
                <span>Baixar QR Code (PNG)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-3">
          <a
            href={`/igreja/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm text-center"
          >
            <span>Pré-visualizar Página Pública</span>
            <ExternalLink size={14} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
