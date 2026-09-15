'use client';

/**
 * /app/programacao/[id] — Detalhes do Culto / Evento da Programação Mobile
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  Calendar,
  MapPin,
  Church,
  ArrowLeft,
  Navigation,
  Share2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface EventoDetalhes {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  tipo_info?: {
    id: string;
    nome: string;
    categoria: string;
    cor?: string | null;
    icone?: string | null;
  } | null;
  data_inicio: string;
  data_fim?: string | null;
  status: string;
  visibilidade: string;
  local?: string | null;
  congregação?: {
    id: string;
    nome: string;
    endereco?: string | null;
    cidade?: string | null;
    uf?: string | null;
  } | null;
  endereco_completo?: string | null;
  maps_url?: string | null;
}

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr);
  const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const diaSemana = diasSemana[d.getDay()];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const minuto = String(d.getMinutes()).padStart(2, '0');

  return {
    diaSemana,
    dataExtenso: `${diaSemana}, ${dia} de ${mes} de ${ano}`,
    horario: `${hora}:${minuto}`,
  };
}

export default function DetalheProgramacaoPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evento, setEvento] = useState<EventoDetalhes | null>(null);

  const id = params?.id as string;

  const loadEvento = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/v1/mobile/agenda/${id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Programação não encontrada ou restrita.');
      }

      const data: EventoDetalhes = await res.json();
      setEvento(data);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar detalhes da programação.');
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    loadEvento();
  }, [loadEvento]);

  const handleShare = async () => {
    if (!evento) return;
    const dt = formatFullDate(evento.data_inicio);
    const texto = `📅 ${evento.titulo}\n🗓️ ${dt.dataExtenso} às ${dt.horario}\n📍 ${evento.endereco_completo || evento.local || 'Na Igreja'}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: evento.titulo,
          text: texto,
        });
      } catch {
        // Ignored
      }
    } else {
      navigator.clipboard?.writeText(texto);
      alert('Informações do culto copiadas para a área de transferência!');
    }
  };

  return (
    <MobileShell>
      <MobileHeader title="Detalhes do Culto" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-28 space-y-4 bg-[#0f172a] text-slate-100">
        {/* Botão Voltar */}
        <button
          onClick={() => router.push('/app/programacao')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-[#172033] border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-sm transition cursor-pointer"
        >
          <ArrowLeft size={14} />
          Voltar para a programação
        </button>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-48 bg-slate-800 rounded-2xl w-full" />
            <div className="h-32 bg-slate-800 rounded-xl w-full" />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center text-red-300">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-100 text-base mb-1">Não foi possível exibir</h3>
            <p className="text-sm text-red-300 mb-4">{error}</p>
            <button
              onClick={loadEvento}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition cursor-pointer"
            >
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          </div>
        )}

        {/* Detalhes do Evento */}
        {!loading && !error && evento && (
          <div className="space-y-4">
            {/* Card Principal */}
            <div className="bg-[#111827] rounded-2xl border border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full text-white shadow-xs"
                  style={{ backgroundColor: evento.tipo_info?.cor || '#2563eb' }}
                >
                  {evento.tipo_info?.nome || evento.tipo}
                </span>

                <button
                  onClick={handleShare}
                  className="p-2 rounded-xl bg-[#172033] border border-slate-700/80 text-slate-300 hover:text-white hover:bg-[#1f2c45] transition cursor-pointer"
                  title="Compartilhar"
                >
                  <Share2 size={16} />
                </button>
              </div>

              <div>
                <h1 className="text-xl font-extrabold text-slate-100 tracking-tight leading-snug">
                  {evento.titulo}
                </h1>
                {evento.descricao && (
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-line">
                    {evento.descricao}
                  </p>
                )}
              </div>

              {/* Data e Horário */}
              <div className="bg-[#172033]/80 border border-slate-700/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2.5">
                  <Calendar size={16} className="text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-100">
                      {formatFullDate(evento.data_inicio).dataExtenso}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Horário: {formatFullDate(evento.data_inicio).horario}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Localização e Congregação */}
            <div className="bg-[#111827] rounded-2xl border border-slate-800 p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                <Church size={16} className="text-blue-400" />
                Local do Culto
              </h2>

              <div className="space-y-1 text-xs text-slate-300">
                {evento.congregação?.nome && (
                  <p className="font-bold text-slate-100 text-sm">
                    {evento.congregação.nome}
                  </p>
                )}
                {evento.endereco_completo && (
                  <p className="flex items-start gap-1.5 text-slate-300">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span>{evento.endereco_completo}</span>
                  </p>
                )}
              </div>

              {evento.maps_url && (
                <a
                  href={evento.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/30 transition active:scale-[0.98] cursor-pointer"
                >
                  <Navigation size={14} />
                  Abrir no Aplicativo de Mapas (Como Chegar)
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
