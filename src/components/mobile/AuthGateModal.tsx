'use client';

/**
 * AuthGateModal
 * 
 * Modal elegante e amigável que solicita identificação quando o usuário clica em recursos
 * protegidos (Minha Credencial, Meus Dados, Histórico Pessoal, Documentos Particulares, Financeiro).
 * Não bloqueia a navegação pública e direciona suavemente para identificação segura.
 */

import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck, ArrowRight, X, Smartphone, KeyRound } from 'lucide-react';

interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  slug: string;
  igrejaNome?: string;
}

export default function AuthGateModal({
  isOpen,
  onClose,
  featureName,
  slug,
  igrejaNome,
}: AuthGateModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleIrParaLogin = () => {
    // Redireciona para o login do app com retorno para esta igreja
    router.push(`/app/login?igreja=${encodeURIComponent(slug)}&returnTo=/igreja/${encodeURIComponent(slug)}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#0f172a] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-300 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-inner">
            <Lock size={28} />
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
            Área Pessoal Protegida
          </span>

          <h3 className="text-xl font-black text-white mb-2">
            Acesso a &ldquo;{featureName}&rdquo;
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Para proteger a privacidade dos seus dados pessoais, credencial oficial e histórico eclesiástico na{' '}
            <strong className="text-white">{igrejaNome || 'sua igreja'}</strong>, é necessário confirmar sua identificação.
          </p>

          <div className="w-full bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 mb-6 text-left space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>Autenticação rápida e segura</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <KeyRound size={16} className="text-blue-400 shrink-0" />
              <span>Acesso restrito apenas aos seus registros</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <Smartphone size={16} className="text-purple-400 shrink-0" />
              <span>Mantenha sua credencial digital sempre à mão</span>
            </div>
          </div>

          <div className="w-full space-y-2.5">
            <button
              type="button"
              onClick={handleIrParaLogin}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Identificar-me Agora</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition cursor-pointer"
            >
              Continuar Navegando na Igreja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
