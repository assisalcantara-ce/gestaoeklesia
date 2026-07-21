'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { 
  Play, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  RefreshCw,
  Sun,
  Moon,
  Sunset
} from 'lucide-react';
import { CrmNextActionData } from './CrmNextActions';

interface CrmMyDayCardProps {
  onStartDay?: (firstAction: CrmNextActionData) => void;
}

export default function CrmMyDayCard({ onStartDay }: CrmMyDayCardProps) {
  const router = useRouter();
  const [actions, setActions] = useState<CrmNextActionData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNextActions() {
      try {
        const res = await authenticatedFetch('/api/v1/admin/crm/next-actions');
        if (res.ok) {
          const data = await res.json();
          setActions(data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar resumo de "Meu Dia":', err);
      } finally {
        setLoading(false);
      }
    }

    fetchNextActions();
  }, []);

  // Calcular métricas derivadas das tarefas retornadas
  const totalAcoes = actions.length;
  const trialsExpirando = actions.filter(a => a.lifecycle?.status === 'TRIAL_EXPIRING' || a.lifecycle?.status === 'TRIAL').length;
  const cobrancasPendentes = actions.filter(a => a.lifecycle?.status === 'PAYMENT_PENDING').length;
  const renovacoesProximas = actions.filter(a => a.lifecycle?.status === 'RENEWAL').length;

  // Saudação contextual baseada na hora do dia
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) {
      return { texto: 'Bom dia!', icon: <Sun className="h-5 w-5 text-amber-400" /> };
    }
    if (hora >= 12 && hora < 18) {
      return { texto: 'Boa tarde!', icon: <Sunset className="h-5 w-5 text-amber-500" /> };
    }
    return { texto: 'Boa noite!', icon: <Moon className="h-5 w-5 text-indigo-400" /> };
  };

  const saudacao = getSaudacao();

  const handleStartMyDay = () => {
    if (actions.length === 0) {
      setToastMessage('Excelente! Não existem ações pendentes para hoje.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const firstAction = actions[0];
    if (onStartDay) {
      onStartDay(firstAction);
    } else if (firstAction.ministryId) {
      router.push(`/admin/ministerios?id=${encodeURIComponent(firstAction.ministryId)}`);
    } else {
      router.push('/admin/comercial/oportunidades');
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-xl animate-pulse space-y-3">
        <div className="h-6 w-48 bg-gray-900 rounded"></div>
        <div className="h-4 w-72 bg-gray-900 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-linear-to-r from-gray-950 via-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      
      {/* Toast de notificação amigável */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-20 bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Glow decorativo de fundo */}
      <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        
        {/* Lado Esquerdo: Saudação e Resumo do Dia */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {saudacao.icon}
            <h2 className="text-xl font-bold text-white tracking-tight">{saudacao.texto}</h2>
          </div>

          {totalAcoes > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-300 font-medium">
                Hoje você possui a seguinte fila de trabalho acumulada:
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 px-3 py-1.5 rounded-xl text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  <span className="font-bold text-white">{totalAcoes}</span>
                  <span className="text-gray-400">próximas ações</span>
                </div>

                <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 px-3 py-1.5 rounded-xl text-xs">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-bold text-white">{trialsExpirando}</span>
                  <span className="text-gray-400">trials expirando</span>
                </div>

                <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 px-3 py-1.5 rounded-xl text-xs">
                  <CreditCard className="h-3.5 w-3.5 text-rose-400" />
                  <span className="font-bold text-white">{cobrancasPendentes}</span>
                  <span className="text-gray-400">cobranças pendentes</span>
                </div>

                <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 px-3 py-1.5 rounded-xl text-xs">
                  <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                  <span className="font-bold text-white">{renovacoesProximas}</span>
                  <span className="text-gray-400">renovações próximas</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Excelente! Não existem ações pendentes para hoje.
            </p>
          )}
        </div>

        {/* Lado Direito: Botão Principal "▶ Começar meu dia" */}
        <div className="shrink-0 flex items-center">
          <button
            onClick={handleStartMyDay}
            className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 transition cursor-pointer flex items-center justify-center gap-2 group border border-blue-400/30"
          >
            <Play className="h-4 w-4 fill-white text-white group-hover:scale-110 transition" />
            <span>Começar meu dia</span>
          </button>
        </div>

      </div>
    </div>
  );
}
