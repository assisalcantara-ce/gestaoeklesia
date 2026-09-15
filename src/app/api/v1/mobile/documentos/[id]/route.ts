/**
 * GET  /api/v1/mobile/documentos/[id]
 *
 * Retorna o documento oficial emitido e o HTML renderizado oficial para visualização/impressão pelo membro.
 *
 * Segurança:
 * - Requer Bearer token de membro vinculado (resolveMobileMember)
 * - Anti-IDOR: O documento DEVE pertencer ao member_id e ministry_id do token
 * - Status deve ser 'emitida'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'ID do documento não informado.' },
        { status: 400 }
      );
    }

    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    const { data: doc, error } = await admin
      .from('cartas_registros')
      .select('id, template_title, template_key, categoria, status, rendered_html, issued_at, created_at, member_id, ministry_id')
      .eq('id', id)
      .maybeSingle();

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Documento não encontrado.' },
        { status: 404 }
      );
    }

    // Validação Anti-IDOR e Isolamento Multi-tenant
    if (doc.ministry_id !== ctx.ministryId || doc.member_id !== ctx.memberId) {
      return NextResponse.json(
        { error: 'Acesso não autorizado ao documento.' },
        { status: 403 }
      );
    }

    if (doc.status !== 'emitida') {
      return NextResponse.json(
        { error: 'Este documento não está disponível para visualização.' },
        { status: 403 }
      );
    }

    const isDeclaracao =
      doc.categoria === 'declaracao' ||
      (doc.template_title || '').toLowerCase().includes('declara') ||
      (doc.template_key || '').toLowerCase().includes('declaracao');

    return NextResponse.json({
      id: doc.id,
      titulo: doc.template_title || (isDeclaracao ? 'Declaração Oficial' : 'Carta Ministerial'),
      tipo: isDeclaracao ? 'declaracao' : 'carta',
      categoria: doc.categoria || (isDeclaracao ? 'declaracao' : 'carta'),
      status: doc.status,
      rendered_html: doc.rendered_html,
      data_emissao: doc.issued_at || doc.created_at,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar documento.' },
      { status: 500 }
    );
  }
}
