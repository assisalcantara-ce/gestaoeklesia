import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

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

  const { admin, ministryId, nivel, userId, congregacaoId: tokenCongId } = ctx;

  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Acesso negado ao módulo de Discipulado.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get('q') || '').trim();

    // Validação de entrada: requer ao menos 3 caracteres no nome
    if (q.length < 3) {
      return NextResponse.json({
        membros: [],
        aviso: 'Informe ao menos 3 letras do nome para buscar membros elegíveis para a equipe.',
      });
    }

    // Resolver escopo territorial do operador (ministry_users)
    const { data: muScope } = await admin
      .from('ministry_users')
      .select('role, permissions, congregacao_id')
      .eq('user_id', userId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    const permsSet = new Set(
      (Array.isArray(muScope?.permissions) ? muScope.permissions : []).map((p: any) => String(p).toUpperCase())
    );
    const isAdminLocal = permsSet.has('ADMIN_LOCAL') || permsSet.has('SECRETARIA_LOCAL') || nivel === 'admin_local' || nivel === 'secretaria_local';
    const isOperadorLocal = nivel === 'operador' || nivel === 'coordenador';
    const scopeCongId = (isAdminLocal || isOperadorLocal) ? (muScope?.congregacao_id ?? tokenCongId ?? null) : null;

    // Buscar em public.members excluindo tipo_cadastro = 'congregado'
    // Membros elegíveis devem ter tipo_cadastro oficial (ex: 'membro', 'obreiro', etc.) e status ativo
    let query = admin
      .from('members')
      .select(`
        id, name, cpf, phone, celular, whatsapp, cargo_ministerial, tipo_cadastro, status,
        congregacao_id,
        congregacao:congregacoes ( id, nome )
      `)
      .eq('ministry_id', ministryId)
      .neq('tipo_cadastro', 'congregado')
      .ilike('name', `%${q}%`)
      .order('name', { ascending: true })
      .limit(20);

    if (scopeCongId) {
      query = query.eq('congregacao_id', scopeCongId);
    }

    const { data: members, error: errMembers } = await query;
    if (errMembers) {
      throw errMembers;
    }

    const membros = (members || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      cpf: m.cpf,
      phone: m.phone || m.celular || m.whatsapp || null,
      cargo_ministerial: m.cargo_ministerial || 'Membro',
      tipo_cadastro: m.tipo_cadastro,
      status: m.status,
      congregacao_id: m.congregacao_id,
      congregacao_nome: m.congregacao?.nome || 'Sede Geral',
    }));

    return NextResponse.json({ membros });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/equipe/membros-elegiveis]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar membros elegíveis para a equipe.' },
      { status: 500 }
    );
  }
}
