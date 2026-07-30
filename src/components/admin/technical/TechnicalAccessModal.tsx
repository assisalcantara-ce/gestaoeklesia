'use client';

import { useState, useEffect } from 'react';
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
  const [email, setEmail] = useState('');
  const [lastSignInAt, setLastSignInAt] = useState<string | null>(null);
  const [lastSignInIp, setLastSignInIp] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Estados para submodal de Reautenticação / Motivo
  const [showRevealConfirm, setShowRevealConfirm] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [reason, setReason] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carregar dados da credencial técnica ao abrir o modal
  useEffect(() => {
    if (isOpen && tenantId) {
      fetchCredentials();
    } else {
      resetState();
    }
  }, [isOpen, tenantId]);

  // Timer de 30 segundos para ocultar a senha automaticamente
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setRevealedPassword(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerSeconds]);

  const resetState = () => {
    setEmail('');
    setLastSignInAt(null);
    setLastSignInIp(null);
    setRevealedPassword(null);
    setTimerSeconds(0);
    setShowRevealConfirm(false);
    setShowRegenerateConfirm(false);
    setAdminPassword('');
    setReason('');
    setFeedbackMsg(null);
  };

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`/api/v1/admin/technical-access/credentials?tenantId=${tenantId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao carregar dados da conta técnica.');
      }

      setEmail(data.email);
      setLastSignInAt(data.lastSignInAt);
      setLastSignInIp(data.lastSignInIp);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Falha ao buscar credencial.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Reautenticar e Mostrar Senha
  const handleRevealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) {
      alert('Informe a sua senha de Super Admin.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      alert('Informe o motivo do acesso (mínimo 5 caracteres).');
      return;
    }

    setIsLoading(true);
    setFeedbackMsg(null);

    try {
      const res = await authenticatedFetch('/api/v1/admin/technical-access/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          adminPassword,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.plainTextPassword) {
        throw new Error(data.error || 'Falha na reautenticação.');
      }

      setRevealedPassword(data.plainTextPassword);
      setTimerSeconds(30);
      setShowRevealConfirm(false);
      setAdminPassword('');
      setReason('');
      setFeedbackMsg({ type: 'success', text: 'Senha descriptografada e visível por 30 segundos.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao revelar senha.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerar Senha
  const handleRegenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      alert('Informe o motivo da regeneração (mínimo 5 caracteres).');
      return;
    }

    setIsLoading(true);
    setFeedbackMsg(null);

    try {
      const res = await authenticatedFetch('/api/v1/admin/technical-access/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.newPassword) {
        throw new Error(data.error || 'Erro ao regenerar senha.');
      }

      setRevealedPassword(data.newPassword);
      setTimerSeconds(30);
      setShowRegenerateConfirm(false);
      setReason('');
      setFeedbackMsg({ type: 'success', text: 'Nova senha forte gerada e salva no Supabase Auth! Exibindo por 30s.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao regenerar senha.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Copiar E-mail
  const handleCopyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setFeedbackMsg({ type: 'success', text: 'E-mail técnico copiado para a área de transferência!' });
      
      // Registrar log de auditoria
      void authenticatedFetch('/api/v1/admin/technical-access/log-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          actionType: 'COPY_TECHNICAL_EMAIL',
          reason: 'Cópia de e-mail no painel',
        }),
      });
    } catch {
      alert('Não foi possível copiar o e-mail.');
    }
  };

  // Copiar Senha
  const handleCopyPassword = async () => {
    if (!revealedPassword) {
      alert('Por favor, clique em "Mostrar Senha" e reautentique para visualizar e copiar a senha.');
      return;
    }

    try {
      await navigator.clipboard.writeText(revealedPassword);
      setFeedbackMsg({ type: 'success', text: 'Senha copiada! Por segurança, a área de transferência será limpa em 60s.' });

      // Registrar log de auditoria
      void authenticatedFetch('/api/v1/admin/technical-access/log-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          actionType: 'COPY_TECHNICAL_PASSWORD',
          reason: 'Cópia de senha no painel',
        }),
      });

      // Limpar a área de transferência após 60 segundos por segurança
      setTimeout(() => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText('').catch(() => {});
        }
      }, 60000);
    } catch {
      alert('Não foi possível copiar a senha.');
    }
  };

  if (!isOpen) return null;

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Nenhum login registrado recente';
    const d = new Date(isoString);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🛠️</span>
            <div>
              <h3 className="text-xl font-bold">Acesso Técnico</h3>
              <p className="text-blue-100 text-sm mt-0.5">
                Atendimento ao tenant: <span className="font-semibold text-white">{tenantName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl font-bold p-1 rounded transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {feedbackMsg && (
            <div
              className={`p-3.5 rounded-lg text-xs font-semibold ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
              }`}
            >
              {feedbackMsg.text}
            </div>
          )}

          {/* Seção 1: E-mail Técnico */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              E-mail da Conta Técnica
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={email || 'Carregando...'}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-mono font-medium outline-none"
              />
              <button
                type="button"
                onClick={handleCopyEmail}
                disabled={!email || isLoading}
                className="px-3.5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>📋</span> Copiar E-mail
              </button>
            </div>
          </div>

          {/* Seção 2: Senha mascarada / Revelada */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Senha da Conta Técnica
              </label>
              {timerSeconds > 0 && (
                <span className="text-xs font-bold text-amber-600 animate-pulse">
                  Ocultando em {timerSeconds}s
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type={revealedPassword ? 'text' : 'password'}
                readOnly
                value={revealedPassword || '••••••••••••••••••••••••••••••••'}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-mono font-bold outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPassword}
                disabled={!revealedPassword || isLoading}
                className="px-3.5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>📋</span> Copiar Senha
              </button>
            </div>

            {/* Ações de Senha */}
            <div className="flex gap-2 pt-1">
              {!revealedPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowRevealConfirm(true);
                    setFeedbackMsg(null);
                  }}
                  disabled={isLoading}
                  className="flex-1 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <span>👁️</span> Mostrar Senha
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRevealedPassword(null);
                    setTimerSeconds(0);
                  }}
                  className="flex-1 py-2 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <span>🙈</span> Ocultar Senha
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowRegenerateConfirm(true);
                  setFeedbackMsg(null);
                }}
                disabled={isLoading}
                className="flex-1 py-2 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>🔄</span> Regenerar Senha
              </button>
            </div>
          </div>

          {/* Seção 3: Último Login da Conta Técnica */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <p className="font-bold text-slate-700 flex items-center gap-1.5">
              <span>🕒</span> Último Login da Conta Técnica:
            </p>
            <p className="text-slate-800 font-semibold">{formatDate(lastSignInAt)}</p>
            {lastSignInIp && (
              <p className="text-slate-500 text-[11px]">
                IP de Origem: <span className="font-mono text-slate-700">{lastSignInIp}</span>
              </p>
            )}
          </div>

          {/* Orientações de Acesso Seguro */}
          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-950 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5 text-indigo-900">
              <span>💡</span> Como Efetuar o Atendimento:
            </p>
            <p className="leading-relaxed">
              A equipe técnica deve acessar utilizando <strong>outro navegador ou uma janela anônima</strong> através da tela oficial de login (`/login`), preservando sua sessão atual de Super Admin.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Submodal 1: Confirmação de Reautenticação para Mostrar Senha */}
      {showRevealConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleRevealSubmit}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-2 text-blue-700 font-bold text-lg">
              <span>🔒</span> Reautenticação do Super Admin
            </div>
            <p className="text-xs text-slate-600">
              Para visualizar a senha da conta técnica em texto claro, confirme a sua senha administrativa de segurança e informe o motivo do suporte.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sua Senha de Super Admin <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Digite a sua senha de administrador..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo do Atendimento / Chamado <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Suporte no modulo de tesouraria chamado #4092..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRevealConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
              >
                {isLoading ? 'Confirmando...' : 'Confirmar e Descriptografar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Submodal 2: Confirmação de Regeneração de Senha */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleRegenerateSubmit}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-2 text-amber-700 font-bold text-lg">
              <span>🔄</span> Regenerar Senha Técnica
            </div>
            <p className="text-xs text-slate-600">
              Esta ação irá gerar uma nova senha de 32 caracteres, atualizar no Supabase Auth e revogar sessões ativas da conta técnica.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo da Regeneração <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Encerramento do atendimento do chamado #4092 por segurança..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50"
              >
                {isLoading ? 'Regenerando...' : 'Regenerar Senha'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
