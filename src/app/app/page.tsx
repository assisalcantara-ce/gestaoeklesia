'use client';

/**
 * /app — root redirect
 * Ponto de entrada do App de Membros (/app):
 *
 * Regras Estritas de Redirecionamento:
 * 1. Inicializando / Resolvendo membro: aguarda conclusão sem saltos prematuros.
 * 2. Sem sessão (unauthenticated): direciona para a tela de login oficial (/app/login).
 * 3. Sessão válida e vinculada (linked): abre diretamente a dashboard (/app/inicio).
 * 4. Sessão ativa sem vínculo (ex: admin do ERP logado no navegador sem cadastro de membro):
 *    Direciona para a tela de login (/app/login), permitindo que faça o acesso como membro
 *    ou desloque de conta, em vez de jogá-lo forçadamente em /app/vincular.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AppRootPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { authState, isLinked, isLoading: memberLoading } = useMobileMember();
  const router = useRouter();

  useEffect(() => {
    // Nunca tomar decisão de roteamento enquanto a autenticação ou resolução do membro estiver pendente
    if (authLoading || memberLoading || authState === 'initializing' || authState === 'resolving_member') {
      return;
    }

    if (!user || authState === 'unauthenticated') {
      router.replace('/app/login');
    } else if (isLinked || authState === 'linked') {
      router.replace('/app/inicio');
    } else {
      // Usuário autenticado mas sem vínculo de membro (ex: operador do ERP acessando o link do app no computador)
      // Direciona para a tela de login personalizada (/app/login) onde há formulário de membro e opção de troca de conta
      router.replace('/app/login');
    }
  }, [user, isLinked, authState, authLoading, memberLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#071D36]">
      <Loader2 size={36} className="text-blue-400 animate-spin" />
    </div>
  );
}
