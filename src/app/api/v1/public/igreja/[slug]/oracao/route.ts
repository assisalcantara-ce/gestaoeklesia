import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Rate limit em memória por IP (prevenção contra flood/abuso de pedidos de oração)
const ipRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateLimits.set(ip, { count: 1, resetAt: now + 60 * 1000 }); // 1 minuto
    return true;
  }
  if (entry.count >= 5) { // máximo 5 pedidos por minuto por IP
    return false;
  }
  entry.count += 1;
  return true;
}

/**
 * POST /api/v1/public/igreja/[slug]/oracao
 * 
 * Envia um pedido de oração público/visitante diretamente para a liderança pastoral da igreja:
 * - Valida ministério pelo slug
 * - Rate limiting e higienização rigorosa contra spam e abuso
 * - Registra com status 'recebido' e sigilo por padrão
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Muitos pedidos enviados em pouco tempo. Por favor, aguarde um minuto.' },
        { status: 429 }
      );
    }

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json({ error: 'Slug da igreja não fornecido.' }, { status: 400 });
    }

    const cleanSlug = slug.trim().toLowerCase();
    const admin = createServerClient();

    // 1. Resolver ministério
    const { data: ministry, error: minErr } = await admin
      .from('ministries')
      .select('id, is_active')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (minErr || !ministry || ministry.is_active === false) {
      return NextResponse.json(
        { error: 'Igreja não encontrada ou inativa.' },
        { status: 404 }
      );
    }

    // 2. Parse body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

    const {
      assunto,
      descricao,
      nome_solicitante,
      contato_solicitante,
      congregacao_id,
      tipo,
      sigiloso,
    } = body || {};

    if (!assunto || typeof assunto !== 'string' || !assunto.trim()) {
      return NextResponse.json({ error: 'Por favor, informe o assunto da oração.' }, { status: 400 });
    }

    if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
      return NextResponse.json({ error: 'Por favor, descreva o seu pedido de oração.' }, { status: 400 });
    }

    const tipoValido = ['oracao', 'atendimento', 'visita', 'outro'].includes(tipo)
      ? tipo
      : 'oracao';

    // 3. Montar payload do pedido
    const payload: Record<string, any> = {
      ministry_id: ministry.id,
      member_id: null, // Pedido público/visitante
      congregacao_id: congregacao_id || null,
      assunto: assunto.trim().slice(0, 255),
      descricao: descricao.trim().slice(0, 5000),
      tipo: tipoValido,
      sigiloso: sigiloso !== false, // Padrão: sigiloso
      status: 'recebido',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Campos de contato se disponíveis na tabela
    if (nome_solicitante && typeof nome_solicitante === 'string') {
      payload.nome_solicitante = nome_solicitante.trim().slice(0, 255);
    }
    if (contato_solicitante && typeof contato_solicitante === 'string') {
      payload.contato_solicitante = contato_solicitante.trim().slice(0, 100);
    }

    const { data: novoPedido, error: insertErr } = await admin
      .from('pastoral_pedidos_oracao')
      .insert([payload])
      .select('id, assunto, tipo, sigiloso, status, created_at')
      .single();

    if (insertErr) {
      // Se a coluna nome_solicitante ainda não existir no banco (migration pendente),
      // faz fallback concatenando na descrição para não perder o pedido!
      if (insertErr.message?.includes('nome_solicitante') || insertErr.message?.includes('column')) {
        delete payload.nome_solicitante;
        delete payload.contato_solicitante;
        let descComContato = payload.descricao;
        if (nome_solicitante || contato_solicitante) {
          descComContato = `[Solicitante: ${nome_solicitante || 'Anônimo'} | Contato: ${contato_solicitante || 'Não informado'}]\n\n${descComContato}`;
        }
        payload.descricao = descComContato;

        const { data: fallbackPedido, error: fallbackErr } = await admin
          .from('pastoral_pedidos_oracao')
          .insert([payload])
          .select('id, assunto, tipo, sigiloso, status, created_at')
          .single();

        if (fallbackErr) {
          console.error('Erro ao inserir pedido de oração (fallback):', fallbackErr);
          return NextResponse.json({ error: 'Erro ao registrar pedido de oração.' }, { status: 500 });
        }

        return NextResponse.json(
          { message: 'Pedido de oração recebido com sucesso!', pedido: fallbackPedido },
          { status: 201 }
        );
      }

      console.error('Erro ao registrar pedido de oração público:', insertErr);
      return NextResponse.json(
        { error: 'Erro ao registrar pedido de oração.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Pedido de oração recebido com sucesso!', pedido: novoPedido },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro em POST /api/v1/public/igreja/[slug]/oracao:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar pedido de oração.' },
      { status: 500 }
    );
  }
}
