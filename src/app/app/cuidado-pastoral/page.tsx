'use client';

/**
 * /app/cuidado-pastoral — Cuidado Pastoral e Pedidos de Oração Mobile
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  HeartHandshake,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Calendar,
  Lock,
  Sparkles,
  Send,
  AlertCircle,
} from 'lucide-react';

interface PedidoOracao {
  id: string;
  assunto: string;
  descricao: string;
  tipo: 'oracao' | 'atendimento' | 'visita' | 'outro';
  sigiloso: boolean;
  status: 'recebido' | 'em_oracao' | 'em_atendimento' | 'concluido';
  data_preferencial?: string | null;
  created_at: string;
  atendido_em?: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  recebido: {
    label: 'Recebido',
    color: 'bg-blue-950/40 text-blue-400 border-blue-500/20',
    icon: Clock,
  },
  em_oracao: {
    label: 'Em Oração',
    color: 'bg-amber-950/40 text-amber-400 border-amber-500/20',
    icon: Sparkles,
  },
  em_atendimento: {
    label: 'Em Atendimento',
    color: 'bg-purple-950/40 text-purple-400 border-purple-500/20',
    icon: HeartHandshake,
  },
  concluido: {
    label: 'Concluído',
    color: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20',
    icon: CheckCircle2,
  },
};

const TIPO_LABELS: Record<string, string> = {
  oracao: 'Pedido de Oração',
  atendimento: 'Atendimento Pastoral',
  visita: 'Visita Pastoral',
  outro: 'Outro Cuidado',
};

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export default function CuidadoPastoralPage() {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<'novo' | 'historico'>('novo');
  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoOracao[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<'oracao' | 'atendimento' | 'visita' | 'outro'>('oracao');
  const [sigiloso, setSigiloso] = useState(true);
  const [dataPreferencial, setDataPreferencial] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const loadHistorico = useCallback(async () => {
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

      const res = await fetch('/api/v1/mobile/pastoral/oracao', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao carregar solicitações.');
      }

      const data = await res.json();
      setPedidos(data.pedidos || []);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o histórico de solicitações.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'historico') {
      loadHistorico();
    }
  }, [activeTab, loadHistorico]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assunto.trim() || !descricao.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Sessão expirada. Faça login novamente.');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/v1/mobile/pastoral/oracao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assunto: assunto.trim(),
          descricao: descricao.trim(),
          tipo,
          sigiloso,
          data_preferencial: dataPreferencial || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao enviar pedido de oração.');
      }

      setSucesso(true);
      setAssunto('');
      setDescricao('');
      setDataPreferencial('');
      setTipo('oracao');
      setSigiloso(true);
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar seu pedido. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileShell>
      <MobileHeader title="Cuidado Pastoral" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-28 space-y-4 text-slate-100">
        {/* Banner acolhedor */}
        <div className="bg-gradient-to-br from-[#172033] to-[#111827] border border-blue-500/20 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <HeartHandshake size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">Cuidado Pastoral</h1>
              <p className="text-xs text-slate-300">Espaço de oração, acolhimento e suporte espiritual</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center gap-2 text-[11px] text-slate-300">
            <Lock size={12} className="text-blue-400 shrink-0" />
            <span>Seus pedidos são tratados com sigilo e dedicação pastoral.</span>
          </div>
        </div>

        {/* Abas */}
        <div className="flex bg-[#172033] p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => {
              setActiveTab('novo');
              setSucesso(false);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'novo'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Novo Pedido
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'historico'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Minhas Solicitações
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-rose-300">{error}</p>
            </div>
          </div>
        )}

        {/* ABA 1: NOVO PEDIDO */}
        {activeTab === 'novo' && (
          <div className="space-y-4">
            {sucesso ? (
              <div className="bg-[#111827] rounded-2xl border border-emerald-500/30 p-6 text-center shadow-lg space-y-3">
                <div className="w-14 h-14 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} />
                </div>
                <h2 className="text-base font-bold text-slate-100">Pedido Enviado com Sucesso!</h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                  Sua solicitação foi encaminhada para a liderança pastoral da sua igreja. Estamos orando por você!
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => setSucesso(false)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-blue-900/30"
                  >
                    Fazer Outro Pedido
                  </button>
                  <button
                    onClick={() => setActiveTab('historico')}
                    className="w-full py-2 bg-[#172033] hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700/60 transition"
                  >
                    Ver Minhas Solicitações
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#111827] rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4">
                {/* Tipo de Cuidado */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Tipo de Cuidado
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'oracao', label: 'Oração' },
                      { id: 'atendimento', label: 'Atendimento' },
                      { id: 'visita', label: 'Visita Pastoral' },
                      { id: 'outro', label: 'Outro' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTipo(item.id as any)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-center ${
                          tipo === item.id
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                            : 'bg-[#172033] border-slate-700/50 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assunto */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Assunto / Motivo <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                    placeholder="Ex: Saúde da família, Direção espiritual..."
                    className="w-full bg-[#172033] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Descrição do Pedido */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Descrição do Pedido <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Compartilhe com a liderança como podemos interceder ou ajudá-lo..."
                    className="w-full bg-[#172033] border border-slate-700/60 rounded-xl p-3.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                  />
                </div>

                {/* Data Preferencial (Opcional) */}
                {tipo !== 'oracao' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Data Preferencial (Opcional)
                    </label>
                    <input
                      type="date"
                      value={dataPreferencial}
                      onChange={(e) => setDataPreferencial(e.target.value)}
                      className="w-full bg-[#172033] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Sigilo */}
                <div className="bg-[#172033] border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-200">Sigilo Pastoral Estrito</p>
                      <p className="text-[10px] text-slate-400">Apenas os pastores diretos terão acesso</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sigiloso}
                    onChange={(e) => setSigiloso(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded bg-[#111827] border-slate-700 focus:ring-blue-500"
                  />
                </div>

                {/* Botão Enviar */}
                <button
                  type="submit"
                  disabled={submitting || !assunto.trim() || !descricao.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/30 transition flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Send size={14} />
                  {submitting ? 'Enviando com segurança...' : 'Enviar Pedido de Oração'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ABA 2: MINHAS SOLICITAÇÕES */}
        {activeTab === 'historico' && (
          <div className="space-y-3">
            {loading && (
              <div className="space-y-3 animate-pulse">
                <div className="h-20 bg-[#111827] rounded-xl border border-slate-800 w-full" />
                <div className="h-20 bg-[#111827] rounded-xl border border-slate-800 w-full" />
              </div>
            )}

            {!loading && pedidos.length === 0 && (
              <div className="bg-[#111827] rounded-2xl border border-slate-800 p-8 text-center shadow-lg">
                <HeartHandshake size={36} className="text-slate-500 mx-auto mb-3" />
                <h3 className="font-bold text-slate-200 text-sm mb-1">Nenhuma solicitação enviada</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Você ainda não registrou nenhum pedido de oração ou atendimento pastoral.
                </p>
              </div>
            )}

            {!loading &&
              pedidos.map((p) => {
                const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.recebido;
                const StatusIcon = statusCfg.icon;

                return (
                  <div
                    key={p.id}
                    className="bg-[#111827] rounded-xl border border-slate-800 p-4 shadow-md space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#172033] border border-slate-700/60 text-blue-300">
                        {TIPO_LABELS[p.tipo] || p.tipo}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.color}`}
                      >
                        <StatusIcon size={11} />
                        {statusCfg.label}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100 leading-snug">{p.assunto}</h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
                      {p.descricao}
                    </p>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        Enviado em {formatDateBR(p.created_at)}
                      </span>
                      {p.atendido_em && (
                        <span className="text-emerald-400 font-semibold">
                          Atendido em {formatDateBR(p.atendido_em)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
