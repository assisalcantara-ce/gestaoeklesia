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
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';
import ConfirmDeleteModal from '@/components/tesouraria/modals/ConfirmDeleteModal';

interface Congregacao { id: string; nome: string }

// Componente customizado para seleção de Mês e Ano de referência
function MonthPicker({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [anoStr, mesStr] = value.split('-');
  const ano = parseInt(anoStr || String(new Date().getFullYear()), 10);
  const mes = parseInt(mesStr || String(new Date().getMonth() + 1), 10);

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];

  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 8 }, (_, i) => anoAtual - 5 + i);

  const handleMesChange = (novoMes: number) => {
    onChange(`${anoStr}-${String(novoMes).padStart(2, '0')}`);
  };

  const handleAnoChange = (novoAno: number) => {
    onChange(`${novoAno}-${String(mes).padStart(2, '0')}`);
  };

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <select
        value={mes}
        onChange={(e) => handleMesChange(Number(e.target.value))}
        className="flex-1 min-w-[105px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#123b63] bg-white font-medium text-slate-700"
      >
        {meses.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        value={ano}
        onChange={(e) => handleAnoChange(Number(e.target.value))}
        className="w-[72px] border border-gray-200 rounded-lg px-1.5 py-1.5 text-xs focus:outline-none focus:border-[#123b63] bg-white font-medium text-slate-700"
      >
        {anos.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

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
  nomenclaturas?: { divisao1?: string };
  isFinanceiroLocal?: boolean;
  exportarCSV?: (dados: any[], filename: string) => void;
  ministerio?: {
    nome?: string;
    logo?: string | null;
    endereco?: string | null;
    cnpj?: string | null;
    telefone?: string | null;
    email?: string | null;
  } | null;
  congNome?: (id?: string | null) => string;
}

export default function ArrecadacaoDigitalContent({
  congregacoes,
  fmtBRL,
  fmtDate,
  showModal,
  onOpenNovoDestino,
  onOpenQrModal,
  destinosUpdatedKey,
  nomenclaturas,
  isFinanceiroLocal,
  exportarCSV,
  ministerio,
  congNome,
}: ArrecadacaoDigitalContentProps) {
  const [subAba, setSubAba] = useState<'destinos' | 'extrato'>('destinos');
  const [destinos, setDestinos] = useState<PaymentDestino[]>([]);
  const [cobrancas, setCobrancas] = useState<FinCobrancaCharge[]>([]);
  const [summary, setSummary] = useState<{ totalArrecadado: number; transacoesPagas: number }>({
    totalArrecadado: 0,
    transacoesPagas: 0,
  });
  const [loadingDestinos, setLoadingDestinos] = useState(true);
  const [loadingCobrancas, setLoadingCobrancas] = useState(false);
  const [asaasStatus, setAsaasStatus] = useState<{ configured: boolean; active: boolean }>({
    configured: false,
    active: false,
  });

  // Filtros de busca e status para Destinos
  const [statusFiltro, setStatusFiltro] = useState<'ativo' | 'inativo'>('ativo');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [congFiltro, setCongFiltro] = useState('');

  // Filtros da barra de Extrato de Ofertas PIX
  const now = new Date();
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [extratoMes, setExtratoMes] = useState<string>(defaultMes);
  const [extratoCong, setExtratoCong] = useState<string>('');
  const [extratoTipoMovimento, setExtratoTipoMovimento] = useState<'ambos' | 'entradas' | 'saidas'>('entradas');
  const [buscaExtrato, setBuscaExtrato] = useState('');

  // Estado de Paginação Backend para Destinos
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const handleStatusFiltroChange = (novoStatus: 'ativo' | 'inativo') => {
    setStatusFiltro(novoStatus);
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

  // 3. Carregar Cobranças / Extrato PIX via API autenticada segura
  const loadCobrancas = useCallback(async () => {
    try {
      setLoadingCobrancas(true);
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (extratoMes) params.set('mes', extratoMes);
      if (extratoCong) params.set('congregacao_id', extratoCong);

      const res = await authenticatedFetch(`/api/v1/ministry/payment-charges?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar extrato de ofertas.');
      const json = await res.json();

      const validCobrancas = (json.data ?? []).filter((c: any) => {
        const st = String(c.status || '').toLowerCase().trim();
        return st !== 'canceled' && st !== 'cancelado' && st !== 'cancelled' && st !== 'cancelada';
      });

      setCobrancas(validCobrancas);
      if (json.summary) {
        setSummary({
          totalArrecadado: Number(json.summary.totalArrecadado ?? 0),
          transacoesPagas: Number(json.summary.transacoesPagas ?? 0),
        });
      }
    } catch (err) {
      console.error('Erro ao carregar extrato de ofertas PIX:', err);
      setCobrancas([]);
    } finally {
      setLoadingCobrancas(false);
    }
  }, [extratoMes, extratoCong]);

  useEffect(() => {
    loadDestinos();
  }, [loadDestinos, destinosUpdatedKey]);

  useEffect(() => {
    loadCobrancas();
  }, [loadCobrancas, destinosUpdatedKey, subAba]);

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
  const totalArrecadadoCalculado = Math.max(
    summary.totalArrecadado,
    destinos.reduce((acc, d) => acc + (d.total_arrecadado ?? 0), 0)
  );
  const destinosAtivosCount = destinos.filter((d) => d.is_ativo).length;
  const transacoesPagasCount = Math.max(
    summary.transacoesPagas,
    cobrancas.filter((c) => {
      const st = String(c.status || '').toLowerCase().trim();
      return st === 'pago' || st === 'paid' || st === 'concluida' || st === 'received' || st === 'confirmed';
    }).length
  );

  // Filtragem de Extrato (busca textual e tipo de movimento)
  const cobrancasFiltradas = cobrancas.filter((c) => {
    // Filtro por tipo de movimento
    if (extratoTipoMovimento === 'saidas') {
      // Arrecadação PIX trata de entradas de ofertas
      return false;
    }

    if (!buscaExtrato) return true;
    const term = buscaExtrato.toLowerCase();
    const pagador = (c.payer_name ?? '').toLowerCase();
    const dest = (c.fin_payment_destinations?.label ?? '').toLowerCase();
    const doc = (c.payer_document ?? '').toLowerCase();
    const gwId = (c.gateway_charge_id ?? '').toLowerCase();
    const cong = (c.fin_payment_destinations?.congregacoes?.nome ?? '').toLowerCase();
    return (
      pagador.includes(term) ||
      dest.includes(term) ||
      doc.includes(term) ||
      gwId.includes(term) ||
      cong.includes(term)
    );
  });

  // Exportar Extrato para CSV
  const handleExportarExtratoCSV = () => {
    if (exportarCSV) {
      const csvData = cobrancasFiltradas.map((c) => ({
        'Data / Hora': fmtDate(c.created_at),
        'Destino PIX': c.fin_payment_destinations?.label ?? 'Destino Indefinido',
        'Congregação': c.fin_payment_destinations?.congregacoes?.nome ?? 'Sede / Todas',
        'Pagador / Doador': c.payer_name || 'Anônimo / Não identificado',
        'Documento': c.payer_document || '—',
        'Valor (R$)': Number(c.valor_pago ?? c.valor_solicitado ?? 0).toFixed(2),
        'Status': (STATUS_BADGES[c.status]?.label ?? c.status).toUpperCase(),
        'Conciliado Caixa': c.tesouraria_lancamento_id ? 'SIM' : 'NÃO',
        'ID Transação Gateway': c.gateway_charge_id || '—',
      }));
      exportarCSV(csvData, `extrato_ofertas_pix_${extratoMes}`);
    } else {
      // Fallback CSV download nativo
      if (cobrancasFiltradas.length === 0) return;
      const headers = ['Data', 'Destino', 'Congregação', 'Pagador', 'Documento', 'Valor', 'Status', 'Conciliado'];
      const rows = cobrancasFiltradas.map((c) => [
        fmtDate(c.created_at),
        `"${(c.fin_payment_destinations?.label ?? '').replace(/"/g, '""')}"`,
        `"${(c.fin_payment_destinations?.congregacoes?.nome ?? 'Sede / Todas').replace(/"/g, '""')}"`,
        `"${(c.payer_name || 'Anônimo').replace(/"/g, '""')}"`,
        c.payer_document || '',
        Number(c.valor_pago ?? c.valor_solicitado ?? 0).toFixed(2),
        STATUS_BADGES[c.status]?.label ?? c.status,
        c.tesouraria_lancamento_id ? 'Sim' : 'Não',
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `extrato_ofertas_pix_${extratoMes}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const TIPO_LABELS: Record<string, string> = {
    dizimo: 'Dízimo',
    oferta: 'Oferta',
    missoes: 'Missões',
    doacao: 'Oferta / Doação',
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
            Gerencie destinos de ofertas, gere QR Codes automáticos para púlpitos ou eventos e acompanhe as conciliações via PIX em tempo real.
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
            <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{fmtBRL(totalArrecadadoCalculado)}</h3>
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
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ofertas Pagas</p>
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
          Extrato de Ofertas PIX
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
                <option value="doacao">Oferta / Doação</option>
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

          {/* Tabela de Destinos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingDestinos ? (
              <div className="p-12 text-center text-xs text-slate-400">Carregando destinos PIX...</div>
            ) : destinos.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <QrCode className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="font-bold text-slate-600 text-sm">Nenhum destino de arrecadação encontrado</p>
                <p className="text-slate-400">
                  {statusFiltro === 'ativo'
                    ? 'Clique no botão "Novo Destino PIX" acima para criar seu primeiro ponto de recebimento.'
                    : 'Não há destinos inativos cadastrados no momento.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Destino / Finalidade</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Congregação</th>
                      <th className="py-3 px-4 text-right">Valor Padrão</th>
                      <th className="py-3 px-4 text-right">Total Recebido</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {destinos.map((d) => {
                      const hasStaticPix = Boolean(d.pix_qr_code_id || d.pix_payload);

                      return (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">{d.label}</div>
                            {d.descricao && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">{d.descricao}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] bg-slate-100 text-slate-700">
                              {TIPO_LABELS[d.tipo_recebimento] ?? d.tipo_recebimento}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {d.congregacoes?.nome ?? 'Sede / Todas'}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-700">
                            {d.valor_fixo && d.valor_fixo > 0 ? fmtBRL(d.valor_fixo) : 'Livre (Aberto)'}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-600">
                            {fmtBRL(d.total_arrecadado ?? 0)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {d.is_ativo ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                <XCircle className="h-3 w-3" /> Inativo
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botão Ver QR Code */}
                              <button
                                onClick={() => onOpenQrModal(d)}
                                className="px-2.5 py-1.5 bg-[#123b63] hover:bg-[#1a4f85] text-white rounded-lg transition text-[11px] font-bold flex items-center gap-1 shadow-sm"
                                title="Visualizar QR Code PIX"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                <span>QR Code</span>
                              </button>

                              {/* Ação Alternar Status (Ativar / Desativar / Excluir) */}
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

      {/* ── 4. VISÃO EXTRATO DE OFERTAS PIX ── */}
      {subAba === 'extrato' && (
        <div className="space-y-4">
          {/* Barra de Filtros com Estilo Idêntico ao Módulo Tesouraria / Relatórios */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mês de Referência</label>
                <MonthPicker
                  value={extratoMes}
                  onChange={setExtratoMes}
                  className="h-[36px]"
                />
              </div>

              {congregacoes.length > 0 && !isFinanceiroLocal && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {nomenclaturas?.divisao1 || 'CONGREGAÇÃO'}
                  </label>
                  <select
                    value={extratoCong}
                    onChange={(e) => setExtratoCong(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#123b63] h-[36px] bg-white font-medium text-slate-700"
                  >
                    <option value="">Todas as unidades</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de Movimento</label>
                <select
                  value={extratoTipoMovimento}
                  onChange={(e) => setExtratoTipoMovimento(e.target.value as any)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#123b63] h-[36px] bg-white font-medium text-slate-700"
                >
                  <option value="entradas">Apenas Entradas</option>
                  <option value="ambos">Entradas e Saídas</option>
                  <option value="saidas">Apenas Saídas</option>
                </select>
              </div>

              <div className="self-end">
                <button
                  onClick={() => {
                    setExtratoCong('');
                    setExtratoTipoMovimento('entradas');
                    setExtratoMes(defaultMes);
                    setBuscaExtrato('');
                  }}
                  disabled={extratoCong === '' && extratoTipoMovimento === 'entradas' && extratoMes === defaultMes && buscaExtrato === ''}
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-semibold transition h-[36px] ${
                    extratoCong === '' && extratoTipoMovimento === 'entradas' && extratoMes === defaultMes && buscaExtrato === ''
                      ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                      : 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                  }`}
                >
                  Limpar Filtros
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={handleExportarExtratoCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50 font-medium transition h-[36px]"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-600" /> Exportar CSV
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#123b63] text-white rounded-lg text-xs hover:bg-[#0f2a45] font-medium transition h-[36px]"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </button>
            </div>
          </div>

          {/* Busca rápida textual */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={buscaExtrato}
              onChange={(e) => setBuscaExtrato(e.target.value)}
              placeholder="Filtrar por nome do pagador, destino ou documento..."
              className="w-full text-xs outline-none bg-transparent text-slate-800 placeholder-slate-400 font-medium"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingCobrancas ? (
              <div className="p-12 text-center text-xs text-slate-400">Carregando extrato de ofertas PIX...</div>
            ) : cobrancasFiltradas.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-600 text-sm">Nenhuma oferta registrada no extrato</p>
                <p className="text-slate-400">
                  As ofertas recebidas via PIX através dos QR Codes do ministério serão exibidas aqui.
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

      {/* ── BLOCO EXCLUSIVO DE IMPRESSÃO: EXTRATO DE OFERTAS PIX ── */}
      {subAba === 'extrato' && (
        <div className="print-only hidden p-8 bg-white text-black space-y-6">
          {/* Timbre da Igreja */}
          <div className="flex items-center gap-5 border-b pb-4 border-gray-300">
            {ministerio?.logo ? (
              <img
                src={ministerio.logo}
                alt="Logo da Igreja"
                className="max-h-20 max-w-[120px] object-contain"
              />
            ) : (
              <div className="w-[100px] h-[100px] bg-gray-100 flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                Sem Logo
              </div>
            )}
            <div className="space-y-1">
              <h1 className="text-lg font-bold uppercase text-gray-800">
                {ministerio?.nome || 'Gestão Eklesia — Igreja Registrada'}
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                {ministerio?.endereco && `Endereço: ${ministerio.endereco}`}
              </p>
              <div className="flex gap-4 text-xs text-gray-500 font-medium">
                {ministerio?.cnpj && <span>CNPJ: {ministerio.cnpj}</span>}
                {ministerio?.telefone && <span>Telefone: {ministerio.telefone}</span>}
                {ministerio?.email && <span>E-mail: {ministerio.email}</span>}
              </div>
            </div>
          </div>

          {/* Título e Filtros Aplicados */}
          <div className="space-y-1">
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-700">
              Relatório / Extrato de Ofertas e Arrecadação PIX
            </h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 font-medium">
              <p>
                Mês de Referência: <span className="font-bold text-gray-800">{extratoMes}</span>
              </p>
              <p>
                Congregação:{' '}
                <span className="font-bold text-gray-800">
                  {extratoCong
                    ? congregacoes.find((c) => c.id === extratoCong)?.nome ||
                      (congNome ? congNome(extratoCong) : 'Congregação Selecionada')
                    : 'Todas as Congregações / Unidades'}
                </span>
              </p>
              <p>
                Tipo de Movimento:{' '}
                <span className="font-bold text-gray-800">
                  {extratoTipoMovimento === 'entradas'
                    ? 'Apenas Entradas'
                    : extratoTipoMovimento === 'saidas'
                    ? 'Apenas Saídas'
                    : 'Entradas e Saídas'}
                </span>
              </p>
              {buscaExtrato && (
                <p>
                  Busca Textual: <span className="font-bold text-gray-800">"{buscaExtrato}"</span>
                </p>
              )}
            </div>
          </div>

          {/* Tabela de Extrato de Ofertas Formato Impressão A4 */}
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="py-2.5 px-2 font-bold text-gray-600">Data</th>
                <th className="py-2.5 px-2 font-bold text-gray-600">Destino PIX</th>
                <th className="py-2.5 px-2 font-bold text-gray-600">Congregação</th>
                <th className="py-2.5 px-2 font-bold text-gray-600">Pagador / Doador</th>
                <th className="py-2.5 px-2 font-bold text-gray-600 text-center">Status</th>
                <th className="py-2.5 px-2 font-bold text-gray-600 text-center">Conciliado</th>
                <th className="py-2.5 px-2 font-bold text-gray-600 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {cobrancasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-gray-400">
                    Nenhuma oferta PIX registrada no período/filtros selecionados.
                  </td>
                </tr>
              ) : (
                cobrancasFiltradas.map((c) => {
                  const badge = STATUS_BADGES[c.status] ?? STATUS_BADGES.pendente;
                  const valor = c.valor_pago ?? c.valor_solicitado ?? 0;
                  return (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 text-gray-700">{fmtDate(c.created_at)}</td>
                      <td className="py-2 px-2 font-semibold text-gray-800">
                        {c.fin_payment_destinations?.label ?? 'Destino Indefinido'}
                      </td>
                      <td className="py-2 px-2 text-gray-600">
                        {c.fin_payment_destinations?.congregacoes?.nome ?? 'Sede / Todas'}
                      </td>
                      <td className="py-2 px-2 text-gray-700">
                        {c.payer_name || 'Anônimo / Não identificado'}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-gray-700 uppercase text-[10px]">
                        {badge.label}
                      </td>
                      <td className="py-2 px-2 text-center text-[10px]">
                        {c.tesouraria_lancamento_id ? 'Sim' : 'Não'}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-700">
                        {fmtBRL(valor)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-bold bg-gray-50 text-xs">
                <td colSpan={4} className="py-2.5 px-2 text-gray-700">
                  Total de Transações Exibidas: {cobrancasFiltradas.length} | Pagas:{' '}
                  {
                    cobrancasFiltradas.filter((c) => {
                      const st = String(c.status || '').toLowerCase();
                      return st === 'pago' || st === 'paid' || st === 'concluida' || st === 'received' || st === 'confirmed';
                    }).length
                  }
                </td>
                <td colSpan={2} className="py-2.5 px-2 text-right text-gray-700">
                  Total Arrecadado:
                </td>
                <td className="py-2.5 px-2 text-right text-emerald-800 font-extrabold text-sm">
                  {fmtBRL(
                    cobrancasFiltradas
                      .filter((c) => {
                        const st = String(c.status || '').toLowerCase();
                        return st === 'pago' || st === 'paid' || st === 'concluida' || st === 'received' || st === 'confirmed';
                      })
                      .reduce((acc, curr) => acc + (curr.valor_pago ?? curr.valor_solicitado ?? 0), 0)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
