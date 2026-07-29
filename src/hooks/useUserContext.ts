'use client';

/**
 * useUserContext — hook centralizado de contexto do usuário
 *
 * Retorna: nivel, congregacao_id, ministry_id, isAdmin, podeAcessar(modulo), podeEscrever(modulo)
 * Utiliza exclusivamente a autenticação nativa do Supabase Auth.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useAuth } from '@/providers/AuthProvider';
import type { NivelAcesso } from '@/hooks/usePermissions';
import { temAcesso, temAcessoEscrita } from '@/hooks/usePermissions';
import { resolveNivel } from '@/lib/access-control';

export interface UserContext {
  loading: boolean;
  nivel: NivelAcesso | null;
  congregacaoId: string | null;
  supervisaoId: string | null;
  ministryId: string | null;
  userId: string | null;
  isAdmin: boolean;
  /** Verifica se o usuário tem acesso de leitura a um módulo */
  podeAcessar: (modulo: string) => boolean;
  /** Verifica se o usuário tem acesso de escrita a um módulo */
  podeEscrever: (modulo: string) => boolean;
}

export function useUserContext(): UserContext {
  const supabase = useMemo(() => createClient(), []);
  // AuthProvider já valida/renova o JWT — esperamos ele terminar antes de consultar o DB
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState<NivelAcesso | null>(null);
  const [congregacaoId, setCongregacaoId] = useState<string | null>(null);
  const [supervisaoId, setSupervisaoId] = useState<string | null>(null);
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    // Aguarda o AuthProvider terminar de validar o token
    if (authLoading) return;

    let cancelled = false;

    const fetchUserContext = async () => {
      if (!user) {
        if (!cancelled) {
          setNivel(null);
          setCongregacaoId(null);
          setSupervisaoId(null);
          setMinistryId(null);
          setUserId(null);
          setLoading(false);
        }
        lastFetchedUserId.current = null;
        return;
      }

      if (lastFetchedUserId.current === user.id) {
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(true);
      try {
        setUserId(user.id);

        // Busca perfil em ministry_users
        const { data: mu } = await supabase
          .from('ministry_users')
          .select('role, permissions, congregacao_id, supervisao_id, ministry_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (mu) {
          const perms: string[] = Array.isArray(mu.permissions) ? mu.permissions : [];
          setNivel(resolveNivel(mu.role, perms));
          setCongregacaoId(mu.congregacao_id ?? null);
          setSupervisaoId(mu.supervisao_id ?? null);
          setMinistryId(mu.ministry_id ?? null);
        } else {
          // Fallback: dono do ministry
          const { data: ministry } = await supabase
            .from('ministries')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (cancelled) return;

          if (ministry) {
            setNivel('administrador');
            setCongregacaoId(null);
            setSupervisaoId(null);
            setMinistryId(ministry.id);
          } else {
            setNivel(null);
          }
        }

        lastFetchedUserId.current = user.id;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUserContext();
    return () => { cancelled = true; };
  }, [user, authLoading, supabase]);

  const isAdmin = nivel === 'administrador';

  const podeAcessar = (modulo: string) =>
    nivel ? temAcesso(nivel, modulo) : false;

  const podeEscrever = (modulo: string) =>
    nivel ? temAcessoEscrita(nivel, modulo) : false;

  return { loading, nivel, congregacaoId, supervisaoId, ministryId, userId, isAdmin, podeAcessar, podeEscrever };
}
