import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { hashTokenPainel, extrairIdentificadorMinistroQrCode } from '@/lib/reunioes-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/reunioes/checkin/[token]
 * Consulta pública das informações mínimas necessárias para a tela de check-in (sem login).
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
      return NextResponse.json(
        { error: 'Token de check-in inválido.', code: 'TOKEN_INVALIDO' },
        { status: 400 }
      );
    }

    const tokenHash = hashTokenPainel(rawToken);
    const admin = createServerClient();

    // 1. Localizar o token no banco através do HASH
    const { data: tokenRow, error: tErr } = await admin
      .from('reunioes_painel_tokens')
      .select('id, reuniao_id, ministry_id, status, expira_em')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (tErr || !tokenRow) {
      return NextResponse.json(
        { error: 'Link de check-in não encontrado ou inválido.', code: 'TOKEN_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    // 2. Validar revogação administrativa
    if (tokenRow.status === 'revogado') {
      return NextResponse.json(
        { error: 'Este link de check-in foi revogado pela administração.', code: 'TOKEN_REVOGADO' },
        { status: 403 }
      );
    }

    // 3. Validar se token foi inativado por encerramento
    if (tokenRow.status === 'inativado_encerramento') {
      return NextResponse.json(
        { error: 'Esta reunião ministerial já foi encerrada.', code: 'REUNIAO_ENCERRADA' },
        { status: 403 }
      );
    }

    // 4. Validar expiração por data/hora (23h59min59s da data da reunião)
    if (new Date(tokenRow.expira_em) <= new Date() || tokenRow.status === 'expirado') {
      if (tokenRow.status === 'ativo') {
        await admin
          .from('reunioes_painel_tokens')
          .update({ status: 'expirado' })
          .eq('id', tokenRow.id);
      }

      return NextResponse.json(
        { error: 'O link de acesso ao check-in expirou.', code: 'TOKEN_EXPIRADO' },
        { status: 403 }
      );
    }

    // 5. Buscar dados da reunião e ministério
    const { data: reuniao, error: rErr } = await admin
      .from('reunioes')
      .select(`
        id,
        titulo,
        local,
        data_reuniao,
        horario_inicio,
        horario_limite_entrada,
        limite_checkin_em,
        status,
        ministries (
          id,
          name,
          logo_url
        )
      `)
      .eq('id', tokenRow.reuniao_id)
      .eq('ministry_id', tokenRow.ministry_id)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json(
        { error: 'Reunião não encontrada.', code: 'REUNIAO_NAO_ENCONTRADA' },
        { status: 404 }
      );
    }

    if (reuniao.status === 'encerrada') {
      return NextResponse.json(
        { error: 'Esta reunião ministerial já foi encerrada.', code: 'REUNIAO_ENCERRADA' },
        { status: 403 }
      );
    }

    if (reuniao.status === 'cancelada') {
      return NextResponse.json(
        { error: 'Esta reunião ministerial foi cancelada.', code: 'REUNIAO_CANCELADA' },
        { status: 403 }
      );
    }

    // 6. Buscar participantes cadastrados no snapshot da reunião (sem dados pessoais sensíveis)
    const { data: participantes } = await admin
      .from('reunioes_participantes')
      .select(`
        id,
        member_id,
        nome_ministro_snapshot,
        cargo_snapshot,
        nome_congregacao_snapshot,
        status_presenca,
        carteirinha_numero_snapshot,
        unique_id_snapshot
      `)
      .eq('reuniao_id', reuniao.id)
      .eq('ministry_id', tokenRow.ministry_id)
      .order('nome_ministro_snapshot', { ascending: true });

    return NextResponse.json({
      success: true,
      reuniao: {
        id: reuniao.id,
        titulo: reuniao.titulo,
        local: reuniao.local,
        data: reuniao.data_reuniao,
        horario_inicio: reuniao.horario_inicio,
        horario_limite_entrada: reuniao.horario_limite_entrada,
        limite_checkin_em: reuniao.limite_checkin_em,
        status: reuniao.status,
        instituicao: {
          nome: (reuniao.ministries as any)?.name || 'Igreja',
          logo_url: (reuniao.ministries as any)?.logo_url || null,
        },
      },
      participantes: participantes || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao consultar check-in público.', detail: err?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/public/reunioes/checkin/[token]
 * Registra o check-in do ministro via link público seguro (sem login do recepcionista).
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
      return NextResponse.json(
        { error: 'Token de check-in inválido.', code: 'TOKEN_INVALIDO' },
        { status: 400 }
      );
    }

    const tokenHash = hashTokenPainel(rawToken);
    const admin = createServerClient();

    // 1. Validar token no banco
    const { data: tokenRow, error: tErr } = await admin
      .from('reunioes_painel_tokens')
      .select('id, reuniao_id, ministry_id, status, expira_em')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (tErr || !tokenRow) {
      return NextResponse.json(
        { error: 'Link de check-in não encontrado ou inválido.', code: 'TOKEN_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    if (tokenRow.status !== 'ativo' || new Date(tokenRow.expira_em) <= new Date()) {
      return NextResponse.json(
        { error: 'Este link de check-in está expirado ou inativo.', code: 'TOKEN_EXPIRADO' },
        { status: 403 }
      );
    }

    // 2. Validar reunião
    const { data: reuniao, error: rErr } = await admin
      .from('reunioes')
      .select('id, ministry_id, titulo, status, limite_checkin_em, total_presentes')
      .eq('id', tokenRow.reuniao_id)
      .eq('ministry_id', tokenRow.ministry_id)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json({ error: 'Reunião não encontrada.', code: 'REUNIAO_NAO_ENCONTRADA' }, { status: 404 });
    }

    if (reuniao.status === 'encerrada') {
      return NextResponse.json(
        { error: 'Check-in não permitido: Esta reunião já foi encerrada.', code: 'REUNIAO_ENCERRADA' },
        { status: 400 }
      );
    }

    if (reuniao.status === 'cancelada') {
      return NextResponse.json(
        { error: 'Check-in não permitido: Esta reunião foi cancelada.', code: 'REUNIAO_CANCELADA' },
        { status: 400 }
      );
    }

    // 3. Validar limite de tolerância para check-in
    const nowIso = new Date().toISOString();
    if (reuniao.limite_checkin_em && nowIso > reuniao.limite_checkin_em) {
      return NextResponse.json(
        {
          error: 'Horário limite de tolerância para check-in ultrapassado.',
          code: 'CHECKIN_EXPIRADO',
          limite: reuniao.limite_checkin_em,
        },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
    }

    const { qr_code, unique_id, member_id, metodo_leitura = 'qrcode_carteirinha' } = body || {};

    // 4. Localizar participante elegível no snapshot da reunião
    let participante: any = null;

    if (member_id) {
      const cleanMemberId = String(member_id).trim();
      const { data: pMem, error: pMemErr } = await admin
        .from('reunioes_participantes')
        .select('*')
        .eq('reuniao_id', reuniao.id)
        .eq('ministry_id', tokenRow.ministry_id)
        .eq('member_id', cleanMemberId)
        .maybeSingle();

      if (pMemErr) {
        console.error('[PublicCheckin] Erro ao buscar participante por member_id:', pMemErr);
        return NextResponse.json(
          { error: 'Falha de comunicação com a base de dados ao verificar convocação.', code: 'ERRO_BANCO_DADOS' },
          { status: 500 }
        );
      }
      participante = pMem;
    } else if (unique_id) {
      const cleanUnique = extrairIdentificadorMinistroQrCode(String(unique_id));
      const isUuidUnique = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanUnique);

      let queryUni = admin
        .from('reunioes_participantes')
        .select('*')
        .eq('reuniao_id', reuniao.id)
        .eq('ministry_id', tokenRow.ministry_id);

      if (isUuidUnique) {
        queryUni = queryUni.or(`member_id.eq.${cleanUnique},unique_id_snapshot.eq.${cleanUnique}`);
      } else {
        queryUni = queryUni.or(`unique_id_snapshot.eq.${cleanUnique},carteirinha_numero_snapshot.eq.${cleanUnique}`);
      }

      const { data: pUni, error: pUniErr } = await queryUni.maybeSingle();

      if (pUniErr) {
        console.error('[PublicCheckin] Erro ao buscar participante por unique_id:', pUniErr);
        return NextResponse.json(
          { error: 'Falha de comunicação com a base de dados ao verificar convocação.', code: 'ERRO_BANCO_DADOS' },
          { status: 500 }
        );
      }
      participante = pUni;
    } else if (qr_code) {
      const parsedId = extrairIdentificadorMinistroQrCode(String(qr_code));
      const rawTermo = String(qr_code).trim();
      const isUuidQr = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsedId);

      let queryQr = admin
        .from('reunioes_participantes')
        .select('*')
        .eq('reuniao_id', reuniao.id)
        .eq('ministry_id', tokenRow.ministry_id);

      if (isUuidQr) {
        queryQr = queryQr.or(`member_id.eq.${parsedId},unique_id_snapshot.eq.${parsedId}`);
      } else {
        queryQr = queryQr.or(`unique_id_snapshot.eq.${parsedId},carteirinha_numero_snapshot.eq.${parsedId}`);
      }

      let { data: pQr, error: pQrErr } = await queryQr.maybeSingle();

      if (pQrErr) {
        console.error('[PublicCheckin] Erro ao buscar participante por QR Code:', pQrErr);
        return NextResponse.json(
          { error: 'Falha de comunicação com a base de dados ao verificar convocação.', code: 'ERRO_BANCO_DADOS' },
          { status: 500 }
        );
      }

      // Fallback: se não encontrar e o termo bruto for diferente, buscar pelo termo original
      if (!pQr && rawTermo !== parsedId) {
        const { data: pQrRaw, error: pQrRawErr } = await admin
          .from('reunioes_participantes')
          .select('*')
          .eq('reuniao_id', reuniao.id)
          .eq('ministry_id', tokenRow.ministry_id)
          .or(`unique_id_snapshot.eq.${rawTermo},carteirinha_numero_snapshot.eq.${rawTermo}`)
          .maybeSingle();

        if (pQrRawErr) {
          console.error('[PublicCheckin] Erro no fallback de busca por QR Code bruto:', pQrRawErr);
          return NextResponse.json(
            { error: 'Falha de comunicação com a base de dados ao verificar convocação.', code: 'ERRO_BANCO_DADOS' },
            { status: 500 }
          );
        }
        pQr = pQrRaw;
      }

      participante = pQr;
    }

    if (!participante) {
      // Diferenciação diagnóstica segura: checar se pertence ao ministério sem expor dados pessoais publicamente
      let termoBuscaCheck = '';
      if (member_id) {
        termoBuscaCheck = String(member_id).trim();
      } else if (unique_id) {
        termoBuscaCheck = extrairIdentificadorMinistroQrCode(String(unique_id));
      } else if (qr_code) {
        termoBuscaCheck = extrairIdentificadorMinistroQrCode(String(qr_code));
      }

      if (termoBuscaCheck) {
        const isUuidCheck = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(termoBuscaCheck);

        let memberCheckQuery = admin
          .from('members')
          .select('id, status')
          .eq('ministry_id', tokenRow.ministry_id);

        if (isUuidCheck) {
          memberCheckQuery = memberCheckQuery.or(`id.eq.${termoBuscaCheck},unique_id.eq.${termoBuscaCheck}`);
        } else {
          memberCheckQuery = memberCheckQuery.or(`unique_id.eq.${termoBuscaCheck},matricula.eq.${termoBuscaCheck}`);
        }

        const { data: memberFound, error: mErr } = await memberCheckQuery.maybeSingle();

        if (mErr) {
          console.error('[PublicCheckin] Erro ao consultar tabela members:', mErr);
          return NextResponse.json(
            { error: 'Falha de comunicação com a base de dados.', code: 'ERRO_BANCO_DADOS' },
            { status: 500 }
          );
        }

        if (memberFound) {
          // Ministro pertence à instituição, mas não consta na convocação desta reunião específica.
          // Resposta genérica ao operador sem vazar dados pessoais ou nomes de pessoas não convocadas.
          return NextResponse.json(
            {
              error: 'Ministro cadastrado na instituição, porém não consta na lista de convocados desta reunião.',
              code: 'MINISTRO_NAO_CONVOCADO',
            },
            { status: 403 }
          );
        }
      }

      return NextResponse.json(
        {
          error: 'Credencial ou carteirinha não localizada no cadastro deste ministério.',
          code: 'MINISTRO_NAO_ENCONTRADO',
        },
        { status: 404 }
      );
    }

    // 5. Prevenção de duplicidade: se já presente, avisar de forma idempotente
    if (participante.status_presenca === 'presente') {
      const { data: checkinExistente } = await admin
        .from('reunioes_checkins')
        .select('data_hora_checkin')
        .eq('reuniao_id', reuniao.id)
        .eq('participante_id', participante.id)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        ja_presente: true,
        message: `Presença já confirmada anteriormente para ${participante.nome_ministro_snapshot}.`,
        participante: {
          id: participante.id,
          nome: participante.nome_ministro_snapshot,
          cargo: participante.cargo_snapshot,
          congregacao: participante.nome_congregacao_snapshot,
        },
        checkin: checkinExistente
          ? { data_hora: checkinExistente.data_hora_checkin }
          : null,
      });
    }

    // 6. Inserir registro de check-in oficial
    const { data: checkinSalvo, error: insErr } = await admin
      .from('reunioes_checkins')
      .insert({
        ministry_id: tokenRow.ministry_id,
        reuniao_id: reuniao.id,
        participante_id: participante.id,
        member_id: participante.member_id,
        data_hora_checkin: nowIso,
        metodo_leitura,
      })
      .select('id, data_hora_checkin')
      .maybeSingle();

    if (insErr) {
      // Se bateu na constraint UNIQUE (reuniao_id, member_id) por duplicidade simultânea
      if (insErr.code === '23505') {
        return NextResponse.json({
          success: true,
          ja_presente: true,
          message: `Presença já confirmada anteriormente para ${participante.nome_ministro_snapshot}.`,
          participante: {
            id: participante.id,
            nome: participante.nome_ministro_snapshot,
            cargo: participante.cargo_snapshot,
            congregacao: participante.nome_congregacao_snapshot,
          },
        });
      }

      console.error('[PublicCheckin] Erro ao inserir reunioes_checkins:', insErr);
      return NextResponse.json(
        { error: 'Erro ao registrar check-in no sistema.', detail: insErr.message },
        { status: 500 }
      );
    }

    // 7. Atualizar status de presença no snapshot do participante
    await admin
      .from('reunioes_participantes')
      .update({
        status_presenca: 'presente',
      })
      .eq('id', participante.id);

    // 8. Atualizar total de presentes da reunião de forma sincronizada
    const { count: countPresentes } = await admin
      .from('reunioes_participantes')
      .select('*', { count: 'exact', head: true })
      .eq('reuniao_id', reuniao.id)
      .eq('status_presenca', 'presente');

    const totalCalculado = countPresentes ?? ((reuniao.total_presentes || 0) + 1);

    await admin
      .from('reunioes')
      .update({
        total_presentes: totalCalculado,
        updated_at: nowIso,
      })
      .eq('id', reuniao.id);

    return NextResponse.json({
      success: true,
      ja_presente: false,
      message: `Presença confirmada com sucesso: ${participante.nome_ministro_snapshot}!`,
      participante: {
        id: participante.id,
        nome: participante.nome_ministro_snapshot,
        cargo: participante.cargo_snapshot,
        congregacao: participante.nome_congregacao_snapshot,
      },
      checkin: {
        id: checkinSalvo?.id || participante.id,
        data_hora: checkinSalvo?.data_hora_checkin || nowIso,
        total_presentes: totalCalculado,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao processar check-in.', detail: err?.message },
      { status: 500 }
    );
  }
}
