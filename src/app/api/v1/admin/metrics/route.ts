import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    // Obter métricas do banco
    const [
      { count: totalMinistries },
      { count: activeMinistries },
      { data: payments },
      { count: openTickets },
      { data: overdueTickets },
    ] = await Promise.all([
      supabase
        .from('ministries')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('ministries')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('payments')
        .select('amount')
        .eq('status', 'paid'),
      supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .lt('sla_minutes', 0),
    ]);

    // Calcular revenue
    const revenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    return NextResponse.json({
      totalMinistries: totalMinistries || 0,
      activeMinistries: activeMinistries || 0,
      revenue: revenue,
      pendingPayments: 0,
      openTickets: openTickets || 0,
      overdueSLA: overdueTickets?.length || 0,
    });
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    );
  }
}
