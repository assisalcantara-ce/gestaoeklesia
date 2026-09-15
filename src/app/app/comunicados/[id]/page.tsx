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
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: AlertTriangle,
  },
  evento: {
    label: 'Evento',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Calendar,
  },
  departamento: {
    label: 'Departamento',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Layers,
  },
  geral: {
    label: 'Comunicado Oficial',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
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

      <main className="flex-1 pb-24 px-4 pt-4 space-y-4">
        {/* Loading (Skeleton) */}
        {loading && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
            <div className="w-24 h-6 bg-gray-200 rounded-md" />
            <div className="w-3/4 h-7 bg-gray-200 rounded-md" />
            <div className="w-40 h-4 bg-gray-200 rounded-md" />
            <div className="w-full h-48 bg-gray-200 rounded-xl" />
            <div className="space-y-2 pt-2">
              <div className="w-full h-4 bg-gray-200 rounded-md" />
              <div className="w-full h-4 bg-gray-200 rounded-md" />
              <div className="w-2/3 h-4 bg-gray-200 rounded-md" />
            </div>
          </div>
        )}

        {/* Mensagem de Erro / Não Encontrado */}
        {!loading && errorMsg && (
          <div className="py-16 px-4 text-center bg-white border border-gray-100 rounded-2xl shadow-sm space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-gray-800">Comunicado Indisponível</h2>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">{errorMsg}</p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => router.push('/app/comunicados')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao mural</span>
              </button>
              <button
                onClick={loadDetalhe}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar de novo</span>
              </button>
            </div>
          </div>
        )}

        {/* Detalhe do Comunicado */}
        {!loading && comunicado && (
          <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4">
            {/* Banner Opcional */}
            {comunicado.imagem_url && !imgError && (
              <div className="relative w-full max-h-64 bg-gray-100 overflow-hidden border-b border-gray-100">
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
              <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-gray-100">
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      <Tag className="w-3 h-3 text-purple-600" />
                      <span>{comunicado.departamento.nome}</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={handleShare}
                  className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition"
                  title="Compartilhar"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              {/* Título */}
              <h1 className="text-lg font-bold text-gray-900 leading-snug">
                {comunicado.titulo}
              </h1>

              {/* Data e Localização */}
              <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>Publicado em: {fmtDateFull(comunicado.publicado_em)}</span>
                </div>
                {comunicado.congregacao_nome ? (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>Congregação: {comunicado.congregacao_nome}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Abrangência: Todo o Ministério</span>
                  </div>
                )}
              </div>

              {/* Conteúdo Seguro em Texto Formatado */}
              <div className="pt-2 text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                {comunicado.conteudo}
              </div>

              {/* Botão de Retorno */}
              <div className="pt-6 border-t border-gray-100">
                <button
                  onClick={() => router.push('/app/comunicados')}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
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
