'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';

interface Congregacao { id: string; nome: string }

export interface PaymentDestino {
  id: string;
  label: string;
  tipo_recebimento: string;
  congregacao_id?: string | null;
  conta_id?: string | null;
  categoria_id?: string | null;
  valor_fixo?: number | null;
  descricao?: string | null;
  public_token: string;
  is_ativo: boolean;
  expires_at?: string | null;
  total_arrecadado?: number;
  congregacoes?: { nome: string } | null;
}

export interface FinCobrancaCharge {
  id: string;
  destination_id: string;
  gateway_charge_id?: string | null;
  valor_solicitado?: number | null;
  valor_pago?: number | null;
  payer_name?: string | null;
  payer_document?: string | null;
  status: string;
  paid_at?: string | null;
  created_at: string;
  tesouraria_lancamento_id?: string | null;
  fin_payment_destinations?: {
    label: string;
    public_token: string;
    congregacoes?: { nome: string } | null;
  } | null;
}

interface ArrecadacaoDigitalContentProps {
  congregacoes: Congregacao[];
  fmtBRL: (v: number) => string;
  fmtDate: (d: string) => string;
  showModal: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenNovoDestino: () => void;
  onOpenEditDestino: (id: string) => void;
  onOpenQrModal: (destino: PaymentDestino) => void;
  destinosUpdatedKey: number;
}

export default function ArrecadacaoDigitalContent({
  congregacoes,
  fmtBRL,
  fmtDate,
  showModal,
  onOpenNovoDestino,
  onOpenEditDestino,
  onOpenQrModal,
  destinosUpdatedKey,
}: ArrecadacaoDigitalContentProps) {
  const [subAba, setSubAba] = useState<'destinos' | 'extrato'>('destinos');
  const [destinos, setDestinos] = useState<PaymentDestino[]>([]);
  const [cobrancas, setCobrancas] = useState<FinCobrancaCharge[]>([]);
  const [loadingDestinos, setLoadingDestinos] = useState(true);
  const [loadingCobrancas, setLoadingCobrancas] = useState(false);
  const [asaasStatus, setAsaasStatus] = useState<{ configured: boolean; active: boolean }>({
    configured: false,
    active: false,
  });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<'' | 'ativo' | 'inativo'>('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCong, setFiltroCong] = useState('');
  const [buscaExtrato, setBuscaExtrato] = useState('');

  // 1. Carregar status do gateway ASAAS
  useEffect(() => {
    authenticatedFetch('/api/v1/ministry/gateway')
      .then((res) => res.json())
      .then((json) => {
        const gw = (json.data ?? []).find((g: any) => g.gateway === 'asaas');
        if (gw) {
          setAsaasStatus({
            configured: gw.status === 'configured' || gw.status === 'connected',
            active: gw.is_active === true,
          });
        }
      })
      .catch(() => {});
  }, []);

  // 2. Carregar Destinos via GET /api/v1/ministry/payment-destinations
  const loadDestinos = useCallback(async () => {
    try {
      setLoadingDestinos(true);
      const res = await authenticatedFetch('/api/v1/ministry/payment-destinations');
      if (!res.ok) throw new Error('Erro ao carregar destinos.');
      const json = await res.json();
      setDestinos(json.data ?? []);
    } catch (err: any) {
      showModal('Erro', err.message || 'Falha ao buscar destinos de arrecadação.', 'error');
    } finally {
      setLoadingDestinos(false);
    }
  }, [showModal]);

  useEffect(() => {
    loadDestinos();
  }, [loadDestinos, destinosUpdatedKey]);

  // 3. Carregar Cobranças / Extrato PIX via Supabase Client ou API do Supabase
  const loadCobrancas = useCallback(async () => {
    try {
      setLoadingCobrancas(true);
      const { createClient } = await import('@/lib/supabase-client');
      const supabase = createClient();
      const { data, error } = await supabase
        .from('fin_payment_charges')
        .select(`
          id, destination_id, gateway_charge_id, valor_solicitado, valor_pago,
          payer_name, payer_document, status, paid_at, created_at, tesouraria_lancamento_id,
          fin_payment_destinations (
            label, public_token, congregacoes (nome)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setCobrancas((data as any) ?? []);
    } catch {
      // Ignora erro se a tabela ainda estiver vazia
      setCobrancas([]);
    } finally {
      setLoadingCobrancas(false);
    }
  }, []);

  useEffect(() => {
    if (subAba === 'extrato') {
      loadCobrancas();
    }
  }, [subAba, loadCobrancas]);

  // Alternar Status de Ativação do Destino
  const handleToggleAtivo = async (id: string, currentAtivo: boolean) => {
    try {
      const res = await authenticatedFetch(`/api/v1/ministry/payment-destinations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_ativo: !currentAtivo }),
      });
      if (!res.ok) throw new Error('Falha ao alterar status.');
      showModal('Sucesso', `Destino ${!currentAtivo ? 'ativado' : 'desativado'} com sucesso!`);
      loadDestinos();
    } catch (err: any) {
      showModal('Erro', err.message, 'error');
    }
  };

  // Copiar link público
  const handleCopyLink = async (token: string) => {
    const url = `https://app.gestaoeklesia.com.br/pagar/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {}
  };

  // Métricas Computadas
  const totalArrecadadoGlobal = destinos.reduce((acc, d) => acc + (d.total_arrecadado ?? 0), 0);
  const destinosAtivosCount = destinos.filter((d) => d.is_ativo).length;
  const transacoesPagasCount = cobrancas.filter((c) => c.status === 'pago').length;

  // Filtragem de Destinos
  const destinosFiltrados = destinos.filter((d) => {
    if (filtroStatus === 'ativo' && !d.is_ativo) return false;
    if (filtroStatus === 'inativo' && d.is_ativo) return false;
    if (filtroTipo && d.tipo_recebimento !== filtroTipo) return false;
    if (filtroCong && d.congregacao_id !== filtroCong) return false;
    return true;
  });

  // Filtragem de Extrato
  const cobrancasFiltradas = cobrancas.filter((c) => {
    if (!buscaExtrato) return true;
    const term = buscaExtrato.toLowerCase();
    const pagador = (c.payer_name ?? '').toLowerCase();
    const dest = (c.fin_payment_destinations?.label ?? '').toLowerCase();
    return pagador.includes(term) || dest.includes(term);
  });

  const TIPO_LABELS: Record<string, string> = {
    dizimo: 'Dízimo',
    oferta: 'Oferta',
    missoes: 'Missões',
    doacao: 'Doação',
    campanha_local: 'Campanha',
    evento_local: 'Evento',
  };

  const STATUS_BADGES: Record<string, { label: string; cls: string; icon: any }> = {
    pago: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
    pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-700 border-slate-200', icon: XCircle },
    expirado: { label: 'Expirado', cls: 'bg-rose-100 text-rose-800 border-rose-200', icon: AlertCircle },
    estornado: { label: 'Estornado', cls: 'bg-[#123b63]/10 text-[#123b63] border-[#123b63]/20', icon: AlertCircle },
  };

  return (
    <div className="space-y-6">
      {/* ── 1. CABEÇALHO & METRICAS (KPIs) ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-extrabold text-slate-800">Arrecadação Digital PIX</h2>
            {asaasStatus.configured && asaasStatus.active ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <ShieldCheck className="h-3.5 w-3.5" /> ASAAS Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                Gateway em Configuração
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            Gerencie destinos de doação, gere QR Codes automáticos para púlpitos ou eventos e acompanhe as conciliações via PIX em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenNovoDestino}
            className="px-4 py-2.5 bg-[#123b63] hover:bg-[#1a4f85] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition"
          >
            <Plus className="h-4 w-4" /> Novo Destino PIX
          </button>
        </div>
      </div>

      {/* Cards de Métricas Reais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Arrecadado PIX</p>
            <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{fmtBRL(totalArrecadadoGlobal)}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#123b63]/10 text-[#123b63] rounded-xl border border-[#123b63]/20">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinos / QR Codes Ativos</p>
            <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{destinosAtivosCount} ativo(s)</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doações Pagas</p>
            <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{transacoesPagasCount} transação(ões)</h3>
          </div>
        </div>
      </div>

      {/* ── 2. SUB-ABAS ── */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setSubAba('destinos')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition ${
            subAba === 'destinos'
              ? 'border-[#123b63] text-[#123b63]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Destinos & QR Codes ({destinos.length})
        </button>
        <button
          onClick={() => setSubAba('extrato')}
          className={`pb-2.5 text-xs font-bold border-b-2 transition ${
            subAba === 'extrato'
              ? 'border-[#123b63] text-[#123b63]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Extrato de Doações PIX
        </button>
      </div>

      {/* ── 3. VISÃO DESTINOS & QR CODES ── */}
      {subAba === 'destinos' && (
        <div className="space-y-4">
          {/* Barra de Filtros de Destinos */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center text-xs">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 font-semibold"
            >
              <option value="">Todos os Status</option>
              <option value="ativo">Apenas Ativos</option>
              <option value="inativo">Apenas Inativos</option>
            </select>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 font-semibold"
            >
              <option value="">Todos os Tipos</option>
              <option value="dizimo">Dízimo</option>
              <option value="oferta">Oferta</option>
              <option value="missoes">Missões</option>
              <option value="doacao">Doação</option>
              <option value="campanha_local">Campanha</option>
              <option value="evento_local">Evento</option>
            </select>

            <select
              value={filtroCong}
              onChange={(e) => setFiltroCong(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 font-semibold"
            >
              <option value="">Todas as Congregações</option>
              {congregacoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Grid de Destinos */}
          {loadingDestinos ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              Carregando destinos de arrecadação...
            </div>
          ) : destinosFiltrados.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
              <QrCode className="h-12 w-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Nenhum destino de arrecadação cadastrado</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Crie links e QR Codes dinâmicos para dízimos, ofertas e eventos para receber pagamentos via PIX diretamente no caixa.
              </p>
              <button
                onClick={onOpenNovoDestino}
                className="mt-2 px-4 py-2 bg-[#123b63] text-white text-xs font-bold rounded-xl"
              >
                + Criar Primeiro Destino
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {destinosFiltrados.map((d) => {
                const isCopied = copiedToken === d.public_token;

                return (
                  <div
                    key={d.id}
                    className={`bg-white rounded-2xl p-5 border transition flex flex-col justify-between space-y-4 ${
                      d.is_ativo ? 'border-slate-200 shadow-sm hover:shadow-md' : 'border-slate-200 bg-slate-50/70 opacity-75'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2.5 py-0.5 bg-[#123b63]/10 text-[#123b63] text-[10px] font-bold rounded-full uppercase tracking-wider">
                          {TIPO_LABELS[d.tipo_recebimento] ?? d.tipo_recebimento}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            d.is_ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {d.is_ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-800 leading-snug">{d.label}</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        📍 {d.congregacoes?.nome ?? 'Sede / Todas as Congregações'}
                      </p>

                      {d.descricao && <p className="text-xs text-slate-600 line-clamp-2">{d.descricao}</p>}
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Total Arrecadado:</span>
                        <span className="font-bold text-slate-800">{fmtBRL(d.total_arrecadado ?? 0)}</span>
                      </div>

                      {/* Ações do Card */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          onClick={() => onOpenQrModal(d)}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                        >
                          <QrCode className="h-3.5 w-3.5 text-[#123b63]" /> Ver QR
                        </button>
                        <button
                          onClick={() => handleCopyLink(d.public_token)}
                          className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1 transition ${
                            isCopied ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                          title="Copiar link público de doação"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => onOpenEditDestino(d.id)}
                          className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition"
                          title="Editar destino"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleAtivo(d.id, d.is_ativo)}
                          className={`p-2 border rounded-xl transition ${
                            d.is_ativo ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                          title={d.is_ativo ? 'Desativar destino' : 'Ativar destino'}
                        >
                          {d.is_ativo ? <Trash2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 4. VISÃO EXTRATO DE DOAÇÕES PIX ── */}
      {subAba === 'extrato' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={buscaExtrato}
              onChange={(e) => setBuscaExtrato(e.target.value)}
              placeholder="Buscar doação por nome do pagador ou nome do destino..."
              className="w-full text-xs outline-none bg-transparent"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingCobrancas ? (
              <div className="p-12 text-center text-xs text-slate-400">Carregando extrato PIX...</div>
            ) : cobrancasFiltradas.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-600 text-sm">Nenhuma doação registrada no extrato</p>
                <p className="text-slate-400">
                  As doações recebidas via PIX através dos QR Codes do ministério serão exibidas aqui.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Destino / Congregação</th>
                      <th className="py-3 px-4">Pagador</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Lançamento Caixa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cobrancasFiltradas.map((c) => {
                      const badge = STATUS_BADGES[c.status] ?? STATUS_BADGES.pendente;
                      const StatusIcon = badge.icon;
                      const valor = c.valor_pago ?? c.valor_solicitado ?? 0;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {fmtDate(c.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-800">
                              {c.fin_payment_destinations?.label ?? 'Destino Indefinido'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {c.fin_payment_destinations?.congregacoes?.nome ?? 'Sede / Todas'}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-700">{c.payer_name || 'Anônimo / Não identificado'}</p>
                            {c.payer_document && <p className="text-[10px] text-slate-400">{c.payer_document}</p>}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-800">
                            {fmtBRL(valor)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full border ${badge.cls}`}
                            >
                              <StatusIcon className="h-3 w-3" /> {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {c.tesouraria_lancamento_id ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="h-3 w-3" /> Conciliado
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
