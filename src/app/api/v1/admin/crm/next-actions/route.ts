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

    // 3. Instanciar CrmService e obter as próximas ações comerciais
    const crmService = new CrmService();
    const nextActions = await crmService.getNextActions(supabaseAdmin, ministryId);

    // 4. Retornar JSON
    return NextResponse.json(nextActions);
  } catch (error: any) {
    console.error('[GET /api/v1/admin/crm/next-actions] Erro:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao buscar próximas ações do CRM' }, { status: 500 });
  }
}
