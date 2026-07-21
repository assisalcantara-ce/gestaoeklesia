import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { CrmService } from '@/lib/platform/crm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Validar autenticação
    const result = await requireAdmin(request);
    if (!result.ok) return result.response;
    const { supabaseAdmin } = result.ctx;

    // 2. Extrair parâmetros da query string (ministryId é opcional)
    const { searchParams } = new URL(request.url);
    const ministryId = searchParams.get('ministryId') || '';

    // 3. Instanciar CrmService e obter as atividades comerciais
    const crmService = new CrmService();
    const activities = await crmService.getActivities(supabaseAdmin, ministryId);

    // 4. Retornar JSON
    return NextResponse.json(activities);
  } catch (error: any) {
    console.error('[GET /api/v1/admin/crm/activities] Erro:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao buscar atividades do CRM' }, { status: 500 });
  }
}
