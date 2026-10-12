import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeBrazilianPhone, getPhoneSearchVariants } from '@/lib/telefone-utils';
import { isCultoAbertoHoje } from '@/lib/timezone-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/public/acolhimento/[token]/salvar
 * Validação server-side estrita com rate limiting, prevenção de duplicidade,
 * consentimento LGPD e persistência segura garantindo que IDs venham do banco.
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

    // 1. Rate Limiting em memória por IP + Token (máx 10 tentativas / minuto)
    const clientIp = getClientIp(request);
    const rateLimitKey = `acolhimento_salvar:${clientIp}:${rawToken.trim()}`;
    const rlResult = checkRateLimit(rateLimitKey, 10, 60 * 1000);

    if (!rlResult.allowed) {
      return NextResponse.json(
        {
          error: 'Muitas requisições em curto intervalo. Por favor aguarde um momento antes de reenviar.',
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

    // 2. Validação estrita do token e do status do culto no banco de dados
    const { data: tokenRecord, error: tokenErr } = await admin
      .from('culto_tokens')
      .select(`
        id,
        token,
        is_active,
        expires_at,
        ministry_id,
        culto_id,
        culto_registros (
          id,
          tipo_culto,
          data_culto,
          horario_culto,
          status,
          congregacao_id
        )
      `)
      .eq('token', rawToken.trim())
      .maybeSingle();

    if (tokenErr || !tokenRecord) {
      return NextResponse.json(
        { error: 'Este link de acolhimento não foi encontrado ou é inválido.', code: 'TOKEN_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    if (!tokenRecord.is_active) {
      return NextResponse.json(
        { error: 'Este link de acolhimento está inativo.', code: 'TOKEN_INATIVO' },
        { status: 410 }
      );
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) {
      return NextResponse.json(
        { error: 'Este link de acolhimento expirou.', code: 'TOKEN_EXPIRADO' },
        { status: 410 }
      );
    }

    const culto = tokenRecord.culto_registros as any;
    if (!culto) {
      return NextResponse.json(
        { error: 'O culto vinculado a este link não foi encontrado.', code: 'CULTO_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    // Validação estrita de expiração e janela do culto no servidor
    const validacaoJanela = isCultoAbertoHoje(culto.data_culto, culto.status);
    if (!validacaoJanela.elegivel) {
      if (validacaoJanela.motivo === 'CULTO_ENCERRADO') {
        return NextResponse.json(
          {
            error: `O culto já se encontra ${culto.status.toLowerCase()} e não aceita mais cadastros de acolhimento.`,
            code: 'CULTO_ENCERRADO',
          },
          { status: 410 }
        );
      }
      if (validacaoJanela.motivo === 'CULTO_PASSADO') {
        return NextResponse.json(
          {
            error: 'A janela de acolhimento para este culto já foi encerrada.',
            code: 'CULTO_PASSADO',
          },
          { status: 410 }
        );
      }
      if (validacaoJanela.motivo === 'CULTO_FUTURO') {
        return NextResponse.json(
          {
            error: 'Este culto está programado para uma data futura. O acolhimento só pode ser registrado na data do culto.',
            code: 'CULTO_FUTURO',
          },
          { status: 403 }
        );
      }
    }

    // 3. Validação do Body e Consentimento LGPD
    const body = await request.json().catch(() => ({}));

    if (body.consentimento_lgpd !== true) {
      return NextResponse.json(
        {
          error: 'O consentimento com os termos da LGPD é obrigatório para registrar seus dados de acolhimento.',
          code: 'LGPD_CONSENT_REQUIRED',
        },
        { status: 400 }
      );
    }

    // Validação do Nome
    const rawNome = body.nome;
    if (!rawNome || typeof rawNome !== 'string' || rawNome.trim().length < 2) {
      return NextResponse.json(
        { error: 'Por favor, informe seu nome completo (mínimo de 2 caracteres).', code: 'NOME_INVALIDO' },
        { status: 400 }
      );
    }
    const cleanNome = rawNome.trim().slice(0, 255);

    // Validação do Telefone (se informado)
    let normalizedTelefone: string | null = null;
    let searchVariants: string[] = [];

    if (body.telefone && typeof body.telefone === 'string' && body.telefone.trim()) {
      const phoneNorm = normalizeBrazilianPhone(body.telefone);
      if (!phoneNorm.valid) {
        return NextResponse.json(
          {
            error: phoneNorm.error || 'Telefone/WhatsApp inválido. Forneça o número com DDD válido.',
            code: phoneNorm.ambiguous ? 'TELEFONE_AMBIGUO' : 'TELEFONE_INVALIDO',
          },
          { status: 400 }
        );
      }
      normalizedTelefone = phoneNorm.formatted;
      searchVariants = getPhoneSearchVariants(phoneNorm.digits);
    }

    // Bairro
    const cleanBairro =
      body.bairro && typeof body.bairro === 'string' && body.bairro.trim()
        ? body.bairro.trim().slice(0, 100)
        : null;

    // Primeira Visita
    const isPrimeiraVisita = typeof body.primeira_visita === 'boolean' ? body.primeira_visita : true;

    // Pedido de Oração
    const cleanOracao =
      body.pedido_oracao && typeof body.pedido_oracao === 'string' && body.pedido_oracao.trim()
        ? body.pedido_oracao.trim().slice(0, 2000)
        : null;

    // 4. Prevenção de duplicidade no mesmo culto
    if (normalizedTelefone && searchVariants.length > 0) {
      const { data: dupPhone } = await admin
        .from('culto_visitantes')
        .select('id, nome')
        .eq('culto_id', tokenRecord.culto_id)
        .in('telefone', searchVariants)
        .maybeSingle();

      if (dupPhone) {
        return NextResponse.json(
          {
            error: `Já encontramos um visitante registrado com este número de telefone neste culto (${dupPhone.nome}).`,
            code: 'VISITANTE_DUPLICADO',
            ja_registrado: true,
          },
          { status: 409 }
        );
      }
    } else {
      const { data: dupNome } = await admin
        .from('culto_visitantes')
        .select('id, nome')
        .eq('culto_id', tokenRecord.culto_id)
        .ilike('nome', cleanNome)
        .maybeSingle();

      if (dupNome) {
        return NextResponse.json(
          {
            error: `Já existe um visitante cadastrado com o nome "${dupNome.nome}" neste culto.`,
            code: 'VISITANTE_DUPLICADO',
            ja_registrado: true,
          },
          { status: 409 }
        );
      }
    }

    // 5. Persistência segura em culto_visitantes
    // ATENÇÃO: ministry_id, congregacao_id e culto_id são obtidos EXCLUSIVAMENTE
    // do tokenRecord validado pelo servidor, impedindo manipulação de tenant pelo cliente.
    const observacoesTexto = cleanOracao
      ? `[Acolhimento Inteligente] Pedido de oração: ${cleanOracao}`
      : '[Acolhimento Inteligente]';

    const insertPayload = {
      culto_id: tokenRecord.culto_id,
      ministry_id: tokenRecord.ministry_id,
      congregacao_id: culto.congregacao_id,
      nome: cleanNome,
      telefone: normalizedTelefone,
      cidade: null,
      bairro: cleanBairro,
      igreja_origem: null,
      primeira_visita: isPrimeiraVisita,
      is_ministro: false,
      cargo_ministerial: null,
      observacoes: observacoesTexto,
    };

    const { data: inserted, error: insertErr } = await admin
      .from('culto_visitantes')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertErr) {
      console.error('[PublicAcolhimento POST] Erro ao salvar visitante:', insertErr);
      return NextResponse.json(
        { error: 'Não foi possível salvar o acolhimento. Tente novamente mais tarde.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        mensagem: 'Visitante acolhido e registrado com sucesso!',
        visitante_id: inserted?.id,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[PublicAcolhimento POST] Erro inesperado:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar o acolhimento.' },
      { status: 500 }
    );
  }
}
