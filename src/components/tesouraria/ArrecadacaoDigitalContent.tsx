'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Plus,
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
import ConfirmDeleteModal from '@/components/tesouraria/modals/ConfirmDeleteModal';

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
  pix_qr_code_id?: string | null;
  pix_payload?: string | null;
  pix_external_reference?: string | null;
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
    congregacoes?: { nome: string } | null;
  } | null;
}

interface ArrecadacaoDigitalContentProps {
  congregacoes: Congregacao[];
  fmtBRL: (v: number) => string;
  fmtDate: (d: string) => string;
  showModal: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenNovoDestino: () => void;
  onOpenQrModal: (destino: PaymentDestino) => void;
  destinosUpdatedKey: number;
}

export default function ArrecadacaoDigitalContent({
  congregacoes,
  fmtBRL,
  fmtDate,
  showModal,
  onOpenNovoDestino,
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

  // Filtros de busca e status
  const [statusFiltro, setStatusFiltro] = useState<'ativo' | 'inativo'>('ativo');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [buscaExtrato, setBuscaExtrato] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [congFiltro, setCongFiltro] = useState('');

  // Estado de Paginação Backend
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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

  // 2. Carregar Destinos via GET /api/v1/ministry/payment-destinations (Paginado no servidor)
  const loadDestinos = useCallback(async () => {
    try {
      setLoadingDestinos(true);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('is_ativo', statusFiltro === 'ativo' ? 'true' : 'false');

      if (buscaTexto.trim()) params.set('q', buscaTexto.trim());
      if (tipoFiltro) params.set('tipo', tipoFiltro);
      if (congFiltro) params.set('congregacao_id', congFiltro);

      const res = await authenticatedFetch(`/api/v1/ministry/payment-destinations?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar destinos.');
      const json = await res.json();

      setDestinos(json.data ?? []);
      if (json.meta) {
        setTotalCount(json.meta.totalCount ?? 0);
        setTotalPages(json.meta.totalPages ?? 1);
      }
    } catch (err: any) {
      showModal('Erro', err.message || 'Falha ao buscar destinos de arrecadação.', 'error');
    } finally {
      setLoadingDestinos(false);
    }
  }, [page, pageSize, statusFiltro, buscaTexto, tipoFiltro, congFiltro, showModal]);

  useEffect(() => {
    loadDestinos();
  }, [loadDestinos, destinosUpdatedKey]);

  // Resetar para página 1 ao alterar filtros
  const handleStatusFiltroChange = (newStatus: 'ativo' | 'inativo') => {
    setStatusFiltro(newStatus);
    setPage(1);
  };

  const handleBuscaChange = (val: string) => {
    setBuscaTexto(val);
    setPage(1);
  };

  const handleTipoFiltroChange = (val: string) => {
    setTipoFiltro(val);
    setPage(1);
  };

  const handleCongFiltroChange = (val: string) => {
    setCongFiltro(val);
    setPage(1);
  };

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
            label, congregacoes (nome)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setCobrancas((data as any) ?? []);
    } catch {
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

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estados para Modais Customizados de Confirmação
  const [confirmDesativarDestino, setConfirmDesativarDestino] = useState<{
    id: string;
    hasStaticPix: boolean;
  } | null>(null);

  const [confirmExcluirDestino, setConfirmExcluirDestino] = useState<{
    id: string;
    label: string;
  } | null>(null);

  // Alternar Status de Ativação do Destino
  const handleToggleAtivo = (id: string, currentAtivo: boolean, hasStaticPix: boolean) => {
    if (deactivatingId || deletingId) return; // Evita duplo clique

    if (currentAtivo) {
      setConfirmDesativarDestino({ id, hasStaticPix });
    } else {
      executeToggleAtivo(id, false);
    }
  };

  const executeToggleAtivo = async (id: string, currentAtivo: boolean) => {
    try {
      setDeactivatingId(id);
      setConfirmDesativarDestino(null);
      const res = await authenticatedFetch(`/api/v1/ministry/payment-destinations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_ativo: !currentAtivo }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao alterar status do destino.');
      }

      showModal('Sucesso', `Destino ${!currentAtivo ? 'ativado' : 'desativado'} com sucesso!`);
      loadDestinos();
    } catch (err: any) {
      showModal('Erro ao desativar', err.message || 'O QR Code não pôde ser desativado no ASAAS.', 'error');
    } finally {
      setDeactivatingId(null);
    }
  };

  // Excluir definitivamente um destino inativo
  const handleDeletePermanente = (id: string, label: string) => {
    if (deactivatingId || deletingId) return; // Evita duplo clique
    setConfirmExcluirDestino({ id, label });
  };

  const executeDeletePermanente = async (id: string, label: string) => {
    try {
      setDeletingId(id);
      setConfirmExcluirDestino(null);
      const res = await authenticatedFetch(`/api/v1/ministry/payment-destinations/${id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível excluir o destino.');
      }

      showModal('Sucesso', `Destino "${label}" excluído permanentemente com sucesso!`);
      loadDestinos();
    } catch (err: any) {
      showModal('Não é possível excluir', err.message || 'Falha ao excluir destino.', 'error');
    } finally {
      setDeletingId(null);
    }
  };



  // Métricas Computadas
  const totalArrecadadoGlobal = destinos.reduce((acc, d) => acc + (d.total_arrecadado ?? 0), 0);
  const destinosAtivosCount = destinos.filter((d) => d.is_ativo).length;
  const transacoesPagasCount = cobrancas.filter((c) => c.status === 'pago').length;

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

  // Faixa exibida na paginação
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

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
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinos Exibidos</p>
            <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{destinosAtivosCount} item(ns)</h3>
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
          Destinos & QR Codes ({totalCount})
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

      {/* ── 3. VISÃO TABELA DE DESTINOS COM PAGINAÇÃO ── */}
      {subAba === 'destinos' && (
        <div className="space-y-4">
          {/* Barra de Busca e Filtros de Destinos */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
            {/* Abas/Toggle de Status: Ativos x Inativos */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => handleStatusFiltroChange('ativo')}
                className={`px-4 py-1.5 rounded-lg font-bold transition text-xs ${
                  statusFiltro === 'ativo'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ativos
              </button>
              <button
                onClick={() => handleStatusFiltroChange('inativo')}
                className={`px-4 py-1.5 rounded-lg font-bold transition text-xs ${
                  statusFiltro === 'inativo'
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inativos
              </button>
            </div>

            {/* Input de Busca Textual */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={buscaTexto}
                onChange={(e) => handleBuscaChange(e.target.value)}
                placeholder="Buscar destino por nome ou congregação..."
                className="w-full text-xs outline-none bg-transparent text-slate-800 placeholder-slate-400 font-medium"
              />
            </div>

            {/* Selects de Filtros Adicionais */}
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
              <select
                value={tipoFiltro}
                onChange={(e) => handleTipoFiltroChange(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-semibold outline-none"
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
                value={congFiltro}
                onChange={(e) => handleCongFiltroChange(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-semibold outline-none"
              >
                <option value="">Todas as Congregações</option>
                {congregacoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabela Operacional de Destinos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingDestinos ? (
              <div className="p-12 text-center text-xs text-slate-400">
                Carregando destinos de arrecadação...
              </div>
            ) : destinos.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <QrCode className="h-12 w-12 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  {buscaTexto
                    ? 'Nenhum destino encontrado para a busca informada'
                    : statusFiltro === 'ativo'
                    ? 'Nenhum destino ativo cadastrado'
                    : 'Nenhum destino inativo encontrado'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {buscaTexto
                    ? 'Tente utilizar termos diferentes ou limpar o campo de pesquisa.'
                    : 'Crie links e QR Codes dinâmicos para dízimos, ofertas e eventos.'}
                </p>
                {statusFiltro === 'ativo' && !buscaTexto && (
                  <button
                    onClick={onOpenNovoDestino}
                    className="mt-2 px-4 py-2 bg-[#123b63] text-white text-xs font-bold rounded-xl"
                  >
                    + Criar Primeiro Destino
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Destino / Finalidade</th>
                      <th className="py-3.5 px-4">Congregação</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4 text-right">Total Arrecadado</th>
                      <th className="py-3.5 px-4 text-center">QR Pix</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {destinos.map((d) => {
                      const hasStaticPix = Boolean(d.pix_payload);

                      return (
                        <tr
                          key={d.id}
                          className={`hover:bg-slate-50/80 transition ${
                            !d.is_ativo ? 'bg-slate-50/50 text-slate-500' : ''
                          }`}
                        >
                          {/* Nome/Label do Destino */}
                          <td className="py-3.5 px-4">
                            <p className="font-extrabold text-slate-800 text-xs">{d.label}</p>
                            {d.descricao && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">{d.descricao}</p>
                            )}
                          </td>

                          {/* Congregação */}
                          <td className="py-3.5 px-4 text-slate-700 font-medium">
                            📍 {d.congregacoes?.nome ?? 'Sede / Todas as Congregações'}
                          </td>

                          {/* Tipo de Recebimento */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2.5 py-0.5 bg-[#123b63]/10 text-[#123b63] text-[10px] font-bold rounded-full uppercase tracking-wider">
                              {TIPO_LABELS[d.tipo_recebimento] ?? d.tipo_recebimento}
                            </span>
                          </td>

                          {/* Total Arrecadado */}
                          <td className="py-3.5 px-4 text-right font-extrabold text-slate-800">
                            {fmtBRL(d.total_arrecadado ?? 0)}
                          </td>

                          {/* QR Pix Indicator */}
                          <td className="py-3.5 px-4 text-center">
                            {hasStaticPix ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                                <QrCode className="h-3 w-3" /> Pix Estático
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md">
                                Web Link
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                d.is_ativo
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-200 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {d.is_ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>

                          {/* Ações Operacionais */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => onOpenQrModal(d)}
                                className="px-2.5 py-1.5 bg-[#123b63] hover:bg-[#1a4f85] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition"
                                title="Visualizar/Imprimir QR Code PIX"
                              >
                                <QrCode className="h-3.5 w-3.5 text-white" /> Ver QR Code PIX
                              </button>

                              {d.is_ativo ? (
                                <button
                                  disabled={deactivatingId === d.id || deletingId === d.id}
                                  onClick={() => handleToggleAtivo(d.id, d.is_ativo, hasStaticPix)}
                                  className="p-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Desativar destino"
                                >
                                  {deactivatingId === d.id ? (
                                    <Clock className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : (
                                <button
                                  disabled={deletingId === d.id || deactivatingId === d.id}
                                  onClick={() => handleDeletePermanente(d.id, d.label)}
                                  className="px-2 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg transition text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Excluir destino definitivamente"
                                >
                                  {deletingId === d.id ? (
                                    <Clock className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                  Excluir
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rodapé da Tabela com Controles de Paginação */}
            {totalCount > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div>
                  Exibindo <span className="font-bold text-slate-800">{startItem}–{endItem}</span> de{' '}
                  <span className="font-bold text-slate-800">{totalCount}</span> destinos
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1 || loadingDestinos}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Anterior
                  </button>

                  <span className="font-bold text-slate-700 px-2">
                    Página {page} de {totalPages}
                  </span>

                  <button
                    disabled={page >= totalPages || loadingDestinos}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
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

      {/* ── MODAL CUSTOMIZADO: CONFIRMAÇÃO DE DESATIVAÇÃO ── */}
      <ConfirmDeleteModal
        isOpen={!!confirmDesativarDestino}
        onClose={() => setConfirmDesativarDestino(null)}
        onConfirm={() =>
          confirmDesativarDestino && executeToggleAtivo(confirmDesativarDestino.id, true)
        }
        title="⚠️ Desativar Destino de Arrecadação"
        description={
          confirmDesativarDestino?.hasStaticPix
            ? 'Este destino possui um QR Code PIX ativo no ASAAS. Ao desativá-lo, o QR Code impresso anteriormente deixará de aceitar novos pagamentos.'
            : 'Deseja realmente desativar este destino de arrecadação?'
        }
        warningText="Você poderá reativar visualmente este destino mais tarde se necessário."
        confirmText="Sim, Desativar Destino"
      />

      {/* ── MODAL CUSTOMIZADO: CONFIRMAÇÃO DE EXCLUSÃO DEFINITIVA ── */}
      <ConfirmDeleteModal
        isOpen={!!confirmExcluirDestino}
        onClose={() => setConfirmExcluirDestino(null)}
        onConfirm={() =>
          confirmExcluirDestino &&
          executeDeletePermanente(confirmExcluirDestino.id, confirmExcluirDestino.label)
        }
        title={`🗑️ Excluir Destino "${confirmExcluirDestino?.label || ''}"?`}
        description="Este destino está inativo e seu QR Code PIX já foi removido no ASAAS. A exclusão é física, permanente e não pode ser desfeita."
        warningText="Apenas destinos sem histórico financeiro contábil associado poderão ser excluídos fisicamente."
        confirmText="Sim, Excluir Definitivamente"
      />
    </div>
  );
}
