import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { gerarCartaAdvertenciaPDF } from '@/lib/reunioes-advertencia-pdf';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * GET /api/v1/reunioes/advertencias/[id]/pdf
 * Gera e retorna o arquivo PDF da Carta de Advertência para download/visualização no navegador.
 */
export async function GET(
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

    // 1. Buscar a advertência no tenant com joins da reunião, membro e ministério
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

    // 2. Extrair dados do snapshot do participante da falta
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

    const nomeMinistro = partSnapshot?.nome_ministro_snapshot || member?.name || 'Ministro';
    const cargoMinistro = partSnapshot?.cargo_snapshot || member?.cargo_ministerial || 'Ministro';
    const nomeCongregacao = partSnapshot?.nome_congregacao_snapshot || member?.congregacoes?.nome || 'Sede';
    const matricula = member?.matricula || null;
    const setorArea = partSnapshot?.area_snapshot || null;

    const cidadeUf = [ministry?.address_city, ministry?.address_state].filter(Boolean).join(' - ');

    const dataFormatada = reuniao?.data_reuniao
      ? new Date(reuniao.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR')
      : '—';

    const filename = `Carta_Advertencia_${advertencia.numero_protocolo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;

    // 3. Buscar configuração de textos da advertência do ministério
    const { data: configRow } = await ctx.admin
      .from('configurations')
      .select('reunioes_advertencia, church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const configAdvertencia = configRow?.reunioes_advertencia || (configRow?.church_profile as any)?.reunioes_advertencia || null;

    // 4. Gerar PDF oficial dinâmico via jsPDF Server-side preenchido com dados reais
    const pdfBuffer = await gerarCartaAdvertenciaPDF({
      protocolo: advertencia.numero_protocolo,
      nomeMinisterio: ministry?.name || 'GESTÃO EKLÉSIA',
      cnpjMinisterio: ministry?.cnpj_cpf || null,
      cidadeUf: cidadeUf || null,
      logoMinisterioUrl: ministry?.logo_url || null,
      nomeMinistro,
      matriculaMinistro: matricula,
      cargoMinistro,
      nomeCongregacao,
      setorArea,
      tituloReuniao: reuniao?.titulo || 'Reunião Ministerial',
      dataReuniao: dataFormatada,
      horarioInicio: reuniao?.horario_inicio ? reuniao.horario_inicio.slice(0, 5) : '08:00',
      localReuniao: reuniao?.local || 'Templo Sede',
      dataEmissao: new Date(advertencia.created_at).toLocaleString('pt-BR'),
      nomePresidente: ministry?.responsible_name || null,
      configTextos: configAdvertencia || undefined,
    });

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao gerar PDF da advertência.', detail: err?.message },
      { status: 500 }
    );
  }
}
