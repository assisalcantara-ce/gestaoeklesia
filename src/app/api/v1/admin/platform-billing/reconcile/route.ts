import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { PlatformBillingReconciliationService } from '@/lib/platform';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const supabaseAdmin = auth.ctx.supabaseAdmin;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body opcional
    }

    const ministryId = body?.ministryId || body?.ministry_id || undefined;
    const limit = typeof body?.limit === 'number' ? body.limit : 100;

    const summary = await PlatformBillingReconciliationService.reconcileInvoices(
      supabaseAdmin,
      { ministryId, limit }
    );

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao reconciliar faturas com Asaas.' },
      { status: 500 }
    );
  }
}
