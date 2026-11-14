import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { gerarTokenPainel, hashTokenPainel, calcularExpiracaoFimDoDiaReuniao } from '@/lib/reunioes-utils';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * GET /api/v1/reunioes/[id]/checkin/token
 * Consulta o estado atual do token público de check-in da reunião.
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

    // 1. Validar existência da reunião
    const { data: reuniao, error: rErr } = await ctx.admin
      .from('reunioes')
      .select('id, titulo, status, data_reuniao')
      .eq('id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json({ error: 'Reunião não encontrada neste ministério.' }, { status: 404 });
    }

    // 2. Buscar tokens existentes de check-in
    const { data: tokens, error: tErr } = await ctx.admin
      .from('reunioes_painel_tokens')
      .select('id, status, expira_em, revogado_em, created_at')
      .eq('reuniao_id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .order('created_at', { ascending: false });

    if (tErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar tokens.', detail: tErr.message },
        { status: 500 }
      );
    }

    const agora = new Date();
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
      token_info: tokenRecente,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao consultar token de check-in.', detail: err?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reunioes/[id]/checkin/token
 * Gera ou renova o token público exclusivo para Check-in da reunião.
 * O link expira às 23:59:59 da data da reunião no fuso do ministério (UTC-3).
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
      .select('id, titulo, status, data_reuniao')
      .eq('id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json({ error: 'Reunião não encontrada neste ministério.' }, { status: 404 });
    }

    if (reuniao.status === 'encerrada') {
      return NextResponse.json(
        { error: 'Não é possível gerar link para uma reunião já encerrada.', code: 'REUNIAO_ENCERRADA' },
        { status: 400 }
      );
    }

    if (reuniao.status === 'cancelada') {
      return NextResponse.json(
        { error: 'Não é possível gerar link para uma reunião cancelada.', code: 'REUNIAO_CANCELADA' },
        { status: 400 }
      );
    }

    // 2. Calcular expiração às 23:59:59 da data da reunião
    const agora = new Date();
    const expiraEmIso = calcularExpiracaoFimDoDiaReuniao(reuniao.data_reuniao);
    const expiraEm = new Date(expiraEmIso);
    const expiraEmFinal = expiraEm.getTime() < agora.getTime() ? agora : expiraEm;

    // 3. Gerar token criptográfico bruto e hash SHA-256
    const rawToken = gerarTokenPainel();
    const tokenHash = hashTokenPainel(rawToken);

    // 4. Inserir novo token com status ativo
    const { error: insErr } = await ctx.admin
      .from('reunioes_painel_tokens')
      .insert({
        reuniao_id: reuniaoId,
        ministry_id: ctx.ministryId,
        token_hash: tokenHash,
        status: 'ativo',
        expira_em: expiraEmFinal.toISOString(),
      })
      .select('id, status, expira_em, created_at')
      .single();

    if (insErr) {
      return NextResponse.json(
        { error: 'Erro ao registrar token de check-in.', detail: insErr.message },
        { status: 500 }
      );
    }

    // 5. Construir a URL pública completa de check-in
    const origin = request.nextUrl.origin || 'http://localhost:3000';
    const urlCheckin = `${origin}/reunioes/checkin/${rawToken}`;

    return NextResponse.json({
      success: true,
      mensagem: 'Token de check-in gerado com sucesso.',
      token: rawToken,
      url_checkin: urlCheckin,
      expira_em: expiraEmFinal.toISOString(),
      status: 'ativo',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao gerar token de check-in.', detail: err?.message },
      { status: 500 }
    );
  }
}
