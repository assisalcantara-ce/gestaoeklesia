import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { enviarEmailCartaAdvertencia, validarEmailDestinatario } from '@/lib/reunioes-email-service';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * POST /api/v1/reunioes/advertencias/[id]/enviar
 * Dispara ou reenvia a Carta de Advertência Ministerial por e-mail com PDF anexo.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: advertenciaId } = await props.params;
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

    if (!advertenciaId || typeof advertenciaId !== 'string') {
      return NextResponse.json({ error: 'ID da advertência é obrigatório.' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body vazio é aceitável
    }

    const forcarReenvio = Boolean(body.forcar_reenvio);

    // 1. Buscar a advertência no tenant
    const { data: advertencia, error: advErr } = await ctx.admin
      .from('reunioes_advertencias')
      .select(`
        id,
        falta_id,
        reuniao_id,
        member_id,
        ministry_id,
        numero_protocolo,
        status_envio,
        email_destinatario,
        enviada_em,
        created_at,
        reunioes (
          id,
          titulo,
          data_reuniao,
          horario_inicio,
          local
        ),
        members (
          id,
          name,
          email,
          matricula,
          cargo_ministerial,
          congregacoes ( id, nome )
        ),
        ministries (
          id,
          name,
          cnpj_cpf,
          address_city,
          address_state,
          responsible_name,
          logo_url
        )
      `)
      .eq('id', advertenciaId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (advErr || !advertencia) {
      return NextResponse.json(
        { error: 'Carta de advertência não encontrada neste ministério.' },
        { status: 404 }
      );
    }

    // 2. Verificar idempotência: se já enviada e não foi solicitado reenvio forçado
    if (advertencia.status_envio === 'enviada' && !forcarReenvio) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'E-mail da advertência já havia sido enviado anteriormente.',
        ja_enviada: true,
        enviada_em: advertencia.enviada_em,
        protocolo: advertencia.numero_protocolo,
      });
    }

    // 3. Extrair dados da reunião, membro e participante snapshot
    const { data: faltaRow } = await ctx.admin
      .from('reunioes_faltas')
      .select(`
        id,
        reunioes_participantes (
          nome_ministro_snapshot,
          cargo_snapshot,
          nome_congregacao_snapshot,
          area_snapshot
        )
      `)
      .eq('id', advertencia.falta_id)
      .maybeSingle();

    const partSnapshot = (faltaRow as any)?.reunioes_participantes;
    const reuniao = (advertencia as any)?.reunioes;
    const ministry = (advertencia as any)?.ministries;
    const member = (advertencia as any)?.members;

    const emailDestinatario = (advertencia.email_destinatario || member?.email || body.email_destinatario || '').trim();

    if (!validarEmailDestinatario(emailDestinatario)) {
      // Registrar falha de e-mail inválido/ausente
      await ctx.admin
        .from('reunioes_advertencias')
        .update({
          status_envio: 'erro_envio',
          erro_mensagem: `Endereço de e-mail inválido ou não informado: "${emailDestinatario}"`,
          email_destinatario: emailDestinatario || null,
        })
        .eq('id', advertencia.id);

      return NextResponse.json(
        {
          sucesso: false,
          error: 'Endereço de e-mail do ministro destinatário é inválido ou não foi informado.',
          email: emailDestinatario,
        },
        { status: 422 }
      );
    }

    const nomeMinistro = partSnapshot?.nome_ministro_snapshot || member?.name || 'Ministro';
    const cargoMinistro = partSnapshot?.cargo_snapshot || member?.cargo_ministerial || 'Ministro';
    const nomeCongregacao = partSnapshot?.nome_congregacao_snapshot || member?.congregacoes?.nome || 'Sede';
    const matricula = member?.matricula || null;
    const setorArea = partSnapshot?.area_snapshot || null;

    const cidadeUf = [ministry?.address_city, ministry?.address_state].filter(Boolean).join(' - ');

    const dataFormatada = reuniao?.data_reuniao
      ? new Date(reuniao.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR')
      : '—';

    // 3.5. Buscar configuração de textos da advertência do ministério
    const { data: configRow } = await ctx.admin
      .from('configurations')
      .select('reunioes_advertencia, church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const configAdvertencia = configRow?.reunioes_advertencia || (configRow?.church_profile as any)?.reunioes_advertencia || null;

    // 4. Executar envio pelo serviço de e-mail
    const resultadoEnvio = await enviarEmailCartaAdvertencia({
      advertenciaId: advertencia.id,
      protocolo: advertencia.numero_protocolo,
      emailDestinatario,
      nomeMinistro,
      matriculaMinistro: matricula,
      cargoMinistro,
      nomeCongregacao,
      setorArea,
      tituloReuniao: reuniao?.titulo || 'Reunião Ministerial',
      dataReuniao: dataFormatada,
      horarioInicio: reuniao?.horario_inicio ? reuniao.horario_inicio.slice(0, 5) : '08:00',
      localReuniao: reuniao?.local || 'Templo Sede',
      nomeMinisterio: ministry?.name || 'GESTÃO EKLÉSIA',
      cnpjMinisterio: ministry?.cnpj_cpf || null,
      cidadeUf: cidadeUf || null,
      logoMinisterioUrl: ministry?.logo_url || null,
      nomePresidente: ministry?.responsible_name || null,
      dataEmissao: new Date(advertencia.created_at).toLocaleString('pt-BR'),
      ministryId: ctx.ministryId,
      supabaseAdmin: ctx.admin,
      configTextos: configAdvertencia || undefined,
    });

    const agoraIso = new Date().toISOString();

    if (!resultadoEnvio.sucesso) {
      // Atualizar status de erro na advertência sem quebrar faltas/reunião
      await ctx.admin
        .from('reunioes_advertencias')
        .update({
          status_envio: 'erro_envio',
          erro_mensagem: resultadoEnvio.erro || 'Falha ao despachar e-mail.',
          email_destinatario: emailDestinatario,
        })
        .eq('id', advertencia.id);

      return NextResponse.json(
        {
          sucesso: false,
          error: resultadoEnvio.erro || 'Falha ao despachar e-mail.',
        },
        { status: 502 }
      );
    }

    // 5. Sucesso no envio: atualizar status para 'enviada'
    await ctx.admin
      .from('reunioes_advertencias')
      .update({
        status_envio: 'enviada',
        enviada_em: agoraIso,
        email_destinatario: emailDestinatario,
        erro_mensagem: null,
      })
      .eq('id', advertencia.id);

    // 6. Registrar trilha de auditoria
    try {
      await ctx.admin.from('reunioes_auditoria').insert({
        reuniao_id: advertencia.reuniao_id,
        ministry_id: ctx.ministryId,
        user_id: ctx.userId,
        acao: 'ENVIAR_ADVERTENCIA',
        detalhes: {
          advertencia_id: advertencia.id,
          protocolo: advertencia.numero_protocolo,
          destinatario: emailDestinatario,
          ministro: nomeMinistro,
          forcar_reenvio: forcarReenvio,
          resend_message_id: resultadoEnvio.mensagemId || null,
        },
      });
    } catch (auditErr) {
      console.warn('⚠️ Falha ao registrar log de auditoria do envio:', auditErr);
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Carta de advertência enviada por e-mail com sucesso.',
      protocolo: advertencia.numero_protocolo,
      destinatario: emailDestinatario,
      enviada_em: agoraIso,
      resend_message_id: resultadoEnvio.mensagemId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao processar envio de e-mail da advertência.', detail: err?.message },
      { status: 500 }
    );
  }
}
