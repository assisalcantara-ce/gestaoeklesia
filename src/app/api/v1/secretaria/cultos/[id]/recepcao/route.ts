import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { CultoRecepcaoService } from '@/lib/culto-recepcao-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/secretaria/cultos/[id]/recepcao
 * Painel administrativo da recepção: retorna todos os registros do culto
 * (visitantes, autoridades, orações, avisos, famílias e resumo)
 * mesmo após expiração ou revogação do link público.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveTenantAuth(request);
    const { id: cultoId } = await props.params;

    if (!cultoId) {
      return NextResponse.json({ error: 'ID do culto não fornecido.' }, { status: 400 });
    }

    // Validar culto no tenant
    const { data: culto, error: cultoErr } = await context.admin
      .from('culto_registros')
      .select(`
        id, data_culto, horario_culto, tipo_culto, dirigente, pregador, status,
        congregacao_id,
        congregacoes ( nome )
      `)
      .eq('id', cultoId)
      .eq('ministry_id', context.ministryId)
      .maybeSingle();

    if (cultoErr || !culto) {
      return NextResponse.json({ error: 'Culto não encontrado.' }, { status: 404 });
    }

    const service = new CultoRecepcaoService(context.admin);
    const dados = await service.listarDadosRecepcao(cultoId);

    return NextResponse.json({
      culto: {
        id: culto.id,
        tipo_culto: culto.tipo_culto,
        data_culto: culto.data_culto,
        horario_culto: culto.horario_culto,
        dirigente: culto.dirigente,
        pregador: culto.pregador,
        status: culto.status,
        congregacao_nome: (culto as any).congregacoes?.nome || 'Sede',
      },
      ...dados,
    });
  } catch (err: any) {
    console.error('Erro ao carregar dados da recepção (admin):', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao carregar dados da recepção.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/secretaria/cultos/[id]/recepcao
 * Inclusão administrativa de item em uma das seções da recepção.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveTenantAuth(request);
    const { id: cultoId } = await props.params;

    const { data: culto, error: cultoErr } = await context.admin
      .from('culto_registros')
      .select('id, congregacao_id, status')
      .eq('id', cultoId)
      .eq('ministry_id', context.ministryId)
      .maybeSingle();

    if (cultoErr || !culto) {
      return NextResponse.json({ error: 'Culto não encontrado.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const secao = body.secao;
    const dados = body.dados || {};

    const service = new CultoRecepcaoService(context.admin);
    const baseParams = {
      culto_id: cultoId,
      ministry_id: context.ministryId,
      congregacao_id: culto.congregacao_id,
      ...dados,
    };

    if (secao === 'visitantes') {
      if (!dados.nome || dados.nome.trim().length < 2) {
        return NextResponse.json({ error: 'Nome do visitante é obrigatório.' }, { status: 400 });
      }
      const res = await service.salvarVisitante(baseParams);
      return NextResponse.json({ success: true, item: res.item, ja_existia: res.ja_existia });
    }

    if (secao === 'autoridades') {
      if (!dados.nome || !dados.cargo_funcao) {
        return NextResponse.json({ error: 'Nome e cargo/função são obrigatórios.' }, { status: 400 });
      }
      const item = await service.salvarAutoridade(baseParams);
      return NextResponse.json({ success: true, item });
    }

    if (secao === 'oracoes') {
      if (!dados.nome || !dados.motivo) {
        return NextResponse.json({ error: 'Nome e motivo da oração são obrigatórios.' }, { status: 400 });
      }
      const item = await service.salvarOracao(baseParams);
      return NextResponse.json({ success: true, item });
    }

    if (secao === 'avisos') {
      if (!dados.titulo || !dados.conteudo) {
        return NextResponse.json({ error: 'Título e conteúdo do aviso são obrigatórios.' }, { status: 400 });
      }
      const item = await service.salvarAviso(baseParams);
      return NextResponse.json({ success: true, item });
    }

    if (secao === 'familias') {
      if (!dados.responsavel) {
        return NextResponse.json({ error: 'Nome do responsável pela família é obrigatório.' }, { status: 400 });
      }
      const item = await service.salvarFamilia(baseParams);
      return NextResponse.json({ success: true, item });
    }

    return NextResponse.json({ error: 'Seção não suportada.' }, { status: 400 });
  } catch (err: any) {
    console.error('Erro ao adicionar item na recepção (admin):', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao adicionar registro na recepção.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/secretaria/cultos/[id]/recepcao
 * Edição administrativa de item.
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveTenantAuth(request);
    const { id: cultoId } = await props.params;

    const { data: culto, error: cultoErr } = await context.admin
      .from('culto_registros')
      .select('id, congregacao_id')
      .eq('id', cultoId)
      .eq('ministry_id', context.ministryId)
      .maybeSingle();

    if (cultoErr || !culto) {
      return NextResponse.json({ error: 'Culto não encontrado.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { secao, id, dados } = body;

    if (!secao || !id) {
      return NextResponse.json({ error: 'Seção e ID são obrigatórios para edição.' }, { status: 400 });
    }

    const service = new CultoRecepcaoService(context.admin);
    const baseParams = {
      id,
      culto_id: cultoId,
      ministry_id: context.ministryId,
      congregacao_id: culto.congregacao_id,
      ...dados,
    };

    if (secao === 'visitantes') {
      const res = await service.salvarVisitante(baseParams);
      return NextResponse.json({ success: true, item: res.item });
    }
    if (secao === 'autoridades') {
      const item = await service.salvarAutoridade(baseParams);
      return NextResponse.json({ success: true, item });
    }
    if (secao === 'oracoes') {
      const item = await service.salvarOracao(baseParams);
      return NextResponse.json({ success: true, item });
    }
    if (secao === 'avisos') {
      const item = await service.salvarAviso(baseParams);
      return NextResponse.json({ success: true, item });
    }
    if (secao === 'familias') {
      const item = await service.salvarFamilia(baseParams);
      return NextResponse.json({ success: true, item });
    }

    return NextResponse.json({ error: 'Seção não suportada.' }, { status: 400 });
  } catch (err: any) {
    console.error('Erro ao editar item na recepção (admin):', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao editar item na recepção.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/secretaria/cultos/[id]/recepcao
 * Exclusão lógica (soft delete) administrativa.
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveTenantAuth(request);
    const { id: cultoId } = await props.params;

    const { searchParams } = new URL(request.url);
    const secao = searchParams.get('secao') as any;
    const itemId = searchParams.get('id');

    if (!secao || !itemId) {
      return NextResponse.json({ error: 'Parâmetros secao e id são obrigatórios.' }, { status: 400 });
    }

    const service = new CultoRecepcaoService(context.admin);
    const ok = await service.removerItem(secao, itemId, cultoId);

    return NextResponse.json({ success: ok });
  } catch (err: any) {
    console.error('Erro ao remover item na recepção (admin):', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao remover item na recepção.' },
      { status: 500 }
    );
  }
}
