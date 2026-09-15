'use client';

/**
 * OfflineBanner.tsx
 *
 * Exibe um alerta discreto no topo quando o dispositivo perde a conexão com a internet.
 */

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Detecta estado inicial
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-600 text-white text-[11px] font-bold px-4 py-2 flex items-center justify-center gap-2 z-50 sticky top-0 shadow-sm animate-in slide-in-from-top duration-200">
      <WifiOff size={14} className="shrink-0 animate-pulse" />
      <span>Você está sem conexão com a internet.</span>
    </div>
  );
}
