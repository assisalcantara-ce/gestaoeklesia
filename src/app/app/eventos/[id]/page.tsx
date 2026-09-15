'use client';

/**
 * /app/eventos/[id] — Detalhes do Evento e Fluxo de Inscrição Mobile
 * Design System Dark + Blue Institucional
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import IngressoModal from '@/components/mobile/IngressoModal';
import { createClient } from '@/lib/supabase-client';
import {
  Calendar,
  MapPin,
  Bed,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ticket,
  DollarSign,
  ChevronLeft,
  Loader2,
  Info,
  Sparkles,
  FileText,
} from 'lucide-react';

interface EventoDetalhe {
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
  lista_espera_count: number;
  inclui_hospedagem: boolean;
  vagas_hospedagem: number | null;
  vagas_hospedagem_restantes: number | null;
  hospedagem_lotada: boolean;
  descricao_hospedagem: string | null;
  programacao: string | null;
  status: string;
  aceita_inscricao: boolean;
  slug: string | null;
  minha_inscricao: {
    id: string;
    status: string;
    com_hospedagem: boolean;
    status_hospedagem: string;
    observacoes: string | null;
    created_at: string;
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

function formatEventFullDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
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

export default function EventoDetalhesPage() {
  const router = useRouter();
  const params = useParams();
  const eventoId = typeof params?.id === 'string' ? params.id : '';

  const { member, isLoading: memberLoading } = useMobileMember();
  const sbRef = useRef(createClient());

  const [evento, setEvento] = useState<EventoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Formulário de Inscrição
  const [querHospedagem, setQuerHospedagem] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [inscricaoSucesso, setInscricaoSucesso] = useState<any>(null);

  // Modal de Ingresso
  const [isIngressoOpen, setIsIngressoOpen] = useState(false);

  const fetchDetalhes = async () => {
    if (!eventoId) return;
    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Não autenticado.');

      const res = await fetch(`/api/v1/mobile/eventos/${eventoId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (res.status === 404) {
        throw new Error('Evento não encontrado ou indisponível.');
      }
      if (!res.ok) {
        throw new Error('Falha ao carregar detalhes do evento.');
      }

      const data: EventoDetalhe = await res.json();
      setEvento(data);
      if (data.minha_inscricao?.com_hospedagem) {
        setQuerHospedagem(true);
      }
    } catch (err: any) {
      console.error('[EventoDetalhesPage] Erro:', err);
      setError(err.message || 'Erro ao carregar evento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!memberLoading && member && eventoId) {
      fetchDetalhes();
    }
  }, [memberLoading, member, eventoId]);

  const handleInscrever = async () => {
    if (isSubmitting || !evento) return;
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch(`/api/v1/mobile/eventos/${evento.id}/inscrever`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          com_hospedagem: querHospedagem,
          observacoes: observacoes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar inscrição.');
      }

      // Se for evento pago e retornou pagamento_id
      if (data.pago && data.pagamento_id) {
        router.push(`/app/eventos/${evento.id}/pix?pagamentoId=${data.pagamento_id}`);
        return;
      }

      // Se for gratuito ou lista de espera
      setInscricaoSucesso(data);
      await fetchDetalhes();
    } catch (err: any) {
      console.error('[handleInscrever] Erro:', err);
      setSubmitError(err.message || 'Não foi possível concluir a inscrição.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-slate-100">
        <div className="text-center space-y-3">
          <Loader2 size={36} className="text-blue-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Carregando evento...</p>
        </div>
      </div>
    );
  }

  if (error || !evento) {
    return (
      <MobileShell>
        <div className="min-h-screen bg-[#0F172A] p-6 flex flex-col justify-between text-slate-100">
          <MobileHeader title="Evento" />
          <div className="my-auto text-center bg-[#111827] rounded-3xl p-8 border border-slate-800/80 shadow-md max-w-sm mx-auto">
            <AlertCircle size={44} className="text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-100 mb-1">Evento indisponível</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">{error || 'Evento não encontrado.'}</p>
            <button
              onClick={() => router.push('/app/eventos')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              Voltar para Eventos
            </button>
          </div>
        </div>
      </MobileShell>
    );
  }

  const minhaIns = evento.minha_inscricao;
  const isJaInscrito = Boolean(minhaIns && !['expirado', 'cancelado'].includes(minhaIns.status));
  const isPago = evento.valor_inscricao > 0;
  const tipoLabel = TIPO_LABELS[evento.tipo] || 'Evento';

  return (
    <MobileShell>
      <div className="min-h-screen bg-[#0F172A] text-slate-100 pb-28">
        {/* Header com botão Voltar */}
        <div className="bg-[#0F172A]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sticky top-0 z-20 flex items-center gap-3">
          <button
            onClick={() => router.push('/app/eventos')}
            className="w-9 h-9 rounded-full bg-[#172033] border border-slate-700/60 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-300 transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-slate-100 truncate">Detalhes do Evento</span>
        </div>

        <div className="max-w-md mx-auto px-4 py-5 space-y-5">
          {/* Banner Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                {tipoLabel}
              </span>

              <span
                className={`text-xs font-black px-3 py-1 rounded-full border ${
                  evento.valor_inscricao === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                {formatCurrency(evento.valor_inscricao)}
              </span>
            </div>

            <h1 className="text-xl font-black text-slate-100 leading-snug tracking-tight">
              {evento.titulo}
            </h1>

            {evento.descricao && (
              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                {evento.descricao}
              </p>
            )}

            {/* Vagas */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              {evento.lotado ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Users size={13} />
                  Vagas Principais Esgotadas
                </span>
              ) : evento.vagas_restantes != null ? (
                <span>Vagas restantes: <strong className="text-slate-200">{evento.vagas_restantes}</strong></span>
              ) : (
                <span>Vagas ilimitadas</span>
              )}

              {evento.inclui_hospedagem && (
                <span className="flex items-center gap-1 text-sky-400">
                  <Bed size={13} />
                  Hospedagem disponível
                </span>
              )}
            </div>
          </div>

          {/* FEEDBACK DE INSCRIÇÃO CONCLUÍDA RECENTEMENTE */}
          {inscricaoSucesso && (
            <div className="bg-emerald-950/30 rounded-2xl p-5 border border-emerald-800/50 shadow-md space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span>Inscrição realizada com sucesso!</span>
              </div>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                {inscricaoSucesso.status === 'lista_espera'
                  ? 'Sua inscrição foi registrada na lista de espera. Você será notificado assim que uma vaga for liberada.'
                  : 'Sua vaga está garantida. Acesse seu ingresso para o dia do evento.'}
              </p>
            </div>
          )}

          {/* STATUS DA MINHA INSCRIÇÃO EXISTENTE */}
          {isJaInscrito && minhaIns && (
            <div className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Sua Inscrição
                </span>

                {minhaIns.status === 'confirmado' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={13} />
                    Confirmada
                  </span>
                )}

                {minhaIns.status === 'aguardando_pagamento' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full animate-pulse">
                    <Clock size={13} />
                    Aguardando PIX
                  </span>
                )}

                {minhaIns.status === 'lista_espera' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                    Lista de Espera
                  </span>
                )}
              </div>

              {minhaIns.com_hospedagem && (
                <p className="text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 p-2.5 rounded-xl flex items-center gap-2">
                  <Bed size={14} className="shrink-0 text-sky-400" />
                  <span>Hospedagem solicitada nesta inscrição.</span>
                </p>
              )}

              {/* Ações para inscrição existente */}
              <div className="pt-2">
                {minhaIns.status === 'confirmado' && (
                  <button
                    onClick={() => setIsIngressoOpen(true)}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-900/30 active:scale-[0.98] transition-all"
                  >
                    <Ticket size={16} />
                    Ver Ingresso Digital / QR Code
                  </button>
                )}

                {minhaIns.status === 'aguardando_pagamento' && minhaIns.pagamento?.id && (
                  <button
                    onClick={() => router.push(`/app/eventos/${evento.id}/pix?pagamentoId=${minhaIns.pagamento?.id}`)}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-900/30 active:scale-[0.98] transition-all"
                  >
                    <DollarSign size={16} />
                    Concluir Pagamento PIX (R$ {Number(minhaIns.pagamento.valor).toFixed(2)})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Data e Local */}
          <div className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 shadow-md space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Informações do Evento
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="font-bold text-slate-100">Data e Horário</p>
                  <p className="text-slate-300 capitalize">{formatEventFullDate(evento.data_inicio)}</p>
                  {evento.data_fim && (
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Até {formatEventFullDate(evento.data_fim)}
                    </p>
                  )}
                </div>
              </div>

              {evento.local_nome && (
                <div className="flex items-start gap-3 pt-2.5 border-t border-slate-800/60">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-100">{evento.local_nome}</p>
                    {evento.local_endereco && (
                      <p className="text-slate-400 mt-0.5">{evento.local_endereco}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Programação (se existente) */}
          {evento.programacao && (
            <div className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 shadow-md space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-blue-400" />
                Programação
              </h3>
              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                {evento.programacao}
              </p>
            </div>
          )}

          {/* Hospedagem (se o evento incluir) */}
          {evento.inclui_hospedagem && (
            <div className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 shadow-md space-y-3">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                <Bed size={16} />
                <span>Hospedagem no Local</span>
              </div>

              {evento.descricao_hospedagem && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  {evento.descricao_hospedagem}
                </p>
              )}

              {!isJaInscrito && (
                <label className="flex items-center gap-3 p-3 bg-[#172033] rounded-xl cursor-pointer hover:bg-slate-700/60 transition-colors border border-slate-700/60">
                  <input
                    type="checkbox"
                    checked={querHospedagem}
                    onChange={(e) => setQuerHospedagem(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded bg-slate-900 border-slate-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    Desejo solicitar vaga de hospedagem
                  </span>
                </label>
              )}
            </div>
          )}

          {/* FORMULÁRIO DE INSCRIÇÃO (Se o membro ainda não está inscrito) */}
          {!isJaInscrito && (
            <div className="bg-[#111827] rounded-2xl p-5 border border-slate-800/80 shadow-md space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Realizar Inscrição
              </h3>

              {/* Aviso sobre dados */}
              <div className="bg-[#172033] p-3 rounded-xl flex items-start gap-2.5 text-xs text-slate-300 border border-slate-700/50">
                <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Inscrição vinculada ao seu cadastro: <strong className="text-slate-100">{member?.name}</strong>.
                </p>
              </div>

              {/* Observações Opcionais */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Observações ou necessidades especiais (opcional)
                </label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: restrições alimentares, grupo musical, etc."
                  className="w-full px-3.5 py-2.5 text-xs bg-[#172033] border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  maxLength={300}
                />
              </div>

              {/* Alerta de erro de submissão */}
              {submitError && (
                <div className="p-3 bg-rose-950/40 text-rose-300 rounded-xl text-xs flex items-center gap-2 border border-rose-800/50">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Botão de Ação Principal */}
              <button
                onClick={handleInscrever}
                disabled={isSubmitting}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
                  isSubmitting
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : evento.lotado
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                    : isPago
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processando inscrição...</span>
                  </>
                ) : evento.lotado ? (
                  <>
                    <Users size={16} />
                    <span>Entrar na Lista de Espera</span>
                  </>
                ) : isPago ? (
                  <>
                    <DollarSign size={16} />
                    <span>Inscrever e Gerar PIX ({formatCurrency(evento.valor_inscricao)})</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Confirmar Inscrição Gratuita</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Modal de Ingresso */}
        <IngressoModal
          isOpen={isIngressoOpen}
          onClose={() => setIsIngressoOpen(false)}
          data={
            minhaIns
              ? {
                  inscricaoId: minhaIns.id,
                  eventoTitulo: evento.titulo,
                  dataInicio: evento.data_inicio,
                  localNome: evento.local_nome,
                  localEndereco: evento.local_endereco,
                  membroNome: member?.name || 'Membro',
                  comHospedagem: minhaIns.com_hospedagem,
                  statusHospedagem: minhaIns.status_hospedagem,
                  presente: false,
                }
              : null
          }
        />
      </div>
    </MobileShell>
  );
}

