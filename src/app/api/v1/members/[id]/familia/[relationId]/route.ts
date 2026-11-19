import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcessoEscrita } from '@/lib/access-control';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string; relationId: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/v1/members/[id]/familia/[relationId]
 * Desvincula o dependente sem excluir o registro do membro
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  if (!temAcessoEscrita(ctx.nivel, 'secretaria') && ctx.nivel !== 'administrador') {
    return NextResponse.json({ error: 'Permissão insuficiente para alterar membros' }, { status: 403 });
  }

  const { id: parentId, relationId } = await context.params;

  try {
    // 1. Tentar deletar da tabela relacional member_family_relations
    await ctx.supabase
      .from('member_family_relations')
      .delete()
      .eq('ministry_id', ctx.ministryId)
      .eq('parent_id', parentId)
      .or(`id.eq.${relationId},child_id.eq.${relationId}`);

    // 2. Limpar também em custom_fields.filhos para consistência
    const { data: parentMember } = await ctx.supabase
      .from('members')
      .select('custom_fields')
      .eq('id', parentId)
      .eq('ministry_id', ctx.ministryId)
      .single();

    if (parentMember) {
      const cf = (parentMember.custom_fields || {}) as Record<string, any>;
      const existingFilhos = Array.isArray(cf.filhos) ? cf.filhos : [];
      const filtered = existingFilhos.filter((f: any) => f.id !== relationId && f.memberId !== relationId);

      await ctx.supabase
        .from('members')
        .update({
          custom_fields: { ...cf, filhos: filtered },
        })
        .eq('id', parentId)
        .eq('ministry_id', ctx.ministryId);
    }

    return NextResponse.json({ success: true, message: 'Vínculo removido com sucesso.' });
  } catch (err: any) {
    console.error('Erro ao remover vínculo familiar:', err);
    return NextResponse.json({ error: 'Erro ao remover vínculo familiar' }, { status: 500 });
  }
}
