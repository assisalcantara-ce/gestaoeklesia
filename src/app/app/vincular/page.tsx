'use client';

/**
 * /app/vincular — Vinculação do usuário autenticado ao seu membro cadastrado
 *
 * Fluxo:
 * 1. Usuário informa CPF + data de nascimento
 * 2. POST /api/v1/mobile/auth/link-member com Bearer token
 * 3. Sucesso → refresh() no context → provider redireciona para /app/inicio
 */

import { useState, useRef } from 'react';
import { useMobileMember } from '@/providers/MobileMemberProvider';
import { useAuth } from '@/providers/AuthProvider';
import { createClient } from '@/lib/supabase-client';
import { formatCpf } from '@/lib/mascaras';
import MobileHeader from '@/components/mobile/MobileHeader';
import { Loader2, Link2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function VincularPage() {
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

    const {
      data: { session },
    } = await sbRef.current.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/mobile/auth/link-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cpf: cpf.replace(/\D/g, ''),
          data_nascimento: dataNascimento,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        await refresh();
        // O provider vai redirecionar automaticamente para /app/inicio
      } else {
        switch (data.error) {
          case 'MEMBER_NOT_FOUND':
            setError(
              'Não encontramos um cadastro com esses dados. Verifique o CPF e a data de nascimento.',
            );
            break;
          case 'ALREADY_LINKED':
            setError('Sua conta já está vinculada a um cadastro.');
            break;
          case 'ALREADY_LINKED_OTHER':
            setError(
              'Este cadastro já está vinculado a outra conta. Entre em contato com o suporte.',
            );
            break;
          default:
            setError(data.message || 'Não foi possível vincular. Tente novamente.');
        }
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MobileHeader title="Vincular Cadastro" />

      <div className="flex-1 flex flex-col px-6 pt-24 pb-10">
        {/* Ícone + Instrução */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 bg-dark-blue/10 rounded-2xl flex items-center justify-center">
            <Link2 size={28} className="text-dark-blue" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-800">Vinculação de Cadastro</h1>
            <p className="text-gray-500 text-sm mt-1 max-w-xs">
              Informe seus dados para conectar sua conta ao cadastro de membro da sua igreja.
            </p>
          </div>
        </div>

        {/* Card formulário */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 size={48} className="text-green-500" />
              <p className="text-gray-700 font-medium text-center">
                Cadastro vinculado com sucesso!
              </p>
              <p className="text-gray-400 text-sm text-center">
                Redirecionando para o início...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  CPF
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dark-blue/30 focus:border-dark-blue transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Data de nascimento
                </label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dark-blue/30 focus:border-dark-blue transition"
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs px-3 py-2.5 rounded-xl">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-dark-blue text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-dark-blue/90 active:scale-[0.98] transition disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Vincular meu cadastro'
                )}
              </button>
            </form>
          )}
        </div>

        {user && (
          <p className="text-center text-gray-400 text-xs mt-6">
            Conectado como: <span className="text-gray-600">{user.email}</span>
          </p>
        )}
      </div>
    </div>
  );
}
