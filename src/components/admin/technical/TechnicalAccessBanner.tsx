'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { authenticatedFetch } from '@/lib/api-client';

interface TechnicalGrantInfo {
  grantId: string;
  ministryName: string;
  adminName: string;
  reason: string;
  ticketReference?: string | null;
  startsAt: string;
  expiresAt: string;
}

export default function TechnicalAccessBanner() {
  const [grantInfo, setGrantInfo] = useState<TechnicalGrantInfo | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkTechnicalStatus() {
      try {
        const res = await authenticatedFetch('/api/v1/admin/technical-access/status', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;

        const data = await res.json();
        if (isMounted && data?.isTechnicalAccess && data?.grant) {
          setGrantInfo(data.grant);
        }
      } catch (err) {
        console.warn('[TechnicalAccessBanner] Falha ao consultar status de acesso técnico:', err);
      }
    }

    checkTechnicalStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!grantInfo) return null;

  const handleEndSession = async () => {
    if (isEnding) return;
    const confirmEnd = window.confirm('Deseja realmente encerrar este Atendimento Técnico?');
    if (!confirmEnd) return;

    setIsEnding(true);

    try {
      // 1. Chamar endpoint backend para finalizar concessão e desabilitar conta
      await authenticatedFetch('/api/v1/admin/technical-access/end', {
        method: 'POST',
      });
    } catch (err) {
      console.warn('[TechnicalAccessBanner] Aviso ao registrar término no backend:', err);
    } finally {
      // 2. Encerrar sessão nativa no Supabase Auth
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => null);

      // Limpar storages de sessão
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }

      // 3. REGRA OBRIGATÓRIA: NÃO retornar automaticamente ao painel do Super Admin.
      // O administrador deverá autenticar-se novamente com suas credenciais.
      window.location.href = '/admin/login';
    }
  };

  const formattedStartTime = grantInfo.startsAt
    ? new Date(grantInfo.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-blue-500/40 shadow-lg px-4 py-2.5 transition-all z-50 sticky top-0">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Lado Esquerdo: Identificação do Atendimento Técnico */}
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold uppercase tracking-wider text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded border border-blue-700/50">
              🛠️ Atendimento Técnico
            </span>

            <span className="font-semibold text-slate-100">
              {grantInfo.ministryName}
            </span>

            <span className="text-slate-400">|</span>

            <span className="text-slate-300">
              Solicitado por: <strong className="text-white">{grantInfo.adminName}</strong>
            </span>

            {formattedStartTime && (
              <>
                <span className="text-slate-400">|</span>
                <span className="text-slate-300">
                  Início: <span className="font-mono text-blue-200">{formattedStartTime}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Lado Central/Direito: Motivo do Atendimento & Ação */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="hidden lg:block max-w-md truncate text-slate-300 text-[11px]" title={grantInfo.reason}>
            Motivo: <span className="italic text-slate-200">"{grantInfo.reason}"</span>
          </div>

          <button
            onClick={handleEndSession}
            disabled={isEnding}
            className="px-3.5 py-1.5 bg-red-600/90 hover:bg-red-600 text-white font-semibold rounded-md shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 border border-red-500/40"
          >
            {isEnding ? (
              <>
                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                <span>Encerrando...</span>
              </>
            ) : (
              <>
                <span>🚪</span>
                <span>Encerrar Atendimento</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
