'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Printer, X, Grid, FileText, Smartphone } from 'lucide-react';

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

  return (
    <>
      {/* ── MODAL PRINCIPAL NA TELA (NÃO IMPRESSÃO) ── */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-100 relative animate-in fade-in zoom-in duration-150">
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

      {/* ── ELEMENTOS EXCLUSIVOS DE IMPRESSÃO A4 (ISOLADOS E FORMATADOS) ── */}

      {/* MODELO 1 POR FOLHA */}
      {printLayout === '1' && (
        <div className="pix-print-container-single">
          <div className="w-[188mm] h-[272mm] border-[4px] border-[#053361] rounded-[28px] p-6 flex flex-col items-center justify-between bg-white box-border text-center shadow-none">
            {/* Header */}
            <div className="w-full bg-[#053361] rounded-[18px] py-4 px-6 text-center text-white">
              <h2 className="text-3xl font-black tracking-widest uppercase text-white m-0 leading-none">
                CONTRIBUA VIA PIX
              </h2>
              <div className="w-20 h-1 bg-emerald-400 mx-auto mt-2 rounded-full" />
            </div>

            {/* Identificação / Destino */}
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-800 uppercase tracking-wide">
                {destino.label} {destino.congregacoes?.nome ? `• ${destino.congregacoes.nome}` : ''}
              </p>
              <p className="text-sm font-semibold text-slate-500">
                Aponte a câmera do seu celular para o QR Code
              </p>
            </div>

            {/* QR Code */}
            <div className="p-6 bg-white border-[3px] border-[#053361] rounded-[28px] shadow-sm flex flex-col items-center justify-center">
              <QRCodeSVG
                value={qrCodeValue}
                size={260}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Valor Sugerido (opcional) */}
            {destino.valor_fixo && (
              <div className="text-base font-extrabold text-[#053361] bg-slate-100 px-5 py-2 rounded-xl border border-slate-300">
                Valor Sugerido: {fmtBRL(Number(destino.valor_fixo))}
              </div>
            )}

            {/* Barra de Instrução */}
            <div className="w-full bg-slate-100 border border-slate-300 rounded-[20px] py-3.5 px-6 flex items-center justify-center gap-4 text-[#053361]">
              <div className="w-10 h-10 rounded-xl bg-[#053361] text-white flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-base font-black tracking-wider uppercase leading-snug">LEIA O QR CODE</div>
                <div className="text-xs font-bold text-slate-600 tracking-wide">ESCOLHA O VALOR • CONFIRME NO BANCO</div>
              </div>
            </div>

            {/* Rodapé Inspiracional */}
            <div className="w-full text-center space-y-1 pt-2 border-t border-slate-200">
              <p className="text-sm font-bold text-slate-700">
                Sua generosidade transforma vidas!
              </p>
              <p className="text-xs font-extrabold text-[#053361] uppercase tracking-wider">
                DEUS AMA QUEM DÁ COM ALEGRIA.
              </p>
              <p className="text-[11px] font-semibold text-slate-500">
                2 CORÍNTIOS 9:7
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODELO 8 POR FOLHA (GRADE 2x4) */}
      {printLayout === '8' && (
        <div className="pix-print-container-grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="w-[94mm] h-[66mm] border-[2px] border-[#053361] rounded-[14px] p-2 flex flex-col items-center justify-between bg-white box-border text-center overflow-hidden"
            >
              {/* Header Mini */}
              <div className="w-full bg-[#053361] rounded-[7px] py-1 px-2 text-center text-white">
                <h3 className="text-[11px] font-black tracking-wider uppercase text-white m-0 leading-tight">
                  CONTRIBUA VIA PIX
                </h3>
              </div>

              {/* Subtítulo */}
              <p className="text-[7.5px] font-bold text-slate-700 leading-tight truncate max-w-full px-1">
                {destino.label} {destino.congregacoes?.nome ? `(${destino.congregacoes.nome})` : ''}
              </p>

              {/* QR Code Mini */}
              <div className="p-1 bg-white border border-[#053361] rounded-[8px] flex items-center justify-center">
                <QRCodeSVG
                  value={qrCodeValue}
                  size={95}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Barra de Instrução Mini */}
              <div className="w-full bg-slate-100 rounded-[6px] py-0.5 px-2 flex items-center justify-center gap-1.5 text-[#053361] border border-slate-200">
                <span className="text-[7px] font-black tracking-wider uppercase leading-none">LEIA O QR CODE</span>
                <span className="text-[6.5px] font-bold text-slate-600 leading-none">• CONFIRME NO BANCO</span>
              </div>

              {/* Rodapé Mini */}
              <div className="w-full text-center leading-none">
                <span className="text-[6.5px] font-extrabold text-[#053361]">DEUS AMA QUEM DÁ COM ALEGRIA </span>
                <span className="text-[6px] font-semibold text-slate-500">(2Co 9:7)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REGRAS GLOBAIS DE IMPRESSÃO ── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          /* Oculta tudo na tela */
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Garante visibilidade e posicionamento dos containers de impressão */
          .pix-print-container-single {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            padding: 10mm 11mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 999999 !important;
            visibility: visible !important;
          }

          .pix-print-container-single * {
            visibility: visible !important;
          }

          .pix-print-container-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 94mm) !important;
            grid-template-rows: repeat(4, 66mm) !important;
            align-content: center !important;
            justify-content: center !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            padding: 7mm 6mm !important;
            gap: 4mm 6mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 999999 !important;
            visibility: visible !important;
          }

          .pix-print-container-grid * {
            visibility: visible !important;
          }
        }
      `}</style>
    </>
  );
}

