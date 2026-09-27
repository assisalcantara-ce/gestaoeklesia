import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { extrairIdentificadorMinistroQrCode } from '@/lib/reunioes-utils';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * POST /api/v1/reunioes/[id]/checkin
 * Registra o check-in de presença do ministro na reunião ministerial.
 *
 * Payload aceito:
 * - qr_code: URL ou código lido da carteirinha
 * - unique_id: identificador único da credencial
 * - member_id: ID do membro (quando informado em modo manual)
 * - metodo_leitura: 'qrcode_carteirinha' | 'manual_secretaria' | 'busca_nome'
 * - dispositivo_info: opcional
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reuniaoId } = await props.params;
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'meetings_module');
    if (!isAllowed) {
      return NextResponse.json(REUNIOES_RESTRICTED_RESPONSE, { status: 403 });
    }

    if (!reuniaoId || typeof reuniaoId !== 'string') {
      return NextResponse.json({ error: 'ID da reunião é obrigatório.' }, { status: 400 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
    }

    const {
      qr_code,
      unique_id,
      member_id,
      metodo_leitura = 'qrcode_carteirinha',
      dispositivo_info,
    } = body || {};

    const metodoFinal = ['qrcode_carteirinha', 'manual_secretaria', 'busca_nome'].includes(metodo_leitura)
      ? metodo_leitura
      : 'qrcode_carteirinha';

    // ─── 1. Validar e Localizar a Reunião no Tenant ───────────────────────────
    const { data: reuniao, error: rErr } = await ctx.admin
      .from('reunioes')
      .select('id, ministry_id, titulo, status, limite_checkin_em, total_presentes, data_reuniao')
      .eq('id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json({ error: 'Reunião não encontrada no ministério autenticado.' }, { status: 404 });
    }

    // ─── 2. Validar Status da Reunião ─────────────────────────────────────────
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

    // ─── 3. Validar Horário Limite de Tolerância (TIMESTAMPTZ) ────────────────
    const nowTimestamp = new Date().toISOString();
    if (reuniao.limite_checkin_em && nowTimestamp > reuniao.limite_checkin_em) {
      return NextResponse.json(
        {
          error: 'Horário limite de tolerância para check-in ultrapassado.',
          code: 'HORARIO_LIMITE_EXPIRADO',
          limite_checkin_em: reuniao.limite_checkin_em,
        },
        { status: 400 }
      );
    }

    // ─── 4. Extrair Identificador do Ministro ─────────────────────────────────
    let identifierToMatch: string | null = null;
    let isDirectMemberId = false;

    if (qr_code && typeof qr_code === 'string') {
      identifierToMatch = extrairIdentificadorMinistroQrCode(qr_code);
    } else if (unique_id && typeof unique_id === 'string') {
      identifierToMatch = unique_id.trim();
    } else if (member_id && typeof member_id === 'string' && (metodoFinal === 'manual_secretaria' || metodoFinal === 'busca_nome')) {
      identifierToMatch = member_id.trim();
      isDirectMemberId = true;
    }

    if (!identifierToMatch) {
      return NextResponse.json(
        { error: 'Nenhum identificador de ministro fornecido (qr_code, unique_id ou member_id).' },
        { status: 400 }
      );
    }

    // ─── 5. Localizar Participante no Snapshot da Reunião ─────────────────────
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifierToMatch);

    let partQuery = ctx.admin
      .from('reunioes_participantes')
      .select(`
        id,
        reuniao_id,
        ministry_id,
        member_id,
        nome_ministro_snapshot,
        cargo_snapshot,
        congregacao_id_snapshot,
        nome_congregacao_snapshot,
        area_snapshot,
        carteirinha_numero_snapshot,
        unique_id_snapshot,
        status_presenca
      `)
      .eq('reuniao_id', reuniaoId)
      .eq('ministry_id', ctx.ministryId);

    if (isDirectMemberId) {
      partQuery = partQuery.eq('member_id', identifierToMatch);
    } else if (isUuid) {
      partQuery = partQuery.or(`member_id.eq.${identifierToMatch},unique_id_snapshot.eq.${identifierToMatch}`);
    } else {
      partQuery = partQuery.eq('unique_id_snapshot', identifierToMatch);
    }

    const { data: participante, error: pErr } = await partQuery.maybeSingle();

    if (pErr || !participante) {
      // Verificar se o membro existe no tenant mas não está no snapshot
      let memberCheckQuery = ctx.admin
        .from('members')
        .select('id, name, status, tipo_cadastro')
        .eq('ministry_id', ctx.ministryId);

      if (isUuid) {
        memberCheckQuery = memberCheckQuery.or(`id.eq.${identifierToMatch},unique_id.eq.${identifierToMatch}`);
      } else {
        memberCheckQuery = memberCheckQuery.eq('unique_id', identifierToMatch);
      }

      const { data: memberFound } = await memberCheckQuery.maybeSingle();

      if (!memberFound) {
        return NextResponse.json(
          { error: 'Credencial ou ministro não encontrado neste ministério.', code: 'MINISTRO_NAO_ENCONTRADO' },
          { status: 404 }
        );
      }

      if (memberFound.status !== 'active') {
        return NextResponse.json(
          { error: `Check-in não permitido: O ministro ${memberFound.name} está com cadastro inativo.`, code: 'MINISTRO_INATIVO' },
          { status: 400 }
        );
      }

      if (memberFound.tipo_cadastro !== 'ministro') {
        return NextResponse.json(
          { error: `Check-in não permitido: O membro ${memberFound.name} não possui cadastro de ministro.`, code: 'NAO_E_MINISTRO' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: `O ministro ${memberFound.name} não está convocado no snapshot desta reunião.`,
          code: 'FORA_DO_SNAPSHOT',
        },
        { status: 400 }
      );
    }

    // ─── 6. Validar Status do Membro na Origem ─────────────────────────────────
    const { data: memberActual, error: memErr } = await ctx.admin
      .from('members')
      .select('id, name, status, tipo_cadastro')
      .eq('id', participante.member_id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (memErr || !memberActual) {
      return NextResponse.json({ error: 'Cadastro do ministro não encontrado.' }, { status: 404 });
    }

    if (memberActual.status !== 'active') {
      return NextResponse.json(
        { error: `Check-in bloqueado: O cadastro de ${participante.nome_ministro_snapshot} está inativo.`, code: 'MINISTRO_INATIVO' },
        { status: 400 }
      );
    }

    if (memberActual.tipo_cadastro !== 'ministro') {
      return NextResponse.json(
        { error: `Check-in bloqueado: ${participante.nome_ministro_snapshot} não é classificado como ministro.`, code: 'NAO_E_MINISTRO' },
        { status: 400 }
      );
    }

    // ─── 7. Validar Check-in Duplicado ─────────────────────────────────────────
    if (participante.status_presenca === 'presente') {
      // Buscar dados do check-in já existente
      const { data: existingCheckin } = await ctx.admin
        .from('reunioes_checkins')
        .select('data_hora_checkin, metodo_leitura')
        .eq('reuniao_id', reuniaoId)
        .eq('member_id', participante.member_id)
        .maybeSingle();

      return NextResponse.json(
        {
          success: true,
          ja_presente: true,
          message: `Check-in já realizado anteriormente para ${participante.nome_ministro_snapshot}.`,
          participante: {
            id: participante.id,
            nome: participante.nome_ministro_snapshot,
            cargo: participante.cargo_snapshot,
            congregacao: participante.nome_congregacao_snapshot,
            status_presenca: 'presente',
          },
          checkin: existingCheckin || null,
        },
        { status: 200 }
      );
    }

    // ─── 8. Inserir Registro de Check-in no Banco (Protegido por UNIQUE) ───────
    const dataHoraCheckin = new Date().toISOString();

    const { data: newCheckin, error: ckErr } = await ctx.admin
      .from('reunioes_checkins')
      .insert({
        reuniao_id: reuniaoId,
        participante_id: participante.id,
        member_id: participante.member_id,
        ministry_id: ctx.ministryId,
        data_hora_checkin: dataHoraCheckin,
        metodo_leitura: metodoFinal,
        registrado_por: ctx.userId || null,
        dispositivo_info: dispositivo_info ? String(dispositivo_info).slice(0, 255) : null,
      })
      .select()
      .maybeSingle();

    if (ckErr) {
      // Se bateu na constraint UNIQUE por concorrência simultânea
      if (ckErr.code === '23505') {
        return NextResponse.json(
          {
            success: true,
            ja_presente: true,
            message: `Check-in já realizado simultaneamente para ${participante.nome_ministro_snapshot}.`,
            participante: {
              id: participante.id,
              nome: participante.nome_ministro_snapshot,
              cargo: participante.cargo_snapshot,
              congregacao: participante.nome_congregacao_snapshot,
              status_presenca: 'presente',
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: 'Erro ao gravar check-in.', detail: ckErr.message },
        { status: 500 }
      );
    }

    // ─── 9. Atualizar Status do Participante no Snapshot ──────────────────────
    await ctx.admin
      .from('reunioes_participantes')
      .update({ status_presenca: 'presente' })
      .eq('id', participante.id);

    // ─── 10. Atualizar Contadores de Presença na Reunião ───────────────────────
    const { count: countPresentes } = await ctx.admin
      .from('reunioes_participantes')
      .select('*', { count: 'exact', head: true })
      .eq('reuniao_id', reuniaoId)
      .eq('status_presenca', 'presente');

    await ctx.admin
      .from('reunioes')
      .update({
        total_presentes: countPresentes || (reuniao.total_presentes + 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reuniaoId);

    // ─── 11. Registrar Trilha de Auditoria ─────────────────────────────────────
    await ctx.admin.from('reunioes_auditoria').insert({
      ministry_id: ctx.ministryId,
      reuniao_id: reuniaoId,
      usuario_id: ctx.userId || null,
      acao: metodoFinal === 'qrcode_carteirinha' ? 'CHECKIN_QRCODE' : 'CHECKIN_MANUAL',
      tabela_afetada: 'reunioes_checkins',
      registro_id: newCheckin?.id || participante.id,
      estado_novo: {
        ministro: participante.nome_ministro_snapshot,
        member_id: participante.member_id,
        data_hora: dataHoraCheckin,
        metodo: metodoFinal,
      },
    });

    return NextResponse.json(
      {
        success: true,
        ja_presente: false,
        message: `Presença confirmada: ${participante.nome_ministro_snapshot}`,
        participante: {
          id: participante.id,
          nome: participante.nome_ministro_snapshot,
          cargo: participante.cargo_snapshot,
          congregacao: participante.nome_congregacao_snapshot,
          area: participante.area_snapshot,
          carteirinha_numero: participante.carteirinha_numero_snapshot,
          status_presenca: 'presente',
        },
        checkin: {
          id: newCheckin?.id,
          data_hora: dataHoraCheckin,
          metodo_leitura: metodoFinal,
        },
        total_presentes: countPresentes || (reuniao.total_presentes + 1),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao processar check-in.', detail: err?.message },
      { status: 500 }
    );
  }
}
