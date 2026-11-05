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
    return NextResponse.json({ error: 'Acesso negado às aulas da turma.' }, { status: 403 });
  }

  try {
    const { id: turmaId } = await params;
    const { data: aulas, error } = await admin
      .from('discipulado_turma_aulas')
      .select(`
        id, ministry_id, turma_id, licao_id, professor_id, data_aula,
        status_aula, motivo_cancelamento, conteudo_ministrado, observacoes, created_at,
        licao:discipulado_licoes ( id, volume, numero, titulo_padrao, titulo_validado ),
        professor:members!discipulado_turma_aulas_professor_id_fkey ( id, name )
      `)
      .eq('turma_id', turmaId)
      .eq('ministry_id', ministryId)
      .order('data_aula', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar aulas: ${error.message}`);
    }

    return NextResponse.json({ aulas: aulas || [] });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/turmas/[id]/aulas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar diário de aulas.' },
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
    return NextResponse.json({ error: 'Permissão insuficiente para registrar chamadas.' }, { status: 403 });
  }

  try {
    const { id: turmaId } = await params;
    const body = await request.json();

    const {
      licaoId,
      professorId,
      dataAula,
      statusAula,
      motivoCancelamento,
      chamadas,
      validarPedagogicoPresentes,
      conteudoMinistrado,
      observacoes
    } = body;

    if (!licaoId || !professorId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: licaoId e professorId são mandatórios.' },
        { status: 400 }
      );
    }

    const resultado = await DiscipuladoPedagogicoService.registrarAulaEChamada(admin, {
      turmaId,
      licaoId,
      professorId,
      dataAula: dataAula || new Date().toISOString().slice(0, 10),
      statusAula: statusAula || 'realizada',
      motivoCancelamento,
      chamadas: Array.isArray(chamadas) ? chamadas : [],
      validarPedagogicoPresentes: Boolean(validarPedagogicoPresentes),
      conteudoMinistrado,
      observacoes
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/discipulado/turmas/[id]/aulas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao registrar diário de aula.' },
      { status: 400 }
    );
  }
}
