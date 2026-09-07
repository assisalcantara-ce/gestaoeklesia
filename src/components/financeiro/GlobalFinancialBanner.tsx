'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useUserContext } from '@/hooks/useUserContext';
import { useCurrentMinistry } from '@/providers/CurrentMinistryProvider';
import { AlertTriangle, Clock, CreditCard, X } from 'lucide-react';

interface BillingInvoiceSummary {
  id: string;
  status: 'pending' | 'paid' | 'overdue' | 'canceled' | string;
  due_date: string | null;
  amount: number;
  asaas_invoice_url?: string | null;
}

export type BannerSeverity = 'warning' | 'overdue' | 'suspended';

export interface FinancialBannerState {
  severity: BannerSeverity;
  title: string;
  message: string;
  dueDateFormatted: string | null;
  amountFormatted: string | null;
  daysToDue?: number;
  daysOverdue?: number;
}

export default function GlobalFinancialBanner() {
  const pathname = usePathname();
  const userCtx = useUserContext();
  const { ministry, isLoading: ministryLoading } = useCurrentMinistry();
  const supabase = useMemo(() => createClient(), []);

  const [invoices, setInvoices] = useState<BillingInvoiceSummary[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Não exibir em rotas de checkout/trial expirado ou no painel superadmin puro
  const shouldSkipRoute = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/technical')) return true;
    if (pathname === '/trial-expirado' || pathname === '/login' || pathname === '/pre-cadastro') return true;
    return false;
  }, [pathname]);

  useEffect(() => {
    if (userCtx.loading || !userCtx.ministryId || shouldSkipRoute) {
      setInvoicesLoading(false);
      return;
    }

    let isMounted = true;

    async function loadTenantInvoices() {
      try {
        setInvoicesLoading(true);
        const { data, error } = await supabase
          .from('platform_billing_invoices')
          .select('id, status, due_date, amount, asaas_invoice_url')
          .eq('ministry_id', userCtx.ministryId)
          .in('status', ['pending', 'overdue', 'vencida', 'pendente']);

        if (error) {
          console.warn('[GlobalFinancialBanner] Falha ao consultar faturas do tenant:', error);
          if (isMounted) setInvoices([]);
          return;
        }

        if (isMounted) {
          setInvoices((data || []) as BillingInvoiceSummary[]);
        }
      } catch (err) {
        console.warn('[GlobalFinancialBanner] Erro ao carregar faturas:', err);
        if (isMounted) setInvoices([]);
      } finally {
        if (isMounted) setInvoicesLoading(false);
      }
    }

    loadTenantInvoices();

    return () => {
      isMounted = false;
    };
  }, [userCtx.loading, userCtx.ministryId, shouldSkipRoute, supabase]);

  // Resoluções de regras de negócio para definir qual tarja exibir
  const bannerState: FinancialBannerState | null = useMemo(() => {
    if (shouldSkipRoute || userCtx.loading || ministryLoading || invoicesLoading || dismissed) {
      return null;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. REGRA CRÍTICA / SUSPENSÃO DO TENANT
    const isSuspended =
      ministry?.is_active === false ||
      ministry?.subscription_status === 'suspended' ||
      ministry?.subscription_status === 'cancelled';

    if (isSuspended) {
      return {
        severity: 'suspended',
        title: 'Assinatura Suspensa / Inativa',
        message: 'A assinatura deste ministério está suspensa. Regularize o pagamento para restaurar o acesso completo.',
        dueDateFormatted: null,
        amountFormatted: null,
      };
    }

    // Identificar se há fatura vencida (status === 'overdue' ou data de vencimento anterior a hoje)
    const overdueInvoice = invoices.find((inv) => {
      const st = (inv.status || '').toLowerCase();
      if (st === 'overdue' || st === 'vencida') return true;
      if ((st === 'pending' || st === 'pendente') && inv.due_date) {
        return inv.due_date < todayStr;
      }
      return false;
    });

    if (overdueInvoice) {
      const dueDaysOverdue = overdueInvoice.due_date
        ? Math.max(1, Math.floor((now.getTime() - new Date(overdueInvoice.due_date).getTime()) / (1000 * 60 * 60 * 24)))
        : undefined;

      const valorFmt = overdueInvoice.amount
        ? `R$ ${Number(overdueInvoice.amount).toFixed(2).replace('.', ',')}`
        : null;

      return {
        severity: 'overdue',
        title: 'Fatura Vencida',
        message: 'Existe uma fatura vencida. Regularize sua assinatura para evitar a interrupção dos serviços.',
        dueDateFormatted: overdueInvoice.due_date ? new Date(overdueInvoice.due_date).toLocaleDateString('pt-BR') : null,
        amountFormatted: valorFmt,
        daysOverdue: dueDaysOverdue,
      };
    }

    // 2. REGRA FATURA PRÓXIMA DO VENCIMENTO (vencimento nos próximos 5 dias)
    const upcomingInvoice = invoices.find((inv) => {
      const st = (inv.status || '').toLowerCase();
      if ((st === 'pending' || st === 'pendente') && inv.due_date) {
        const dueDate = new Date(inv.due_date);
        const diffMs = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 5;
      }
      return false;
    });

    if (upcomingInvoice && upcomingInvoice.due_date) {
      const dueDate = new Date(upcomingInvoice.due_date);
      const diffMs = dueDate.getTime() - now.getTime();
      const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const valorFmt = upcomingInvoice.amount
        ? `R$ ${Number(upcomingInvoice.amount).toFixed(2).replace('.', ',')}`
        : null;

      const msgDias = diffDays === 0
        ? 'vence hoje'
        : diffDays === 1
        ? 'vence amanhã'
        : `vence em ${diffDays} dias`;

      return {
        severity: 'warning',
        title: 'Fatura Próxima do Vencimento',
        message: `Sua próxima fatura da plataforma ${msgDias}. Acesse as faturas para realizar o pagamento.`,
        dueDateFormatted: dueDate.toLocaleDateString('pt-BR'),
        amountFormatted: valorFmt,
        daysToDue: diffDays,
      };
    }

    return null;
  }, [shouldSkipRoute, userCtx.loading, ministryLoading, invoicesLoading, dismissed, ministry, invoices]);

  if (!bannerState) return null;

  // Estilização HSL/Tailwind de acordo com o nível de gravidade
  const stylesMap: Record<BannerSeverity, { bg: string; border: string; text: string; iconColor: string; buttonBg: string }> = {
    warning: {
      bg: 'bg-amber-500/15 backdrop-blur-md',
      border: 'border-amber-500/40',
      text: 'text-amber-950 dark:text-amber-100',
      iconColor: 'text-amber-600 dark:text-amber-400',
      buttonBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    },
    overdue: {
      bg: 'bg-orange-600/15 backdrop-blur-md',
      border: 'border-orange-500/50',
      text: 'text-orange-950 dark:text-orange-100',
      iconColor: 'text-orange-600 dark:text-orange-400',
      buttonBg: 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20',
    },
    suspended: {
      bg: 'bg-red-600/20 backdrop-blur-md',
      border: 'border-red-500/60',
      text: 'text-red-950 dark:text-red-100',
      iconColor: 'text-red-600 dark:text-red-400',
      buttonBg: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20',
    },
  };

  const currentStyle = stylesMap[bannerState.severity];

  return (
    <div
      className={`w-full border-b ${currentStyle.bg} ${currentStyle.border} px-4 py-2.5 shadow-sm transition-all duration-300 z-40 sticky top-0`}
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Lado Esquerdo: Ícone + Mensagem + Detalhes */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${currentStyle.iconColor} bg-white/40 dark:bg-black/20`}>
            {bannerState.severity === 'warning' ? (
              <Clock className="h-4 w-4 animate-pulse" />
            ) : (
              <AlertTriangle className="h-4 w-4 animate-bounce" />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
            <span className={`font-bold uppercase tracking-wider text-[11px] shrink-0 ${currentStyle.text}`}>
              {bannerState.title}:
            </span>

            <span className={`font-medium ${currentStyle.text} truncate`}>
              {bannerState.message}
            </span>

            {(bannerState.dueDateFormatted || bannerState.amountFormatted) && (
              <div className="flex items-center gap-2 text-[11px] font-semibold opacity-90 shrink-0">
                {bannerState.dueDateFormatted && (
                  <span className="bg-white/60 dark:bg-black/30 px-2 py-0.5 rounded border border-black/5">
                    Vencimento: {bannerState.dueDateFormatted}
                  </span>
                )}
                {bannerState.amountFormatted && (
                  <span className="bg-white/60 dark:bg-black/30 px-2 py-0.5 rounded border border-black/5">
                    Valor: {bannerState.amountFormatted}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Botão Ir para Faturas + Fechar temporariamente */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <Link
            href="/tesouraria?aba=faturas"
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 ${currentStyle.buttonBg}`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Ver Fatura</span>
          </Link>

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition"
            title="Ocultar aviso nesta sessão"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
