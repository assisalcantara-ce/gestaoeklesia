'use client';

/**
 * IngressoModal.tsx
 *
 * Modal com o Ingresso Digital e QR Code de Check-in para o membro participante.
 * Utiliza o identificador opaco da inscrição para validação segura na portaria do evento.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
        {/* Top Header estilo Ticket */}
        <div className="bg-dark-blue text-white px-6 pt-6 pb-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/80 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">
            <Ticket size={16} />
            <span>Ingresso Digital</span>
          </div>

          <h3 className="text-xl font-bold leading-snug line-clamp-2">
            {data.eventoTitulo}
          </h3>

          <div className="mt-3 flex items-center gap-2">
            {data.presente ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500 text-white">
                <CheckCircle2 size={13} />
                Check-in Realizado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                <CheckCircle2 size={13} />
                Inscrição Confirmada
              </span>
            )}

            {data.comHospedagem && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                <Bed size={13} />
                Hospedagem
              </span>
            )}
          </div>
        </div>

        {/* Linha serrilhada divisória com círculos laterais */}
        <div className="relative flex items-center justify-between px-2 bg-white -mt-3">
          <div className="w-5 h-5 rounded-full bg-black/60 -ml-4" />
          <div className="flex-1 border-b-2 border-dashed border-gray-200 mx-2" />
          <div className="w-5 h-5 rounded-full bg-black/60 -mr-4" />
        </div>

        {/* Corpo do Ingresso com QR Code */}
        <div className="p-6 flex flex-col items-center text-center bg-white">
          <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-200 inline-block mb-4">
            <QRCodeSVG
              value={qrCodeValue}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>

          <div className="w-full text-left bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100 space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <User size={14} className="text-dark-blue shrink-0" />
              <span className="font-semibold text-gray-800 truncate">
                {data.membroNome}
              </span>
            </div>

            {data.dataInicio && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar size={14} className="text-dark-blue shrink-0" />
                <span>{formatDate(data.dataInicio)}</span>
              </div>
            )}

            {data.localNome && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <MapPin size={14} className="text-dark-blue shrink-0" />
                <span className="truncate">{data.localNome}</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500 shrink-0" />
            Apresente este QR Code na portaria/recepção do evento.
          </p>

          <button
            onClick={onClose}
            className="w-full mt-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors active:scale-[0.98]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
