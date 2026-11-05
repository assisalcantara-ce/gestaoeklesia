import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { DiscipuladoService, IniciarJornadaDiscipuladoInput } from '@/services/discipulado-service';

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
    return NextResponse.json({ error: 'Acesso negado ao módulo de Discipulado.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'ativo';
    const fase = searchParams.get('fase');

    let query = admin
      .from('discipulado_jornadas')
      .select(`
        id, fase, status, data_decisao, data_inicio, data_conclusao, observacoes, created_at,
        member:members!discipulado_jornadas_member_id_fkey (
          id, name, cpf, phone, celular, whatsapp, tipo_cadastro, status, foto_url
        ),
        responsavel:members!discipulado_jornadas_responsavel_id_fkey (
          id, name
        ),
        congregacao:congregacoes (
          id, nome
        )
      `)
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (status !== 'todos') {
      query = query.eq('status', status);
    }
    if (fase && fase !== 'todas') {
      query = query.eq('fase', fase);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/v1/discipulado/jornadas] Erro query:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jornadas: data || [] });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/jornadas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar jornadas de discipulado.' },
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

  const { admin, ministryId, nivel, congregacaoId } = ctx;

  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Acesso negado ao módulo de Discipulado.' }, { status: 403 });
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    // Suporte prioritário ao fluxo oficial de início por congregado existente
    if (body.member_id) {
      const resultado = await DiscipuladoService.iniciarJornadaParaCongregado(admin, {
        ministryId,
        memberId: body.member_id,
        responsavelId: body.responsavel_id || null,
        congregacaoId: body.congregacao_id || congregacaoId || null,
        dataDecisao: body.data_decisao || undefined,
        observacoes: body.observacoes || null,
      });

      return NextResponse.json(resultado, { status: 201 });
    }

    const input: IniciarJornadaDiscipuladoInput = {
      ministryId,
      congregacaoId: body.congregacao_id || congregacaoId || null,
      telefone: body.telefone || null,
      cpf: body.cpf,
      nome: body.nome,
      dataNascimento: body.data_nascimento || null,
      sexo: body.sexo || null,
      bairro: body.bairro || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      cep: body.cep || null,
      logradouro: body.logradouro || null,
      numero: body.numero || null,
      responsavelId: body.responsavel_id || null,
      visitanteId: body.visitante_id || null,
      dataDecisao: body.data_decisao || undefined,
      observacoes: body.observacoes || null,
    };

    const resultado = await DiscipuladoService.iniciarJornada(admin, input);

    return NextResponse.json(resultado, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/discipulado/jornadas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao iniciar jornada de discipulado.' },
      { status: 400 }
    );
  }
}
