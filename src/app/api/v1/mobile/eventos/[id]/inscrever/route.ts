/**
 * POST /api/v1/mobile/eventos/[id]/inscrever
 *
 * Realiza a inscrição segura do membro autenticado no evento especificado.
 *
 * REGRAS DE NEGÓCIO E SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Dados pessoais (nome, email, telefone, cpf) obtidos do cadastro em `members`.
 * - Impede inscrição duplicada do mesmo membro (retorna 409).
 * - Respeita capacidade máxima do evento e lista de espera.
 * - Respeita regras de hospedagem (se habilitada e vagas disponíveis).
 * - Se gratuito ou lista de espera: confirma ou coloca em espera sem gerar cobrança.
 * - Se pago e com vaga: gera cobrança PIX via gateway ASAAS ativo e vincula ao `eventos_pagamentos`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { decryptCredentials } from '@/lib/ministry-credentials';
import {
  getOrCreateAsaasCustomer,
  createAsaasPixCharge,
  futureDateStr,
} from '@/lib/asaas-eventos';

export const dynamic = 'force-dynamic';

const PIX_EXPIRY_DAYS = 2;

function sanitize(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, 500) : '';
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let inscricaoIdCriada: string | null = null;
  const admin = createServerClient();

  try {
    const ctx = await resolveMobileMember(request);
    const { id } = await context.params;

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Body vazio é aceitável para inscrições sem campos opcionais
      body = {};
    }

    const querHospedagemInput = body.com_hospedagem === true;
    const observacoesInput = sanitize(body.observacoes);

    // 1. Validação da Feature Flag do Módulo de Eventos para o Tenant
    const isAllowed = await isFeatureAllowedForTenant(admin, ctx.ministryId, 'events_module');
    if (!isAllowed) {
      return NextResponse.json({ error: 'Módulo de Eventos desabilitado para esta instituição.' }, { status: 403 });
    }

    // 2. Buscar dados do membro autenticado
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, name, email, phone, celular, whatsapp, cpf, congregacao_id')
      .eq('id', ctx.memberId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Cadastro do membro não encontrado.' }, { status: 404 });
    }

    // 3. Buscar evento
    const { data: evento, error: evErr } = await admin
      .from('eventos')
      .select(`
        id,
        titulo,
        ministry_id,
        status,
        is_publico,
        aceita_inscricao,
        capacidade,
        data_inicio,
        valor_inscricao,
        congregacao_id,
        inclui_hospedagem,
        vagas_hospedagem
      `)
      .eq('id', id)
      .eq('ministry_id', ctx.ministryId)
      .eq('is_publico', true)
      .maybeSingle();

    if (evErr || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    // 4. Validações de negócio do evento
    if (!evento.aceita_inscricao) {
      return NextResponse.json({ error: 'Este evento não está aceitando inscrições no momento.' }, { status: 409 });
    }
    if (evento.status === 'cancelado') {
      return NextResponse.json({ error: 'Este evento foi cancelado.' }, { status: 409 });
    }
    if (evento.status === 'realizado') {
      return NextResponse.json({ error: 'Este evento já foi realizado. Não é possível realizar novas inscrições.' }, { status: 409 });
    }

    // Validar restrição de congregação
    if (evento.congregacao_id && member.congregacao_id && evento.congregacao_id !== member.congregacao_id) {
      return NextResponse.json({ error: 'Evento indisponível para sua congregação.' }, { status: 403 });
    }

    // 5. Verificar duplicidade de inscrição para o membro
    const { data: jaInscrito } = await admin
      .from('eventos_inscricoes')
      .select('id, status')
      .eq('evento_id', evento.id)
      .eq('member_id', ctx.memberId)
      .maybeSingle();

    if (jaInscrito && !['expirado', 'cancelado'].includes(jaInscrito.status)) {
      return NextResponse.json({
        error: 'Você já possui uma inscrição ativa neste evento.',
        inscricao_id: jaInscrito.id,
        status: jaInscrito.status,
      }, { status: 409 });
    }

    // 6. Determinar vagas e status da inscrição
    const isPago = Number(evento.valor_inscricao ?? 0) > 0;
    let statusInscricao: 'confirmado' | 'lista_espera' | 'aguardando_pagamento' = 'confirmado';
    let temVaga = true;

    if (evento.capacidade != null) {
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

    // 7. Regras de Hospedagem
    const querHospedagem = querHospedagemInput && Boolean(evento.inclui_hospedagem);
    let statusHospedagem: 'nao_aplicavel' | 'solicitada' | 'confirmada' | 'lista_espera' = 'nao_aplicavel';

    if (querHospedagem) {
      if (statusInscricao === 'lista_espera') {
        statusHospedagem = 'lista_espera';
      } else if (evento.vagas_hospedagem != null) {
        const { count: ocupadasHosp } = await admin
          .from('eventos_inscricoes')
          .select('id', { count: 'exact', head: true })
          .eq('evento_id', evento.id)
          .eq('com_hospedagem', true)
          .in('status_hospedagem', ['solicitada', 'confirmada']);

        if ((ocupadasHosp ?? 0) >= evento.vagas_hospedagem) {
          statusHospedagem = 'lista_espera';
        } else {
          statusHospedagem = isPago ? 'solicitada' : 'confirmada';
        }
      } else {
        statusHospedagem = isPago ? 'solicitada' : 'confirmada';
      }
    }

    const telefoneMembro = member.phone || member.celular || member.whatsapp || null;
    const nowStr = new Date().toISOString();

    // 8. Persistir ou Reativar Inscrição
    let inscricaoId: string;
    let inscricaoFinalStatus: string;

    if (jaInscrito) {
      // Reativa inscrição anterior que havia expirado ou sido cancelada
      const { data: updatedIns, error: updErr } = await admin
        .from('eventos_inscricoes')
        .update({
          nome_externo: member.name || 'Membro',
          email_externo: member.email || null,
          telefone: telefoneMembro,
          status: statusInscricao,
          com_hospedagem: querHospedagem,
          status_hospedagem: statusHospedagem,
          observacoes: observacoesInput || null,
          presente: false,
          updated_at: nowStr,
        })
        .eq('id', jaInscrito.id)
        .select('id, status')
        .single();

      if (updErr || !updatedIns) {
        return NextResponse.json({ error: 'Erro ao reativar inscrição. Tente novamente.' }, { status: 500 });
      }
      inscricaoId = updatedIns.id;
      inscricaoFinalStatus = updatedIns.status;
    } else {
      // Nova inscrição
      const { data: newIns, error: insErr } = await admin
        .from('eventos_inscricoes')
        .insert({
          evento_id: evento.id,
          ministry_id: evento.ministry_id,
          member_id: ctx.memberId,
          nome_externo: member.name || 'Membro',
          email_externo: member.email || null,
          telefone: telefoneMembro,
          status: statusInscricao,
          com_hospedagem: querHospedagem,
          status_hospedagem: statusHospedagem,
          observacoes: observacoesInput || null,
          presente: false,
          created_at: nowStr,
          updated_at: nowStr,
        })
        .select('id, status')
        .single();

      if (insErr || !newIns) {
        if (insErr?.code === '23505') {
          return NextResponse.json({ error: 'Você já possui uma inscrição ativa neste evento.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Erro ao registrar inscrição. Tente novamente.' }, { status: 500 });
      }
      inscricaoId = newIns.id;
      inscricaoFinalStatus = newIns.status;
    }

    inscricaoIdCriada = inscricaoId;

    // ── Fluxo Gratuito ou Lista de Espera ──────────────────────────────────────
    if (!isPago || statusInscricao === 'lista_espera') {
      return NextResponse.json({
        inscricao_id: inscricaoId,
        status: inscricaoFinalStatus,
        com_hospedagem: querHospedagem,
        status_hospedagem: statusHospedagem,
        evento_titulo: evento.titulo,
        data_inicio: evento.data_inicio,
        pago: false,
        valor: 0,
      }, { status: 201 });
    }

    // ── Fluxo Pago (aguardando_pagamento) — Gerar Cobrança PIX ASAAS ────────────
    try {
      const { data: gateway } = await admin
        .from('ministry_payment_gateways')
        .select('encrypted_credentials, webhook_token')
        .eq('ministry_id', evento.ministry_id)
        .eq('gateway', 'asaas')
        .eq('is_active', true)
        .maybeSingle();

      if (!gateway?.encrypted_credentials) {
        // Fallback gracioso: se o ministério não configurou o gateway, confirma sem cobrança
        await admin
          .from('eventos_inscricoes')
          .update({ status: 'confirmado', updated_at: new Date().toISOString() })
          .eq('id', inscricaoId);

        return NextResponse.json({
          inscricao_id: inscricaoId,
          status: 'confirmado',
          com_hospedagem: querHospedagem,
          status_hospedagem: statusHospedagem,
          evento_titulo: evento.titulo,
          data_inicio: evento.data_inicio,
          pago: false,
          aviso: 'Gateway de pagamento não configurado na instituição. Inscrição confirmada sem cobrança.',
        }, { status: 201 });
      }

      const creds = decryptCredentials(gateway.encrypted_credentials);
      const apiKey = creds.apiKey ?? creds.api_key;
      if (!apiKey) throw new Error('Credencial api_key ausente no gateway.');

      const nomeMembro = member.name || 'Membro';
      const emailMembro = member.email || 'membro@gestaoeklesia.com.br';
      const cpfMembro = member.cpf ? member.cpf.replace(/\D/g, '') : null;

      // Customer ASAAS
      const customerId = await getOrCreateAsaasCustomer(apiKey, nomeMembro, emailMembro, cpfMembro);

      // Cobrança PIX
      const dueDate = futureDateStr(PIX_EXPIRY_DAYS);
      const charge = await createAsaasPixCharge(
        apiKey,
        customerId,
        Number(evento.valor_inscricao),
        `Inscrição Evento: ${evento.titulo}`,
        inscricaoId,
        dueDate
      );

      const expiresAt = new Date(`${dueDate}T23:59:59-03:00`).toISOString();

      // Salvar pagamento em eventos_pagamentos
      const { data: pagamento, error: pagErr } = await admin
        .from('eventos_pagamentos')
        .insert({
          ministry_id:         evento.ministry_id,
          evento_id:           evento.id,
          inscricao_id:        inscricaoId,
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
          created_at:          nowStr,
          updated_at:          nowStr,
        })
        .select('id')
        .single();

      if (pagErr || !pagamento) {
        console.error('[mobile/eventos/[id]/inscrever] Erro ao salvar eventos_pagamentos:', pagErr);
      }

      return NextResponse.json({
        inscricao_id: inscricaoId,
        pagamento_id: pagamento?.id ?? null,
        status: statusInscricao,
        com_hospedagem: querHospedagem,
        status_hospedagem: statusHospedagem,
        evento_titulo: evento.titulo,
        data_inicio: evento.data_inicio,
        pago: true,
        valor: Number(evento.valor_inscricao),
        pix: {
          payload: charge.pix?.payload ?? null,
          qrcode_base64: charge.pix?.encodedImage ?? null,
          expira_em: expiresAt,
          invoice_url: charge.invoiceUrl ?? null,
        },
      }, { status: 201 });
    } catch (err) {
      console.error('[mobile/eventos/[id]/inscrever] Erro no fluxo PIX ASAAS:', (err as Error).message);
      // Reverter inscrição se criada recentemente
      if (inscricaoIdCriada) {
        await admin.from('eventos_inscricoes').delete().eq('id', inscricaoIdCriada);
      }
      return NextResponse.json({
        error: 'Não foi possível gerar a cobrança PIX para o evento. Tente novamente em instantes.',
      }, { status: 502 });
    }
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/eventos/[id]/inscrever POST] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
