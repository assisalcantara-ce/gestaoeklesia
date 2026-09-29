import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { gerarRelatorioReuniaoPDF, ParticipanteRelatorio } from '@/lib/reunioes-relatorio-pdf';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * GET /api/v1/reunioes/[id]/pdf
 * Gera e retorna o arquivo PDF formal A4 da Reunião Ministerial com timbre institucional do tenant.
 */
export async function GET(
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

    // ─── 1. Buscar Dados da Reunião e Ministério ──────────────────────────────
    const { data: reuniao, error: rErr } = await ctx.admin
      .from('reunioes')
      .select(`
        id,
        titulo,
        pauta,
        data_reuniao,
        horario_inicio,
        horario_fim,
        local,
        status,
        total_convocados,
        total_presentes,
        total_ausentes,
        total_justificados,
        congregacao_id,
        congregacoes ( id, nome )
      `)
      .eq('id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json(
        { error: 'Reunião ministerial não encontrada neste ministério.' },
        { status: 404 }
      );
    }

    const { data: ministry } = await ctx.admin
      .from('ministries')
      .select('id, name, cnpj_cpf, address_city, address_state, responsible_name, logo_url')
      .eq('id', ctx.ministryId)
      .maybeSingle();

    const { data: configRow } = await ctx.admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const churchProfile = (configRow as any)?.church_profile || {};

    // ─── 2. Buscar Participantes da Reunião ───────────────────────────────────
    const { data: participantesDb, error: pErr } = await ctx.admin
      .from('reunioes_participantes')
      .select(`
        id,
        member_id,
        nome_ministro_snapshot,
        cargo_snapshot,
        nome_congregacao_snapshot,
        area_snapshot,
        status_presenca,
        data_hora_checkin
      `)
      .eq('reuniao_id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .order('nome_ministro_snapshot', { ascending: true });

    if (pErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar convocados da reunião.', detail: pErr.message },
        { status: 500 }
      );
    }

    // ─── 3. Buscar Justificativas Registradas para a Reunião ──────────────────
    const { data: justificativas } = await ctx.admin
      .from('reunioes_justificativas')
      .select('member_id, tipo_justificativa, motivo')
      .eq('reuniao_id', reuniaoId)
      .eq('ministry_id', ctx.ministryId);

    const justificativasMap = new Map<string, string>();
    if (Array.isArray(justificativas)) {
      for (const j of justificativas) {
        if (j.member_id) {
          const rotulo = j.motivo ? j.motivo : j.tipo_justificativa || 'Justificada';
          justificativasMap.set(j.member_id, rotulo);
        }
      }
    }

    // ─── 4. Filtros da Requisição (Opcionais) ──────────────────────────────────
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca')?.toLowerCase().trim() || '';
    const filtroCong = searchParams.get('congregacao')?.trim() || '';
    const filtroCargo = searchParams.get('cargo')?.trim() || '';
    const filtroPresenca = searchParams.get('presenca')?.trim() || '';

    let listaFiltrada = (participantesDb || []).map((p: any) => ({
      id: p.id,
      memberId: p.member_id,
      nome: p.nome_ministro_snapshot || 'Ministro',
      cargo: p.cargo_snapshot || 'Ministro',
      congregacao: p.nome_congregacao_snapshot || 'Sede',
      setorArea: p.area_snapshot || null,
      statusPresenca: p.status_presenca || 'pendente',
      dataHoraCheckin: p.data_hora_checkin,
      justificativa: p.member_id ? justificativasMap.get(p.member_id) || null : null,
    }));

    const filtrosAplicadosArr: string[] = [];

    if (busca) {
      listaFiltrada = listaFiltrada.filter(
        (p) =>
          p.nome.toLowerCase().includes(busca) ||
          p.cargo.toLowerCase().includes(busca) ||
          p.congregacao.toLowerCase().includes(busca)
      );
      filtrosAplicadosArr.push(`Busca: "${busca}"`);
    }

    if (filtroCong && filtroCong !== 'todas') {
      listaFiltrada = listaFiltrada.filter((p) => p.congregacao === filtroCong);
      filtrosAplicadosArr.push(`Congregação: ${filtroCong}`);
    }

    if (filtroCargo && filtroCargo !== 'todos') {
      listaFiltrada = listaFiltrada.filter((p) => p.cargo === filtroCargo);
      filtrosAplicadosArr.push(`Cargo: ${filtroCargo}`);
    }

    if (filtroPresenca && filtroPresenca !== 'todos') {
      listaFiltrada = listaFiltrada.filter((p) => p.statusPresenca === filtroPresenca);
      filtrosAplicadosArr.push(`Presença: ${filtroPresenca}`);
    }

    // ─── 5. Métricas e Estatísticas Consolidadas ──────────────────────────────
    const todosParticipantes = participantesDb || [];
    const totalConvocados = todosParticipantes.length;
    const totalPresentes = todosParticipantes.filter((p: any) => p.status_presenca === 'presente').length;
    const totalAusentes = todosParticipantes.filter((p: any) => p.status_presenca === 'falta').length;
    const totalJustificados = todosParticipantes.filter((p: any) => p.status_presenca === 'falta_justificada').length;
    
    const indiceNum = totalConvocados > 0 ? ((totalPresentes / totalConvocados) * 100).toFixed(1) : '0.0';
    const indicePresenca = `${indiceNum}%`;

    // ─── 6. Montar Estrutura de Participantes para o PDF ──────────────────────
    const participantesFormatados: ParticipanteRelatorio[] = listaFiltrada.map((p, idx) => {
      let horarioCheckinStr: string | null = null;
      if (p.dataHoraCheckin) {
        try {
          horarioCheckinStr = new Date(p.dataHoraCheckin).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {
          horarioCheckinStr = null;
        }
      }

      return {
        numero: idx + 1,
        nome: p.nome,
        cargo: p.cargo,
        congregacao: p.congregacao,
        setorArea: p.setorArea,
        statusPresenca: p.statusPresenca,
        horarioCheckin: horarioCheckinStr,
        justificativa: p.justificativa,
      };
    });

    // ─── 7. Dados Institucionais do Tenant ────────────────────────────────────
    const nomeMinisterio = ministry?.name || churchProfile?.nome || 'Gestão Eklésia';
    const cnpjMinisterio = ministry?.cnpj_cpf || churchProfile?.cnpj || null;
    
    const cidade = ministry?.address_city || churchProfile?.cidade || '';
    const uf = ministry?.address_state || churchProfile?.uf || '';
    const cidadeUf = [cidade, uf].filter(Boolean).join(' - ') || null;

    const logoUrl = ministry?.logo_url || churchProfile?.logo || null;

    const dataFormatada = reuniao.data_reuniao
      ? new Date(reuniao.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR')
      : '—';

    const dataHoraEmissao = new Date().toLocaleString('pt-BR');

    // ─── 8. Gerar PDF Institucional A4 ─────────────────────────────────────────
    const pdfBytes = await gerarRelatorioReuniaoPDF({
      reuniaoId: reuniao.id,
      tituloReuniao: reuniao.titulo || 'Reunião Ministerial',
      pauta: reuniao.pauta || null,
      dataReuniao: dataFormatada,
      horarioInicio: reuniao.horario_inicio ? reuniao.horario_inicio.slice(0, 5) : '—',
      horarioFim: reuniao.horario_fim ? reuniao.horario_fim.slice(0, 5) : null,
      localReuniao: reuniao.local || 'Templo Sede',
      nomeCongregacao: (reuniao.congregacoes as any)?.nome || 'Geral / Todas',
      statusReuniao: reuniao.status || 'agendada',
      totalConvocados,
      totalPresentes,
      totalAusentes,
      totalJustificados,
      indicePresenca,
      nomeMinisterio,
      cnpjMinisterio,
      cidadeUf,
      logoMinisterioUrl: logoUrl,
      dataEmissao: dataHoraEmissao,
      filtrosAplicados: filtrosAplicadosArr.length > 0 ? filtrosAplicadosArr.join(' • ') : null,
      participantes: participantesFormatados,
    });

    const dataNomeArquivo = reuniao.data_reuniao ? reuniao.data_reuniao.replace(/[^0-9-]/g, '') : 'data';
    const idCurto = reuniao.id.slice(0, 8);
    const filename = `Relatorio_Reuniao_${dataNomeArquivo}_${idCurto}.pdf`;

    return new NextResponse(pdfBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login novamente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (err?.message === 'NO_MINISTRY') {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Erro interno ao gerar relatório PDF da reunião.', detail: err?.message },
      { status: 500 }
    );
  }
}
