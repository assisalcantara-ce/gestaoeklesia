import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { decryptCredentials } from '@/lib/ministry-credentials';
import {
  getOrCreateAsaasCustomer,
  createAsaasPixCharge,
  futureDateStr,
} from '@/lib/asaas-eventos';

export const dynamic = 'force-dynamic';

const PIX_EXPIRY_DAYS = 2; // PIX vence em 2 dias

function sanitize(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, 500) : '';
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const slug      = sanitize(body.slug);
  const nome      = sanitize(body.nome);
  const email     = sanitize(body.email).toLowerCase();
  const telefone  = sanitize(body.telefone);
  const igreja    = sanitize(body.igreja);
  const cidade    = sanitize(body.cidade);
  const cpfCnpj   = sanitize(body.cpf_cnpj);  // opcional para PIX

  // Validações básicas
  if (!slug) return NextResponse.json({ error: 'Slug do evento é obrigatório.' }, { status: 400 });
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }
  if (!telefone) return NextResponse.json({ error: 'Telefone é obrigatório.' }, { status: 400 });

  const admin = createServerClient();

  // Buscar evento público
  const { data: evento, error: evErr } = await admin
    .from('eventos')
    .select('id, titulo, ministry_id, status, is_publico, aceita_inscricao, capacidade, data_inicio, valor_inscricao')
    .eq('slug', slug)
    .maybeSingle();

  if (evErr || !evento) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }

  // Validações de negócio
  if (!evento.is_publico) {
    // Retorna 404 (não 403) para não revelar que o slug existe mas é privado
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }
  if (!evento.aceita_inscricao) {
    return NextResponse.json({ error: 'Este evento não está aceitando inscrições no momento.' }, { status: 409 });
  }
  if (evento.status === 'cancelado') {
    return NextResponse.json({ error: 'Este evento foi cancelado.' }, { status: 409 });
  }
  if (evento.status === 'realizado') {
    return NextResponse.json({ error: 'Este evento já foi realizado. Não é possível realizar novas inscrições.' }, { status: 409 });
  }

  // Verificar duplicidade por email
  // Permite nova inscrição se a anterior foi expirada ou cancelada (ex: PIX vencido)
  const { data: jaInscrito } = await admin
    .from('eventos_inscricoes')
    .select('id, status')
    .eq('evento_id', evento.id)
    .eq('email_externo', email)
    .maybeSingle();

  if (jaInscrito && !['expirado', 'cancelado'].includes(jaInscrito.status)) {
    return NextResponse.json({
      error: 'Este e-mail já possui uma inscrição neste evento.',
      inscricao_id: jaInscrito.id,
      status: jaInscrito.status,
    }, { status: 409 });
  }

  // Determinar status da inscrição: confirmado, aguardando_pagamento ou lista_espera
  const isPago = Number(evento.valor_inscricao) > 0;
  let statusInscricao: 'confirmado' | 'lista_espera' | 'aguardando_pagamento' = 'confirmado';
  let temVaga = true;

  if (evento.capacidade != null) {
    // Conta confirmados + aguardando_pagamento para evitar overbooking
    // (inscrições pendentes de pagamento reservam a vaga temporariamente)
    const { count } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .in('status', ['confirmado', 'aguardando_pagamento']);

    if ((count ?? 0) >= evento.capacidade) {
      temVaga = false;
      statusInscricao = 'lista_espera';
    }
  }

  if (temVaga && isPago) {
    statusInscricao = 'aguardando_pagamento';
  }

  // Observações com dados extras (igreja/cidade)
  const obsPartes: string[] = [];
  if (igreja) obsPartes.push(`Igreja: ${igreja}`);
  if (cidade) obsPartes.push(`Cidade: ${cidade}`);
  const observacoes = obsPartes.length > 0 ? obsPartes.join(' | ') : null;

  // Inserir inscrição
  const { data: inscricao, error: insErr } = await admin
    .from('eventos_inscricoes')
    .insert({
      evento_id: evento.id,
      ministry_id: evento.ministry_id,
      member_id: null,
      nome_externo: nome,
      email_externo: email,
      telefone,
      status: statusInscricao,
      observacoes,
      presente: false,
    })
    .select('id, status')
    .single();

  if (insErr || !inscricao) {
    // Conflito de índice único (race condition)
    if (insErr?.code === '23505') {
      return NextResponse.json({ error: 'Este e-mail já possui uma inscrição neste evento.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao registrar inscrição. Tente novamente.' }, { status: 500 });
  }

  // ── Fluxo Gratuito ou Lista de Espera ────────────────────────────────────────
  if (!isPago || statusInscricao === 'lista_espera') {
    return NextResponse.json({
      inscricao_id: inscricao.id,
      status: inscricao.status,
      nome,
      evento_titulo: evento.titulo,
      data_inicio: evento.data_inicio,
    }, { status: 201 });
  }

  // ── Fluxo Pago (aguardando_pagamento) — Gerar PIX ASAAS ───────────────────
  try {
    // Buscar gateway ASAAS ativo do ministério
    const { data: gateway } = await admin
      .from('ministry_payment_gateways')
      .select('encrypted_credentials, webhook_token')
      .eq('ministry_id', evento.ministry_id)
      .eq('gateway', 'asaas')
      .eq('is_active', true)
      .maybeSingle();

    if (!gateway?.encrypted_credentials) {
      // Sem gateway configurado: aceita como confirmado (fallback gracioso)
      await admin
        .from('eventos_inscricoes')
        .update({ status: 'confirmado' })
        .eq('id', inscricao.id);

      return NextResponse.json({
        inscricao_id: inscricao.id,
        status: 'confirmado',
        nome,
        evento_titulo: evento.titulo,
        data_inicio: evento.data_inicio,
        aviso: 'Gateway de pagamento não configurado. Inscrição confirmada sem cobrança.',
      }, { status: 201 });
    }

    const creds = decryptCredentials(gateway.encrypted_credentials);
    const apiKey = creds.api_key;
    if (!apiKey) throw new Error('Credencial api_key ausente no gateway.');

    // Customer ASAAS
    const customerId = await getOrCreateAsaasCustomer(apiKey, nome, email, cpfCnpj || null);

    // Cobrança PIX
    const dueDate = futureDateStr(PIX_EXPIRY_DAYS);
    const charge = await createAsaasPixCharge(
      apiKey,
      customerId,
      Number(evento.valor_inscricao),
      `Inscrição: ${evento.titulo}`,
      inscricao.id,
      dueDate
    );

    // Calcular expires_at (dueDate + fim do dia no horário de Brasília)
    const expiresAt = new Date(`${dueDate}T23:59:59-03:00`).toISOString();

    // Salvar pagamento
    const { data: pagamento, error: pagErr } = await admin
      .from('eventos_pagamentos')
      .insert({
        ministry_id:         evento.ministry_id,
        evento_id:           evento.id,
        inscricao_id:        inscricao.id,
        gateway:             'asaas',
        gateway_charge_id:   charge.id,
        gateway_customer_id: customerId,
        gateway_response:    charge as unknown as Record<string, unknown>,
        payment_method:      'pix',
        valor:               Number(evento.valor_inscricao),
        status:              'pendente',
        pix_payload:         charge.pix?.payload ?? null,
        pix_qrcode:          charge.pix?.encodedImage ?? null,
        invoice_url:         charge.invoiceUrl ?? null,
        expires_at:          expiresAt,
      })
      .select('id')
      .single();

    if (pagErr || !pagamento) {
      console.error('[inscricao/route] Erro ao salvar eventos_pagamentos:', pagErr);
    }

    return NextResponse.json({
      inscricao_id:    inscricao.id,
      pagamento_id:    pagamento?.id ?? null,
      status:          inscricao.status,
      nome,
      evento_titulo:   evento.titulo,
      data_inicio:     evento.data_inicio,
      pago:            true,
      valor:           Number(evento.valor_inscricao),
      pix: {
        payload:        charge.pix?.payload ?? null,
        qrcode_base64:  charge.pix?.encodedImage ?? null,
        expira_em:      expiresAt,
        invoice_url:    charge.invoiceUrl ?? null,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[inscricao/route] Erro no fluxo PIX ASAAS:', (err as Error).message);
    // Reverter inscrição para não deixar órfã
    await admin.from('eventos_inscricoes').delete().eq('id', inscricao.id);
    return NextResponse.json({
      error: 'Não foi possível gerar o PIX. Tente novamente em instantes.',
    }, { status: 502 });
  }
}
