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

    // 2. Instanciar o CrmService e obter o resumo executivo oficial
    const crmService = new CrmService();
    const summary = await crmService.getSummary(supabaseAdmin);

    // 3. Devolver o JSON formatado
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('[GET /api/v1/admin/crm/summary] Erro:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao carregar resumo executivo do CRM' }, { status: 500 });
  }
}
