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
    const tel = (searchParams.get('tel') || '').trim().replace(/\D/g, '');

    // Validação de entrada: requer ao menos 3 caracteres no nome ou 4 dígitos no telefone
    if (q.length < 3 && tel.length < 4) {
      return NextResponse.json({
        congregados: [],
        aviso: 'Informe ao menos 3 letras do nome ou 4 dígitos do telefone para buscar congregados.',
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

    // Montar query exclusiva em public.members filtrando por tipo_cadastro = 'congregado'
    let query = admin
      .from('members')
      .select(`
        id, name, cpf, phone, celular, whatsapp, tipo_cadastro, status,
        bairro, cidade, logradouro, numero, data_nascimento, sexo,
        congregacao_id,
        congregacao:congregacoes ( id, nome )
      `)
      .eq('ministry_id', ministryId)
      .eq('tipo_cadastro', 'congregado')
      .order('name', { ascending: true })
      .limit(20);

    if (scopeCongId) {
      query = query.eq('congregacao_id', scopeCongId);
    }

    // Busca textual por nome ou dígitos de telefone
    if (q.length >= 3 && tel.length >= 4) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${tel}%,celular.ilike.%${tel}%,whatsapp.ilike.%${tel}%`);
    } else if (q.length >= 3) {
      query = query.ilike('name', `%${q}%`);
    } else if (tel.length >= 4) {
      query = query.or(`phone.ilike.%${tel}%,celular.ilike.%${tel}%,whatsapp.ilike.%${tel}%`);
    }

    const { data: members, error: errMembers } = await query;
    if (errMembers) {
      throw errMembers;
    }

    const congregados = (members || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      cpf: m.cpf,
      phone: m.phone || m.celular || m.whatsapp || null,
      tipo_cadastro: m.tipo_cadastro,
      status: m.status,
      bairro: m.bairro,
      cidade: m.cidade,
      logradouro: m.logradouro,
      numero: m.numero,
      data_nascimento: m.data_nascimento,
      sexo: m.sexo,
      congregacao_id: m.congregacao_id,
      congregacao_nome: m.congregacao?.nome || 'Sede Geral',
    }));

    return NextResponse.json({ congregados });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/congregados]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar congregados.' },
      { status: 500 }
    );
  }
}
