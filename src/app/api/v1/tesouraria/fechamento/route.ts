import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { calculatePeriodBalanceFromSupabase, roundCurrency } from '@/lib/financial-balance-service';

export const dynamic = 'force-dynamic';

function sanitizeUuid(val: any): string | null {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  return val.trim();
}

/**
 * GET /api/v1/tesouraria/fechamento
 * Consulta fechamentos ou calcula saldo canônico apurado para um período/congregação.
 * Query params:
 * - mes: 'YYYY-MM' (opcional)
 * - data_inicio: 'YYYY-MM-DD' (opcional)
 * - data_fim: 'YYYY-MM-DD' (opcional)
 * - congregacao_id: UUID (opcional)
 * - action: 'calcular_saldo' | 'historico' (default)
 */
export async function GET(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId, nivel } = ctx;

  if (!temAcesso(nivel, 'tesouraria') && !temAcesso(nivel, 'financeiro') && !temAcesso(nivel, 'presidencia')) {
    return NextResponse.json({ error: 'Acesso negado à Tesouraria.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'historico';
  const mes = searchParams.get('mes');
  const congregacaoId = sanitizeUuid(searchParams.get('congregacao_id'));
  const dataInicio = searchParams.get('data_inicio');
  const dataFim = searchParams.get('data_fim');

  if (action === 'calcular_saldo') {
    let dtIni = dataInicio;
    let dtFim = dataFim;

    if (!dtIni || !dtFim) {
      if (mes) {
        const [ano, m] = mes.split('-');
        dtIni = `${ano}-${m}-01`;
        const ultDia = new Date(Number(ano), Number(m), 0).getDate();
        dtFim = `${ano}-${m}-${String(ultDia).padStart(2, '0')}`;
      } else {
        return NextResponse.json({ error: 'Informe mes ou data_inicio e data_fim.' }, { status: 400 });
      }
    }

    try {
      const balance = await calculatePeriodBalanceFromSupabase(admin, {
        ministryId,
        dataInicio: dtIni,
        dataFim: dtFim,
        mesReferencia: mes || dtFim.substring(0, 7),
        congregacaoId,
      });

      return NextResponse.json({ ok: true, data: balance }, { status: 200 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Erro ao calcular saldo.' }, { status: 500 });
    }
  }

  // Ação padrão: listar histórico de fechamentos
  let query = admin
    .from('tesouraria_fechamentos')
    .select('*')
    .eq('ministry_id', ministryId)
    .order('mes_referencia', { ascending: false })
    .order('created_at', { ascending: false });

  if (mes) {
    query = query.eq('mes_referencia', mes);
  }
  if (congregacaoId) {
    query = query.eq('congregacao_id', congregacaoId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data }, { status: 200 });
}

/**
 * POST /api/v1/tesouraria/fechamento
 * Registra formalmente o fechamento de caixa de um período e congregação.
 */
export async function POST(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId, userId, nivel } = ctx;

  if (!temAcesso(nivel, 'tesouraria') && !temAcesso(nivel, 'financeiro')) {
    return NextResponse.json({ error: 'Acesso negado para fechar caixa.' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const mesReferencia = body.mes_referencia?.trim();
  const congregacaoId = sanitizeUuid(body.congregacao_id);
  const dataInicio = body.data_inicio?.trim() || (mesReferencia ? `${mesReferencia}-01` : null);
  const dataFim = body.data_fim?.trim() || null;
  const observacoes = body.observacoes?.trim() || null;

  if (!mesReferencia && !dataFim) {
    return NextResponse.json({ error: 'Mês de referência ou data final são obrigatórios.' }, { status: 400 });
  }

  const resolvedMesRef = mesReferencia || dataFim.substring(0, 7);

  // Verificar se já existe fechamento fechado para esse mesmo período e escopo
  let checkQ = admin
    .from('tesouraria_fechamentos')
    .select('id, status')
    .eq('ministry_id', ministryId)
    .eq('mes_referencia', resolvedMesRef);

  if (congregacaoId) {
    checkQ = checkQ.eq('congregacao_id', congregacaoId);
  } else {
    checkQ = checkQ.is('congregacao_id', null);
  }

  const { data: existing } = await checkQ;
  const jaFechado = existing?.find(e => e.status === 'fechado');
  if (jaFechado) {
    return NextResponse.json(
      { error: 'Já existe um fechamento homologado para este período e congregação.' },
      { status: 409 }
    );
  }

  // Se datas não forem completas, calcular limites do mês
  let dtIni = dataInicio;
  let dtFim = dataFim;
  if (!dtIni || !dtFim) {
    const [ano, m] = resolvedMesRef.split('-');
    dtIni = `${ano}-${m}-01`;
    const ultDia = new Date(Number(ano), Number(m), 0).getDate();
    dtFim = `${ano}-${m}-${String(ultDia).padStart(2, '0')}`;
  }

  // Calcular valores canônicos oficiais diretamente do banco para evitar adulteração client-side
  const balance = await calculatePeriodBalanceFromSupabase(admin, {
    ministryId,
    dataInicio: dtIni,
    dataFim: dtFim,
    mesReferencia: resolvedMesRef,
    congregacaoId,
  });

  // Permitir que o usuário informe um saldo_inicial manual se especificado explicitamente,
  // mas se omitido ou 0 com saldo calculado disponível, usar o canônico.
  const userSaldoInicial = body.saldo_inicial !== undefined && body.saldo_inicial !== null
    ? roundCurrency(Number(body.saldo_inicial))
    : balance.saldoInicial;

  const entradas = balance.entradas;
  const saidas = balance.saidas;
  const saldoFinal = roundCurrency(userSaldoInicial + entradas - saidas);

  const insertPayload = {
    ministry_id: ministryId,
    mes_referencia: resolvedMesRef,
    congregacao_id: congregacaoId,
    data_inicio: dtIni,
    data_fim: dtFim,
    saldo_inicial: userSaldoInicial,
    total_entradas: entradas,
    total_saidas: saidas,
    saldo_final: saldoFinal,
    status: 'fechado',
    status_conselho_fiscal: 'pendente',
    observacoes,
    fechado_por: userId,
    fechado_em: new Date().toISOString(),
  };

  const { data: inserted, error: insertErr } = await admin
    .from('tesouraria_fechamentos')
    .insert(insertPayload)
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: inserted }, { status: 201 });
}
