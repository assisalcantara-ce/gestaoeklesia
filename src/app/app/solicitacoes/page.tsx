'use client';

/**
 * /app/solicitacoes — Solicitações de Cartas Ministeriais do Membro
 *
 * Exclusivamente integrado à estrutura existente em:
 * Secretaria -> Cartas e Declarações -> Pedidos de Cartas (`/secretaria/cartas`)
 *
 * Tipos de Cartas do ERP (4 tipos):
 * 1. Carta de Mudança (exige autorização presidencial)
 * 2. Carta de Desligamento (exige autorização presidencial)
 * 3. Carta de Trânsito
 * 4. Carta de Recomendação
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  AlertCircle,
  Loader2,
  Send,
  ShieldCheck,
  MapPin,
  RefreshCw,
} from 'lucide-react';

export type TipoCarta = 'mudanca' | 'transito' | 'desligamento' | 'recomendacao';

export interface SolicitacaoItem {
  id: string;
  tipo_carta: TipoCarta;
  destino?: string | null;
  observacoes?: string | null;
  status: 'pendente' | 'autorizado' | 'rejeitado';
  data_autorizacao?: string | null;
  motivo_rejeicao?: string | null;
  created_at: string;
}

export const TIPOS_CARTAS_CONFIG: Record<
  TipoCarta,
  {
    label: string;
    badge: string;
    exigePresidencia: boolean;
    descricao: string;
    exemploDestino: string;
  }
> = {
  recomendacao: {
    label: 'Carta de Recomendação',
    badge: 'Comunhão & Apresentação',
    exigePresidencia: false,
    descricao: 'Atesta sua idoneidade e plena comunhão como membro para congregações ou ministérios congêneres.',
    exemploDestino: 'Ex: Igreja Assembleia de Deus — Fortaleza/CE',
  },
  transito: {
    label: 'Carta de Trânsito',
    badge: 'Viagem / Temporária',
    exigePresidencia: false,
    descricao: 'Concedida para viagens temporárias ou estadias fora de sua igreja local, recomendando sua acolhida.',
    exemploDestino: 'Ex: Confraternização em Brasília/DF',
  },
  mudanca: {
    label: 'Carta de Mudança',
    badge: 'Exige Presidência',
    exigePresidencia: true,
    descricao: 'Para transferência definitiva de membresia para outra congregação. Exige autorização formal da Presidência.',
    exemploDestino: 'Ex: AD Sede — São Paulo/SP (Bairro Centro)',
  },
  desligamento: {
    label: 'Carta de Desligamento',
    badge: 'Exige Presidência',
    exigePresidencia: true,
    descricao: 'Solicitação formal de saída do rol de membros. Exige autorização formal da Presidência.',
    exemploDestino: 'Igreja / Ministério de destino ou motivo pessoal',
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; border: string; bg: string; icon: React.ElementType }
> = {
  pendente: {
    label: 'Aguardando Análise',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/30',
    icon: Clock,
  },
  autorizado: {
    label: 'Autorizado',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-950/30',
    icon: CheckCircle2,
  },
  rejeitado: {
    label: 'Indeferido',
    color: 'text-rose-400',
    border: 'border-rose-500/30',
    bg: 'bg-rose-950/30',
    icon: XCircle,
  },
};

export default function SolicitacoesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<'lista' | 'novo'>('lista');
  const [loading, setLoading] = useState(true);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulário de Nova Solicitação
  const [formTipo, setFormTipo] = useState<TipoCarta>('recomendacao');
  const [formDestino, setFormDestino] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/v1/mobile/documentos/solicitacoes', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar solicitações.');
      }

      const data = await res.json();
      setSolicitacoes(data.solicitacoes || []);
    } catch {
      setErrorMsg('Não foi possível consultar os pedidos no momento.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormFeedback(null);
    setErrorMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setFormFeedback({ type: 'error', msg: 'Sessão expirada. Faça login novamente.' });
        return;
      }

      const res = await fetch('/api/v1/mobile/documentos/solicitacoes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo_carta: formTipo,
          destino: formDestino.trim() || null,
          observacoes: formObservacoes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar solicitação.');
      }

      setFormFeedback({
        type: 'success',
        msg: data.message || 'Solicitação enviada com sucesso!',
      });
      setFormDestino('');
      setFormObservacoes('');
      await loadData();

      setTimeout(() => {
        setFormFeedback(null);
        setActiveTab('lista');
      }, 1600);
    } catch (err: any) {
      setFormFeedback({
        type: 'error',
        msg: err?.message || 'Falha ao enviar solicitação.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-full flex-1 flex flex-col bg-[#0F172A] text-slate-100">
      <MobileHeader title="Solicitações de Cartas" />

      <main className="flex-1 pb-28 px-4 pt-3 space-y-4 max-w-lg mx-auto w-full">
        {/* Banner Informativo */}
        <div className="bg-linear-to-br from-[#172033] to-[#111827] border border-blue-500/25 p-4.5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-bold uppercase tracking-wider">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Cartas Ministeriais & Documentos</span>
            </div>
            <h1 className="text-base font-bold text-white leading-tight">
              Central de Solicitações
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Solicite documentos oficiais e acompanhe a autorização da Secretaria Geral e Presidência do ministério.
            </p>
          </div>
          <div className="absolute right-[-10px] bottom-[-20px] opacity-5 text-blue-400 pointer-events-none">
            <FileText className="w-28 h-28" />
          </div>
        </div>

        {/* Abas Superiores */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#172033] p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('lista')}
            className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'lista'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Meus Pedidos ({solicitacoes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('novo')}
            className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'novo'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Nova Solicitação</span>
          </button>
        </div>

        {/* Mensagem de Erro Geral */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-14 text-center space-y-2.5">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Consultando pedidos no ERP...</p>
          </div>
        )}

        {/* ABA: MEUS PEDIDOS */}
        {!loading && activeTab === 'lista' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Histórico de Solicitações
              </span>
              <button
                type="button"
                onClick={loadData}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} />
                Atualizar
              </button>
            </div>

            {solicitacoes.length === 0 ? (
              <div className="py-12 px-4 text-center bg-[#111827] border border-slate-800 rounded-2xl shadow-lg space-y-3">
                <FileText className="w-12 h-12 text-slate-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-200">Nenhum pedido em andamento</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Você ainda não solicitou nenhuma carta ministerial.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('novo')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-blue-900/30 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Fazer Solicitação</span>
                </button>
              </div>
            ) : (
              solicitacoes.map((sol) => {
                const statusCfg = STATUS_CONFIG[sol.status] || STATUS_CONFIG.pendente;
                const StatusIcon = statusCfg.icon;
                const cartaInfo = TIPOS_CARTAS_CONFIG[sol.tipo_carta] || {
                  label: sol.tipo_carta,
                  badge: 'Oficial',
                  exigePresidencia: false,
                  descricao: '',
                };

                return (
                  <div
                    key={sol.id}
                    className="bg-[#111827] p-4 rounded-2xl border border-slate-800 shadow-md space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm font-bold text-slate-100">{cartaInfo.label}</h2>
                          {cartaInfo.exigePresidencia && (
                            <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              Presidência
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Solicitado em {fmtDate(sol.created_at)}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{statusCfg.label}</span>
                      </span>
                    </div>

                    {sol.destino && (
                      <div className="text-xs text-slate-300 flex items-start gap-1.5 bg-[#172033]/60 p-2.5 rounded-xl border border-slate-800">
                        <MapPin size={13} className="text-blue-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-slate-200">Destino:</strong> {sol.destino}
                        </span>
                      </div>
                    )}

                    {sol.observacoes && (
                      <p className="text-xs text-slate-300 italic bg-[#172033]/40 p-2.5 rounded-xl border border-slate-800/80">
                        &quot;{sol.observacoes}&quot;
                      </p>
                    )}

                    {sol.status === 'rejeitado' && sol.motivo_rejeicao && (
                      <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-500/30 p-2.5 rounded-xl space-y-0.5">
                        <strong className="text-rose-200 block">Motivo informado pelo ministério:</strong>
                        <span>{sol.motivo_rejeicao}</span>
                      </div>
                    )}

                    {sol.status === 'autorizado' && (
                      <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-xl flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          Autorizado em {fmtDate(sol.data_autorizacao)}. O documento oficial foi liberado pela Secretaria.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ABA: NOVA SOLICITAÇÃO */}
        {!loading && activeTab === 'novo' && (
          <div className="bg-[#111827] p-4.5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Solicitar Carta Ministerial</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Seu cadastro oficial, congregação e ministério são validados e vinculados automaticamente pelo sistema.
              </p>
            </div>

            {formFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2.5 animate-in fade-in ${
                  formFeedback.type === 'success'
                    ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                }`}
              >
                {formFeedback.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{formFeedback.msg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seleção do Tipo de Carta (4 Tipos Oficiais) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  Tipo de Carta Oficial (Selecione) *
                </label>
                <div className="space-y-2">
                  {(Object.keys(TIPOS_CARTAS_CONFIG) as TipoCarta[]).map((key) => {
                    const item = TIPOS_CARTAS_CONFIG[key];
                    const isSelected = formTipo === key;

                    return (
                      <label
                        key={key}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500 shadow-xs'
                            : 'bg-[#172033] border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tipo_carta"
                          value={key}
                          checked={isSelected}
                          onChange={() => setFormTipo(key)}
                          className="mt-1 accent-blue-500 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-slate-100">{item.label}</p>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                item.exigePresidencia
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">{item.descricao}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Informação sobre governança de aprovação */}
              <div className="bg-[#172033]/70 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                  <ShieldCheck size={13} className="text-blue-400" />
                  <span>Governança Institucional</span>
                </div>
                <p>
                  {TIPOS_CARTAS_CONFIG[formTipo].exigePresidencia
                    ? 'Esta carta exige aprovação formal da Presidência antes da liberação oficial.'
                    : 'Esta carta será encaminhada para conferência e emissão pela Secretaria Geral.'}
                </p>
              </div>

              {/* Campo: Destino */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider flex items-center justify-between">
                  <span>Igreja / Cidade de Destino</span>
                  <span className="text-[10px] font-normal text-slate-400 lowercase">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={formDestino}
                  onChange={(e) => setFormDestino(e.target.value)}
                  placeholder={TIPOS_CARTAS_CONFIG[formTipo].exemploDestino}
                  className="w-full text-xs p-3 rounded-xl bg-[#172033] border border-slate-700/70 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden transition"
                />
              </div>

              {/* Campo: Finalidade / Justificativa */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider flex items-center justify-between">
                  <span>Finalidade / Justificativa</span>
                  <span className="text-[10px] font-normal text-slate-400 lowercase">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  placeholder="Informações adicionais para a Secretaria e Presidência..."
                  className="w-full text-xs p-3 rounded-xl bg-[#172033] border border-slate-700/70 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden resize-none transition"
                />
              </div>

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando solicitação...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Solicitação</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
}
