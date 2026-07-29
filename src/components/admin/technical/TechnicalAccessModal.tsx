'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { authenticatedFetch } from '@/lib/api-client';

interface TechnicalAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
}

export default function TechnicalAccessModal({
  isOpen,
  onClose,
  tenantId,
  tenantName,
}: TechnicalAccessModalProps) {
  const [reason, setReason] = useState('');
  const [ticketReference, setTicketReference] = useState('');
  const [durationHours, setDurationHours] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      alert('Por favor, informe o motivo do atendimento (mínimo de 5 caracteres).');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Gerando acesso técnico nativo no Supabase Auth...');

    try {
      // 1. Chamar backend para criar/reativar usuário técnico e gerar Magic Link nativo
      const response = await authenticatedFetch('/api/v1/admin/technical-access/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          reason: reason.trim(),
          ticketReference: ticketReference.trim() || undefined,
          durationHours,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.redirectUrl) {
        throw new Error(data.error || 'Erro ao gerar acesso técnico.');
      }

      // 2. REGRA OBRIGATÓRIA DA ARQUITETURA:
      // Nunca existir duas sessões simultâneas no navegador.
      // Encerrar completamente a sessão do Super Admin ANTES de abrir a conta do cliente.
      setStatusMessage('Encerrando sessão administrativa com segurança...');
      
      const supabase = createClient();
      await supabase.auth.signOut();

      // Limpar storages de sessão local
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }

      setStatusMessage('Redirecionando para o Magic Link nativo do Supabase...');

      // 3. Redirecionar a janela para o Magic Link nativo do Supabase Auth
      // O Supabase irá autenticar a conta técnica com sessão nativa e direcionar para /dashboard
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      console.error('Erro no Acesso Técnico:', err);
      alert(err?.message || 'Ocorreu um erro ao iniciar o acesso técnico.');
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🛠️</span>
            <div>
              <h3 className="text-xl font-bold">Acesso Técnico Nativo</h3>
              <p className="text-blue-100 text-sm mt-0.5">
                Atendimento ao tenant: <span className="font-semibold text-white">{tenantName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Motivo do Atendimento <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva a razão do suporte ou chamado técnico (ex: Suporte no relatório financeiro ou chamado #4092)..."
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm text-slate-800 disabled:bg-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Nº do Chamado / Ticket (Opcional)
              </label>
              <input
                type="text"
                value={ticketReference}
                onChange={(e) => setTicketReference(e.target.value)}
                placeholder="Ex: TICKET-1049"
                disabled={isLoading}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm text-slate-800 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Duração da Sessão
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                disabled={isLoading}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm text-slate-800 disabled:bg-slate-100"
              >
                <option value={1}>1 hora</option>
                <option value={2}>2 horas</option>
                <option value={4}>4 horas</option>
              </select>
            </div>
          </div>

          {/* Banner explicativo de segurança nativa */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
            <p className="font-semibold text-blue-950 flex items-center gap-1.5">
              <span>🔒</span> Autenticação Nativa Supabase Auth:
            </p>
            <p>
              Ao confirmar, sua sessão de Administrador será <strong>encerrada com logout automático</strong> e o navegador autenticará diretamente a conta técnica permanente do tenant via Magic Link nativo.
            </p>
          </div>

          {statusMessage && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 text-center animate-pulse">
              {statusMessage}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 rounded-lg transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <span>🛠️ Iniciar Acesso Técnico</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
