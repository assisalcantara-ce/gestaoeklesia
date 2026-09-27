import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { hashTokenPainel } from '@/lib/reunioes-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/reunioes/painel/[token]
 *
 * Endpoint público, sem autenticação, para exibição de métricas em tempo real
 * no telão/projetor/TV durante a reunião ministerial.
 *
 * Requisitos estritos de privacidade e segurança:
 * - Validação por hash criptográfico SHA-256;
 * - Rejeita tokens inválidos, expirados, revogados ou de reuniões encerradas;
 * - Retorna SOMENTE dados agregados / consolidados da reunião;
 * - NUNCA expõe nomes de ministros, CPF, contatos, justificativas individuais ou dados sensíveis.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await props.params;

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
      return NextResponse.json(
        { error: 'Token de acesso inválido.', code: 'TOKEN_INVALIDO' },
        { status: 400 }
      );
    }

    const tokenHash = hashTokenPainel(rawToken);
    const admin = createServerClient();
    const agoraIso = new Date().toISOString();

    // 1. Localizar o token no banco através do HASH
    const { data: tokenRow, error: tErr } = await admin
      .from('reunioes_painel_tokens')
      .select('id, reuniao_id, ministry_id, status, expira_em')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (tErr || !tokenRow) {
      return NextResponse.json(
        { error: 'Painel não encontrado ou link inválido.', code: 'TOKEN_NAO_ENCONTRADO' },
        { status: 404 }
      );
    }

    // 2. Validar revogação administrativa
    if (tokenRow.status === 'revogado') {
      return NextResponse.json(
        { error: 'Este link de exibição foi revogado pela administração.', code: 'TOKEN_REVOGADO' },
        { status: 403 }
      );
    }

    // 3. Validar se token foi inativado por encerramento
    if (tokenRow.status === 'inativado_encerramento') {
      return NextResponse.json(
        { error: 'A reunião associada a este painel já foi encerrada.', code: 'REUNIAO_ENCERRADA' },
        { status: 403 }
      );
    }

    // 4. Validar expiração por data/hora
    if (new Date(tokenRow.expira_em) <= new Date() || tokenRow.status === 'expirado') {
      // Atualizar status para expirado se ainda estiver ativo
      if (tokenRow.status === 'ativo') {
        await admin
          .from('reunioes_painel_tokens')
          .update({ status: 'expirado' })
          .eq('id', tokenRow.id);
      }

      return NextResponse.json(
        { error: 'O link de acesso ao painel expirou.', code: 'TOKEN_EXPIRADO' },
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
        { error: 'Dados da reunião não localizados.', code: 'REUNIAO_NAO_ENCONTRADA' },
        { status: 404 }
      );
    }

    // Rejeitar se a reunião estiver encerrada ou cancelada
    if (reuniao.status === 'encerrada') {
      await admin
        .from('reunioes_painel_tokens')
        .update({ status: 'inativado_encerramento' })
        .eq('id', tokenRow.id);

      return NextResponse.json(
        { error: 'Esta reunião ministerial foi finalizada.', code: 'REUNIAO_ENCERRADA' },
        { status: 403 }
      );
    }

    if (reuniao.status === 'cancelada') {
      return NextResponse.json(
        { error: 'Esta reunião ministerial foi cancelada.', code: 'REUNIAO_CANCELADA' },
        { status: 403 }
      );
    }

    // 6. Atualizar data de último acesso ao token de forma assíncrona segura
    try {
      await admin
        .from('reunioes_painel_tokens')
        .update({ ultimo_acesso_em: agoraIso })
        .eq('id', tokenRow.id);
    } catch (acessoErr) {
      console.warn('Falha ao atualizar ultimo_acesso_em:', acessoErr);
    }

    // 7. Calcular métricas agregadas a partir do snapshot dos participantes
    const { data: participantes, error: pErr } = await admin
      .from('reunioes_participantes')
      .select('status_presenca, nome_congregacao_snapshot, area_snapshot')
      .eq('reuniao_id', reuniao.id)
      .eq('ministry_id', tokenRow.ministry_id);

    if (pErr) {
      return NextResponse.json(
        { error: 'Erro ao consolidar indicadores de presença.', detail: pErr.message },
        { status: 500 }
      );
    }

    const lista = participantes || [];
    const totalEsperado = lista.length;
    let totalPresente = 0;
    let totalJustificado = 0;
    let totalPendenteOuFalta = 0;

    const porCongregacaoMap: Record<string, { nome: string; esperados: number; presentes: number }> = {};
    const porAreaMap: Record<string, { area: string; esperados: number; presentes: number }> = {};

    for (const p of lista) {
      const isPresente = p.status_presenca === 'presente';
      const isJustificado = p.status_presenca === 'falta_justificada';

      if (isPresente) {
        totalPresente++;
      } else if (isJustificado) {
        totalJustificado++;
      } else {
        totalPendenteOuFalta++;
      }

      // Agregação por Congregação (apenas contadores)
      const congNome = (p.nome_congregacao_snapshot || 'Sede Central').trim();
      if (!porCongregacaoMap[congNome]) {
        porCongregacaoMap[congNome] = { nome: congNome, esperados: 0, presentes: 0 };
      }
      porCongregacaoMap[congNome].esperados++;
      if (isPresente) {
        porCongregacaoMap[congNome].presentes++;
      }

      // Agregação por Área (apenas contadores, quando preenchida)
      if (p.area_snapshot && p.area_snapshot.trim()) {
        const areaNome = p.area_snapshot.trim();
        if (!porAreaMap[areaNome]) {
          porAreaMap[areaNome] = { area: areaNome, esperados: 0, presentes: 0 };
        }
        porAreaMap[areaNome].esperados++;
        if (isPresente) {
          porAreaMap[areaNome].presentes++;
        }
      }
    }

    const totalAusente = totalEsperado - totalPresente;
    const percentualPresenca = totalEsperado > 0 ? Number(((totalPresente / totalEsperado) * 100).toFixed(1)) : 0;
    const percentualAusencia = totalEsperado > 0 ? Number(((totalAusente / totalEsperado) * 100).toFixed(1)) : 0;

    // Converter mapas em listas ordenadas por número de presentes
    const consolidadoPorCongregacao = Object.values(porCongregacaoMap)
      .map((c) => ({
        congregacao: c.nome,
        total_esperado: c.esperados,
        total_presente: c.presentes,
        percentual_presenca: c.esperados > 0 ? Number(((c.presentes / c.esperados) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total_presente - a.total_presente);

    const consolidadoPorArea = Object.values(porAreaMap)
      .map((a) => ({
        area: a.area,
        total_esperado: a.esperados,
        total_presente: a.presentes,
        percentual_presenca: a.esperados > 0 ? Number(((a.presentes / a.esperados) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total_presente - a.total_presente);

    const ministry = (reuniao as any)?.ministries;

    // 8. Buscar as últimas 10 entradas (check-ins) da reunião
    const { data: ultimosCheckinsRaw } = await admin
      .from('reunioes_checkins')
      .select(`
        id,
        data_hora_checkin,
        participante:reunioes_participantes (
          nome_ministro_snapshot,
          cargo_snapshot,
          nome_congregacao_snapshot
        ),
        member:members (
          foto_url
        )
      `)
      .eq('reuniao_id', reuniao.id)
      .eq('ministry_id', tokenRow.ministry_id)
      .order('data_hora_checkin', { ascending: false })
      .limit(10);

    const ultimasEntradas = (ultimosCheckinsRaw || []).map((c: any) => ({
      nome: c.participante?.nome_ministro_snapshot || 'Ministro',
      cargo: c.participante?.cargo_snapshot || 'Ministro',
      congregacao: c.participante?.nome_congregacao_snapshot || 'Sede Central',
      foto_url: c.member?.foto_url || null,
      data_hora_checkin: c.data_hora_checkin,
    }));

    // 9. Resposta estritamente não-sensível e anônima
    return NextResponse.json({
      success: true,
      painel: {
        instituicao: {
          nome: ministry?.name || 'Gestão Eklésia',
          logo_url: ministry?.logo_url || null,
        },
        reuniao: {
          titulo: reuniao.titulo,
          local: reuniao.local,
          data: reuniao.data_reuniao,
          horario_inicio: reuniao.horario_inicio ? reuniao.horario_inicio.slice(0, 5) : '00:00',
          horario_limite_entrada: reuniao.horario_limite_entrada ? reuniao.horario_limite_entrada.slice(0, 5) : null,
          status: reuniao.status,
        },
        indicadores: {
          total_esperado: totalEsperado,
          total_presente: totalPresente,
          total_ausente: totalAusente,
          total_justificado: totalJustificado,
          percentual_presenca: percentualPresenca,
          percentual_ausencia: percentualAusencia,
        },
        ultimas_entradas: ultimasEntradas,
        consolidado_congregacoes: consolidadoPorCongregacao,
        consolidado_areas: consolidadoPorArea,
        atualizado_em: agoraIso,
      },
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao consultar painel informativo.', detail: err?.message },
      { status: 500 }
    );
  }
}
