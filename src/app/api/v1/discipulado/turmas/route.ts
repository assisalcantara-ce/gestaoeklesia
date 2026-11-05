import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { DiscipuladoPedagogicoService } from '@/services/discipulado-pedagogico-service';

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
    return NextResponse.json({ error: 'Acesso negado ao gerenciamento de turmas.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const congregacaoId = searchParams.get('congregacaoId');

    const turmas = await DiscipuladoPedagogicoService.listarTurmas(admin, ministryId, {
      status,
      congregacaoId
    });

    return NextResponse.json({ turmas });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/turmas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar turmas.' },
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

  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Permissão insuficiente para criar turmas.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      nome,
      professorTitularId,
      professorAdjuntoId,
      congregacaoId,
      modalidade,
      isIntercongregacional,
      diasHorarios,
      localSala,
      capacidade,
      dataInicio,
      dataPrevisaoFim,
      observacoes
    } = body;

    if (!nome || !professorTitularId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome e professorTitularId são mandatórios.' },
        { status: 400 }
      );
    }

    // Valida se o professor titular está autorizado na equipe do ministério
    const { data: profAutorizado } = await admin
      .from('discipulado_equipe')
      .select('id')
      .eq('ministry_id', ministryId)
      .eq('member_id', professorTitularId)
      .in('papel', ['professor', 'coordenador'])
      .eq('ativo', true)
      .maybeSingle();

    if (!profAutorizado) {
      return NextResponse.json(
        { error: 'O professor titular selecionado não está autorizado ou ativo na equipe de discipulado.' },
        { status: 400 }
      );
    }

    const { data: novaTurma, error } = await admin
      .from('discipulado_turmas')
      .insert({
        ministry_id: ministryId,
        congregacao_id: congregacaoId || null,
        nome: nome.trim(),
        professor_titular_id: professorTitularId,
        professor_adjunto_id: professorAdjuntoId || null,
        modalidade: modalidade || 'presencial',
        is_intercongregacional: Boolean(isIntercongregacional),
        dias_horarios: diasHorarios || null,
        local_sala: localSala || null,
        capacidade: capacidade ? Number(capacidade) : null,
        data_inicio: dataInicio || null,
        data_previsao_fim: dataPrevisaoFim || null,
        status: 'planejada',
        observacoes: observacoes || null
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Erro ao criar turma: ${error.message}`);
    }

    return NextResponse.json({ sucesso: true, turmaId: novaTurma.id }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/discipulado/turmas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao criar turma.' },
      { status: 500 }
    );
  }
}
