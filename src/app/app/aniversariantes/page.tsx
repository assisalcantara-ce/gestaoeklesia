'use client';

/**
 * /app/aniversariantes — Central de Aniversariantes do App Mobile do Membro
 *
 * Experiência acolhedora e focada em celebração com:
 * - Destaque para aniversariantes de hoje
 * - Lista de aniversariantes do período selecionado
 * - Filtro de escopo: Minha Congregação vs Todo o Ministério
 * - Filtro de período: Este Mês (default), Hoje, Próximos 30 dias
 * - Blindagem total de privacidade (sem idade, sem ano, sem contatos)
 * - Fallbacks seguros de imagem/avatar
 * - Skeletons, empty states e tratamento de erro com retry
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  Cake,
  Sparkles,
  Calendar,
  Building2,
  AlertCircle,
  RefreshCw,
  Award,
  Users,
} from 'lucide-react';

interface AniversarianteItem {
  id: string;
  nome: string;
  dia: number;
  mes: number;
  isHoje: boolean;
  foto_url: string | null;
  cargo_ministerial: string | null;
  congregacao_nome: string | null;
}

const MESES_ABREV = [
  '',
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MobileAniversariantesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [aniversariantes, setAniversariantes] = useState<AniversarianteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [escopo, setEscopo] = useState<'minha_congregacao' | 'todas'>('minha_congregacao');
  const [periodo, setPeriodo] = useState<'mes' | 'hoje' | 'proximos_30'>('mes');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const fetchAniversariantes = useCallback(
    async (currentEscopo: string, currentPeriodo: string) => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          setErrorMsg('Sessão expirada. Faça login novamente.');
          setLoading(false);
          return;
        }

        const url = `/api/v1/mobile/aniversariantes?escopo=${encodeURIComponent(
          currentEscopo
        )}&periodo=${encodeURIComponent(currentPeriodo)}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Não foi possível carregar os aniversariantes.');
        }

        const data = await res.json();
        setAniversariantes(data.aniversariantes || []);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Erro ao carregar aniversariantes.');
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    fetchAniversariantes(escopo, periodo);
  }, [escopo, periodo, fetchAniversariantes]);

  const handleImageError = (id: string) => {
    setImgErrors((prev) => ({ ...prev, [id]: true }));
  };

  // Aniversariantes de hoje para destaque quando em modo 'mes' ou 'proximos_30'
  const aniversariantesHoje = useMemo(() => {
    return aniversariantes.filter((a) => a.isHoje);
  }, [aniversariantes]);

  const tituloSecaoLista = useMemo(() => {
    if (periodo === 'hoje') return 'Aniversariantes de Hoje';
    if (periodo === 'proximos_30') return 'Próximos 30 Dias';
    return 'Aniversariantes deste Mês';
  }, [periodo]);

  return (
    <MobileShell>
      <MobileHeader title="Aniversariantes" showBack={true} backHref="/app/inicio" />

      <main className="flex-1 pb-28 px-4 pt-4 space-y-4 bg-[#0f172a] text-slate-100">
        {/* Banner de Celebração e Acolhimento */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white p-4 rounded-2xl shadow-lg border border-blue-500/30 relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Celebração & Comunhão</span>
            </div>
            <h1 className="text-lg font-bold text-slate-100">Aniversariantes da Igreja</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Junte-se a nós em gratidão a Deus pela vida e ministério de cada irmão.
            </p>
          </div>
          <div className="absolute -right-4 -bottom-6 opacity-10 text-blue-300 pointer-events-none">
            <Cake className="w-28 h-28" />
          </div>
        </div>

        {/* Filtro 1: Seletor de Escopo (Minha Congregação vs Todo o Ministério) */}
        <div className="bg-[#172033] p-1 rounded-xl flex items-center gap-1 border border-slate-700/60">
          <button
            onClick={() => setEscopo('minha_congregacao')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              escopo === 'minha_congregacao'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-500'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Minha Congregação</span>
          </button>
          <button
            onClick={() => setEscopo('todas')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              escopo === 'todas'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-500'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Todo o Ministério</span>
          </button>
        </div>

        {/* Filtro 2: Seletor de Período (Mês, Hoje, Próximos 30) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setPeriodo('mes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              periodo === 'mes'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-500'
                : 'bg-[#172033] text-slate-300 hover:bg-[#1f2c45] border border-slate-700/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Este Mês</span>
          </button>
          <button
            onClick={() => setPeriodo('hoje')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              periodo === 'hoje'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-500'
                : 'bg-[#172033] text-slate-300 hover:bg-[#1f2c45] border border-slate-700/60'
            }`}
          >
            <Cake className="w-3.5 h-3.5 text-amber-400" />
            <span>Hoje</span>
          </button>
          <button
            onClick={() => setPeriodo('proximos_30')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
              periodo === 'proximos_30'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-500'
                : 'bg-[#172033] text-slate-300 hover:bg-[#1f2c45] border border-slate-700/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Próximos 30 dias</span>
          </button>
        </div>

        {/* Mensagem de Erro com Botão de Tentar Novamente */}
        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
            <button
              onClick={() => fetchAniversariantes(escopo, periodo)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-[#111827] p-4 rounded-2xl border border-slate-800 shadow-sm animate-pulse flex items-center gap-3.5"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-3/5 h-4 bg-slate-800 rounded" />
                  <div className="w-2/5 h-3 bg-slate-800 rounded" />
                </div>
                <div className="w-12 h-8 bg-slate-800 rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Destaque "Aniversariantes de Hoje" (se houver e não estiver filtrado somente por 'hoje') */}
        {!loading && !errorMsg && periodo !== 'hoje' && aniversariantesHoje.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🎂</span>
                <h2 className="text-sm font-bold text-amber-400">Aniversariantes de Hoje</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {aniversariantesHoje.length}{' '}
                {aniversariantesHoje.length === 1 ? 'celebrando' : 'celebrando'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {aniversariantesHoje.map((item) => {
                const hasImg = item.foto_url && !imgErrors[item.id];
                return (
                  <div
                    key={`hoje-${item.id}`}
                    className="bg-gradient-to-r from-amber-950/40 via-[#111827] to-[#172033] border border-amber-500/40 rounded-2xl p-3.5 shadow-lg flex items-center gap-3.5"
                  >
                    {/* Foto / Avatar */}
                    {hasImg ? (
                      <img
                        src={item.foto_url!}
                        alt={item.nome}
                        onError={() => handleImageError(item.id)}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 font-bold text-sm flex items-center justify-center ring-2 ring-amber-400 shrink-0 border border-amber-400/40">
                        {getInitials(item.nome)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-slate-100 truncate">{item.nome}</p>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-slate-950">
                          🎉 Hoje!
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-400">
                        {item.congregacao_nome && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                            <Building2 className="w-3 h-3 shrink-0 text-amber-400" />
                            <span className="truncate">{item.congregacao_nome}</span>
                          </span>
                        )}
                        {item.cargo_ministerial && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#172033] text-slate-300 border border-slate-700">
                            <Award className="w-2.5 h-2.5 text-amber-400" />
                            <span>{item.cargo_ministerial}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Lista Geral do Período */}
        {!loading && !errorMsg && aniversariantes.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                {tituloSecaoLista} ({aniversariantes.length})
              </h2>
            </div>

            <div className="space-y-2">
              {aniversariantes.map((item) => {
                const hasImg = item.foto_url && !imgErrors[item.id];
                const mesAbrev = MESES_ABREV[item.mes] || '';

                return (
                  <div
                    key={item.id}
                    className={`bg-[#111827] rounded-2xl p-3.5 border shadow-sm flex items-center gap-3.5 transition ${
                      item.isHoje
                        ? 'border-amber-500/40 ring-1 ring-amber-500/30 bg-gradient-to-r from-amber-950/30 to-[#111827]'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Foto / Avatar */}
                    {hasImg ? (
                      <img
                        src={item.foto_url!}
                        alt={item.nome}
                        onError={() => handleImageError(item.id)}
                        className={`w-11 h-11 rounded-full object-cover shrink-0 ${
                          item.isHoje ? 'ring-2 ring-amber-400' : 'ring-1 ring-slate-700'
                        }`}
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                          item.isHoje
                            ? 'bg-amber-500/20 text-amber-300 ring-2 ring-amber-400 border border-amber-400/30'
                            : 'bg-[#172033] text-blue-400 ring-1 ring-slate-700 border border-slate-700/60'
                        }`}
                      >
                        {getInitials(item.nome)}
                      </div>
                    )}

                    {/* Informações do Membro */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-slate-100 truncate">{item.nome}</p>
                        {item.isHoje && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500 text-slate-950">
                            Hoje!
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-400">
                        {item.congregacao_nome && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate max-w-[180px]">
                            <Building2 className="w-3 h-3 shrink-0 text-slate-500" />
                            <span className="truncate">{item.congregacao_nome}</span>
                          </span>
                        )}
                        {item.cargo_ministerial && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#172033] text-slate-300 border border-slate-700/60">
                            <Award className="w-2.5 h-2.5 text-slate-400" />
                            <span>{item.cargo_ministerial}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Indicador de Data / Dia */}
                    <div
                      className={`text-center shrink-0 px-2.5 py-1.5 rounded-xl border ${
                        item.isHoje
                          ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                          : 'bg-[#172033] text-slate-200 border-slate-700/80'
                      }`}
                    >
                      <span className="block text-xs font-black leading-none">{item.dia}</span>
                      <span
                        className={`block text-[9px] font-semibold uppercase leading-tight ${
                          item.isHoje ? 'text-slate-950 font-extrabold' : 'text-slate-400'
                        }`}
                      >
                        {mesAbrev}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!loading && !errorMsg && aniversariantes.length === 0 && (
          <div className="py-14 px-4 text-center bg-[#111827] border border-slate-800 rounded-2xl shadow-sm space-y-3">
            <Cake className="w-12 h-12 text-slate-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-100">Nenhum aniversariante encontrado</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {periodo === 'hoje'
                  ? 'Não há irmãos celebrando aniversário hoje no escopo selecionado.'
                  : 'Nenhum aniversário registrado para o período e escopo selecionados.'}
              </p>
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
