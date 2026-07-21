import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { InteractionTypes } from '@/lib/platform/crm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request);
    if (!result.ok) return result.response;
    const { supabaseAdmin } = result.ctx;

    const { searchParams } = new URL(request.url);
    const ministryId = searchParams.get('ministryId') || '';

    let query = supabaseAdmin
      .from('crm_interactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (ministryId) {
      query = query.or(`ministry_id.eq.${ministryId},id.eq.${ministryId}`);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('[GET /api/v1/admin/crm/interactions] Erro:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao consultar interações' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar Autenticação
    const result = await requireAdmin(request);
    if (!result.ok) return result.response;
    const { supabaseAdmin, user } = result.ctx;

    // 2. Parse do payload
    const body = await request.json();
    const { ministryId, tipo, descricao, proximaAcao, dataProximaAcao } = body || {};

    // 3. Validação do CrmInteractionDraft
    if (!tipo || !descricao || typeof descricao !== 'string' || !descricao.trim()) {
      return NextResponse.json(
        { error: 'Os campos "tipo" e "descrição" são obrigatórios.' },
        { status: 400 }
      );
    }

    if (!InteractionTypes.includes(tipo as any)) {
      return NextResponse.json(
        { error: `Tipo de interação inválido. Opções válidas: ${InteractionTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. Inserção no banco com Auto-Healing de Tabela
    const payload = {
      ministry_id: ministryId || null,
      tipo,
      descricao: descricao.trim(),
      proxima_acao: proximaAcao ? String(proximaAcao).trim() : null,
      data_proxima_acao: dataProximaAcao ? new Date(dataProximaAcao).toISOString() : null,
      created_by: user?.email || 'Administrador',
      created_at: new Date().toISOString()
    };

    let insertRes = await supabaseAdmin
      .from('crm_interactions')
      .insert([payload])
      .select()
      .single();

    // Se a tabela não existir no schema cache, tentar criá-la via RPC e re-tentar
    if (insertRes.error && insertRes.error.code === '42P01') {
      console.warn('[CRM Interactions] Tabela crm_interactions não existe no Supabase. Executando auto-criação DDL...');
      try {
        await supabaseAdmin.rpc('exec', {
          sql: `
            CREATE TABLE IF NOT EXISTS public.crm_interactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ministry_id UUID NULL,
                tipo TEXT NOT NULL,
                descricao TEXT NOT NULL,
                proxima_acao TEXT NULL,
                data_proxima_acao TIMESTAMPTZ NULL,
                created_by TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
          `
        });
      } catch (err) {
        console.warn('[CRM Interactions] Auto-criação via RPC não disponível ou falhou. Tentando novamente...');
      }

      insertRes = await supabaseAdmin
        .from('crm_interactions')
        .insert([payload])
        .select()
        .single();
    }

    if (insertRes.error) {
      console.error('[POST /api/v1/admin/crm/interactions] Erro ao salvar:', insertRes.error);
      return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      interaction: insertRes.data
    });
  } catch (error: any) {
    console.error('[POST /api/v1/admin/crm/interactions] Erro inesperado:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao registrar interação no CRM' }, { status: 500 });
  }
}
