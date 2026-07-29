'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useUserContext } from '@/hooks/useUserContext';

export interface MinistryData {
  id: string;
  name: string;
  nome?: string;
  sigla?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  telefone?: string | null;
  website?: string | null;
  address?: string | null;
  endereco?: string | null;
  city?: string | null;
  cidade?: string | null;
  state?: string | null;
  estado?: string | null;
  zip_code?: string | null;
  cep?: string | null;
  logo_url?: string | null;
  logotipo?: string | null;
  identidade_visual?: any;
  configuracao?: any;
  plan?: string | null;
  subscription_plan_id?: string | null;
  subscription_status?: string | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

interface CurrentMinistryContextType {
  ministry: MinistryData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CurrentMinistryContext = createContext<CurrentMinistryContextType>({
  ministry: null,
  isLoading: true,
  error: null,
  refresh: async () => {},
});

export function CurrentMinistryProvider({ children }: { children: React.ReactNode }) {
  const userCtx = useUserContext();
  const ministryId = userCtx.ministryId;
  const supabase = useMemo(() => createClient(), []);

  const [ministry, setMinistry] = useState<MinistryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMinistryData = useCallback(async (targetMinistryId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('ministries')
        .select('*')
        .eq('id', targetMinistryId)
        .maybeSingle();

      if (dbError) {
        console.error('[CurrentMinistryProvider] Erro ao buscar ministério:', dbError.message);
        setError(dbError.message);
        setMinistry(null);
      } else if (data) {
        // Garantir retrocompatibilidade de nomes de campos (nome / name, etc)
        const normalized: MinistryData = {
          ...data,
          nome: data.nome || data.name || 'Ministério Sem Nome',
          name: data.name || data.nome || 'Ministério Sem Nome',
          telefone: data.telefone || data.phone || null,
          phone: data.phone || data.telefone || null,
          endereco: data.endereco || data.address || null,
          address: data.address || data.endereco || null,
          cidade: data.cidade || data.city || null,
          city: data.city || data.cidade || null,
          estado: data.estado || data.state || null,
          state: data.state || data.estado || null,
          cep: data.cep || data.zip_code || null,
          zip_code: data.zip_code || data.cep || null,
          logotipo: data.logotipo || data.logo_url || null,
          logo_url: data.logo_url || data.logotipo || null,
        };
        setMinistry(normalized);
      } else {
        setMinistry(null);
      }
    } catch (err: any) {
      console.error('[CurrentMinistryProvider] Exceção inesperada:', err);
      setError(err?.message || 'Erro inesperado ao carregar dados do ministério');
      setMinistry(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (userCtx.loading) {
      setIsLoading(true);
      return;
    }

    if (!ministryId) {
      setMinistry(null);
      setIsLoading(false);
      return;
    }

    fetchMinistryData(ministryId);
  }, [userCtx.loading, ministryId, fetchMinistryData]);

  const refresh = useCallback(async () => {
    if (ministryId) {
      await fetchMinistryData(ministryId);
    }
  }, [ministryId, fetchMinistryData]);

  const value = useMemo(() => ({
    ministry,
    isLoading,
    error,
    refresh,
  }), [ministry, isLoading, error, refresh]);

  return (
    <CurrentMinistryContext.Provider value={value}>
      {children}
    </CurrentMinistryContext.Provider>
  );
}

export function useCurrentMinistry(): CurrentMinistryContextType {
  const context = useContext(CurrentMinistryContext);
  if (!context) {
    throw new Error('useCurrentMinistry deve ser utilizado dentro de um CurrentMinistryProvider');
  }
  return context;
}
