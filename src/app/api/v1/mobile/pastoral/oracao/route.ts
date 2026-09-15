import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/pastoral/oracao
 * Lista exclusivamente os pedidos de oração e solicitações do próprio membro autenticado:
 * - Filtra por member_id = ctx.memberId e ministry_id = ctx.ministryId
 * - Oculta estritamente campos internos (observações pastorais, notas confidenciais)
 * - Proteção anti-IDOR rigorosa
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    const { data: pedidos, error } = await admin
      .from('pastoral_pedidos_oracao')
      .select(`
        id,
        assunto,
        descricao,
        tipo,
        sigiloso,
        status,
        data_preferencial,
        created_at,
        atendido_em
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao consultar pedidos de oração.', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      total: pedidos?.length || 0,
      pedidos: pedidos || [],
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao listar pedidos de oração.', detail: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/mobile/pastoral/oracao
 * Cria um novo pedido de oração ou solicitação pastoral para o membro autenticado:
 * - Identidade e congregação derivadas exclusivamente da sessão
 * - Ignora qualquer tentativa de forjar member_id, ministry_id ou status
 * - Inicializa com status 'recebido'
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação do membro
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, congregacao_id')
      .eq('id', ctx.memberId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Membro não encontrado.', code: 'MEMBER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 2. Parse e validação do body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { assunto, descricao, tipo, sigiloso, data_preferencial } = body || {};

    if (!assunto || typeof assunto !== 'string' || !assunto.trim()) {
      return NextResponse.json(
        { error: 'Assunto do pedido é obrigatório.', code: 'INVALID_ASSUNTO' },
        { status: 400 }
      );
    }

    if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
      return NextResponse.json(
        { error: 'Descrição do pedido é obrigatória.', code: 'INVALID_DESCRICAO' },
        { status: 400 }
      );
    }

    const tipoValido = ['oracao', 'atendimento', 'visita', 'outro'].includes(tipo)
      ? tipo
      : 'oracao';

    // 3. Montar payload seguro (server-side authority)
    const payload = {
      ministry_id: ctx.ministryId,
      member_id: ctx.memberId,
      congregacao_id: member.congregacao_id || null,
      assunto: assunto.trim().slice(0, 255),
      descricao: descricao.trim().slice(0, 5000),
      tipo: tipoValido,
      sigiloso: sigiloso !== false, // default true
      data_preferencial: data_preferencial || null,
      status: 'recebido',
      observacoes_internas: null,
      atendido_por: null,
      atendido_em: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: novoPedido, error: insertErr } = await admin
      .from('pastoral_pedidos_oracao')
      .insert([payload])
      .select(`
        id,
        assunto,
        descricao,
        tipo,
        sigiloso,
        status,
        data_preferencial,
        created_at
      `)
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: 'Erro ao registrar pedido de oração.', detail: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Pedido de oração recebido com sucesso.',
        pedido: novoPedido,
      },
      { status: 201 }
    );
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao registrar pedido de oração.', detail: String(error) },
      { status: 500 }
    );
  }
}
