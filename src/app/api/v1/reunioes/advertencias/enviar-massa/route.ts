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

interface ItemResultadoEnvio {
  falta_id: string;
  advertencia_id?: string;
  ministro: string;
  email: string | null;
  protocolo?: string;
  status: 'enviada' | 'reenviada' | 'sem_email' | 'erro' | 'ignorada';
  mensagem?: string;
}

/**
 * POST /api/v1/reunioes/advertencias/enviar-massa
 * Dispara cartas de advertência em lote para faltas não justificadas de reuniões encerradas.
 * Processa individualmente cada registro para garantir que a falha de um não interrompa os demais.
 */
export async function POST(request: NextRequest) {
  try {
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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body vazio
    }

    const {
      falta_ids,
      reuniao_id,
      incluir_reenvios = false,
    } = body || {};

    // 1. Buscar faltas elegíveis no tenant:
    // Deve ser situacao = 'registrada', no mesmo ministry_id, e a reunião deve estar 'encerrada'
    let query = ctx.admin
      .from('reunioes_faltas')
      .select(`
        id,
        reuniao_id,
        participante_id,
        member_id,
        ministry_id,
        situacao,
        reunioes!inner (
          id,
          titulo,
          data_reuniao,
          horario_inicio,
          local,
          status
        ),
        members (
          id,
          name,
          email,
          matricula,
          cargo_ministerial,
          congregacoes ( id, nome )
        ),
        reunioes_participantes (
          id,
          nome_ministro_snapshot,
          cargo_snapshot,
          nome_congregacao_snapshot,
          area_snapshot
        ),
        reunioes_advertencias (
          id,
          numero_protocolo,
          status_envio,
          email_destinatario,
          enviada_em,
          created_at
        )
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('situacao', 'registrada')
      .eq('reunioes.status', 'encerrada');

    if (Array.isArray(falta_ids) && falta_ids.length > 0) {
      query = query.in('id', falta_ids);
    } else if (reuniao_id) {
      query = query.eq('reuniao_id', reuniao_id);
    }

    const { data: faltas, error: fErr } = await query;

    if (fErr) {
      return NextResponse.json(
        { error: 'Erro ao buscar faltas elegíveis para envio em massa.', detail: fErr.message },
        { status: 500 }
      );
    }

    if (!faltas || faltas.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Nenhuma falta não justificada elegível para envio.',
        resumo: {
          total_processados: 0,
          enviadas: 0,
          reenviadas: 0,
          sem_email: 0,
          falhas: 0,
          ignoradas: 0,
        },
        detalhes: [],
      });
    }

    // 2. Buscar configurações do ministério e dados institucionais
    const [configRes, ministryRes] = await Promise.all([
      ctx.admin
        .from('configurations')
        .select('reunioes_advertencia, church_profile')
        .eq('ministry_id', ctx.ministryId)
        .maybeSingle(),
      ctx.admin
        .from('ministries')
        .select('id, name, cnpj_cpf, address_city, address_state, responsible_name, logo_url')
        .eq('id', ctx.ministryId)
        .maybeSingle(),
    ]);

    const configAdvertencia =
      configRes.data?.reunioes_advertencia ||
      (configRes.data?.church_profile as any)?.reunioes_advertencia ||
      null;

    const ministry = ministryRes.data;
    const cidadeUf = [ministry?.address_city, ministry?.address_state].filter(Boolean).join(' - ');

    let totalEnviadas = 0;
    let totalReenviadas = 0;
    let totalSemEmail = 0;
    let totalFalhas = 0;
    let totalIgnoradas = 0;
    const detalhes: ItemResultadoEnvio[] = [];

    // 3. Processamento Individual e Seguro de cada falta
    for (const falta of faltas) {
      const partSnapshot = (falta as any).reunioes_participantes;
      const reuniao = (falta as any).reunioes;
      const member = (falta as any).members;

      const nomeMinistro = partSnapshot?.nome_ministro_snapshot || member?.name || 'Ministro';
      const cargoMinistro = partSnapshot?.cargo_snapshot || member?.cargo_ministerial || 'Ministro';
      const nomeCongregacao = partSnapshot?.nome_congregacao_snapshot || member?.congregacoes?.nome || 'Sede';
      const matricula = member?.matricula || null;
      const setorArea = partSnapshot?.area_snapshot || null;

      // Obter ou criar o registro de advertência vinculado à falta
      let advertencia = Array.isArray(falta.reunioes_advertencias) && falta.reunioes_advertencias.length > 0
        ? falta.reunioes_advertencias[0]
        : null;

      if (!advertencia) {
        // Se ainda não existia registro em reunioes_advertencias, cria com protocolo oficial
        const ano = new Date().getFullYear();
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const protocolo = `ADV-${ano}/${String(falta.id).slice(0, 4).toUpperCase()}-${rand}`;

        const { data: novaAdv, error: advCreateErr } = await ctx.admin
          .from('reunioes_advertencias')
          .insert({
            falta_id: falta.id,
            reuniao_id: falta.reuniao_id,
            member_id: falta.member_id,
            ministry_id: ctx.ministryId,
            numero_protocolo: protocolo,
            status_envio: 'gerada',
          })
          .select()
          .single();

        if (advCreateErr || !novaAdv) {
          totalFalhas++;
          detalhes.push({
            falta_id: falta.id,
            ministro: nomeMinistro,
            email: null,
            status: 'erro',
            mensagem: `Erro ao criar protocolo da advertência: ${advCreateErr?.message || 'Falha ao inserir'}`,
          });
          continue;
        }

        advertencia = novaAdv;
      }

      const advItem = advertencia!;
      const emailDestino = (advItem.email_destinatario || member?.email || '').trim();

      // Checar se já havia sido enviada anteriormente
      const jaEnviada = advItem.status_envio === 'enviada';

      if (jaEnviada && !incluir_reenvios) {
        totalIgnoradas++;
        detalhes.push({
          falta_id: falta.id,
          advertencia_id: advItem.id,
          ministro: nomeMinistro,
          email: emailDestino,
          protocolo: advItem.numero_protocolo,
          status: 'ignorada',
          mensagem: 'Já enviada anteriormente (não inclusa em reenvios).',
        });
        continue;
      }

      // Validar endereço de e-mail do ministro
      if (!validarEmailDestinatario(emailDestino)) {
        totalSemEmail++;
        await ctx.admin
          .from('reunioes_advertencias')
          .update({
            status_envio: 'erro_envio',
            erro_mensagem: `E-mail inválido ou não cadastrado: "${emailDestino}"`,
            email_destinatario: emailDestino || null,
          })
          .eq('id', advItem.id);

        detalhes.push({
          falta_id: falta.id,
          advertencia_id: advItem.id,
          ministro: nomeMinistro,
          email: emailDestino || null,
          protocolo: advItem.numero_protocolo,
          status: 'sem_email',
          mensagem: 'Ministro sem e-mail válido cadastrado.',
        });
        continue;
      }

      // Montar dados da reunião formatados
      const dataFormatada = reuniao?.data_reuniao
        ? new Date(reuniao.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR')
        : '—';

      // Executar o envio por e-mail com PDF gerado dinamicamente
      const resultadoEnvio = await enviarEmailCartaAdvertencia({
        advertenciaId: advItem.id,
        protocolo: advItem.numero_protocolo,
        emailDestinatario: emailDestino,
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
        dataEmissao: new Date(advItem.created_at || Date.now()).toLocaleString('pt-BR'),
        ministryId: ctx.ministryId,
        supabaseAdmin: ctx.admin,
        configTextos: configAdvertencia || undefined,
      });

      const agoraIso = new Date().toISOString();

      if (!resultadoEnvio.sucesso) {
        totalFalhas++;
        await ctx.admin
          .from('reunioes_advertencias')
          .update({
            status_envio: 'erro_envio',
            erro_mensagem: resultadoEnvio.erro || 'Falha ao despachar e-mail.',
            email_destinatario: emailDestino,
          })
          .eq('id', advItem.id);

        detalhes.push({
          falta_id: falta.id,
          advertencia_id: advItem.id,
          ministro: nomeMinistro,
          email: emailDestino,
          protocolo: advItem.numero_protocolo,
          status: 'erro',
          mensagem: resultadoEnvio.erro || 'Falha no provedor de e-mail.',
        });
      } else {
        if (jaEnviada) {
          totalReenviadas++;
        } else {
          totalEnviadas++;
        }

        await ctx.admin
          .from('reunioes_advertencias')
          .update({
            status_envio: 'enviada',
            enviada_em: agoraIso,
            email_destinatario: emailDestino,
            erro_mensagem: null,
          })
          .eq('id', advItem.id);

        detalhes.push({
          falta_id: falta.id,
          advertencia_id: advItem.id,
          ministro: nomeMinistro,
          email: emailDestino,
          protocolo: advItem.numero_protocolo,
          status: jaEnviada ? 'reenviada' : 'enviada',
          mensagem: 'Carta enviada com sucesso.',
        });

        // Registrar trilha de auditoria
        try {
          await ctx.admin.from('reunioes_auditoria').insert({
            reuniao_id: falta.reuniao_id,
            ministry_id: ctx.ministryId,
            usuario_id: ctx.userId,
            acao: jaEnviada ? 'REENVIAR_ADVERTENCIA_MASSA' : 'ENVIAR_ADVERTENCIA_MASSA',
            detalhes: {
              advertencia_id: advItem.id,
              protocolo: advItem.numero_protocolo,
              destinatario: emailDestino,
              ministro: nomeMinistro,
              lote: true,
              resend_message_id: resultadoEnvio.mensagemId || null,
            },
          });
        } catch (auditErr) {
          console.warn('⚠️ Falha ao registrar log de auditoria do lote:', auditErr);
        }
      }
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: `Processamento do lote concluído: ${totalEnviadas} enviada(s), ${totalReenviadas} reenviada(s), ${totalSemEmail} sem e-mail e ${totalFalhas} falha(s).`,
      resumo: {
        total_processados: faltas.length,
        enviadas: totalEnviadas,
        reenviadas: totalReenviadas,
        sem_email: totalSemEmail,
        falhas: totalFalhas,
        ignoradas: totalIgnoradas,
      },
      detalhes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno no processamento de envio em massa de advertências.', detail: err?.message },
      { status: 500 }
    );
  }
}
