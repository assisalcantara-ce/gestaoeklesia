/**
 * GET /api/v1/ministry/payment-charges
 *
 * Endpoint multi-tenant para consulta segura do extrato e cobranças de arrecadação digital (PIX).
 * Utiliza o service_role do servidor com resolveTenantAuth para garantir conformidade e
 * imunidade a discrepâncias de RLS para administradores, tesoureiros e gestores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isArrecadacaoDigitalAllowedForTenant } from '@/lib/plan-permissions';
import { temAcesso } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

function checkHasChargesReadAccess(ctx: { isOwner: boolean; nivel?: string | null; roles?: string[]; permissions?: string[] }) {
  if (ctx.isOwner) return true;
  const nivel = ctx.nivel as any;
  if (temAcesso(nivel, 'tesouraria') || temAcesso(nivel, 'financeiro')) return true;
  const perms = [...(ctx.roles ?? []), ...(ctx.permissions ?? [])].map((p) => p.toUpperCase());
  return perms.some((p) =>
    [
      'ADMINISTRADOR',
      'ADMIN',
      'TESOUREIRO_GERAL',
      'FINANCEIRO',
      'TESOURARIA_LOCAL',
      'FINANCEIRO_LOCAL',
      'ADMIN_LOCAL',
    ].includes(p)
  );
}

function isLocalUser(ctx: { nivel?: string | null; congregacaoId?: string | null }) {
  const localNiveis = ['tesouraria_local', 'financeiro_local', 'secretaria_local', 'admin_local'];
  const globalNiveis = ['administrador', 'secretario_geral', 'tesoureiro_geral', 'financeiro'];
  return localNiveis.includes(ctx.nivel ?? '') || (Boolean(ctx.congregacaoId) && !globalNiveis.includes(ctx.nivel ?? ''));
}

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

  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério associado.' }, { status: 403 });
  }

  const allowedPlan = await isArrecadacaoDigitalAllowedForTenant(ctx.admin, ctx.ministryId);
  if (!allowedPlan) {
    return NextResponse.json(
      {
        error: 'A funcionalidade Arrecadação Digital está disponível a partir do Plano Intermediário.',
        code: 'PLAN_RESTRICTED',
        required_plan: 'intermediario',
      },
      { status: 403 }
    );
  }

  if (!checkHasChargesReadAccess(ctx)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  const urlObj = new URL(request.url);
  const page = Math.max(1, parseInt(urlObj.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(urlObj.searchParams.get('pageSize') || '50', 10)));
  const querySearch = (urlObj.searchParams.get('q') || '').trim();
  const statusParam = urlObj.searchParams.get('status') || '';
  const destinationParam = urlObj.searchParams.get('destination_id') || '';
  const congParam = urlObj.searchParams.get('congregacao_id') || '';
  const mesParam = urlObj.searchParams.get('mes') || ''; // Formato YYYY-MM

  try {
    let query = ctx.admin
      .from('fin_payment_charges')
      .select(
        `
        id, destination_id, gateway_charge_id, valor_solicitado, valor_pago,
        payer_name, payer_document, status, paid_at, created_at, tesouraria_lancamento_id,
        fin_payment_destinations (
          id, label, tipo_recebimento, congregacao_id,
          congregacoes (id, nome)
        )
      `,
        { count: 'exact' }
      )
      .eq('ministry_id', ctx.ministryId);

    // Filtro por Mês de Referência (YYYY-MM)
    if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
      const [anoStr, mesStr] = mesParam.split('-');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10);
      const startIso = new Date(ano, mes - 1, 1).toISOString();
      const endIso = new Date(ano, mes, 0, 23, 59, 59, 999).toISOString();
      query = query.gte('created_at', startIso).lte('created_at', endIso);
    }

    // Filtros
    if (statusParam) {
      query = query.eq('status', statusParam);
    } else {
      // Por padrão, exclui cancelados do extrato regular
      query = query.not('status', 'in', '("canceled","cancelado","cancelled","cancelada")');
    }

    if (destinationParam) {
      query = query.eq('destination_id', destinationParam);
    }

    // FINANCEIRO_LOCAL / Usuário Local: restringe pela congregação
    if (isLocalUser(ctx) && ctx.congregacaoId) {
      // Busca destinos da congregação do usuário local
      const { data: localDests } = await ctx.admin
        .from('fin_payment_destinations')
        .select('id')
        .eq('ministry_id', ctx.ministryId)
        .eq('congregacao_id', ctx.congregacaoId);

      const localDestIds = (localDests ?? []).map((d: any) => d.id);
      if (localDestIds.length > 0) {
        query = query.in('destination_id', localDestIds);
      } else {
        return NextResponse.json({
          data: [],
          summary: { totalArrecadado: 0, transacoesPagas: 0 },
          meta: { page: 1, pageSize, totalCount: 0, totalPages: 1 },
        });
      }
    } else if (congParam) {
      const { data: congDests } = await ctx.admin
        .from('fin_payment_destinations')
        .select('id')
        .eq('ministry_id', ctx.ministryId)
        .eq('congregacao_id', congParam);

      const congDestIds = (congDests ?? []).map((d: any) => d.id);
      if (congDestIds.length > 0) {
        query = query.in('destination_id', congDestIds);
      } else {
        return NextResponse.json({
          data: [],
          summary: { totalArrecadado: 0, transacoesPagas: 0 },
          meta: { page: 1, pageSize, totalCount: 0, totalPages: 1 },
        });
      }
    }

    if (querySearch) {
      query = query.or(
        `payer_name.ilike.%${querySearch}%,payer_document.ilike.%${querySearch}%,gateway_charge_id.ilike.%${querySearch}%`
      );
    }

    // Ordenação e Paginação
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: charges, error, count } = await query;

    if (error) {
      console.error('[GET /api/v1/ministry/payment-charges] Error:', error);
      return NextResponse.json({ error: 'Erro ao buscar cobranças.' }, { status: 500 });
    }

    // Cálculo das Métricas Gerais de Arrecadação Digital (sempre considerando todos os registros pagos do ministério)
    let summaryQuery = ctx.admin
      .from('fin_payment_charges')
      .select('valor_pago, status')
      .eq('ministry_id', ctx.ministryId)
      .in('status', ['pago', 'paid', 'concluida', 'received', 'confirmed']);

    if (isLocalUser(ctx) && ctx.congregacaoId) {
      const { data: localDests } = await ctx.admin
        .from('fin_payment_destinations')
        .select('id')
        .eq('ministry_id', ctx.ministryId)
        .eq('congregacao_id', ctx.congregacaoId);
      const ids = (localDests ?? []).map((d: any) => d.id);
      if (ids.length > 0) {
        summaryQuery = summaryQuery.in('destination_id', ids);
      }
    }

    const { data: summaryData } = await summaryQuery;

    const totalArrecadado = (summaryData ?? []).reduce(
      (acc: number, item: any) => acc + Number(item.valor_pago ?? 0),
      0
    );
    const transacoesPagas = (summaryData ?? []).length;

    return NextResponse.json({
      data: charges ?? [],
      summary: {
        totalArrecadado,
        transacoesPagas,
      },
      meta: {
        page,
        pageSize,
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize) || 1,
      },
    });
  } catch (err: any) {
    console.error('[GET /api/v1/ministry/payment-charges] Unexpected:', err);
    return NextResponse.json({ error: 'Erro interno ao processar extrato PIX.' }, { status: 500 });
  }
}
