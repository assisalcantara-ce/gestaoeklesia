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
    tipo_recebimento: string;
    valor_fixo?: number | null;
    congregacoes?: { nome: string } | null;
  } | null;
  fmtBRL: (v: number) => string;
}

export default function DestinoQrModal({ isOpen, onClose, destino, fmtBRL }: DestinoQrModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !destino) return null;

  const publicUrl = `https://app.gestaoeklesia.com.br/pagar/${destino.public_token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignora falhas de clipboard
    }
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
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-center text-xs space-y-1">
            <p className="font-bold uppercase tracking-wide">QR Code de Acesso à Arrecadação</p>
            <p className="text-[11px] text-amber-800">
              Aponte a <strong>câmera do celular</strong> para abrir a página de contribuição.
            </p>
          </div>

          {/* QR Code Canvas */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
              <QRCodeSVG
                value={publicUrl}
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

          {/* Link Público */}
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
                onClick={handleCopy}
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
              <ExternalLink className="h-3.5 w-3.5" /> Testar Link
            </a>
          </div>
        </div>
      </div>

      {/* Cartaz Exclusivo de Impressão A4 */}
      <div className="print-only hidden p-12 bg-white text-slate-900 text-center space-y-8 max-w-2xl mx-auto border-4 border-[#123b63] rounded-3xl">
        <div className="space-y-2 border-b-2 border-slate-200 pb-6">
          <p className="text-sm font-bold uppercase tracking-widest text-[#123b63]">
            {destino.congregacoes?.nome ?? 'Igreja Registrada'}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            {destino.label}
          </h1>
          <span className="inline-block px-4 py-1 bg-slate-100 text-slate-800 text-sm font-bold rounded-full uppercase tracking-wider">
            Contribua via PIX — {TIPO_LABELS[destino.tipo_recebimento] ?? destino.tipo_recebimento}
          </span>
        </div>

        <div className="py-4 flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-white border-4 border-slate-900 rounded-3xl shadow-lg inline-block">
            <QRCodeSVG
              value={publicUrl}
              size={260}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="space-y-1">
            <p className="text-lg font-extrabold text-[#123b63]">
              📷 APONTE A CÂMERA DO SEU CELULAR
            </p>
            <p className="text-sm text-slate-600 font-semibold">
              Acesse a página de contribuição para digitar o valor e pagar via PIX.
            </p>
          </div>
        </div>

        <div className="border-t-2 border-slate-200 pt-6 space-y-2">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Ou acesse diretamente pelo endereço web:
          </p>
          <p className="text-base font-mono font-bold text-[#123b63] bg-slate-50 py-2 px-4 rounded-xl border border-slate-200 inline-block">
            {publicUrl}
          </p>
        </div>
      </div>
    </>
  );
}
