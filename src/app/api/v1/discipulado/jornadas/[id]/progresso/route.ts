import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { DiscipuladoPedagogicoService } from '@/services/discipulado-pedagogico-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ error: 'Acesso negado ao progresso da jornada.' }, { status: 403 });
  }

  try {
    const { id: jornadaId } = await params;
    if (!jornadaId) {
      return NextResponse.json({ error: 'Identificador de jornada obrigatório.' }, { status: 400 });
    }

    const progresso = await DiscipuladoPedagogicoService.consultarProgressoJornada(
      admin,
      ministryId,
      jornadaId
    );

    return NextResponse.json(progresso);
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/jornadas/[id]/progresso]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar progresso da jornada.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { admin, nivel } = ctx;

  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Acesso negado para validar lições.' }, { status: 403 });
  }

  try {
    const { id: jornadaId } = await params;
    const body = await request.json();

    if (!body.licaoId || !body.validadorId || !body.modalidade) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes: licaoId, validadorId e modalidade são mandatórios.' },
        { status: 400 }
      );
    }

    const resultado = await DiscipuladoPedagogicoService.validarLicaoIndividual(
      admin,
      {
        jornadaId,
        licaoId: body.licaoId,
        validadorId: body.validadorId,
        modalidade: body.modalidade,
        dataValidacao: body.dataValidacao || new Date().toISOString().slice(0, 10),
        aproveitamentoNota: body.aproveitamentoNota,
        observacoes: body.observacoes
      }
    );

    return NextResponse.json(resultado);
  } catch (err: any) {
    console.error('[POST /api/v1/discipulado/jornadas/[id]/progresso]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao validar lição individualmente.' },
      { status: 400 }
    );
  }
}
