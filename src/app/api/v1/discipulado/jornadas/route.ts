import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { DiscipuladoService, IniciarJornadaDiscipuladoInput } from '@/services/discipulado-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: mu } = await supabase
      .from('ministry_users')
      .select('ministry_id, congregacao_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const ministryId = mu?.ministry_id;
    if (!ministryId) {
      return NextResponse.json({ error: 'Ministério não encontrado.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'ativo';
    const fase = searchParams.get('fase');

    let query = supabase
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
    if (fase) {
      query = query.eq('fase', fase);
    }

    const { data: jornadas, error } = await query;

    if (error) {
      console.error('[GET /api/v1/discipulado/jornadas]', error);
      return NextResponse.json(
        { error: 'Erro ao consultar jornadas de discipulado.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ jornadas: jornadas || [] });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/jornadas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar jornadas.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: mu } = await supabase
      .from('ministry_users')
      .select('ministry_id, congregacao_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const ministryId = mu?.ministry_id;
    if (!ministryId) {
      return NextResponse.json({ error: 'Ministério não encontrado.' }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    const input: IniciarJornadaDiscipuladoInput = {
      ministryId,
      congregacaoId: body.congregacao_id || mu.congregacao_id || null,
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

    const resultado = await DiscipuladoService.iniciarJornada(supabase, input);

    return NextResponse.json(resultado, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/discipulado/jornadas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao iniciar jornada de discipulado.' },
      { status: 400 }
    );
  }
}
