/**
 * GET /api/v1/mobile/eventos
 *
 * Retorna a lista de eventos públicos disponíveis para o membro autenticado,
 * respeitando regras de tenant, feature flag de eventos, congregação, status e capacidade.
 *
 * SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Filtra estritamente: ministry_id = ctx.ministryId, is_publico = true, aceita_inscricao = true,
 *   status compatível ('programado', 'em_andamento') e congregação compatível.
 * - Nunca expõe dados administrativos desnecessários.
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

    // 2. Obter congregação do membro
    const { data: member } = await admin
      .from('members')
      .select('congregacao_id')
      .eq('id', ctx.memberId)
      .maybeSingle();

    const memberCongregacaoId = member?.congregacao_id ?? null;

    // 3. Buscar eventos disponíveis do ministério
    let query = admin
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
        slug,
        programacao,
        status,
        congregacao_id
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('is_publico', true)
      .eq('aceita_inscricao', true)
      .in('status', ['programado', 'em_andamento'])
      .order('data_inicio', { ascending: true });

    // Filtrar congregação: geral (null) OU congregação do próprio membro
    if (memberCongregacaoId) {
      query = query.or(`congregacao_id.is.null,congregacao_id.eq.${memberCongregacaoId}`);
    } else {
      query = query.is('congregacao_id', null);
    }

    const { data: eventos, error } = await query;

    if (error) {
      console.error('[mobile/eventos GET] erro na consulta:', error);
      return NextResponse.json({ error: 'Erro ao buscar eventos.' }, { status: 500 });
    }

    if (!eventos || eventos.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 4. Buscar inscrições do membro atual para indicar status de inscrição em cada evento
    const eventoIds = eventos.map((e) => e.id);
    const { data: minhasInscricoes } = await admin
      .from('eventos_inscricoes')
      .select('id, evento_id, status')
      .in('evento_id', eventoIds)
      .eq('member_id', ctx.memberId);

    const inscricaoPorEvento = new Map<string, { id: string; status: string }>();
    (minhasInscricoes ?? []).forEach((ins) => {
      // Prioriza inscrição ativa se houver múltiplas
      if (!inscricaoPorEvento.has(ins.evento_id) || !['expirado', 'cancelado'].includes(ins.status)) {
        inscricaoPorEvento.set(ins.evento_id, { id: ins.id, status: ins.status });
      }
    });

    // 5. Para eventos com limite de capacidade, calcular ocupação
    const eventosComCapacidade = eventos.filter((e) => e.capacidade != null);
    const ocupacaoMap = new Map<string, number>();

    if (eventosComCapacidade.length > 0) {
      const idsCapacidade = eventosComCapacidade.map((e) => e.id);
      const { data: ocupacoes } = await admin
        .from('eventos_inscricoes')
        .select('evento_id')
        .in('evento_id', idsCapacidade)
        .in('status', ['confirmado', 'aguardando_pagamento']);

      (ocupacoes ?? []).forEach((row) => {
        ocupacaoMap.set(row.evento_id, (ocupacaoMap.get(row.evento_id) ?? 0) + 1);
      });
    }

    // 6. Montar resposta formatada
    const formatted = eventos.map((ev) => {
      const inscricaoAtual = inscricaoPorEvento.get(ev.id);
      const jaInscrito = Boolean(inscricaoAtual && !['expirado', 'cancelado'].includes(inscricaoAtual.status));
      const ocupadas = ev.capacidade != null ? (ocupacaoMap.get(ev.id) ?? 0) : null;
      const vagasRestantes = ev.capacidade != null && ocupadas != null
        ? Math.max(0, ev.capacidade - ocupadas)
        : null;
      const lotado = ev.capacidade != null && ocupadas != null && ocupadas >= ev.capacidade;

      return {
        id: ev.id,
        titulo: ev.titulo,
        descricao: ev.descricao || null,
        tipo: ev.tipo,
        data_inicio: ev.data_inicio,
        data_fim: ev.data_fim || null,
        local_nome: ev.local_nome || null,
        local_endereco: ev.local_endereco || null,
        valor_inscricao: Number(ev.valor_inscricao ?? 0),
        capacidade: ev.capacidade ?? null,
        vagas_restantes: vagasRestantes,
        lotado,
        inclui_hospedagem: Boolean(ev.inclui_hospedagem),
        slug: ev.slug || null,
        programacao: ev.programacao || null,
        minha_inscricao: inscricaoAtual ? {
          id: inscricaoAtual.id,
          status: inscricaoAtual.status,
          ativa: jaInscrito,
        } : null,
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/eventos GET] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
