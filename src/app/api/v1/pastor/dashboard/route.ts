/**
 * GET /api/v1/pastor/dashboard
 *
 * Dashboard consolidado do App do Pastor.
 * Retorna: pendências, membros ativos, saldo do mês, almas alcançadas e dados do ministério.
 *
 * SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT (Supabase Auth).
 * - Apenas roles 'presidencia' e 'administrador' com has_modulo_presidencial.
 * - Todos os dados isolados estritamente por ministry_id do token.
 * - Service role key usada apenas para busca administrativa (nunca exposta ao cliente).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server';
import { PresidenciaService } from '@/services/presidencia-service';
import { resolvePlanFeatures } from '@/lib/feature-flags';
import { resolveNivel, temAcesso } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

async function resolvePastorContext(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('UNAUTHORIZED');

  const userClient = createServerClientFromRequest(request);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const admin = createServerClient();

  // 1. Busca perfil do usuário na tabela ministry_users
  const { data: mu } = await admin
    .from('ministry_users')
    .select('role, ministry_id, permissions')
    .eq('user_id', user.id)
    .maybeSingle();

  let ministryId = mu?.ministry_id as string | undefined;
  let isAuthorized = false;

  if (mu) {
    const nivel = resolveNivel(mu.role, mu.permissions);
    if (nivel === 'presidencia' || nivel === 'administrador' || (nivel && temAcesso(nivel, 'presidencia'))) {
      isAuthorized = true;
    }
  }

  // Fallback: proprietário direto na tabela ministries
  if (!isAuthorized) {
    const { data: ownedMinistry } = await admin
      .from('ministries')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (ownedMinistry) {
      ministryId = ownedMinistry.id;
      isAuthorized = true;
    }
  }

  if (!isAuthorized || !ministryId) {
    throw new Error('FORBIDDEN');
  }

  // 2. Verifica plano — Feature Flag presidency_module (compatível com subscription_plans)
  const { data: ministry } = await admin
    .from('ministries')
    .select('plan, subscription_plans(*)')
    .eq('id', ministryId)
    .maybeSingle();

  const dbPlan = (ministry as any)?.subscription_plans;
  const mergedPlan = dbPlan
    ? { ...dbPlan, plan: (ministry as any)?.plan }
    : { slug: (ministry as any)?.plan, plan: (ministry as any)?.plan };

  const flags = resolvePlanFeatures(mergedPlan);
  if (!flags.presidency_module) throw new Error('PLAN_REQUIRED');

  return { userId: user.id, ministryId, admin };
}

export async function GET(request: NextRequest) {
  try {
    const { ministryId, admin } = await resolvePastorContext(request);

    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    // 1. Pendências da Presidência (Central de Decisões)
    let totalPendencias = 0;
    let dirigentesPropostas = 0;
    let cartasPendentes = 0;
    let agendaSolicitacoes = 0;

    try {
      const { resumo } = await PresidenciaService.carregarCentralDecisoes(admin, ministryId);
      totalPendencias = resumo.totalPendencias;
      dirigentesPropostas = resumo.dirigentesPropostas;
      cartasPendentes = (resumo.cartasMudanca || 0) + (resumo.cartasDesligamento || 0) + (resumo.outrasCartas || 0);
      agendaSolicitacoes = resumo.agendaSolicitacoes;
    } catch (err) {
      console.error('[pastor/dashboard] Erro ao carregar Central de Decisões:', err);
    }

    // 2. Membros ativos do ministério
    let membrosAtivos = 0;
    try {
      const { count } = await admin
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('ministry_id', ministryId)
        .eq('status', 'active');
      membrosAtivos = count ?? 0;
    } catch (err) {
      console.error('[pastor/dashboard] Erro ao contar membros:', err);
    }

    // 3. Saldo do mês (Tesouraria) — entradas - saídas no mês corrente
    let saldoMes = 0;
    let entradaMes = 0;
    let saidaMes = 0;

    try {
      const dataInicio = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
      const ultimoDia = new Date(anoAtual, mesAtual, 0).getDate();
      const dataFim = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${ultimoDia}`;

      const [resEntradas, resSaidas] = await Promise.all([
        admin
          .from('tesouraria_lancamentos')
          .select('valor')
          .eq('ministry_id', ministryId)
          .eq('tipo_movimento', 'entrada')
          .gte('data_lancamento', dataInicio)
          .lte('data_lancamento', dataFim),
        admin
          .from('tesouraria_lancamentos')
          .select('valor')
          .eq('ministry_id', ministryId)
          .eq('tipo_movimento', 'saida')
          .gte('data_lancamento', dataInicio)
          .lte('data_lancamento', dataFim),
      ]);

      entradaMes = (resEntradas.data || []).reduce((acc: number, l: any) => acc + Number(l.valor || 0), 0);
      saidaMes = (resSaidas.data || []).reduce((acc: number, l: any) => acc + Number(l.valor || 0), 0);
      saldoMes = entradaMes - saidaMes;
    } catch (err) {
      console.error('[pastor/dashboard] Erro ao calcular saldo:', err);
    }

    // 4. Indicadores espirituais consolidados do Acolhimento
    let indicadoresEspirituais = null;
    try {
      indicadoresEspirituais = await PresidenciaService.obterIndicadoresEspirituaisConsolidados(
        admin,
        ministryId,
        mesAtual,
        anoAtual
      );
    } catch (err) {
      console.error('[pastor/dashboard] Erro ao carregar indicadores espirituais:', err);
    }

    // 5. Dados do ministério (nome, cidade)
    let ministerio = { nome: '', cidade: '' };
    try {
      const { data: min } = await admin
        .from('ministries')
        .select('name, city')
        .eq('id', ministryId)
        .maybeSingle();
      ministerio = {
        nome: min?.name || '',
        cidade: min?.city || '',
      };
    } catch (err) {
      console.error('[pastor/dashboard] Erro ao carregar dados do ministério:', err);
    }

    const mesNomes = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];

    return NextResponse.json({
      ok: true,
      periodo: {
        mes: mesAtual,
        ano: anoAtual,
        label: `${mesNomes[mesAtual - 1]}/${anoAtual}`,
      },
      pendencias: {
        total: totalPendencias,
        dirigentes: dirigentesPropostas,
        cartas: cartasPendentes,
        agenda: agendaSolicitacoes,
      },
      membrosAtivos,
      financeiro: {
        saldoMes,
        entradaMes,
        saidaMes,
      },
      indicadoresEspirituais,
      ministerio,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? '');

    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
    }
    if (msg === 'FORBIDDEN') {
      return NextResponse.json(
        { error: 'Acesso restrito à Presidência e Administradores.' },
        { status: 403 }
      );
    }
    if (msg === 'PLAN_REQUIRED') {
      return NextResponse.json(
        { error: 'Este recurso requer o Módulo Presidencial.', code: 'PLAN_REQUIRED' },
        { status: 403 }
      );
    }

    console.error('[pastor/dashboard] Erro interno:', err);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
