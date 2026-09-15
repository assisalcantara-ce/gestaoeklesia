'use client';

/**
 * /app/eventos — Listagem de Eventos e Minhas Inscrições do Membro
 * Design System Dark + Blue Institucional
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import IngressoModal from '@/components/mobile/IngressoModal';
import { createClient } from '@/lib/supabase-client';
import {
  Calendar,
  MapPin,
  Bed,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ticket,
  DollarSign,
  ChevronRight,
  Users,
  RefreshCw,
} from 'lucide-react';

interface EventoItem {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  local_nome: string | null;
  local_endereco: string | null;
  valor_inscricao: number;
  capacidade: number | null;
  vagas_restantes: number | null;
  lotado: boolean;
  inclui_hospedagem: boolean;
  slug: string | null;
  programacao: string | null;
  minha_inscricao: {
    id: string;
    status: string;
    ativa: boolean;
  } | null;
}

interface MinhaInscricaoItem {
  id: string;
  status: string;
  com_hospedagem: boolean;
  status_hospedagem: string;
  observacoes: string | null;
  presente: boolean;
  checkin_em: string | null;
  created_at: string;
  evento: {
    id: string;
    titulo: string;
    descricao: string | null;
    tipo: string;
    data_inicio: string | null;
    data_fim: string | null;
    local_nome: string | null;
    local_endereco: string | null;
    valor_inscricao: number;
    inclui_hospedagem: boolean;
    slug: string | null;
    status: string;
  };
  pagamento: {
    id: string;
    status: string;
    valor: number;
    expires_at: string | null;
    paid_at: string | null;
    pix_payload: string | null;
    pix_qrcode: string | null;
    invoice_url: string | null;
  } | null;
}

const TIPO_LABELS: Record<string, string> = {
  culto_especial: 'Culto Especial',
  conferencia: 'Conferência',
  retiro: 'Retiro',
  evangelismo: 'Evangelismo',
  treinamento: 'Treinamento',
  social: 'Social',
  outro: 'Evento',
};

function formatEventDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(val: number): string {
  if (val === 0) return 'Gratuito';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export default function EventosPage() {
  const router = useRouter();
  const { member, isLoading: memberLoading } = useMobileMember();
  const sbRef = useRef(createClient());

  const [tab, setTab] = useState<'disponiveis' | 'inscricoes'>('disponiveis');

  // Estados de dados
  const [eventos, setEventos] = useState<EventoItem[]>([]);
  const [minhasInscricoes, setMinhasInscricoes] = useState<MinhaInscricaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal de Ingresso
  const [ingressoModalData, setIngressoModalData] = useState<{
    inscricaoId: string;
    eventoTitulo: string;
    dataInicio?: string | null;
    localNome?: string | null;
    localEndereco?: string | null;
    membroNome: string;
    comHospedagem?: boolean;
    statusHospedagem?: string;
    presente?: boolean;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Não autenticado.');

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Busca eventos disponíveis e minhas inscrições em paralelo
      const [resEventos, resInscricoes] = await Promise.all([
        fetch('/api/v1/mobile/eventos', { headers, cache: 'no-store' }),
        fetch('/api/v1/mobile/eventos/minhas-inscricoes', { headers, cache: 'no-store' }),
      ]);

      if (!resEventos.ok || !resInscricoes.ok) {
        throw new Error('Falha ao carregar eventos da instituição.');
      }

      const [dataEv, dataIns] = await Promise.all([
        resEventos.json(),
        resInscricoes.json(),
      ]);

      setEventos(dataEv.data || []);
      setMinhasInscricoes(dataIns.data || []);
    } catch (err: any) {
      console.error('[EventosPage] Erro ao buscar dados:', err);
      setError(err.message || 'Erro ao carregar eventos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!memberLoading && member) {
      fetchData();
    }
  }, [memberLoading, member]);

  const handleOpenIngresso = (ins: MinhaInscricaoItem) => {
    setIngressoModalData({
      inscricaoId: ins.id,
      eventoTitulo: ins.evento.titulo,
      dataInicio: ins.evento.data_inicio,
      localNome: ins.evento.local_nome,
      localEndereco: ins.evento.local_endereco,
      membroNome: member?.name || 'Membro',
      comHospedagem: ins.com_hospedagem,
      statusHospedagem: ins.status_hospedagem,
      presente: ins.presente,
    });
  };

  return (
    <MobileShell>
      <div className="min-h-screen bg-[#0F172A] text-slate-100 pb-28">
        <MobileHeader title="Eventos" />

        {/* Tabs */}
        <div className="pt-16 bg-[#0F172A]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sticky top-0 z-10">
          <div className="flex gap-2 py-2.5 max-w-md mx-auto">
            <button
              onClick={() => setTab('disponiveis')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                tab === 'disponiveis'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'bg-[#172033] text-slate-400 hover:text-slate-200 border border-slate-700/50'
              }`}
            >
              Próximos Eventos
            </button>
            <button
              onClick={() => setTab('inscricoes')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all relative ${
                tab === 'inscricoes'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'bg-[#172033] text-slate-400 hover:text-slate-200 border border-slate-700/50'
              }`}
            >
              Minhas Inscrições
              {minhasInscricoes.length > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    tab === 'inscricoes' ? 'bg-white text-blue-700' : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {minhasInscricoes.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="px-4 py-5 max-w-md mx-auto">
          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 space-y-3">
                  <div className="flex justify-between">
                    <div className="w-24 h-4 bg-slate-800 rounded-md" />
                    <div className="w-16 h-4 bg-slate-800 rounded-md" />
                  </div>
                  <div className="w-3/4 h-5 bg-slate-800 rounded-md" />
                  <div className="w-1/2 h-4 bg-slate-800/60 rounded-md" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="bg-rose-950/30 rounded-2xl p-6 text-center border border-rose-800/50 my-4">
              <AlertCircle size={36} className="text-rose-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-rose-200 mb-1">Não foi possível carregar</p>
              <p className="text-xs text-rose-300/80 mb-4">{error}</p>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all"
              >
                <RefreshCw size={14} />
                Tentar Novamente
              </button>
            </div>
          )}

          {/* TAB 1: Próximos Eventos */}
          {!loading && !error && tab === 'disponiveis' && (
            <>
              {eventos.length === 0 ? (
                <div className="bg-[#111827] rounded-3xl p-8 text-center border border-slate-800/80 shadow-sm my-6">
                  <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Calendar size={28} className="text-blue-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-100">Nenhum evento com inscrições abertas</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Novos eventos e conferências serão exibidos aqui assim que as inscrições forem liberadas.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {eventos.map((ev) => {
                    const jaInscrito = ev.minha_inscricao?.ativa;
                    const tipoLabel = TIPO_LABELS[ev.tipo] || 'Evento';

                    return (
                      <div
                        key={ev.id}
                        onClick={() => router.push(`/app/eventos/${ev.id}`)}
                        className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 shadow-md hover:border-slate-700 transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          {/* Top Badges */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                              {tipoLabel}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {ev.inclui_hospedagem && (
                                <span className="text-[10px] font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Bed size={11} />
                                  Hospedagem
                                </span>
                              )}
                              <span
                                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                                  ev.valor_inscricao === 0
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                }`}
                              >
                                {formatCurrency(ev.valor_inscricao)}
                              </span>
                            </div>
                          </div>

                          {/* Título */}
                          <h3 className="text-base font-bold text-slate-100 leading-snug line-clamp-2">
                            {ev.titulo}
                          </h3>

                          {/* Descrição resumida */}
                          {ev.descricao && (
                            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                              {ev.descricao}
                            </p>
                          )}

                          {/* Metadados de Data e Local */}
                          <div className="mt-3.5 space-y-1.5 text-xs text-slate-300 border-t border-slate-800/60 pt-3">
                            <div className="flex items-center gap-2">
                              <Calendar size={13} className="text-blue-400 shrink-0" />
                              <span>{formatEventDate(ev.data_inicio)}</span>
                            </div>

                            {ev.local_nome && (
                              <div className="flex items-center gap-2">
                                <MapPin size={13} className="text-blue-400 shrink-0" />
                                <span className="truncate text-slate-400">{ev.local_nome}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Footer / Status do Membro */}
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                          {jaInscrito ? (
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 size={14} />
                              Inscrição Registrada
                            </span>
                          ) : ev.lotado ? (
                            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                              <Users size={14} />
                              Vagas esgotadas (Lista de Espera)
                            </span>
                          ) : ev.vagas_restantes != null ? (
                            <span className="text-xs text-slate-400">
                              Restam <strong className="text-slate-200">{ev.vagas_restantes}</strong> vagas
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Inscrições Abertas</span>
                          )}

                          <div className="flex items-center text-xs font-bold text-blue-400 hover:text-blue-300">
                            <span>Detalhes</span>
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: Minhas Inscrições */}
          {!loading && !error && tab === 'inscricoes' && (
            <>
              {minhasInscricoes.length === 0 ? (
                <div className="bg-[#111827] rounded-3xl p-8 text-center border border-slate-800/80 shadow-sm my-6">
                  <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Ticket size={28} className="text-blue-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-100">Você ainda não possui inscrições</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-5 leading-relaxed">
                    Participe das conferências, retiros e encontros do seu ministério.
                  </p>
                  <button
                    onClick={() => setTab('disponiveis')}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all"
                  >
                    Ver Eventos Disponíveis
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {minhasInscricoes.map((ins) => {
                    const isConfirmado = ins.status === 'confirmado';
                    const isAguardando = ins.status === 'aguardando_pagamento';
                    const isEspera = ins.status === 'lista_espera';
                    const isCancelado = ['cancelado', 'expirado'].includes(ins.status);

                    return (
                      <div
                        key={ins.id}
                        className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 shadow-md space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-400 bg-[#172033] border border-slate-700/60 px-2.5 py-0.5 rounded-full">
                            {formatEventDate(ins.evento.data_inicio)}
                          </span>

                          {isConfirmado && (
                            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              Confirmada
                            </span>
                          )}

                          {isAguardando && (
                            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <Clock size={12} />
                              Aguardando PIX
                            </span>
                          )}

                          {isEspera && (
                            <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                              Lista de Espera
                            </span>
                          )}

                          {isCancelado && (
                            <span className="text-[11px] font-semibold text-slate-400 bg-[#172033] border border-slate-700/60 px-2.5 py-0.5 rounded-full">
                              {ins.status === 'expirado' ? 'Expirada' : 'Cancelada'}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-100 leading-snug">
                          {ins.evento.titulo}
                        </h3>

                        {ins.evento.local_nome && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <MapPin size={13} className="text-blue-400 shrink-0" />
                            <span className="truncate">{ins.evento.local_nome}</span>
                          </div>
                        )}

                        {ins.com_hospedagem && (
                          <div className="text-xs text-sky-300 bg-sky-500/10 p-2.5 rounded-xl flex items-center gap-2 border border-sky-500/20">
                            <Bed size={14} className="shrink-0 text-sky-400" />
                            <span>Hospedagem inclusa na solicitação</span>
                          </div>
                        )}

                        {/* Botões de Ação */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                          {isConfirmado && (
                            <button
                              onClick={() => handleOpenIngresso(ins)}
                              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-900/30 active:scale-[0.98] transition-all"
                            >
                              <Ticket size={14} />
                              Ver Ingresso / Check-in
                            </button>
                          )}

                          {isAguardando && ins.pagamento?.id && (
                            <button
                              onClick={() => router.push(`/app/eventos/${ins.evento.id}/pix?pagamentoId=${ins.pagamento?.id}`)}
                              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-900/30 active:scale-[0.98] transition-all"
                            >
                              <DollarSign size={14} />
                              Pagar Inscrição (PIX)
                            </button>
                          )}

                          {!isConfirmado && !isAguardando && (
                            <button
                              onClick={() => router.push(`/app/eventos/${ins.evento.id}`)}
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 py-1"
                            >
                              Ver detalhes do evento →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de Ingresso */}
        <IngressoModal
          isOpen={Boolean(ingressoModalData)}
          onClose={() => setIngressoModalData(null)}
          data={ingressoModalData}
        />

        <MobileBottomNav />
      </div>
    </MobileShell>
  );
}
