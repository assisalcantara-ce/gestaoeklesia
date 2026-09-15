'use client';

/**
 * /app/eventos/[id]/pix — Pagamento PIX e Confirmação em Tempo Real da Inscrição
 * Design System Dark + Blue Institucional
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
  Ticket,
  ChevronLeft,
} from 'lucide-react';

interface PagamentoStatus {
  id: string;
  status: 'pendente' | 'pago' | 'cancelado' | 'expirado';
  valor: number;
  expires_at: string | null;
  paid_at: string | null;
  pix: {
    payload: string | null;
    qrcode_base64: string | null;
    invoice_url: string | null;
  } | null;
}

const POLLING_INTERVAL_MS = 3500;

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatExpiration(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function EventoPixPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const eventoId = typeof params?.id === 'string' ? params.id : '';
  const pagamentoId = searchParams.get('pagamentoId') || '';

  const { member, isLoading: memberLoading } = useMobileMember();
  const sbRef = useRef(createClient());

  const [pagamento, setPagamento] = useState<PagamentoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async (): Promise<PagamentoStatus | null> => {
    if (!pagamentoId) return null;
    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Não autenticado.');

      const res = await fetch(`/api/v1/mobile/eventos/pagamento/${pagamentoId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PagamentoStatus = await res.json();
      setPagamento(data);
      return data;
    } catch {
      return null;
    }
  };

  // Carga inicial
  useEffect(() => {
    async function init() {
      if (!pagamentoId) {
        setError('Identificador de pagamento não informado.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      const data = await fetchStatus();
      if (!data) {
        setError('Não foi possível localizar os dados do pagamento.');
      }
      setLoading(false);
    }

    if (!memberLoading && member) {
      init();
    }
  }, [memberLoading, member, pagamentoId]);

  // Polling em tempo real enquanto estiver pendente
  useEffect(() => {
    if (!pagamento || pagamento.status !== 'pendente') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(async () => {
      const latest = await fetchStatus();
      if (latest && latest.status !== 'pendente') {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pagamento?.status]);

  const handleCopy = async () => {
    const payload = pagamento?.pix?.payload;
    if (!payload) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const ta = document.createElement('textarea');
        ta.value = payload;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Erro ao copiar código PIX:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-slate-100">
        <div className="text-center space-y-3">
          <Loader2 size={36} className="text-blue-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Carregando cobrança PIX...</p>
        </div>
      </div>
    );
  }

  if (error || !pagamento) {
    return (
      <MobileShell>
        <div className="min-h-screen bg-[#0F172A] p-6 flex flex-col justify-between text-slate-100">
          <MobileHeader title="Pagamento PIX" />
          <div className="my-auto text-center bg-[#111827] rounded-3xl p-8 border border-slate-800/80 shadow-md max-w-sm mx-auto">
            <AlertCircle size={44} className="text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-100 mb-1">Cobrança não encontrada</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">{error || 'Dados indisponíveis.'}</p>
            <button
              onClick={() => router.push(`/app/eventos/${eventoId || ''}`)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              Voltar para o Evento
            </button>
          </div>
        </div>
      </MobileShell>
    );
  }

  // ── ESTADO: PAGO / CONFIRMADO ───────────────────────────────────────────────
  if (pagamento.status === 'pago') {
    return (
      <MobileShell>
        <div className="min-h-screen bg-[#0F172A] flex flex-col justify-between p-6 text-slate-100">
          <div className="my-auto text-center max-w-sm mx-auto w-full space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg ring-8 ring-emerald-500/5">
              <CheckCircle2 size={44} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-100">Pagamento Confirmado!</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sua inscrição no evento foi confirmada com sucesso. Seu ingresso já está disponível.
              </p>
            </div>

            <div className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 shadow-md text-left space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Valor pago</span>
                <span className="font-bold text-slate-100">{formatCurrency(pagamento.valor)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Status</span>
                <span className="font-bold text-emerald-400">Confirmado</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push(`/app/eventos/${eventoId}`)}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Ticket size={16} />
                Visualizar Meu Ingresso / Detalhes
              </button>

              <button
                onClick={() => router.push('/app/eventos')}
                className="w-full py-3 px-4 bg-[#172033] border border-slate-700/60 text-slate-300 hover:text-white font-bold text-xs rounded-xl hover:bg-slate-700/80 transition-colors"
              >
                Voltar para Lista de Eventos
              </button>
            </div>
          </div>
        </div>
      </MobileShell>
    );
  }

  // ── ESTADO: EXPIRADO OU CANCELADO ──────────────────────────────────────────
  if (pagamento.status === 'expirado' || pagamento.status === 'cancelado') {
    return (
      <MobileShell>
        <div className="min-h-screen bg-[#0F172A] flex flex-col justify-between p-6 text-slate-100">
          <div className="my-auto text-center max-w-sm mx-auto w-full space-y-5">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full flex items-center justify-center mx-auto shadow-md">
              <XCircle size={36} />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-100">
                {pagamento.status === 'expirado' ? 'PIX Expirado' : 'Cobrança Cancelada'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                O tempo limite para pagamento desta cobrança expirou. Você pode realizar uma nova inscrição para gerar um novo PIX.
              </p>
            </div>

            <button
              onClick={() => router.push(`/app/eventos/${eventoId}`)}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </MobileShell>
    );
  }

  // ── ESTADO: PENDENTE (QR CODE + COPIA E COLA) ──────────────────────────────
  const pixPayload = pagamento.pix?.payload || '';

  return (
    <MobileShell>
      <div className="min-h-screen bg-[#0F172A] text-slate-100 pb-20">
        {/* Header */}
        <div className="bg-[#0F172A]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sticky top-0 z-20 flex items-center gap-3">
          <button
            onClick={() => router.push(`/app/eventos/${eventoId}`)}
            className="w-9 h-9 rounded-full bg-[#172033] border border-slate-700/60 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-300 transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-slate-100 truncate">Pagamento da Inscrição</span>
        </div>

        <div className="max-w-md mx-auto px-4 py-6 space-y-5">
          {/* Card Valor */}
          <div className="bg-[#111827] rounded-3xl p-6 border border-slate-800/80 shadow-md text-center space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total a Pagar
            </p>
            <p className="text-3xl font-black text-slate-100">
              {formatCurrency(pagamento.valor)}
            </p>
            {pagamento.expires_at && (
              <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <Clock size={12} className="text-amber-400" />
                <span>Vence em {formatExpiration(pagamento.expires_at)}</span>
              </p>
            )}
          </div>

          {/* QR Code SVG */}
          <div className="bg-[#111827] rounded-3xl p-6 border border-slate-800/80 shadow-md text-center space-y-4">
            <div className="inline-block p-4 bg-white rounded-2xl shadow-md border border-slate-700">
              {pixPayload ? (
                <QRCodeSVG
                  value={pixPayload}
                  size={210}
                  level="M"
                  includeMargin={false}
                />
              ) : (
                <div className="w-48 h-48 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Loader2 size={32} className="text-slate-500 animate-spin" />
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Abra o app do seu banco e aponte a câmera para o QR Code acima.
            </p>
          </div>

          {/* PIX Copia e Cola */}
          {pixPayload && (
            <div className="bg-[#111827] rounded-3xl p-5 border border-slate-800/80 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200">
                  PIX Copia e Cola
                </label>
                {copied && (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 animate-in fade-in">
                    <Check size={13} />
                    Código copiado!
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={pixPayload}
                  className="w-full px-3.5 py-3 pr-24 text-xs font-mono bg-[#172033] border border-slate-700 rounded-xl text-slate-200 truncate focus:outline-hidden"
                />
                <button
                  onClick={handleCopy}
                  className={`absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Indicador de Polling em Tempo Real */}
          <div className="p-4 bg-blue-500/10 rounded-2xl flex items-center gap-3 border border-blue-500/20">
            <Loader2 size={18} className="text-blue-400 animate-spin shrink-0" />
            <p className="text-xs text-blue-300 leading-snug">
              Aguardando pagamento... Esta tela será atualizada automaticamente assim que o banco confirmar.
            </p>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

