'use client';

/**
 * /app/login — Acesso Direto do Membro via CPF + Data de Nascimento
 *
 * Novo Background Oficial: /img/BG_acolhimento.png
 * - Ocupa 100% da viewport incluindo safe areas.
 * - background-size: cover, centralizado, proporção preservada.
 * - Card de login translúcido (glassmorphism) com excelente contraste e legibilidade.
 * - Posicionamento harmonioso que preserva os elementos centrais do background.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { formatCpf, formatData } from '@/lib/mascaras';
import { Loader2, AlertCircle, LogIn } from 'lucide-react';
import Image from 'next/image';

export default function MobileLoginPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { refresh, isLinked } = useMobileMember();
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

  // Se já autenticado e com cadastro de membro reconhecido, redireciona para a tela inicial
  useEffect(() => {
    if (!authLoading && user && isLinked) {
      router.replace('/app/inicio');
    }
  }, [user, authLoading, isLinked, router]);

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
          // Forçar atualização do MobileMemberContext para reconhecer o vínculo sem esperar
          await refresh();
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
      <div className="min-h-full flex-1 flex items-center justify-center bg-[#071D36]">
        <Loader2 size={36} className="text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full flex-1 w-full flex flex-col justify-between overflow-x-hidden select-none bg-[#071D36]">
      {/* ── BACKGROUND OFICIAL: BG_acolhimento.png ── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/img/BG_acolhimento.png"
          alt="Portal do Membro Gestão Eklésia"
          fill
          priority
          quality={90}
          className="object-cover object-center"
          sizes="(max-width: 430px) 100vw, 430px"
        />
        {/* Overlay escuro balanceado para garantir contraste sem esconder a família */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030e1d]/75 via-[#030e1d]/60 to-[#030e1d]/90" />
      </div>

      {/* ── CONTEÚDO PRINCIPAL (Z-INDEX 10) ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-between px-4 sm:px-5 py-6 w-full max-w-md mx-auto">
        {/* Cabeçalho Superior: Logomarca Oficial e Título */}
        <div className="pt-2 sm:pt-4 flex flex-col items-center text-center gap-2">
          <div className="p-2 sm:p-2.5 bg-black/35 backdrop-blur-md rounded-2xl border border-white/15 shadow-xl">
            <Image
              src="/icons/logob.png"
              alt="Gestão Eklésia"
              width={180}
              height={55}
              className="h-8 sm:h-9 w-auto object-contain drop-shadow"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight drop-shadow-md">
              Portal do Membro
            </h1>
            <p className="text-slate-200 text-xs mt-0.5 drop-shadow">
              Acesso exclusivo para membros da igreja
            </p>
          </div>
        </div>

        {/* Card de Formulário Translúcido (Glassmorphism de alto contraste) */}
        <div className="w-full my-auto py-2">
          <div className="w-full bg-[#0a1b32]/85 backdrop-blur-xl rounded-3xl border border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.55)] p-5 sm:p-6 relative overflow-hidden">
            {/* Faixa decorativa no topo do card */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-400 to-sky-400" />

            <div className="mb-4">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Acesse sua conta
              </h2>
              <p className="text-slate-300 text-xs mt-0.5">
                Informe seu CPF e data de nascimento cadastrados na igreja.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="cpf"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1"
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
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#051426]/90 border border-white/20 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition font-mono tracking-wide"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="dataNascimento"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1"
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
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[#051426]/90 border border-white/20 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition font-mono tracking-wide"
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-rose-950/70 border border-rose-600/60 text-rose-200 text-xs p-3 rounded-xl">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-300" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Acessando...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>Entrar no Aplicativo</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Rodapé institucional com copyright */}
        <p className="text-center text-slate-300/90 text-[11px] pb-2 px-4 shrink-0 drop-shadow">
          © {new Date().getFullYear()} Gestão Eklésia • Aplicativo Oficial do Membro
        </p>
      </div>
    </div>
  );
}
