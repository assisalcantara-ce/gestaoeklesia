import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/agenda/sync-public
 *
 * Endpoint autenticado e com escopo estrito de tenant para sincronização e
 * revalidação do conteúdo público da Revista Digital do ministério.
 *
 * Regras de Segurança:
 * - Autenticação obrigatória (resolveTenantAuth).
 * - Multi-tenancy rígido: resolve o ministryId e slug a partir do banco (não aceita parâmetros forjados).
 * - Permissão verificada: apenas usuários do ministério com papel adequado ou módulo habilitado.
 * - Invalidação cirúrgica: revalida apenas /revista/[slug] e tags de cache específicas do ministério.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    // Verificar se o ministério tem acesso ao módulo de agenda
    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'agenda_module');
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'A funcionalidade Agenda do Ministério está restrita para o plano atual.',
          code: 'PLAN_RESTRICTED',
        },
        { status: 403 }
      );
    }

    // Buscar o slug oficial do ministério no banco
    const { data: ministry, error: ministryErr } = await ctx.admin
      .from('ministries')
      .select('id, slug, name')
      .eq('id', ctx.ministryId)
      .maybeSingle();

    if (ministryErr || !ministry || !ministry.slug) {
      return NextResponse.json(
        { error: 'Ministério não encontrado ou sem identificador público configurado.' },
        { status: 404 }
      );
    }

    const slug = ministry.slug.toLowerCase().trim();

    // Revalidação em nível de Next.js Server Components / Data Cache se houver ISR/Cache
    try {
      revalidatePath(`/revista/${slug}`);
      revalidatePath(`/api/v1/public/agenda/${slug}`);
      revalidateTag(`revista-${slug}`, 'max');
    } catch (cacheErr) {
      // revalidatePath pode falhar se não houver build de produção ou contexto específico, registrar sem quebrar
      console.warn('[SyncPublicAgenda] Aviso na revalidação de rota/tag:', cacheErr);
    }

    const timestamp = new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: 'Sincronização e revalidação solicitadas com sucesso.',
      ministry_id: ctx.ministryId,
      slug,
      synced_at: timestamp,
      expected_max_edge_ttl_seconds: 60,
    });
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    const isNoMinistry = err?.message === 'NO_MINISTRY';

    if (isUnauth) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    if (isNoMinistry) {
      return NextResponse.json({ error: 'Acesso negado: sem ministério associado.' }, { status: 403 });
    }

    console.error('[SyncPublicAgenda] Erro ao sincronizar agenda pública:', err?.message || err);
    return NextResponse.json(
      { error: 'Erro interno ao processar sincronização pública.' },
      { status: 500 }
    );
  }
}
