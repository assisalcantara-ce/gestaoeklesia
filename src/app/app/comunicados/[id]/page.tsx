'use client';

/**
 * /app/comunicados/[id] — Detalhe do Comunicado Oficial
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  Megaphone,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowLeft,
  Clock,
  Building2,
  Tag,
  AlertCircle,
  RefreshCw,
  Share2,
} from 'lucide-react';

interface DepartamentoInfo {
  id: string;
  nome: string;
  sigla: string;
  logo_url: string | null;
}

interface ComunicadoDetalhe {
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
    label: 'Comunicado Oficial',
    badgeColor: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
    icon: Megaphone,
  },
};

export default function MobileComunicadoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [comunicado, setComunicado] = useState<ComunicadoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadDetalhe = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/v1/mobile/comunicados/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 404) {
        setErrorMsg('Este comunicado não está mais disponível ou não existe.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error('Não foi possível carregar o comunicado.');
      }

      const data = await res.json();
      setComunicado(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao carregar detalhes do comunicado.');
    } finally {
      setLoading(false);
    }
  }, [id, getAccessToken]);

  useEffect(() => {
    loadDetalhe();
  }, [loadDetalhe]);

  const fmtDateFull = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share && comunicado) {
      navigator.share({
        title: comunicado.titulo,
        text: `${comunicado.titulo}\n\n${comunicado.conteudo}`,
        url: window.location.href,
      }).catch(() => {});
    }
  };

  return (
    <MobileShell>
      <MobileHeader title="Comunicado" showBack={true} />

      <main className="flex-1 pb-28 px-4 pt-4 space-y-4 text-slate-100 max-w-lg mx-auto w-full">
        {/* Loading (Skeleton) */}
        {loading && (
          <div className="bg-[#111827] p-5 rounded-2xl border border-slate-800 shadow-md animate-pulse space-y-4">
            <div className="w-24 h-6 bg-slate-800 rounded-md" />
            <div className="w-3/4 h-7 bg-slate-800 rounded-md" />
            <div className="w-40 h-4 bg-slate-800 rounded-md" />
            <div className="w-full h-48 bg-slate-800 rounded-xl" />
            <div className="space-y-2 pt-2">
              <div className="w-full h-4 bg-slate-800 rounded-md" />
              <div className="w-full h-4 bg-slate-800 rounded-md" />
              <div className="w-2/3 h-4 bg-slate-800 rounded-md" />
            </div>
          </div>
        )}

        {/* Mensagem de Erro / Não Encontrado */}
        {!loading && errorMsg && (
          <div className="py-16 px-4 text-center bg-[#111827] border border-slate-800 rounded-2xl shadow-lg space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-100">Comunicado Indisponível</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">{errorMsg}</p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => router.push('/app/comunicados')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#172033] hover:bg-slate-800 text-slate-200 border border-slate-700/60 font-bold text-xs rounded-xl transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao mural</span>
              </button>
              <button
                onClick={loadDetalhe}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-blue-900/30"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar de novo</span>
              </button>
            </div>
          </div>
        )}

        {/* Detalhe do Comunicado */}
        {!loading && comunicado && (
          <article className="bg-[#111827] rounded-2xl border border-slate-800 shadow-lg overflow-hidden space-y-4">
            {/* Banner Opcional */}
            {comunicado.imagem_url && !imgError && (
              <div className="relative w-full max-h-72 bg-slate-900 overflow-hidden border-b border-slate-800">
                <img
                  src={comunicado.imagem_url}
                  alt={comunicado.titulo}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-5 space-y-4">
              {/* Badges e Metadados */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(() => {
                    const cfg = CATEGORIA_CONFIG[comunicado.categoria] || CATEGORIA_CONFIG.geral;
                    const Icon = cfg.icon;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.badgeColor}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cfg.label}</span>
                      </span>
                    );
                  })()}

                  {comunicado.departamento && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#172033] text-purple-300 border border-slate-700/60">
                      <Tag className="w-3 h-3 text-purple-400" />
                      <span>{comunicado.departamento.nome}</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={handleShare}
                  className="p-2 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-[#172033] transition"
                  title="Compartilhar"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              {/* Título */}
              <h1 className="text-lg font-bold text-slate-100 leading-snug">
                {comunicado.titulo}
              </h1>

              {/* Data e Localização */}
              <div className="text-xs text-slate-400 space-y-1.5 bg-[#172033] p-3 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Publicado em: {fmtDateFull(comunicado.publicado_em)}</span>
                </div>
                {comunicado.congregacao_nome ? (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Congregação: {comunicado.congregacao_nome}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Abrangência: Todo o Ministério</span>
                  </div>
                )}
              </div>

              {/* Conteúdo Seguro em Texto Formatado */}
              <div className="pt-2 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {comunicado.conteudo}
              </div>

              {/* Botão de Retorno */}
              <div className="pt-6 border-t border-slate-800">
                <button
                  onClick={() => router.push('/app/comunicados')}
                  className="w-full py-3 bg-[#172033] hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-slate-700/60 transition flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para todos os comunicados</span>
                </button>
              </div>
            </div>
          </article>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
