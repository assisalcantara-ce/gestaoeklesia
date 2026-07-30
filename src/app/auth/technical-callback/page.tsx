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
    let isSubscribed = true;

    const verifyAndRedirect = async () => {
      if (!isSubscribed) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const { data: userData } = await supabase.auth.getUser();

      console.log('[TECHNICAL_CALLBACK] getSession():', sessionData?.session?.user?.id || null);
      console.log('[TECHNICAL_CALLBACK] getUser():', userData?.user?.id || null);

      if (sessionData?.session && userData?.user) {
        setStatusMessage('Sessão técnica confirmada. Redirecionando...');
        router.replace('/dashboard');
      }
    };

    // 1. Ouvir alterações de estado de autenticação (Processamento nativo do #access_token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        console.log('[TECHNICAL_CALLBACK] AuthStateChange event:', event, 'user:', session?.user?.id || null);

        if (session && session.user) {
          await verifyAndRedirect();
        }
      }
    );

    // 2. Verificar imediatamente se a sessão já está totalmente disponível
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        await verifyAndRedirect();
      }
    };

    void checkInitialSession();

    return () => {
      isSubscribed = false;
      subscription?.unsubscribe();
    };
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
