/**
 * POST /api/v1/mobile/financeiro/pix
 *
 * Cria uma cobrança PIX dinâmica para contribuição (dízimo/oferta/campanha)
 * vinculada com segurança ao membro autenticado.
 *
 * SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Destino validado no banco: ativo, não expirado e pertencente ao mesmo ministério.
 * - Valor estritamente validado (> 0 e >= 1.00).
 * - Se anônimo: não vincula member_id na cobrança e não envia CPF ao gateway.
 * - Se identificado: vincula member_id = ctx.memberId e dados cadastrais do membro.
 * - Registra em fin_payment_charges com status='pendente'.
 * - Não cria lançamento em tesouraria_lancamentos (isso ocorre via webhook oficial).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';
import { decryptCredentials } from '@/lib/ministry-credentials';
import {
  getOrCreateAsaasCustomer,
  createAsaasPixCharge,
  futureDateStr,
} from '@/lib/asaas-eventos';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Parse do body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    const destinationId = typeof body.destinationId === 'string' ? body.destinationId.trim() : '';
    const valor = Number(body.valor);
    const isAnonimo = body.anonimo === true;

    if (!destinationId) {
      return NextResponse.json({ error: 'destinationId é obrigatório.' }, { status: 400 });
    }

    if (isNaN(valor) || valor <= 0 || !isFinite(valor)) {
      return NextResponse.json({ error: 'Valor da contribuição deve ser um número positivo.' }, { status: 400 });
    }

    if (valor < 1.00) {
      return NextResponse.json({ error: 'O valor mínimo para contribuição via PIX é R$ 1,00.' }, { status: 400 });
    }

    if (valor > 100000.00) {
      return NextResponse.json({ error: 'Valor excede o limite máximo permitido.' }, { status: 400 });
    }

    // 2. Buscar dados do membro autenticado
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, name, email, cpf, congregacao_id')
      .eq('id', ctx.memberId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Cadastro do membro não encontrado.' }, { status: 404 });
    }

    // 3. Buscar e validar destino de arrecadação
    const { data: dest, error: destErr } = await admin
      .from('fin_payment_destinations')
      .select('id, ministry_id, congregacao_id, label, tipo_recebimento, valor_fixo, is_ativo, expires_at')
      .eq('id', destinationId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (destErr || !dest || !dest.is_ativo) {
      return NextResponse.json({ error: 'Destino de arrecadação não encontrado ou inativo.' }, { status: 404 });
    }

    if (dest.expires_at && new Date(dest.expires_at) <= new Date()) {
      return NextResponse.json({ error: 'Este destino de arrecadação está expirado.' }, { status: 400 });
    }

    // Validar congregação do destino
    if (dest.congregacao_id && member.congregacao_id && dest.congregacao_id !== member.congregacao_id) {
      return NextResponse.json({ error: 'Destino de arrecadação indisponível para sua congregação.' }, { status: 403 });
    }

    // Se o destino tiver valor fixo estrito
    if (dest.valor_fixo != null && Number(dest.valor_fixo) > 0) {
      if (Math.abs(Number(dest.valor_fixo) - valor) > 0.01) {
        return NextResponse.json({
          error: `Este destino exige o valor fixo de R$ ${Number(dest.valor_fixo).toFixed(2)}.`,
        }, { status: 400 });
      }
    }

    // 4. Buscar gateway ASAAS ativo do ministério
    const { data: gw, error: gwErr } = await admin
      .from('ministry_payment_gateways')
      .select('id, encrypted_credentials')
      .eq('ministry_id', ctx.ministryId)
      .eq('gateway', 'asaas')
      .eq('is_active', true)
      .maybeSingle();

    if (gwErr || !gw?.encrypted_credentials) {
      return NextResponse.json({
        error: 'O ministério ainda não configurou o gateway de pagamento PIX.',
        code: 'NO_GATEWAY',
      }, { status: 422 });
    }

    // Descriptografar apiKey
    let apiKey: string;
    try {
      const creds = decryptCredentials(gw.encrypted_credentials);
      apiKey = creds.apiKey ?? creds.api_key ?? '';
      if (!apiKey) throw new Error('apiKey ausente');
    } catch {
      return NextResponse.json({
        error: 'Credenciais do gateway de pagamento inválidas ou corrompidas.',
        code: 'GATEWAY_CREDENTIALS_ERROR',
      }, { status: 500 });
    }

    // 5. Configurar dados do pagador conforme modalidade (identificado vs. anônimo)
    let payerName: string;
    let payerEmail: string;
    let payerDoc: string | null = null;
    let chargeMemberId: string | null = null;

    if (isAnonimo) {
      payerName = 'Doador Anônimo';
      payerEmail = 'doacao.anonima@gestaoeklesia.com.br';
      payerDoc = null;
      chargeMemberId = null;
    } else {
      payerName = member.name || 'Membro';
      payerEmail = member.email || 'contribuinte@gestaoeklesia.com.br';
      payerDoc = member.cpf ? member.cpf.replace(/\D/g, '') : null;
      chargeMemberId = ctx.memberId;
    }

    // 6. Criar ou obter Customer no ASAAS
    let customerId: string;
    try {
      customerId = await getOrCreateAsaasCustomer(apiKey, payerName, payerEmail, payerDoc);
    } catch (err: any) {
      console.error('[mobile/financeiro/pix] erro ao criar customer ASAAS:', err.message);
      return NextResponse.json({
        error: `Erro ao registrar cliente no gateway de pagamento: ${err.message}`,
      }, { status: 502 });
    }

    // 7. Gerar cobrança PIX no ASAAS
    const tempChargeId = crypto.randomUUID();
    const externalRef = `fpc:${tempChargeId.replace(/-/g, '')}`;
    const dueDate = futureDateStr(2); // Vencimento padrão: 2 dias
    const descText = `${dest.label} — ${payerName}`;

    let asaasCharge: Awaited<ReturnType<typeof createAsaasPixCharge>>;
    try {
      asaasCharge = await createAsaasPixCharge(
        apiKey,
        customerId,
        valor,
        descText,
        externalRef,
        dueDate,
      );
    } catch (err: any) {
      console.error('[mobile/financeiro/pix] erro ao criar cobrança ASAAS:', err.message);
      return NextResponse.json({
        error: `Erro ao gerar cobrança PIX no gateway: ${err.message}`,
      }, { status: 502 });
    }

    // 8. Persistir cobrança em fin_payment_charges
    const nowStr = new Date().toISOString();
    const expiresAtStr = asaasCharge.pix?.expirationDate
      ? new Date(asaasCharge.pix.expirationDate).toISOString()
      : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const { data: createdCharge, error: insertErr } = await admin
      .from('fin_payment_charges')
      .insert({
        id:                   tempChargeId,
        ministry_id:          ctx.ministryId,
        destination_id:       dest.id,
        member_id:            chargeMemberId,
        gateway:              'asaas',
        gateway_charge_id:    asaasCharge.id,
        gateway_customer_id:  customerId,
        gateway_external_ref: externalRef,
        charge_type:          'pix_dinamico',
        payment_method:       'pix',
        valor_solicitado:     valor,
        valor_pago:           null,
        pix_payload:          asaasCharge.pix?.payload ?? null,
        pix_qrcode_url:       asaasCharge.pix?.encodedImage ?? null,
        invoice_url:          asaasCharge.invoiceUrl ?? null,
        payer_name:           payerName,
        payer_document:       payerDoc,
        payer_email:          payerEmail,
        status:               'pendente',
        idempotency_key:      tempChargeId,
        expires_at:           expiresAtStr,
        created_at:           nowStr,
        updated_at:           nowStr,
      })
      .select('id, status, valor_solicitado, pix_payload, pix_qrcode_url, expires_at')
      .single();

    if (insertErr || !createdCharge) {
      console.error('[mobile/financeiro/pix] erro ao salvar fin_payment_charges:', insertErr?.message);
      return NextResponse.json({ error: 'Erro ao registrar cobrança no sistema.' }, { status: 500 });
    }

    return NextResponse.json({
      chargeId: createdCharge.id,
      status: createdCharge.status,
      valor: Number(createdCharge.valor_solicitado),
      pixPayload: createdCharge.pix_payload,
      pixQrCode: createdCharge.pix_qrcode_url,
      expiresAt: createdCharge.expires_at,
    }, { status: 201 });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/financeiro/pix] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
