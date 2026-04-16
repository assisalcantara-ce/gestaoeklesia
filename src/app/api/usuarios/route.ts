import { NextRequest, NextResponse } from 'next/server';
import { buildPasswordFingerprint } from '@/lib/password-fingerprint';
import { createServerClient } from '@/lib/supabase-server';
import { requireFlowAuth, hasRole } from '@/lib/flows/flow-auth';

type UsuarioResponse = {
  id: string;
  nome: string;
  email: string;
  email_confirmed: boolean;
  nivel: 'administrador' | 'financeiro' | 'supervisor' | 'admin_local' | 'financeiro_local';
  congregacao?: string;
  congregacao_id?: string | null;
  supervisao?: string;
  supervisao_id?: string | null;
  status: 'ativo' | 'inativo';
};

type UsuarioCreateBody = {
  nome: string;
  email: string;
  senha: string;
  nivel: UsuarioResponse['nivel'];
  congregacao_id?: string | null;
  supervisao_id?: string | null;
};


type UsuarioUpdateBody = {
  user_id: string;
  nome: string;
  email: string;
  nivel: UsuarioResponse['nivel'];
  congregacao_id?: string | null;
  supervisao_id?: string | null;
  status?: UsuarioResponse['status'];
  senha?: string | null;
};

function mapNivel(role: string | null | undefined, permissions: any): UsuarioResponse['nivel'] {
  const base = String(role || '').toLowerCase();
  const perms = Array.isArray(permissions) ? permissions : [];
  const permSet = new Set(perms.map((p: any) => String(p || '').toUpperCase()));

  if (permSet.has('ADMINISTRADOR') || ['admin'].includes(base)) return 'administrador';
  if (permSet.has('FINANCEIRO') || ['financeiro', 'financial'].includes(base)) return 'financeiro';
  if (permSet.has('SUPERVISOR') || ['supervisor', 'manager'].includes(base)) return 'supervisor';
  if (permSet.has('ADMIN_LOCAL') || ['admin_local'].includes(base)) return 'admin_local';
  if (permSet.has('FINANCEIRO_LOCAL') || ['financeiro_local'].includes(base)) return 'financeiro_local';
  // legado
  if (['operator', 'operador', 'viewer'].includes(base)) return 'admin_local';

  return 'admin_local';
}

function resolveStatus(user: any): 'ativo' | 'inativo' {
  const bannedUntil = user?.banned_until ? new Date(user.banned_until) : null;
  if (bannedUntil && bannedUntil.getTime() > Date.now()) return 'inativo';
  return 'ativo';
}

function resolveNome(user: any): string {
  const meta = user?.user_metadata || {};
  return String(meta.full_name || meta.name || meta.nome || user?.email || 'Sem nome');
}

function resolveEmailConfirmed(user: any): boolean {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

export async function GET(request: NextRequest) {
  try {
    const { ministryId, roles } = await requireFlowAuth(request);
    if (!hasRole(roles, ['ADMINISTRADOR'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createServerClient();

    const { data: muRows, error: muError } = await admin
      .from('ministry_users')
      .select('user_id, role, permissions, congregacao_id, supervisao_id')
      .eq('ministry_id', ministryId);

    if (muError) {
      return NextResponse.json({ error: muError.message }, { status: 400 });
    }

    const rows = muRows || [];
    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const congregacaoIds = Array.from(
      new Set(rows.map((row: any) => row.congregacao_id).filter(Boolean))
    ).map(String);

    const congregacaoMap = new Map<string, string>();
    if (congregacaoIds.length > 0) {
      const { data: congregacoes, error: congError } = await admin
        .from('congregacoes')
        .select('id, nome')
        .in('id', congregacaoIds);

      if (!congError && congregacoes) {
        congregacoes.forEach((c: any) => {
          congregacaoMap.set(String(c.id), String(c.nome || ''));
        });
      }
    }

    const supervisaoIds = Array.from(
      new Set(rows.map((row: any) => row.supervisao_id).filter(Boolean))
    ).map(String);

    const supervisaoMap = new Map<string, string>();
    if (supervisaoIds.length > 0) {
      const { data: supervisoes, error: supError } = await admin
        .from('supervisoes')
        .select('id, nome')
        .in('id', supervisaoIds);

      if (!supError && supervisoes) {
        supervisoes.forEach((s: any) => {
          supervisaoMap.set(String(s.id), String(s.nome || ''));
        });
      }
    }

    const authResults = await Promise.all(
      rows.map(async (row: any) => {
        const { data, error } = await admin.auth.admin.getUserById(row.user_id);
        return { row, user: data?.user || null, error };
      })
    );

    const usuarios: UsuarioResponse[] = authResults.map(({ row, user }) => {
      const congregacaoId = row.congregacao_id ? String(row.congregacao_id) : '';
      const supervisaoId  = row.supervisao_id  ? String(row.supervisao_id)  : '';
      return {
        id: String(row.user_id),
        nome: resolveNome(user),
        email: String(user?.email || ''),
        email_confirmed: resolveEmailConfirmed(user),
        nivel: mapNivel(row.role, row.permissions),
        congregacao: congregacaoMap.get(congregacaoId) || undefined,
        congregacao_id: row.congregacao_id ?? null,
        supervisao: supervisaoMap.get(supervisaoId) || undefined,
        supervisao_id: row.supervisao_id ?? null,
        status: resolveStatus(user),
      };
    });

    return NextResponse.json({ data: usuarios });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'TRIAL_EXPIRED') {
      return NextResponse.json({ error: 'Expirado' }, { status: 403 });
    }
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function mapRoleAndPermissions(nivel: UsuarioResponse['nivel']) {
  switch (nivel) {
    case 'administrador':
      return { role: 'admin', permissions: ['ADMINISTRADOR'] };
    case 'financeiro':
      return { role: 'manager', permissions: ['FINANCEIRO'] };
    case 'supervisor':
      return { role: 'manager', permissions: ['SUPERVISOR'] };
    case 'admin_local':
      return { role: 'operator', permissions: ['ADMIN_LOCAL'] };
    case 'financeiro_local':
      return { role: 'operator', permissions: ['FINANCEIRO_LOCAL'] };
    default:
      return { role: 'operator', permissions: ['ADMIN_LOCAL'] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ministryId, roles } = await requireFlowAuth(request);
    if (!hasRole(roles, ['ADMINISTRADOR'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<UsuarioCreateBody>;
    const nome = String(body?.nome || '').trim();
    const email = String(body?.email || '').trim();
    const senha = String(body?.senha || '').trim();
    const nivel = body?.nivel as UsuarioResponse['nivel'];
    const congregacaoId = body?.congregacao_id ? String(body.congregacao_id) : null;
    const supervisaoId  = body?.supervisao_id  ? String(body.supervisao_id)  : null;

    if (!nome || !email || !senha || !nivel) {
      return NextResponse.json({ error: 'nome, email, senha e nivel sao obrigatorios' }, { status: 400 });
    }

    if (senha.length < 6) {
      return NextResponse.json({ error: 'Senha muito curta' }, { status: 400 });
    }

    let passwordFingerprint = '';
    try {
      passwordFingerprint = buildPasswordFingerprint(senha);
    } catch {
      return NextResponse.json({ error: 'Configuracao de senha nao definida' }, { status: 500 });
    }

    if (['admin_local', 'financeiro_local'].includes(nivel) && !congregacaoId) {
      return NextResponse.json({ error: 'Congregacao obrigatoria para este nivel' }, { status: 400 });
    }

    if (nivel === 'supervisor' && !supervisaoId) {
      return NextResponse.json({ error: 'Campo/Setor obrigatorio para o nivel Supervisor' }, { status: 400 });
    }

    const admin = createServerClient();

    // Verificar limite de usuários do plano via subscription_plans.max_users
    const { data: ministryData } = await admin
      .from('ministries')
      .select('name, subscription_plan_id, subscription_plans(name, max_users)')
      .eq('id', ministryId)
      .maybeSingle();

    const planData = (ministryData as any)?.subscription_plans;
    const limite: number = planData?.max_users ?? 3;
    const planoNome: string = planData?.name || 'seu plano';

    const { count: totalUsuarios } = await admin
      .from('ministry_users')
      .select('*', { count: 'exact', head: true })
      .eq('ministry_id', ministryId);

    if ((totalUsuarios ?? 0) >= limite) {
      return NextResponse.json(
        { error: `Limite de usuários atingido para o plano ${planoNome} (máximo: ${limite}). Faça upgrade para adicionar mais usuários.` },
        { status: 403 }
      );
    }

    const roleConfig = mapRoleAndPermissions(nivel);

    const { data: existingFingerprint } = await admin
      .from('user_password_fingerprints')
      .select('user_id')
      .eq('fingerprint', passwordFingerprint)
      .maybeSingle();

    if (existingFingerprint?.user_id) {
      return NextResponse.json({ error: 'Senha ja utilizada por outro usuario' }, { status: 400 });
    }

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { full_name: nome },
    });

    if (authError || !authUser?.user) {
      return NextResponse.json({ error: authError?.message || 'Erro ao criar usuario' }, { status: 400 });
    }

    const { error: fingerprintError } = await admin
      .from('user_password_fingerprints')
      .insert({ user_id: authUser.user.id, fingerprint: passwordFingerprint });

    if (fingerprintError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: 'Senha ja utilizada por outro usuario' }, { status: 400 });
    }

    const { error: linkError } = await admin
      .from('ministry_users')
      .insert({
        ministry_id: ministryId,
        user_id: authUser.user.id,
        role: roleConfig.role,
        permissions: roleConfig.permissions,
        congregacao_id: congregacaoId,
        supervisao_id: supervisaoId,
      } as any);

    if (linkError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, id: authUser.user.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'TRIAL_EXPIRED') {
      return NextResponse.json({ error: 'Expirado' }, { status: 403 });
    }
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function resolveBannedUntil(status: UsuarioResponse['status'] | undefined) {
  if (!status) return undefined;
  if (status === 'ativo') return null;
  const future = new Date();
  future.setFullYear(future.getFullYear() + 100);
  return future.toISOString();
}

export async function PUT(request: NextRequest) {
  try {
    const { ministryId, roles } = await requireFlowAuth(request);
    if (!hasRole(roles, ['ADMINISTRADOR'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<UsuarioUpdateBody>;
    const userId = String(body?.user_id || '').trim();
    const nome = String(body?.nome || '').trim();
    const email = String(body?.email || '').trim();
    const nivel = body?.nivel as UsuarioResponse['nivel'];
    const congregacaoId = body?.congregacao_id ? String(body.congregacao_id) : null;
    const supervisaoId  = body?.supervisao_id  ? String(body.supervisao_id)  : null;
    const status = body?.status as UsuarioResponse['status'] | undefined;
    const senha = body?.senha ? String(body.senha).trim() : '';

    if (!userId || !nome || !email || !nivel) {
      return NextResponse.json({ error: 'user_id, nome, email e nivel sao obrigatorios' }, { status: 400 });
    }

    if (senha && senha.length < 6) {
      return NextResponse.json({ error: 'Senha muito curta' }, { status: 400 });
    }

    if (['admin_local', 'financeiro_local'].includes(nivel) && !congregacaoId) {
      return NextResponse.json({ error: 'Congregacao obrigatoria para este nivel' }, { status: 400 });
    }

    if (nivel === 'supervisor' && !supervisaoId) {
      return NextResponse.json({ error: 'Campo/Setor obrigatorio para o nivel Supervisor' }, { status: 400 });
    }

    const admin = createServerClient();
    const roleConfig = mapRoleAndPermissions(nivel);
    const banned_until = resolveBannedUntil(status);

    const { data: existingUser, error: existingUserError } = await admin.auth.admin.getUserById(userId);
    if (existingUserError) {
      return NextResponse.json({ error: existingUserError.message }, { status: 400 });
    }

    const confirmed = resolveEmailConfirmed(existingUser?.user);
    const currentEmail = String(existingUser?.user?.email || '').trim();
    if (!confirmed && currentEmail && email !== currentEmail) {
      return NextResponse.json({ error: 'Email nao confirmado. Nao e possivel alterar o email.' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      email,
      user_metadata: { full_name: nome },
      email_confirm: true,
    };

    let passwordFingerprint = '';
    if (senha) {
      try {
        passwordFingerprint = buildPasswordFingerprint(senha);
      } catch {
        return NextResponse.json({ error: 'Configuracao de senha nao definida' }, { status: 500 });
      }

      const { data: existingFingerprint } = await admin
        .from('user_password_fingerprints')
        .select('user_id')
        .eq('fingerprint', passwordFingerprint)
        .maybeSingle();

      if (existingFingerprint?.user_id && existingFingerprint.user_id !== userId) {
        return NextResponse.json({ error: 'Senha ja utilizada por outro usuario' }, { status: 400 });
      }

      updatePayload.password = senha;
    }
    if (banned_until !== undefined) updatePayload.banned_until = banned_until;

    const { error: authError } = await admin.auth.admin.updateUserById(userId, updatePayload);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (senha && passwordFingerprint) {
      await admin
        .from('user_password_fingerprints')
        .upsert({ user_id: userId, fingerprint: passwordFingerprint });
    }

    const { data: existing, error: existingError } = await admin
      .from('ministry_users')
      .select('id')
      .eq('ministry_id', ministryId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (existing?.id) {
      const { error: updateError } = await admin
        .from('ministry_users')
        .update({
          role: roleConfig.role,
          permissions: roleConfig.permissions,
          congregacao_id: congregacaoId,
          supervisao_id: supervisaoId,
        })
        .eq('id', existing.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    } else {
      const { error: insertError } = await admin
        .from('ministry_users')
        .insert({
          ministry_id: ministryId,
          user_id: userId,
          role: roleConfig.role,
          permissions: roleConfig.permissions,
          congregacao_id: congregacaoId,
          supervisao_id: supervisaoId,
        } as any);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'TRIAL_EXPIRED') {
      return NextResponse.json({ error: 'Expirado' }, { status: 403 });
    }
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ministryId, roles, userId: currentUserId } = await requireFlowAuth(request);
    if (!hasRole(roles, ['ADMINISTRADOR'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = String(request.nextUrl.searchParams.get('user_id') || '').trim();
    if (!userId) {
      return NextResponse.json({ error: 'user_id é obrigatório' }, { status: 400 });
    }

    if (userId === currentUserId) {
      return NextResponse.json({ error: 'Você não pode remover sua própria conta.' }, { status: 403 });
    }

    const admin = createServerClient();

    // Impede deletar o dono do tenant (ministry.user_id) — causaria cascade e apagaria tudo
    const { data: ministry } = await admin
      .from('ministries')
      .select('user_id')
      .eq('id', ministryId)
      .single();

    if (ministry?.user_id === userId) {
      return NextResponse.json(
        { error: 'Não é possível remover o proprietário do tenant. Transfira a titularidade antes.' },
        { status: 403 }
      );
    }

    const { data: existing, error: checkError } = await admin
      .from('ministry_users')
      .select('user_id')
      .eq('ministry_id', ministryId)
      .eq('user_id', userId)
      .single();

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Usuário não encontrado neste ministério' }, { status: 404 });
    }

    const { error: deleteRelError } = await admin
      .from('ministry_users')
      .delete()
      .eq('ministry_id', ministryId)
      .eq('user_id', userId);

    if (deleteRelError) {
      return NextResponse.json({ error: deleteRelError.message }, { status: 400 });
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno do servidor';
    if (message === 'TRIAL_EXPIRED') {
      return NextResponse.json({ error: 'Expirado' }, { status: 403 });
    }
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuario sem vinculo com ministerio' }, { status: 403 });
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}