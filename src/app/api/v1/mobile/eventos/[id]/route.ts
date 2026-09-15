/**
 * GET /api/v1/mobile/eventos/[id]
 *
 * Retorna os detalhes completos de um evento para o membro autenticado,
 * incluindo status de vagas, hospedagem, programação e o status da inscrição do próprio membro.
 *
 * SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Se o evento não pertencer ao ministry_id do membro, ou não for público, ou for de outra congregação:
 *   retorna 404 (sem vazar a existência do ID).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveMobileMember(request);
    const { id } = await context.params;

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const admin = createServerClient();

    // 1. Validação da Feature Flag do Módulo de Eventos para o Tenant
    const isAllowed = await isFeatureAllowedForTenant(admin, ctx.ministryId, 'events_module');
    if (!isAllowed) {
      return NextResponse.json({ error: 'Módulo de Eventos desabilitado para esta instituição.' }, { status: 403 });
    }

    // 2. Obter congregação do membro
    const { data: member } = await admin
      .from('members')
      .select('congregacao_id')
      .eq('id', ctx.memberId)
      .maybeSingle();

    const memberCongregacaoId = member?.congregacao_id ?? null;

    // 3. Buscar evento garantindo isolamento multi-tenant e visibilidade pública
    const { data: evento, error } = await admin
      .from('eventos')
      .select(`
        id,
        titulo,
        descricao,
        tipo,
        data_inicio,
        data_fim,
        local_nome,
        local_endereco,
        capacidade,
        is_publico,
        aceita_inscricao,
        valor_inscricao,
        inclui_hospedagem,
        vagas_hospedagem,
        descricao_hospedagem,
        slug,
        programacao,
        status,
        congregacao_id,
        ministry_id
      `)
      .eq('id', id)
      .eq('ministry_id', ctx.ministryId)
      .eq('is_publico', true)
      .maybeSingle();

    if (error) {
      console.error('[mobile/eventos/[id] GET] erro na busca do evento:', error);
      return NextResponse.json({ error: 'Erro ao buscar evento.' }, { status: 500 });
    }

    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    // Validar congregação (se o evento for restrito a congregação diferente da do membro, retorna 404)
    if (evento.congregacao_id && memberCongregacaoId && evento.congregacao_id !== memberCongregacaoId) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    // 4. Contar inscrições confirmadas e aguardando_pagamento
    const { count: ocupadasCount } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .in('status', ['confirmado', 'aguardando_pagamento']);

    const { count: listaEsperaCount } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .eq('status', 'lista_espera');

    const ocupadas = ocupadasCount ?? 0;
    const listaEspera = listaEsperaCount ?? 0;
    const vagasRestantes = evento.capacidade != null
      ? Math.max(0, evento.capacidade - ocupadas)
      : null;
    const lotado = evento.capacidade != null && ocupadas >= evento.capacidade;

    // 5. Contar vagas de hospedagem, se aplicável
    let vagasHospedagemRestantes: number | null = null;
    let hospedagemLotada = false;

    if (evento.inclui_hospedagem && evento.vagas_hospedagem != null) {
      const { count: ocupadasHospCount } = await admin
        .from('eventos_inscricoes')
        .select('id', { count: 'exact', head: true })
        .eq('evento_id', evento.id)
        .eq('com_hospedagem', true)
        .in('status_hospedagem', ['solicitada', 'confirmada']);

      const ocupadasHosp = ocupadasHospCount ?? 0;
      vagasHospedagemRestantes = Math.max(0, evento.vagas_hospedagem - ocupadasHosp);
      hospedagemLotada = ocupadasHosp >= evento.vagas_hospedagem;
    }

    // 6. Buscar inscrição do membro autenticado
    const { data: minhaInscricao } = await admin
      .from('eventos_inscricoes')
      .select('id, status, com_hospedagem, status_hospedagem, observacoes, created_at')
      .eq('evento_id', evento.id)
      .eq('member_id', ctx.memberId)
      .maybeSingle();

    let pagamentoInfo = null;
    if (minhaInscricao) {
      const { data: pag } = await admin
        .from('eventos_pagamentos')
        .select('id, status, valor, expires_at, paid_at, pix_payload, pix_qrcode, invoice_url')
        .eq('inscricao_id', minhaInscricao.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pag) {
        pagamentoInfo = {
          id: pag.id,
          status: pag.status,
          valor: Number(pag.valor),
          expires_at: pag.expires_at,
          paid_at: pag.paid_at || null,
          pix_payload: pag.pix_payload || null,
          pix_qrcode: pag.pix_qrcode || null,
          invoice_url: pag.invoice_url || null,
        };
      }
    }

    return NextResponse.json({
      id: evento.id,
      titulo: evento.titulo,
      descricao: evento.descricao || null,
      tipo: evento.tipo,
      data_inicio: evento.data_inicio,
      data_fim: evento.data_fim || null,
      local_nome: evento.local_nome || null,
      local_endereco: evento.local_endereco || null,
      valor_inscricao: Number(evento.valor_inscricao ?? 0),
      capacidade: evento.capacidade ?? null,
      vagas_restantes: vagasRestantes,
      lotado,
      lista_espera_count: listaEspera,
      inclui_hospedagem: Boolean(evento.inclui_hospedagem),
      vagas_hospedagem: evento.vagas_hospedagem ?? null,
      vagas_hospedagem_restantes: vagasHospedagemRestantes,
      hospedagem_lotada: hospedagemLotada,
      descricao_hospedagem: evento.descricao_hospedagem || null,
      programacao: evento.programacao || null,
      status: evento.status,
      aceita_inscricao: Boolean(evento.aceita_inscricao),
      slug: evento.slug || null,
      minha_inscricao: minhaInscricao ? {
        id: minhaInscricao.id,
        status: minhaInscricao.status,
        com_hospedagem: minhaInscricao.com_hospedagem,
        status_hospedagem: minhaInscricao.status_hospedagem,
        observacoes: minhaInscricao.observacoes,
        created_at: minhaInscricao.created_at,
        pagamento: pagamentoInfo,
      } : null,
    });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/eventos/[id] GET] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
