import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { gerarTokenPainel, hashTokenPainel } from '@/lib/reunioes-utils';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * GET /api/v1/reunioes/[id]/painel/token
 * Consulta o estado atual do token do painel informativo da reunião (ativo, expirado, revogado, etc.).
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reuniaoId } = await props.params;
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'meetings_module');
    if (!isAllowed) {
      return NextResponse.json(REUNIOES_RESTRICTED_RESPONSE, { status: 403 });
    }

    if (!reuniaoId || typeof reuniaoId !== 'string') {
      return NextResponse.json({ error: 'ID da reunião é obrigatório.' }, { status: 400 });
    }

    // 1. Validar existência da reunião no ministério
    const { data: reuniao, error: rErr } = await ctx.admin
      .from('reunioes')
      .select('id, titulo, status, data_reuniao')
      .eq('id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json({ error: 'Reunião não encontrada neste ministério.' }, { status: 404 });
    }

    // 2. Buscar tokens existentes da reunião
    const { data: tokens, error: tErr } = await ctx.admin
      .from('reunioes_painel_tokens')
      .select('id, status, expira_em, revogado_em, revogado_por, ultimo_acesso_em, created_at')
      .eq('reuniao_id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .order('created_at', { ascending: false });

    if (tErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar tokens do painel.', detail: tErr.message },
        { status: 500 }
      );
    }

    const agora = new Date();

    // Determinar o status dinâmico do token mais recente
    const tokenRecente = tokens && tokens.length > 0 ? tokens[0] : null;
    let statusEfetivo: 'ativo' | 'expirado' | 'revogado' | 'inativado_encerramento' | 'nenhum' = 'nenhum';

    if (tokenRecente) {
      if (reuniao.status === 'encerrada') {
        statusEfetivo = 'inativado_encerramento';
      } else if (tokenRecente.status === 'revogado') {
        statusEfetivo = 'revogado';
      } else if (new Date(tokenRecente.expira_em) <= agora || tokenRecente.status === 'expirado') {
        statusEfetivo = 'expirado';
      } else if (tokenRecente.status === 'ativo') {
        statusEfetivo = 'ativo';
      } else {
        statusEfetivo = tokenRecente.status as any;
      }
    }

    return NextResponse.json({
      success: true,
      reuniao_id: reuniaoId,
      reuniao_status: reuniao.status,
      possui_token: Boolean(tokenRecente),
      status_efetivo: statusEfetivo,
      token_info: tokenRecente
        ? {
            id: tokenRecente.id,
            status_banco: tokenRecente.status,
            expira_em: tokenRecente.expira_em,
            revogado_em: tokenRecente.revogado_em,
            ultimo_acesso_em: tokenRecente.ultimo_acesso_em,
            created_at: tokenRecente.created_at,
          }
        : null,
      historico_tokens: tokens || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao verificar token do painel.', detail: err?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reunioes/[id]/painel/token
 * Gera um novo token seguro e temporário para o painel informativo público da reunião.
 * Inativa automaticamente tokens anteriores ativos para evitar múltiplos links simultâneos.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reuniaoId } = await props.params;
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'meetings_module');
    if (!isAllowed) {
      return NextResponse.json(REUNIOES_RESTRICTED_RESPONSE, { status: 403 });
    }

    if (!reuniaoId || typeof reuniaoId !== 'string') {
      return NextResponse.json({ error: 'ID da reunião é obrigatório.' }, { status: 400 });
    }

    // 1. Validar existência e status da reunião
    const { data: reuniao, error: rErr } = await ctx.admin
      .from('reunioes')
      .select('id, titulo, status, data_reuniao, limite_checkin_em')
      .eq('id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json({ error: 'Reunião não encontrada neste ministério.' }, { status: 404 });
    }

    if (reuniao.status === 'encerrada') {
      return NextResponse.json(
        { error: 'Não é possível gerar token para uma reunião já encerrada.', code: 'REUNIAO_ENCERRADA' },
        { status: 400 }
      );
    }

    if (reuniao.status === 'cancelada') {
      return NextResponse.json(
        { error: 'Não é possível gerar token para uma reunião cancelada.', code: 'REUNIAO_CANCELADA' },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body opcional
    }

    // Duração customizada ou padrão de 24 horas (em horas, min 1h, max 72h)
    const duracaoHoras = Number(body?.duracao_horas) > 0 && Number(body?.duracao_horas) <= 72
      ? Number(body.duracao_horas)
      : 24;

    const agora = new Date();
    const expiraEm = new Date(agora.getTime() + duracaoHoras * 60 * 60 * 1000);

    // 2. Gerar token criptográfico bruto e seu hash SHA-256
    const rawToken = gerarTokenPainel();
    const tokenHash = hashTokenPainel(rawToken);

    // 3. Inativar/revogar tokens anteriores ativos da mesma reunião
    await ctx.admin
      .from('reunioes_painel_tokens')
      .update({
        status: 'revogado',
        revogado_em: agora.toISOString(),
        revogado_por: ctx.userId,
      })
      .eq('reuniao_id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .eq('status', 'ativo');

    // 4. Inserir novo token com status 'ativo' e persistir APENAS o hash
    const { data: tokenSalvo, error: insErr } = await ctx.admin
      .from('reunioes_painel_tokens')
      .insert({
        reuniao_id: reuniaoId,
        ministry_id: ctx.ministryId,
        token_hash: tokenHash,
        status: 'ativo',
        expira_em: expiraEm.toISOString(),
      })
      .select('id, status, expira_em, created_at')
      .single();

    if (insErr) {
      return NextResponse.json(
        { error: 'Erro ao registrar token do painel.', detail: insErr.message },
        { status: 500 }
      );
    }

    // 5. Construir a URL pública completa do painel
    const origin = request.nextUrl.origin || 'http://localhost:3000';
    const urlPublica = `${origin}/painel/reuniao/${rawToken}`;

    // 6. Registrar auditoria administrativa
    try {
      await ctx.admin.from('reunioes_auditoria').insert({
        ministry_id: ctx.ministryId,
        reuniao_id: reuniaoId,
        usuario_id: ctx.userId,
        acao: 'GERAR_TOKEN_PAINEL',
        tabela_afetada: 'reunioes_painel_tokens',
        registro_id: tokenSalvo.id,
        estado_novo: {
          token_id: tokenSalvo.id,
          expira_em: expiraEm.toISOString(),
          duracao_horas: duracaoHoras,
        },
      });
    } catch (auditErr) {
      console.warn('⚠️ Falha ao registrar log de auditoria de geração do token:', auditErr);
    }

    return NextResponse.json({
      success: true,
      mensagem: 'Token do painel gerado com sucesso.',
      token: rawToken, // Retornado uma única vez para o administrador copiar
      url_painel: urlPublica,
      expira_em: expiraEm.toISOString(),
      duracao_horas: duracaoHoras,
      status: 'ativo',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao gerar token do painel.', detail: err?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/reunioes/[id]/painel/token
 * Revoga administrativamente todos os tokens ativos do painel para a reunião.
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reuniaoId } = await props.params;
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'meetings_module');
    if (!isAllowed) {
      return NextResponse.json(REUNIOES_RESTRICTED_RESPONSE, { status: 403 });
    }

    if (!reuniaoId || typeof reuniaoId !== 'string') {
      return NextResponse.json({ error: 'ID da reunião é obrigatório.' }, { status: 400 });
    }

    const agora = new Date().toISOString();

    // 1. Atualizar tokens ativos para revogado
    const { data: revogados, error: revErr } = await ctx.admin
      .from('reunioes_painel_tokens')
      .update({
        status: 'revogado',
        revogado_em: agora,
        revogado_por: ctx.userId,
      })
      .eq('reuniao_id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .eq('status', 'ativo')
      .select('id');

    if (revErr) {
      return NextResponse.json(
        { error: 'Erro ao revogar tokens do painel.', detail: revErr.message },
        { status: 500 }
      );
    }

    // 2. Registrar auditoria
    try {
      await ctx.admin.from('reunioes_auditoria').insert({
        ministry_id: ctx.ministryId,
        reuniao_id: reuniaoId,
        usuario_id: ctx.userId,
        acao: 'REVOGAR_TOKEN_PAINEL',
        tabela_afetada: 'reunioes_painel_tokens',
        registro_id: reuniaoId,
        estado_novo: {
          total_revogados: (revogados || []).length,
          revogado_em: agora,
        },
      });
    } catch (auditErr) {
      console.warn('⚠️ Falha ao registrar log de auditoria de revogação do token:', auditErr);
    }

    return NextResponse.json({
      success: true,
      mensagem: 'Token(s) do painel informativo revogado(s) com sucesso.',
      total_revogados: (revogados || []).length,
      revogado_em: agora,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao revogar token do painel.', detail: err?.message },
      { status: 500 }
    );
  }
}
