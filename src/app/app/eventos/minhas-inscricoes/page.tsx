'use client';

/**
 * /app/eventos/minhas-inscricoes — Página dedicada de Inscrições do Membro
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import IngressoModal from '@/components/mobile/IngressoModal';
import { createClient } from '@/lib/supabase-client';
import {
  MapPin,
  Bed,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ticket,
  DollarSign,
  ChevronLeft,
} from 'lucide-react';

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

export default function MinhasInscricoesPage() {
  const router = useRouter();
  const { member, isLoading: memberLoading } = useMobileMember();
  const sbRef = useRef(createClient());

  const [inscricoes, setInscricoes] = useState<MinhaInscricaoItem[]>([]);
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

  const fetchInscricoes = async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Não autenticado.');

      const res = await fetch('/api/v1/mobile/eventos/minhas-inscricoes', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar suas inscrições.');
      }

      const data = await res.json();
      setInscricoes(data.data || []);
    } catch (err: any) {
      console.error('[MinhasInscricoesPage] Erro:', err);
      setError(err.message || 'Erro ao carregar inscrições.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!memberLoading && member) {
      fetchInscricoes();
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
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-20 flex items-center gap-3 shadow-xs">
        <button
          onClick={() => router.push('/app/eventos')}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 flex items-center justify-center text-gray-700 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-bold text-gray-800 truncate">Minhas Inscrições</span>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {loading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-5 border border-gray-100 space-y-3">
                <div className="w-1/3 h-4 bg-gray-200 rounded" />
                <div className="w-3/4 h-5 bg-gray-200 rounded" />
                <div className="w-1/2 h-4 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-100 my-4">
            <AlertCircle size={36} className="text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-800 mb-1">Não foi possível carregar</p>
            <p className="text-xs text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchInscricoes}
              className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl shadow hover:bg-red-700 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {!loading && !error && inscricoes.length === 0 && (
          <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-xs my-6">
            <div className="w-14 h-14 bg-dark-blue/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Ticket size={28} className="text-dark-blue" />
            </div>
            <h3 className="text-base font-bold text-gray-800">Nenhuma inscrição encontrada</h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              Você ainda não se inscreveu em nenhum evento da instituição.
            </p>
            <button
              onClick={() => router.push('/app/eventos')}
              className="px-5 py-2.5 bg-dark-blue text-white text-xs font-bold rounded-xl shadow hover:bg-dark-blue/90 active:scale-95 transition-all"
            >
              Explorar Eventos
            </button>
          </div>
        )}

        {!loading && !error && inscricoes.length > 0 && (
          <div className="space-y-4">
            {inscricoes.map((ins) => {
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
