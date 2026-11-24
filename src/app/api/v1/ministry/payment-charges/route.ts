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
import { buildPeriodFilterBounds } from '@/lib/financial-date-utils';
import { fetchAllRowsInBatches } from '@/lib/financial-query-helper';
import { computeCanonicalPixSummary } from '@/lib/financial-indicators-service';

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
  const dataInicioParam = urlObj.searchParams.get('data_inicio') || urlObj.searchParams.get('dataInicio') || urlObj.searchParams.get('start_date') || '';
  const dataFimParam = urlObj.searchParams.get('data_fim') || urlObj.searchParams.get('dataFim') || urlObj.searchParams.get('end_date') || '';

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

    // Filtro por Período de Datas ou Mês de Referência (YYYY-MM) no fuso institucional UTC-3
    const bounds = buildPeriodFilterBounds(dataInicioParam, dataFimParam, mesParam);
    if (bounds.startIso && bounds.endIso) {
      query = query.gte('created_at', bounds.startIso).lte('created_at', bounds.endIso);
    } else if (bounds.startIso) {
      query = query.gte('created_at', bounds.startIso);
    } else if (bounds.endIso) {
      query = query.lte('created_at', bounds.endIso);
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
      if (destinationParam) {
        if (!localDestIds.includes(destinationParam)) {
          return NextResponse.json({
            data: [],
            summary: { totalArrecadado: 0, transacoesPagas: 0 },
            meta: { page: 1, pageSize, totalCount: 0, totalPages: 1 },
          });
        }
      } else if (localDestIds.length > 0) {
        query = query.in('destination_id', localDestIds);
      } else {
        return NextResponse.json({
          data: [],
          summary: { totalArrecadado: 0, transacoesPagas: 0 },
          meta: { page: 1, pageSize, totalCount: 0, totalPages: 1 },
        });
      }
    } else if (congParam === 'none') {
      const { data: noCongDests } = await ctx.admin
        .from('fin_payment_destinations')
        .select('id')
        .eq('ministry_id', ctx.ministryId)
        .is('congregacao_id', null);

      const noCongDestIds = (noCongDests ?? []).map((d: any) => d.id);
      if (destinationParam) {
        if (!noCongDestIds.includes(destinationParam)) {
          return NextResponse.json({
            data: [],
            summary: { totalArrecadado: 0, transacoesPagas: 0 },
            meta: { page: 1, pageSize, totalCount: 0, totalPages: 1 },
          });
        }
      } else if (noCongDestIds.length > 0) {
        query = query.in('destination_id', noCongDestIds);
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
      if (destinationParam) {
        if (!congDestIds.includes(destinationParam)) {
          return NextResponse.json({
            data: [],
            summary: { totalArrecadado: 0, transacoesPagas: 0 },
            meta: { page: 1, pageSize, totalCount: 0, totalPages: 1 },
          });
        }
      } else if (congDestIds.length > 0) {
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

    // Ordenação e Paginação (ordem cronológica decrescente estrita por created_at e desempate por id)
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    const { data: charges, error, count } = await query;

    if (error) {
      console.error('[GET /api/v1/ministry/payment-charges] Error:', error);
      return NextResponse.json({ error: 'Erro ao buscar cobranças.' }, { status: 500 });
    }

    // Cálculo das Métricas de Arrecadação Digital sincronizadas com os mesmos filtros ativos
    let summaryQuery = ctx.admin
      .from('fin_payment_charges')
      .select('destination_id, valor_pago, valor_solicitado, status')
      .eq('ministry_id', ctx.ministryId)
      .in('status', ['pago', 'paid', 'concluida', 'received', 'confirmed']);

    // Aplicar os mesmos filtros temporais na agregação, usando paid_at (data de pagamento)
    // para coincidir com o filtro da tabela no frontend, que filtra pela data civil do pagamento.
    // Registros sem paid_at (pendentes/expirados) são excluídos do summary pelo filtro de status acima.
    if (bounds.startIso && bounds.endIso) {
      summaryQuery = summaryQuery.gte('paid_at', bounds.startIso).lte('paid_at', bounds.endIso);
    } else if (bounds.startIso) {
      summaryQuery = summaryQuery.gte('paid_at', bounds.startIso);
    } else if (bounds.endIso) {
      summaryQuery = summaryQuery.lte('paid_at', bounds.endIso);
    }

    if (destinationParam) {
      summaryQuery = summaryQuery.eq('destination_id', destinationParam);
    }

    if (isLocalUser(ctx) && ctx.congregacaoId) {
      const { data: localDests } = await ctx.admin
        .from('fin_payment_destinations')
        .select('id')
        .eq('ministry_id', ctx.ministryId)
        .eq('congregacao_id', ctx.congregacaoId);
      const ids = (localDests ?? []).map((d: any) => d.id);
      if (ids.length > 0) {
        summaryQuery = summaryQuery.in('destination_id', ids);
      } else {
        summaryQuery = summaryQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    } else if (congParam === 'none') {
      const { data: noCongDests } = await ctx.admin
        .from('fin_payment_destinations')
        .select('id')
        .eq('ministry_id', ctx.ministryId)
        .is('congregacao_id', null);
      const ids = (noCongDests ?? []).map((d: any) => d.id);
      if (ids.length > 0) {
        summaryQuery = summaryQuery.in('destination_id', ids);
      } else {
        summaryQuery = summaryQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    } else if (congParam) {
      const { data: congDests } = await ctx.admin
        .from('fin_payment_destinations')
        .select('id')
        .eq('ministry_id', ctx.ministryId)
        .eq('congregacao_id', congParam);
      const ids = (congDests ?? []).map((d: any) => d.id);
      if (ids.length > 0) {
        summaryQuery = summaryQuery.in('destination_id', ids);
      } else {
        summaryQuery = summaryQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    if (querySearch) {
      summaryQuery = summaryQuery.or(
        `payer_name.ilike.%${querySearch}%,payer_document.ilike.%${querySearch}%,gateway_charge_id.ilike.%${querySearch}%`
      );
    }

    // Agregação canônica integral em lotes (sem truncamento silencioso no teto de 1.000 linhas)
    const { data: summaryData } = await fetchAllRowsInBatches<{
      destination_id: string | null;
      valor_pago: number | null;
      valor_solicitado: number | null;
      status: string;
    }>(async (rangeStart, rangeEnd) => {
      return summaryQuery.range(rangeStart, rangeEnd);
    }, { pageSize: 1000 });

    const pixSummary = computeCanonicalPixSummary(summaryData);

    return NextResponse.json({
      data: charges ?? [],
      summary: {
        totalArrecadado: pixSummary.totalArrecadadoBruto,
        transacoesPagas: pixSummary.totalTransacoesPagas,
        destinosDistintos: pixSummary.destinosDistintos,
        ticketMedio: pixSummary.ticketMedio,
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
