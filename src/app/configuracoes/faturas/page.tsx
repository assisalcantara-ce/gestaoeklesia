'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { ExternalLink, Copy, Check, Filter, RefreshCw, AlertCircle, FileText, Calendar } from 'lucide-react';

interface BillingInvoice {
  id: string;
  ministry_id: string;
  subscription_plan_id: string | null;
  plano_slug: string;
  status: string;
  amount: number;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  asaas_invoice_url: string | null;
  created_at: string;
}

export default function FaturasPage() {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const supabase = createClient();

  const resolveMinistryId = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const mu = await supabase
        .from('ministry_users')
        .select('ministry_id')
        .eq('user_id', user.id)
        .limit(1);

      const ministryIdFromMu = (mu.data as any)?.[0]?.ministry_id as string | undefined;
      if (ministryIdFromMu) return ministryIdFromMu;

      const m = await supabase.from('ministries').select('id').eq('user_id', user.id).limit(1);
      const ministryIdFromOwner = (m.data as any)?.[0]?.id as string | undefined;
      return ministryIdFromOwner || null;
    } catch {
      return null;
    }
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      const ministryId = await resolveMinistryId();
      if (!ministryId) {
        setError('Não foi possível identificar o seu ministério. Faça login novamente.');
        return;
      }

      let query = supabase
        .from('platform_billing_invoices')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error: qError } = await query;
      if (qError) throw qError;

      setInvoices(data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar as faturas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const handleCopyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignora falhas de clipboard
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'paid':
      case 'paga':
      case 'pago':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
            Pago
          </span>
        );
      case 'pending':
      case 'pendente':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
            Pendente
          </span>
        );
      case 'overdue':
      case 'vencida':
      case 'vencido':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">
            Vencido
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    // Se for formato AAAA-MM-DD
    if (dateStr.length <= 10) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex-1 overflow-auto bg-[#f8fafc]">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-950 flex items-center gap-2">
              <FileText className="text-teal-600 h-8 w-8" />
              Minhas Faturas de Assinatura
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Visualize seu histórico de faturas e acesse links de pagamento da sua assinatura.
            </p>
          </div>
          <button
            onClick={loadInvoices}
            disabled={loading}
            className="self-start md:self-auto p-2.5 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">
            <Filter className="h-4 w-4 text-teal-600" />
            Filtrar por Status:
          </div>
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'pending', label: 'Pendente' },
              { id: 'paid', label: 'Pago' },
              { id: 'overdue', label: 'Vencido' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                  statusFilter === st.id
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista/Tabela */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
              <p className="text-sm text-gray-500">Carregando histórico de faturas...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-20 text-gray-500 space-y-2">
              <p className="text-lg font-semibold text-gray-800">Nenhuma fatura encontrada</p>
              <p className="text-sm">Não há cobranças geradas para o seu ministério com o filtro selecionado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Plano</th>
                    <th className="px-6 py-4">Período</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Vencimento</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {inv.plano_slug.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {inv.period_start || inv.period_end ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(inv.period_start)} até {formatDate(inv.period_end)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {formatDate(inv.due_date)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {inv.asaas_invoice_url ? (
                            <>
                              <a
                                href={inv.asaas_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                              >
                                Abrir fatura
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                              <button
                                onClick={() => handleCopyLink(inv.asaas_invoice_url!, inv.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-300 shadow-sm transition"
                              >
                                {copiedId === inv.id ? (
                                  <>
                                    Copiado!
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                  </>
                                ) : (
                                  <>
                                    Copiar link
                                    <Copy className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Processando pagamento</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
