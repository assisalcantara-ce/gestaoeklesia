import { resolveTenantAuth } from '@/lib/tenant-auth';
import { authTenantErrorResponse } from '@/lib/api-errors';
import { temAcessoEscrita } from '@/lib/access-control';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/members/[id]/familia
 * Lista os vínculos familiares (filhos/dependentes) do membro
 */
export async function GET(request: NextRequest, context: RouteContext) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    return authTenantErrorResponse(err);
  }

  const { id: memberId } = await context.params;

  try {
    // 1. Tentar buscar da tabela relacional dedicada
    const { data: relations, error } = await ctx.supabase
      .from('member_family_relations')
      .select('id, parent_id, child_id, child_nome, child_data_nascimento, child_tipo, created_at')
      .eq('ministry_id', ctx.ministryId)
      .eq('parent_id', memberId)
      .order('created_at', { ascending: true });

    if (!error && relations) {
      // Se encontrou dados na tabela relacional, enriquecer com dados do child_id se existir
      const childIds = relations.map((r) => r.child_id).filter(Boolean);
      let membersMap = new Map<string, any>();

      if (childIds.length > 0) {
        const { data: linkedMembers } = await ctx.supabase
          .from('members')
          .select('id, name, matricula, data_nascimento, role, tipo_cadastro')
          .eq('ministry_id', ctx.ministryId)
          .in('id', childIds);

        if (linkedMembers) {
          linkedMembers.forEach((m) => membersMap.set(m.id, m));
        }
      }

      const formatted = relations.map((r) => {
        const linked = r.child_id ? membersMap.get(r.child_id) : null;
        return {
          id: r.id,
          memberId: r.child_id || undefined,
          nome: linked ? linked.name : r.child_nome,
          matricula: linked?.matricula || undefined,
          dataNascimento: (linked?.data_nascimento || r.child_data_nascimento || '').slice(0, 10),
          tipo: r.child_tipo || 'filho',
        };
      });

      return NextResponse.json({ data: formatted });
    }

    // 2. Fallback gracioso: ler de custom_fields.filhos do membro para compatibilidade
    const { data: member } = await ctx.supabase
      .from('members')
      .select('custom_fields')
      .eq('ministry_id', ctx.ministryId)
      .eq('id', memberId)
      .single();

    const cf = (member?.custom_fields || {}) as Record<string, any>;
    const fallbackList = Array.isArray(cf.filhos) ? cf.filhos : [];

    return NextResponse.json({ data: fallbackList });
  } catch (err: any) {
    console.error('Erro ao listar vínculos familiares:', err);
    return NextResponse.json({ error: 'Erro ao carregar vínculos familiares' }, { status: 500 });
  }
}

/**
 * POST /api/v1/members/[id]/familia
 * Cria ou vincula um filho/dependente
 */
export async function POST(request: NextRequest, context: RouteContext) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    return authTenantErrorResponse(err);
  }

  if (!temAcessoEscrita(ctx.nivel, 'secretaria') && ctx.nivel !== 'administrador') {
    return NextResponse.json({ error: 'Permissão insuficiente para alterar membros' }, { status: 403 });
  }

  const { id: parentId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const { childId, nome, dataNascimento, tipo = 'filho' } = body;

  if (!nome && !childId) {
    return NextResponse.json({ error: 'Nome ou ID do filho é obrigatório' }, { status: 400 });
  }

  // Prevenir auto-vínculo
  if (childId && childId === parentId) {
    return NextResponse.json({ error: 'Não é permitido vincular o membro a si mesmo como dependente.' }, { status: 400 });
  }

  try {
    let finalNome = nome;
    let finalDataNascimento = dataNascimento || null;

    if (childId) {
      // Verificar se a pessoa vinculada pertence ao mesmo ministério
      const { data: targetChild, error: targetError } = await ctx.supabase
        .from('members')
        .select('id, name, data_nascimento, ministry_id')
        .eq('id', childId)
        .eq('ministry_id', ctx.ministryId)
        .single();

      if (targetError || !targetChild) {
        return NextResponse.json({ error: 'Pessoa para vínculo não encontrada no ministério.' }, { status: 404 });
      }

      finalNome = targetChild.name;
      finalDataNascimento = targetChild.data_nascimento || finalDataNascimento;
    }

    // 1. Tentar gravar na tabela relacional member_family_relations
    const { data: newRel, error: relError } = await ctx.supabase
      .from('member_family_relations')
      .insert({
        ministry_id: ctx.ministryId,
        parent_id: parentId,
        child_id: childId || null,
        child_nome: finalNome.trim().toUpperCase(),
        child_data_nascimento: finalDataNascimento,
        child_tipo: tipo,
      })
      .select()
      .single();

    if (!relError && newRel) {
      return NextResponse.json({ data: newRel }, { status: 201 });
    }

    // 2. Fallback se a tabela ainda não tiver sido criada (retrocompatibilidade)
    const { data: parentMember } = await ctx.supabase
      .from('members')
      .select('custom_fields')
      .eq('id', parentId)
      .eq('ministry_id', ctx.ministryId)
      .single();

    if (parentMember) {
      const cf = (parentMember.custom_fields || {}) as Record<string, any>;
      const existingFilhos = Array.isArray(cf.filhos) ? cf.filhos : [];
      
      const jaExiste = existingFilhos.some((f: any) => 
        (childId && f.memberId === childId) || 
        (f.nome && f.nome.toUpperCase() === finalNome.trim().toUpperCase())
      );

      if (!jaExiste) {
        const updatedFilhos = [
          ...existingFilhos,
          {
            memberId: childId || undefined,
            nome: finalNome.trim().toUpperCase(),
            dataNascimento: finalDataNascimento,
            tipo,
          },
        ];

        await ctx.supabase
          .from('members')
          .update({
            custom_fields: { ...cf, filhos: updatedFilhos },
          })
          .eq('id', parentId)
          .eq('ministry_id', ctx.ministryId);
      }
    }

    return NextResponse.json({
      data: {
        parent_id: parentId,
        child_id: childId || null,
        child_nome: finalNome.trim().toUpperCase(),
        child_data_nascimento: finalDataNascimento,
        child_tipo: tipo,
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error('Erro ao adicionar vínculo familiar:', err);
    return NextResponse.json({ error: 'Erro ao processar vínculo familiar' }, { status: 500 });
  }
}
