/**
 * GET /api/v1/mobile/eventos/minhas-inscricoes
 *
 * Retorna o histórico e status de todas as inscrições do membro autenticado.
 *
 * SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Filtra estritamente: ministry_id = ctx.ministryId AND member_id = ctx.memberId.
 * - Nunca retorna dados de outros membros ou de outros ministérios.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Validação da Feature Flag do Módulo de Eventos para o Tenant
    const isAllowed = await isFeatureAllowedForTenant(admin, ctx.ministryId, 'events_module');
    if (!isAllowed) {
      return NextResponse.json({ data: [] });
    }

    // 2. Buscar inscrições do membro
    const { data: inscricoes, error: insErr } = await admin
      .from('eventos_inscricoes')
      .select(`
        id,
        evento_id,
        status,
        com_hospedagem,
        status_hospedagem,
        observacoes,
        presente,
        checkin_em,
        created_at,
        updated_at,
        eventos (
          id,
          titulo,
          descricao,
          tipo,
          data_inicio,
          data_fim,
          local_nome,
          local_endereco,
          valor_inscricao,
          inclui_hospedagem,
          slug,
          status
        )
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .order('created_at', { ascending: false });

    if (insErr) {
      console.error('[mobile/eventos/minhas-inscricoes GET] erro na consulta:', insErr);
      return NextResponse.json({ error: 'Erro ao buscar inscrições.' }, { status: 500 });
    }

    if (!inscricoes || inscricoes.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 3. Buscar pagamentos relacionados a essas inscrições
    const inscricaoIds = inscricoes.map((i) => i.id);
    const { data: pagamentos } = await admin
      .from('eventos_pagamentos')
      .select(`
        id,
        inscricao_id,
        status,
        valor,
        expires_at,
        paid_at,
        pix_payload,
        pix_qrcode,
        invoice_url,
        created_at
      `)
      .in('inscricao_id', inscricaoIds)
      .eq('ministry_id', ctx.ministryId)
      .order('created_at', { ascending: false });

    const pagamentosMap = new Map<string, any>();
    (pagamentos ?? []).forEach((p) => {
      // Guarda o pagamento mais recente de cada inscrição
      if (!pagamentosMap.has(p.inscricao_id)) {
        pagamentosMap.set(p.inscricao_id, p);
      }
    });

    // 4. Formatar lista de inscrições
    const formatted = inscricoes.map((ins) => {
      const ev = (ins.eventos as any) || {};
      const pag = pagamentosMap.get(ins.id);

      return {
        id: ins.id,
        status: ins.status,
        com_hospedagem: ins.com_hospedagem,
        status_hospedagem: ins.status_hospedagem,
        observacoes: ins.observacoes || null,
        presente: Boolean(ins.presente),
        checkin_em: ins.checkin_em || null,
        created_at: ins.created_at,
        evento: {
          id: ev.id || ins.evento_id,
          titulo: ev.titulo || 'Evento',
          descricao: ev.descricao || null,
          tipo: ev.tipo || 'culto_especial',
          data_inicio: ev.data_inicio || null,
          data_fim: ev.data_fim || null,
          local_nome: ev.local_nome || null,
          local_endereco: ev.local_endereco || null,
          valor_inscricao: Number(ev.valor_inscricao ?? 0),
          inclui_hospedagem: Boolean(ev.inclui_hospedagem),
          slug: ev.slug || null,
          status: ev.status || 'programado',
        },
        pagamento: pag ? {
          id: pag.id,
          status: pag.status,
          valor: Number(pag.valor),
          expires_at: pag.expires_at,
          paid_at: pag.paid_at || null,
          pix_payload: pag.pix_payload || null,
          pix_qrcode: pag.pix_qrcode || null,
          invoice_url: pag.invoice_url || null,
        } : null,
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/eventos/minhas-inscricoes GET] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
