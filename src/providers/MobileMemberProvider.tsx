'use client';

/**
 * MobileMemberProvider
 *
 * Context central de autenticação e membro para o App Mobile (/app/*).
 *
 * Estados de Máquina Finitos:
 * - initializing: Verificando sessão de usuário inicial
 * - resolving_member: Sessão existe, consultando se o membro está vinculado ao tenant
 * - linked: Membro identificado e vinculado com sucesso
 * - unlinked: Usuário autenticado mas sem membro vinculado
 * - unauthenticated: Nenhum usuário autenticado
 *
 * Regras Estritas de Redirecionamento e Interface:
 * 1. Splash Screen: exibida EXCLUSIVAMENTE durante o boot inicial (isInitialBoot).
 * 2. Transições Internas: navegação direta e fluida entre abas sem jamais remontar a splash.
 * 3. Prevenção de Falso Unlinked: NUNCA redirecionar para /app/vincular enquanto a consulta de membro estiver em andamento (resolving_member).
 * 4. Após Login Válido: o método setAuthenticatedMember permite sincronização síncrona/imediata sem flashes intermediários.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { createClient } from '@/lib/supabase-client';
import MobileSplashScreen from '@/components/mobile/MobileSplashScreen';

export type MobileAuthState =
  | 'initializing'
  | 'resolving_member'
  | 'linked'
  | 'unlinked'
  | 'unauthenticated';

const PUBLIC_MOBILE_PATHS = ['/app/login', '/app/vincular', '/app/auth/callback', '/app'];

export interface MemberData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  celular: string | null;
  whatsapp: string | null;
  cpf: string;
  foto_url: string | null;
  matricula: string | null;
  unique_id: string | null;
  status: string;
  tipo_cadastro: string | null;
  cargo_ministerial: string | null;
  congregacao_nome: string | null;
  ministerio_nome: string | null;
  ministerio_logo: string | null;
  endereco: {
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    complemento: string | null;
    cidade: string | null;
    estado: string | null;
  };
}

interface MobileMemberContextType {
  member: MemberData | null;
  isLoading: boolean;
  isLinked: boolean;
  authState: MobileAuthState;
  refresh: () => Promise<MemberData | null>;
  setAuthenticatedMember: (data: MemberData) => void;
}

const MobileMemberContext = createContext<MobileMemberContextType>({
  member: null,
  isLoading: true,
  isLinked: false,
  authState: 'initializing',
  refresh: async () => null,
  setAuthenticatedMember: () => {},
});

export function MobileMemberProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [member, setMember] = useState<MemberData | null>(null);
  const [authState, setAuthState] = useState<MobileAuthState>('initializing');
  const [isInitialBoot, setIsInitialBoot] = useState(true);

  const router = useRouter();
  const pathname = usePathname();
  const sbRef = useRef(createClient());

  // Busca os dados do membro autenticado via API
  const doFetch = useCallback(async (): Promise<MemberData | null> => {
    let token: string | undefined;
    try {
      const {
        data: { session },
      } = await sbRef.current.auth.getSession();
      token = session?.access_token;
    } catch {}

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/v1/mobile/member/me', {
      headers,
      credentials: 'include',
      cache: 'no-store',
    });

    if (res.ok) {
      const data: MemberData = await res.json();
      setMember(data);
      setAuthState('linked');
      return data;
    } else {
      setMember(null);
      setAuthState('unlinked');
      return null;
    }
  }, []);

  // Sincronização direta e instantânea no login
  const setAuthenticatedMember = useCallback((data: MemberData) => {
    setMember(data);
    setAuthState('linked');
    setIsInitialBoot(false);
  }, []);

  // Efeito reativo a mudanças do Supabase Auth (User)
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setMember(null);
      setAuthState('unauthenticated');
      setIsInitialBoot(false);
      return;
    }

    // Se já está com membro vinculado para este mesmo usuário, não reinicia busca
    if (authState === 'linked' && member) {
      setIsInitialBoot(false);
      return;
    }

    setAuthState('resolving_member');
    doFetch()
      .catch(() => {
        setMember(null);
        setAuthState('unlinked');
      })
      .finally(() => {
        setIsInitialBoot(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Guard de Roteamento Estrito
  useEffect(() => {
    // NUNCA tomar decisão de roteamento enquanto estiver inicializando ou resolvendo o membro
    if (authLoading || authState === 'initializing' || authState === 'resolving_member') {
      return;
    }

    const isPublic = PUBLIC_MOBILE_PATHS.some((p) => pathname === p);

    if (authState === 'unauthenticated') {
      if (!isPublic) {
        router.replace('/app/login');
      }
    } else if (authState === 'unlinked') {
      // Usuário autenticado mas sem vínculo confirmado
      if (pathname !== '/app/vincular') {
        router.replace('/app/vincular');
      }
    } else if (authState === 'linked') {
      // Usuário autenticado e com vínculo confirmado
      if (pathname === '/app' || pathname === '/app/login' || pathname === '/app/vincular') {
        router.replace('/app/inicio');
      }
    }
  }, [authState, authLoading, pathname, router]);

  const refresh = useCallback(async () => {
    setAuthState('resolving_member');
    try {
      return await doFetch();
    } catch {
      setMember(null);
      setAuthState('unlinked');
      return null;
    }
  }, [doFetch]);

  const isLoading = authLoading || authState === 'initializing' || authState === 'resolving_member';
  const isLinked = authState === 'linked';
  const isPublic = PUBLIC_MOBILE_PATHS.some((p) => pathname === p) || pathname === '/app';

  // REGRA CRÍTICA:
  // Splash Screen da família apenas no boot inicial (frio) do app para rotas protegidas
  const showSplash = isInitialBoot && isLoading && !isPublic;

  return (
    <MobileMemberContext.Provider
      value={{
        member,
        isLoading,
        isLinked,
        authState,
        refresh,
        setAuthenticatedMember,
      }}
    >
      {showSplash ? <MobileSplashScreen /> : children}
    </MobileMemberContext.Provider>
  );
}

export function useMobileMember() {
  return useContext(MobileMemberContext);
}
