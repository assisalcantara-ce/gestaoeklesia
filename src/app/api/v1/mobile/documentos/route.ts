/**
 * GET  /api/v1/mobile/documentos
 *
 * Lista documentos oficiais emitidos e resumo de solicitações do membro autenticado.
 *
 * Segurança:
 * - Requer Bearer token de membro vinculado (resolveMobileMember)
 * - Retorna apenas cartas e declarações emitidas com status 'emitida' onde member_id = ctx.memberId
 * - Retorna solicitações onde member_id = ctx.memberId ou solicitante_id = ctx.userId
 * - Proteção estrita anti-IDOR e isolamento multi-tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Buscar documentos emitidos e disponíveis
    const { data: documentos, error: docError } = await admin
      .from('cartas_registros')
      .select('id, template_title, template_key, categoria, status, issued_at, created_at')
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .eq('status', 'emitida')
      .order('issued_at', { ascending: false });

    if (docError) {
      return NextResponse.json(
        { error: 'Erro ao consultar documentos emitidos.' },
        { status: 500 }
      );
    }

    // 2. Buscar solicitações do membro (carta_pedidos)
    const { data: solicitacoes, error: solError } = await admin
      .from('carta_pedidos')
      .select('id, tipo_carta, destino, observacoes, status, data_autorizacao, motivo_rejeicao, created_at')
      .eq('ministry_id', ctx.ministryId)
      .or(`member_id.eq.${ctx.memberId},solicitante_id.eq.${ctx.userId}`)
      .order('created_at', { ascending: false });

    if (solError) {
      return NextResponse.json(
        { error: 'Erro ao consultar solicitações de documentos.' },
        { status: 500 }
      );
    }

    const docsFormatados = (documentos || []).map((d) => {
      const isDeclaracao =
        d.categoria === 'declaracao' ||
        (d.template_title || '').toLowerCase().includes('declara') ||
        (d.template_key || '').toLowerCase().includes('declaracao');

      return {
        id: d.id,
        titulo: d.template_title || (isDeclaracao ? 'Declaração Oficial' : 'Carta Ministerial'),
        tipo: isDeclaracao ? 'declaracao' : 'carta',
        categoria: d.categoria || (isDeclaracao ? 'declaracao' : 'carta'),
        status: d.status,
        data_emissao: d.issued_at || d.created_at,
      };
    });

    return NextResponse.json({
      documentos: docsFormatados,
      solicitacoes: solicitacoes || [],
      total_documentos: docsFormatados.length,
      total_solicitacoes: (solicitacoes || []).length,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao carregar central de documentos.' },
      { status: 500 }
    );
  }
}
