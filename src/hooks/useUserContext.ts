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
      console.log('[DEBUG_USER_CONTEXT] 1. fetchUserContext() iniciado');
      console.log('[DEBUG_USER_CONTEXT] 2. user.id:', user?.id || null);

      if (!user) {
        if (!cancelled) {
          console.log('[DEBUG_USER_CONTEXT] user is null, setNivel(null)');
          setNivel(null);
          setCongregacaoId(null);
          setSupervisaoId(null);
          setMinistryId(null);
          setUserId(null);
          console.log('[DEBUG_USER_CONTEXT] setLoading(false) sem user');
          setLoading(false);
        }
        lastFetchedUserId.current = null;
        return;
      }

      if (lastFetchedUserId.current === user.id) {
        console.log('[DEBUG_USER_CONTEXT] user.id ja processado:', user.id);
        if (!cancelled) {
          console.log('[DEBUG_USER_CONTEXT] setLoading(false) cache id');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        setUserId(user.id);

        // Busca perfil em ministry_users
        const { data: mu, error: muErr } = await supabase
          .from('ministry_users')
          .select('role, permissions, congregacao_id, supervisao_id, ministry_id')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('[DEBUG_USER_CONTEXT] 3. Resultado de mu:', mu, '| Error:', muErr);

        if (cancelled) return;

        if (mu) {
          const perms: string[] = Array.isArray(mu.permissions) ? mu.permissions : [];
          const nivelCalculado = resolveNivel(mu.role, perms);
          console.log('[DEBUG_USER_CONTEXT] 4. Resultado de resolveNivel(mu.role, perms):', nivelCalculado, '(role:', mu.role, '| perms:', perms, ')');
          console.log('[DEBUG_USER_CONTEXT] 5. Chamando setNivel():', nivelCalculado);
          setNivel(nivelCalculado);
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

          console.log('[DEBUG_USER_CONTEXT] 3b. Fallback ministry owner:', ministry);

          if (cancelled) return;

          if (ministry) {
            console.log('[DEBUG_USER_CONTEXT] 5. Chamando setNivel("administrador") via ministry owner');
            setNivel('administrador');
            setCongregacaoId(null);
            setSupervisaoId(null);
            setMinistryId(ministry.id);
          } else {
            console.log('[DEBUG_USER_CONTEXT] 5. Chamando setNivel(null) - nenhum registro em mu nem ministry');
            setNivel(null);
          }
        }

        lastFetchedUserId.current = user.id;
      } finally {
        if (!cancelled) {
          console.log('[DEBUG_USER_CONTEXT] 6. setLoading(false) finalizado');
          setLoading(false);
        }
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
