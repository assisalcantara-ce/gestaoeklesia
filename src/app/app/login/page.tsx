'use client';

/**
 * /app/login — Login do membro via magic link (OTP)
 *
 * Fluxo:
 * 1. Usuário informa e-mail
 * 2. Supabase envia magic link
 * 3. Usuário clica no link → retorna para /app → MobileMemberProvider redireciona
 *
 * Se o usuário já tiver sessão, o MobileMemberProvider redireciona automaticamente.
 */

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, CheckCircle2, Church } from 'lucide-react';

export default function MobileLoginPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const sbRef = useRef(createClient());

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  // Se já autenticado, deixa o provider redirecionar
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/app');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await sbRef.current.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        setError('Não foi possível enviar o link. Verifique o e-mail e tente novamente.');
      } else {
        setEmailSent(true);
      }
    } catch {
      setError('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-blue">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-blue flex flex-col">
      {/* Header brand */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <Church size={36} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Gestão Eklesia</h1>
            <p className="text-white/60 text-sm mt-1">Portal do Membro</p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
          {emailSent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 size={48} className="text-green-500" />
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-800">Link enviado!</h2>
                <p className="text-gray-500 text-sm mt-2">
                  Verifique sua caixa de entrada em{' '}
                  <strong className="text-dark-blue">{email}</strong> e clique no
                  link para entrar.
                </p>
                <p className="text-gray-400 text-xs mt-3">
                  Não recebeu? Verifique a pasta de spam.
                </p>
              </div>
              <button
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                className="mt-2 text-sm text-dark-blue underline"
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-gray-800">Entrar</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Informe seu e-mail para receber um link de acesso.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dark-blue/30 focus:border-dark-blue transition"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-dark-blue text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-dark-blue/90 active:scale-[0.98] transition disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar link de acesso'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <p className="text-center text-white/30 text-xs pb-8">
        © {new Date().getFullYear()} Gestão Eklesia
      </p>
    </div>
  );
}
