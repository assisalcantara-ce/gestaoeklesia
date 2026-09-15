'use client';

/**
 * IngressoModal.tsx
 *
 * Modal com o Ingresso Digital e QR Code de Check-in para o membro participante.
 * Design System Dark + Blue Institucional
 */

import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Calendar,
  MapPin,
  CheckCircle2,
  Bed,
  Sparkles,
  Ticket,
  User,
} from 'lucide-react';

interface IngressoData {
  inscricaoId: string;
  eventoTitulo: string;
  dataInicio?: string | null;
  localNome?: string | null;
  localEndereco?: string | null;
  membroNome: string;
  comHospedagem?: boolean;
  statusHospedagem?: string;
  presente?: boolean;
}

interface IngressoModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: IngressoData | null;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function IngressoModal({
  isOpen,
  onClose,
  data,
}: IngressoModalProps) {
  if (!isOpen || !data) return null;

  // Valor seguro e limpo para o QR Code (apenas identificador de check-in)
  const qrCodeValue = JSON.stringify({
    type: 'EVENTO_CHECKIN',
    ins: data.inscricaoId,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#111827] rounded-3xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col">
        {/* Top Header estilo Ticket */}
        <div className="bg-[#172033] border-b border-slate-800 text-slate-100 px-6 pt-6 pb-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-300 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Ticket size={16} />
            <span>Ingresso Digital</span>
          </div>

          <h3 className="text-xl font-bold leading-snug line-clamp-2 text-slate-100">
            {data.eventoTitulo}
          </h3>

          <div className="mt-3 flex items-center gap-2">
            {data.presente ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 size={13} />
                Check-in Realizado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 size={13} />
                Inscrição Confirmada
              </span>
            )}

            {data.comHospedagem && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400">
                <Bed size={13} />
                Hospedagem
              </span>
            )}
          </div>
        </div>

        {/* Linha serrilhada divisória com círculos laterais */}
        <div className="relative flex items-center justify-between px-2 bg-[#111827] -mt-3">
          <div className="w-5 h-5 rounded-full bg-black/80 -ml-4" />
          <div className="flex-1 border-b-2 border-dashed border-slate-800 mx-2" />
          <div className="w-5 h-5 rounded-full bg-black/80 -mr-4" />
        </div>

        {/* Corpo do Ingresso com QR Code */}
        <div className="p-6 flex flex-col items-center text-center bg-[#111827]">
          {/* Container branco para garantir perfeito contraste de leitura do QR Code na portaria */}
          <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-700 inline-block mb-4">
            <QRCodeSVG
              value={qrCodeValue}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>

          <div className="w-full text-left bg-[#172033] rounded-2xl p-4 mb-4 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <User size={14} className="text-blue-400 shrink-0" />
              <span className="font-semibold text-slate-100 truncate">
                {data.membroNome}
              </span>
            </div>

            {data.dataInicio && (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Calendar size={14} className="text-blue-400 shrink-0" />
                <span>{formatDate(data.dataInicio)}</span>
              </div>
            )}

            {data.localNome && (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <MapPin size={14} className="text-blue-400 shrink-0" />
                <span className="truncate">{data.localNome}</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-400 shrink-0" />
            Apresente este QR Code na portaria/recepção do evento.
          </p>

          <button
            onClick={onClose}
            className="w-full mt-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-md shadow-blue-900/30 active:scale-[0.98]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

