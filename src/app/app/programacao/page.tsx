'use client';

/**
 * /app/programacao — Programação, Cultos e Agenda Mobile do Membro
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  MapPin,
  Flame,
  Sparkles,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Church,
} from 'lucide-react';

interface AgendaItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  data_inicio: string;
  data_fim?: string | null;
  local?: string | null;
  visibilidade: string;
  status: string;
  agenda_tipos?: {
    id: string;
    nome: string;
    categoria: string;
    cor?: string | null;
    icone?: string | null;
  } | null;
  congregacoes?: {
    id: string;
    nome: string;
    endereco?: string | null;
    cidade?: string | null;
    uf?: string | null;
  } | null;
}

interface AgendaResponse {
  total: number;
  proximo_culto?: AgendaItem | null;
  hoje: AgendaItem[];
  esta_semana: AgendaItem[];
  proximos: AgendaItem[];
  todos: AgendaItem[];
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const diaSemana = diasSemana[d.getDay()];
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = meses[d.getMonth()];
  const hora = String(d.getHours()).padStart(2, '0');
  const minuto = String(d.getMinutes()).padStart(2, '0');

  return {
    diaSemana,
    diaMes: `${dia} ${mes}`,
    hora: `${hora}:${minuto}`,
    completo: `${diaSemana}, ${dia} de ${mes} às ${hora}:${minuto}`,
  };
}

export default function ProgramacaoPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'cultos' | 'eventos' | 'congregacao'>('todos');

  const loadAgenda = useCallback(async () => {
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

      let url = '/api/v1/mobile/agenda';
      if (filtro === 'cultos') url += '?tipo=culto';
      if (filtro === 'eventos') url += '?tipo=evento';
      if (filtro === 'congregacao') url += '?apenas_congregacao=true';

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao carregar programação.');
      }

      const resData: AgendaResponse = await res.json();
      setData(resData);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a programação.');
    } finally {
      setLoading(false);
    }
  }, [supabase, filtro]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  return (
    <MobileShell>
      <MobileHeader title="Programação" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-24 space-y-4">
        {/* Filtros rápidos */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFiltro('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filtro === 'todos'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Toda Programação
          </button>
          <button
            onClick={() => setFiltro('cultos')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filtro === 'cultos'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Cultos
          </button>
          <button
            onClick={() => setFiltro('eventos')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filtro === 'eventos'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Eventos
          </button>
          <button
            onClick={() => setFiltro('congregacao')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filtro === 'congregacao'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Minha Congregação
          </button>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-44 bg-slate-200 rounded-2xl w-full" />
            <div className="h-24 bg-slate-200 rounded-xl w-full" />
            <div className="h-24 bg-slate-200 rounded-xl w-full" />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="font-semibold text-red-900 text-base mb-1">Ops! Ocorreu um problema</h3>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button
              onClick={loadAgenda}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition"
            >
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <>
            {/* Hero Card: Próximo Culto */}
            {data.proximo_culto && (
              <div
                onClick={() => router.push(`/app/programacao/${data.proximo_culto?.id}`)}
                className="bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-md cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wide">
                    <Flame size={12} className="text-slate-950 fill-slate-950" />
                    Próximo Culto
                  </span>
                  <span className="text-xs text-blue-200 font-medium">
                    {formatDateTime(data.proximo_culto.data_inicio).hora}
                  </span>
                </div>

                <h2 className="text-lg font-bold tracking-tight mb-1">{data.proximo_culto.titulo}</h2>

                <div className="space-y-1.5 mt-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-blue-300 shrink-0" />
                    <span>{formatDateTime(data.proximo_culto.data_inicio).completo}</span>
                  </div>
                  {data.proximo_culto.congregacoes?.nome && (
                    <div className="flex items-center gap-2">
                      <Church size={13} className="text-blue-300 shrink-0" />
                      <span>{data.proximo_culto.congregacoes.nome}</span>
                    </div>
                  )}
                  {data.proximo_culto.congregacoes?.endereco && (
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-blue-300 shrink-0" />
                      <span className="truncate">{data.proximo_culto.congregacoes.endereco}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-blue-200">
                  <span>Ver detalhes e localização</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            )}

            {/* Empty State */}
            {data.total === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
                <Calendar size={36} className="text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-base mb-1">Nenhuma programação encontrada</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Não há cultos ou eventos públicos agendados para este filtro no momento.
                </p>
              </div>
            )}

            {/* Seção Hoje */}
            {data.hoje.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 px-1 flex items-center gap-1.5">
                  <Sparkles size={13} />
                  Hoje
                </h3>
                {data.hoje.map((item) => (
                  <ItemCard key={item.id} item={item} onSelect={() => router.push(`/app/programacao/${item.id}`)} />
                ))}
              </div>
            )}

            {/* Seção Esta Semana */}
            {data.esta_semana.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  Esta Semana
                </h3>
                {data.esta_semana.map((item) => (
                  <ItemCard key={item.id} item={item} onSelect={() => router.push(`/app/programacao/${item.id}`)} />
                ))}
              </div>
            )}

            {/* Seção Próximos */}
            {data.proximos.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  Próximos Dias
                </h3>
                {data.proximos.map((item) => (
                  <ItemCard key={item.id} item={item} onSelect={() => router.push(`/app/programacao/${item.id}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}

function ItemCard({ item, onSelect }: { item: AgendaItem; onSelect: () => void }) {
  const dt = formatDateTime(item.data_inicio);
  const corBadge = item.agenda_tipos?.cor || '#2563eb';

  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm hover:border-slate-300 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        {/* Bloco de Data */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-center shrink-0 w-14">
          <p className="text-[10px] font-bold uppercase text-blue-600 leading-tight">{dt.diaSemana}</p>
          <p className="text-sm font-extrabold text-slate-800 leading-tight">{dt.diaMes.split(' ')[0]}</p>
          <p className="text-[9px] text-slate-400 leading-tight">{dt.diaMes.split(' ')[1]}</p>
        </div>

        {/* Informações */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: corBadge }}
            >
              {item.agenda_tipos?.nome || item.tipo}
            </span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock size={11} />
              {dt.hora}
            </span>
          </div>

          <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">{item.titulo}</h4>

          <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
            <MapPin size={11} className="shrink-0 text-slate-400" />
            <span className="truncate">{item.congregacoes?.nome || item.local || 'Local a definir'}</span>
          </p>
        </div>
      </div>

      <ChevronRight size={16} className="text-slate-400 shrink-0" />
    </div>
  );
}
