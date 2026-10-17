import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import {
  generateCultoRecepcaoToken,
  hashCultoRecepcaoToken,
  calculateCultoExpiration,
  verifyRecepcaoTokenStatus,
} from '@/lib/culto-recepcao-utils';
import { CultoRecepcaoService } from '@/lib/culto-recepcao-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/secretaria/cultos/[id]/recepcao/token
 * Consulta o status do link temporário da Central de Recepção do culto.
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

    const service = new CultoRecepcaoService(context.admin);

    // Validar se o culto pertence ao ministério
    const { data: culto, error: cultoErr } = await context.admin
      .from('culto_registros')
      .select('id, data_culto, horario_culto, tipo_culto, status, congregacao_id')
      .eq('id', cultoId)
      .eq('ministry_id', context.ministryId)
      .maybeSingle();

    if (cultoErr || !culto) {
      return NextResponse.json({ error: 'Culto não encontrado neste ministério.' }, { status: 404 });
    }

    const tokenRecord = await service.buscarTokenPorCulto(cultoId);
    if (!tokenRecord) {
      return NextResponse.json({
        has_token: false,
        culto: {
          id: culto.id,
          tipo_culto: culto.tipo_culto,
          data_culto: culto.data_culto,
          status: culto.status,
        },
      });
    }

    const statusCheck = verifyRecepcaoTokenStatus({
      expira_em: tokenRecord.expira_em,
      revogado_em: tokenRecord.revogado_em,
      status_culto: culto.status,
    });

    return NextResponse.json({
      has_token: true,
      valido: statusCheck.valido,
      motivo: statusCheck.motivo,
      mensagem: statusCheck.mensagem,
      expira_em: tokenRecord.expira_em,
      revogado_em: tokenRecord.revogado_em,
      ultimo_acesso_em: tokenRecord.ultimo_acesso_em,
      culto: {
        id: culto.id,
        tipo_culto: culto.tipo_culto,
        data_culto: culto.data_culto,
        status: culto.status,
      },
    });
  } catch (err: any) {
    console.error('Erro ao consultar token de recepção:', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao consultar token de recepção.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/secretaria/cultos/[id]/recepcao/token
 * Gera ou regenera o token seguro temporário da Central de Recepção.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveTenantAuth(request);
    const { id: cultoId } = await props.params;

    if (!cultoId) {
      return NextResponse.json({ error: 'ID do culto não fornecido.' }, { status: 400 });
    }

    // Validar culto
    const { data: culto, error: cultoErr } = await context.admin
      .from('culto_registros')
      .select('id, data_culto, horario_culto, tipo_culto, status, congregacao_id')
      .eq('id', cultoId)
      .eq('ministry_id', context.ministryId)
      .maybeSingle();

    if (cultoErr || !culto) {
      return NextResponse.json({ error: 'Culto não encontrado.' }, { status: 404 });
    }

    if (culto.status === 'Cancelado') {
      return NextResponse.json(
        { error: 'Não é possível gerar link para um culto cancelado.' },
        { status: 400 }
      );
    }

    const service = new CultoRecepcaoService(context.admin);

    // Gerar token bruto seguro e hash SHA-256
    const rawToken = generateCultoRecepcaoToken();
    const tokenHash = hashCultoRecepcaoToken(rawToken);
    const expiraEm = calculateCultoExpiration(culto.data_culto, { allowCurrentDayIfPast: true });

    await service.salvarToken({
      ministry_id: context.ministryId,
      congregacao_id: culto.congregacao_id,
      culto_id: cultoId,
      token_hash: tokenHash,
      expira_em: expiraEm,
      criado_por: context.userId,
    });

    return NextResponse.json({
      success: true,
      token: rawToken,
      expira_em: expiraEm,
      path: `/recepcao/${rawToken}`,
    });
  } catch (err: any) {
    console.error('Erro ao gerar token de recepção:', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao gerar token de recepção.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/secretaria/cultos/[id]/recepcao/token
 * Revoga imediatamente o token temporário da Central de Recepção.
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const context = await resolveTenantAuth(request);
    const { id: cultoId } = await props.params;

    if (!cultoId) {
      return NextResponse.json({ error: 'ID do culto não fornecido.' }, { status: 400 });
    }

    const service = new CultoRecepcaoService(context.admin);
    const revogado = await service.revogarToken(cultoId, context.userId);

    return NextResponse.json({
      success: revogado,
      message: revogado ? 'Link da recepção revogado com sucesso.' : 'Nenhum token encontrado para revogação.',
    });
  } catch (err: any) {
    console.error('Erro ao revogar token de recepção:', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao revogar token de recepção.' },
      { status: 500 }
    );
  }
}
