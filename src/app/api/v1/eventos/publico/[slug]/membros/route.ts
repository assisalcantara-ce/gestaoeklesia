/**
 * API ROUTE PÚBLICA: Busca de Membros por Nome com Rate Limiting e Isolamento Multi-tenant
 * GET /api/v1/eventos/publico/[slug]/membros?q=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Slug do evento inválido.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    // Regra: Mínimo 3 caracteres
    if (q.length < 3) {
      return NextResponse.json({
        membros: [],
        aviso: 'Digite ao menos 3 caracteres para buscar.',
      });
    }

    // Rate Limiting por IP para impedir enumeração e scraping (máximo 30 buscas por minuto)
    const clientIp = getClientIp(request);
    const rlKey = `evento_busca_membros:${clientIp}:${slug}`;
    const rlResult = checkRateLimit(rlKey, 30, 60 * 1000);

    if (!rlResult.allowed) {
      return NextResponse.json(
        {
          error: 'Muitas buscas consecutivas. Aguarde alguns instantes.',
          retryAfterSeconds: rlResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rlResult.retryAfterSeconds) },
        }
      );
    }

    const admin = createServerClient();

    // 1. Validar evento público ativo
    const { data: evento, error: evErr } = await admin
      .from('eventos')
      .select('id, ministry_id, is_publico, aceita_inscricao, status')
      .eq('slug', slug)
      .eq('is_publico', true)
      .maybeSingle();

    if (evErr || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    // 2. Feature flag do tenant
    const isAllowed = await isFeatureAllowedForTenant(admin, evento.ministry_id, 'events_module');
    if (!isAllowed) {
      return NextResponse.json({ error: 'Módulo de Eventos indisponível neste ministério.' }, { status: 403 });
    }

    // 3. Buscar membros ativos do mesmo ministério pelo nome (ilike)
    // Limite estrito de 6 resultados
    // NÃO RETORNA e-mail, telefone, CPF ou dados sensíveis!
    const { data: members, error: memErr } = await admin
      .from('members')
      .select('id, name, congregacao_id, congregacoes(id, nome)')
      .eq('ministry_id', evento.ministry_id)
      .ilike('name', `%${q}%`)
      .limit(6);

    if (memErr) {
      console.error('[GET /api/v1/eventos/publico/[slug]/membros] Erro ao buscar membros:', memErr);
      return NextResponse.json({ error: 'Erro ao buscar membros.' }, { status: 500 });
    }

    // Formatar resultados seguros com congregação para distinguir homônimos
    const membrosFormatados = (members || []).map((m: any) => ({
      id: m.id,
      nome: m.name,
      congregacao_nome: m.congregacoes?.nome || 'Sede / Templo Principal',
      congregacao_id: m.congregacao_id || null,
    }));

    return NextResponse.json({
      membros: membrosFormatados,
      total: membrosFormatados.length,
    });
  } catch (err: any) {
    console.error('[GET /api/v1/eventos/publico/[slug]/membros] Exceção:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
