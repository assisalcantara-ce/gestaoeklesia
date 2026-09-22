'use client';

/**
 * /app/login — Acesso Direto do Membro via CPF + Data de Nascimento
 *
 * Fluxo Direto:
 * 1. O membro informa CPF + Data de nascimento.
 * 2. POST /api/v1/mobile/auth/login (Autenticação server-side imediata).
 * 3. Validação segura do cadastro oficial, geração de sessão Supabase Auth e gravação de cookies SSR.
 * 4. Redirecionamento instantâneo para /app/inicio.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { formatCpf, formatData } from '@/lib/mascaras';
import { Loader2, AlertCircle, LogIn } from 'lucide-react';
import Image from 'next/image';

export default function MobileLoginPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Capturar mensagens de erro vindas de redirecionamentos de outras rotas
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        setError(err);
      }
    }
  }, []);

  // Se já autenticado, redireciona para a tela inicial
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/app/inicio');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('Informe um CPF válido com 11 dígitos.');
      return;
    }

    if (!dataNascimento || dataNascimento.length < 10) {
      setError('Informe sua data de nascimento completa no formato DD/MM/AAAA.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/mobile/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cpf: cleanCpf,
          data_nascimento: dataNascimento,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error ||
            'Não encontramos um cadastro ativo com os dados informados. Verifique o CPF e a data de nascimento.'
        );
        return;
      }

      // Sincronizar sessão no cliente Supabase se retornada
      if (data.session) {
        try {
          const supabase = createClient();
          await supabase.auth.setSession(data.session);
        } catch (sessionErr) {
          console.error('[MOBILE_LOGIN] Erro ao sincronizar sessão cliente:', sessionErr);
        }
      }

      // Redireciona diretamente para o início do aplicativo
      router.replace('/app/inicio');
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
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
    <div className="min-h-screen min-h-[100dvh] bg-[#0f172a] text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Header brand */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-5 py-4 sm:py-6 w-full max-w-md mx-auto">
        <div className="mb-4 sm:mb-6 flex flex-col items-center text-center gap-2 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-[#111827] rounded-2xl border border-slate-800/80 shadow-lg">
            <Image
              src="/brand/logo-white.png"
              alt="Gestão Eklésia"
              width={140}
              height={38}
              className="h-7 sm:h-8 w-auto object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Portal do Membro</h1>
            <p className="text-slate-400 text-xs mt-0.5">Acesso exclusivo para membros da igreja</p>
          </div>
        </div>

        {/* Card de Login */}
        <div className="w-full bg-[#111827] rounded-3xl border border-slate-800/80 shadow-2xl p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600" />

          <div className="mb-4 sm:mb-5">
            <h2 className="text-sm sm:text-base font-bold text-white">Acesse sua conta</h2>
            <p className="text-slate-400 text-xs mt-1">
              Informe seu CPF e data de nascimento cadastrados na sua igreja.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label
                htmlFor="cpf"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
              >
                CPF
              </label>
              <input
                id="cpf"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#172033] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition font-mono tracking-wide"
                required
              />
            </div>

            <div>
              <label
                htmlFor="dataNascimento"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
              >
                Data de nascimento
              </label>
              <input
                id="dataNascimento"
                type="text"
                inputMode="numeric"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(formatData(e.target.value))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#172033] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition font-mono tracking-wide"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs p-3 rounded-xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] sm:min-h-[46px] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Acessando...</span>
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <p className="text-center text-slate-400 text-[11px] pb-4 sm:pb-6 px-4 shrink-0">
        © {new Date().getFullYear()} Gestão Eklésia • Aplicativo Oficial do Membro
      </p>
    </div>
  );
}
