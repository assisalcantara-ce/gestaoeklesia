import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

  const { admin, ministryId, nivel } = ctx;

  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Acesso negado à equipe de discipulado.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const papel = searchParams.get('papel');
    const apenasAtivos = searchParams.get('ativo') !== 'false';

    let query = admin
      .from('discipulado_equipe')
      .select(`
        id, ministry_id, congregacao_id, member_id, papel, autorizado_por_id,
        data_autorizacao, ativo, data_inativacao, motivo_inativacao, observacoes,
        member:members!discipulado_equipe_member_id_fkey ( id, name, phone, celular, foto_url ),
        autorizado_por:members!discipulado_equipe_autorizado_por_id_fkey ( id, name ),
        congregacao:congregacoes ( id, nome )
      `)
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (papel) {
      query = query.eq('papel', papel);
    }
    if (apenasAtivos) {
      query = query.eq('ativo', true);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao consultar equipe: ${error.message}`);
    }

    return NextResponse.json({ equipe: data || [] });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/equipe]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar equipe de discipulado.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

  const { admin, ministryId, nivel } = ctx;

  // Somente liderança ampla pode autorizar membros na equipe
  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Permissão insuficiente para gerenciar equipe de discipulado.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { memberId, papel, congregacaoId, autorizadoPorId, observacoes } = body;

    if (!memberId || !papel || !autorizadoPorId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: memberId, papel e autorizadoPorId.' },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from('discipulado_equipe')
      .insert({
        ministry_id: ministryId,
        congregacao_id: congregacaoId || null,
        member_id: memberId,
        papel,
        autorizado_por_id: autorizadoPorId,
        data_autorizacao: new Date().toISOString().slice(0, 10),
        ativo: true,
        observacoes: observacoes || null
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Este membro já possui esse papel registrado na equipe de discipulado.' },
          { status: 409 }
        );
      }
      throw new Error(`Erro ao autorizar membro na equipe: ${error.message}`);
    }

    return NextResponse.json({ sucesso: true, equipeId: data.id });
  } catch (err: any) {
    console.error('[POST /api/v1/discipulado/equipe]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao cadastrar membro na equipe.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

  const { admin, ministryId, nivel } = ctx;

  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Permissão insuficiente para alterar equipe de discipulado.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, ativo, motivoInativacao } = body;

    if (!id || typeof ativo !== 'boolean') {
      return NextResponse.json(
        { error: 'Campos obrigatórios: id e status ativo (booleano).' },
        { status: 400 }
      );
    }

    const updatePayload: any = {
      ativo,
      updated_at: new Date().toISOString()
    };

    if (!ativo) {
      updatePayload.data_inativacao = new Date().toISOString().slice(0, 10);
      updatePayload.motivo_inativacao = motivoInativacao || 'Inativado pela liderança';
    } else {
      updatePayload.data_inativacao = null;
      updatePayload.motivo_inativacao = null;
    }

    const { error } = await admin
      .from('discipulado_equipe')
      .update(updatePayload)
      .eq('id', id)
      .eq('ministry_id', ministryId);

    if (error) {
      throw new Error(`Erro ao atualizar status: ${error.message}`);
    }

    return NextResponse.json({ sucesso: true });
  } catch (err: any) {
    console.error('[PATCH /api/v1/discipulado/equipe]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao atualizar membro da equipe.' },
      { status: 500 }
    );
  }
}
