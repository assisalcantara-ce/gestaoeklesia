'use client';

/**
 * /app/vincular — Vinculação do usuário autenticado ao seu membro cadastrado
 *
 * Fluxo:
 * 1. Usuário informa CPF + data de nascimento
 * 2. POST /api/v1/mobile/auth/link-member (Bearer token + Cookies de sessão SSR)
 * 3. Sucesso → refresh() no context → provider redireciona para /app/inicio
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import { useAuth } from '@/providers/AuthProvider';
import { createClient } from '@/lib/supabase-client';
import { formatCpf, formatData } from '@/lib/mascaras';
import MobileHeader from '@/components/mobile/MobileHeader';
import { Loader2, Link2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function VincularPage() {
  const router = useRouter();
  const { refresh } = useMobileMember();
  const { user } = useAuth();
  const sbRef = useRef(createClient());

  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Obter access_token se disponível na sessão do cliente
    const {
      data: { session },
    } = await sbRef.current.auth.getSession();
    const token = session?.access_token;

    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/v1/mobile/auth/link-member', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          cpf: cpf.replace(/\D/g, ''),
          data_nascimento: dataNascimento,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        await refresh();
        setTimeout(() => {
          router.replace('/app/inicio');
        }, 1000);
      } else {
        const code = data.code || data.error;
        switch (code) {
          case 'UNAUTHORIZED':
            setError('Sessão expirada ou não encontrada. Por favor, solicite um novo link de acesso.');
            break;
          case 'MEMBER_NOT_FOUND':
            setError(
              'Não encontramos um cadastro ativo com esse CPF e data de nascimento. Verifique os dados informados.',
            );
            break;
          case 'ALREADY_LINKED':
            setError('Sua conta já está vinculada a um cadastro.');
            break;
          case 'ALREADY_LINKED_OTHER':
            setError(
              'Este cadastro de membro já está vinculado a outra conta. Entre em contato com a secretaria da sua igreja.',
            );
            break;
          case 'INVALID_CPF':
            setError('CPF inválido. Verifique os 11 dígitos informados.');
            break;
          case 'INVALID_DATE':
            setError('Data de nascimento inválida. Use o formato DD/MM/AAAA.');
            break;
          default:
            setError(
              typeof data.error === 'string' && data.error
                ? data.error
                : data.message || 'Não foi possível vincular seu cadastro. Tente novamente.',
            );
        }
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      <MobileHeader title="Vincular Cadastro" />

      <div className="flex-1 flex flex-col px-4 sm:px-6 pt-20 pb-10 w-full max-w-md mx-auto min-w-0">
        {/* Ícone + Instrução */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 bg-[#172033] border border-blue-500/30 rounded-2xl flex items-center justify-center shadow-inner shadow-blue-500/10">
            <Link2 size={30} className="text-blue-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-100">Vinculação de Cadastro</h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xs">
              Informe seus dados para conectar sua conta ao cadastro de membro da sua igreja.
            </p>
          </div>
        </div>

        {/* Card formulário */}
        <div className="bg-[#111827] rounded-2xl shadow-xl border border-slate-800 p-5 sm:p-6 relative overflow-hidden w-full min-w-0 box-border">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-600" />

          {success ? (
            <div className="flex flex-col items-center gap-4 py-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <div className="text-center space-y-1">
                <p className="text-slate-100 font-semibold">
                  Cadastro vinculado com sucesso!
                </p>
                <p className="text-slate-400 text-xs">
                  Redirecionando para o início do aplicativo...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 w-full min-w-0">
              <div className="w-full min-w-0">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  CPF
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="block w-full max-w-full min-w-0 min-h-[46px] px-4 py-3 bg-[#172033] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition box-border font-mono tracking-wide"
                  required
                />
              </div>

              <div className="w-full min-w-0">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Data de nascimento
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(formatData(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="block w-full max-w-full min-w-0 min-h-[46px] px-4 py-3 bg-[#172033] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition box-border font-mono tracking-wide"
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-3.5 py-3 rounded-xl">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Confirmando vinculação...</span>
                  </>
                ) : (
                  <>
                    <Link2 size={18} />
                    <span>Confirmar vinculação</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {user && (
          <div className="mt-6 bg-[#111827]/60 border border-slate-800/80 rounded-xl px-4 py-2.5 text-center text-xs text-slate-400 truncate max-w-full">
            Conectado como: <span className="text-slate-200 font-medium">{user.email}</span>
          </div>
        )}
      </div>
    </div>
  );
}
