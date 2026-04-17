'use client';

/**
 * useUserContext — hook centralizado de contexto do usuário
 *
 * Retorna: nivel, congregacao_id, ministry_id, isAdmin, canWrite(modulo)
 * Depende do AuthProvider para ter o usuário já validado (token fresco),
 * evitando race conditions entre getSession (cache) e getUser (rede).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useAuth } from '@/providers/AuthProvider';
import type { NivelAcesso } from '@/hooks/usePermissions';
import { temAcesso, temAcessoEscrita } from '@/hooks/usePermissions';

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

// Mapeamento role/permission → NivelAcesso
function resolveNivel(role: string | null, permissions: string[]): NivelAcesso | null {
  if (!role && permissions.length === 0) return null;

  const roleNorm = (role ?? '').toLowerCase().trim();
  const permsUpper = permissions.map(p => (typeof p === 'string' ? p.toUpperCase() : ''));

  // Permissões explícitas têm prioridade sobre o role base
  if (permsUpper.includes('ADMINISTRADOR')) return 'administrador';
  if (permsUpper.includes('ADMIN_LOCAL'))   return 'admin_local';
  if (permsUpper.includes('FINANCEIRO_LOCAL')) return 'financeiro_local';
  if (permsUpper.includes('FINANCEIRO'))    return 'financeiro';
  if (permsUpper.includes('SUPERINTENDENTE')) return 'superintendente';
  if (permsUpper.includes('SUPERVISOR'))    return 'supervisor';
  if (permsUpper.includes('COORDENADOR'))   return 'coordenador';
  if (permsUpper.includes('OPERADOR'))      return 'operador';

  // Fallback pelo role base
  const map: Record<string, NivelAcesso> = {
    admin:            'administrador',
    administrador:    'administrador',
    manager:          'financeiro',     // manager sem permission → financeiro geral
    financeiro:       'financeiro',
    financeiro_local: 'financeiro_local',
    supervisor:       'supervisor',
    superintendente:  'superintendente',
    admin_local:      'admin_local',
    operador:         'operador',
    operator:         'operador',
    coordenador:      'coordenador',
    viewer:           'operador',
  };
  return map[roleNorm] ?? null;
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

  // Evita refetch desnecessário se o userId não mudou
  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    // Aguarda o AuthProvider terminar de validar o token
    if (authLoading) return;

    // Sem sessão válida → limpa estado
    if (!user) {
      setNivel(null);
      setCongregacaoId(null);
      setSupervisaoId(null);
      setMinistryId(null);
      setUserId(null);
      setLoading(false);
      lastFetchedUserId.current = null;
      return;
    }

    // Evita refetch se já carregou para este usuário
    if (lastFetchedUserId.current === user.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        setUserId(user.id);

        // Busca perfil em ministry_users (token garantidamente válido via AuthProvider)
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
          // Fallback: dono do ministry (registrado em ministries.user_id)
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
            // Usuário autenticado mas sem perfil no sistema
            setNivel(null);
          }
        }

        lastFetchedUserId.current = user.id;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => { cancelled = true; };
  }, [user, authLoading, supabase]);

  const isAdmin = nivel === 'administrador';

  const podeAcessar = (modulo: string) =>
    nivel ? temAcesso(nivel, modulo) : false;

  const podeEscrever = (modulo: string) =>
    nivel ? temAcessoEscrita(nivel, modulo) : false;

  return { loading, nivel, congregacaoId, supervisaoId, ministryId, userId, isAdmin, podeAcessar, podeEscrever };
}

