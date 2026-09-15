'use client';

/**
 * /app/contribuir — Central de Contribuições do Membro
 *
 * Exibe os destinos de arrecadação digital autorizados para o membro
 * e permite consultar o extrato pessoal de contribuições identificadas.
 */

import { useState, useEffect, useRef } from 'react';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import {
  Heart,
  DollarSign,
  Gift,
  Building2,
  Globe,
  Loader2,
  AlertCircle,
  RefreshCw,
  History,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

interface Destino {
  id: string;
  label: string;
  descricao: string | null;
  cor: string | null;
  icone: string | null;
  tipo_recebimento: string;
  valor_fixo: number | null;
  pix_payload: string | null;
  congregacao_id: string | null;
}

interface LancamentoExtrato {
  id: string;
  tipo_recebimento: string;
  valor: number;
  data_lancamento: string;
  descricao: string | null;
  forma_pagamento: string;
  referencia: string | null;
}

const TIPO_ICONS: Record<string, React.ElementType> = {
  dizimo: Heart,
  oferta: Gift,
  missoes: Globe,
  campanha: Building2,
  campanha_local: Building2,
  doacao: DollarSign,
  contribuicao: DollarSign,
};

const TIPO_LABELS: Record<string, string> = {
  dizimo: 'Dízimo',
  oferta: 'Oferta',
  missoes: 'Missões',
  campanha: 'Campanha',
  campanha_local: 'Campanha Local',
  doacao: 'Doação',
  contribuicao: 'Contribuição',
  evento: 'Evento',
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export default function ContribuirPage() {
  const { member, isLoading: memberLoading } = useMobileMember();
  const router = useRouter();
  const sbRef = useRef(createClient());

  const [activeTab, setActiveTab] = useState<'destinos' | 'extrato'>('destinos');

  // Estado Destinos
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [loadingDestinos, setLoadingDestinos] = useState(true);
  const [errorDestinos, setErrorDestinos] = useState('');

  // Estado Extrato
  const [extrato, setExtrato] = useState<LancamentoExtrato[]>([]);
  const [loadingExtrato, setLoadingExtrato] = useState(false);
  const [errorExtrato, setErrorExtrato] = useState('');

  const fetchDestinos = async () => {
    setLoadingDestinos(true);
    setErrorDestinos('');
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
      setDestinos(json.data ?? []);
    } catch {
      setErrorDestinos('Não foi possível carregar os destinos de contribuição.');
    } finally {
      setLoadingDestinos(false);
    }
  };

  const fetchExtrato = async () => {
    setLoadingExtrato(true);
    setErrorExtrato('');
    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('no-token');

      const res = await fetch('/api/v1/mobile/financeiro/extrato?pageSize=50', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setExtrato(json.data ?? []);
    } catch {
      setErrorExtrato('Não foi possível carregar o histórico de contribuições.');
    } finally {
      setLoadingExtrato(false);
    }
  };

  useEffect(() => {
    if (!memberLoading && member) {
      fetchDestinos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberLoading, member?.id]);

  useEffect(() => {
    if (activeTab === 'extrato' && !memberLoading && member) {
      fetchExtrato();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, memberLoading, member?.id]);

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-dark-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <MobileHeader title="Contribuir" />

      {/* Tabs */}
      <div className="pt-16 bg-dark-blue px-6 pb-4">
        <p className="text-white/70 text-xs mt-2 mb-3">
          Participe da obra do Senhor com alegria e transparência.
        </p>
        <div className="flex bg-white/10 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('destinos')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'destinos'
                ? 'bg-white text-dark-blue shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Destinos
          </button>
          <button
            onClick={() => setActiveTab('extrato')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'extrato'
                ? 'bg-white text-dark-blue shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <History size={14} />
            Minhas Contribuições
          </button>
        </div>
      </div>

      {/* Conteúdo Aba Destinos */}
      {activeTab === 'destinos' && (
        <div className="px-5 mt-5 space-y-3">
          {loadingDestinos ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="text-dark-blue animate-spin" />
              <p className="text-xs text-gray-500">Carregando opções...</p>
            </div>
          ) : errorDestinos ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
              <AlertCircle size={36} className="text-red-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-4">{errorDestinos}</p>
              <button
                onClick={fetchDestinos}
                className="inline-flex items-center gap-2 bg-dark-blue text-white text-xs font-medium px-4 py-2 rounded-xl"
              >
                <RefreshCw size={12} /> Tentar novamente
              </button>
            </div>
          ) : destinos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <DollarSign size={40} className="text-gray-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-gray-700">Nenhum destino ativo</h3>
              <p className="text-xs text-gray-500 mt-1">
                Sua igreja ainda não disponibilizou chaves de arrecadação digital.
              </p>
            </div>
          ) : (
            destinos.map((dest) => {
              const IconComp = TIPO_ICONS[dest.tipo_recebimento] || DollarSign;
              return (
                <button
                  key={dest.id}
                  onClick={() => router.push(`/app/contribuir/${dest.id}`)}
                  className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-4 text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-dark-blue/10 flex items-center justify-center shrink-0 text-dark-blue group-hover:bg-dark-blue group-hover:text-white transition-colors">
                    <IconComp size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-800 truncate">{dest.label}</h3>
                      {dest.valor_fixo != null && dest.valor_fixo > 0 && (
                        <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">
                          {formatCurrency(dest.valor_fixo)}
                        </span>
                      )}
                    </div>
                    {dest.descricao && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{dest.descricao}</p>
                    )}
                    <span className="inline-block text-[10px] text-gray-400 mt-1 font-medium">
                      {TIPO_LABELS[dest.tipo_recebimento] || dest.tipo_recebimento}
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-gray-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Conteúdo Aba Extrato */}
      {activeTab === 'extrato' && (
        <div className="px-5 mt-5 space-y-3">
          {loadingExtrato ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="text-dark-blue animate-spin" />
              <p className="text-xs text-gray-500">Buscando histórico...</p>
            </div>
          ) : errorExtrato ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
              <AlertCircle size={36} className="text-red-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-4">{errorExtrato}</p>
              <button
                onClick={fetchExtrato}
                className="inline-flex items-center gap-2 bg-dark-blue text-white text-xs font-medium px-4 py-2 rounded-xl"
              >
                <RefreshCw size={12} /> Tentar novamente
              </button>
            </div>
          ) : extrato.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <History size={40} className="text-gray-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-gray-700">Nenhuma contribuição identificada</h3>
              <p className="text-xs text-gray-500 mt-1">
                Suas contribuições confirmadas via PIX ou secretaria aparecerão listadas aqui.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
              {extrato.map((lanc) => {
                const IconComp = TIPO_ICONS[lanc.tipo_recebimento] || DollarSign;
                return (
                  <div key={lanc.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                        <IconComp size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">
                          {TIPO_LABELS[lanc.tipo_recebimento] || lanc.tipo_recebimento}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {formatDate(lanc.data_lancamento)} • {lanc.forma_pagamento.toUpperCase()}
                        </p>
                        {lanc.descricao && (
                          <p className="text-[10px] text-gray-500 truncate">{lanc.descricao}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-green-700">
                        + {formatCurrency(lanc.valor)}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-green-600 font-medium">
                        <CheckCircle2 size={10} /> Confirmado
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
