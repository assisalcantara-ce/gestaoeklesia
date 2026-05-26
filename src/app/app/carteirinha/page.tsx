'use client';

/**
 * /app/carteirinha — Carteirinha digital do membro
 *
 * Exibe os dados da carteirinha com QR code para verificação.
 * Dados buscados via GET /api/v1/mobile/member/carteirinha
 */

import { useState, useEffect, useRef } from 'react';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';
import {
  User,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

interface CarteirinhaData {
  nome: string;
  matricula: string | null;
  unique_id: string | null;
  foto_url: string | null;
  cargo_ministerial: string | null;
  tipo_cadastro: string | null;
  status: string;
  data_batismo_aguas: string | null;
  data_validade_credencial: string | null;
  congregacao: string | null;
  ministerio: string | null;
  ministerio_logo: string | null;
  qr_payload: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Ativo', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  inactive: { label: 'Inativo', color: 'bg-gray-100 text-gray-500', icon: XCircle },
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-xs text-gray-700 font-semibold text-right max-w-[60%]">
        {value || '—'}
      </span>
    </div>
  );
}

export default function CarteirinhaPage() {
  const { member, isLoading: memberLoading } = useMobileMember();
  const sbRef = useRef(createClient());
  const [data, setData] = useState<CarteirinhaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCarteirinha = async () => {
    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('no-token');

      const res = await fetch('/api/v1/mobile/member/carteirinha', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!res.ok) throw new Error(`${res.status}`);
      const json: CarteirinhaData = await res.json();
      setData(json);
    } catch {
      setError('Não foi possível carregar a carteirinha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!memberLoading && member) {
      fetchCarteirinha();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberLoading, member?.id]);

  if (memberLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-dark-blue animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <MobileHeader title="Carteirinha" />
        <div className="pt-24 px-6 flex flex-col items-center gap-4">
          <AlertCircle size={48} className="text-red-400" />
          <p className="text-gray-600 text-sm text-center">{error}</p>
          <button
            onClick={fetchCarteirinha}
            className="flex items-center gap-2 bg-dark-blue text-white px-6 py-2.5 rounded-xl text-sm font-medium"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (!data) return null;

  const statusCfg = STATUS_CONFIG[data.status] ?? {
    label: data.status,
    color: 'bg-gray-100 text-gray-500',
    icon: User,
  };
  const StatusIcon = statusCfg.icon;

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <MobileHeader title="Carteirinha Digital" />

      <div className="pt-20 px-4">
        {/* Card principal */}
        <div className="bg-dark-blue rounded-3xl overflow-hidden shadow-2xl">
          {/* Header do card */}
          <div className="px-6 pt-6 pb-4 flex items-center gap-4">
            {data.ministerio_logo ? (
              <Image
                src={data.ministerio_logo}
                alt={data.ministerio ?? 'Ministério'}
                width={44}
                height={44}
                className="w-11 h-11 rounded-xl object-cover border-2 border-white/20"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border-2 border-white/20">
                <span className="text-white font-bold text-lg">
                  {(data.ministerio ?? 'M').charAt(0)}
                </span>
              </div>
            )}
            <div>
              <p className="text-white/60 text-xs font-medium">CARTEIRINHA DIGITAL</p>
              <p className="text-white text-sm font-bold leading-tight">
                {data.ministerio ?? 'Ministério'}
              </p>
            </div>
          </div>

          {/* Divisor */}
          <div className="h-px bg-white/10 mx-6" />

          {/* Corpo do card */}
          <div className="px-6 py-5 flex gap-5">
            {/* Foto */}
            <div className="flex-shrink-0">
              {data.foto_url ? (
                <Image
                  src={data.foto_url}
                  alt={data.nome}
                  width={72}
                  height={72}
                  className="w-[72px] h-[72px] rounded-2xl object-cover border-2 border-white/20"
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-2xl bg-white/10 flex items-center justify-center border-2 border-white/20">
                  <User size={28} className="text-white/50" />
                </div>
              )}
            </div>

            {/* Dados */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base leading-tight truncate">
                {data.nome}
              </p>
              {data.cargo_ministerial && (
                <p className="text-white/60 text-xs mt-0.5 truncate">{data.cargo_ministerial}</p>
              )}
              {data.congregacao && (
                <p className="text-white/50 text-xs mt-0.5 truncate">{data.congregacao}</p>
              )}
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}
                >
                  <StatusIcon size={10} />
                  {statusCfg.label}
                </span>
              </div>
            </div>
          </div>

          {/* Detalhes */}
          <div className="mx-6 mb-5 bg-white/5 rounded-2xl px-4 py-1">
            <InfoRow label="Matrícula" value={data.matricula} />
            <InfoRow label="Tipo" value={data.tipo_cadastro} />
            <InfoRow label="Batismo" value={formatDate(data.data_batismo_aguas)} />
            <InfoRow label="Validade" value={formatDate(data.data_validade_credencial)} />
          </div>

          {/* Rodapé com QR */}
          <div className="bg-white/10 px-6 py-5 flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-2xl shadow-lg">
              <QRCodeSVG value={data.qr_payload} size={128} />
            </div>
            {data.unique_id && (
              <p className="text-white/50 text-[10px] font-mono tracking-wider">
                {data.unique_id}
              </p>
            )}
            <p className="text-white/30 text-[10px]">
              Atualizado em {new Intl.DateTimeFormat('pt-BR').format(new Date())}
            </p>
          </div>
        </div>

        {/* Botão atualizar */}
        <button
          onClick={fetchCarteirinha}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-white rounded-xl py-3 text-sm font-medium text-gray-600 border border-gray-200 shadow-sm active:scale-[0.98] transition"
        >
          <RefreshCw size={14} />
          Atualizar carteirinha
        </button>
      </div>

      <MobileBottomNav />
    </div>
  );
}
