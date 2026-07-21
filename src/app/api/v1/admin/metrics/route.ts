import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { CommercialService } from '@/lib/platform';

type MonthBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

const buildMonthBuckets = (monthsBack: number) => {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = monthsBack; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = start.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    buckets.push({ key, label, start, end });
  }
  return buckets;
};

const getMonthKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_view_analytics' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const buckets = buildMonthBuckets(5);
    const rangeStart = buckets[0]?.start;
    const rangeEnd = buckets[buckets.length - 1]?.end;

    // 1. Chamar o serviço de domínio Commercial para obter a listagem agregada e desduplicada
    const commercialService = new CommercialService();
    const commercialList = await commercialService.list(supabase);

    // 2. Obter as métricas analíticas auxiliares
    const [
      { count: totalMinistries },
      { data: payments },
      { count: openTickets },
      { data: overdueTickets },
      { count: totalTickets },
      { count: resolvedTickets },
      { count: waitingTickets },
      { count: highPriorityTickets },
      { data: ticketsByMonthRaw },
      { data: ministriesByMonthRaw },
    ] = await Promise.all([
      supabase.from('ministries').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('amount').eq('status', 'paid'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open').lt('sla_minutes', 0),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'waiting_customer'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('priority', ['high', 'urgent']),
      supabase.from('support_tickets').select('created_at').gte('created_at', rangeStart?.toISOString() || new Date(0).toISOString()).lt('created_at', rangeEnd?.toISOString() || new Date().toISOString()),
      supabase.from('ministries').select('created_at, updated_at, subscription_status, is_active').gte('created_at', rangeStart?.toISOString() || new Date(0).toISOString()).lt('created_at', rangeEnd?.toISOString() || new Date().toISOString()),
    ]);

    // 3. Contabilizar os status comerciais baseados no Lifecycle unificado do CommercialService
    let activeCount = 0;
    let trialCount = 0;
    let trialExpiringCount = 0;
    let trialExpiredCount = 0;
    let negotiationCount = 0;
    let paymentPendingCount = 0;
    let renewalCount = 0;
    let canceledCount = 0;

    commercialList.forEach(item => {
      const status = item.lifecycle.status;
      if (status === 'ACTIVE') activeCount++;
      else if (status === 'TRIAL') trialCount++;
      else if (status === 'TRIAL_EXPIRING') trialExpiringCount++;
      else if (status === 'TRIAL_EXPIRED') trialExpiredCount++;
      else if (status === 'NEGOTIATION') negotiationCount++;
      else if (status === 'PAYMENT_PENDING') paymentPendingCount++;
      else if (status === 'RENEWAL') renewalCount++;
      else if (status === 'CANCELED') canceledCount++;
    });

    // Calcular receita (legado)
    const revenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    const ticketsByMonthMap = new Map<string, number>();
    (ticketsByMonthRaw || []).forEach((row: any) => {
      const key = getMonthKey(row.created_at);
      if (!key) return;
      ticketsByMonthMap.set(key, (ticketsByMonthMap.get(key) || 0) + 1);
    });

    const deploymentsByMonthMap = new Map<string, { implantacoes: number; cancelamentos: number }>();
    buckets.forEach((bucket) => {
      deploymentsByMonthMap.set(bucket.key, { implantacoes: 0, cancelamentos: 0 });
    });

    (ministriesByMonthRaw || []).forEach((row: any) => {
      const createdKey = getMonthKey(row.created_at);
      if (createdKey && deploymentsByMonthMap.has(createdKey)) {
        deploymentsByMonthMap.get(createdKey)!.implantacoes += 1;
      }

      const isCancelled = row.subscription_status === 'cancelled' || row.is_active === false;
      if (isCancelled && row.updated_at) {
        const updatedKey = getMonthKey(row.updated_at);
        if (updatedKey && deploymentsByMonthMap.has(updatedKey)) {
          deploymentsByMonthMap.get(updatedKey)!.cancelamentos += 1;
        }
      }
    });

    const tickets_by_month = buckets.map((bucket) => ({
      month: bucket.label,
      value: ticketsByMonthMap.get(bucket.key) || 0,
    }));

    const deployments_by_month = buckets.map((bucket) => ({
      month: bucket.label,
      implantacoes: deploymentsByMonthMap.get(bucket.key)?.implantacoes || 0,
      cancelamentos: deploymentsByMonthMap.get(bucket.key)?.cancelamentos || 0,
    }));

    return NextResponse.json({
      // -- Métricas Legadas (Mantidas para compatibilidade com o front antigo) --
      total_ministries: totalMinistries || 0,
      active_ministries: activeCount + renewalCount,
      total_revenue_month: revenue,
      pending_payments: paymentPendingCount,
      total_open_tickets: openTickets || 0,
      tickets_overdue_sla: overdueTickets?.length || 0,
      storage_usage_percent: 0,
      user_growth_percent: 0,
      tickets_by_month,
      deployments_by_month,
      ticket_stats: {
        received: totalTickets || 0,
        resolved: resolvedTickets || 0,
        waiting: waitingTickets || 0,
        high_priority: highPriorityTickets || 0,
      },
      // -- NOVOS INDICADORES DE LIFECYCLE DO CRM COMERCIAL --
      crm_stats: {
        active: activeCount,
        trial: trialCount,
        trial_expiring: trialExpiringCount,
        trial_expired: trialExpiredCount,
        negotiation: negotiationCount,
        payment_pending: paymentPendingCount,
        renewal: renewalCount,
        canceled: canceledCount
      }
    });
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    );
  }
}
