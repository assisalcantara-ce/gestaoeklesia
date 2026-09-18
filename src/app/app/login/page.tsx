'use client';

/**
 * /app/login — Login do membro via CPF + Data de Nascimento
 *
 * Novo Fluxo Simplificado:
 * 1. Usuário informa CPF + Data de nascimento
 * 2. POST /api/v1/mobile/auth/request-access (Server-side)
 * 3. Servidor localiza o membro ativo, gera Magic Link seguro e dispara via Resend
 * 4. Resposta genérica protege contra enumeração de CPFs
 * 5. Se não possuir e-mail cadastrado, orienta a procurar a Secretaria
 * 6. Usuário clica no link do e-mail → /app/auth/callback → /app/inicio ou /app/vincular
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { formatCpf, formatData } from '@/lib/mascaras';
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import Image from 'next/image';

export default function MobileLoginPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [error, setError] = useState('');

  // Capturar mensagens de erro vindas de redirecionamentos do callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        setError(err);
      }
    }
  }, []);

  // Se já autenticado, deixa o MobileMemberProvider redirecionar
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/app');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setWarningMessage('');
    setSuccessMessage('');

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('Informe um CPF válido com 11 dígitos.');
      return;
    }

    if (!dataNascimento || dataNascimento.length < 10) {
      setError('Informe uma data de nascimento válida (DD/MM/AAAA).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/mobile/auth/request-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: cleanCpf,
          data_nascimento: dataNascimento,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Não foi possível solicitar o acesso. Tente novamente.');
        return;
      }

      if (data.code === 'NO_EMAIL') {
        setWarningMessage(data.message || 'Seu cadastro não possui e-mail cadastrado. Por favor, procure a Secretaria da sua igreja.');
      } else {
        setSuccessMessage(data.message || 'Se os dados estiverem corretos e houver um e-mail cadastrado, enviaremos um link de acesso.');
        setSubmitted(true);
      }
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

          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CheckCircle2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-lg font-bold text-white">Solicitação enviada!</h2>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {successMessage}
                </p>
                <div className="p-3.5 rounded-xl bg-[#172033] border border-slate-800 text-left text-xs text-slate-400 space-y-1 mt-3">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
                    <span>Próximo passo:</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Abra seu aplicativo de e-mail e toque no botão <strong>“Entrar no Aplicativo”</strong> para acessar sua conta instantaneamente.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setCpf('');
                  setDataNascimento('');
                  setSuccessMessage('');
                  setError('');
                  setWarningMessage('');
                }}
                className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 active:scale-95 transition cursor-pointer"
              >
                Tentar novamente com outros dados
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-base font-bold text-white">Acesse seu aplicativo</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Informe seu CPF e data de nascimento para localizarmos seu cadastro e enviar seu link de acesso seguro.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="cpf"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
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
                    className="w-full px-4 py-3 bg-[#172033] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition font-mono tracking-wide"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="dataNascimento"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
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
                    className="w-full px-4 py-3 bg-[#172033] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition font-mono tracking-wide"
                    required
                  />
                </div>

                {warningMessage && (
                  <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs p-3.5 rounded-xl">
                    <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
                    <span>{warningMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs p-3.5 rounded-xl">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Verificando cadastro...</span>
                    </>
                  ) : (
                    <>
                      <span>Continuar</span>
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
