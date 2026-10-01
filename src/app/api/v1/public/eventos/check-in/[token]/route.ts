import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { decodificarEValidarTokenCheckin, extrairCodigoInscricao, isEventoElegivelCheckin } from '@/lib/eventos-checkin-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/eventos/check-in/[token]
 * Valida o token público de check-in e retorna os dados do evento e contadores em tempo real.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    const validacaoToken = decodificarEValidarTokenCheckin(rawToken);
    if (!validacaoToken.valido || !validacaoToken.eventoId) {
      return NextResponse.json(
        { error: 'Este link de check-in não está mais disponível.', motivo: validacaoToken.motivo, code: 'TOKEN_INVALIDO' },
        { status: 410 }
      );
    }

    const admin = createServerClient();

    // 1. Buscar dados do evento
    const { data: evento, error: evErr } = await admin
      .from('eventos')
      .select('id, titulo, descricao, data_inicio, data_fim, local_nome, local_endereco, status, ministry_id')
      .eq('id', validacaoToken.eventoId)
      .maybeSingle();

    if (evErr || !evento) {
      return NextResponse.json(
        { error: 'Este link de check-in não está mais disponível.', code: 'EVENTO_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    const elegivel = isEventoElegivelCheckin(evento);
    if (!elegivel.elegivel) {
      return NextResponse.json(
        { error: 'Este link de check-in não está mais disponível.', motivo: elegivel.motivo, code: 'EVENTO_ENCERRADO' },
        { status: 410 }
      );
    }

    // 2. Buscar nome da igreja
    let igrejaNome = 'Gestão Eklésia';
    const { data: configIgreja } = await admin
      .from('configuracoes_igreja')
      .select('nome_igreja')
      .eq('ministry_id', evento.ministry_id)
      .maybeSingle();

    if (configIgreja?.nome_igreja) {
      igrejaNome = configIgreja.nome_igreja;
    } else {
      const { data: ministry } = await admin
        .from('ministries')
        .select('name')
        .eq('id', evento.ministry_id)
        .maybeSingle();
      if (ministry?.name) igrejaNome = ministry.name;
    }

    // 3. Calcular métricas em tempo real
    const { count: confirmadosCount } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .eq('status', 'confirmado');

    const { count: presentesCount } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .eq('status', 'confirmado')
      .eq('presente', true);

    return NextResponse.json({
      evento: {
        id: evento.id,
        titulo: evento.titulo,
        descricao: evento.descricao,
        data_inicio: evento.data_inicio,
        data_fim: evento.data_fim,
        local_nome: evento.local_nome,
        status: evento.status,
        igreja_nome: igrejaNome,
        total_confirmados: confirmadosCount ?? 0,
        total_presentes: presentesCount ?? 0,
      },
    });
  } catch (err: any) {
    console.error('[PublicCheckin] Erro ao carregar informações:', err);
    return NextResponse.json(
      { error: 'Erro interno ao validar check-in.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/public/eventos/check-in/[token]
 * Realiza o check-in do participante via leitura de QR Code ou código digitado.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    const validacaoToken = decodificarEValidarTokenCheckin(rawToken);
    if (!validacaoToken.valido || !validacaoToken.eventoId) {
      return NextResponse.json(
        { error: 'Este link de check-in não está mais disponível.', motivo: validacaoToken.motivo, code: 'TOKEN_INVALIDO' },
        { status: 410 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawCodigo = body.codigo;

    if (!rawCodigo || typeof rawCodigo !== 'string') {
      return NextResponse.json(
        { error: 'Código de inscrição ou QR Code não fornecido.', code: 'CODIGO_OBRIGATORIO' },
        { status: 400 }
      );
    }

    const codigo = extrairCodigoInscricao(rawCodigo);
    if (!codigo) {
      return NextResponse.json(
        { error: 'Código de inscrição inválido.', code: 'CODIGO_INVALIDO' },
        { status: 400 }
      );
    }

    const admin = createServerClient();
    const agoraIso = new Date().toISOString();

    // 1. Validar evento
    const { data: evento, error: evErr } = await admin
      .from('eventos')
      .select('id, titulo, data_inicio, data_fim, status')
      .eq('id', validacaoToken.eventoId)
      .maybeSingle();

    if (evErr || !evento) {
      return NextResponse.json(
        { error: 'Este link de check-in não está mais disponível.', code: 'EVENTO_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    const elegivel = isEventoElegivelCheckin(evento);
    if (!elegivel.elegivel) {
      return NextResponse.json(
        { error: 'Este link de check-in não está mais disponível.', motivo: elegivel.motivo, code: 'EVENTO_ENCERRADO' },
        { status: 410 }
      );
    }

    // 2. Localizar inscrição
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigo);

    let query = admin
      .from('eventos_inscricoes')
      .select('id, evento_id, member_id, nome_externo, email_externo, telefone, status, presente, checkin_em, tem_brinde, com_hospedagem')
      .eq('evento_id', evento.id);

    if (isUuid) {
      query = query.eq('id', codigo);
    } else {
      // Busca pelo prefixo de 8 caracteres do UUID (ex: C4B8B64E)
      query = query.ilike('id', `${codigo}%`);
    }

    const { data: rawInscricoes, error: iErr } = await query.limit(2);
    const inscricoesEncontradas = rawInscricoes ? [...rawInscricoes] : [];

    if (iErr || inscricoesEncontradas.length === 0) {
      // Fallback: se o usuário digitou o nome na busca manual
      const { data: buscaPorNome } = await admin
        .from('eventos_inscricoes')
        .select('id, evento_id, member_id, nome_externo, email_externo, telefone, status, presente, checkin_em, tem_brinde, com_hospedagem')
        .eq('evento_id', evento.id)
        .ilike('nome_externo', `%${codigo}%`)
        .limit(2);

      if (!buscaPorNome || buscaPorNome.length === 0) {
        return NextResponse.json(
          { error: 'QR Code inválido ou inscrição não encontrada neste evento.', code: 'INSCRICAO_NAO_ENCONTRADA' },
          { status: 404 }
        );
      }
      inscricoesEncontradas.push(...buscaPorNome);
    }

    const inscricao = inscricoesEncontradas[0];

    // 3. Obter nome do participante
    let nomeParticipante = inscricao.nome_externo || 'Participante';
    if (inscricao.member_id) {
      const { data: membro } = await admin
        .from('members')
        .select('name')
        .eq('id', inscricao.member_id)
        .maybeSingle();
      if (membro?.name) {
        nomeParticipante = membro.name;
      }
    }

    // 4. Validar status da inscrição
    if (inscricao.status !== 'confirmado') {
      const statusLabel =
        inscricao.status === 'lista_espera'
          ? 'Lista de Espera'
          : inscricao.status === 'cancelado'
          ? 'Cancelada'
          : inscricao.status;

      return NextResponse.json(
        {
          error: `Inscrição não está confirmada (Situação atual: ${statusLabel}).`,
          code: 'STATUS_NAO_CONFIRMADO',
          participante: { nome: nomeParticipante, status: inscricao.status },
        },
        { status: 400 }
      );
    }

    // Buscar contadores atuais
    const { count: confirmadosTotal } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .eq('status', 'confirmado');

    const { count: presentesTotal } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .eq('status', 'confirmado')
      .eq('presente', true);

    const totalConf = confirmadosTotal ?? 0;
    let totalPres = presentesTotal ?? 0;

    // 5. Verificar se já realizou check-in
    if (inscricao.presente === true) {
      return NextResponse.json({
        status: 'ja_realizado',
        mensagem: 'Participante já realizou o check-in.',
        participante: {
          id: inscricao.id,
          nome: nomeParticipante,
          email: inscricao.email_externo,
          telefone: inscricao.telefone,
          tem_brinde: inscricao.tem_brinde,
          com_hospedagem: inscricao.com_hospedagem,
        },
        checkin_em: inscricao.checkin_em,
        evento_titulo: evento.titulo,
        total_presentes: totalPres,
        total_confirmados: totalConf,
      });
    }

    // 6. Efetivar check-in
    const { error: updErr } = await admin
      .from('eventos_inscricoes')
      .update({
        presente: true,
        checkin_em: agoraIso,
      })
      .eq('id', inscricao.id);

    if (updErr) {
      return NextResponse.json(
        { error: 'Erro ao registrar check-in no banco de dados.', detail: updErr.message },
        { status: 500 }
      );
    }

    totalPres += 1;

    return NextResponse.json({
      status: 'sucesso',
      mensagem: 'Check-in realizado com sucesso!',
      participante: {
        id: inscricao.id,
        nome: nomeParticipante,
        email: inscricao.email_externo,
        telefone: inscricao.telefone,
        tem_brinde: inscricao.tem_brinde,
        com_hospedagem: inscricao.com_hospedagem,
      },
      checkin_em: agoraIso,
      evento_titulo: evento.titulo,
      total_presentes: totalPres,
      total_confirmados: totalConf,
    });
  } catch (err: any) {
    console.error('[PublicCheckin] Erro ao processar check-in:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar leitura do check-in.' },
      { status: 500 }
    );
  }
}
