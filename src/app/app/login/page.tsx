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
import { Mail, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import Image from 'next/image';

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
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <Loader2 size={36} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Header brand */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-12 pb-8 w-full max-w-md mx-auto">
        <div className="mb-8 flex flex-col items-center text-center gap-3">
          <div className="p-3 bg-[#111827] rounded-2xl border border-slate-800/80 shadow-lg">
            <Image
              src="/brand/logo-white.png"
              alt="Gestão Eklésia"
              width={140}
              height={38}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Portal do Membro</h1>
            <p className="text-slate-400 text-xs mt-0.5">Acesso exclusivo para membros da igreja</p>
          </div>
        </div>

        {/* Card de Login */}
        <div className="w-full bg-[#111827] rounded-3xl border border-slate-800/80 shadow-2xl p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600" />

          {emailSent ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CheckCircle2 size={32} />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">Link enviado!</h2>
                <p className="text-slate-300 text-xs leading-relaxed mt-2">
                  Enviamos um link de acesso seguro para o e-mail:
                  <br />
                  <strong className="text-blue-400 font-semibold">{email}</strong>
                </p>
                <p className="text-slate-400 text-[11px] mt-3">
                  Abra seu aplicativo de e-mail e clique no link para entrar automaticamente.
                </p>
              </div>
              <button
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 active:scale-95 transition"
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-base font-bold text-white">Entrar com e-mail</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Digite seu e-mail cadastrado para receber um link de acesso instantâneo sem precisar de senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    E-mail do Membro
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#172033] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-900/50 px-3.5 py-2.5 rounded-xl">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Enviando link seguro...</span>
                    </>
                  ) : (
                    <>
                      <span>Receber link de acesso</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <p className="text-center text-slate-400 text-[11px] pb-6">
        © {new Date().getFullYear()} Gestão Eklésia • Aplicativo Oficial do Membro
      </p>
    </div>
  );
}
