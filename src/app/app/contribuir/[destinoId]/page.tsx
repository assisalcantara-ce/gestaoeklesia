'use client';

/**
 * /app/contribuir/[destinoId] — Formulário de Contribuição PIX
 *
 * Permite ao membro escolher o valor, optar por identificação ou anonimato,
 * e gerar a cobrança PIX com proteção estrita contra duplo clique.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileHeader from '@/components/mobile/MobileHeader';
import { createClient } from '@/lib/supabase-client';
import {
  DollarSign,
  Loader2,
  AlertCircle,
  EyeOff,
  UserCheck,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface Destino {
  id: string;
  label: string;
  descricao: string | null;
  tipo_recebimento: string;
  valor_fixo: number | null;
  pix_payload: string | null;
}

const QUICK_VALUES = [20, 50, 100, 200];

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export default function ContribuirDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const destinoId = typeof params?.destinoId === 'string' ? params.destinoId : '';
  const { member, isLoading: memberLoading } = useMobileMember();
  const sbRef = useRef(createClient());

  const [destino, setDestino] = useState<Destino | null>(null);
  const [loadingDestino, setLoadingDestino] = useState(true);
  const [errorDestino, setErrorDestino] = useState('');

  const [valorInput, setValorInput] = useState<string>('50,00');
  const [selectedQuickValue, setSelectedQuickValue] = useState<number | null>(50);
  const [isAnonimo, setIsAnonimo] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');

  // Carregar dados do destino
  useEffect(() => {
    async function loadDestino() {
      if (!destinoId) return;
      setLoadingDestino(true);
      setErrorDestino('');
      try {
        const {
          data: { session },
        } = await sbRef.current.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('no-token');

        const res = await fetch('/api/v1/mobile/financeiro/destinos', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const found = (json.data ?? []).find((d: Destino) => d.id === destinoId);

        if (!found) {
          setErrorDestino('Destino de contribuição não encontrado ou inativo.');
        } else {
          setDestino(found);
          if (found.valor_fixo != null && found.valor_fixo > 0) {
            setValorInput(Number(found.valor_fixo).toFixed(2).replace('.', ','));
            setSelectedQuickValue(null);
          }
        }
      } catch {
        setErrorDestino('Erro ao carregar detalhes do destino.');
      } finally {
        setLoadingDestino(false);
      }
    }

    if (!memberLoading && member) {
      loadDestino();
    }
  }, [destinoId, memberLoading, member]);

  const handleSelectQuick = (val: number) => {
    setSelectedQuickValue(val);
    setValorInput(val.toFixed(2).replace('.', ','));
    setSubmitError('');
  };

  const handleCustomValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const num = Number(raw) / 100;
    setValorInput(num.toFixed(2).replace('.', ','));
    setSelectedQuickValue(null);
    setSubmitError('');
  };

  const getNumericValue = (): number => {
    const clean = valorInput.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const handleGerarPix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const valorFinal = getNumericValue();
    if (valorFinal < 1.00) {
      setSubmitError('O valor mínimo para contribuição é R$ 1,00.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setSubmitError('Sessão expirada. Faça login novamente.');
        return;
      }

      const res = await fetch('/api/v1/mobile/financeiro/pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          destinationId: destinoId,
          valor: valorFinal,
          anonimo: isAnonimo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Não foi possível gerar a cobrança PIX. Tente novamente.');
        return;
      }

      // Redireciona para a tela de visualização e pagamento do PIX
      router.push(`/app/contribuir/${destinoId}/pix?chargeId=${data.chargeId}`);
    } catch {
      setSubmitError('Falha na conexão com o servidor. Verifique sua internet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (memberLoading || loadingDestino) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-dark-blue animate-spin" />
      </div>
    );
  }

  if (errorDestino || !destino) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <MobileHeader title="Contribuir" showBack backHref="/app/contribuir" />
        <div className="pt-24 px-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={44} className="text-red-400" />
          <p className="text-gray-700 text-sm">{errorDestino || 'Destino não encontrado.'}</p>
          <button
            onClick={() => router.push('/app/contribuir')}
            className="bg-dark-blue text-white text-xs font-semibold px-5 py-2.5 rounded-xl"
          >
            Voltar para opções
          </button>
        </div>
      </div>
    );
  }

  const hasFixedValue = destino.valor_fixo != null && destino.valor_fixo > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-10">
      <MobileHeader title={destino.label} showBack backHref="/app/contribuir" />

      <div className="pt-20 px-5 space-y-4 flex-1">
        {/* Card do Destino */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-dark-blue/10 flex items-center justify-center text-dark-blue shrink-0">
              <DollarSign size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 leading-tight">{destino.label}</h2>
              <span className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">
                {destino.tipo_recebimento}
              </span>
            </div>
          </div>
          {destino.descricao && (
            <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-3 rounded-xl">
              {destino.descricao}
            </p>
          )}
        </div>

        {/* Formulário de Valor */}
        <form onSubmit={handleGerarPix} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Valor da contribuição
            </label>

            {hasFixedValue ? (
              <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-200">
                <span className="text-xs text-gray-400 block mb-1">Valor fixado pelo ministério</span>
                <span className="text-2xl font-black text-dark-blue">
                  {formatCurrency(destino.valor_fixo!)}
                </span>
              </div>
            ) : (
              <>
                {/* Opções rápidas */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {QUICK_VALUES.map((val) => {
                    const isSelected = selectedQuickValue === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSelectQuick(val)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-dark-blue text-white border-dark-blue shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        R$ {val}
                      </button>
                    );
                  })}
                </div>

                {/* Input personalizado */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={valorInput}
                    onChange={handleCustomValueChange}
                    placeholder="0,00"
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-dark-blue/30 focus:border-dark-blue transition"
                    required
                  />
                </div>
              </>
            )}
          </div>

          {/* Toggle Identificação vs. Anonimato */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Identificação do Dízimo / Oferta
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsAnonimo(false)}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  !isAnonimo
                    ? 'border-dark-blue bg-dark-blue/5 text-dark-blue'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <UserCheck size={14} /> Identificada
                </div>
                <span className="text-[10px] opacity-80 leading-tight">
                  Registrada no seu extrato de membro
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsAnonimo(true)}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  isAnonimo
                    ? 'border-dark-blue bg-dark-blue/5 text-dark-blue'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <EyeOff size={14} /> Anônima
                </div>
                <span className="text-[10px] opacity-80 leading-tight">
                  Não vincula seu nome ao lançamento
                </span>
              </button>
            </div>
          </div>

          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs p-3 rounded-xl">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-dark-blue text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-dark-blue/90 active:scale-[0.98] transition disabled:opacity-60 shadow-lg shadow-dark-blue/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Gerando PIX...
              </>
            ) : (
              <>
                Gerar PIX
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 text-center pt-1">
            <Lock size={12} />
            Pagamento 100% seguro processado via Banco Central
          </div>
        </form>
      </div>
    </div>
  );
}
