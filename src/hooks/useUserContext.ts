'use client';

/**
 * useUserContext — hook centralizado de contexto do usuário
 *
 * Retorna: nivel, congregacao_id, ministry_id, isAdmin, canWrite(modulo)
 * Depende do AuthProvider para ter o usuário já validado (token fresco),
 * evitando race conditions entre getSession (cache) e getUser (rede).
 *
 * MECANISMO DE CACHE — CHAVE COMPOSTA
 * O cache usa a chave `${user.id}:${impToken ?? ''}` em vez de apenas `user.id`.
 * Isso garante que quando o Super Admin impersona ministérios diferentes, cada
 * token de impersonação produz uma chave distinta e força a revalidação completa
 * do contexto, mesmo que o user.id do Supabase Auth permaneça o mesmo.
 *
 * REGRA DE ISOLAMENTO
 * Quando um token de impersonação está presente no storage, o fluxo nativo do
 * Supabase (ministry_users por user.id) é completamente ignorado — independente
 * do resultado da chamada ao endpoint de status. Isso impede que o tenant da
 * IEADMI (Super Admin) vaze para sessões de impersonação em qualquer condição.
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

  // Chave de cache composta: `${user.id}:${impToken ?? ''}`.
  // Garante que impersonações de ministérios diferentes (mesmo user.id) forçam
  // revalidação completa do contexto e nunca reutilizam resultado em cache.
  const lastFetchedKey = useRef<string | null>(null);

  useEffect(() => {
    // Aguarda o AuthProvider terminar de validar o token
    if (authLoading) return;

    let cancelled = false;

    const checkAndFetchContext = async () => {
      // ── Leitura antecipada do token de impersonação ──────────────────────
      // Executada antes de qualquer ramificação para garantir que:
      //   1. O bloco de impersonação sempre use o token atual do storage.
      //   2. A chave de cache inclua o contexto do tenant impersonado.
      const impToken = typeof window !== 'undefined'
        ? (sessionStorage.getItem('eklesia_impersonation_token') || localStorage.getItem('eklesia_impersonation_token'))
        : null;

      // ── 1. VERIFICAÇÃO PRIORITÁRIA DE IMPERSONAÇÃO ───────────────────────
      // Nunca bloqueada por cache — executa toda vez que impToken está presente.
      // Isso garante que trocar de ministério impersonado revalida corretamente.
      if (impToken) {
        try {
          const statusRes = await fetch(`/api/v1/admin/impersonate/status?token=${encodeURIComponent(impToken)}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.valid && statusData.status === 'active' && statusData.tenant?.id) {
              if (!cancelled) {
                setUserId(statusData.session?.adminId || user?.id || 'impersonated-admin');
                setMinistryId(String(statusData.tenant.id));
                setNivel('administrador');
                setCongregacaoId(null);
                setSupervisaoId(null);
                setLoading(false);
              }
              return;
            }
          }
        } catch (err) {
          console.warn('Erro ao verificar status de impersonação em useUserContext:', err);
        }

        // ── REGRA DE ISOLAMENTO ────────────────────────────────────────────
        // Token presente mas validação falhou (expirado, revogado, erro de rede).
        // NÃO continuar para o fluxo nativo: isso evitaria que o user.id do
        // Super Admin resolvesse o tenant da IEADMI em sessões de impersonação.
        if (!cancelled) setLoading(false);
        return;
      }

      // ── 2. FLUXO NATIVO (sem token de impersonação ativo) ────────────────
      if (!user) {
        if (!cancelled) {
          setNivel(null);
          setCongregacaoId(null);
          setSupervisaoId(null);
          setMinistryId(null);
          setUserId(null);
          setLoading(false);
        }
        lastFetchedKey.current = null;
        return;
      }

      // Chave composta — inclui o impToken (null aqui, pois o bloco acima
      // já retornou quando impToken estava presente). O separador ':' garante
      // que uma execução futura COM impToken nunca colida com esta sem impToken.
      const cacheKey = `${user.id}:`;
      if (lastFetchedKey.current === cacheKey) {
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

        lastFetchedKey.current = cacheKey;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkAndFetchContext();
    return () => { cancelled = true; };
  }, [user, authLoading, supabase]);

  const isAdmin = nivel === 'administrador';

  const podeAcessar = (modulo: string) =>
    nivel ? temAcesso(nivel, modulo) : false;

  const podeEscrever = (modulo: string) =>
    nivel ? temAcessoEscrita(nivel, modulo) : false;

  return { loading, nivel, congregacaoId, supervisaoId, ministryId, userId, isAdmin, podeAcessar, podeEscrever };
}
