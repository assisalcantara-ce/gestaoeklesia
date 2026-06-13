'use client';

/**
 * MobileMemberProvider
 *
 * Context que gerencia estado de autenticação + dados do membro
 * para o App Mobile (/app/*).
 *
 * Lógica de roteamento:
 * - Não autenticado + rota protegida  → /app/login
 * - Autenticado + não vinculado       → /app/vincular
 * - Autenticado + vinculado + /app/*público → /app/inicio
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
import Image from 'next/image';
import { BRAND } from '@/config/brand';
import { GRADIENTS } from '@/config/tokens';
import { useAuth } from '@/providers/AuthProvider';
import { createClient } from '@/lib/supabase-client';

// Rotas acessíveis sem member vinculado
const PUBLIC_MOBILE_PATHS = ['/app/login', '/app/vincular'];

export interface MemberData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  celular: string | null;
  whatsapp: string | null;
  cpf: string; // mascarado
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
  refresh: () => Promise<void>;
}

const MobileMemberContext = createContext<MobileMemberContextType>({
  member: null,
  isLoading: true,
  isLinked: false,
  refresh: async () => {},
});

export function MobileMemberProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [member, setMember] = useState<MemberData | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const sbRef = useRef(createClient());

  // Busca os dados do membro autenticado via API
  const doFetch = useCallback(async (): Promise<void> => {
    const {
      data: { session },
    } = await sbRef.current.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMember(null);
      setIsLinked(false);
      return;
    }

    const res = await fetch('/api/v1/mobile/member/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (res.ok) {
      const data: MemberData = await res.json();
      setMember(data);
      setIsLinked(true);
    } else {
      setMember(null);
      setIsLinked(false);
    }
  }, []);

  // Re-executa quando o usuário muda (login/logout)
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setMember(null);
      setIsLinked(false);
      setInitialized(true);
      return;
    }

    setMemberLoading(true);
    doFetch()
      .catch(() => {
        setMember(null);
        setIsLinked(false);
      })
      .finally(() => {
        setMemberLoading(false);
        setInitialized(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Guard de roteamento
  useEffect(() => {
    if (authLoading || memberLoading || !initialized) return;

    const isPublic = PUBLIC_MOBILE_PATHS.some((p) => pathname === p);

    if (!user) {
      if (!isPublic) router.replace('/app/login');
    } else if (!isLinked) {
      if (pathname !== '/app/vincular') router.replace('/app/vincular');
    } else {
      // Vinculado: redirecionar de /app, /app/login, /app/vincular para /app/inicio
      if (pathname === '/app' || pathname === '/app/login' || pathname === '/app/vincular') {
        router.replace('/app/inicio');
      }
    }
  }, [initialized, authLoading, memberLoading, user, isLinked, pathname, router]);

  const refresh = useCallback(async () => {
    if (!user) return;
    await doFetch().catch(() => {});
  }, [user, doFetch]);

  const isLoading = authLoading || memberLoading || !initialized;
  const isPublic = PUBLIC_MOBILE_PATHS.some((p) => pathname === p) || pathname === '/app';

  return (
    <MobileMemberContext.Provider value={{ member, isLoading, isLinked, refresh }}>
      {isLoading && !isPublic ? (
        <div className="min-h-screen w-full flex items-center justify-center" style={{ background: GRADIENTS.APP_BACKGROUND }}>
          <div className="flex flex-col items-center gap-4">
            <Image
              src={BRAND.logoWhite}
              alt="Gestão Eklésia"
              width={280}
              height={80}
              priority
              sizes="280px"
              className="h-[80px] w-auto object-contain animate-pulse select-none"
            />
            <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden relative">
              <div className="w-1/2 h-full bg-[#5A9DDC] rounded-full absolute left-0 top-0 animate-[loading_1s_infinite_ease-in-out]"></div>
            </div>
            <style jsx>{`
              @keyframes loading {
                0% { left: -50%; }
                100% { left: 100%; }
              }
            `}</style>
          </div>
        </div>
      ) : (
        children
      )}
    </MobileMemberContext.Provider>
  );
}

export function useMobileMember() {
  return useContext(MobileMemberContext);
}
