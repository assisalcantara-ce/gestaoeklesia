'use client';

/**
 * /app/contribuir — Central de Contribuições do Membro
 *
 * Exibe os destinos de arrecadação digital autorizados para o membro
 * e permite consultar o extrato pessoal de contribuições identificadas.
 */

import { useState, useEffect, useRef } from 'react';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileShell from '@/components/mobile/MobileShell';
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

  return (
    <MobileShell>
      <MobileHeader title="Contribuir" showBack={false} />

      <main className="flex-1 pb-28 px-4 pt-4 space-y-4 text-slate-100 max-w-lg mx-auto w-full">
        {/* Banner de Boas-vindas / Informativo */}
        <div className="bg-gradient-to-br from-[#172033] to-[#111827] border border-blue-500/20 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-bold uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5 text-blue-400" />
              <span>Generosidade & Adoração</span>
            </div>
            <h1 className="text-base font-bold text-white">Contribuição Ministerial</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Participe da obra do Senhor com alegria, segurança e total transparência.
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex bg-[#172033] p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setActiveTab('destinos')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'destinos'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Destinos
          </button>
          <button
            onClick={() => setActiveTab('extrato')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'extrato'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History size={14} />
            Minhas Contribuições
          </button>
        </div>

        {/* Loading Member */}
        {memberLoading && (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="text-blue-500 animate-spin" />
            <p className="text-xs text-slate-400">Carregando informações...</p>
          </div>
        )}

        {/* Conteúdo Aba Destinos */}
        {!memberLoading && activeTab === 'destinos' && (
          <div className="space-y-3">
            {loadingDestinos ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 size={28} className="text-blue-500 animate-spin" />
                <p className="text-xs text-slate-400">Carregando opções...</p>
              </div>
            ) : errorDestinos ? (
              <div className="bg-[#111827] rounded-2xl p-6 text-center border border-slate-800 shadow-md">
                <AlertCircle size={36} className="text-rose-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300 mb-4">{errorDestinos}</p>
                <button
                  onClick={fetchDestinos}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition"
                >
                  <RefreshCw size={12} /> Tentar novamente
                </button>
              </div>
            ) : destinos.length === 0 ? (
              <div className="bg-[#111827] rounded-2xl p-8 text-center border border-slate-800 shadow-md space-y-2">
                <DollarSign size={40} className="text-slate-600 mx-auto mb-1" />
                <h3 className="text-sm font-bold text-slate-200">Nenhum destino ativo</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Sua igreja ainda não disponibilizou chaves de arrecadação digital no momento.
                </p>
              </div>
            ) : (
              destinos.map((dest) => {
                const IconComp = TIPO_ICONS[dest.tipo_recebimento] || DollarSign;
                return (
                  <button
                    key={dest.id}
                    onClick={() => router.push(`/app/contribuir/${dest.id}`)}
                    className="w-full bg-[#111827] rounded-2xl p-4 border border-slate-800 shadow-md hover:border-slate-700 active:scale-[0.99] transition-all flex items-center gap-3.5 text-left group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <IconComp size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-100 truncate">{dest.label}</h3>
                        {dest.valor_fixo != null && dest.valor_fixo > 0 && (
                          <span className="text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                            {formatCurrency(dest.valor_fixo)}
                          </span>
                        )}
                      </div>
                      {dest.descricao && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{dest.descricao}</p>
                      )}
                      <span className="inline-block text-[10px] text-slate-500 mt-1 font-semibold uppercase tracking-wider">
                        {TIPO_LABELS[dest.tipo_recebimento] || dest.tipo_recebimento}
                      </span>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 shrink-0 group-hover:translate-x-0.5 group-hover:text-slate-300 transition-all" />
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Conteúdo Aba Extrato */}
        {!memberLoading && activeTab === 'extrato' && (
          <div className="space-y-3">
            {loadingExtrato ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 size={28} className="text-blue-500 animate-spin" />
                <p className="text-xs text-slate-400">Buscando histórico...</p>
              </div>
            ) : errorExtrato ? (
              <div className="bg-[#111827] rounded-2xl p-6 text-center border border-slate-800 shadow-md">
                <AlertCircle size={36} className="text-rose-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300 mb-4">{errorExtrato}</p>
                <button
                  onClick={fetchExtrato}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition"
                >
                  <RefreshCw size={12} /> Tentar novamente
                </button>
              </div>
            ) : extrato.length === 0 ? (
              <div className="bg-[#111827] rounded-2xl p-8 text-center border border-slate-800 shadow-md space-y-2">
                <History size={40} className="text-slate-600 mx-auto mb-1" />
                <h3 className="text-sm font-bold text-slate-200">Nenhuma contribuição identificada</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Suas contribuições confirmadas via PIX ou secretaria aparecerão listadas aqui.
                </p>
              </div>
            ) : (
              <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-md overflow-hidden divide-y divide-slate-800/80">
                {extrato.map((lanc) => {
                  const IconComp = TIPO_ICONS[lanc.tipo_recebimento] || DollarSign;
                  return (
                    <div key={lanc.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <IconComp size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-100 truncate">
                            {TIPO_LABELS[lanc.tipo_recebimento] || lanc.tipo_recebimento}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {formatDate(lanc.data_lancamento)} • {lanc.forma_pagamento.toUpperCase()}
                          </p>
                          {lanc.descricao && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{lanc.descricao}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-emerald-400">
                          + {formatCurrency(lanc.valor)}
                        </p>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400/90 font-medium">
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
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
