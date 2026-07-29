'use client';

export const dynamic = 'force-dynamic';

// ─── Eliminação da Race Condition de Bootstrap ──────────────────────────────
//
// PROBLEMA RAIZ:
// O token era armazenado apenas dentro de um useEffect, que executa DEPOIS
// que os Providers da árvore React (AuthProvider → useUserContext) já rodaram.
// O AuthProvider resolve a sessão Supabase da cache (milissegundos), tornando
// authLoading=false antes do useEffect desta página executar.
// O useUserContext, ao rodar, não encontrava o token no sessionStorage e
// caía no fallback nativo do Supabase, resolvendo o ministério do Super Admin
// (IEADMI) em vez do ministério impersonado.
//
// SOLUÇÃO ARQUITETURAL:
// Código executado no NÍVEL DO MÓDULO é síncrono e ocorre durante a
// inicialização do bundle JavaScript no browser — ANTES de qualquer montagem
// de componente React e ANTES de qualquer useEffect.
// Ao gravar o token aqui, garantimos que sessionStorage já esteja preenchido
// quando o useUserContext executar sua verificação prioritária de impersonação.
//
if (typeof window !== 'undefined') {
  try {
    const _params = new URLSearchParams(window.location.search);
    const _token = _params.get('token');
    if (_token) {
      sessionStorage.setItem('eklesia_impersonation_token', _token);
      sessionStorage.setItem('eklesia_impersonation_window', 'true');
      localStorage.setItem('eklesia_impersonation_token', _token);
    }
  } catch {
    // Tolerância a ambientes com restrição de acesso ao storage (iframe, modo privado extremo)
  }
}
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { BRAND } from '@/config/brand';

export default function ImpersonateBootstrapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');
  const [errorMessage, setErrorMessage] = useState('');
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Token de impersonação não fornecido.');
      return;
    }

    const bootstrapSession = async () => {
      try {
        // O token já foi gravado no storage a nível de módulo (acima).
        // As linhas abaixo são idempotentes e garantem consistência caso o
        // módulo tenha sido importado em contexto sem window (ex.: SSR parcial).
        sessionStorage.setItem('eklesia_impersonation_token', token);
        sessionStorage.setItem('eklesia_impersonation_window', 'true');
        localStorage.setItem('eklesia_impersonation_token', token);

        // Validar token no servidor via API de status
        const response = await fetch(`/api/v1/admin/impersonate/status?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok || !data.valid || data.status !== 'active') {
          throw new Error(data.error || 'Sessão de impersonação inválida ou expirada.');
        }

        setTenantName(data.tenant?.name || 'Ministério');
        setStatus('success');

        // Redirecionar para o Dashboard do tenant na nova aba
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1000);
      } catch (err: any) {
        // Limpar tokens com falha
        sessionStorage.removeItem('eklesia_impersonation_token');
        sessionStorage.removeItem('eklesia_impersonation_window');
        localStorage.removeItem('eklesia_impersonation_token');
        setStatus('error');
        setErrorMessage(err.message || 'Falha ao validar sessão de impersonação.');
      }
    };

    void bootstrapSession();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-2">
          <ShieldCheck className="w-10 h-10 text-blue-400" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-white">
            {BRAND.name} — Impersonação
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inicializando ambiente seguro de suporte ao tenant
          </p>
        </div>

        {status === 'validating' && (
          <div className="py-6 space-y-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              Validando credenciais e preparando contexto...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 space-y-3">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto font-bold text-lg">
              ✓
            </div>
            <p className="text-sm font-bold text-emerald-400">
              Sessão ativada para {tenantName}!
            </p>
            <p className="text-xs text-slate-400">
              Redirecionando para o painel principal...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 space-y-4">
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-400">
                Falha ao Acessar Tenant
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {errorMessage}
              </p>
            </div>
            <button
              onClick={() => window.close()}
              className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition"
            >
              Fechar Esta Aba
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
