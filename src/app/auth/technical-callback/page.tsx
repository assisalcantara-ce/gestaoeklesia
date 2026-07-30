'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function TechnicalCallbackPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [statusMessage, setStatusMessage] = useState('Autenticando sessão técnica de suporte...');

  useEffect(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    const supabase = supabaseRef.current;

    const handleTechnicalCallback = async () => {
      try {
        // 1. O createBrowserClient() do @supabase/ssr processa automaticamente o #access_token da URL
        // e persiste os cookies HTTP de sessão nativos no navegador.
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setStatusMessage('Sessão técnica confirmada. Redirecionando...');
          router.replace('/dashboard');
          return;
        }

        // 2. Se a sessão ainda não estiver montada imediatamente no estado, escuta a mudança de estado
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event: any, currentSession: any) => {
            if (currentSession || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
              setStatusMessage('Sessão técnica confirmada. Redirecionando...');
              subscription.unsubscribe();
              router.replace('/dashboard');
            }
          }
        );

        // Fallback limite de aguardo do processamento nativo do Supabase Auth Client
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            router.replace('/dashboard');
          } else {
            setStatusMessage('Falha ao autenticar sessão técnica. Redirecionando para a entrada...');
            setTimeout(() => router.replace('/login'), 1500);
          }
          subscription.unsubscribe();
        }, 2500);

      } catch (err) {
        console.error('[TechnicalCallback] Erro ao processar sessão técnica:', err);
        setStatusMessage('Erro de autenticação. Redirecionando para a entrada...');
        setTimeout(() => router.replace('/login'), 1500);
      }
    };

    handleTechnicalCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
        <div className="text-4xl animate-bounce">🛠️</div>
        <h2 className="text-xl font-bold text-white">🔒 Acesso Seguro</h2>
        <p className="text-sm text-slate-300 animate-pulse">{statusMessage}</p>
        <div className="flex justify-center pt-2">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    </div>
  );
}
