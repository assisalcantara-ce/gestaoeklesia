'use client';

/**
 * /app/eventos — Listagem de Eventos e Minhas Inscrições do Membro
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMobileMember } from '@/providers/MobileMemberProvider';
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
    <div className="min-h-screen bg-gray-50 pb-24">
      <MobileHeader title="Eventos" />

      {/* Tabs */}
      <div className="pt-16 bg-white border-b border-gray-100 px-4 sticky top-0 z-10 shadow-xs">
        <div className="flex gap-2 py-2">
          <button
            onClick={() => setTab('disponiveis')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              tab === 'disponiveis'
                ? 'bg-dark-blue text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Próximos Eventos
          </button>
          <button
            onClick={() => setTab('inscricoes')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all relative ${
              tab === 'inscricoes'
                ? 'bg-dark-blue text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Minhas Inscrições
            {minhasInscricoes.length > 0 && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  tab === 'inscricoes' ? 'bg-white text-dark-blue' : 'bg-dark-blue text-white'
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
              <div key={n} className="bg-white rounded-2xl p-5 border border-gray-100 space-y-3">
                <div className="flex justify-between">
                  <div className="w-24 h-4 bg-gray-200 rounded" />
                  <div className="w-16 h-4 bg-gray-200 rounded" />
                </div>
                <div className="w-3/4 h-6 bg-gray-200 rounded" />
                <div className="w-1/2 h-4 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-100 my-4">
            <AlertCircle size={36} className="text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-800 mb-1">Não foi possível carregar</p>
            <p className="text-xs text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl shadow hover:bg-red-700 active:scale-95 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* TAB 1: Próximos Eventos */}
        {!loading && !error && tab === 'disponiveis' && (
          <>
            {eventos.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-xs my-6">
                <div className="w-14 h-14 bg-dark-blue/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Calendar size={28} className="text-dark-blue" />
                </div>
                <h3 className="text-base font-bold text-gray-800">Nenhum evento com inscrições abertas</h3>
                <p className="text-xs text-gray-500 mt-1">
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
                      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-bold text-dark-blue bg-dark-blue/10 px-2.5 py-0.5 rounded-full">
                            {tipoLabel}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {ev.inclui_hospedagem && (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Bed size={11} />
                                Hospedagem
                              </span>
                            )}
                            <span
                              className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                ev.valor_inscricao === 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {formatCurrency(ev.valor_inscricao)}
                            </span>
                          </div>
                        </div>

                        {/* Título */}
                        <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-2">
                          {ev.titulo}
                        </h3>

                        {/* Descrição resumida */}
                        {ev.descricao && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {ev.descricao}
                          </p>
                        )}

                        {/* Metadados de Data e Local */}
                        <div className="mt-3.5 space-y-1.5 text-xs text-gray-600 border-t border-gray-50 pt-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-dark-blue shrink-0" />
                            <span>{formatEventDate(ev.data_inicio)}</span>
                          </div>

                          {ev.local_nome && (
                            <div className="flex items-center gap-2">
                              <MapPin size={13} className="text-dark-blue shrink-0" />
                              <span className="truncate">{ev.local_nome}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Footer / Status do Membro */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                        {jaInscrito ? (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle2 size={14} />
                            Inscrição Registrada
                          </span>
                        ) : ev.lotado ? (
                          <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                            <Users size={14} />
                            Vagas esgotadas (Lista de Espera)
                          </span>
                        ) : ev.vagas_restantes != null ? (
                          <span className="text-xs text-gray-500">
                            Restam <strong>{ev.vagas_restantes}</strong> vagas
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Inscrições Abertas</span>
                        )}

                        <div className="flex items-center text-xs font-bold text-dark-blue">
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
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-xs my-6">
                <div className="w-14 h-14 bg-dark-blue/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Ticket size={28} className="text-dark-blue" />
                </div>
                <h3 className="text-base font-bold text-gray-800">Você ainda não possui inscrições</h3>
                <p className="text-xs text-gray-500 mt-1 mb-5">
                  Participe das conferências, retiros e encontros do seu ministério.
                </p>
                <button
                  onClick={() => setTab('disponiveis')}
                  className="px-5 py-2.5 bg-dark-blue text-white text-xs font-bold rounded-xl shadow hover:bg-dark-blue/90 active:scale-95 transition-all"
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
                      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {formatEventDate(ins.evento.data_inicio)}
                        </span>

                        {isConfirmado && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Confirmada
                          </span>
                        )}

                        {isAguardando && (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                            <Clock size={12} />
                            Aguardando PIX
                          </span>
                        )}

                        {isEspera && (
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                            Lista de Espera
                          </span>
                        )}

                        {isCancelado && (
                          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {ins.status === 'expirado' ? 'Expirada' : 'Cancelada'}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-gray-900 leading-snug">
                        {ins.evento.titulo}
                      </h3>

                      {ins.evento.local_nome && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin size={13} className="text-dark-blue shrink-0" />
                          <span className="truncate">{ins.evento.local_nome}</span>
                        </div>
                      )}

                      {ins.com_hospedagem && (
                        <div className="text-xs text-blue-800 bg-blue-50/70 p-2.5 rounded-xl flex items-center gap-2 border border-blue-100/50">
                          <Bed size={14} className="shrink-0" />
                          <span>Hospedagem inclusa na solicitação</span>
                        </div>
                      )}

                      {/* Botões de Ação */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                        {isConfirmado && (
                          <button
                            onClick={() => handleOpenIngresso(ins)}
                            className="w-full py-2.5 px-4 rounded-xl bg-dark-blue text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-dark-blue/90 active:scale-[0.98] transition-all"
                          >
                            <Ticket size={14} />
                            Ver Ingresso / Check-in
                          </button>
                        )}

                        {isAguardando && ins.pagamento?.id && (
                          <button
                            onClick={() => router.push(`/app/eventos/${ins.evento.id}/pix?pagamentoId=${ins.pagamento?.id}`)}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all"
                          >
                            <DollarSign size={14} />
                            Pagar Inscrição (PIX)
                          </button>
                        )}

                        {!isConfirmado && !isAguardando && (
                          <button
                            onClick={() => router.push(`/app/eventos/${ins.evento.id}`)}
                            className="text-xs font-bold text-dark-blue hover:underline py-1"
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
  );
}
