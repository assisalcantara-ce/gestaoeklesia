/**
 * GET /api/v1/ministry/payment-destinations
 * POST /api/v1/ministry/payment-destinations
 *
 * CRUD de destinos de arrecadação digital (PIX).
 *
 * Permissões:
 *   GET/POST: administrador | financeiro | financeiro_local
 *   FINANCEIRO_LOCAL: só vê/cria para sua congregação
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

const TIPOS_VALIDOS = ['dizimo', 'oferta', 'missoes', 'doacao', 'campanha_local', 'evento_local'] as const;
const NIVEIS_PERMITIDOS = ['administrador', 'financeiro', 'financeiro_local'] as const;

// ─── GET — lista destinos ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const ctx = await resolveTenantAuth(request);
  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério.' }, { status: 403 });
  }

  const hasAccess =
    ctx.isOwner ||
    (NIVEIS_PERMITIDOS as readonly string[]).includes(ctx.nivel ?? '');

  if (!hasAccess) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  let query = ctx.admin
    .from('fin_payment_destinations')
    .select(`
      id, ministry_id, gateway_id, congregacao_id, conta_id, categoria_id,
      tipo_recebimento, label, descricao, cor, icone, public_token,
      valor_fixo, is_ativo, expires_at, created_at, updated_at,
      congregacoes(nome)
    `)
    .eq('ministry_id', ctx.ministryId)
    .order('created_at', { ascending: false });

  // FINANCEIRO_LOCAL: só vê a própria congregação
  if (ctx.nivel === 'financeiro_local' && ctx.congregacaoId) {
    query = query.eq('congregacao_id', ctx.congregacaoId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar destinos.' }, { status: 500 });
  }

  // Total arrecadado por destino
  const ids = (data ?? []).map((d) => d.id);
  const totals: Record<string, number> = {};

  if (ids.length > 0) {
    const { data: charges } = await ctx.admin
      .from('fin_payment_charges')
      .select('destination_id, valor_pago')
      .in('destination_id', ids)
      .eq('status', 'pago');

    (charges ?? []).forEach((c) => {
      totals[c.destination_id] =
        (totals[c.destination_id] ?? 0) + Number(c.valor_pago ?? 0);
    });
  }

  const enriched = (data ?? []).map((d) => ({
    ...d,
    total_arrecadado: totals[d.id] ?? 0,
  }));

  return NextResponse.json({ data: enriched });
}

// ─── POST — cria destino ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ctx = await resolveTenantAuth(request);
  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério.' }, { status: 403 });
  }

  const canCreate =
    ctx.isOwner ||
    (NIVEIS_PERMITIDOS as readonly string[]).includes(ctx.nivel ?? '');

  if (!canCreate) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const {
    label,
    tipo_recebimento,
    congregacao_id,
    conta_id,
    categoria_id,
    gateway_id,
    valor_fixo,
    descricao,
    expires_at,
  } = body;

  if (!label || typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'Campo "label" é obrigatório.' }, { status: 400 });
  }

  if (
    !tipo_recebimento ||
    !(TIPOS_VALIDOS as readonly string[]).includes(String(tipo_recebimento))
  ) {
    return NextResponse.json(
      { error: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}` },
      { status: 400 }
    );
  }

  // FINANCEIRO_LOCAL: só pode criar para sua própria congregação
  const congId =
    ctx.nivel === 'financeiro_local'
      ? ctx.congregacaoId
      : ((congregacao_id as string | undefined) ?? null);

  if (ctx.nivel === 'financeiro_local' && congregacao_id && congregacao_id !== ctx.congregacaoId) {
    return NextResponse.json(
      { error: 'FINANCEIRO_LOCAL só pode criar destinos para sua própria congregação.' },
      { status: 403 }
    );
  }

  // Resolve gateway: usa o fornecido ou busca o ASAAS ativo do ministério
  let resolvedGatewayId = (gateway_id as string | undefined) ?? null;
  if (!resolvedGatewayId) {
    const { data: gw } = await ctx.admin
      .from('ministry_payment_gateways')
      .select('id')
      .eq('ministry_id', ctx.ministryId)
      .eq('gateway', 'asaas')
      .eq('is_active', true)
      .maybeSingle();
    resolvedGatewayId = gw?.id ?? null;
  }

  if (!resolvedGatewayId) {
    return NextResponse.json(
      {
        error:
          'Nenhum gateway ASAAS ativo encontrado. Configure o ASAAS em Configurações → Gateways antes de criar destinos.',
        code: 'NO_GATEWAY',
      },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();

  const { data, error } = await ctx.admin
    .from('fin_payment_destinations')
    .insert({
      ministry_id:      ctx.ministryId,
      gateway_id:       resolvedGatewayId,
      congregacao_id:   congId ?? null,
      conta_id:         (conta_id as string | undefined) ?? null,
      categoria_id:     (categoria_id as string | undefined) ?? null,
      tipo_recebimento: String(tipo_recebimento),
      label:            String(label).trim().slice(0, 100),
      descricao:        descricao ? String(descricao).trim().slice(0, 500) : null,
      valor_fixo:       valor_fixo != null ? Number(valor_fixo) : null,
      expires_at:       expires_at ? new Date(String(expires_at)).toISOString() : null,
      is_ativo:         true,
      created_at:       now,
      updated_at:       now,
    })
    .select(`
      id, ministry_id, gateway_id, congregacao_id, conta_id, categoria_id,
      tipo_recebimento, label, descricao, public_token,
      valor_fixo, is_ativo, expires_at, created_at, updated_at
    `)
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Erro ao criar destino.', detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
