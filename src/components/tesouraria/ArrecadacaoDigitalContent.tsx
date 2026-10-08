'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  QrCode,
  Plus,
  Trash2,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Printer,
  FileSpreadsheet,
  Settings,
  Sparkles,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/api-client';
import ConfirmDeleteModal from '@/components/tesouraria/modals/ConfirmDeleteModal';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

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
  const planFeatures = usePlanFeatures();
  const [subAba, setSubAba] = useState<'destinos' | 'extrato'>('destinos');
  const [destinos, setDestinos] = useState<PaymentDestino[]>([]);
  const [cobrancas, setCobrancas] = useState<FinCobrancaCharge[]>([]);
  const [summary, setSummary] = useState<{ totalArrecadado: number; transacoesPagas: number }>({
    totalArrecadado: 0,
    transacoesPagas: 0,
  });
  const [loadingDestinos, setLoadingDestinos] = useState(true);
  const [loadingCobrancas, setLoadingCobrancas] = useState(false);
  const [asaasStatus, setAsaasStatus] = useState<{ configured: boolean; active: boolean; loading: boolean }>({
    configured: false,
    active: false,
    loading: true,
  });

  // Filtros de busca e status para Destinos
  const [statusFiltro, setStatusFiltro] = useState<'ativo' | 'inativo'>('ativo');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [congFiltro, setCongFiltro] = useState('');

  const [allDestinos, setAllDestinos] = useState<{ id: string; label: string; congregacao_id?: string | null }[]>([]);

  // Filtros da barra de Extrato de Ofertas PIX
  const now = new Date();
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [extratoMes, setExtratoMes] = useState<string>(defaultMes);
  const [extratoCong, setExtratoCong] = useState<string>('');
  const [extratoDestino, setExtratoDestino] = useState<string>('');
  const [extratoDataInicio, setExtratoDataInicio] = useState<string>('');
  const [extratoDataFim, setExtratoDataFim] = useState<string>('');
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

  // 1. Carregar status do gateway ASAAS / EFI
  useEffect(() => {
    authenticatedFetch('/api/v1/ministry/gateway')
      .then((res) => res.json())
      .then((json) => {
        const gw = (json.data ?? []).find(
          (g: any) =>
            (g.status === 'configured' || g.status === 'connected') &&
            g.is_active === true &&
            (g.has_credentials || !!g.encrypted_credentials)
        );
        setAsaasStatus({
          configured: !!gw,
          active: gw ? gw.is_active === true : false,
          loading: false,
        });
      })
      .catch(() => {
        setAsaasStatus({ configured: false, active: false, loading: false });
      });
  }, []);

  const isPlanoPermitido = planFeatures.loading || planFeatures.has_arrecadacao_digital || planFeatures.hasFeature('digital_collection');
  const isGatewayAtivo = asaasStatus.configured && asaasStatus.active;

  const handleCriarDestinoClick = () => {
    if (!isPlanoPermitido) {
      showModal(
        'Plano Não Compatível',
        'A arrecadação digital e criação de destinos PIX é um recurso disponível nos planos Intermediário e Profissional. Acesse Configurações > Plano para fazer upgrade.',
        'info'
      );
      return;
    }
    if (!isGatewayAtivo) {
      showModal(
        'Conta Digital Necessária',
        'Para criar destinos PIX e emitir QR Codes, você precisa integrar sua conta digital no módulo Configurações > Gateways de Pagamento (disponível nos planos Intermediário e Profissional).',
        'info'
      );
      return;
    }
    onOpenNovoDestino();
  };

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

  // Carregar todos os destinos do ministério para alimentar o filtro do Extrato
  useEffect(() => {
    authenticatedFetch('/api/v1/ministry/payment-destinations?pageSize=100')
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setAllDestinos(
            json.data.map((d: any) => ({
              id: d.id,
              label: d.label,
              congregacao_id: d.congregacao_id ?? null,
            }))
          );
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar lista de destinos para filtro:', err);
      });
  }, [destinosUpdatedKey]);

  // Handler para troca de congregação no Extrato com reset de destino inconsistente
  const handleExtratoCongChange = (novaCong: string) => {
    setExtratoCong(novaCong);
    if (extratoDestino) {
      const destAtual = allDestinos.find((d) => d.id === extratoDestino);
      if (destAtual) {
        if (novaCong === 'none' && destAtual.congregacao_id !== null) {
          setExtratoDestino('');
        } else if (novaCong !== '' && novaCong !== 'none' && destAtual.congregacao_id !== novaCong) {
          setExtratoDestino('');
        }
      }
    }
  };

  // 3. Carregar Cobranças / Extrato PIX via API autenticada segura
  const loadCobrancas = useCallback(async () => {
    try {
      setLoadingCobrancas(true);
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (extratoDataInicio) params.set('data_inicio', extratoDataInicio);
      if (extratoDataFim) params.set('data_fim', extratoDataFim);
      if (!extratoDataInicio && !extratoDataFim && extratoMes) params.set('mes', extratoMes);
      if (extratoCong) params.set('congregacao_id', extratoCong);
      if (extratoDestino) params.set('destination_id', extratoDestino);

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
  }, [extratoMes, extratoCong, extratoDestino, extratoDataInicio, extratoDataFim]);

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

  // Filtragem de Extrato (busca textual, tipo de movimento e período de datas)
  const cobrancasFiltradas = cobrancas.filter((c) => {
    // Filtro por tipo de movimento
    if (extratoTipoMovimento === 'saidas') {
      // Arrecadação PIX trata de entradas de ofertas
      return false;
    }

    // Filtro por período de datas (data efetiva da oferta / criação do PIX)
    const chargeDate = c.paid_at ? c.paid_at.split('T')[0] : c.created_at ? c.created_at.split('T')[0] : '';
    if (extratoDataInicio && chargeDate && chargeDate < extratoDataInicio) return false;
    if (extratoDataFim && chargeDate && chargeDate > extratoDataFim) return false;

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
      {/* ── 1. CABEÇALHO DA ABA ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold shadow-2xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Arrecadação Digital PIX</h2>
                {!isPlanoPermitido ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full">
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" /> Planos Intermediário e Profissional
                  </span>
                ) : isGatewayAtivo ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Gateway Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Conta Digital Não Configurada
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Gestão de destinos PIX, emissão de QR Codes dinâmicos e conciliação de ofertas em tempo real
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isPlanoPermitido ? (
            <Link
              href="/configuracoes?tab=plano"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" /> Fazer Upgrade de Plano
            </Link>
          ) : isGatewayAtivo ? (
            <button
              onClick={handleCriarDestinoClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold transition shadow-xs border border-teal-800 cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4 text-teal-100" /> Novo Destino PIX
            </button>
          ) : (
            <Link
              href="/configuracoes?tab=gateways"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold transition shadow-xs border border-teal-800 cursor-pointer whitespace-nowrap"
            >
              <Settings className="h-4 w-4 text-teal-100" /> Configurar Gateway
            </Link>
          )}
        </div>
      </div>

      {/* Aviso de Plano Não Compatível */}
      {!isPlanoPermitido && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-2xl border border-purple-200 shadow-2xs">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Recurso Disponível nos Planos Intermediário e Profissional</h4>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl font-medium">
                A criação de destinos PIX, emissão de QR Codes dinâmicos de ofertas e conciliação bancária automática estão disponíveis a partir do plano <strong>Intermediário</strong>. Faça o upgrade para desbloquear esta funcionalidade.
              </p>
            </div>
          </div>
          <Link
            href="/configuracoes?tab=plano"
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl whitespace-nowrap transition shadow-xs flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" /> Conhecer Planos
          </Link>
        </div>
      )}

      {/* Aviso de Gateway Não Configurado (para planos permitidos) */}
      {isPlanoPermitido && !isGatewayAtivo && !asaasStatus.loading && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl border border-amber-200 shadow-2xs">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">Conta Digital Não Configurada</h4>
              <p className="text-xs text-amber-800 mt-0.5 max-w-2xl font-medium">
                Para criar destinos de arrecadação PIX e emitir QR Codes de ofertas, é necessário integrar sua conta digital no módulo <strong>Configurações &gt; Gateways de Pagamento</strong> (disponível nos planos Intermediário e Profissional).
              </p>
            </div>
          </div>
          <Link
            href="/configuracoes?tab=gateways"
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl whitespace-nowrap transition shadow-xs flex items-center gap-1.5"
          >
            <Settings className="h-3.5 w-3.5" /> Configurar Gateway de Pagamento
          </Link>
        </div>
      )}

      {/* ── 2. CARDS DE MÉTRICAS (PADRÃO TESOURARIA) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Arrecadado PIX */}
        <div className="relative overflow-hidden rounded-3xl border border-[#bbf7d0] bg-[#f0fdf4] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-white shadow-xs border border-[#dcfce7]">
              <TrendingUp className="h-6 w-6 text-[#16a34a]" />
            </div>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#16a34a] shadow-2xs border border-[#bbf7d0]">
              PIX Recebido
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#15803d]">
              Total Arrecadado PIX
            </p>
            <p className="mt-1 text-2xl lg:text-3xl font-extrabold text-[#14532d] tracking-tight">
              {fmtBRL(totalArrecadadoCalculado)}
            </p>
            <p className="mt-1 text-xs text-[#16a34a]/90 font-medium">
              Ofertas e doações confirmadas
            </p>
          </div>
        </div>

        {/* Card 2: Destinos Cadastrados */}
        <div className="relative overflow-hidden rounded-3xl border border-teal-200 bg-teal-50/60 p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-white shadow-xs border border-teal-100">
              <QrCode className="h-6 w-6 text-teal-700" />
            </div>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-teal-700 shadow-2xs border border-teal-200">
              Destinos
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Destinos Cadastrados
            </p>
            <p className="mt-1 text-2xl lg:text-3xl font-extrabold text-teal-900 tracking-tight">
              {destinosAtivosCount} <span className="text-sm font-semibold text-teal-700">item(ns)</span>
            </p>
            <p className="mt-1 text-xs text-teal-700 font-medium">
              Pontos de arrecadação ativos
            </p>
          </div>
        </div>

        {/* Card 3: Ofertas Pagas */}
        <div className="relative overflow-hidden rounded-3xl border border-[#d0e6ff] bg-[#ebf5ff] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-white shadow-xs border border-[#dbeafe]">
              <CreditCard className="h-6 w-6 text-[#2563eb]" />
            </div>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#2563eb] shadow-2xs border border-[#bfdbfe]">
              Transações
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1d4ed8]">
              Ofertas Pagas
            </p>
            <p className="mt-1 text-2xl lg:text-3xl font-extrabold text-[#1e3a8a] tracking-tight">
              {transacoesPagasCount} <span className="text-sm font-semibold text-blue-700">transação(ões)</span>
            </p>
            <p className="mt-1 text-xs text-[#2563eb]/90 font-medium">
              Pagamentos liquidados via gateway
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. NAVEGAÇÃO DE SUB-ABAS (PADRÃO TESOURARIA) ── */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => setSubAba('destinos')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer select-none ${
            subAba === 'destinos'
              ? 'bg-teal-700 text-white shadow-md border border-teal-800 scale-[1.02]'
              : 'bg-white text-slate-700 border border-slate-300 shadow-xs hover:border-teal-600/50 hover:bg-teal-50/40 hover:text-teal-900 hover:shadow-sm'
          }`}
        >
          <QrCode className={`h-4 w-4 ${subAba === 'destinos' ? 'text-teal-100' : 'text-slate-500'}`} />
          Destinos & QR Codes ({totalCount})
        </button>
        <button
          onClick={() => setSubAba('extrato')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer select-none ${
            subAba === 'extrato'
              ? 'bg-teal-700 text-white shadow-md border border-teal-800 scale-[1.02]'
              : 'bg-white text-slate-700 border border-slate-300 shadow-xs hover:border-teal-600/50 hover:bg-teal-50/40 hover:text-teal-900 hover:shadow-sm'
          }`}
        >
          <CreditCard className={`h-4 w-4 ${subAba === 'extrato' ? 'text-teal-100' : 'text-slate-500'}`} />
          Extrato de Ofertas PIX
        </button>
      </div>

      {/* ── 4. CONTEÚDO DA SUB-ABA: DESTINOS ── */}
      {subAba === 'destinos' && (
        <div className="space-y-4">
          {/* Barra de Filtros de Destinos */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto border border-slate-200">
              <button
                onClick={() => handleStatusFiltroChange('ativo')}
                className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFiltro === 'ativo' ? 'bg-white text-teal-800 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ativos
              </button>
              <button
                onClick={() => handleStatusFiltroChange('inativo')}
                className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFiltro === 'inativo' ? 'bg-white text-slate-800 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Inativos
              </button>
            </div>

            <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar destino por nome ou congregação..."
                  value={buscaTexto}
                  onChange={(e) => handleBuscaChange(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition bg-white"
                />
              </div>

              <select
                value={tipoFiltro}
                onChange={(e) => handleTipoFiltroChange(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
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
                className="border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
              >
                <option value="">Todas as Congregações</option>
                <option value="none">Sem Congregação / Sem Vínculo</option>
                {congregacoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabela de Destinos */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            {loadingDestinos ? (
              <div className="p-16 text-center text-sm text-slate-400 font-medium">Carregando destinos PIX...</div>
            ) : destinos.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-400 space-y-3">
                {!isPlanoPermitido ? (
                  <>
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto border border-purple-100">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <p className="font-bold text-slate-700 text-base">Recurso Premium — Arrecadação Digital</p>
                    <p className="text-slate-500 max-w-md mx-auto text-xs">
                      A criação de destinos PIX e QR Codes está disponível nos planos <strong>Intermediário</strong> e <strong>Profissional</strong>.
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/configuracoes?tab=plano"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-xl hover:bg-teal-800 transition shadow-xs"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Fazer Upgrade de Plano
                      </Link>
                    </div>
                  </>
                ) : !isGatewayAtivo ? (
                  <>
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
                      <Settings className="h-6 w-6" />
                    </div>
                    <p className="font-bold text-slate-700 text-base">Integração de Conta Digital Pendente</p>
                    <p className="text-slate-500 max-w-md mx-auto text-xs">
                      Para criar pontos de recebimento PIX e gerar QR Codes para púlpitos ou eventos, integre sua conta digital no menu <strong>Configurações &gt; Gateways de Pagamento</strong> (disponível nos planos Intermediário e Profissional).
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/configuracoes?tab=gateways"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-xl hover:bg-teal-800 transition shadow-xs"
                      >
                        <Settings className="h-3.5 w-3.5" /> Ir para Configurações de Gateway
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <QrCode className="h-12 w-12 mx-auto text-slate-300 stroke-[1.5]" />
                    <p className="font-bold text-slate-700 text-base">Nenhum destino de arrecadação encontrado</p>
                    <p className="text-slate-400 text-xs">
                      {statusFiltro === 'ativo'
                        ? 'Clique no botão "Novo Destino PIX" acima para criar seu primeiro ponto de recebimento.'
                        : 'Não há destinos inativos cadastrados no momento.'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-100/90 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">Destino / Finalidade</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">Tipo</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">Congregação</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 text-right">Valor Padrão</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 text-right">Total Recebido</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 text-center">Status</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {destinos.map((d) => {
                      const hasStaticPix = Boolean(d.pix_qr_code_id || d.pix_payload);

                      return (
                        <tr key={d.id} className="hover:bg-slate-50/90 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900">{d.label}</div>
                            {d.descricao && (
                              <p className="text-xs text-slate-500 truncate max-w-xs">{d.descricao}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-xs bg-slate-100 text-slate-700 border border-slate-200">
                              {TIPO_LABELS[d.tipo_recebimento] ?? d.tipo_recebimento}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-medium">
                            {d.congregacoes?.nome ?? 'Sede / Todas'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-700">
                            {d.valor_fixo && d.valor_fixo > 0 ? fmtBRL(d.valor_fixo) : 'Livre (Aberto)'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-extrabold text-[#16a34a]">
                            {fmtBRL(d.total_arrecadado ?? 0)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {d.is_ativo ? (
                              <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                <XCircle className="h-3.5 w-3.5 text-slate-400" /> Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botão Ver QR Code */}
                              <button
                                onClick={() => onOpenQrModal(d)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition text-xs font-bold shadow-2xs border border-teal-800 cursor-pointer"
                                title="Visualizar QR Code PIX"
                              >
                                <QrCode className="h-3.5 w-3.5 text-teal-100" />
                                <span>QR Code</span>
                              </button>

                              {/* Ação Alternar Status (Ativar / Desativar / Excluir) */}
                              {d.is_ativo ? (
                                <button
                                  disabled={deactivatingId === d.id || deletingId === d.id}
                                  onClick={() => handleToggleAtivo(d.id, d.is_ativo, hasStaticPix)}
                                  className="p-1.5 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Desativar destino"
                                >
                                  {deactivatingId === d.id ? (
                                    <Clock className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </button>
                              ) : (
                                <button
                                  disabled={deletingId === d.id || deactivatingId === d.id}
                                  onClick={() => handleDeletePermanente(d.id, d.label)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl transition text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Excluir destino definitivamente"
                                >
                                  {deletingId === d.id ? (
                                    <Clock className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
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
              <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div>
                  Exibindo <span className="font-bold text-slate-800">{startItem}–{endItem}</span> de{' '}
                  <span className="font-bold text-slate-800">{totalCount}</span> destinos
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1 || loadingDestinos}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3.5 py-1.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                  >
                    Anterior
                  </button>

                  <span className="font-bold text-slate-700 px-2">
                    Página {page} de {totalPages}
                  </span>

                  <button
                    disabled={page >= totalPages || loadingDestinos}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3.5 py-1.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. VISÃO EXTRATO DE OFERTAS PIX ── */}
      {subAba === 'extrato' && (
        <div className="space-y-4">
          {/* Barra de Filtros com Estilo Idêntico ao Módulo Tesouraria / Relatórios */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
            <div className="flex flex-wrap items-end gap-3.5 flex-1 w-full">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Mês de Referência</label>
                <MonthPicker
                  value={extratoMes}
                  onChange={setExtratoMes}
                  className="h-[38px]"
                />
              </div>

              {congregacoes.length > 0 && !isFinanceiroLocal && (
                <div className="min-w-[170px]">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {nomenclaturas?.divisao1 || 'CONGREGAÇÃO'}
                  </label>
                  <select
                    value={extratoCong}
                    onChange={(e) => handleExtratoCongChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                  >
                    <option value="">Todas as Congregações</option>
                    <option value="none">Sem Congregação / Sem Vínculo</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="min-w-[180px]">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">QR CODE / DESTINO</label>
                <select
                  value={extratoDestino}
                  onChange={(e) => setExtratoDestino(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer max-w-[240px]"
                >
                  <option value="">Todos os QR Codes</option>
                  {allDestinos
                    .filter((d) => {
                      if (extratoCong === 'none') {
                        return d.congregacao_id === null;
                      }
                      if (extratoCong) {
                        return d.congregacao_id === extratoCong;
                      }
                      return true;
                    })
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                </select>
              </div>

              <div className="min-w-[160px]">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tipo de Movimento</label>
                <select
                  value={extratoTipoMovimento}
                  onChange={(e) => setExtratoTipoMovimento(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                >
                  <option value="entradas">Apenas Entradas</option>
                  <option value="ambos">Entradas e Saídas</option>
                  <option value="saidas">Apenas Saídas</option>
                </select>
              </div>

              {/* Data inicial */}
              <div className="w-36 shrink-0">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Data inicial</label>
                <input
                  type="date"
                  value={extratoDataInicio}
                  onChange={(e) => setExtratoDataInicio(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                />
              </div>

              {/* Data final */}
              <div className="w-36 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Data final</label>
                  {extratoDataInicio && extratoDataFim && extratoDataInicio > extratoDataFim && (
                    <span className="text-[10px] text-red-500 font-bold">Inválida</span>
                  )}
                </div>
                <input
                  type="date"
                  value={extratoDataFim}
                  onChange={(e) => setExtratoDataFim(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 h-[38px] focus:outline-none focus:ring-2 focus:ring-teal-600/20 transition ${
                    extratoDataInicio && extratoDataFim && extratoDataInicio > extratoDataFim
                      ? 'border-red-400 focus:border-red-500 bg-red-50/30'
                      : 'border-slate-300 focus:border-teal-600'
                  }`}
                  title={
                    extratoDataInicio && extratoDataFim && extratoDataInicio > extratoDataFim
                      ? 'Data final deve ser maior ou igual à data inicial'
                      : undefined
                  }
                />
              </div>

              <div>
                <button
                  onClick={() => {
                    setExtratoCong('');
                    setExtratoDestino('');
                    setExtratoTipoMovimento('entradas');
                    setExtratoMes(defaultMes);
                    setExtratoDataInicio('');
                    setExtratoDataFim('');
                    setBuscaExtrato('');
                  }}
                  disabled={
                    extratoCong === '' &&
                    extratoDestino === '' &&
                    extratoTipoMovimento === 'entradas' &&
                    extratoMes === defaultMes &&
                    extratoDataInicio === '' &&
                    extratoDataFim === '' &&
                    buscaExtrato === ''
                  }
                  className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-xl text-sm font-semibold transition h-[38px] cursor-pointer ${
                    extratoCong === '' &&
                    extratoDestino === '' &&
                    extratoTipoMovimento === 'entradas' &&
                    extratoMes === defaultMes &&
                    extratoDataInicio === '' &&
                    extratoDataFim === '' &&
                    buscaExtrato === ''
                      ? 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
                      : 'border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-2xs'
                  }`}
                >
                  Limpar Filtros
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end xl:self-end shrink-0">
              <button
                onClick={handleExportarExtratoCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:text-slate-900 transition h-[38px] cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="h-4 w-4 text-slate-500" /> Exportar CSV
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold transition h-[38px] cursor-pointer shadow-xs border border-teal-800"
              >
                <Printer className="h-4 w-4 text-teal-100" /> Imprimir
              </button>
            </div>
          </div>

          {/* Busca rápida textual */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3">
            <Search className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              value={buscaExtrato}
              onChange={(e) => setBuscaExtrato(e.target.value)}
              placeholder="Filtrar por nome do pagador, destino ou documento..."
              className="w-full text-sm outline-none bg-transparent text-slate-800 placeholder-slate-400 font-medium"
            />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            {loadingCobrancas ? (
              <div className="p-16 text-center text-sm text-slate-400 font-medium">Carregando extrato de ofertas PIX...</div>
            ) : cobrancasFiltradas.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-400 space-y-2">
                <CreditCard className="h-12 w-12 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="font-bold text-slate-700 text-base">Nenhuma oferta registrada no extrato</p>
                <p className="text-slate-400 text-xs">
                  As ofertas recebidas via PIX através dos QR Codes do ministério serão exibidas aqui.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-100/90 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">Data</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">Destino / Congregação</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">Pagador</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 text-right">Valor</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 text-center">Status</th>
                      <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-800 text-center">Lançamento Caixa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cobrancasFiltradas.map((c) => {
                      const badge = STATUS_BADGES[c.status] ?? STATUS_BADGES.pendente;
                      const StatusIcon = badge.icon;
                      const valor = c.valor_pago ?? c.valor_solicitado ?? 0;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/90 transition-colors">
                          <td className="px-4 py-3.5 text-slate-600 font-medium">
                            {fmtDate(c.created_at)}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900">
                              {c.fin_payment_destinations?.label ?? 'Destino Indefinido'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {c.fin_payment_destinations?.congregacoes?.nome ?? 'Sede / Todas'}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-slate-800">{c.payer_name || 'Anônimo / Não identificado'}</p>
                            {c.payer_document && <p className="text-xs text-slate-400 font-mono">{c.payer_document}</p>}
                          </td>
                          <td className="px-4 py-3.5 text-right font-extrabold text-[#16a34a]">
                            {fmtBRL(valor)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-full border ${badge.cls}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" /> {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {c.tesouraria_lancamento_id ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Conciliado
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-semibold">—</span>
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
                  {extratoCong === 'none'
                    ? 'Sem Congregação / Sem Vínculo'
                    : extratoCong
                    ? congregacoes.find((c) => c.id === extratoCong)?.nome ||
                      (congNome ? congNome(extratoCong) : 'Congregação Selecionada')
                    : 'Todas as Congregações / Unidades'}
                </span>
              </p>
              {extratoDestino && (
                <p>
                  QR Code / Destino:{' '}
                  <span className="font-bold text-gray-800">
                    {allDestinos.find((d) => d.id === extratoDestino)?.label || 'Destino Selecionado'}
                  </span>
                </p>
              )}
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
