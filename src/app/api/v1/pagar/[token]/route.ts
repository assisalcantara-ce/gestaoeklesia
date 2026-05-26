/**
 * GET  /api/v1/pagar/[token]   — info pública do destino (sem auth)
 * POST /api/v1/pagar/[token]   — gera cobrança PIX no ASAAS (sem auth)
 *
 * SEGURANÇA:
 * - Nunca expõe ministry_id ou IDs internos na resposta
 * - public_token é revogável (is_ativo = false)
 * - Verifica expiração (expires_at)
 * - Idempotência: gateway_charge_id UNIQUE em fin_payment_charges
 * - Valor sanitizado e limitado
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { decryptCredentials } from '@/lib/ministry-credentials';
import {
  getOrCreateAsaasCustomer,
  createAsaasPixCharge,
  futureDateStr,
} from '@/lib/asaas-eventos';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string }> };

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET — info pública ───────────────────────────────────────────────────────
export async function GET(_request: NextRequest, context: Ctx) {
  const { token } = await context.params;

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
  }

  const admin = createServerClient();

  const { data: dest } = await admin
    .from('fin_payment_destinations')
    .select('label, descricao, tipo_recebimento, valor_fixo, is_ativo, expires_at, congregacoes(nome)')
    .eq('public_token', token)
    .maybeSingle();

  if (!dest || !dest.is_ativo) {
    return NextResponse.json({ error: 'Link de pagamento inválido ou inativo.' }, { status: 404 });
  }

  if (dest.expires_at && new Date(dest.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Este link de pagamento expirou.' }, { status: 410 });
  }

  const TIPO_LABELS: Record<string, string> = {
    dizimo:        'Dízimo',
    oferta:        'Oferta',
    missoes:       'Missões',
    doacao:        'Doação',
    campanha_local: 'Campanha',
    evento_local:  'Evento',
  };

  return NextResponse.json({
    label:            dest.label,
    descricao:        dest.descricao ?? null,
    tipo_recebimento: dest.tipo_recebimento,
    tipo_label:       TIPO_LABELS[dest.tipo_recebimento] ?? dest.tipo_recebimento,
    valor_fixo:       dest.valor_fixo ?? null,
    congregacao_nome: (dest.congregacoes as unknown as { nome: string } | null)?.nome ?? null,
  });
}

// ─── POST — gera cobrança PIX ─────────────────────────────────────────────────
export async function POST(request: NextRequest, context: Ctx) {
  const { token } = await context.params;

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
  }

  let body: { nome?: unknown; email?: unknown; valor?: unknown; cpfCnpj?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const nome    = String(body.nome    ?? '').trim().slice(0, 150);
  const email   = String(body.email   ?? '').trim().toLowerCase().slice(0, 255);
  const cpfCnpj = String(body.cpfCnpj ?? '').replace(/\D/g, '').slice(0, 14) || null;

  if (!nome) {
    return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  const admin = createServerClient();

  // Busca destino com joins necessários
  const { data: dest } = await admin
    .from('fin_payment_destinations')
    .select(
      'id, ministry_id, gateway_id, label, tipo_recebimento, valor_fixo, is_ativo, expires_at, congregacao_id, conta_id, categoria_id, congregacoes(nome)'
    )
    .eq('public_token', token)
    .maybeSingle();

  if (!dest || !dest.is_ativo) {
    return NextResponse.json({ error: 'Link inválido ou inativo.' }, { status: 404 });
  }

  if (dest.expires_at && new Date(dest.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expirado.' }, { status: 410 });
  }

  // Resolve valor
  let valor: number;
  if (dest.valor_fixo != null) {
    valor = Number(dest.valor_fixo);
  } else {
    valor = Number(body.valor ?? 0);
    if (!valor || valor <= 0) {
      return NextResponse.json({ error: 'Informe um valor maior que zero.' }, { status: 400 });
    }
  }

  if (valor < 0.01 || valor > 99999.99) {
    return NextResponse.json(
      { error: 'Valor fora do intervalo permitido (R$ 0,01 – R$ 99.999,99).' },
      { status: 400 }
    );
  }

  // Busca gateway ASAAS com credenciais
  const { data: gw } = await admin
    .from('ministry_payment_gateways')
    .select('encrypted_credentials')
    .eq('id', dest.gateway_id)
    .eq('gateway', 'asaas')
    .eq('is_active', true)
    .maybeSingle();

  if (!gw?.encrypted_credentials) {
    return NextResponse.json(
      { error: 'Gateway de pagamento não disponível no momento.' },
      { status: 503 }
    );
  }

  let apiKey: string;
  try {
    const creds = decryptCredentials(gw.encrypted_credentials) as Record<string, string>;
    apiKey = creds.apiKey ?? creds.api_key ?? '';
    if (!apiKey) throw new Error('apiKey ausente');
  } catch {
    return NextResponse.json({ error: 'Configuração de pagamento inválida.' }, { status: 503 });
  }

  // externalReference: fpd: + UUID sem hifens (40 chars total)
  const extRef = `fpd:${dest.id.replace(/-/g, '')}`;

  const TIPO_LABELS: Record<string, string> = {
    dizimo:        'Dízimo',
    oferta:        'Oferta',
    missoes:       'Missões',
    doacao:        'Doação',
    campanha_local: 'Campanha',
    evento_local:  'Evento',
  };

  const congNome = (dest.congregacoes as unknown as { nome: string } | null)?.nome ?? 'Ministério';
  const descricao = `${TIPO_LABELS[dest.tipo_recebimento] ?? dest.tipo_recebimento} — ${dest.label} (${congNome})`;

  try {
    // 1. Cria/encontra customer ASAAS
    const customerId = await getOrCreateAsaasCustomer(apiKey, nome, email, cpfCnpj);

    // 2. Cria cobrança PIX (vence em 2 dias)
    const dueDate = futureDateStr(2);
    const charge  = await createAsaasPixCharge(apiKey, customerId, valor, descricao, extRef, dueDate);

    // 3. Persiste em fin_payment_charges
    const now            = new Date().toISOString();
    const idempotencyKey = `${dest.id}_${charge.id}`;

    const { data: saved } = await admin
      .from('fin_payment_charges')
      .insert({
        ministry_id:          dest.ministry_id,
        destination_id:       dest.id,
        gateway:              'asaas',
        gateway_charge_id:    charge.id,
        gateway_customer_id:  customerId,
        gateway_external_ref: extRef,
        charge_type:          'pix_dinamico',
        payment_method:       'pix',
        valor_solicitado:     valor,
        pix_payload:          charge.pix?.payload ?? null,
        pix_qrcode_url:       charge.pix?.encodedImage
          ? `data:image/png;base64,${charge.pix.encodedImage}`
          : null,
        invoice_url:          charge.invoiceUrl ?? null,
        payer_name:           nome,
        payer_document:       cpfCnpj ?? null,
        payer_email:          email || null,
        status:               'pendente',
        idempotency_key:      idempotencyKey,
        expires_at:           charge.pix?.expirationDate ?? null,
        created_at:           now,
        updated_at:           now,
      })
      .select('id')
      .single();

    return NextResponse.json(
      {
        charge_id:   saved?.id ?? null,
        pix_payload: charge.pix?.payload ?? null,
        pix_qrcode:  charge.pix?.encodedImage
          ? `data:image/png;base64,${charge.pix.encodedImage}`
          : null,
        invoice_url: charge.invoiceUrl ?? null,
        expires_at:  charge.pix?.expirationDate ?? null,
        valor,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao gerar cobrança PIX.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
