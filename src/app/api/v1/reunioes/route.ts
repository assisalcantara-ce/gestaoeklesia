import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import {
  calcularLimiteCheckinTimestamp,
  validarHorariosReuniao,
  ordenarReunioesMinisteriais,
  getLimitesMesCorrente,
} from '@/lib/reunioes-utils';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * GET /api/v1/reunioes
 * Rota estritamente de LEITURA (pure GET, sem mutação, sem inserções em banco).
 * Lista reuniões ministeriais do tenant autenticado com filtros de status e período.
 * Por padrão (quando mes_corrente=true ou quando não especificado período global),
 * retorna estritamente as reuniões do mês corrente.
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const dataInicioParam = searchParams.get('data_inicio');
    const dataFimParam = searchParams.get('data_fim');
    const congregacaoIdParam = searchParams.get('congregacao_id');
    const mesParam = searchParams.get('mes'); // YYYY-MM opcional
    const mesCorrenteParam = searchParams.get('mes_corrente'); // 'true' | 'false'

    // Definir período efetivo: se mesParam fornecido ou mes_corrente !== 'false'
    let dataInicioEfetiva: string | null = dataInicioParam;
    let dataFimEfetiva: string | null = dataFimParam;
    let limitesMes = getLimitesMesCorrente();

    if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
      const [anoStr, mesStr] = mesParam.split('-');
      const anoNum = parseInt(anoStr, 10);
      const mesNum = parseInt(mesStr, 10);
      limitesMes = getLimitesMesCorrente(new Date(anoNum, mesNum - 1, 15));
      dataInicioEfetiva = limitesMes.dataInicioMes;
      dataFimEfetiva = limitesMes.dataFimMes;
    } else if (mesCorrenteParam === 'true' || (!dataInicioParam && !dataFimParam)) {
      dataInicioEfetiva = limitesMes.dataInicioMes;
      dataFimEfetiva = limitesMes.dataFimMes;
    }

    // ─── Consulta Oficial de Reuniões (Exclusivamente Leitura) ──────────────────
    let query = ctx.admin
      .from('reunioes')
      .select(`
        id,
        ministry_id,
        congregacao_id,
        titulo,
        pauta,
        local,
        data_reuniao,
        horario_inicio,
        horario_limite_entrada,
        limite_checkin_em,
        status,
        iniciada_em,
        encerrada_em,
        total_esperados,
        total_presentes,
        total_ausentes,
        total_justificados,
        created_at,
        updated_at,
        congregacoes ( id, nome )
      `)
      .eq('ministry_id', ctx.ministryId);

    if (statusParam && ['agendada', 'em_andamento', 'encerrada', 'cancelada'].includes(statusParam)) {
      query = query.eq('status', statusParam);
    }

    if (dataInicioEfetiva && /^\d{4}-\d{2}-\d{2}$/.test(dataInicioEfetiva)) {
      query = query.gte('data_reuniao', dataInicioEfetiva);
    }

    if (dataFimEfetiva && /^\d{4}-\d{2}-\d{2}$/.test(dataFimEfetiva)) {
      query = query.lte('data_reuniao', dataFimEfetiva);
    }

    if (congregacaoIdParam) {
      query = query.eq('congregacao_id', congregacaoIdParam);
    }

    const { data: reunioes, error } = await query
      .order('data_reuniao', { ascending: false })
      .order('horario_inicio', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao listar reuniões ministeriais.', detail: error.message },
        { status: 500 }
      );
    }

    // Ordenação canônica: reuniões agendadas/em andamento em ordem crescente (mais próxima no topo),
    // seguidas das reuniões encerradas/canceladas
    const reunioesOrdenadas = ordenarReunioesMinisteriais(reunioes || []);

    return NextResponse.json({
      success: true,
      total: reunioesOrdenadas.length,
      mes_referencia: limitesMes.mesAnoStr,
      nome_mes: limitesMes.nomeMesAno,
      reunioes: reunioesOrdenadas,
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
      { error: 'Erro interno ao processar requisição.', detail: err?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reunioes
 * Cadastra uma nova reunião ministerial e congela o snapshot de ministros participantes.
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
    }

    const {
      titulo,
      pauta,
      local,
      congregacao_id,
      data_reuniao,
      horario_inicio,
      horario_limite_entrada,
    } = body || {};

    // ─── 1. Validações de Campos Obrigatórios ──────────────────────────────────
    if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
      return NextResponse.json({ error: 'O título da reunião é obrigatório.' }, { status: 400 });
    }

    if (!local || typeof local !== 'string' || !local.trim()) {
      return NextResponse.json({ error: 'O local da reunião é obrigatório.' }, { status: 400 });
    }

    if (!data_reuniao || typeof data_reuniao !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data_reuniao)) {
      return NextResponse.json(
        { error: 'A data da reunião é obrigatória no formato AAAA-MM-DD.' },
        { status: 400 }
      );
    }

    if (!horario_inicio || typeof horario_inicio !== 'string') {
      return NextResponse.json(
        { error: 'O horário de início é obrigatório.' },
        { status: 400 }
      );
    }

    if (!horario_limite_entrada || typeof horario_limite_entrada !== 'string') {
      return NextResponse.json(
        { error: 'O horário limite de entrada é obrigatório.' },
        { status: 400 }
      );
    }

    if (!validarHorariosReuniao(horario_inicio, horario_limite_entrada)) {
      return NextResponse.json(
        { error: 'O horário limite de entrada não pode ser anterior ao horário de início da reunião.' },
        { status: 400 }
      );
    }

    // ─── 2. Validação da congregação (quando informada) ────────────────────────
    let targetCongregacaoId: string | null = null;
    if (congregacao_id) {
      const { data: cong, error: congErr } = await ctx.admin
        .from('congregacoes')
        .select('id')
        .eq('id', congregacao_id)
        .eq('ministry_id', ctx.ministryId)
        .maybeSingle();

      if (congErr || !cong) {
        return NextResponse.json(
          { error: 'A congregação selecionada não pertence ao ministério autenticado.' },
          { status: 400 }
        );
      }
      targetCongregacaoId = cong.id;
    }

    // ─── 3. Calcular limite_checkin_em (TIMESTAMPTZ Brasil UTC-3) ──────────────
    let limiteCheckinEm: string;
    try {
      limiteCheckinEm = calcularLimiteCheckinTimestamp(data_reuniao, horario_limite_entrada);
    } catch (tzErr: any) {
      return NextResponse.json({ error: tzErr?.message }, { status: 400 });
    }

    // ─── 4. Criar Registro da Reunião ─────────────────────────────────────────
    const { data: novaReuniao, error: rErr } = await ctx.admin
      .from('reunioes')
      .insert({
        ministry_id: ctx.ministryId,
        congregacao_id: targetCongregacaoId,
        titulo: titulo.trim(),
        pauta: pauta ? String(pauta).trim() : null,
        local: local.trim(),
        data_reuniao,
        horario_inicio: horario_inicio.trim(),
        horario_limite_entrada: horario_limite_entrada.trim(),
        limite_checkin_em: limiteCheckinEm,
        status: 'agendada',
        total_esperados: 0,
        total_presentes: 0,
        total_ausentes: 0,
        total_justificados: 0,
      })
      .select()
      .single();

    if (rErr || !novaReuniao) {
      return NextResponse.json(
        { error: 'Erro ao registrar reunião ministerial.', detail: rErr?.message },
        { status: 500 }
      );
    }

    // ─── 5. Consultar Ministros Elegíveis para o Snapshot ─────────────────────
    // Critério Oficial Estrito: tipo_cadastro = 'ministro', status = 'active', pertencentes ao ministry_id
    let membersQuery = ctx.admin
      .from('members')
      .select(`
        id,
        name,
        cargo_ministerial,
        tipo_cadastro,
        status,
        matricula,
        unique_id,
        congregacao_id
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('status', 'active')
      .eq('tipo_cadastro', 'ministro');

    // Se a reunião for convocada para uma congregação específica
    if (targetCongregacaoId) {
      membersQuery = membersQuery.eq('congregacao_id', targetCongregacaoId);
    }

    const { data: rawMembers, error: mErr } = await membersQuery;

    if (mErr) {
      // Reverter criação da reunião em caso de falha crítica na busca de ministros
      await ctx.admin.from('reunioes').delete().eq('id', novaReuniao.id);
      return NextResponse.json(
        { error: 'Erro ao consultar ministros para a reunião.', detail: mErr.message },
        { status: 500 }
      );
    }

    const ministrosElegiveis = rawMembers || [];

    // ─── 6. Inserir Snapshot de Participantes em Lote ─────────────────────────
    let totalEsperados = 0;
    if (ministrosElegiveis.length > 0) {
      const snapshotRows = ministrosElegiveis.map((m: any) => {
        const cong = m.congregacoes;
        const areaNome = cong?.supervisao || cong?.campo || cong?.regiao || cong?.cidade || null;

        return {
          reuniao_id: novaReuniao.id,
          ministry_id: ctx.ministryId,
          member_id: m.id,
          nome_ministro_snapshot: m.name || 'Ministro',
          cargo_snapshot: m.cargo_ministerial || 'Ministro',
          congregacao_id_snapshot: m.congregacao_id || null,
          nome_congregacao_snapshot: cong?.nome || null,
          area_snapshot: areaNome,
          carteirinha_numero_snapshot: m.matricula || null,
          unique_id_snapshot: m.unique_id || m.id,
          status_presenca: 'pendente',
        };
      });

      const { data: insertedParts, error: partErr } = await ctx.admin
        .from('reunioes_participantes')
        .insert(snapshotRows)
        .select('id');

      if (partErr) {
        // Rollback da reunião caso ocorra erro no snapshot
        await ctx.admin.from('reunioes').delete().eq('id', novaReuniao.id);
        return NextResponse.json(
          { error: 'Erro ao gerar snapshot de participantes.', detail: partErr.message },
          { status: 500 }
        );
      }

      totalEsperados = insertedParts?.length || snapshotRows.length;

      // Atualizar total de esperados na reunião
      await ctx.admin
        .from('reunioes')
        .update({ total_esperados: totalEsperados })
        .eq('id', novaReuniao.id);
    }

    // ─── 7. Gravar Trilha de Auditoria ────────────────────────────────────────
    await ctx.admin.from('reunioes_auditoria').insert({
      ministry_id: ctx.ministryId,
      reuniao_id: novaReuniao.id,
      usuario_id: ctx.userId || null,
      acao: 'CRIAR_REUNIAO',
      tabela_afetada: 'reunioes',
      registro_id: novaReuniao.id,
      estado_novo: {
        titulo: novaReuniao.titulo,
        data_reuniao: novaReuniao.data_reuniao,
        total_esperados: totalEsperados,
        status: 'agendada',
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Reunião ministerial cadastrada com sucesso.',
        reuniao: {
          ...novaReuniao,
          total_esperados: totalEsperados,
        },
      },
      { status: 201 }
    );
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
      { error: 'Erro interno ao cadastrar reunião.', detail: err?.message },
      { status: 500 }
    );
  }
}
