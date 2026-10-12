import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeBrazilianPhone, getPhoneSearchVariants } from '@/lib/telefone-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/public/acolhimento/[token]/identificar
 * Identifica se um visitante já possui histórico de visitas no ministério pelo telefone.
 * Não revela dados confidenciais de outros ministérios (isolamento estrito multi-tenant).
 * Se o visitante for encontrado:
 *  - Retorna { encontrado: true, nome: "PrimeiroNome" (higienizado), bairro: "...", recorrente: true }
 * Se não for encontrado:
 *  - Retorna { encontrado: false, recorrente: false }
 * Se o telefone estiver ausente ou formato ambíguo:
 *  - Retorna erro seguro orientando a continuidade sem quebrar o fluxo.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    if (!rawToken || typeof rawToken !== 'string') {
      return NextResponse.json(
        { error: 'Token de acolhimento não fornecido.', code: 'TOKEN_INVALIDO' },
        { status: 400 }
      );
    }

    // 1. Rate Limiting por IP + Token
    const clientIp = getClientIp(request);
    const rateLimitKey = `acolhimento_identificar:${clientIp}:${rawToken.trim()}`;
    const rlResult = checkRateLimit(rateLimitKey, 15, 60 * 1000);

    if (!rlResult.allowed) {
      return NextResponse.json(
        {
          error: 'Muitas tentativas de consulta. Aguarde alguns instantes.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: rlResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rlResult.retryAfterSeconds) },
        }
      );
    }

    const admin = createServerClient();

    // 2. Validar token e obter ministry_id
    const { data: tokenRecord, error: tokenErr } = await admin
      .from('culto_tokens')
      .select('id, token, is_active, expires_at, ministry_id, culto_id')
      .eq('token', rawToken.trim())
      .maybeSingle();

    if (tokenErr || !tokenRecord || !tokenRecord.is_active) {
      return NextResponse.json(
        { error: 'Link de acolhimento não disponível.', code: 'TOKEN_INVALIDO' },
        { status: 410 }
      );
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) {
      return NextResponse.json(
        { error: 'Link de acolhimento expirado.', code: 'TOKEN_EXPIRADO' },
        { status: 410 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawTelefone = body.telefone;

    if (!rawTelefone || typeof rawTelefone !== 'string' || !rawTelefone.trim()) {
      return NextResponse.json(
        { error: 'Telefone não informado.', code: 'TELEFONE_OBRIGATORIO' },
        { status: 400 }
      );
    }

    // 3. Normalização estrita do telefone brasileiro
    const norm = normalizeBrazilianPhone(rawTelefone);
    if (!norm.valid) {
      return NextResponse.json(
        {
          error: norm.error || 'Formato de telefone inválido.',
          code: norm.ambiguous ? 'TELEFONE_AMBIGUO' : 'TELEFONE_INVALIDO',
          ambiguous: norm.ambiguous || false,
        },
        { status: 400 }
      );
    }

    // 4. Obter variantes de busca no banco para evitar perda por formatações históricas diferentes
    const searchVariants = getPhoneSearchVariants(norm.digits);

    // 5. Buscar visitante exclusivamente dentro do mesmo ministry_id (Multi-tenant estrito)
    const { data: visitantes, error: searchErr } = await admin
      .from('culto_visitantes')
      .select('id, nome, bairro, telefone, created_at')
      .eq('ministry_id', tokenRecord.ministry_id)
      .in('telefone', searchVariants)
      .order('created_at', { ascending: false })
      .limit(5);

    if (searchErr) {
      console.error('[PublicAcolhimento Identificar] Erro ao buscar visitante:', searchErr);
      return NextResponse.json(
        { error: 'Falha temporária ao consultar cadastro.' },
        { status: 500 }
      );
    }

    if (!visitantes || visitantes.length === 0) {
      // Visitante novo
      return NextResponse.json({
        encontrado: false,
        recorrente: false,
        telefone_normalizado: norm.formatted,
      });
    }

    // Se houver mais de um nome diferente associado ao mesmo número (cadastro ambíguo/compartilhado na família)
    const nomesDistintos = Array.from(
      new Set(visitantes.map((v) => v.nome.trim().toLowerCase()))
    );

    if (nomesDistintos.length > 1) {
      // Telefone compartilhado ou ambíguo: conduz de forma segura sem presumir
      return NextResponse.json({
        encontrado: true,
        ambiguo: true,
        recorrente: true,
        telefone_normalizado: norm.formatted,
        mensagem: 'Identificamos mais de um membro da família associado a este telefone.',
      });
    }

    const maisRecente = visitantes[0];

    return NextResponse.json({
      encontrado: true,
      recorrente: true,
      ambiguo: false,
      telefone_normalizado: norm.formatted,
      nome: maisRecente.nome,
      bairro: maisRecente.bairro || null,
      ultima_visita_em: maisRecente.created_at,
    });
  } catch (err: any) {
    console.error('[PublicAcolhimento Identificar] Erro inesperado:', err);
    return NextResponse.json(
      { error: 'Erro interno ao identificar visitante.' },
      { status: 500 }
    );
  }
}
