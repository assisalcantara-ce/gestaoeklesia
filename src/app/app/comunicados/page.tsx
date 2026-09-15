'use client';

/**
 * /app/comunicados — Mural de Comunicados e Avisos Oficiais do Membro
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  Megaphone,
  AlertTriangle,
  Calendar,
  Layers,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Clock,
  Building2,
  Tag,
  Loader2,
} from 'lucide-react';

interface DepartamentoInfo {
  id: string;
  nome: string;
  sigla: string;
  logo_url: string | null;
}

interface ComunicadoItem {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: 'geral' | 'urgente' | 'departamento' | 'evento';
  imagem_url: string | null;
  publicado_em: string;
  expira_em: string | null;
  escopo: 'geral' | 'congregacao';
  congregacao_nome: string | null;
  departamento: DepartamentoInfo | null;
}

const CATEGORIA_CONFIG: Record<
  string,
  { label: string; badgeColor: string; icon: React.ElementType }
> = {
  urgente: {
    label: 'Urgente',
    badgeColor: 'bg-rose-950/40 text-rose-400 border-rose-500/20',
    icon: AlertTriangle,
  },
  evento: {
    label: 'Evento',
    badgeColor: 'bg-blue-950/40 text-blue-400 border-blue-500/20',
    icon: Calendar,
  },
  departamento: {
    label: 'Departamento',
    badgeColor: 'bg-purple-950/40 text-purple-400 border-purple-500/20',
    icon: Layers,
  },
  geral: {
    label: 'Comunicado',
    badgeColor: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
    icon: Megaphone,
  },
};

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'urgente', label: 'Urgentes' },
  { id: 'evento', label: 'Eventos' },
  { id: 'departamento', label: 'Departamentos' },
  { id: 'geral', label: 'Gerais' },
];

export default function MobileComunicadosPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [comunicados, setComunicados] = useState<ComunicadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const fetchComunicados = useCallback(
    async (targetPage: number, categoria: string, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          setErrorMsg('Sessão expirada. Faça login novamente.');
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        let url = `/api/v1/mobile/comunicados?page=${targetPage}&limit=10`;
        if (categoria !== 'todos') {
          url += `&categoria=${encodeURIComponent(categoria)}`;
        }

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Não foi possível carregar os comunicados.');
        }

        const data = await res.json();
        const items = data.comunicados || [];

        if (append) {
          setComunicados((prev) => [...prev, ...items]);
        } else {
          setComunicados(items);
        }

        setPage(data.page || 1);
        setHasMore((data.page || 1) < (data.total_paginas || 1));
      } catch (err: any) {
        setErrorMsg(err?.message || 'Erro ao carregar comunicados.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    setPage(1);
    fetchComunicados(1, categoriaAtiva, false);
  }, [categoriaAtiva, fetchComunicados]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      fetchComunicados(nextPage, categoriaAtiva, true);
    }
  };

  const handleImageError = (id: string) => {
    setImgErrors((prev) => ({ ...prev, [id]: true }));
  };

  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <MobileShell>
      <MobileHeader title="Comunicados & Avisos" showBack={false} />

      <main className="flex-1 pb-28 px-4 pt-4 space-y-4 text-slate-100 max-w-lg mx-auto w-full">
        {/* Banner de Boas-vindas / Informativo */}
        <div className="bg-gradient-to-br from-[#172033] to-[#111827] border border-blue-500/20 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-bold uppercase tracking-wider">
              <Megaphone className="w-3.5 h-3.5 text-blue-400" />
              <span>Mural Oficial</span>
            </div>
            <h1 className="text-base font-bold text-white">Comunicados da Igreja</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Fique por dentro das últimas notícias, informes pastorais e avisos oficiais da congregação.
            </p>
          </div>
          <div className="absolute -right-4 -bottom-6 opacity-5 text-blue-400 pointer-events-none">
            <Megaphone className="w-28 h-28" />
          </div>
        </div>

        {/* Barra de Filtros Rápidos */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setCategoriaAtiva(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                categoriaAtiva === f.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'bg-[#172033] border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Mensagem de Erro com Botão de Tentar Novamente */}
        {errorMsg && (
          <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-2xl text-xs text-rose-300 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
            <button
              onClick={() => fetchComunicados(1, categoriaAtiva, false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-md shadow-blue-900/30"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        {/* Loading Inicial (Skeleton) */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-[#111827] p-4 rounded-2xl border border-slate-800 shadow-md animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-20 h-5 bg-slate-800 rounded-md" />
                  <div className="w-16 h-4 bg-slate-800 rounded-md" />
                </div>
                <div className="w-3/4 h-5 bg-slate-800 rounded-md" />
                <div className="w-full h-12 bg-slate-800 rounded-md" />
              </div>
            ))}
          </div>
        )}

        {/* Lista Vazia (Empty State) */}
        {!loading && !errorMsg && comunicados.length === 0 && (
          <div className="py-16 px-4 text-center bg-[#111827] border border-slate-800 rounded-2xl shadow-lg space-y-3">
            <Megaphone className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-200">Nenhum comunicado disponível</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No momento não há avisos ou notícias publicados nesta categoria.
              </p>
            </div>
          </div>
        )}

        {/* Feed de Comunicados */}
        {!loading && comunicados.length > 0 && (
          <div className="space-y-3">
            {comunicados.map((com) => {
              const cfg = CATEGORIA_CONFIG[com.categoria] || CATEGORIA_CONFIG.geral;
              const Icon = cfg.icon;
              const isUrgente = com.categoria === 'urgente';
              const hasImg = com.imagem_url && !imgErrors[com.id];

              return (
                <article
                  key={com.id}
                  onClick={() => router.push(`/app/comunicados/${com.id}`)}
                  className={`bg-[#111827] rounded-2xl border shadow-md overflow-hidden active:scale-[0.99] transition cursor-pointer ${
                    isUrgente
                      ? 'border-rose-500/40 bg-rose-950/15'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Banner / Imagem Opcional */}
                  {hasImg && (
                    <div className="relative w-full h-44 bg-slate-900 overflow-hidden border-b border-slate-800">
                      <img
                        src={com.imagem_url!}
                        alt={com.titulo}
                        onError={() => handleImageError(com.id)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-4 space-y-2.5">
                    {/* Header do Card (Categoria + Data + Departamento) */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badgeColor}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{cfg.label}</span>
                        </span>

                        {com.departamento && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#172033] border border-slate-700/60 text-purple-300">
                            <Tag className="w-2.5 h-2.5" />
                            <span>{com.departamento.sigla || com.departamento.nome}</span>
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{fmtDate(com.publicado_em)}</span>
                      </span>
                    </div>

                    {/* Título */}
                    <h2
                      className={`text-sm font-bold leading-snug line-clamp-2 ${
                        isUrgente ? 'text-rose-200' : 'text-slate-100'
                      }`}
                    >
                      {com.titulo}
                    </h2>

                    {/* Resumo do Conteúdo */}
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {com.conteudo}
                    </p>

                    {/* Rodapé do Card */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      {com.congregacao_nome ? (
                        <span className="text-slate-400 text-[11px] flex items-center gap-1 truncate max-w-[200px]">
                          <Building2 className="w-3 h-3 shrink-0 text-slate-500" />
                          <span className="truncate">{com.congregacao_nome}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Toda a Igreja</span>
                      )}

                      <span className="font-bold text-blue-400 flex items-center gap-0.5 text-xs">
                        <span>Ler mais</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Paginação / Carregar Mais */}
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-3 bg-[#111827] border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span>Carregando mais comunicados...</span>
                    </>
                  ) : (
                    <span>Carregar comunicados anteriores</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
