'use client';

/**
 * PwaInstaller.tsx
 *
 * Registra o Service Worker e oferece banner discreto e dispensável de instalação do PWA.
 */

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Registro do Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] Erro ao registrar Service Worker:', err);
      });
    }

    // 2. Intercepta o evento beforeinstallprompt do Chrome/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Verifica se o usuário já dispensou nesta sessão
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!showBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-sm mx-auto bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-gray-100 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300">
      <div className="w-10 h-10 rounded-xl bg-dark-blue/10 flex items-center justify-center text-dark-blue shrink-0">
        <Smartphone size={22} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-900 leading-tight">Instalar Aplicativo</p>
        <p className="text-[11px] text-gray-500 truncate mt-0.5">
          Adicione o Eklésia à tela de início
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-dark-blue text-white text-xs font-bold rounded-lg shadow-sm hover:bg-dark-blue/90 active:scale-95 transition-all flex items-center gap-1"
        >
          <Download size={13} />
          <span>Instalar</span>
        </button>

        <button
          onClick={handleDismiss}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 active:scale-95 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
