'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { FileText } from 'lucide-react';

interface Fatura {
  id: string;
  plano_slug: string;
  valor: number;
  status: string;
  vencimento: string;
  period_start: string | null;
  period_end: string | null;
  asaas_invoice_url: string | null;
  data: string;
}

export default function FaturasContent() {
  const supabase = createClient();
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('TODAS');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const carregarFaturas = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const res = await fetch('/api/v1/invoices', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          console.error('Erro ao buscar faturas API status:', res.status);
          setFaturas([]);
          return;
        }

        const json = await res.json();
        const data = json.data || [];

        const faturasFormatadas = (data || []).map((inv: any) => ({
          id: inv.id,
          plano_slug: inv.plano_slug,
          valor: parseFloat(inv.amount),
          status: inv.status.toLowerCase(),
          vencimento: inv.due_date,
          period_start: inv.period_start,
          period_end: inv.period_end,
          asaas_invoice_url: inv.asaas_invoice_url ?? null,
          data: inv.created_at,
        }));

        setFaturas(faturasFormatadas);
      } catch (err) {
        console.error('Erro ao buscar faturas:', err);
        setFaturas([]);
      } finally {
        setLoading(false);
      }
    };

    carregarFaturas();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'paga':
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'overdue':
      case 'vencida':
      case 'vencido':
        return 'bg-red-100 text-red-800';
      case 'pending':
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
      case 'paga':
      case 'pago':
        return '✓ Pago';
      case 'overdue':
      case 'vencida':
      case 'vencido':
        return '✕ Vencido';
      case 'pending':
      case 'pendente':
        return '⏰ Pendente';
      default:
        return status;
    }
  };

  const faturasFiltered = filterStatus === 'TODAS'
    ? faturas
    : faturas.filter(f => {
        if (filterStatus === 'paga') return f.status === 'paid' || f.status === 'paga' || f.status === 'pago';
        if (filterStatus === 'vencida') return f.status === 'overdue' || f.status === 'vencida' || f.status === 'vencido';
        if (filterStatus === 'vencer') return f.status === 'pending' || f.status === 'pendente';
        return f.status === filterStatus.toLowerCase();
      });

  const totalPago = faturas.filter(f => f.status === 'paid' || f.status === 'paga' || f.status === 'pago').reduce((sum, f) => sum + f.valor, 0);
  const totalVencida = faturas.filter(f => f.status === 'overdue' || f.status === 'vencida' || f.status === 'vencido').reduce((sum, f) => sum + f.valor, 0);
  const totalVencer = faturas.filter(f => f.status === 'pending' || f.status === 'pendente').reduce((sum, f) => sum + f.valor, 0);

  const handleCopyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignora falhas de clipboard
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    if (dateStr.length <= 10) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <FileText className="h-6 w-6 text-[#123b63]" />
        <div>
          <h2 className="text-xl font-bold text-gray-800">Faturas do Ministério</h2>
          <p className="text-xs text-gray-500">Histórico e liquidação das faturas da assinatura da plataforma</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 mb-4">Carregando faturas...</p>
      ) : faturas.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-gray-700 font-semibold mb-1">Nenhuma fatura encontrada</p>
          <p className="text-sm text-gray-500">Quando houver faturas de assinatura lançadas, elas aparecerão aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-600 border border-slate-200">
              <p className="text-gray-500 text-xs font-bold mb-1 uppercase tracking-wider">FATURAS PAGAS</p>
              <p className="text-2xl font-bold text-green-600">R$ {totalPago.toFixed(2).replace('.', ',')}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-red-600 border border-slate-200">
              <p className="text-gray-500 text-xs font-bold mb-1 uppercase tracking-wider">FATURAS VENCIDAS</p>
              <p className="text-2xl font-bold text-red-600">R$ {totalVencida.toFixed(2).replace('.', ',')}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500 border border-slate-200">
              <p className="text-gray-500 text-xs font-bold mb-1 uppercase tracking-wider">FATURAS A VENCER</p>
              <p className="text-2xl font-bold text-amber-600">R$ {totalVencer.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {['TODAS', 'paga', 'vencida', 'vencer'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status === 'TODAS' ? 'TODAS' : status)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${filterStatus === (status === 'TODAS' ? 'TODAS' : status)
                  ? 'bg-[#123b63] text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-slate-200'
                  }`}
              >
                {status === 'TODAS' ? 'Todas' : status === 'paga' ? 'Pagas' : status === 'vencida' ? 'Vencidas' : 'A Vencer'}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="px-5 py-3">Plano</th>
                  <th className="px-5 py-3">Período</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3">Valor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {faturasFiltered.map((fatura) => (
                  <tr key={fatura.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3 font-bold text-gray-800">{fatura.plano_slug.toUpperCase()}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {fatura.period_start || fatura.period_end ? (
                        <span>
                          {formatDate(fatura.period_start)} até {formatDate(fatura.period_end)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{formatDate(fatura.vencimento)}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">R$ {fatura.valor.toFixed(2).replace('.', ',')}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(fatura.status)}`}>
                        {getStatusLabel(fatura.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {fatura.asaas_invoice_url ? (
                        <div className="flex items-center gap-3">
                          <a
                            href={fatura.asaas_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#123b63] hover:underline font-bold"
                          >
                            Abrir fatura
                          </a>
                          <button
                            onClick={() => fatura.asaas_invoice_url && handleCopyLink(fatura.asaas_invoice_url, fatura.id)}
                            className="text-gray-500 hover:text-gray-700 font-semibold"
                          >
                            {copiedId === fatura.id ? '✓ Copiado!' : 'Copiar link'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
