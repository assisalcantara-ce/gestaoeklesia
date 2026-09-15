/**
 * GET  /api/v1/mobile/documentos/solicitacoes   — Lista solicitações do membro autenticado
 * POST /api/v1/mobile/documentos/solicitacoes   — Cria nova solicitação de carta/documento
 *
 * Segurança:
 * - Requer Bearer token de membro vinculado (resolveMobileMember)
 * - POST deriva member_id, ministry_id, solicitante_id, membro_nome, congregacao_id exclusivamente pelo servidor
 * - Rejeita payloads forjados do cliente
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';

export const dynamic = 'force-dynamic';

const TIPOS_VALIDOS = ['mudanca', 'transito', 'desligamento', 'recomendacao'] as const;
type TipoCarta = (typeof TIPOS_VALIDOS)[number];

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    const { data: solicitacoes, error } = await admin
      .from('carta_pedidos')
      .select('id, tipo_carta, destino, observacoes, status, data_autorizacao, motivo_rejeicao, created_at')
      .eq('ministry_id', ctx.ministryId)
      .or(`member_id.eq.${ctx.memberId},solicitante_id.eq.${ctx.userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao consultar solicitações de documentos.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      solicitacoes: solicitacoes || [],
      total: (solicitacoes || []).length,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar solicitações.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido (JSON esperado).' },
        { status: 400 }
      );
    }

    const tipo_carta = (body.tipo_carta || '').trim().toLowerCase();
    const destino = (body.destino || '').trim();
    const observacoes = (body.observacoes || '').trim();

    if (!tipo_carta || !TIPOS_VALIDOS.includes(tipo_carta as TipoCarta)) {
      return NextResponse.json(
        {
          error: `Tipo de documento inválido. Tipos aceitos: ${TIPOS_VALIDOS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 1. Obter dados cadastrais oficiais do membro no banco para vincular
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, name, cargo_ministerial, congregacao_id')
      .eq('id', ctx.memberId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Dados do membro não encontrados.' },
        { status: 404 }
      );
    }

    // Regra oficial do sistema: Trânsito e Recomendação podem ser pré-autorizados ou tramitados de acordo com a política
    // Por padrão do fluxo de solicitação mobile do membro, cria como 'pendente' para análise pela Secretaria/Pastor
    const payload = {
      ministry_id: ctx.ministryId,
      congregacao_id: member.congregacao_id || null,
      solicitante_id: ctx.userId,
      solicitante_nome: member.name,
      member_id: ctx.memberId,
      membro_nome: member.name,
      membro_cargo: member.cargo_ministerial || null,
      tipo_carta,
      destino: destino || null,
      observacoes: observacoes || null,
      status: 'pendente',
    };

    const { data: novoPedido, error: insertErr } = await admin
      .from('carta_pedidos')
      .insert(payload)
      .select('id, tipo_carta, destino, observacoes, status, created_at')
      .single();

    if (insertErr || !novoPedido) {
      return NextResponse.json(
        { error: 'Erro ao registrar solicitação de documento.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Solicitação de documento enviada com sucesso.',
        solicitacao: novoPedido,
      },
      { status: 201 }
    );
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao criar solicitação de documento.' },
      { status: 500 }
    );
  }
}
