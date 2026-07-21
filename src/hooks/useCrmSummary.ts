'use client';

import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '@/lib/api-client';

export interface CrmSummaryData {
  totalLeads: number;
  totalTrials: number;
  totalClientesAtivos: number;
  totalRenovacoes: number;
  totalCobrancasPendentes: number;
  totalNegociacoes: number;
  totalCancelados: number;
}

export function useCrmSummary() {
  const [data, setData] = useState<CrmSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/v1/admin/crm/summary');
      if (!res.ok) {
        throw new Error(`Erro ao buscar resumo comercial do CRM: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(err?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    data,
    loading,
    error,
    refresh: fetchSummary
  };
}
