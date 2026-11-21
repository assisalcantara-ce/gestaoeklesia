import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso, temAcessoEscrita } from '@/lib/access-control';
import { CelulasService } from '@/services/celulas-service';

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

  if (!temAcesso(nivel, 'celulas') && !temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado para consultar transferências de células.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const celulaId = searchParams.get('celula_id');
    const participanteId = searchParams.get('participante_id');

    let query = admin
      .from('celulas_transferencias')
      .select(`
        id, ministry_id, participante_id, member_id, celula_origem_id, celula_destino_id,
        data_transferencia, motivo, solicitado_por, created_at,
        participante:celulas_participantes(id, nome_completo),
        celula_origem:celulas!celula_origem_id(id, nome),
        celula_destino:celulas!celula_destino_id(id, nome)
      `)
      .eq('ministry_id', ministryId)
      .order('data_transferencia', { ascending: false });

    if (celulaId) {
      query = query.or(`celula_origem_id.eq.${celulaId},celula_destino_id.eq.${celulaId}`);
    }
    if (participanteId) {
      query = query.eq('participante_id', participanteId);
    }

    const { data, error } = await query.limit(50);
    if (error) {
      throw new Error(`Erro ao listar transferências: ${error.message}`);
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao listar transferências' }, { status: 500 });
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

  const { admin, ministryId, nivel, userId } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado para transferir participantes de células.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const service = new CelulasService(admin);
    const transferencia = await service.transferirParticipante(ministryId, body, userId);

    return NextResponse.json({ data: transferencia });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao transferir participante' }, { status: 400 });
  }
}
