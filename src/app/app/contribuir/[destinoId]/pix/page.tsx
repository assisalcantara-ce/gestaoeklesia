'use client';

/**
 * /app/contribuir/[destinoId]/pix — Tela de Pagamento PIX e Confirmação Automática
 *
 * Exibe o QR Code dinâmico, o código Copia e Cola e monitora o pagamento via polling.
 * Transiciona para a tela de confirmação assim que o webhook liquida no banco.
 */

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import { createClient } from '@/lib/supabase-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

interface ChargeStatus {
  id: string;
  status: 'pendente' | 'pago' | 'cancelado' | 'expirado' | 'estornado';
  valor_solicitado: number;
  valor_pago: number | null;
  paid_at: string | null;
  pix_payload: string | null;
}

const POLLING_INTERVAL_MS = 3500; // 3.5 segundos

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export default function ContribuirPixPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const destinoId = typeof params?.destinoId === 'string' ? params.destinoId : '';
  const chargeId = searchParams.get('chargeId') || '';

  const { member, isLoading: memberLoading } = useMobileMember();
  const sbRef = useRef(createClient());

  const [charge, setCharge] = useState<ChargeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async (): Promise<ChargeStatus | null> => {
    if (!chargeId) return null;
    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('no-token');

      const res = await fetch(`/api/v1/mobile/financeiro/pix/${chargeId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChargeStatus = await res.json();
      setCharge(data);
      return data;
    } catch {
      return null;
    }
  };

  // Carga inicial
  useEffect(() => {
    async function init() {
      if (!chargeId) {
        setError('Identificador da cobrança não informado.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      const data = await fetchStatus();
      if (!data) {
        setError('Não foi possível localizar os dados desta cobrança PIX.');
      }
      setLoading(false);
    }

    if (!memberLoading && member) {
      init();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeId, memberLoading, member]);

  // Polling de status enquanto 'pendente'
  useEffect(() => {
    if (!charge || charge.status !== 'pendente') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(async () => {
      const updated = await fetchStatus();
      if (updated && updated.status !== 'pendente') {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge?.status]);

  const handleCopyPix = async () => {
    if (!charge?.pix_payload) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(charge.pix_payload);
      } else {
        // Fallback para navegadores legados
        const textArea = document.createElement('textarea');
        textArea.value = charge.pix_payload;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      alert('Não foi possível copiar automaticamente. Selecione e copie o código manualmente.');
    }
  };

  if (memberLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !charge) {
    return (
      <MobileShell>
        <MobileHeader title="Pagamento PIX" showBack backHref={`/app/contribuir/${destinoId}`} />
        <main className="pt-24 px-6 flex flex-col items-center gap-4 text-center flex-1 text-slate-100">
          <AlertCircle size={44} className="text-rose-400" />
          <p className="text-slate-300 text-sm">{error || 'Cobrança não encontrada.'}</p>
          <button
            onClick={() => router.push('/app/contribuir')}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition"
          >
            Voltar para Contribuir
          </button>
        </main>
      </MobileShell>
    );
  }

  // ─── ESTADO: SUCESSO (PAGO) ────────────────────────────────────────────────
  if (charge.status === 'pago') {
    return (
      <MobileShell>
        <MobileHeader title="Contribuição Confirmada" />

        <main className="pt-16 pb-12 px-4 flex-1 flex flex-col items-center justify-center text-center text-slate-100 max-w-lg mx-auto w-full">
          <div className="w-20 h-20 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-lg animate-bounce">
            <CheckCircle2 size={44} />
          </div>

          <h2 className="text-xl font-bold text-slate-100">Contribuição Confirmada!</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Seu pagamento foi liquidado com sucesso e registrado na Tesouraria da sua igreja.
          </p>

          {/* Card Resumo */}
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl p-5 border border-slate-800 shadow-lg mt-6 text-left space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-xs text-slate-400">Valor recebido</span>
              <span className="text-base font-extrabold text-emerald-400">
                {formatCurrency(charge.valor_pago || charge.valor_solicitado)}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-xs text-slate-400">Status</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} /> Confirmado
              </span>
            </div>
            {charge.paid_at && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Data / Hora</span>
                <span className="text-slate-200 font-medium">
                  {new Date(charge.paid_at).toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          <div className="w-full max-w-sm space-y-2.5 mt-8">
            <button
              onClick={() => router.push('/app/contribuir')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/30 active:scale-[0.98] transition"
            >
              Ver Minhas Contribuições
            </button>
            <button
              onClick={() => router.push('/app/inicio')}
              className="w-full bg-[#172033] hover:bg-slate-800 text-slate-300 py-3 rounded-xl font-semibold text-xs border border-slate-700/60 transition"
            >
              Voltar ao Início
            </button>
          </div>
        </main>
      </MobileShell>
    );
  }

  // ─── ESTADO: EXPIRADO OU CANCELADO ─────────────────────────────────────────
  if (charge.status === 'expirado' || charge.status === 'cancelado') {
    return (
      <MobileShell>
        <MobileHeader title="Cobrança Expirada" showBack backHref={`/app/contribuir/${destinoId}`} />
        <main className="pt-24 px-6 flex flex-col items-center gap-4 text-center flex-1 text-slate-100 max-w-lg mx-auto w-full">
          <XCircle size={48} className="text-rose-400" />
          <h2 className="text-lg font-bold text-slate-100">Esta cobrança PIX expirou</h2>
          <p className="text-xs text-slate-400 max-w-xs">
            O tempo limite para pagamento via QR Code foi encerrado. Você pode gerar um novo código PIX a qualquer momento.
          </p>
          <button
            onClick={() => router.push(`/app/contribuir/${destinoId}`)}
            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-md transition"
          >
            Gerar novo PIX
          </button>
        </main>
      </MobileShell>
    );
  }

  // ─── ESTADO: PENDENTE (QR CODE + COPIA E COLA) ─────────────────────────────
  return (
    <MobileShell>
      <MobileHeader title="Pagar com PIX" showBack backHref={`/app/contribuir/${destinoId}`} />

      <main className="pb-12 px-4 pt-4 space-y-4 flex-1 text-slate-100 max-w-lg mx-auto w-full">
        {/* Card Valor */}
        <div className="bg-gradient-to-br from-[#172033] to-[#111827] border border-blue-500/20 rounded-2xl p-5 text-white shadow-lg flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Valor a transferir</span>
            <span className="text-2xl font-black text-blue-400">{formatCurrency(charge.valor_solicitado)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-950/40 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold">
            <Clock size={14} className="animate-pulse" />
            <span>Aguardando...</span>
          </div>
        </div>

        {/* QR Code */}
        {charge.pix_payload ? (
          <div className="bg-[#111827] rounded-2xl p-6 border border-slate-800 shadow-lg flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-2xl shadow-inner border border-slate-200">
              <QRCodeSVG
                value={charge.pix_payload}
                size={200}
                level="M"
                aria-label="QR Code PIX para pagamento"
              />
            </div>
            <p className="text-xs text-slate-300 text-center max-w-xs leading-relaxed">
              Abra o app do seu banco, escolha <strong className="text-slate-100">Pagar com PIX</strong> e aponte a câmera ou use o código Copia e Cola abaixo.
            </p>
          </div>
        ) : (
          <div className="bg-[#111827] rounded-2xl p-6 text-center border border-slate-800 shadow-md">
            <AlertCircle size={32} className="text-amber-400 mx-auto mb-2" />
            <p className="text-xs text-slate-300">QR Code indisponível no momento.</p>
          </div>
        )}

        {/* PIX Copia e Cola */}
        {charge.pix_payload && (
          <div className="bg-[#111827] rounded-2xl p-5 border border-slate-800 shadow-lg space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Código PIX Copia e Cola
            </span>

            <div className="bg-[#172033] p-3 rounded-xl border border-slate-700/60 break-all text-[11px] font-mono text-slate-300 max-h-20 overflow-y-auto select-all">
              {charge.pix_payload}
            </div>

            <button
              onClick={handleCopyPix}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 active:scale-[0.98]'
              }`}
            >
              {copied ? (
                <>
                  <Check size={18} />
                  PIX copiado com sucesso!
                </>
              ) : (
                <>
                  <Copy size={18} />
                  Copiar código PIX
                </>
              )}
            </button>
          </div>
        )}

        {/* Status de Polling */}
        <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3">
          <Loader2 size={20} className="text-blue-400 animate-spin shrink-0" />
          <div className="text-xs text-slate-300">
            <p className="font-bold text-slate-100">Identificando pagamento em tempo real...</p>
            <p className="text-[11px] text-slate-400">Assim que você transferir, a tela confirmará automaticamente.</p>
          </div>
        </div>
      </main>
    </MobileShell>
  );
}
