import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcessoEscrita } from '@/lib/access-control';
import { CelulasService } from '@/services/celulas-service';

export const dynamic = 'force-dynamic';

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

  const { admin, ministryId, nivel, userId } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado para gerar links de chamada rápida.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const service = new CelulasService(admin);
    const resultado = await service.gerarTokenChamadaRapida(ministryId, body, userId);

    return NextResponse.json({ data: resultado });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao gerar link temporário' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
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

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado para revogar links de chamada rápida.' }, { status: 403 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const tokenId = searchParams.get('token_id');
    const reuniaoId = searchParams.get('reuniao_id');
    const celulaId = searchParams.get('celula_id');

    if (!tokenId && (!reuniaoId || !celulaId)) {
      return NextResponse.json({ error: 'Informe token_id ou o par celula_id e reuniao_id.' }, { status: 400 });
    }

    let query = admin
      .from('celulas_chamada_tokens')
      .update({ status: 'revogado', updated_at: new Date().toISOString() })
      .eq('ministry_id', ministryId);

    if (tokenId) {
      query = query.eq('id', tokenId);
    } else if (celulaId && reuniaoId) {
      query = query.eq('celula_id', celulaId).eq('reuniao_id', reuniaoId);
    }

    const { error } = await query;
    if (error) {
      throw new Error(`Erro ao revogar link: ${error.message}`);
    }

    return NextResponse.json({ success: true, message: 'Link de chamada revogado com sucesso.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao revogar link temporário' }, { status: 400 });
  }
}
