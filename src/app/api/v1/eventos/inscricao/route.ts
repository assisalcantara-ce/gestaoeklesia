import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { decryptCredentials } from '@/lib/ministry-credentials';
import {
  getOrCreateAsaasCustomer,
  createAsaasPixCharge,
  futureDateStr,
} from '@/lib/asaas-eventos';
import { avaliarStatusInscricao } from '@/lib/evento-status-utils';
import { verifyMemberPrefillToken } from '@/lib/evento-membro-token';

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

  const slug          = sanitize(body.slug);
  const nome          = sanitize(body.nome);
  const email         = sanitize(body.email).toLowerCase();
  const telefone      = sanitize(body.telefone);
  const congregacao   = sanitize(body.congregacao || body.igreja);
  const cpfCnpj       = sanitize(body.cpf_cnpj);  // opcional para PIX
  const memberToken   = sanitize(body.member_token); // token HMAC de confirmação segura de membro

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
    .select('id, titulo, ministry_id, status, is_publico, aceita_inscricao, capacidade, data_inicio, data_fim, valor_inscricao, evento_pago')
    .eq('slug', slug)
    .maybeSingle();

  if (evErr || !evento) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }

  // Validação da Feature Flag do Módulo de Eventos para o Tenant
  const isAllowed = await isFeatureAllowedForTenant(admin, evento.ministry_id, 'events_module');
  if (!isAllowed) {
    return NextResponse.json({ error: 'Inscrições desabilitadas para este ministério.' }, { status: 403 });
  }

  // Validação de visibilidade pública
  if (!evento.is_publico) {
    // Retorna 404 (não 403) para não revelar que o slug existe mas é privado
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }

  // Contagem de inscritos para avaliação de capacidade e concorrência
  let totalOcupados = 0;
  if (evento.capacidade != null) {
    const { count } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .in('status', ['confirmado', 'aguardando_pagamento']);
    totalOcupados = count ?? 0;
  }

  // Validação unificada de status do ciclo de vida e fuso horário de Brasília
  const statusInfo = avaliarStatusInscricao({
    status: evento.status,
    aceita_inscricao: evento.aceita_inscricao,
    data_inicio: evento.data_inicio,
    data_fim: evento.data_fim,
    capacidade: evento.capacidade,
    inscritos_confirmados: totalOcupados,
    aguardando_pagamento: 0,
  });

  if (!statusInfo.permite_inscricao) {
    return NextResponse.json(
      { error: statusInfo.motivo_bloqueio ?? 'Inscrições não disponíveis.' },
      { status: 409 }
    );
  }

  // Validar se há memberToken válido para vincular oficialmente ao member_id do cadastro
  let verifiedMemberId: string | null = null;
  if (memberToken) {
    const verified = verifyMemberPrefillToken(memberToken);
    if (verified.valido && verified.memberId && verified.eventoId === evento.id && verified.ministryId === evento.ministry_id) {
      verifiedMemberId = verified.memberId;
    }
  }

  // Normalização do CPF quando fornecido
  const cpfDigitos = cpfCnpj ? cpfCnpj.replace(/\D/g, '') : '';
  const cpfNormalizado = cpfDigitos.length === 11 ? cpfDigitos : null;

  // ─── Verificação rigorosa de duplicidade por member_id e CPF ──────────────
  // Regra: Não considerar inscrições canceladas ou expiradas
  const statusAtivos = ['confirmado', 'aguardando_pagamento', 'lista_espera'];

  // 1. Se for membro vinculado por token/login, prioriza member_id
  if (verifiedMemberId) {
    const { data: jaInscritoMembro } = await admin
      .from('eventos_inscricoes')
      .select('id, status')
      .eq('evento_id', evento.id)
      .eq('member_id', verifiedMemberId)
      .in('status', statusAtivos)
      .maybeSingle();

    if (jaInscritoMembro) {
      return NextResponse.json({
        error: 'Você já possui uma inscrição ativa neste evento.',
        inscricao_id: jaInscritoMembro.id,
        status: jaInscritoMembro.status,
      }, { status: 409 });
    }
  }

  // 2. Se possuir CPF informado, verifica duplicidade por CPF no mesmo evento
  if (cpfNormalizado) {
    // 2.a. Buscar se algum membro do tenant possui esse CPF
    const { data: membroComCpf } = await admin
      .from('members')
      .select('id')
      .eq('ministry_id', evento.ministry_id)
      .eq('cpf', cpfNormalizado)
      .maybeSingle();

    if (membroComCpf) {
      const { data: jaInscritoPorCpfMembro } = await admin
        .from('eventos_inscricoes')
        .select('id, status')
        .eq('evento_id', evento.id)
        .eq('member_id', membroComCpf.id)
        .in('status', statusAtivos)
        .maybeSingle();

      if (jaInscritoPorCpfMembro) {
        return NextResponse.json({
          error: 'Já existe uma inscrição ativa para este CPF no evento.',
          inscricao_id: jaInscritoPorCpfMembro.id,
          status: jaInscritoPorCpfMembro.status,
        }, { status: 409 });
      }
    }

    // 2.b. Buscar se alguma inscrição externa já registrou esse CPF (observacoes ou coluna dedicada)
    const { data: jaInscritoPorCpfGeral } = await admin
      .from('eventos_inscricoes')
      .select('id, status, observacoes')
      .eq('evento_id', evento.id)
      .in('status', statusAtivos)
      .or(`observacoes.ilike.%CPF: ${cpfNormalizado}%,observacoes.ilike.%CPF: ${cpfCnpj}%`);

    if (jaInscritoPorCpfGeral && jaInscritoPorCpfGeral.length > 0) {
      return NextResponse.json({
        error: 'Já existe uma inscrição ativa para este CPF no evento.',
        inscricao_id: jaInscritoPorCpfGeral[0].id,
        status: jaInscritoPorCpfGeral[0].status,
      }, { status: 409 });
    }
  }

  // 3. Verificar duplicidade por email (como fallback seguro)
  // Permite nova inscrição se a anterior foi expirada ou cancelada
  const { data: jaInscritoEmail } = await admin
    .from('eventos_inscricoes')
    .select('id, status')
    .eq('evento_id', evento.id)
    .eq('email_externo', email)
    .in('status', statusAtivos)
    .maybeSingle();

  if (jaInscritoEmail) {
    return NextResponse.json({
      error: 'Este e-mail já possui uma inscrição ativa neste evento.',
      inscricao_id: jaInscritoEmail.id,
      status: jaInscritoEmail.status,
    }, { status: 409 });
  }

  // Determinar status da inscrição: confirmado, aguardando_pagamento ou lista_espera
  const valorNum = typeof evento.valor_inscricao === 'number' ? evento.valor_inscricao : Number(evento.valor_inscricao) || 0;
  const isPago = Boolean(evento.evento_pago || valorNum > 0);
  let statusInscricao: 'confirmado' | 'lista_espera' | 'aguardando_pagamento' = 'confirmado';

  if (statusInfo.is_lista_espera || statusInfo.status_inscricao === 'lotado') {
    statusInscricao = 'lista_espera';
  } else if (isPago) {
    statusInscricao = 'aguardando_pagamento';
  }

  // Observações com congregação ou dados adicionais (incluindo CPF normalizado)
  const obsPartes: string[] = [];
  if (cpfNormalizado) obsPartes.push(`CPF: ${cpfNormalizado}`);
  if (congregacao) obsPartes.push(`Congregação: ${congregacao}`);
  const observacoes = obsPartes.length > 0 ? obsPartes.join(' | ') : null;

  // Inserir inscrição com tratamento atômico de erro de índice único
  const insertPayload: Record<string, any> = {
    evento_id: evento.id,
    ministry_id: evento.ministry_id,
    member_id: verifiedMemberId,
    nome_externo: verifiedMemberId ? null : nome,
    email_externo: email,
    telefone,
    status: statusInscricao,
    observacoes,
    presente: false,
  };
  if (cpfNormalizado) {
    insertPayload.cpf_normalizado = cpfNormalizado;
  }

  const { data: inscricao, error: insErr } = await admin
    .from('eventos_inscricoes')
    .insert(insertPayload)
    .select('id, status, tem_brinde')
    .single();

  if (insErr || !inscricao) {
    // Conflito de índice único (race condition no banco)
    if (insErr?.code === '23505') {
      return NextResponse.json({
        error: 'Este participante já possui uma inscrição ativa registrada neste evento.',
      }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao registrar inscrição. Tente novamente.' }, { status: 500 });
  }

  // ── Fluxo Gratuito ou Lista de Espera ────────────────────────────────────────
  if (!isPago || statusInscricao === 'lista_espera') {
    return NextResponse.json({
      inscricao_id: inscricao.id,
      status: inscricao.status,
      tem_brinde: Boolean(inscricao.tem_brinde),
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
