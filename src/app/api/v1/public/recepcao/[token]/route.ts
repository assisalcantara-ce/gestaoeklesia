import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  hashCultoRecepcaoToken,
  verifyRecepcaoTokenStatus,
} from '@/lib/culto-recepcao-utils';
import { CultoRecepcaoService, type TokenRecepcaoRecord } from '@/lib/culto-recepcao-service';

export const dynamic = 'force-dynamic';

/**
 * Helper para validar o token público e carregar contexto seguro do culto
 */
async function validarTokenPublico(rawParam: any, admin: ReturnType<typeof createServerClient>) {
  const tokenStr = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const rawToken = typeof tokenStr === 'string' ? decodeURIComponent(tokenStr).trim() : '';

  if (!rawToken || rawToken.length < 10) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Token de recepção inválido ou malformado.', code: 'TOKEN_INVALIDO' },
        { status: 400 }
      ),
    };
  }

  let tokenHash: string;
  try {
    tokenHash = hashCultoRecepcaoToken(rawToken);
  } catch {
    return {
      errorResponse: NextResponse.json(
        { error: 'Formato de token de recepção inválido.', code: 'TOKEN_INVALIDO' },
        { status: 400 }
      ),
    };
  }

  const service = new CultoRecepcaoService(admin);
  let tokenRecord: TokenRecepcaoRecord | null = null;
  try {
    tokenRecord = await service.buscarTokenPorHash(tokenHash);
  } catch (err: any) {
    console.error('Erro ao buscar token:', err);
    return {
      errorResponse: NextResponse.json(
        { error: 'Falha interna ao verificar token de recepção.', code: 'ERRO_INTERNO' },
        { status: 500 }
      ),
    };
  }

  if (!tokenRecord) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Este link da Central de Recepção não foi encontrado no sistema.', code: 'TOKEN_NAO_ENCONTRADO' },
        { status: 404 }
      ),
    };
  }

  // Buscar dados do culto, ministério e congregação
  const { data: culto, error: cultoErr } = await admin
    .from('culto_registros')
    .select(`
      id, tipo_culto, data_culto, horario_culto, dirigente, pregador, status,
      congregacao_id, ministry_id,
      congregacoes ( nome ),
      ministries ( name, logo_url )
    `)
    .eq('id', tokenRecord.culto_id)
    .maybeSingle();

  if (cultoErr) {
    console.error('Erro ao consultar dados do culto:', cultoErr);
    return {
      errorResponse: NextResponse.json(
        { error: 'Falha temporária ao carregar dados do culto.', code: 'ERRO_INTERNO' },
        { status: 500 }
      ),
    };
  }

  if (!culto) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Culto vinculado a este link não foi encontrado.', code: 'CULTO_NAO_ENCONTRADO' },
        { status: 404 }
      ),
    };
  }

  // Verificar validade e expiração
  const statusCheck = verifyRecepcaoTokenStatus({
    expira_em: tokenRecord.expira_em,
    revogado_em: tokenRecord.revogado_em,
    status_culto: culto.status,
  });

  if (!statusCheck.valido) {
    return {
      errorResponse: NextResponse.json(
        {
          error: statusCheck.mensagem || 'Este link de recepção não está mais disponível.',
          code: statusCheck.motivo || 'TOKEN_EXPIRADO',
          expira_em: tokenRecord.expira_em,
          revogado_em: tokenRecord.revogado_em,
          culto: {
            tipo_culto: culto.tipo_culto,
            data_culto: culto.data_culto,
            status: culto.status,
          },
        },
        { status: 410 }
      ),
    };
  }

  // Buscar Church Profile (logo e nome personalizado)
  let igrejaNome = (culto as any)?.ministries?.name || 'Gestão Eklésia';
  let logoUrl = (culto as any)?.ministries?.logo_url || null;

  try {
    const { data: configRow } = await admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', tokenRecord.ministry_id)
      .maybeSingle();

    const churchProfile = (configRow as any)?.church_profile || {};
    if (churchProfile.nome?.trim()) igrejaNome = churchProfile.nome.trim();
    if (churchProfile.logo?.trim()) logoUrl = churchProfile.logo.trim();
  } catch {
    // Mantém dados de ministries
  }

  // Registrar último acesso de forma não bloqueante
  service.registrarAcessoToken(tokenRecord.culto_id).catch(() => {});

  return {
    service,
    tokenRecord,
    culto,
    igrejaNome,
    logoUrl,
  };
}

/**
 * GET /api/v1/public/recepcao/[token]
 * Retorna dados para a página pública móvel da recepção.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    // Rate limiting: 60 requisições por minuto por IP
    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`recepcao_get:${clientIp}`, 60, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde um momento.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const admin = createServerClient();
    const validacao = await validarTokenPublico(rawToken, admin);
    if (validacao.errorResponse) return validacao.errorResponse;

    const { service, tokenRecord, culto, igrejaNome, logoUrl } = validacao;
    const dados = await service!.listarDadosRecepcao(tokenRecord!.culto_id);

    // Sanitização de visitantes (sem dados sensíveis como CPF ou credenciais)
    const visitantesSeguros = dados.visitantes.map(v => ({
      id: v.id,
      nome: v.nome,
      telefone: v.telefone || null,
      cidade: v.cidade || null,
      bairro: v.bairro || null,
      igreja_origem: v.igreja_origem || null,
      primeira_visita: v.primeira_visita,
      is_ministro: v.is_ministro,
      cargo_ministerial: v.cargo_ministerial || null,
      observacoes: v.observacoes || null,
      created_at: v.created_at,
    }));

    return NextResponse.json({
      igreja_nome: igrejaNome,
      logo_url: logoUrl,
      culto: {
        id: culto!.id,
        tipo_culto: culto!.tipo_culto,
        data_culto: culto!.data_culto,
        horario_culto: culto!.horario_culto,
        dirigente: culto!.dirigente,
        pregador: culto!.pregador,
        status: culto!.status,
        congregacao_nome: (culto as any)?.congregacoes?.nome || 'Sede',
      },
      expira_em: tokenRecord!.expira_em,
      visitantes: visitantesSeguros,
      autoridades: dados.autoridades,
      oracoes: dados.oracoes,
      avisos: dados.avisos,
      familias: dados.familias,
      resumo: dados.resumo,
    });
  } catch (err: any) {
    console.error('Erro na rota pública de recepção (GET):', err);
    return NextResponse.json(
      { error: 'Falha ao carregar dados da recepção.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/public/recepcao/[token]
 * Criação de registros na página pública móvel enquanto o link for válido.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    // Rate limiting: 20 requisições por minuto por IP para escrita
    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`recepcao_post:${clientIp}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições em curto intervalo. Aguarde.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const admin = createServerClient();
    const validacao = await validarTokenPublico(rawToken, admin);
    if (validacao.errorResponse) return validacao.errorResponse;

    const { service, tokenRecord } = validacao;
    const body = await request.json().catch(() => ({}));
    const secao = body.secao;
    const dados = body.dados || {};

    const baseParams = {
      culto_id: tokenRecord!.culto_id,
      ministry_id: tokenRecord!.ministry_id,
      congregacao_id: tokenRecord!.congregacao_id,
      ...dados,
    };

    if (secao === 'visitantes') {
      if (!dados.nome || typeof dados.nome !== 'string' || dados.nome.trim().length < 2) {
        return NextResponse.json(
          { error: 'Por favor, informe o nome do visitante (mínimo de 2 caracteres).', code: 'NOME_INVALIDO' },
          { status: 400 }
        );
      }
      const res = await service!.salvarVisitante(baseParams);
      return NextResponse.json({
        success: true,
        item: res.item,
        ja_existia: res.ja_existia,
        mensagem: res.ja_existia ? 'Visitante já cadastrado neste culto. Informações atualizadas.' : 'Visitante cadastrado com sucesso!',
      });
    }

    if (secao === 'autoridades') {
      if (!dados.nome || typeof dados.nome !== 'string' || dados.nome.trim().length < 2) {
        return NextResponse.json(
          { error: 'Nome da autoridade/pastor é obrigatório.', code: 'NOME_INVALIDO' },
          { status: 400 }
        );
      }
      if (!dados.cargo_funcao || typeof dados.cargo_funcao !== 'string' || !dados.cargo_funcao.trim()) {
        return NextResponse.json(
          { error: 'Cargo ou função é obrigatório (ex: Pastor, Prefeito, Bispo).', code: 'CARGO_INVALIDO' },
          { status: 400 }
        );
      }
      const item = await service!.salvarAutoridade(baseParams);
      return NextResponse.json({ success: true, item, mensagem: 'Autoridade registrada com sucesso!' });
    }

    if (secao === 'oracoes') {
      if (!dados.nome || typeof dados.nome !== 'string' || dados.nome.trim().length < 2) {
        return NextResponse.json(
          { error: 'Nome do solicitante é obrigatório.', code: 'NOME_INVALIDO' },
          { status: 400 }
        );
      }
      if (!dados.motivo || typeof dados.motivo !== 'string' || !dados.motivo.trim()) {
        return NextResponse.json(
          { error: 'Motivo da oração ou ação de graças é obrigatório.', code: 'MOTIVO_INVALIDO' },
          { status: 400 }
        );
      }
      const item = await service!.salvarOracao(baseParams);
      return NextResponse.json({ success: true, item, mensagem: 'Pedido de oração registrado com sucesso!' });
    }

    if (secao === 'avisos') {
      if (!dados.titulo || typeof dados.titulo !== 'string' || !dados.titulo.trim()) {
        return NextResponse.json(
          { error: 'Título do aviso é obrigatório.', code: 'TITULO_INVALIDO' },
          { status: 400 }
        );
      }
      if (!dados.conteudo || typeof dados.conteudo !== 'string' || !dados.conteudo.trim()) {
        return NextResponse.json(
          { error: 'Conteúdo do aviso é obrigatório.', code: 'CONTEUDO_INVALIDO' },
          { status: 400 }
        );
      }
      const item = await service!.salvarAviso(baseParams);
      return NextResponse.json({ success: true, item, mensagem: 'Aviso registrado com sucesso!' });
    }

    if (secao === 'familias') {
      if (!dados.responsavel || typeof dados.responsavel !== 'string' || dados.responsavel.trim().length < 2) {
        return NextResponse.json(
          { error: 'Nome do responsável pela família é obrigatório.', code: 'RESPONSAVEL_INVALIDO' },
          { status: 400 }
        );
      }
      const item = await service!.salvarFamilia(baseParams);
      return NextResponse.json({ success: true, item, mensagem: 'Família registrada com sucesso!' });
    }

    return NextResponse.json({ error: 'Seção inválida.', code: 'SECAO_INVALIDA' }, { status: 400 });
  } catch (err: any) {
    console.error('Erro na rota pública de recepção (POST):', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao salvar registro.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/public/recepcao/[token]
 * Edição de registros pela página pública enquanto o link for válido.
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`recepcao_put:${clientIp}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde um momento.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const admin = createServerClient();
    const validacao = await validarTokenPublico(rawToken, admin);
    if (validacao.errorResponse) return validacao.errorResponse;

    const { service, tokenRecord } = validacao;
    const body = await request.json().catch(() => ({}));
    const { secao, id, dados } = body;

    if (!secao || !id) {
      return NextResponse.json(
        { error: 'Seção e identificador do registro são obrigatórios.', code: 'PARAMETROS_INVALIDOS' },
        { status: 400 }
      );
    }

    const baseParams = {
      id,
      culto_id: tokenRecord!.culto_id,
      ministry_id: tokenRecord!.ministry_id,
      congregacao_id: tokenRecord!.congregacao_id,
      ...dados,
    };

    if (secao === 'visitantes') {
      const res = await service!.salvarVisitante(baseParams);
      return NextResponse.json({ success: true, item: res.item, mensagem: 'Visitante atualizado com sucesso!' });
    }
    if (secao === 'autoridades') {
      const item = await service!.salvarAutoridade(baseParams);
      return NextResponse.json({ success: true, item, mensagem: 'Autoridade atualizada com sucesso!' });
    }
    if (secao === 'oracoes') {
      const item = await service!.salvarOracao(baseParams);
      return NextResponse.json({ success: true, item, mensagem: 'Pedido de oração atualizado com sucesso!' });
    }
    if (secao === 'avisos') {
      const item = await service!.salvarAviso(baseParams);
      return NextResponse.json({ success: true, item, mensagem: 'Aviso atualizado com sucesso!' });
    }
    if (secao === 'familias') {
      const item = await service!.salvarFamilia(baseParams);
      return NextResponse.json({ success: true, item, mensagem: 'Família atualizada com sucesso!' });
    }

    return NextResponse.json({ error: 'Seção inválida.', code: 'SECAO_INVALIDA' }, { status: 400 });
  } catch (err: any) {
    console.error('Erro na rota pública de recepção (PUT):', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao atualizar registro.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/public/recepcao/[token]
 * Remoção lógica de registros pela página pública enquanto o link for válido.
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`recepcao_del:${clientIp}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde um momento.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const admin = createServerClient();
    const validacao = await validarTokenPublico(rawToken, admin);
    if (validacao.errorResponse) return validacao.errorResponse;

    const { service, tokenRecord } = validacao;
    const { searchParams } = new URL(request.url);
    const secao = searchParams.get('secao') as any;
    const itemId = searchParams.get('id');

    if (!secao || !itemId) {
      return NextResponse.json(
        { error: 'Seção e identificador do registro são obrigatórios.', code: 'PARAMETROS_INVALIDOS' },
        { status: 400 }
      );
    }

    const ok = await service!.removerItem(secao, itemId, tokenRecord!.culto_id);
    return NextResponse.json({
      success: ok,
      mensagem: ok ? 'Registro removido com sucesso.' : 'Registro não encontrado para remoção.',
    });
  } catch (err: any) {
    console.error('Erro na rota pública de recepção (DELETE):', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao remover registro.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
